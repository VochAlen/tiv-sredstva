'use server'

// Podaci za stranicu "Dnevni pregledi": kompletna dnevna lista svih sredstava i sažetak po datumima.

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { localDate, dayBounds, isValidDate } from '@/lib/local-day'
import { parseRestrictions } from '@/lib/checklist-evaluation'
import type { RestrictionFlag } from '@/lib/types'
import { DAILY_INSPECTION_CHECKLIST } from '@/lib/constants-export'

export type DailyState = 'OK' | 'LIMITED' | 'FAULTY' | 'NOT_INSPECTED'

export interface DailyListRow {
  id: string
  code: string
  name: string
  type: string
  department: string | null
  equipmentStatus: string
  state: DailyState
  inspectorName: string | null
  inspectedAt: string | null // ISO
  shift: string | null
  restrictions: RestrictionFlag[]
}

export interface DailyListReport {
  date: string
  rows: DailyListRow[]
  counts: { total: number; inspected: number; ok: number; limited: number; faulty: number; notInspected: number }
}

interface Insp { equipmentId: string; at: Date; result: string; inspector: string; shift: string | null }

async function loadInspections(startDate: string, endDate: string): Promise<Insp[]> {
  const start = dayBounds(startDate).start, end = dayBounds(endDate).end
  if (isDemoMode()) {
    const rows = await db.dailyInspection.findMany({
      where: { inspectionDate: { gte: start, lte: end } },
      orderBy: { inspectionDate: 'desc' },
    })
    return rows.map((r) => ({ equipmentId: r.equipmentId, at: r.inspectionDate, result: r.result ?? 'FIT', inspector: r.inspectorName, shift: r.shift }))
  }
  const supabase = await createSupabaseClient()
  const out: Insp[] = []
  // PostgREST vraća max 1000 redova po zahtjevu — čitamo u stranicama
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabase
      .from('daily_inspections')
      .select('equipment_id,inspection_date,result,inspector_name,shift')
      .gte('inspection_date', start.toISOString())
      .lte('inspection_date', end.toISOString())
      .order('inspection_date', { ascending: false })
      .range(from, from + 999)
    if (error) throw error
    for (const r of data ?? []) out.push({ equipmentId: r.equipment_id, at: new Date(r.inspection_date), result: r.result, inspector: r.inspector_name, shift: r.shift })
    if (!data || data.length < 1000) break
  }
  return out
}

function stateOf(result: string | null, eqStatus: string): DailyState {
  if (eqStatus === 'OUT_OF_SERVICE' || result === 'UNFIT') return 'FAULTY'
  if (!result) return 'NOT_INSPECTED'
  return result === 'CONDITIONAL' ? 'LIMITED' : 'OK'
}

export async function getDailyListReport(dateStr?: string): Promise<DailyListReport> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  const date = isValidDate(dateStr) ? dateStr : localDate(new Date())

  const [insp, equipment] = await Promise.all([
    loadInspections(date, date),
    isDemoMode()
      ? db.equipment.findMany({ orderBy: [{ type: 'asc' }, { code: 'asc' }] }).then((l) => l.map((e) => ({ id: e.id, code: e.code, name: e.name, type: e.type, department: e.department, status: e.status, restrictions: e.activeRestrictions as unknown })))
      : createSupabaseClient().then((s) => s.from('equipment').select('id,code,name,type,department,status,active_restrictions').order('type').order('code'))
          .then(({ data }) => (data ?? []).map((e: any) => ({ id: e.id, code: e.code, name: e.name, type: e.type, department: e.department ?? null, status: e.status, restrictions: e.active_restrictions as unknown }))),
  ])

  const latest = new Map<string, Insp>() // insp je već sortiran od najnovije
  for (const i of insp) if (!latest.has(i.equipmentId)) latest.set(i.equipmentId, i)

  const rows: DailyListRow[] = equipment.map((e) => {
    const i = latest.get(e.id)
    return {
      id: e.id, code: e.code, name: e.name, type: e.type, department: e.department ?? null,
      equipmentStatus: e.status,
      state: stateOf(i?.result ?? null, e.status),
      inspectorName: i?.inspector ?? null,
      inspectedAt: i ? i.at.toISOString() : null,
      shift: i?.shift ?? null,
      restrictions: Array.isArray(e.restrictions) ? (e.restrictions as RestrictionFlag[]) : parseRestrictions(typeof e.restrictions === 'string' ? e.restrictions : null),
    }
  })
  const c = (s: DailyState) => rows.filter((r) => r.state === s).length
  return {
    date, rows,
    counts: { total: rows.length, inspected: rows.filter((r) => r.inspectedAt).length, ok: c('OK'), limited: c('LIMITED'), faulty: c('FAULTY'), notInspected: c('NOT_INSPECTED') },
  }
}

