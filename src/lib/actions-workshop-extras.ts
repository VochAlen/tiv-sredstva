'use server'

// Dodaci toku radionice: eksterni servis, zamjensko sredstvo, ponavljajući kvarovi, statistika zastoja.

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logRepairEvent } from '@/lib/workshop-log'
import { wasInspectedToday } from '@/lib/inspection-gate'
import { localDate, isValidDate } from '@/lib/local-day'
import { findRepeats, REPEAT_WINDOW_DAYS, type RepeatGroup, type RepeatInput } from '@/lib/repeat-defects'
import { computeDowntime, isMonth, monthRange, type DowntimeDamage, type DowntimeStats } from '@/lib/downtime'

type Result = { ok: boolean; error?: string }

async function requireEngineer(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  if (user.role !== 'engineer' && user.role !== 'admin') throw new Error('Nemate dozvolu. Potrebna rola: engineer')
  return user
}
const clean = (v: unknown, max: number) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
const fmtDay = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}.`

// =====================================================
// EKSTERNI SERVIS (garancija / vanjski izvođač)
// =====================================================

async function loadExternal(id: string): Promise<{ status: string; sentAt: Date | null; returnedAt: Date | null } | null> {
  if (isDemoMode()) {
    const d = await db.damageReport.findUnique({ where: { id }, select: { status: true, externalSentAt: true, externalReturnedAt: true } })
    return d ? { status: d.status, sentAt: d.externalSentAt, returnedAt: d.externalReturnedAt } : null
  }
  const sb = await createSupabaseClient()
  const { data } = await sb.from('damage_reports').select('status, external_sent_at, external_returned_at').eq('id', id).maybeSingle()
  return data ? { status: data.status, sentAt: data.external_sent_at ? new Date(data.external_sent_at) : null, returnedAt: data.external_returned_at ? new Date(data.external_returned_at) : null } : null
}

/** Sredstvo je poslano vanjskom servisu: ko, broj naloga/ponude i očekivani povrat. Postavlja i status popravke (resetuje 3-dnevno upozorenje). */
export async function sendToExternalService(params: { damageId: string; provider: string; ref?: string; expectedAt?: string }): Promise<Result> {
  const user = await requireEngineer()
  const provider = clean(params.provider, 120)
  const ref = clean(params.ref, 80) || null
  if (provider.length < 2) return { ok: false, error: 'Upišite naziv vanjskog servisa / izvođača' }
  const expected = params.expectedAt && isValidDate(params.expectedAt) ? params.expectedAt : null
  if (params.expectedAt && !expected) return { ok: false, error: 'Očekivani datum povrata nije ispravan' }
  const d = await loadExternal(params.damageId)
  if (!d) return { ok: false, error: 'Kvar nije pronađen' }
  if (d.status === 'RESOLVED') return { ok: false, error: 'Kvar je već riješen' }
  if (d.sentAt && !d.returnedAt) return { ok: false, error: 'Sredstvo je već upisano kao poslano vanjskom servisu' }
  const now = new Date()
  const statusText = `Vanjski servis: ${provider}${ref ? ` (nalog ${ref})` : ''}${expected ? `, očekivani povrat ${fmtDay(expected)}` : ''}`
  if (isDemoMode()) {
    await db.damageReport.update({
      where: { id: params.damageId },
      data: { externalProvider: provider, externalRef: ref, externalSentAt: now, externalExpectedAt: expected ? new Date(`${expected}T12:00:00Z`) : null, externalReturnedAt: null, lastStatusText: statusText, lastStatusAt: now, lastStatusBy: user.full_name },
    })
  } else {
    const sb = await createSupabaseClient()
    const { error } = await sb.from('damage_reports').update({
      external_provider: provider, external_ref: ref, external_sent_at: now.toISOString(), external_expected_at: expected, external_returned_at: null,
      last_status_text: statusText, last_status_at: now.toISOString(), last_status_by: user.full_name,
    }).eq('id', params.damageId)
    if (error) return { ok: false, error: error.message }
  }
  await logRepairEvent({ damageId: params.damageId, kind: 'EXTERNAL_SENT', text: statusText, byName: user.full_name, byCardId: user.card_id })
  revalidatePath('/')
  return { ok: true }
}

/** Sredstvo je vraćeno iz vanjskog servisa (npr. broj računa / napomena). Popravka se nastavlja redovnim tokom (popravka završena → pregled šefa). */
export async function markExternalReturned(params: { damageId: string; note?: string }): Promise<Result> {
  const user = await requireEngineer()
  const note = clean(params.note, 200)
  const d = await loadExternal(params.damageId)
  if (!d) return { ok: false, error: 'Kvar nije pronađen' }
  if (!d.sentAt || d.returnedAt) return { ok: false, error: 'Sredstvo nije upisano kao poslano vanjskom servisu' }
  const now = new Date()
  const text = `Vraćeno iz vanjskog servisa${note ? ` — ${note}` : ''}`
  if (isDemoMode()) {
    await db.damageReport.update({ where: { id: params.damageId }, data: { externalReturnedAt: now, lastStatusText: text, lastStatusAt: now, lastStatusBy: user.full_name } })
  } else {
    const sb = await createSupabaseClient()
    const { error } = await sb.from('damage_reports').update({ external_returned_at: now.toISOString(), last_status_text: text, last_status_at: now.toISOString(), last_status_by: user.full_name }).eq('id', params.damageId)
    if (error) return { ok: false, error: error.message }
  }
  await logRepairEvent({ damageId: params.damageId, kind: 'EXTERNAL_BACK', text, byName: user.full_name, byCardId: user.card_id })
  revalidatePath('/')
  return { ok: true }
}

// =====================================================
// ZAMJENSKO SREDSTVO
// =====================================================

export interface ReplacementOption {
  id: string
  code: string
  name: string
  location: string
  department: string | null
  inspectedToday: boolean
  restrictions: number
  restrictedAccess: boolean
}

/** Dostupna sredstva ISTOG tipa (pregledana danas prva). Poziva se tek na klik, jer radi provjeru dnevnog pregleda za svako sredstvo. */
export async function getReplacementOptions(equipmentId: string): Promise<{ type: string; options: ReplacementOption[] }> {
  await requireEngineer()
  let type = ''
  let list: Array<{ id: string; code: string; name: string; location: string; department: string | null; restrictions: number; restrictedAccess: boolean }> = []
  const countRestr = (raw: unknown): number => {
    try { const v = typeof raw === 'string' ? JSON.parse(raw) : raw; return Array.isArray(v) ? v.length : 0 } catch { return 0 }
  }
  if (isDemoMode()) {
    const eq = await db.equipment.findUnique({ where: { id: equipmentId }, select: { type: true } })
    if (!eq) return { type: '', options: [] }
    type = eq.type
    const rows = await db.equipment.findMany({ where: { type, status: 'AVAILABLE', id: { not: equipmentId } }, orderBy: { code: 'asc' }, take: 12 })
    list = rows.map((e) => ({ id: e.id, code: e.code, name: e.name, location: e.location, department: e.department, restrictions: countRestr(e.activeRestrictions), restrictedAccess: e.restrictedAccess }))
  } else {
    const sb = await createSupabaseClient()
    const { data: eq } = await sb.from('equipment').select('type').eq('id', equipmentId).maybeSingle()
    if (!eq) return { type: '', options: [] }
    type = eq.type
    const { data } = await sb.from('equipment').select('id, code, name, location, department, active_restrictions, restricted_access').eq('type', type).eq('status', 'AVAILABLE').neq('id', equipmentId).order('code').limit(12)
    list = (data ?? []).map((e: any) => ({ id: e.id, code: e.code, name: e.name, location: e.location, department: e.department ?? null, restrictions: countRestr(e.active_restrictions), restrictedAccess: !!e.restricted_access }))
  }
  const withInsp = await Promise.all(list.slice(0, 8).map(async (e) => ({ ...e, inspectedToday: await wasInspectedToday(e.id) })))
  withInsp.sort((a, b) => Number(b.inspectedToday) - Number(a.inspectedToday) || a.restrictions - b.restrictions || a.code.localeCompare(b.code))
  return { type, options: withInsp }
}

// =====================================================
// PONAVLJAJUĆI KVAROVI
// =====================================================

export async function getRepeatDefects(equipmentCode?: string): Promise<RepeatGroup[]> {
  await requireEngineer()
  const since = new Date(Date.now() - REPEAT_WINDOW_DAYS * 86_400_000)
  let rows: RepeatInput[]
  if (isDemoMode()) {
    const list = await db.damageReport.findMany({
      where: { createdAt: { gte: since }, ...(equipmentCode ? { equipmentCode } : {}) },
      select: { id: true, equipmentId: true, equipmentCode: true, equipmentName: true, category: true, sourceItem: true, description: true, createdAt: true, status: true },
    })
    rows = list
  } else {
    const sb = await createSupabaseClient()
    let q = sb.from('damage_reports').select('id, equipment_id, equipment_code, equipment_name, category, source_item, description, created_at, status').gte('created_at', since.toISOString()).limit(2000)
    if (equipmentCode) q = q.eq('equipment_code', equipmentCode)
    const { data } = await q
    rows = (data ?? []).map((d: any) => ({ id: d.id, equipmentId: d.equipment_id, equipmentCode: d.equipment_code, equipmentName: d.equipment_name, category: d.category ?? null, sourceItem: d.source_item ?? null, description: d.description, createdAt: d.created_at, status: d.status }))
  }
  return findRepeats(rows)
}

// =====================================================
// STATISTIKA ZASTOJA
// =====================================================

export async function loadDowntimeInputs(month: string): Promise<{ rows: DowntimeDamage[]; fleetSize: number }> {
  await requireEngineer()
  if (!isMonth(month)) throw new Error('Mjesec nije ispravan')
  const { start, end } = monthRange(month)
  if (isDemoMode()) {
    const [list, fleet] = await Promise.all([
      db.damageReport.findMany({
        where: { createdAt: { lte: end }, OR: [{ resolvedAt: null }, { resolvedAt: { gte: start } }] },
        include: { equipment: { select: { type: true } } },
      }),
      db.equipment.count(),
    ])
    return {
      fleetSize: fleet,
      rows: list.map((d) => ({
        id: d.id, equipmentId: d.equipmentId, equipmentCode: d.equipmentCode, equipmentName: d.equipmentName, equipmentType: d.equipment?.type ?? '-',
        severity: d.severity, category: d.category, sourceItem: d.sourceItem, description: d.description, rootCause: d.rootCause, status: d.status,
        createdAt: d.createdAt, acknowledgedAt: d.acknowledgedAt, workshopArrivedAt: d.workshopArrivedAt, resolvedAt: d.resolvedAt,
      })),
    }
  }
  const sb = await createSupabaseClient()
  const [dm, fleet] = await Promise.all([
    sb.from('damage_reports')
      .select('id, equipment_id, equipment_code, equipment_name, severity, category, source_item, description, root_cause, status, created_at, acknowledged_at, workshop_arrived_at, resolved_at, equipment:equipment(type)')
      .lte('created_at', end.toISOString())
      .or(`resolved_at.is.null,resolved_at.gte.${start.toISOString()}`)
      .limit(5000),
    sb.from('equipment').select('id', { count: 'exact', head: true }),
  ])
  if (dm.error) throw new Error(dm.error.message)
  return {
    fleetSize: fleet.count ?? 0,
    rows: (dm.data ?? []).map((d: any) => ({
      id: d.id, equipmentId: d.equipment_id, equipmentCode: d.equipment_code, equipmentName: d.equipment_name, equipmentType: d.equipment?.type ?? '-',
      severity: d.severity, category: d.category ?? null, sourceItem: d.source_item ?? null, description: d.description, rootCause: d.root_cause ?? null, status: d.status,
      createdAt: new Date(d.created_at), acknowledgedAt: d.acknowledged_at ? new Date(d.acknowledged_at) : null,
      workshopArrivedAt: d.workshop_arrived_at ? new Date(d.workshop_arrived_at) : null, resolvedAt: d.resolved_at ? new Date(d.resolved_at) : null,
    })),
  }
}

export async function getDowntimeStats(month?: string): Promise<DowntimeStats> {
  await requireEngineer()
  const m = month && isMonth(month) ? month : localDate(new Date()).slice(0, 7)
  const { rows, fleetSize } = await loadDowntimeInputs(m)
  return computeDowntime(rows, m, fleetSize)
}

