'use server'

// PM radni nalog po IATA AHM 917 (Maintenance Work Order / check sheet): otvaranje, popunjavanje, zatvaranje.
// Zatvaranjem se servis upisuje u servisni plan (minor/major) i baze plana se pomjeraju.

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { localDate } from '@/lib/local-day'
import { logAudit } from '@/lib/actions-advanced'
import { persistService } from '@/lib/service-plan-write'
import { hasPmChecklist, requiredKeys, parseExcluded, type PmItem, type PmKind, type PmAnswer } from '@/lib/pm-checklists'

type Result = { ok: boolean; error?: string }

export interface PmWorkOrderData {
  id: string
  no: string
  equipmentId: string
  equipmentCode: string
  equipmentName: string
  equipmentType: string
  manufacturer: string | null
  checklistType: string
  kind: PmKind
  status: 'OPEN' | 'DONE'
  pmBasedOn: string | null
  meterHours: number | null
  meterKm: number | null
  leadMechanic: string | null
  additionalMechanic: string | null
  items: PmItem[]
  excludedSections: string[]
  hoursWorked: number | null
  partsCost: number | null
  tireCost: number | null
  comment: string | null
  defectsRectified: boolean | null
  serviceable: boolean | null
  issuedAt: string
  completedAt: string | null
  createdBy: string | null
  completedBy: string | null
}

async function requireEngineer(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  if (user.role !== 'engineer' && user.role !== 'admin') throw new Error('Nemate dozvolu. Potrebna rola: engineer')
  return user
}
async function writer() {
  return hasServiceClient() ? createServiceClient() : await createSupabaseClient()
}

const numOrNull = (v: unknown): number | null => (v == null || v === '' ? null : Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null)
const ANSWERS: PmAnswer[] = ['OK', 'NOT_OK', 'FIXED', 'NA']

function cleanItems(raw: unknown): PmItem[] {
  let v = raw
  if (typeof raw === 'string') { try { v = JSON.parse(raw) } catch { v = [] } }
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  const out: PmItem[] = []
  for (const x of v) {
    const k = String((x as PmItem)?.k ?? '')
    const s = (x as PmItem)?.s
    if (!k || seen.has(k) || !ANSWERS.includes(s)) continue
    seen.add(k)
    const c = String((x as PmItem)?.c ?? '').trim().slice(0, 300)
    out.push(c ? { k, s, c } : { k, s })
  }
  return out
}

const woNo = (id: string, issued: string) => `PM-${issued.slice(0, 10).replace(/-/g, '')}-${id.replace(/-/g, '').slice(0, 5).toUpperCase()}`

type Row = Record<string, unknown>
function mapRow(r: Row, eq: { code: string; name: string; type: string; manufacturer: string | null }, supa: boolean): PmWorkOrderData {
  const g = (camel: string, snake: string) => (supa ? r[snake] : r[camel]) as unknown
  const issued = new Date(String(g('issuedAt', 'issued_at'))).toISOString()
  const completed = g('completedAt', 'completed_at')
  const items = cleanItems(supa ? r.items : r.items)
  const ex = g('excludedSections', 'excluded_sections') as string | null
  return {
    id: String(r.id), no: woNo(String(r.id), issued),
    equipmentId: String(g('equipmentId', 'equipment_id')), equipmentCode: eq.code, equipmentName: eq.name, equipmentType: eq.type, manufacturer: eq.manufacturer,
    checklistType: String(g('checklistType', 'checklist_type')), kind: (r.kind === 'MAJOR' ? 'MAJOR' : 'MINOR') as PmKind,
    status: r.status === 'DONE' ? 'DONE' : 'OPEN', pmBasedOn: (g('pmBasedOn', 'pm_based_on') as string | null) ?? null,
    meterHours: numOrNull(g('meterHours', 'meter_hours')), meterKm: numOrNull(g('meterKm', 'meter_km')),
    leadMechanic: (g('leadMechanic', 'lead_mechanic') as string | null) ?? null, additionalMechanic: (g('additionalMechanic', 'additional_mechanic') as string | null) ?? null,
    items, excludedSections: parseExcluded(ex),
    hoursWorked: numOrNull(g('hoursWorked', 'hours_worked')), partsCost: numOrNull(g('partsCost', 'parts_cost')), tireCost: numOrNull(g('tireCost', 'tire_cost')),
    comment: (r.comment as string | null) ?? null,
    defectsRectified: (g('defectsRectified', 'defects_rectified') as boolean | null) ?? null, serviceable: (r.serviceable as boolean | null) ?? null,
    issuedAt: issued, completedAt: completed ? new Date(String(completed)).toISOString() : null,
    createdBy: (g('createdBy', 'created_by') as string | null) ?? null, completedBy: (g('completedBy', 'completed_by') as string | null) ?? null,
  }
}