export interface DailySummaryRow {
  date: string
  total: number
  inspected: number
  ok: number
  limited: number
  faulty: number // pregled UNFIT tog dana
  notInspected: number
}

/** Po danu: koliko sredstava je pregledano, ispravno, ispravno sa ograničenjem, neispravno (po zadnjem pregledu tog dana). */
export async function getDailySummary(days = 30): Promise<DailySummaryRow[]> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  const n = Math.min(Math.max(Math.floor(days) || 30, 1), 180)
  const today = localDate(new Date())
  const startDate = localDate(new Date(Date.now() - (n - 1) * 86400000))

  const [insp, total] = await Promise.all([
    loadInspections(startDate, today),
    isDemoMode()
      ? db.equipment.count()
      : createSupabaseClient().then((s) => s.from('equipment').select('id', { count: 'exact', head: true })).then(({ count }) => count ?? 0),
  ])

  const perDay = new Map<string, Map<string, string>>() // datum -> sredstvo -> rezultat zadnjeg pregleda
  for (const i of insp) { // sortirano od najnovije; prvi po sredstvu je zadnji
    const d = localDate(i.at)
    const m = perDay.get(d) ?? new Map<string, string>()
    if (!m.has(i.equipmentId)) m.set(i.equipmentId, i.result)
    perDay.set(d, m)
  }
  const out: DailySummaryRow[] = []
  for (let k = 0; k < n; k++) {
    const d = localDate(new Date(Date.now() - k * 86400000))
    const m = perDay.get(d) ?? new Map<string, string>()
    const vals = [...m.values()]
    const faulty = vals.filter((v) => v === 'UNFIT').length
    const limited = vals.filter((v) => v === 'CONDITIONAL').length
    out.push({ date: d, total, inspected: vals.length, ok: vals.length - faulty - limited, limited, faulty, notInspected: Math.max(0, total - vals.length) })
  }
  return out // najnoviji prvi
}

// =====================================================
// Karton pojedinačnog sredstva (PDF izvještaj)
// =====================================================

export interface EquipmentReport {
  equipment: { id: string; code: string; name: string; type: string; department: string | null; serialNumber: string | null; location: string; status: string; notes: string | null; restrictions: RestrictionFlag[] }
  days: number
  from: string
  to: string
  strip: Array<{ date: string; state: DailyState }> // najstariji prvi
  inspections: Array<{ at: string; shift: string | null; inspector: string; result: string; failed: string[] }> // najnoviji prvi
  damages: Array<{ createdAt: string; description: string; severity: string; status: string; restriction: string | null; repairedBy: string | null; approvedBy: string | null; workers: string | null; parts: string | null }>
  maintenance: Array<{ performedAt: string; type: string; description: string; performedBy: string | null; status: string }>
  counts: { inspections: number; ok: number; limited: number; faulty: number; daysInspected: number; daysNotInspected: number; openDamages: number }
}

const failedLabels = (raw: unknown): string[] => {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(v) ? v.map((x: any) => String(x?.label ?? x?.id ?? '')).filter(Boolean) : []
  } catch { return [] }
}
const partsText = (raw: unknown): string | null => {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(v) && v.length ? v.map((p: any) => `${p.name} x${p.qty}`).join(', ') : null
  } catch { return null }
}

