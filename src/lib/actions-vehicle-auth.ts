'use server'

// ADR.OPS.B.026 - Ovlaštenje vozila: zone vožnje, pozivni znak, radio/transponder, označavanje i svjetla (B.080).
// Ovlaštenje važi dok su uslovi ispunjeni; suspenzija/opoziv traže razlog i bilježe se u istoriji. Zapisi se ne brišu.
// Bez zapisa sredstvo se i dalje može zadužiti (prelazni period), ali je u registru označeno "bez ovlaštenja".

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import { logAudit } from '@/lib/actions-advanced'
import { revalidatePath } from 'next/cache'

export type VehAuthStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED'
export interface VehicleAuth {
  equipmentId: string
  equipmentCode: string
  status: VehAuthStatus
  areaApron: boolean
  areaOther: boolean
  areaManoeuvring: boolean
  callSign: string
  radioEquipped: boolean
  transponderEquipped: boolean
  markingOk: boolean
  lightingOk: boolean
  issuedAt: string
  issuedBy: string
  notes: string
  reason: string
  logs: Array<{ action: string; reason: string | null; byName: string | null; at: string }>
}
export type VehicleAuthInput = Pick<VehicleAuth, 'equipmentId' | 'areaApron' | 'areaOther' | 'areaManoeuvring' | 'callSign' | 'radioEquipped' | 'transponderEquipped' | 'markingOk' | 'lightingOk' | 'notes'>

async function requireEngineer() {
  const u = await getCurrentUser()
  if (!u) throw new Error('Morate biti ulogovani')
  if (u.role !== 'admin' && u.role !== 'engineer') throw new Error('Nemate dozvolu (potrebna rola: inženjer ili administrator)')
  return u
}

const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : '')

type Row = Record<string, any>
function fromRow(r: Row, logs: Row[]): VehicleAuth {
  const g = (a: string, b: string) => r[a] ?? r[b]
  return {
    equipmentId: g('equipmentId', 'equipment_id'), equipmentCode: g('equipmentCode', 'equipment_code'),
    status: r.status, areaApron: !!g('areaApron', 'area_apron'), areaOther: !!g('areaOther', 'area_other'), areaManoeuvring: !!g('areaManoeuvring', 'area_manoeuvring'),
    callSign: g('callSign', 'call_sign') ?? '', radioEquipped: !!g('radioEquipped', 'radio_equipped'), transponderEquipped: !!g('transponderEquipped', 'transponder_equipped'),
    markingOk: !!g('markingOk', 'marking_ok'), lightingOk: !!g('lightingOk', 'lighting_ok'),
    issuedAt: iso(g('issuedAt', 'issued_at')), issuedBy: g('issuedBy', 'issued_by') ?? '', notes: r.notes ?? '', reason: r.reason ?? '',
    logs: logs.map((l) => ({ action: l.action, reason: l.reason ?? null, byName: l.byName ?? l.by_name ?? null, at: iso(l.at) })),
  }
}

export async function getVehicleAuthorisation(equipmentId: string): Promise<VehicleAuth | null> {
  await requireEngineer()
  if (isDemoMode()) {
    const r = await db.vehicleAuthorisation.findUnique({ where: { equipmentId }, include: { logs: { orderBy: { at: 'desc' }, take: 8 } } })
    return r ? fromRow(r, r.logs) : null
  }
  const sb = await createSupabaseClient()
  const { data: r } = await sb.from('vehicle_authorisations').select('*').eq('equipment_id', equipmentId).maybeSingle()
  if (!r) return null
  const { data: logs } = await sb.from('vehicle_authorisation_log').select('*').eq('auth_id', r.id).order('at', { ascending: false }).limit(8)
  return fromRow(r, logs ?? [])
}

