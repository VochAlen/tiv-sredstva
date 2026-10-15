'use server'

// Očitanje brojila (km / radni sati) pri razduženju. JAVNA akcija (radnik nije prijavljen): ID kartica se provjerava u evidenciji radnika,
// a upis ide servisnim klijentom jer anonimni korisnik nema pravo pisanja u 'equipment'. Brojač se može samo povećavati.

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'

const MAX_JUMP_KM = 3000
const MAX_JUMP_HOURS = 300

const parse = (v: unknown): number | null | 'bad' => {
  if (v == null || v === '') return null
  const x = Number(String(v).replace(',', '.'))
  return Number.isFinite(x) && x >= 0 && x <= 10_000_000 ? x : 'bad'
}

export async function recordMeterReading(params: {
  equipmentCode: string
  employeeCardId: string
  km?: number | string | null
  hours?: number | string | null
}): Promise<{ ok: boolean; error?: string; updated?: boolean }> {
  const km = parse(params.km), hours = parse(params.hours)
  if (km === 'bad' || hours === 'bad') return { ok: false, error: 'Brojač mora biti broj (km / sati)' }
  if (km == null && hours == null) return { ok: true, updated: false }
  const card = String(params.employeeCardId ?? '').trim().slice(0, 40)
  const code = String(params.equipmentCode ?? '').trim().slice(0, 60)
  if (!card || !code) return { ok: false, error: 'Nedostaje ID kartica ili šifra sredstva' }

  const check = (curKm: number, curH: number): string | null => {
    if (km != null && km < curKm) return `Brojač (${km} km) ne može biti manji od zadnje evidentiranog (${curKm} km)`
    if (hours != null && hours < curH) return `Radni sati (${hours} h) ne mogu biti manji od zadnje evidentiranih (${curH} h)`
    if (km != null && km - curKm > MAX_JUMP_KM) return `Razlika od ${Math.round(km - curKm)} km je prevelika — provjerite unos`
    if (hours != null && hours - curH > MAX_JUMP_HOURS) return `Razlika od ${Math.round(hours - curH)} h je prevelika — provjerite unos`
    return null
  }

  if (isDemoMode()) {
    const emp = await db.employee.findFirst({ where: { cardId: card, active: true } })
    if (!emp) return { ok: false, error: 'ID kartica nije pronađena u evidenciji' }
    const eq = await db.equipment.findUnique({ where: { code } })
    if (!eq) return { ok: false, error: 'Sredstvo nije pronađeno' }
    const err = check(eq.totalKm ?? 0, eq.totalOperatingHours ?? 0)
    if (err) return { ok: false, error: err }
    const newKm = km != null && km > (eq.totalKm ?? 0) ? km : null
    const newH = hours != null && hours > (eq.totalOperatingHours ?? 0) ? hours : null
    if (newKm == null && newH == null) return { ok: true, updated: false }
    await db.equipment.update({ where: { id: eq.id }, data: { ...(newKm != null ? { totalKm: newKm } : {}), ...(newH != null ? { totalOperatingHours: newH } : {}) } })
    await db.meterReading.create({ data: { equipmentId: eq.id, equipmentCode: eq.code, km: newKm, hours: newH, byName: emp.name, byCardId: card } })
    revalidatePath('/')
    return { ok: true, updated: true }
  }

  if (!hasServiceClient()) return { ok: false, error: 'Upis brojila nije omogućen (nedostaje SUPABASE_SERVICE_ROLE_KEY na serveru)' }
  const sb = createServiceClient()
  const { data: emp } = await sb.from('employees').select('name').eq('card_id', card).eq('active', true).maybeSingle()
  if (!emp) return { ok: false, error: 'ID kartica nije pronađena u evidenciji' }
  const { data: eq } = await sb.from('equipment').select('id, code, total_km, total_operating_hours').eq('code', code).maybeSingle()
  if (!eq) return { ok: false, error: 'Sredstvo nije pronađeno' }
  const curKm = Number(eq.total_km ?? 0), curH = Number(eq.total_operating_hours ?? 0)
  const err = check(curKm, curH)
  if (err) return { ok: false, error: err }
  const newKm = km != null && km > curKm ? km : null
  const newH = hours != null && hours > curH ? hours : null
  if (newKm == null && newH == null) return { ok: true, updated: false }
  const { error: e1 } = await sb.from('equipment').update({ ...(newKm != null ? { total_km: newKm } : {}), ...(newH != null ? { total_operating_hours: newH } : {}) }).eq('id', eq.id)
  if (e1) return { ok: false, error: e1.message }
  const { error: e2 } = await sb.from('meter_readings').insert({ equipment_id: eq.id, equipment_code: eq.code, km: newKm, hours: newH, by_name: emp.name, by_card_id: card })
  if (e2) console.error('meter_readings insert (migracija 036?)', e2.message)
  revalidatePath('/')
  return { ok: true, updated: true }
}