export async function getEquipmentReport(code: string, daysParam = 30): Promise<EquipmentReport | null> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  const days = Math.min(Math.max(Math.floor(daysParam) || 30, 7), 60)
  const to = localDate(new Date())
  const from = localDate(new Date(Date.now() - (days - 1) * 86400000))
  const start = dayBounds(from).start, end = dayBounds(to).end

  let eq: EquipmentReport['equipment']
  let inspRows: Array<{ at: Date; shift: string | null; inspector: string; result: string; failed: string[] }>
  let dmgRows: EquipmentReport['damages']
  let mntRows: EquipmentReport['maintenance']

  if (isDemoMode()) {
    const e = await db.equipment.findUnique({ where: { code } })
    if (!e) return null
    eq = { id: e.id, code: e.code, name: e.name, type: e.type, department: e.department, serialNumber: e.serialNumber, location: e.location, status: e.status, notes: e.notes, restrictions: parseRestrictions(e.activeRestrictions) }
    const [ins, dm, mn] = await Promise.all([
      db.dailyInspection.findMany({ where: { equipmentId: e.id, inspectionDate: { gte: start, lte: end } }, orderBy: { inspectionDate: 'desc' } }),
      db.damageReport.findMany({ where: { equipmentId: e.id }, orderBy: { createdAt: 'desc' }, take: 8 }),
      db.maintenanceLog.findMany({ where: { equipmentId: e.id }, orderBy: { performedAt: 'desc' }, take: 6 }),
    ])
    inspRows = ins.map((i) => ({ at: i.inspectionDate, shift: i.shift, inspector: i.inspectorName, result: i.result ?? 'FIT', failed: failedLabels(i.issuesJson) }))
    dmgRows = dm.map((d) => ({ createdAt: d.createdAt.toISOString(), description: d.description, severity: d.severity, status: d.status, restriction: d.restrictionLabel, repairedBy: d.repairedByName, approvedBy: d.approvedByName, workers: d.workerNames, parts: partsText(d.partsJson) }))
    mntRows = mn.map((m) => ({ performedAt: m.performedAt.toISOString(), type: m.maintenanceType, description: m.description, performedBy: m.performedBy, status: m.status }))
  } else {
    const supabase = await createSupabaseClient()
    const { data: e } = await supabase.from('equipment').select('*').eq('code', code).maybeSingle()
    if (!e) return null
    eq = { id: e.id, code: e.code, name: e.name, type: e.type, department: e.department ?? null, serialNumber: e.serial_number ?? null, location: e.location, status: e.status, notes: e.notes ?? null, restrictions: Array.isArray(e.active_restrictions) ? e.active_restrictions : parseRestrictions(typeof e.active_restrictions === 'string' ? e.active_restrictions : null) }
    const [ins, dm, mn] = await Promise.all([
      supabase.from('daily_inspections').select('inspection_date,shift,inspector_name,result,issues_json').eq('equipment_id', e.id).gte('inspection_date', start.toISOString()).lte('inspection_date', end.toISOString()).order('inspection_date', { ascending: false }).limit(1000),
      supabase.from('damage_reports').select('*').eq('equipment_id', e.id).order('created_at', { ascending: false }).limit(8),
      supabase.from('maintenance_log').select('performed_at,maintenance_type,description,performed_by,status').eq('equipment_id', e.id).order('performed_at', { ascending: false }).limit(6),
    ])
    inspRows = (ins.data ?? []).map((i: any) => ({ at: new Date(i.inspection_date), shift: i.shift, inspector: i.inspector_name, result: i.result, failed: failedLabels(i.issues_json) }))
    dmgRows = (dm.data ?? []).map((d: any) => ({ createdAt: d.created_at, description: d.description, severity: d.severity, status: d.status, restriction: d.restriction_label ?? null, repairedBy: d.repaired_by_name ?? null, approvedBy: d.approved_by_name ?? null, workers: d.worker_names ?? null, parts: partsText(d.parts_json) }))
    mntRows = (mn.data ?? []).map((m: any) => ({ performedAt: m.performed_at, type: m.maintenance_type, description: m.description, performedBy: m.performed_by, status: m.status }))
  }

  const latestPerDay = new Map<string, string>()
  for (const i of inspRows) { const d = localDate(i.at); if (!latestPerDay.has(d)) latestPerDay.set(d, i.result) }
  const strip: EquipmentReport['strip'] = []
  for (let k = days - 1; k >= 0; k--) {
    const d = localDate(new Date(Date.now() - k * 86400000))
    const r = latestPerDay.get(d)
    strip.push({ date: d, state: !r ? 'NOT_INSPECTED' : r === 'UNFIT' ? 'FAULTY' : r === 'CONDITIONAL' ? 'LIMITED' : 'OK' })
  }
  const cnt = (s: DailyState) => strip.filter((x) => x.state === s).length
  return {
    equipment: eq, days, from, to, strip,
    inspections: inspRows.map((i) => ({ at: i.at.toISOString(), shift: i.shift, inspector: i.inspector, result: i.result, failed: i.failed })),
    damages: dmgRows, maintenance: mntRows,
    counts: {
      inspections: inspRows.length, ok: cnt('OK'), limited: cnt('LIMITED'), faulty: cnt('FAULTY'),
      daysInspected: days - cnt('NOT_INSPECTED'), daysNotInspected: cnt('NOT_INSPECTED'),
      openDamages: dmgRows.filter((d) => d.status !== 'RESOLVED').length,
    },
  }
}