export async function saveVehicleAuthorisation(input: VehicleAuthInput): Promise<{ ok: boolean; error?: string }> {
  const user = await requireEngineer()
  const call = (input.callSign ?? '').trim().slice(0, 30)
  if (!input.areaApron && !input.areaOther && !input.areaManoeuvring) return { ok: false, error: 'Izaberite bar jednu zonu u kojoj vozilo smije voziti.' }
  if (input.areaManoeuvring && !input.radioEquipped) return { ok: false, error: 'Za manevarsku površinu vozilo mora imati radio-vezu (ADR.OPS.B.026(a)(3)).' }
  if ((input.radioEquipped) && !call) return { ok: false, error: 'Vozilo sa radiom mora imati pozivni znak.' }
  const by = user.full_name || user.email
  const f = { areaApron: input.areaApron, areaOther: input.areaOther, areaManoeuvring: input.areaManoeuvring, callSign: call || null, radioEquipped: input.radioEquipped, transponderEquipped: input.transponderEquipped, markingOk: input.markingOk, lightingOk: input.lightingOk, notes: (input.notes ?? '').trim().slice(0, 500) || null }

  if (isDemoMode()) {
    const eq = await db.equipment.findUnique({ where: { id: input.equipmentId } })
    if (!eq) return { ok: false, error: 'Sredstvo nije pronađeno' }
    const ex = await db.vehicleAuthorisation.findUnique({ where: { equipmentId: eq.id } })
    const row = ex
      ? await db.vehicleAuthorisation.update({ where: { id: ex.id }, data: { ...f, changedBy: by } })
      : await db.vehicleAuthorisation.create({ data: { equipmentId: eq.id, equipmentCode: eq.code, ...f, issuedBy: by, changedBy: by } })
    await db.vehicleAuthorisationLog.create({ data: { authId: row.id, equipmentCode: eq.code, action: ex ? 'UPDATED' : 'ISSUED', byName: by } })
  } else {
    const sb = await createSupabaseClient()
    const { data: eq } = await sb.from('equipment').select('id, code').eq('id', input.equipmentId).maybeSingle()
    if (!eq) return { ok: false, error: 'Sredstvo nije pronađeno' }
    const { data: ex } = await sb.from('vehicle_authorisations').select('id').eq('equipment_id', eq.id).maybeSingle()
    const cols = { area_apron: f.areaApron, area_other: f.areaOther, area_manoeuvring: f.areaManoeuvring, call_sign: f.callSign, radio_equipped: f.radioEquipped, transponder_equipped: f.transponderEquipped, marking_ok: f.markingOk, lighting_ok: f.lightingOk, notes: f.notes, changed_by: by, updated_at: new Date().toISOString() }
    let authId = ex?.id as string | undefined
    if (ex) {
      const { error } = await sb.from('vehicle_authorisations').update(cols).eq('id', ex.id)
      if (error) return { ok: false, error: error.message.includes('does not exist') ? 'Baza nije ažurirana (migracija 040).' : error.message }
    } else {
      const { data, error } = await sb.from('vehicle_authorisations').insert({ equipment_id: eq.id, equipment_code: eq.code, ...cols, issued_by: by }).select('id').single()
      if (error) return { ok: false, error: error.message.includes('does not exist') ? 'Baza nije ažurirana (migracija 040).' : error.message }
      authId = data.id
    }
    if (authId) await sb.from('vehicle_authorisation_log').insert({ auth_id: authId, equipment_code: eq.code, action: ex ? 'UPDATED' : 'ISSUED', by_name: by })
  }
  await logAudit('VEHICLE_AUTH_SAVED', 'equipment', input.equipmentId, JSON.stringify({ callSign: call }))
  revalidatePath('/')
  return { ok: true }
}

