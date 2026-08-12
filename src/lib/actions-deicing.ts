'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth-server'
import {
  calculateHOT,
  type FluidType,
  type Concentration,
  type PrecipitationType,
  type Intensity,
} from '@/lib/hot-tables'

// ============================================================================
// DEICING FLUIDS — inventar
// ============================================================================

export async function getDeicingFluids() {
  const _user = await getCurrentUser();
  if (!_user) throw new Error('Morate biti ulogovani')

  if (isDemoMode()) {
    return db.deicingFluid.findMany({ orderBy: { receivedAt: 'desc' } })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('deicing_fluids')
    .select('*')
    .order('received_at', { ascending: false })

  return (data ?? []).map((f: any) => ({
    id: f.id,
    fluidType: f.fluid_type,
    brandName: f.brand_name,
    manufacturer: f.manufacturer,
    batchNumber: f.batch_number,
    quantityLiters: f.quantity_liters,
    unitPrice: f.unit_price,
    concentration: f.concentration,
    expiryDate: f.expiry_date ? new Date(f.expiry_date) : null,
    receivedAt: f.received_at ? new Date(f.received_at) : null,
    storageLocation: f.storage_location,
    safetyDataSheet: f.safety_data_sheet,
    notes: f.notes,
    isExpired: f.is_expired,
  }))
}

export async function addDeicingFluid(input: {
  fluidType: string
  brandName: string
  manufacturer?: string
  batchNumber: string
  quantityLiters: number
  unitPrice?: number
  concentration?: string
  expiryDate?: string
  storageLocation?: string
  safetyDataSheet?: string
  notes?: string
}) {
  const _user = await getCurrentUser();
  if (!_user) throw new Error('Morate biti ulogovani')

  // Check for expired
  const isExpired = input.expiryDate ? new Date(input.expiryDate) < new Date() : false

  if (isDemoMode()) {
    await db.deicingFluid.create({
      data: {
        fluidType: input.fluidType,
        brandName: input.brandName,
        manufacturer: input.manufacturer || null,
        batchNumber: input.batchNumber,
        quantityLiters: input.quantityLiters,
        unitPrice: input.unitPrice || null,
        concentration: input.concentration || null,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
        storageLocation: input.storageLocation || null,
        safetyDataSheet: input.safetyDataSheet || null,
        notes: input.notes || null,
        isExpired,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('deicing_fluids').insert({
    fluid_type: input.fluidType,
    brand_name: input.brandName,
    manufacturer: input.manufacturer || null,
    batch_number: input.batchNumber,
    quantity_liters: input.quantityLiters,
    unit_price: input.unitPrice || null,
    concentration: input.concentration || null,
    expiry_date: input.expiryDate || null,
    storage_location: input.storageLocation || null,
    safety_data_sheet: input.safetyDataSheet || null,
    notes: input.notes || null,
    is_expired: isExpired,
  })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function deleteDeicingFluid(id: string) {
  const _user = await getCurrentUser();
  if (!_user) throw new Error('Morate biti ulogovani')

  if (isDemoMode()) {
    await db.deicingFluid.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('deicing_fluids').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function updateDeicingFluidQuantity(id: string, quantity: number) {
  const _user = await getCurrentUser();
  if (!_user) throw new Error('Morate biti ulogovani')

  if (isDemoMode()) {
    await db.deicingFluid.update({ where: { id }, data: { quantityLiters: quantity } })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase
    .from('deicing_fluids')
    .update({ quantity_liters: quantity })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================================
// DEICING RECORDS — operacije
// ============================================================================

export async function getDeicingRecords() {
  const _user = await getCurrentUser();
  if (!_user) throw new Error('Morate biti ulogovani')

  if (isDemoMode()) {
    return db.deicingRecord.findMany({ orderBy: { applicationStart: 'desc' } })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('deicing_records')
    .select('*')
    .order('application_start', { ascending: false })

  return (data ?? []).map((r: any) => ({
    id: r.id,
    flightNumber: r.flight_number,
    aircraftReg: r.aircraft_reg,
    aircraftType: r.aircraft_type,
    standPosition: r.stand_position,
    operationType: r.operation_type,
    fluidType: r.fluid_type,
    concentration: r.concentration,
    fluidBatchNumber: r.fluid_batch_number,
    fluidUsedLiters: r.fluid_used_liters,
    applicationStart: new Date(r.application_start),
    applicationEnd: r.application_end ? new Date(r.application_end) : null,
    durationMinutes: r.duration_minutes,
    oat: r.oat,
    precipitation: r.precipitation,
    precipitationIntensity: r.precipitation_intensity,
    windSpeed: r.wind_speed,
    windDirection: r.wind_direction,
    dewPoint: r.dew_point,
    visibility: r.visibility,
    holdoverTimeMinutes: r.holdover_time_minutes,
    hotTableRef: r.hot_table_ref,
    equipmentCode: r.equipment_code,
    operatorName: r.operator_name,
    operatorCardId: r.operator_card_id,
    shift: r.shift,
    inspectionResult: r.inspection_result,
    postCheckBy: r.post_check_by,
    reapplicationRequired: r.reapplication_required,
    notes: r.notes,
  }))
}

export async function createDeicingRecord(input: {
  flightNumber?: string
  aircraftReg?: string
  aircraftType?: string
  standPosition?: string
  operationType: string
  fluidType: string
  concentration?: string
  fluidBatchNumber?: string
  fluidUsedLiters: number
  applicationStart: string
  applicationEnd?: string
  oat: number
  precipitation?: string
  precipitationIntensity?: string
  windSpeed?: number
  windDirection?: number
  dewPoint?: number
  visibility?: number
  equipmentCode?: string
  operatorName?: string
  operatorCardId?: string
  shift?: string
  inspectionResult?: string
  postCheckBy?: string
  reapplicationRequired?: boolean
  notes?: string
}) {
  const _user = await getCurrentUser();
  if (!_user) throw new Error('Morate biti ulogovani')

  // Auto-calculate HOT ako su svi potrebni parametri prisutni
  let holdoverTimeMinutes: number | null = null
  let hotTableRef = ''
  if (input.precipitation && input.precipitation !== 'NONE' && input.oat != null) {
    const result = calculateHOT(
      input.fluidType as FluidType,
      input.concentration as Concentration,
      input.precipitation as PrecipitationType,
      input.precipitationIntensity as Intensity | undefined,
      input.oat
    )
    holdoverTimeMinutes = result.hotMinutes
    hotTableRef = result.tableRef
  }

  // Auto-calculate duration
  let durationMinutes: number | null = null
  if (input.applicationEnd && input.applicationStart) {
    const diff = (new Date(input.applicationEnd).getTime() - new Date(input.applicationStart).getTime()) / 60000
    durationMinutes = Math.round(diff)
  }

  if (isDemoMode()) {
    await db.deicingRecord.create({
      data: {
        flightNumber: input.flightNumber || null,
        aircraftReg: input.aircraftReg || null,
        aircraftType: input.aircraftType || null,
        standPosition: input.standPosition || null,
        operationType: input.operationType,
        fluidType: input.fluidType,
        concentration: input.concentration || null,
        fluidBatchNumber: input.fluidBatchNumber || null,
        fluidUsedLiters: input.fluidUsedLiters,
        applicationStart: new Date(input.applicationStart),
        applicationEnd: input.applicationEnd ? new Date(input.applicationEnd) : null,
        durationMinutes,
        oat: input.oat,
        precipitation: input.precipitation || null,
        precipitationIntensity: input.precipitationIntensity || null,
        windSpeed: input.windSpeed || null,
        windDirection: input.windDirection || null,
        dewPoint: input.dewPoint || null,
        visibility: input.visibility || null,
        holdoverTimeMinutes,
        hotTableRef,
        equipmentCode: input.equipmentCode || null,
        operatorName: input.operatorName || null,
        operatorCardId: input.operatorCardId || null,
        shift: input.shift || null,
        inspectionResult: input.inspectionResult || null,
        postCheckBy: input.postCheckBy || null,
        reapplicationRequired: input.reapplicationRequired || false,
        notes: input.notes || null,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, holdoverTimeMinutes, hotTableRef }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('deicing_records').insert({
    flight_number: input.flightNumber || null,
    aircraft_reg: input.aircraftReg || null,
    aircraft_type: input.aircraftType || null,
    stand_position: input.standPosition || null,
    operation_type: input.operationType,
    fluid_type: input.fluidType,
    concentration: input.concentration || null,
    fluid_batch_number: input.fluidBatchNumber || null,
    fluid_used_liters: input.fluidUsedLiters,
    application_start: input.applicationStart,
    application_end: input.applicationEnd || null,
    duration_minutes: durationMinutes,
    oat: input.oat,
    precipitation: input.precipitation || null,
    precipitation_intensity: input.precipitationIntensity || null,
    wind_speed: input.windSpeed || null,
    wind_direction: input.windDirection || null,
    dew_point: input.dewPoint || null,
    visibility: input.visibility || null,
    holdover_time_minutes: holdoverTimeMinutes,
    hot_table_ref: hotTableRef,
    equipment_code: input.equipmentCode || null,
    operator_name: input.operatorName || null,
    operator_card_id: input.operatorCardId || null,
    shift: input.shift || null,
    inspection_result: input.inspectionResult || null,
    post_check_by: input.postCheckBy || null,
    reapplication_required: input.reapplicationRequired || false,
    notes: input.notes || null,
  })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true, holdoverTimeMinutes, hotTableRef }
}

export async function deleteDeicingRecord(id: string) {
  const _user = await getCurrentUser();
  if (!_user) throw new Error('Morate biti ulogovani')

  if (isDemoMode()) {
    await db.deicingRecord.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('deicing_records').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================================
// DISPOSAL — environmental
// ============================================================================

export async function getDeicingDisposals() {
  const _user = await getCurrentUser();
  if (!_user) throw new Error('Morate biti ulogovani')

  if (isDemoMode()) {
    return db.deicingFluidDisposal.findMany({ orderBy: { disposalDate: 'desc' } })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('deicing_fluid_disposal')
    .select('*')
    .order('disposal_date', { ascending: false })

  return (data ?? []).map((d: any) => ({
    id: d.id,
    disposalDate: new Date(d.disposal_date),
    fluidType: d.fluid_type,
    batchNumber: d.batch_number,
    quantityLiters: d.quantity_liters,
    disposalMethod: d.disposal_method,
    vendorName: d.vendor_name,
    vendorLicense: d.vendor_license,
    manifestNumber: d.manifest_number,
    disposalCost: d.disposal_cost,
    location: d.location,
    notes: d.notes,
  }))
}

export async function createDeicingDisposal(input: {
  disposalDate?: string
  fluidType: string
  batchNumber?: string
  quantityLiters: number
  disposalMethod: string
  vendorName?: string
  vendorLicense?: string
  manifestNumber?: string
  disposalCost?: number
  location?: string
  notes?: string
}) {
  const _user = await getCurrentUser();
  if (!_user) throw new Error('Morate biti ulogovani')

  if (isDemoMode()) {
    await db.deicingFluidDisposal.create({
      data: {
        disposalDate: input.disposalDate ? new Date(input.disposalDate) : new Date(),
        fluidType: input.fluidType,
        batchNumber: input.batchNumber || null,
        quantityLiters: input.quantityLiters,
        disposalMethod: input.disposalMethod,
        vendorName: input.vendorName || null,
        vendorLicense: input.vendorLicense || null,
        manifestNumber: input.manifestNumber || null,
        disposalCost: input.disposalCost || null,
        location: input.location || null,
        notes: input.notes || null,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('deicing_fluid_disposal').insert({
    disposal_date: input.disposalDate || new Date().toISOString(),
    fluid_type: input.fluidType,
    batch_number: input.batchNumber || null,
    quantity_liters: input.quantityLiters,
    disposal_method: input.disposalMethod,
    vendor_name: input.vendorName || null,
    vendor_license: input.vendorLicense || null,
    manifest_number: input.manifestNumber || null,
    disposal_cost: input.disposalCost || null,
    location: input.location || null,
    notes: input.notes || null,
  })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function deleteDeicingDisposal(id: string) {
  const _user = await getCurrentUser();
  if (!_user) throw new Error('Morate biti ulogovani')

  if (isDemoMode()) {
    await db.deicingFluidDisposal.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('deicing_fluid_disposal').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================================
// STATISTIKA
// ============================================================================

export async function getDeicingStats() {
  const _user = await getCurrentUser();
  if (!_user) throw new Error('Morate biti ulogovani')

  const [fluids, records, disposals] = await Promise.all([
    getDeicingFluids(),
    getDeicingRecords(),
    getDeicingDisposals(),
  ])

  const today = new Date()
  const expiredFluids = fluids.filter((f: any) => f.expiryDate && new Date(f.expiryDate) < today)
  const expiringSoon = fluids.filter((f: any) => {
    if (!f.expiryDate) return false
    const d = new Date(f.expiryDate)
    if (d < today) return false
    const days = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return days <= 30
  })

  // Total fluid in stock
  const totalStockLiters = fluids.reduce((s: number, f: any) => s + f.quantityLiters, 0)
  const stockValue = fluids.reduce((s: number, f: any) => s + (f.quantityLiters * (f.unitPrice || 0)), 0)

  // Total fluid used (from records)
  const totalUsedLiters = records.reduce((s: number, r: any) => s + r.fluidUsedLiters, 0)

  // Total disposed
  const totalDisposedLiters = disposals.reduce((s: number, d: any) => s + d.quantityLiters, 0)

  // By fluid type
  const byType: Record<string, { stock: number; used: number; disposed: number }> = {}
  for (const f of fluids) {
    if (!byType[f.fluidType]) byType[f.fluidType] = { stock: 0, used: 0, disposed: 0 }
    byType[f.fluidType].stock += f.quantityLiters
  }
  for (const r of records) {
    if (!byType[r.fluidType]) byType[r.fluidType] = { stock: 0, used: 0, disposed: 0 }
    byType[r.fluidType].used += r.fluidUsedLiters
  }
  for (const d of disposals) {
    if (!byType[d.fluidType]) byType[d.fluidType] = { stock: 0, used: 0, disposed: 0 }
    byType[d.fluidType].disposed += d.quantityLiters
  }

  // By vehicle (equipment)
  const byVehicle: Record<string, { operations: number; litersUsed: number }> = {}
  for (const r of records) {
    const code = r.equipmentCode || 'Nepoznato'
    if (!byVehicle[code]) byVehicle[code] = { operations: 0, litersUsed: 0 }
    byVehicle[code].operations += 1
    byVehicle[code].litersUsed += r.fluidUsedLiters
  }

  // By month (last 12)
  const byMonth: Record<string, { operations: number; litersUsed: number }> = {}
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    byMonth[key] = { operations: 0, litersUsed: 0 }
  }
  for (const r of records) {
    const d = new Date(r.applicationStart)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (byMonth[key]) {
      byMonth[key].operations += 1
      byMonth[key].litersUsed += r.fluidUsedLiters
    }
  }

  // Total disposal cost
  const totalDisposalCost = disposals.reduce((s: number, d: any) => s + (d.disposalCost || 0), 0)

  return {
    fluidCount: fluids.length,
    expiredCount: expiredFluids.length,
    expiringSoonCount: expiringSoon.length,
    totalStockLiters,
    stockValue,
    totalUsedLiters,
    totalDisposedLiters,
    totalDisposalCost,
    recordsCount: records.length,
    byType,
    byVehicle,
    byMonth,
    expiredFluids,
    expiringSoon,
  }
}
