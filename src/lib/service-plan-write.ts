// Upis obavljenog servisa u servisni plan. NIJE 'use server' (ne smije biti javno pozivljiva akcija):
// poziva se samo iz akcija koje su već provjerile rolu (recordService, completePmWorkOrder).

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/actions-advanced'
import { localDate, isValidDate } from '@/lib/local-day'
import type { ServiceKind } from '@/lib/service-plan'

type Result = { ok: boolean; error?: string }

async function writer() {
  return hasServiceClient() ? createServiceClient() : await createSupabaseClient()
}
const optNum = (v: unknown, max = 10_000_000): number | null | 'bad' => {
  if (v == null || v === '') return null
  const x = Number(v)
  return Number.isFinite(x) && x >= 0 && x <= max ? x : 'bad'
}
const optText = (v: unknown, max: number) => { const s = String(v ?? '').trim().slice(0, max); return s || null }

export interface RecordServiceInput {
  equipmentId: string
  performedAt: string
  kind: ServiceKind
  km?: number | string | null
  hours?: number | string | null
  performedBy: 'INTERNAL' | 'EXTERNAL'
  provider?: string
  invoiceNo?: string
  cost?: number | string | null
  notes?: string
}

/** Upis obavljenog servisa + pomjeranje baza plana (major resetuje i minor i major). Poziva se i iz PM radnog naloga. */
export async function persistService(input: RecordServiceInput, who: string): Promise<Result> {
  const today = localDate(new Date())
  if (!isValidDate(input.performedAt) || input.performedAt > today) return { ok: false, error: 'Datum servisa nije ispravan (ne može biti u budućnosti)' }
  if (input.kind !== 'MINOR' && input.kind !== 'MAJOR') return { ok: false, error: 'Izaberite vrstu servisa (minor / major)' }
  const rKm = optNum(input.km), rH = optNum(input.hours), rC = optNum(input.cost, 100_000_000)
  if ([rKm, rH, rC].includes('bad')) return { ok: false, error: 'Km, sati i trošak moraju biti brojevi ≥ 0' }
  const km = rKm as number | null, hours = rH as number | null, cost = rC as number | null
  const by = input.performedBy === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL'
  const provider = optText(input.provider, 120), invoice = optText(input.invoiceNo, 60), notes = optText(input.notes, 500)
  const major = input.kind === 'MAJOR'

  if (isDemoMode()) {
    const eq = await db.equipment.findUnique({ where: { id: input.equipmentId } })
    if (!eq) return { ok: false, error: 'Sredstvo nije pronađeno' }
    const date = new Date(`${input.performedAt}T12:00:00Z`)
    const useKm = km ?? eq.totalKm, useH = hours ?? eq.totalOperatingHours
    await db.serviceRecord.create({ data: { equipmentId: eq.id, equipmentCode: eq.code, performedAt: date, km, hours, performedBy: by, kind: input.kind, provider, invoiceNo: invoice, cost, notes, recordedBy: who } })
    await db.equipment.update({
      where: { id: eq.id },
      data: {
        lastServiceDate: date, lastServiceKm: useKm, lastServiceHours: useH,
        ...(major ? { lastMajorDate: date, lastMajorKm: useKm, lastMajorHours: useH } : {}),
        ...(km != null && km > eq.totalKm ? { totalKm: km } : {}),
        ...(hours != null && hours > eq.totalOperatingHours ? { totalOperatingHours: hours } : {}),
        serviceNotifiedStatus: null, serviceNotifiedAt: null,
      },
    })
  } else {
    const sb = await writer()
    const { data: eq, error: e1 } = await sb.from('equipment').select('id,code,total_km,total_operating_hours').eq('id', input.equipmentId).maybeSingle()
    if (e1 || !eq) return { ok: false, error: e1?.message ?? 'Sredstvo nije pronađeno' }
    const curKm = Number(eq.total_km ?? 0), curH = Number(eq.total_operating_hours ?? 0)
    const useKm = km ?? curKm, useH = hours ?? curH
    const { error: e2 } = await sb.from('service_records').insert({ equipment_id: eq.id, equipment_code: eq.code, performed_at: input.performedAt, km, hours, performed_by: by, kind: input.kind, provider, invoice_no: invoice, cost, notes, recorded_by: who })
    if (e2) return { ok: false, error: /service_records|kind/i.test(e2.message) ? 'Pokrenite migracije 032 i 033 (supabase/MIGRATIONS.md).' : e2.message }
    const { error: e3 } = await sb.from('equipment').update({
      last_service_date: input.performedAt, last_service_km: useKm, last_service_hours: useH,
      ...(major ? { last_major_date: input.performedAt, last_major_km: useKm, last_major_hours: useH } : {}),
      ...(km != null && km > curKm ? { total_km: km } : {}), ...(hours != null && hours > curH ? { total_operating_hours: hours } : {}),
      service_notified_status: null, service_notified_at: null,
    }).eq('id', eq.id)
    if (e3) return { ok: false, error: `Servis je upisan, ali plan nije osvježen: ${e3.message}` }
  }
  await logAudit('SERVICE_RECORDED', 'equipment', input.equipmentId, JSON.stringify({ performedAt: input.performedAt, kind: input.kind, km, hours, by, provider, invoice }))
  revalidatePath('/dashboard')
  return { ok: true }
}