export async function setVehicleAuthStatus(equipmentId: string, status: VehAuthStatus, reason: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireEngineer()
  const why = (reason ?? '').trim().slice(0, 300)
  if (status !== 'ACTIVE' && why.length < 3) return { ok: false, error: 'Upišite razlog suspenzije ili opoziva.' }
  const by = user.full_name || user.email
  const action = status === 'ACTIVE' ? 'REINSTATED' : status === 'SUSPENDED' ? 'SUSPENDED' : 'REVOKED'
  if (isDemoMode()) {
    const ex = await db.vehicleAuthorisation.findUnique({ where: { equipmentId } })
    if (!ex) return { ok: false, error: 'Ovlaštenje nije izdato' }
    await db.vehicleAuthorisation.update({ where: { id: ex.id }, data: { status, reason: status === 'ACTIVE' ? null : why, changedBy: by } })
    await db.vehicleAuthorisationLog.create({ data: { authId: ex.id, equipmentCode: ex.equipmentCode, action, reason: why || null, byName: by } })
  } else {
    const sb = await createSupabaseClient()
    const { data: ex } = await sb.from('vehicle_authorisations').select('id, equipment_code').eq('equipment_id', equipmentId).maybeSingle()
    if (!ex) return { ok: false, error: 'Ovlaštenje nije izdato' }
    const { error } = await sb.from('vehicle_authorisations').update({ status, reason: status === 'ACTIVE' ? null : why, changed_by: by, updated_at: new Date().toISOString() }).eq('id', ex.id)
    if (error) return { ok: false, error: error.message }
    await sb.from('vehicle_authorisation_log').insert({ auth_id: ex.id, equipment_code: ex.equipment_code, action, reason: why || null, by_name: by })
  }
  await logAudit(`VEHICLE_AUTH_${action}`, 'equipment', equipmentId, JSON.stringify({ reason: why }))
  revalidatePath('/')
  return { ok: true }
}

/** Zaduživanje: blokira samo suspendovano / opozvano ovlaštenje (bez zapisa = dozvoljeno, prelazni period). Javna provjera. */
export async function checkVehicleAuthorisation(equipmentId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    let status: string | null = null
    if (isDemoMode()) {
      status = (await db.vehicleAuthorisation.findUnique({ where: { equipmentId }, select: { status: true } }))?.status ?? null
    } else if (hasServiceClient()) {
      const { data } = await createServiceClient().from('vehicle_authorisations').select('status').eq('equipment_id', equipmentId).maybeSingle()
      status = data?.status ?? null
    }
    if (status === 'SUSPENDED' || status === 'REVOKED') {
      return { allowed: false, reason: 'Ovlaštenje za ovo vozilo je ' + (status === 'SUSPENDED' ? 'suspendovano' : 'opozvano') + '. Ne možete ga uzeti. Pozovite šefa.' }
    }
  } catch (e) { console.error('checkVehicleAuthorisation', e) }
  return { allowed: true }
}

export async function listVehicleAuthorisations(): Promise<{ rows: VehicleAuth[]; without: Array<{ code: string; name: string }> }> {
  await requireEngineer()
  if (isDemoMode()) {
    const [auths, eqs] = await Promise.all([db.vehicleAuthorisation.findMany({ orderBy: { equipmentCode: 'asc' } }), db.equipment.findMany({ select: { id: true, code: true, name: true, type: true } })])
    const has = new Set(auths.map((a) => a.equipmentId))
    return { rows: auths.map((a) => fromRow(a, [])), without: eqs.filter((e) => !has.has(e.id) && e.type !== 'DOLLY').map((e) => ({ code: e.code, name: e.name })) }
  }
  const sb = await createSupabaseClient()
  const [{ data: auths }, { data: eqs }] = await Promise.all([sb.from('vehicle_authorisations').select('*').order('equipment_code'), sb.from('equipment').select('id, code, name, type')])
  const has = new Set((auths ?? []).map((a: Row) => a.equipment_id))
  return { rows: (auths ?? []).map((a: Row) => fromRow(a, [])), without: (eqs ?? []).filter((e: Row) => !has.has(e.id) && e.type !== 'DOLLY').map((e: Row) => ({ code: e.code, name: e.name })) }
}
