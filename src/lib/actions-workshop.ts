'use server'

// Tok radionice: sredstvo doveženo u radionicu, status popravke (obavezan nakon upozorenja svaka 3 dana),
// pregled šefa službe koji NIJE prošao, i preuzimanje sredstva iz radionice. Svaki korak pamti ko i kada.
// Preuzimanje prijave (acknowledgeDamage) i odobrenje pregleda šefa (approveRepair) su u actions.ts.

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logRepairEvent } from '@/lib/workshop-log'

type Result = { ok: boolean; error?: string }

async function requireEngineer(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  if (user.role !== 'engineer' && user.role !== 'admin') throw new Error('Nemate dozvolu. Potrebna rola: engineer')
  return user
}
const clean = (v: unknown, max: number) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max)

async function loadDamage(id: string): Promise<{ status: string; arrivedAt: Date | null; handoverAt: Date | null } | null> {
  if (isDemoMode()) {
    const d = await db.damageReport.findUnique({ where: { id }, select: { status: true, workshopArrivedAt: true, handoverAt: true } })
    return d ? { status: d.status, arrivedAt: d.workshopArrivedAt, handoverAt: d.handoverAt } : null
  }
  const sb = await createSupabaseClient()
  const { data } = await sb.from('damage_reports').select('status, workshop_arrived_at, handover_at').eq('id', id).maybeSingle()
  return data ? { status: data.status, arrivedAt: data.workshop_arrived_at ? new Date(data.workshop_arrived_at) : null, handoverAt: data.handover_at ? new Date(data.handover_at) : null } : null
}

