'use server'

// Dnevni pregled vozila iz dashboarda ("Moj zadatak").
// Admin smije pregledati BILO KOJE vozilo; ostali samo vozila za koja imaju
// autorizaciju: važeća airside dozvola + važeća kvalifikacija za tip opreme
// (+ izričita dozvola za sredstva sa ograničenim pristupom). Pravilo se
// provjerava na serveru, ne samo u prikazu.

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import { getDailyInspectionStatus, createDailyInspection, type DailyInspectionStatusRow } from '@/lib/actions-adr'

export interface InspectableEquipment extends DailyInspectionStatusRow {
  restricted: boolean
}

interface Authorization {
  allowedTypes: Set<string>
  accessIds: Set<string> // equipment_id sa izričitom dozvolom
  licenceOk: boolean
}

const today = () => new Date().toISOString().slice(0, 10)
const notExpired = (d: unknown) => !d || String(d).slice(0, 10) >= today()

async function loadAuthorization(user: AppUser): Promise<Authorization> {
  const card = (user.card_id ?? '').trim().toUpperCase()
  const empty: Authorization = { allowedTypes: new Set(), accessIds: new Set(), licenceOk: false }
  if (!card) return empty

  if (isDemoMode()) {
    const [auth, quals, access] = await Promise.all([
      db.driverAuthorization.findUnique({ where: { employeeCardId: card } }),
      db.equipmentQualification.findMany({ where: { employeeCardId: card } }),
      db.equipmentAccess.findMany({ where: { employeeCardId: card } }),
    ])
    return {
      licenceOk: !!auth && auth.active && notExpired(auth.validUntil) && notExpired(auth.trainingExpiry),
      allowedTypes: new Set(quals.filter((q) => notExpired(q.validUntil)).map((q) => q.equipmentType)),
      accessIds: new Set(access.map((a) => a.equipmentId)),
    }
  }

  // Čita se samo za karticu prijavljenog korisnika. Service-role ako postoji
  // (RLS može sakriti ove tabele običnim korisnicima), inače korisnički klijent.
  const supabase = hasServiceClient() ? createServiceClient() : await createSupabaseClient()
  const [auth, quals, access] = await Promise.all([
    supabase.from('driver_authorizations').select('active,valid_until,training_expiry').eq('employee_card_id', card).maybeSingle(),
    supabase.from('equipment_qualifications').select('equipment_type,valid_until').eq('employee_card_id', card),
    supabase.from('equipment_access').select('equipment_id').eq('employee_card_id', card),
  ])
  const a = auth.data as { active: boolean; valid_until: string | null; training_expiry: string | null } | null
  return {
    licenceOk: !!a && a.active && notExpired(a.valid_until) && notExpired(a.training_expiry),
    allowedTypes: new Set(((quals.data ?? []) as any[]).filter((q) => notExpired(q.valid_until)).map((q) => q.equipment_type)),
    accessIds: new Set(((access.data ?? []) as any[]).map((r) => r.equipment_id)),
  }
}

async function restrictedIds(): Promise<Set<string>> {
  if (isDemoMode()) {
    const rows = await db.equipment.findMany({ where: { restrictedAccess: true }, select: { id: true } })
    return new Set(rows.map((r) => r.id))
  }
  const supabase = hasServiceClient() ? createServiceClient() : await createSupabaseClient()
  const { data } = await supabase.from('equipment').select('id').eq('restricted_access', true)
  return new Set(((data ?? []) as any[]).map((r) => r.id))
}

/** Vozila koja prijavljeni korisnik smije pregledati (admin: sva), sa današnjim stanjem pregleda. */
export async function getInspectableEquipment(): Promise<InspectableEquipment[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const [rows, restricted] = await Promise.all([getDailyInspectionStatus(), restrictedIds()])
  const withFlag = rows.map((r) => ({ ...r, restricted: restricted.has(r.id) }))
  if (user.role === 'admin') return withFlag

  const auth = await loadAuthorization(user)
  if (!auth.licenceOk) return []
  return withFlag.filter((r) => auth.allowedTypes.has(r.type) && (!r.restricted || auth.accessIds.has(r.id)))
}

function shiftNow(): 'MORNING' | 'AFTERNOON' | 'NIGHT' {
  // Server (Vercel) radi u UTC — smjena se računa po lokalnom vremenu aerodroma
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Podgorica' }).format(new Date())) % 24
  return h < 14 ? 'MORNING' : h < 22 ? 'AFTERNOON' : 'NIGHT'
}

/** Snima dnevni pregled u ime prijavljenog korisnika, nakon provjere autorizacije za to vozilo. */
export async function startDailyInspection(params: {
  equipmentCode: string
  checklist: Array<{ id: string; label: string; passed: boolean }>
  notes?: string
}): Promise<{ ok: boolean; error?: string; result?: string; blocking?: number; restrictive?: number; damageReports?: number }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'Morate biti prijavljeni' }
  if (!params.checklist.length) return { ok: false, error: 'Lista za pregled je prazna' }

  const allowed = await getInspectableEquipment()
  if (!allowed.some((e) => e.code === params.equipmentCode)) {
    return { ok: false, error: 'Nemate autorizaciju za pregled ovog vozila' }
  }

  const res = await createDailyInspection({
    equipmentCode: params.equipmentCode,
    inspectorCardId: user.card_id ?? user.email,
    inspectorName: user.full_name || user.email,
    shift: shiftNow(),
    checklist: params.checklist,
    notes: params.notes,
  })
  return { ok: res.ok, error: res.error, result: res.result, blocking: res.blocking, restrictive: res.restrictive, damageReports: res.damageReports }
}
