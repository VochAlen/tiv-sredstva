'use server'

// Dnevni pregled iz RADNIČKOG toka (bez prijave u dashboard).
// Radnik se identifikuje ID karticom, kao pri zaduživanju. Server provjerava:
//  1. kartica postoji u evidenciji i radnik je aktivan (ime se uzima iz evidencije, ne od klijenta)
//  2. važeća airside dozvola + obuka (driver_authorizations)
//  3. važeća kvalifikacija za tip sredstva (equipment_qualifications)
//  4. izričita dozvola za sredstva sa ograničenim pristupom (equipment_access)
// Tek tada se poziva isti createDailyInspection kao u dashboardu (težine stavki dolaze sa servera).

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import { createDailyInspection } from '@/lib/actions-adr'

export interface WorkerInspectionResult {
  ok: boolean
  error?: string
  result?: string
  blocking?: number
  restrictive?: number
  damageReports?: number
}

const today = () => new Date().toISOString().slice(0, 10)
const notExpired = (d: unknown) => !d || String(d).slice(0, 10) >= today()

function shiftNow(): 'MORNING' | 'AFTERNOON' | 'NIGHT' {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Podgorica' }).format(new Date())) % 24
  return h < 14 ? 'MORNING' : h < 22 ? 'AFTERNOON' : 'NIGHT'
}

const UNKNOWN_CARD = 'ID kartica nije pronađena u evidenciji aktivnih radnika. Provjerite broj kartice ili se obratite administratoru.'
const NO_LICENCE = 'Nemate važeću airside dozvolu i obuku. Pregled može uraditi samo ovlašteni vozač. Pozovite šefa.'
const NO_QUAL = 'Nemate kvalifikaciju za ovaj tip sredstva. Pregled može uraditi samo ovlašteni radnik. Pozovite šefa.'
const NO_ACCESS = 'Ovo sredstvo ima ograničen pristup, a nemate izričitu dozvolu. Pozovite šefa.'

export async function workerDailyInspection(params: {
  equipmentCode: string
  cardId: string
  checklist: Array<{ id: string; label: string; passed: boolean }>
  notes?: string
}): Promise<WorkerInspectionResult> {
  const card = (params.cardId ?? '').trim().toUpperCase()
  const code = (params.equipmentCode ?? '').trim()
  const notes = (params.notes ?? '').trim().slice(0, 1000) || undefined
  if (!card) return { ok: false, error: 'Unesite broj ID kartice' }
  if (!code) return { ok: false, error: 'Sredstvo nije izabrano' }
  if (!Array.isArray(params.checklist) || params.checklist.length === 0) return { ok: false, error: 'Lista za pregled je prazna' }

  let name = ''

  if (isDemoMode()) {
    const emp = await db.employee.findUnique({ where: { cardId: card } })
    if (!emp || !emp.active) return { ok: false, error: UNKNOWN_CARD }
    name = emp.name

    const eq = await db.equipment.findUnique({ where: { code } })
    if (!eq) return { ok: false, error: 'Sredstvo nije pronađeno' }
    if (eq.status === 'OUT_OF_SERVICE' || eq.status === 'MAINTENANCE') {
      return { ok: false, error: 'Sredstvo je van upotrebe. Pregled nije moguć dok se kvar ne otkloni.' }
    }

    const [auth, quals, access] = await Promise.all([
      db.driverAuthorization.findUnique({ where: { employeeCardId: card } }),
      db.equipmentQualification.findMany({ where: { employeeCardId: card } }),
      db.equipmentAccess.findMany({ where: { employeeCardId: card } }),
    ])
    const licenceOk = !!auth && auth.active && notExpired(auth.validUntil) && notExpired(auth.trainingExpiry)
    if (!licenceOk) return { ok: false, error: NO_LICENCE }
    if (!quals.some((q) => q.equipmentType === eq.type && notExpired(q.validUntil))) return { ok: false, error: NO_QUAL }
    if (eq.restrictedAccess && !access.some((a) => a.equipmentId === eq.id)) return { ok: false, error: NO_ACCESS }
  } else {
    if (!hasServiceClient()) return { ok: false, error: 'Pregled trenutno nije dostupan (server nije podešen). Obavijestite administratora.' }
    const sb = createServiceClient()

    const { data: emp } = await sb.from('employees').select('name, active').eq('card_id', card).maybeSingle()
    if (!emp || emp.active === false) return { ok: false, error: UNKNOWN_CARD }
    name = emp.name || card

    const { data: eq } = await sb.from('equipment').select('id, type, status, restricted_access').eq('code', code).maybeSingle()
    if (!eq) return { ok: false, error: 'Sredstvo nije pronađeno' }
    if (eq.status === 'OUT_OF_SERVICE' || eq.status === 'MAINTENANCE') {
      return { ok: false, error: 'Sredstvo je van upotrebe. Pregled nije moguć dok se kvar ne otkloni.' }
    }

    const [auth, quals, access] = await Promise.all([
      sb.from('driver_authorizations').select('active,valid_until,training_expiry').eq('employee_card_id', card).maybeSingle(),
      sb.from('equipment_qualifications').select('equipment_type,valid_until').eq('employee_card_id', card),
      sb.from('equipment_access').select('equipment_id').eq('employee_card_id', card),
    ])
    const a = auth.data as { active: boolean; valid_until: string | null; training_expiry: string | null } | null
    const licenceOk = !!a && a.active && notExpired(a.valid_until) && notExpired(a.training_expiry)
    if (!licenceOk) return { ok: false, error: NO_LICENCE }
    const qualOk = ((quals.data ?? []) as Array<{ equipment_type: string; valid_until: string | null }>)
      .some((q) => q.equipment_type === eq.type && notExpired(q.valid_until))
    if (!qualOk) return { ok: false, error: NO_QUAL }
    if (eq.restricted_access && !((access.data ?? []) as Array<{ equipment_id: string }>).some((r) => r.equipment_id === eq.id)) {
      return { ok: false, error: NO_ACCESS }
    }
  }

  try {
    const res = await createDailyInspection({
      equipmentCode: code,
      inspectorCardId: card,
      inspectorName: name,
      shift: shiftNow(),
      checklist: params.checklist.map((c) => ({ id: String(c.id), label: String(c.label ?? ''), passed: c.passed === true })),
      notes,
    })
    return { ok: res.ok, error: res.error, result: res.result, blocking: res.blocking, restrictive: res.restrictive, damageReports: res.damageReports }
  } catch (e) {
    console.error('workerDailyInspection failed:', e)
    const msg = e instanceof Error ? e.message : ''
    const missing = /fn_create_daily_inspection|Could not find the function|does not exist/i.test(msg)
    return {
      ok: false,
      error: missing
        ? 'Baza nije ažurirana (nedostaje funkcija za dnevni pregled). Obavijestite administratora.'
        : 'Pregled nije snimljen. Pokušajte ponovo.',
    }
  }
}