// =====================================================
// Pojedinačni dnevni pregled (PDF za jedno sredstvo i jedan datum) + evidencija svih pregleda
// =====================================================

export interface InspectionItemRow { id: string; label: string; passed: boolean; severity: string; restrictionLabel: string | null }
export interface InspectionReport {
  equipment: { id: string; code: string; name: string; type: string; department: string | null; serialNumber: string | null; location: string; status: string; restrictions: RestrictionFlag[] }
  inspection: { id: string; at: string; shift: string | null; inspector: string; inspectorCardId: string | null; result: string; notes: string | null; items: InspectionItemRow[] }
  date: string
  countThatDay: number
  otherTimes: string[] // ISO vremena ostalih pregleda tog dana
}

function parseItems(raw: unknown): InspectionItemRow[] {
  let v: unknown = raw
  try { if (typeof raw === 'string') v = JSON.parse(raw) } catch { v = [] }
  if (!Array.isArray(v)) return []
  const defs = new Map(DAILY_INSPECTION_CHECKLIST.map((d) => [d.id, d]))
  return v.map((x: any) => {
    const d = defs.get(String(x?.id))
    return {
      id: String(x?.id ?? ''),
      label: String(x?.label ?? d?.label ?? x?.id ?? ''),
      passed: x?.passed === true,
      severity: String(x?.severity ?? d?.severity ?? 'MINOR'),
      restrictionLabel: (x?.restrictionLabel ?? d?.restrictionLabel ?? null) as string | null,
    }
  })
}

/** Pregled za sredstvo na izabrani datum (zadnji tog dana) ili tačno po id-u pregleda. */
export async function getInspectionReport(params: { code?: string; date?: string; id?: string }): Promise<InspectionReport | null> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')

  type Raw = { id: string; equipmentId: string; at: Date; shift: string | null; inspector: string; card: string | null; result: string; notes: string | null; checklist: unknown }
  let list: Raw[] = []
  let eq: InspectionReport['equipment'] | null = null

  if (isDemoMode()) {
    let e = params.code ? await db.equipment.findUnique({ where: { code: params.code } }) : null
    if (params.id) {
      const one = await db.dailyInspection.findUnique({ where: { id: params.id } })
      if (!one) return null
      e = await db.equipment.findUnique({ where: { id: one.equipmentId } })
      if (!e) return null
      const { start, end } = dayBounds(localDate(one.inspectionDate))
      const rows = await db.dailyInspection.findMany({ where: { equipmentId: e.id, inspectionDate: { gte: start, lte: end } }, orderBy: { inspectionDate: 'desc' } })
      list = rows.map((r) => ({ id: r.id, equipmentId: r.equipmentId, at: r.inspectionDate, shift: r.shift, inspector: r.inspectorName, card: r.inspectorCardId, result: r.result ?? 'FIT', notes: r.notes, checklist: r.checklistJson }))
      params = { ...params, date: localDate(one.inspectionDate) }
    } else {
      if (!e || !isValidDate(params.date)) return null
      const { start, end } = dayBounds(params.date)
      const rows = await db.dailyInspection.findMany({ where: { equipmentId: e.id, inspectionDate: { gte: start, lte: end } }, orderBy: { inspectionDate: 'desc' } })
      list = rows.map((r) => ({ id: r.id, equipmentId: r.equipmentId, at: r.inspectionDate, shift: r.shift, inspector: r.inspectorName, card: r.inspectorCardId, result: r.result ?? 'FIT', notes: r.notes, checklist: r.checklistJson }))
    }
    if (!e) return null
    eq = { id: e.id, code: e.code, name: e.name, type: e.type, department: e.department, serialNumber: e.serialNumber, location: e.location, status: e.status, restrictions: parseRestrictions(e.activeRestrictions) }
  } else {
    const supabase = await createSupabaseClient()
    let equipmentId: string | null = null
    if (params.id) {
      const { data: one } = await supabase.from('daily_inspections').select('equipment_id,inspection_date').eq('id', params.id).maybeSingle()
      if (!one) return null
      equipmentId = one.equipment_id
      params = { ...params, date: localDate(new Date(one.inspection_date)) }
    } else {
      if (!params.code || !isValidDate(params.date)) return null
      const { data: e0 } = await supabase.from('equipment').select('id').eq('code', params.code).maybeSingle()
      equipmentId = e0?.id ?? null
    }
    if (!equipmentId) return null
    const { data: e } = await supabase.from('equipment').select('*').eq('id', equipmentId).maybeSingle()
    if (!e) return null
    eq = { id: e.id, code: e.code, name: e.name, type: e.type, department: e.department ?? null, serialNumber: e.serial_number ?? null, location: e.location, status: e.status, restrictions: Array.isArray(e.active_restrictions) ? e.active_restrictions : parseRestrictions(typeof e.active_restrictions === 'string' ? e.active_restrictions : null) }
    const { start, end } = dayBounds(params.date as string)
    const { data } = await supabase.from('daily_inspections').select('*').eq('equipment_id', equipmentId).gte('inspection_date', start.toISOString()).lte('inspection_date', end.toISOString()).order('inspection_date', { ascending: false })
    list = (data ?? []).map((r: any) => ({ id: r.id, equipmentId: r.equipment_id, at: new Date(r.inspection_date), shift: r.shift, inspector: r.inspector_name, card: r.inspector_card_id ?? null, result: r.result, notes: r.notes ?? null, checklist: r.checklist_json }))
  }

  if (list.length === 0 || !eq) return null
  const chosen = params.id ? list.find((r) => r.id === params.id) ?? list[0] : list[0]
  return {
    equipment: eq,
    inspection: { id: chosen.id, at: chosen.at.toISOString(), shift: chosen.shift, inspector: chosen.inspector, inspectorCardId: chosen.card, result: chosen.result, notes: chosen.notes, items: parseItems(chosen.checklist) },
    date: params.date as string,
    countThatDay: list.length,
    otherTimes: list.filter((r) => r.id !== chosen.id).map((r) => r.at.toISOString()),
  }
}