async function loadEq(id: string): Promise<{ id: string; code: string; name: string; type: string; manufacturer: string | null; totalKm: number; totalHours: number; excluded: string | null } | null> {
  if (isDemoMode()) {
    const e = await db.equipment.findUnique({ where: { id } })
    return e ? { id: e.id, code: e.code, name: e.name, type: e.type, manufacturer: e.manufacturer ?? null, totalKm: e.totalKm ?? 0, totalHours: e.totalOperatingHours ?? 0, excluded: e.pmExcludedSections } : null
  }
  const sb = await createSupabaseClient()
  const { data: e } = await sb.from('equipment').select('*').eq('id', id).maybeSingle()
  return e ? { id: e.id, code: e.code, name: e.name, type: e.type, manufacturer: e.manufacturer ?? null, totalKm: Number(e.total_km ?? 0), totalHours: Number(e.total_operating_hours ?? 0), excluded: e.pm_excluded_sections ?? null } : null
}

async function fetchWo(id: string): Promise<PmWorkOrderData | null> {
  if (isDemoMode()) {
    const r = await db.pmWorkOrder.findUnique({ where: { id } })
    if (!r) return null
    const eq = await loadEq(r.equipmentId)
    return mapRow(r as unknown as Row, eq ?? { code: r.equipmentCode, name: '', type: r.checklistType, manufacturer: null }, false)
  }
  const sb = await createSupabaseClient()
  const { data: r, error } = await sb.from('pm_work_orders').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(/pm_work_orders/i.test(error.message) ? 'Pokrenite migraciju 033_pm_ahm917.sql (supabase/MIGRATIONS.md).' : error.message)
  if (!r) return null
  const eq = await loadEq(r.equipment_id)
  return mapRow(r, eq ?? { code: r.equipment_code, name: '', type: r.checklist_type, manufacturer: null }, true)
}

