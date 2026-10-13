'use server'

// Radni nalog popravke na prijavi kvara: opis, dijelovi + količina, ko je radio, sati, trošak.
// Može ga unositi/mijenjati radionica (engineer) i admin dok kvar nije riješen; admin kasnije odobrava.

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/actions-advanced'

export interface RepairPart { name: string; qty: number }
type Result = { ok: boolean; error?: string }

export async function saveRepairWork(params: {
  damageId: string
  resolution?: string
  parts: RepairPart[]
  workerNames?: string
  workHours?: number | null
  workCost?: number | null
}): Promise<Result> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'Morate biti ulogovani' }
  if (user.role !== 'engineer' && user.role !== 'admin') return { ok: false, error: 'Nemate dozvolu za unos radnog naloga' }

  const parts = (params.parts ?? [])
    .map((p) => ({ name: String(p.name ?? '').trim().slice(0, 120), qty: Number(p.qty) }))
    .filter((p) => p.name)
  if (parts.some((p) => !Number.isFinite(p.qty) || p.qty <= 0 || p.qty > 100000)) return { ok: false, error: 'Količina dijela mora biti broj veći od 0' }
  const num = (v?: number | null) => (v == null || v === ('' as any) ? null : Number(v))
  const hours = num(params.workHours), cost = num(params.workCost)
  if ((hours != null && (!Number.isFinite(hours) || hours < 0)) || (cost != null && (!Number.isFinite(cost) || cost < 0))) return { ok: false, error: 'Sati i trošak moraju biti brojevi' }
  const workers = (params.workerNames ?? '').trim().slice(0, 200) || null
  const resolution = params.resolution?.trim() || undefined

  if (isDemoMode()) {
    const dr = await db.damageReport.findUnique({ where: { id: params.damageId } })
    if (!dr) return { ok: false, error: 'Prijava kvara nije pronađena' }
    if (dr.status === 'RESOLVED') return { ok: false, error: 'Prijava je već riješena' }
    await db.damageReport.update({
      where: { id: params.damageId },
      data: { partsJson: parts.length ? JSON.stringify(parts) : null, workHours: hours, workCost: cost, workerNames: workers, ...(resolution !== undefined && { resolution }) },
    })
  } else {
    const supabase = await createSupabaseClient()
    const { data: dr } = await supabase.from('damage_reports').select('status').eq('id', params.damageId).maybeSingle()
    if (!dr) return { ok: false, error: 'Prijava kvara nije pronađena' }
    if (dr.status === 'RESOLVED') return { ok: false, error: 'Prijava je već riješena' }
    const { error } = await supabase.from('damage_reports').update({
      parts_json: parts.length ? parts : null, work_hours: hours, work_cost: cost, worker_names: workers,
      ...(resolution !== undefined && { resolution }),
    }).eq('id', params.damageId)
    if (error) return { ok: false, error: error.message }
  }
  await logAudit('REPAIR_WORK_SAVED', 'damage_report', params.damageId, JSON.stringify({ parts, workers, hours, cost }))
  revalidatePath('/')
  return { ok: true }
}
