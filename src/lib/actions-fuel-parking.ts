'use server'

// Fuel/Charging Management + GSE Parking Management (AHM 1115)

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function requireRole(roles: Array<'operator' | 'engineer' | 'admin'>): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  if (!roles.includes(user.role)) throw new Error(`Nemate dozvolu. Potrebna rola: ${roles.join(' ili ')}`)
  return user
}

// =====================================================
// FUEL LOGS — točenje goriva / punjenje
// =====================================================

export async function getFuelLogs(params?: { search?: string; typeFilter?: string; limit?: number }) {
  await requireRole(['engineer', 'admin'])
  const limit = params?.limit ?? 100

  if (isDemoMode()) {
    let where: any = {}
    if (params?.typeFilter && params.typeFilter !== 'ALL') where.fuelType = params.typeFilter
    if (params?.search) {
      const s = params.search.toLowerCase()
      where.OR = [
        { equipmentCode: { contains: s } }, { operatorName: { contains: s } },
        { pumpStation: { contains: s } },
      ]
    }
    return db.fuelLog.findMany({ where, orderBy: { fueledAt: 'desc' }, take: limit })
  }

  const supabase = await createSupabaseClient()
  let query = supabase.from('fuel_logs').select('*').order('fueled_at', { ascending: false }).limit(limit)
  if (params?.typeFilter && params.typeFilter !== 'ALL') query = query.eq('fuel_type', params.typeFilter)
  const { data } = await query

  let results = (data ?? []).map((f: any) => ({
    id: f.id, equipmentId: f.equipment_id, equipmentCode: f.equipment_code, equipmentName: f.equipment_name,
    fuelType: f.fuel_type, amount: f.amount, unit: f.unit, levelBefore: f.level_before, levelAfter: f.level_after,
    pumpStation: f.pump_station, costPerUnit: f.cost_per_unit, totalCost: f.total_cost,
    operatorCardId: f.operator_card_id, operatorName: f.operator_name, fueledAt: new Date(f.fueled_at),
    notes: f.notes, createdAt: new Date(f.created_at),
  }))

  if (params?.search) {
    const s = params.search.toLowerCase()
    results = results.filter((f: any) => f.equipmentCode?.toLowerCase().includes(s) || f.operatorName?.toLowerCase().includes(s) || f.pumpStation?.toLowerCase().includes(s))
  }
  return results
}

