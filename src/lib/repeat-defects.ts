// Ponavljajući kvarovi: isto sredstvo, ista stavka dnevnog pregleda ILI ista kategorija kvara, 3+ puta u 90 dana.
// Čista logika (bez baze) - koriste je server akcija, PDF karton i izvještaji.

import { DAILY_INSPECTION_CHECKLIST } from '@/lib/constants-export'

export const REPEAT_WINDOW_DAYS = 90
export const REPEAT_THRESHOLD = 3
export const REPEAT_ADVICE = 'Pokrenuti analizu uzroka (root cause) i razmotriti zamjenu dijela ili sredstva — krpljenje se ponavlja.'

export interface RepeatInput {
  id: string
  equipmentId: string
  equipmentCode: string
  equipmentName: string
  category: string | null
  sourceItem: string | null
  description: string
  createdAt: Date | string
  status: string
}

export interface RepeatGroup {
  equipmentId: string
  equipmentCode: string
  equipmentName: string
  kind: 'ITEM' | 'CATEGORY'
  key: string
  label: string
  count: number
  firstAt: string
  lastAt: string
  damageIds: string[]
  hasOpen: boolean
}

const CATEGORY_LABEL: Record<string, string> = {
  MEHANIKA: 'Mehanika', ELEKTRIKA: 'Elektrika', HIDRAULIKA: 'Hidraulika', BEZBJEDNOST: 'Bezbjednosna oprema', OPSTE: 'Opšte',
}

export function itemLabel(sourceItem: string): string {
  const id = sourceItem.replace(/^daily:/, '')
  return DAILY_INSPECTION_CHECKLIST.find((d) => d.id === id)?.label ?? id
}

/** Grupe sa najmanje REPEAT_THRESHOLD kvarova u prozoru; kategorija se ne prijavljuje ako je isti skup već pokriven stavkom pregleda. */
export function findRepeats(rows: RepeatInput[], now: Date = new Date()): RepeatGroup[] {
  const since = now.getTime() - REPEAT_WINDOW_DAYS * 86_400_000
  const recent = rows.filter((r) => new Date(r.createdAt).getTime() >= since)
  const byKey = new Map<string, RepeatInput[]>()
  const add = (k: string, r: RepeatInput) => { const a = byKey.get(k); if (a) a.push(r); else byKey.set(k, [r]) }
  for (const r of recent) {
    if (r.sourceItem) add(`${r.equipmentId}|ITEM|${r.sourceItem}`, r)
    if (r.category) add(`${r.equipmentId}|CATEGORY|${r.category}`, r)
  }
  const out: RepeatGroup[] = []
  const itemSets: Array<{ eq: string; ids: Set<string> }> = []
  const build = (k: string, list: RepeatInput[]): RepeatGroup => {
    const [, kind, key] = k.split('|') as [string, 'ITEM' | 'CATEGORY', string]
    const times = list.map((x) => new Date(x.createdAt).getTime()).sort((a, b) => a - b)
    return {
      equipmentId: list[0].equipmentId, equipmentCode: list[0].equipmentCode, equipmentName: list[0].equipmentName,
      kind, key, label: kind === 'ITEM' ? itemLabel(key) : CATEGORY_LABEL[key] ?? key, count: list.length,
      firstAt: new Date(times[0]).toISOString(), lastAt: new Date(times[times.length - 1]).toISOString(),
      damageIds: list.map((x) => x.id), hasOpen: list.some((x) => x.status !== 'RESOLVED'),
    }
  }
  for (const [k, list] of byKey) {
    if (list.length < REPEAT_THRESHOLD || !k.includes('|ITEM|')) continue
    out.push(build(k, list)); itemSets.push({ eq: list[0].equipmentId, ids: new Set(list.map((x) => x.id)) })
  }
  for (const [k, list] of byKey) {
    if (list.length < REPEAT_THRESHOLD || !k.includes('|CATEGORY|')) continue
    const covered = itemSets.some((s) => s.eq === list[0].equipmentId && list.every((x) => s.ids.has(x.id)))
    if (!covered) out.push(build(k, list))
  }
  return out.sort((a, b) => Number(b.hasOpen) - Number(a.hasOpen) || b.count - a.count || b.lastAt.localeCompare(a.lastAt))
}
