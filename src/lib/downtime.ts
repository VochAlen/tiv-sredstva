// Statistika zastoja za mjesec: prosječno vrijeme popravke, raspoloživost po sredstvu, kvarovi po tipu, najčešći uzroci.
// Čista logika (bez baze). Zastoj = vrijeme dok je otvorena prijava težine MAJOR/CRITICAL (takva sredstva se blokiraju).

import { dayBounds } from '@/lib/local-day'
import { itemLabel } from '@/lib/repeat-defects'

export interface DowntimeDamage {
  id: string
  equipmentId: string
  equipmentCode: string
  equipmentName: string
  equipmentType: string
  severity: string
  category: string | null
  sourceItem: string | null
  description: string
  rootCause: string | null
  status: string
  createdAt: Date
  acknowledgedAt: Date | null
  workshopArrivedAt: Date | null
  resolvedAt: Date | null
}

export interface DowntimeStats {
  month: string
  periodHours: number
  fleetSize: number
  reported: number
  resolved: number
  stillOpen: number
  mttrHours: number | null // preuzeto -> riješeno (za kvarove riješene u mjesecu)
  reactionHours: number | null // prijavljeno -> preuzeto
  workshopHours: number | null // doveženo u radionicu -> riješeno
  fleetAvailabilityPct: number | null
  byEquipment: Array<{ code: string; name: string; faults: number; downtimeHours: number; availabilityPct: number }>
  byCategory: Array<{ label: string; count: number }>
  byType: Array<{ label: string; count: number }>
  topCauses: Array<{ label: string; count: number }>
}

const HOUR = 3_600_000
const CATEGORY_LABEL: Record<string, string> = {
  MEHANIKA: 'Mehanika', ELEKTRIKA: 'Elektrika', HIDRAULIKA: 'Hidraulika', BEZBJEDNOST: 'Bezbjednosna oprema', OPSTE: 'Opšte',
}

export const isMonth = (m: unknown): m is string => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m)

export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number)
  const first = `${month}-01`
  const nextFirst = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return { start: dayBounds(first).start, end: new Date(dayBounds(nextFirst).start.getTime() - 1) }
}

const avg = (xs: number[]): number | null => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)
const top = (map: Map<string, number>, n = 5) => [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, n)
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)

export function computeDowntime(rows: DowntimeDamage[], month: string, fleetSize: number, now: Date = new Date()): DowntimeStats {
  const { start, end } = monthRange(month)
  const to = Math.min(end.getTime(), now.getTime())
  const periodMs = Math.max(0, to - start.getTime())
  const inMonth = (d: Date | null) => !!d && d.getTime() >= start.getTime() && d.getTime() <= end.getTime()

  const created = rows.filter((r) => inMonth(r.createdAt))
  const resolvedNow = rows.filter((r) => r.status === 'RESOLVED' && inMonth(r.resolvedAt))

  // Zastoj: spoji preklapajuće intervale po sredstvu, isjeci na mjesec
  const intervals = new Map<string, Array<[number, number]>>()
  for (const r of rows) {
    if (r.severity !== 'MAJOR' && r.severity !== 'CRITICAL') continue
    const a = Math.max(r.createdAt.getTime(), start.getTime())
    const b = Math.min((r.resolvedAt ?? now).getTime(), to)
    if (b <= a) continue
    const list = intervals.get(r.equipmentId) ?? []
    list.push([a, b]); intervals.set(r.equipmentId, list)
  }
  const down = new Map<string, number>()
  for (const [id, list] of intervals) {
    list.sort((x, y) => x[0] - y[0])
    let total = 0, curA = list[0][0], curB = list[0][1]
    for (const [a, b] of list.slice(1)) { if (a <= curB) curB = Math.max(curB, b); else { total += curB - curA; curA = a; curB = b } }
    total += curB - curA
    down.set(id, total)
  }
  const meta = new Map(rows.map((r) => [r.equipmentId, r]))
  const faults = new Map<string, number>()
  for (const r of created) faults.set(r.equipmentId, (faults.get(r.equipmentId) ?? 0) + 1)
  const ids = new Set([...down.keys(), ...faults.keys()])
  const byEquipment = [...ids].map((id) => {
    const m = meta.get(id)!
    const ms = Math.min(down.get(id) ?? 0, periodMs)
    return {
      code: m.equipmentCode, name: m.equipmentName, faults: faults.get(id) ?? 0,
      downtimeHours: Math.round((ms / HOUR) * 10) / 10,
      availabilityPct: periodMs > 0 ? Math.round((1 - ms / periodMs) * 1000) / 10 : 100,
    }
  }).sort((a, b) => b.downtimeHours - a.downtimeHours || b.faults - a.faults)

  const totalDown = [...down.values()].reduce((a, b) => a + Math.min(b, periodMs), 0)
  const byCategory = new Map<string, number>(), byType = new Map<string, number>(), causes = new Map<string, number>()
  for (const r of created) {
    bump(byCategory, r.category ? CATEGORY_LABEL[r.category] ?? r.category : 'Nije određeno')
    bump(byType, r.equipmentType)
    const cause = r.rootCause?.trim() || (r.sourceItem ? itemLabel(r.sourceItem) : r.description.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 50))
    bump(causes, cause)
  }
  const diff = (a: Date | null, b: Date | null) => (a && b && b.getTime() >= a.getTime() ? (b.getTime() - a.getTime()) / HOUR : null)
  const nums = (xs: Array<number | null>) => xs.filter((x): x is number => x != null)

  return {
    month, periodHours: Math.round(periodMs / HOUR), fleetSize,
    reported: created.length, resolved: resolvedNow.length, stillOpen: rows.filter((r) => r.status !== 'RESOLVED' && r.createdAt.getTime() <= end.getTime()).length,
    mttrHours: avg(nums(resolvedNow.map((r) => diff(r.acknowledgedAt, r.resolvedAt)))),
    reactionHours: avg(nums(created.map((r) => diff(r.createdAt, r.acknowledgedAt)))),
    workshopHours: avg(nums(resolvedNow.map((r) => diff(r.workshopArrivedAt, r.resolvedAt)))),
    fleetAvailabilityPct: fleetSize > 0 && periodMs > 0 ? Math.round((1 - totalDown / (fleetSize * periodMs)) * 1000) / 10 : null,
    byEquipment, byCategory: top(byCategory), byType: top(byType), topCauses: top(causes),
  }
}