export async function addFuelLog(params: {
  equipmentId: string; equipmentCode: string; equipmentName: string
  fuelType: string; amount: number; unit?: string
  levelBefore?: number; levelAfter?: number
  pumpStation?: string; costPerUnit?: number; totalCost?: number
  operatorCardId: string; operatorName: string; notes?: string
}) {
  // Javna funkcija — radnici toče gorivo bez login-a

  if (isDemoMode()) {
    const log = await db.fuelLog.create({ data: {
      equipmentId: params.equipmentId, equipmentCode: params.equipmentCode, equipmentName: params.equipmentName,
      fuelType: params.fuelType, amount: params.amount, unit: params.unit ?? 'L',
      levelBefore: params.levelBefore ?? null, levelAfter: params.levelAfter ?? null,
      pumpStation: params.pumpStation ?? null, costPerUnit: params.costPerUnit ?? null,
      totalCost: params.totalCost ?? null, operatorCardId: params.operatorCardId,
      operatorName: params.operatorName, notes: params.notes ?? null,
    }})

    // Ažuriraj fuel level na equipment
    if (params.levelAfter != null) {
      await db.equipment.update({ where: { id: params.equipmentId }, data: { fuelLevel: params.levelAfter } })
    }

    revalidatePath('/dashboard')
    return { ok: true, id: log.id }
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.from('fuel_logs').insert({
    equipment_id: params.equipmentId, equipment_code: params.equipmentCode, equipment_name: params.equipmentName,
    fuel_type: params.fuelType, amount: params.amount, unit: params.unit ?? 'L',
    level_before: params.levelBefore ?? null, level_after: params.levelAfter ?? null,
    pump_station: params.pumpStation ?? null, cost_per_unit: params.costPerUnit ?? null,
    total_cost: params.totalCost ?? null, operator_card_id: params.operatorCardId,
    operator_name: params.operatorName, notes: params.notes ?? null,
  }).select().single()

  if (error) throw error

  if (params.levelAfter != null) {
    await supabase.from('equipment').update({ fuel_level: params.levelAfter }).eq('id', params.equipmentId)
  }

  revalidatePath('/dashboard')
  return { ok: true, id: data?.id }
}

export async function getFuelStats() {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    const [logs, dieselTotal, electricTotal] = await Promise.all([
      db.fuelLog.count(),
      db.fuelLog.aggregate({ where: { fuelType: 'DIESEL' }, _sum: { amount: true, totalCost: true } }),
      db.fuelLog.aggregate({ where: { fuelType: 'ELECTRIC' }, _sum: { amount: true, totalCost: true } }),
    ])
    const lowFuel = await db.equipment.count({ where: { fuelLevel: { lt: db.equipment.fields.lowFuelThreshold } } })

    return {
      totalEntries: logs,
      dieselLiters: dieselTotal._sum.amount ?? 0,
      dieselCost: dieselTotal._sum.totalCost ?? 0,
      electricKwh: electricTotal._sum.amount ?? 0,
      electricCost: electricTotal._sum.totalCost ?? 0,
      totalCost: (dieselTotal._sum.totalCost ?? 0) + (electricTotal._sum.totalCost ?? 0),
      lowFuelVehicles: lowFuel,
    }
  }

  const supabase = await createSupabaseClient()
  const [allRes, dieselRes, electricRes, lowFuelRes] = await Promise.all([
    supabase.from('fuel_logs').select('*', { count: 'exact', head: true }),
    supabase.from('fuel_logs').select('amount, total_cost').eq('fuel_type', 'DIESEL'),
    supabase.from('fuel_logs').select('amount, total_cost').eq('fuel_type', 'ELECTRIC'),
    supabase.from('equipment').select('*', { count: 'exact', head: true }).lt('fuel_level', 20),
  ])

  const dieselData = dieselRes.data ?? []
  const electricData = electricRes.data ?? []
  const dieselLiters = dieselData.reduce((s: number, f: any) => s + (f.amount ?? 0), 0)
  const dieselCost = dieselData.reduce((s: number, f: any) => s + (f.total_cost ?? 0), 0)
  const electricKwh = electricData.reduce((s: number, f: any) => s + (f.amount ?? 0), 0)
  const electricCost = electricData.reduce((s: number, f: any) => s + (f.total_cost ?? 0), 0)

  return {
    totalEntries: allRes.count ?? 0,
    dieselLiters, dieselCost, electricKwh, electricCost,
    totalCost: dieselCost + electricCost,
    lowFuelVehicles: lowFuelRes.count ?? 0,
  }
}

// =====================================================
// PARKING CONFIRMATIONS — AHM 1115
// =====================================================

