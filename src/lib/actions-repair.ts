'use server'

// Radni nalog popravke na prijavi kvara: opis, dijelovi + količina, ko je radio, sati, trošak.
// Može ga unositi/mijenjati radionica (engineer) i admin dok kvar nije riješen; admin kasnije odobrava.
// Dijelovi mogu biti izabrani iz magacina (partId): snimanje skida zalihu i upisuje utrošak vezan za prijavu kvara.
// Ponovno snimanje istog naloga ispravlja zalihu samo za razliku (ne skida dvaput).

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/actions-advanced'

export interface RepairPart { name: string; qty: number; partId?: string | null }
type Result = { ok: boolean; error?: string; lowStock?: string[] }

const parseParts = (raw: unknown): RepairPart[] => {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(v) ? v.map((p: any) => ({ name: String(p?.name ?? ''), qty: Number(p?.qty) || 0, partId: p?.partId ? String(p.partId) : null })) : []
  } catch { return [] }
}

/** Ukupna količina po partId. */
const sumById = (parts: RepairPart[]): Map<string, number> => {
  const m = new Map<string, number>()
  for (const p of parts) if (p.partId) m.set(p.partId, (m.get(p.partId) ?? 0) + p.qty)
  return m
}

interface StockPart { id: string; partNumber: string; name: string; quantity: number; minQuantity: number; unitPrice: number | null }

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

  const parts: RepairPart[] = (params.parts ?? [])
    .map((p) => ({ name: String(p.name ?? '').trim().slice(0, 120), qty: Number(p.qty), partId: p.partId ? String(p.partId).slice(0, 64) : null }))
    .filter((p) => p.name)
  if (parts.some((p) => !Number.isFinite(p.qty) || p.qty <= 0 || p.qty > 100000)) return { ok: false, error: 'Količina dijela mora biti broj veći od 0' }
  if (parts.some((p) => p.partId && !Number.isInteger(p.qty))) return { ok: false, error: 'Količina dijela iz magacina mora biti cijeli broj' }
  const num = (v?: number | null) => (v == null || v === ('' as any) ? null : Number(v))
  const hours = num(params.workHours), cost = num(params.workCost)
  if ((hours != null && (!Number.isFinite(hours) || hours < 0)) || (cost != null && (!Number.isFinite(cost) || cost < 0))) return { ok: false, error: 'Sati i trošak moraju biti brojevi' }
  const workers = (params.workerNames ?? '').trim().slice(0, 200) || null
  const resolution = params.resolution?.trim() || undefined
  const nextById = sumById(parts)
  const low: string[] = []

  if (isDemoMode()) {
    const dr = await db.damageReport.findUnique({ where: { id: params.damageId } })
    if (!dr) return { ok: false, error: 'Kvar nije pronađen' }
    if (dr.status === 'RESOLVED') return { ok: false, error: 'Kvar je već riješen' }
    const prevById = sumById(parseParts(dr.partsJson))
    const ids = [...new Set([...prevById.keys(), ...nextById.keys()])]
    const stock = new Map<string, StockPart>()
    for (const id of ids) {
      const p = await db.sparePart.findUnique({ where: { id } })
      if (p) stock.set(id, { id: p.id, partNumber: p.partNumber, name: p.name, quantity: p.quantity, minQuantity: p.minQuantity, unitPrice: p.unitPrice })
    }
    for (const id of nextById.keys()) {
      const s = stock.get(id)
      if (!s) return { ok: false, error: 'Dio iz magacina više ne postoji — uklonite ga s naloga ili upišite kao slobodan tekst' }
      const delta = (nextById.get(id) ?? 0) - (prevById.get(id) ?? 0)
      if (delta > s.quantity) return { ok: false, error: `Nema dovoljno na stanju: ${s.name} (u magacinu ${s.quantity}, treba još ${delta})` }
    }
    await db.damageReport.update({
      where: { id: params.damageId },
      data: { partsJson: parts.length ? JSON.stringify(parts) : null, workHours: hours, workCost: cost, workerNames: workers, ...(resolution !== undefined && { resolution }) },
    })
    for (const id of ids) {
      const s = stock.get(id); if (!s) continue
      const delta = (nextById.get(id) ?? 0) - (prevById.get(id) ?? 0)
      if (delta === 0) continue
      const q = Math.max(0, s.quantity - delta)
      await db.sparePart.update({ where: { id }, data: { quantity: q } })
      if (q <= s.minQuantity) low.push(`${s.name} (stanje ${q}, minimum ${s.minQuantity})`)
    }
    await db.partConsumption.deleteMany({ where: { damageId: params.damageId } })
    for (const [id, qty] of nextById) {
      const s = stock.get(id)!
      await db.partConsumption.create({ data: {
        partId: id, partNumber: s.partNumber, partName: s.name, equipmentId: dr.equipmentId, equipmentCode: dr.equipmentCode, damageId: params.damageId,
        quantity: qty, unitPriceNet: s.unitPrice ?? 0, totalCost: qty * (s.unitPrice ?? 0), consumedBy: user.full_name, notes: 'Radni nalog popravke',
      } })
    }
  } else {
    const supabase = await createSupabaseClient()
    const { data: dr } = await supabase.from('damage_reports').select('status, equipment_id, equipment_code, parts_json').eq('id', params.damageId).maybeSingle()
    if (!dr) return { ok: false, error: 'Kvar nije pronađen' }
    if (dr.status === 'RESOLVED') return { ok: false, error: 'Kvar je već riješen' }
    const prevById = sumById(parseParts(dr.parts_json))
    const ids = [...new Set([...prevById.keys(), ...nextById.keys()])]
    const stock = new Map<string, StockPart>()
    if (ids.length) {
      const { data: rows } = await supabase.from('spare_parts').select('id, part_number, name, quantity, min_quantity, unit_price').in('id', ids)
      for (const p of rows ?? []) stock.set(p.id, { id: p.id, partNumber: p.part_number, name: p.name, quantity: Number(p.quantity ?? 0), minQuantity: Number(p.min_quantity ?? 0), unitPrice: p.unit_price == null ? null : Number(p.unit_price) })
    }
    for (const id of nextById.keys()) {
      const s = stock.get(id)
      if (!s) return { ok: false, error: 'Dio iz magacina više ne postoji — uklonite ga s naloga ili upišite kao slobodan tekst' }
      const delta = (nextById.get(id) ?? 0) - (prevById.get(id) ?? 0)
      if (delta > s.quantity) return { ok: false, error: `Nema dovoljno na stanju: ${s.name} (u magacinu ${s.quantity}, treba još ${delta})` }
    }
    const { error } = await supabase.from('damage_reports').update({
      parts_json: parts.length ? parts : null, work_hours: hours, work_cost: cost, worker_names: workers,
      ...(resolution !== undefined && { resolution }),
    }).eq('id', params.damageId)
    if (error) return { ok: false, error: error.message }
    for (const id of ids) {
      const s = stock.get(id); if (!s) continue
      const delta = (nextById.get(id) ?? 0) - (prevById.get(id) ?? 0)
      if (delta === 0) continue
      const q = Math.max(0, s.quantity - delta)
      await supabase.from('spare_parts').update({ quantity: q }).eq('id', id)
      if (q <= s.minQuantity) low.push(`${s.name} (stanje ${q}, minimum ${s.minQuantity})`)
    }
    // damage_id kolona dolazi iz migracije 036; bez nje ne ruši snimanje naloga
    const del = await supabase.from('part_consumption').delete().eq('damage_id', params.damageId)
    if (del.error) console.error('part_consumption (migracija 036?)', del.error.message)
    else if (nextById.size) {
      const { error: ie } = await supabase.from('part_consumption').insert([...nextById].map(([id, qty]) => {
        const s = stock.get(id)!
        return { part_id: id, part_number: s.partNumber, part_name: s.name, equipment_id: dr.equipment_id, equipment_code: dr.equipment_code, damage_id: params.damageId, quantity: qty, unit_price_net: s.unitPrice ?? 0, total_cost: qty * (s.unitPrice ?? 0), consumed_by: user.full_name, notes: 'Radni nalog popravke' }
      }))
      if (ie) console.error('part_consumption insert', ie.message)
    }
  }
  await logAudit('REPAIR_WORK_SAVED', 'damage_report', params.damageId, JSON.stringify({ parts, workers, hours, cost }))
  revalidatePath('/')
  return { ok: true, lowStock: low.length ? low : undefined }
}