/** Otvara novi radni nalog za sredstvo ili vraća već otvoreni (jedan otvoren nalog po sredstvu). */
export async function openPmWorkOrder(equipmentId: string, kind: PmKind): Promise<{ ok: boolean; error?: string; wo?: PmWorkOrderData }> {
  let user: AppUser
  try { user = await requireEngineer() } catch (e) { return { ok: false, error: (e as Error).message } }
  try {
    const eq = await loadEq(equipmentId)
    if (!eq) return { ok: false, error: 'Sredstvo nije pronađeno' }
    if (!hasPmChecklist(eq.type)) return { ok: false, error: 'Za ovaj tip sredstva još nema AHM 917 check-sheet-a' }
    const k: PmKind = kind === 'MAJOR' ? 'MAJOR' : 'MINOR'
    const who = user.full_name || user.email
    let id: string | null = null
    if (isDemoMode()) {
      const open = await db.pmWorkOrder.findFirst({ where: { equipmentId, status: 'OPEN' }, orderBy: { issuedAt: 'desc' } })
      id = open?.id ?? (await db.pmWorkOrder.create({ data: { equipmentId, equipmentCode: eq.code, checklistType: eq.type, kind: k, meterHours: eq.totalHours, meterKm: eq.totalKm, excludedSections: eq.excluded, leadMechanic: who, createdBy: who } })).id
    } else {
      const sb = await writer()
      const { data: open, error: e0 } = await sb.from('pm_work_orders').select('id').eq('equipment_id', equipmentId).eq('status', 'OPEN').order('issued_at', { ascending: false }).limit(1)
      if (e0) return { ok: false, error: /pm_work_orders/i.test(e0.message) ? 'Pokrenite migraciju 033_pm_ahm917.sql (supabase/MIGRATIONS.md).' : e0.message }
      if (open && open.length) id = open[0].id
      else {
        const { data, error } = await sb.from('pm_work_orders').insert({ equipment_id: equipmentId, equipment_code: eq.code, checklist_type: eq.type, kind: k, meter_hours: eq.totalHours, meter_km: eq.totalKm, excluded_sections: eq.excluded, lead_mechanic: who, created_by: who }).select('id').single()
        if (error) return { ok: false, error: error.message }
        id = data.id
      }
    }
    const wo = await fetchWo(id as string)
    return wo ? { ok: true, wo } : { ok: false, error: 'Radni nalog nije učitan' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Greška' }
  }
}

export async function getPmWorkOrder(id: string): Promise<PmWorkOrderData | null> {
  await requireEngineer()
  return fetchWo(id)
}

export async function listPmWorkOrders(equipmentId: string): Promise<Array<Pick<PmWorkOrderData, 'id' | 'no' | 'kind' | 'status' | 'issuedAt' | 'completedAt' | 'serviceable' | 'leadMechanic'>>> {
  await requireEngineer()
  if (isDemoMode()) {
    const list = await db.pmWorkOrder.findMany({ where: { equipmentId }, orderBy: { issuedAt: 'desc' }, take: 15 })
    return list.map((r) => { const issued = r.issuedAt.toISOString(); return { id: r.id, no: woNo(r.id, issued), kind: r.kind === 'MAJOR' ? 'MAJOR' : 'MINOR', status: r.status === 'DONE' ? 'DONE' : 'OPEN', issuedAt: issued, completedAt: r.completedAt?.toISOString() ?? null, serviceable: r.serviceable, leadMechanic: r.leadMechanic } })
  }
  const sb = await createSupabaseClient()
  const { data } = await sb.from('pm_work_orders').select('id,kind,status,issued_at,completed_at,serviceable,lead_mechanic').eq('equipment_id', equipmentId).order('issued_at', { ascending: false }).limit(15)
  return (data ?? []).map((r) => { const issued = new Date(r.issued_at).toISOString(); return { id: r.id, no: woNo(r.id, issued), kind: r.kind === 'MAJOR' ? 'MAJOR' : 'MINOR', status: r.status === 'DONE' ? 'DONE' : 'OPEN', issuedAt: issued, completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null, serviceable: r.serviceable, leadMechanic: r.lead_mechanic } })
}

export interface PmSaveInput {
  id: string
  kind: PmKind
  items: PmItem[]
  excludedSections: string[]
  pmBasedOn?: string | null
  meterHours?: number | string | null
  meterKm?: number | string | null
  leadMechanic?: string
  additionalMechanic?: string
  hoursWorked?: number | string | null
  partsCost?: number | string | null
  tireCost?: number | string | null
  comment?: string
  defectsRectified?: boolean | null
  serviceable?: boolean | null
}

function toPatch(i: PmSaveInput) {
  const t = (v: unknown, max: number) => { const s = String(v ?? '').trim().slice(0, max); return s || null }
  return {
    kind: (i.kind === 'MAJOR' ? 'MAJOR' : 'MINOR') as PmKind,
    items: cleanItems(i.items),
    excluded: [...new Set((i.excludedSections ?? []).map((s) => String(s).replace(/[^a-z0-9._-]/gi, '')).filter(Boolean))].join(',') || null,
    basedOn: ['HOURS', 'MONTHS', 'KM'].includes(String(i.pmBasedOn)) ? String(i.pmBasedOn) : null,
    hours: numOrNull(i.meterHours), km: numOrNull(i.meterKm),
    lead: t(i.leadMechanic, 80), add: t(i.additionalMechanic, 80),
    worked: numOrNull(i.hoursWorked), parts: numOrNull(i.partsCost), tire: numOrNull(i.tireCost),
    comment: t(i.comment, 1000),
    rectified: typeof i.defectsRectified === 'boolean' ? i.defectsRectified : null,
    serviceable: typeof i.serviceable === 'boolean' ? i.serviceable : null,
  }
}

async function persist(id: string, p: ReturnType<typeof toPatch>, extra: { done?: { by: string } } = {}): Promise<Result> {
  const doneAt = new Date()
  if (isDemoMode()) {
    await db.pmWorkOrder.update({
      where: { id },
      data: {
        kind: p.kind, items: JSON.stringify(p.items), excludedSections: p.excluded, pmBasedOn: p.basedOn, meterHours: p.hours, meterKm: p.km,
        leadMechanic: p.lead, additionalMechanic: p.add, hoursWorked: p.worked, partsCost: p.parts, tireCost: p.tire, comment: p.comment,
        defectsRectified: p.rectified, serviceable: p.serviceable,
        ...(extra.done ? { status: 'DONE', completedAt: doneAt, completedBy: extra.done.by } : {}),
      },
    })
    return { ok: true }
  }
  const sb = await writer()
  const { error } = await sb.from('pm_work_orders').update({
    kind: p.kind, items: p.items, excluded_sections: p.excluded, pm_based_on: p.basedOn, meter_hours: p.hours, meter_km: p.km,
    lead_mechanic: p.lead, additional_mechanic: p.add, hours_worked: p.worked, parts_cost: p.parts, tire_cost: p.tire, comment: p.comment,
    defects_rectified: p.rectified, serviceable: p.serviceable,
    ...(extra.done ? { status: 'DONE', completed_at: doneAt.toISOString(), completed_by: extra.done.by } : {}),
  }).eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Snima napredak (ne zatvara nalog). */
export async function savePmWorkOrder(input: PmSaveInput): Promise<Result> {
  try { await requireEngineer() } catch (e) { return { ok: false, error: (e as Error).message } }
  try {
    const cur = await fetchWo(input.id)
    if (!cur) return { ok: false, error: 'Radni nalog nije pronađen' }
    if (cur.status === 'DONE') return { ok: false, error: 'Radni nalog je već zatvoren' }
    return await persist(input.id, toPatch(input))
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Greška' }
  }
}

/** Zatvara nalog: sve stavke moraju biti popunjene; servis se upisuje u servisni plan (minor/major). */
export async function completePmWorkOrder(input: PmSaveInput): Promise<Result & { notOk?: number }> {
  let user: AppUser
  try { user = await requireEngineer() } catch (e) { return { ok: false, error: (e as Error).message } }
  try {
    const cur = await fetchWo(input.id)
    if (!cur) return { ok: false, error: 'Radni nalog nije pronađen' }
    if (cur.status === 'DONE') return { ok: false, error: 'Radni nalog je već zatvoren' }
    const p = toPatch(input)
    const excluded = parseExcluded(p.excluded)
    const answered = new Set(p.items.map((i) => i.k))
    const missing = requiredKeys(cur.checklistType, p.kind, excluded).filter((k) => !answered.has(k))
    if (missing.length) return { ok: false, error: `Nisu popunjene sve stavke (preostalo ${missing.length}). Za cijelu sekciju koja ne važe za vozilo koristite „Ne važi za ovo vozilo“.` }
    if (!p.lead) return { ok: false, error: 'Upišite glavnog mehaničara' }
    if (p.serviceable == null) return { ok: false, error: 'Izaberite da li je sredstvo u ispravnom stanju (zaključak na kraju naloga)' }
    const notOk = p.items.filter((i) => i.s === 'NOT_OK').length
    if (notOk > 0 && p.rectified == null) return { ok: false, error: 'Postoje stavke „NIJE OK“ - označite da li su nedostaci otklonjeni' }

    const who = user.full_name || user.email
    const res = await persistService({
      equipmentId: cur.equipmentId, performedAt: localDate(new Date()), kind: p.kind, km: p.km, hours: p.hours, performedBy: 'INTERNAL',
      cost: (p.parts ?? 0) + (p.tire ?? 0) || null, notes: `PM radni nalog ${cur.no} (AHM 917)`,
    }, who)
    if (!res.ok) return res
    const r2 = await persist(input.id, p, { done: { by: who } })
    if (!r2.ok) return r2
    // pamti isključene sekcije za sljedeći nalog istog vozila
    if (isDemoMode()) await db.equipment.update({ where: { id: cur.equipmentId }, data: { pmExcludedSections: p.excluded } })
    else await (await writer()).from('equipment').update({ pm_excluded_sections: p.excluded }).eq('id', cur.equipmentId)
    await logAudit('PM_WORK_ORDER_DONE', 'equipment', cur.equipmentId, JSON.stringify({ no: cur.no, kind: p.kind, notOk, serviceable: p.serviceable, by: who }))
    revalidatePath('/dashboard')
    return { ok: true, notOk }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Greška' }
  }
}