export async function getParkingConfirmations(params?: { search?: string; limit?: number }) {
  await requireRole(['engineer', 'admin'])
  const limit = params?.limit ?? 100

  if (isDemoMode()) {
    let where: any = {}
    if (params?.search) {
      const s = params.search.toLowerCase()
      where.OR = [{ equipmentCode: { contains: s } }, { operatorName: { contains: s } }, { parkingLocation: { contains: s } }]
    }
    return db.parkingConfirmation.findMany({ where, orderBy: { confirmedAt: 'desc' }, take: limit })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('parking_confirmations').select('*').order('confirmed_at', { ascending: false }).limit(limit)

  let results = (data ?? []).map((p: any) => ({
    id: p.id, equipmentId: p.equipment_id, equipmentCode: p.equipment_code, equipmentName: p.equipment_name,
    operatorCardId: p.operator_card_id, operatorName: p.operator_name,
    parkedAtDesignatedSpot: p.parked_at_designated_spot, handbrakeEngaged: p.handbrake_engaged,
    ignitionOff: p.ignition_off, lightsOff: p.lights_off, keyRemoved: p.key_removed, chocksPlaced: p.chocks_placed,
    parkingLocation: p.parking_location, photoUrl: p.photo_url, assignmentId: p.assignment_id,
    allConfirmed: p.all_confirmed, issuesReported: p.issues_reported, confirmedAt: new Date(p.confirmed_at),
    createdAt: new Date(p.created_at),
  }))

  if (params?.search) {
    const s = params.search.toLowerCase()
    results = results.filter((p: any) => p.equipmentCode?.toLowerCase().includes(s) || p.operatorName?.toLowerCase().includes(s) || p.parkingLocation?.toLowerCase().includes(s))
  }
  return results
}

export async function addParkingConfirmation(params: {
  equipmentId: string; equipmentCode: string; equipmentName: string
  operatorCardId: string; operatorName: string
  parkedAtDesignatedSpot: boolean; handbrakeEngaged: boolean; ignitionOff: boolean
  lightsOff: boolean; keyRemoved: boolean; chocksPlaced?: boolean
  parkingLocation?: string; photoUrl?: string; assignmentId?: string
  issuesReported?: string
}) {
  // Javna funkcija — radnici potvrđuju parking bez login-a

  const allConfirmed = params.parkedAtDesignatedSpot && params.handbrakeEngaged && params.ignitionOff && params.lightsOff && params.keyRemoved
  const issues = allConfirmed ? null : (params.issuesReported || 'Nisu sve potvrde date')

  if (isDemoMode()) {
    const conf = await db.parkingConfirmation.create({ data: {
      equipmentId: params.equipmentId, equipmentCode: params.equipmentCode, equipmentName: params.equipmentName,
      operatorCardId: params.operatorCardId, operatorName: params.operatorName,
      parkedAtDesignatedSpot: params.parkedAtDesignatedSpot, handbrakeEngaged: params.handbrakeEngaged,
      ignitionOff: params.ignitionOff, lightsOff: params.lightsOff, keyRemoved: params.keyRemoved,
      chocksPlaced: params.chocksPlaced ?? false, parkingLocation: params.parkingLocation ?? null,
      photoUrl: params.photoUrl ?? null, assignmentId: params.assignmentId ?? null,
      allConfirmed, issuesReported: issues,
    }})
    revalidatePath('/dashboard')
    return { ok: true, id: conf.id, allConfirmed }
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.from('parking_confirmations').insert({
    equipment_id: params.equipmentId, equipment_code: params.equipmentCode, equipment_name: params.equipmentName,
    operator_card_id: params.operatorCardId, operator_name: params.operatorName,
    parked_at_designated_spot: params.parkedAtDesignatedSpot, handbrake_engaged: params.handbrakeEngaged,
    ignition_off: params.ignitionOff, lights_off: params.lightsOff, key_removed: params.keyRemoved,
    chocks_placed: params.chocksPlaced ?? false, parking_location: params.parkingLocation ?? null,
    photo_url: params.photoUrl ?? null, assignment_id: params.assignmentId ?? null,
    all_confirmed: allConfirmed, issues_reported: issues,
  }).select().single()

  if (error) throw error
  revalidatePath('/dashboard')
  return { ok: true, id: data?.id, allConfirmed }
}

export async function getParkingStats() {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    const [total, allConfirmed, withIssues] = await Promise.all([
      db.parkingConfirmation.count(),
      db.parkingConfirmation.count({ where: { allConfirmed: true } }),
      db.parkingConfirmation.count({ where: { allConfirmed: false } }),
    ])
    return { total, allConfirmed, withIssues }
  }

  const supabase = await createSupabaseClient()
  const [totalRes, confirmedRes] = await Promise.all([
    supabase.from('parking_confirmations').select('*', { count: 'exact', head: true }),
    supabase.from('parking_confirmations').select('*', { count: 'exact', head: true }).eq('all_confirmed', true),
  ])
  return { total: totalRes.count ?? 0, allConfirmed: confirmedRes.count ?? 0, withIssues: (totalRes.count ?? 0) - (confirmedRes.count ?? 0) }
}