async function patch(id: string, p: { demo: Record<string, unknown>; sb: Record<string, unknown> }): Promise<Result> {
  if (isDemoMode()) {
    await db.damageReport.update({ where: { id }, data: p.demo })
    return { ok: true }
  }
  const sb = await createSupabaseClient()
  const { error } = await sb.from('damage_reports').update(p.sb).eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Sredstvo je doveženo u radionicu: ko ga je dovezao i kada (vrijeme se upisuje automatski). */
export async function markArrivedInWorkshop(params: { damageId: string; broughtBy: string }): Promise<Result> {
  const user = await requireEngineer()
  const who = clean(params.broughtBy, 120)
  if (who.length < 3) return { ok: false, error: 'Upišite ime i prezime osobe koja je dovezla sredstvo' }
  const d = await loadDamage(params.damageId)
  if (!d) return { ok: false, error: 'Prijava kvara nije pronađena' }
  if (d.status === 'RESOLVED') return { ok: false, error: 'Prijava je već riješena' }
  if (d.arrivedAt) return { ok: false, error: 'Dolazak u radionicu je već upisan' }
  const now = new Date()
  const r = await patch(params.damageId, {
    demo: { workshopArrivedAt: now, workshopArrivedBy: who },
    sb: { workshop_arrived_at: now.toISOString(), workshop_arrived_by: who },
  })
  if (!r.ok) return r
  await logRepairEvent({ damageId: params.damageId, kind: 'ARRIVED', text: `Doveženo u radionicu — dovezao/la: ${who}`, byName: user.full_name, byCardId: user.card_id })
  revalidatePath('/')
  return { ok: true }
}

/** Novi status popravke (npr. "Čekaju se rezervni dijelovi"). `warned` = unos nakon upozorenja svaka 3 dana. */
export async function addWorkshopStatus(params: { damageId: string; text: string; warned?: boolean }): Promise<Result> {
  const user = await requireEngineer()
  const text = clean(params.text, 200)
  if (text.length < 3) return { ok: false, error: 'Upišite status popravke' }
  const d = await loadDamage(params.damageId)
  if (!d) return { ok: false, error: 'Prijava kvara nije pronađena' }
  if (d.status === 'RESOLVED') return { ok: false, error: 'Prijava je već riješena' }
  const now = new Date()
  const r = await patch(params.damageId, {
    demo: { lastStatusText: text, lastStatusAt: now, lastStatusBy: user.full_name },
    sb: { last_status_text: text, last_status_at: now.toISOString(), last_status_by: user.full_name },
  })
  if (!r.ok) return r
  await logRepairEvent({ damageId: params.damageId, kind: 'STATUS', text, byName: user.full_name, byCardId: user.card_id, warned: !!params.warned })
  revalidatePath('/')
  return { ok: true }
}

/** Šef službe je pregledao vozilo i pregled NIJE prošao: prijava se vraća u popravku (uspješan pregled ide kroz approveRepair). */
export async function recordChiefFailed(params: { damageId: string; chiefName: string; inspectedAt?: string; note: string }): Promise<Result> {
  const user = await requireEngineer()
  const chief = clean(params.chiefName, 120)
  const note = clean(params.note, 300)
  if (chief.length < 3) return { ok: false, error: 'Upišite ime i prezime šefa službe' }
  if (note.length < 3) return { ok: false, error: 'Upišite šta šef nije prihvatio' }
  const now = new Date()
  const at = params.inspectedAt ? new Date(params.inspectedAt) : now
  if (!Number.isFinite(at.getTime()) || at.getTime() > now.getTime() + 10 * 60_000) return { ok: false, error: 'Datum i vrijeme pregleda nisu ispravni' }
  const d = await loadDamage(params.damageId)
  if (!d) return { ok: false, error: 'Prijava kvara nije pronađena' }
  if (d.status !== 'AWAITING_APPROVAL') return { ok: false, error: 'Popravka nije poslana na pregled šefu' }
  const statusText = `Pregled šefa (${chief}) nije prošao: ${note}`
  const r = await patch(params.damageId, {
    demo: { status: 'IN_REPAIR', chiefName: chief, chiefInspectedAt: at, chiefResult: 'FAILED', chiefNote: note, lastStatusText: statusText, lastStatusAt: now, lastStatusBy: user.full_name },
    sb: { status: 'IN_REPAIR', chief_name: chief, chief_inspected_at: at.toISOString(), chief_result: 'FAILED', chief_note: note, last_status_text: statusText, last_status_at: now.toISOString(), last_status_by: user.full_name },
  })
  if (!r.ok) return r
  await logRepairEvent({ damageId: params.damageId, kind: 'CHIEF_FAILED', text: statusText, byName: user.full_name, byCardId: user.card_id })
  revalidatePath('/')
  return { ok: true }
}

/** Ko je preuzeo sredstvo iz radionice i kada (vrijeme se upisuje automatski). Samo za sredstva koja su dovožena u radionicu. */
export async function recordHandover(params: { damageId: string; takenBy: string }): Promise<Result> {
  const user = await requireEngineer()
  const who = clean(params.takenBy, 120)
  if (who.length < 3) return { ok: false, error: 'Upišite ime i prezime osobe koja je preuzela sredstvo' }
  const d = await loadDamage(params.damageId)
  if (!d) return { ok: false, error: 'Prijava kvara nije pronađena' }
  if (d.status !== 'RESOLVED') return { ok: false, error: 'Sredstvo se može predati tek nakon odobrenog pregleda šefa' }
  if (d.handoverAt) return { ok: false, error: 'Preuzimanje je već upisano' }
  const now = new Date()
  const r = await patch(params.damageId, {
    demo: { handoverTo: who, handoverAt: now },
    sb: { handover_to: who, handover_at: now.toISOString() },
  })
  if (!r.ok) return r
  await logRepairEvent({ damageId: params.damageId, kind: 'HANDOVER', text: `Preuzeo/la iz radionice: ${who}`, byName: user.full_name, byCardId: user.card_id })
  revalidatePath('/')
  return { ok: true }
}

export interface PendingHandover {
  id: string
  equipmentCode: string
  equipmentName: string
  department: string | null
  arrivedAt: string | null
  chiefName: string | null
  chiefInspectedAt: string | null
}

/** Sredstva čija je popravka odobrena, a još nije upisano ko ih je preuzeo iz radionice. */
export async function getPendingHandovers(): Promise<PendingHandover[]> {
  await requireEngineer()
  if (isDemoMode()) {
    const rows = await db.damageReport.findMany({
      where: { status: 'RESOLVED', workshopArrivedAt: { not: null }, handoverAt: null },
      orderBy: { resolvedAt: 'desc' }, take: 50, include: { equipment: { select: { department: true } } },
    })
    return rows.map((r) => ({ id: r.id, equipmentCode: r.equipmentCode, equipmentName: r.equipmentName, department: r.equipment?.department ?? null, arrivedAt: r.workshopArrivedAt?.toISOString() ?? null, chiefName: r.chiefName, chiefInspectedAt: r.chiefInspectedAt?.toISOString() ?? null }))
  }
  const sb = await createSupabaseClient()
  const { data } = await sb.from('damage_reports')
    .select('id, equipment_code, equipment_name, workshop_arrived_at, chief_name, chief_inspected_at, equipment:equipment(department)')
    .eq('status', 'RESOLVED').not('workshop_arrived_at', 'is', null).is('handover_at', null)
    .order('resolved_at', { ascending: false }).limit(50)
  return (data ?? []).map((r: any) => ({ id: r.id, equipmentCode: r.equipment_code, equipmentName: r.equipment_name, department: r.equipment?.department ?? null, arrivedAt: r.workshop_arrived_at ?? null, chiefName: r.chief_name ?? null, chiefInspectedAt: r.chief_inspected_at ?? null }))
}

export interface WorkshopLogRow { id: string; kind: string; text: string | null; byName: string; at: string; warned: boolean }

export async function getWorkshopLog(damageId: string): Promise<WorkshopLogRow[]> {
  await requireEngineer()
  if (isDemoMode()) {
    const rows = await db.repairStatusLog.findMany({ where: { damageId }, orderBy: { at: 'desc' }, take: 60 })
    return rows.map((r) => ({ id: r.id, kind: r.kind, text: r.text, byName: r.byName, at: r.at.toISOString(), warned: r.warned }))
  }
  const sb = await createSupabaseClient()
  const { data } = await sb.from('repair_status_log').select('id, kind, text, by_name, at, warned').eq('damage_id', damageId).order('at', { ascending: false }).limit(60)
  return (data ?? []).map((r: any) => ({ id: r.id, kind: r.kind, text: r.text, byName: r.by_name, at: r.at, warned: !!r.warned }))
}