export interface InspectionLogRow { id: string; at: string; code: string; name: string; inspector: string; shift: string | null; result: string; failed: string[] }

/** Evidencija SVIH dnevnih pregleda (najnoviji prvi) sa filterima i paginacijom na serveru. */
export async function getInspectionLog(p: { from?: string; to?: string; search?: string; result?: string; page?: number; pageSize?: number }): Promise<{ rows: InspectionLogRow[]; total: number }> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  const pageSize = Math.min(Math.max(p.pageSize ?? 15, 5), 50)
  const page = Math.max(p.page ?? 0, 0)
  const to = isValidDate(p.to) ? p.to : localDate(new Date())
  const from = isValidDate(p.from) ? p.from : localDate(new Date(Date.now() - 29 * 86400000))
  const start = dayBounds(from).start, end = dayBounds(to).end
  const q = (p.search ?? '').trim()
  const result = p.result && ['FIT', 'CONDITIONAL', 'UNFIT'].includes(p.result) ? p.result : undefined

  if (isDemoMode()) {
    const where = {
      inspectionDate: { gte: start, lte: end },
      ...(result && { result }),
      ...(q && { OR: [{ equipmentCode: { contains: q } }, { equipmentName: { contains: q } }, { inspectorName: { contains: q } }] }),
    }
    const [total, rows] = await Promise.all([
      db.dailyInspection.count({ where }),
      db.dailyInspection.findMany({ where, orderBy: { inspectionDate: 'desc' }, skip: page * pageSize, take: pageSize }),
    ])
    return { total, rows: rows.map((r) => ({ id: r.id, at: r.inspectionDate.toISOString(), code: r.equipmentCode, name: r.equipmentName, inspector: r.inspectorName, shift: r.shift, result: r.result ?? 'FIT', failed: failedLabels(r.issuesJson) })) }
  }

  const supabase = await createSupabaseClient()
  let query = supabase.from('daily_inspections')
    .select('id,inspection_date,equipment_code,equipment_name,inspector_name,shift,result,issues_json', { count: 'exact' })
    .gte('inspection_date', start.toISOString()).lte('inspection_date', end.toISOString())
    .order('inspection_date', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)
  if (result) query = query.eq('result', result)
  if (q) {
    const safe = q.replace(/[%,()]/g, ' ')
    query = query.or(`equipment_code.ilike.%${safe}%,equipment_name.ilike.%${safe}%,inspector_name.ilike.%${safe}%`)
  }
  const { data, count, error } = await query
  if (error) throw error
  return { total: count ?? 0, rows: (data ?? []).map((r: any) => ({ id: r.id, at: new Date(r.inspection_date).toISOString(), code: r.equipment_code, name: r.equipment_name, inspector: r.inspector_name, shift: r.shift, result: r.result, failed: failedLabels(r.issues_json) })) }
}
