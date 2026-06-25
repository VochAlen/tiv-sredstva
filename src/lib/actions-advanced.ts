'use server'

// Statistika i napredne akcije
// Dual-mode: Prisma (Demo) ili Supabase (Production)

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from 'next/cache'
import type { Stats, ActivityByDay, EquipmentUtilization } from '@/lib/types-advanced'

async function requireAuth(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  return user
}

async function requireRole(roles: Array<'operator' | 'engineer' | 'admin'>): Promise<AppUser> {
  const user = await requireAuth()
  if (!roles.includes(user.role)) {
    throw new Error(`Nemate dozvolu. Potrebna rola: ${roles.join(' ili ')}`)
  }
  return user
}

// =====================================================
// STATISTIKA
// =====================================================

export async function getStats(): Promise<Stats> {
  await requireAuth()

  if (isDemoMode()) {
    const equipment = await db.equipment.findMany()
    const total = equipment.length
    const available = equipment.filter((e) => e.status === 'AVAILABLE').length
    const assigned = equipment.filter((e) => e.status === 'ASSIGNED').length
    const outOfService = equipment.filter((e) => e.status === 'OUT_OF_SERVICE').length
    const maintenance = equipment.filter((e) => e.status === 'MAINTENANCE').length

    const openDamages = await db.damageReport.count({ where: { status: { not: 'RESOLVED' } } })

    // Inspekcije
    const today = new Date()
    const inspectionOverdue = equipment.filter((e) =>
      e.nextInspectionDate && new Date(e.nextInspectionDate) < today
    ).length
    const inspectionDueSoon = equipment.filter((e) => {
      if (!e.nextInspectionDate) return false
      const days = Math.floor((new Date(e.nextInspectionDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return days >= 0 && days <= 30
    }).length

    // Aktivnost (zadnjih 30 dana)
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    const recentAssignments = await db.assignment.findMany({
      where: { timestamp: { gte: thirtyDaysAgo } },
    })
    const totalCheckouts = recentAssignments.filter((a) => a.action === 'CHECK_OUT' && !a.damageReportId).length
    const totalCheckins = recentAssignments.filter((a) => a.action === 'CHECK_IN').length
    const totalDamages = recentAssignments.filter((a) => a.damageReportId).length

    // Compliance rate = % check-out-a bez oštećenja
    const complianceRate = totalCheckouts + totalDamages > 0
      ? Math.round((totalCheckouts / (totalCheckouts + totalDamages)) * 100)
      : 100

    // MTBF (Mean Time Between Failures) - aproksimacija
    // Broj radnih sati / broj kvarova
    const totalHours = equipment.reduce((sum, e) => sum + (e.totalOperatingHours ?? 0), 0)
    const allDamagesCount = await db.damageReport.count()
    const mtbfHours = allDamagesCount > 0 ? Math.round(totalHours / allDamagesCount) : 0

    // MTTR (Mean Time To Repair) - prosječno vrijeme reparacije u satima
    const resolvedDamages = await db.damageReport.findMany({
      where: { status: 'RESOLVED', resolvedAt: { not: null } },
    })
    const mttrHours = resolvedDamages.length > 0
      ? Math.round(resolvedDamages.reduce((sum, d) => {
          const hours = d.resolvedAt! ? (d.resolvedAt!.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60) : 0
          return sum + hours
        }, 0) / resolvedDamages.length)
      : 0

    // Utilization rate = % opreme koja je trenutno u upotrebi
    const utilizationRate = total > 0 ? Math.round((assigned / total) * 100) : 0

    return {
      total, available, assigned, outOfService, maintenance, openDamages,
      inspectionOverdue, inspectionDueSoon,
      totalCheckouts, totalCheckins, complianceRate,
      mtbfHours, mttrHours, utilizationRate,
    }
  }

  // Supabase
  const supabase = await createSupabaseClient()
  const { data: equipment } = await supabase.from('equipment').select('*')
  const eq = equipment ?? []
  const total = eq.length
  const available = eq.filter((e: any) => e.status === 'AVAILABLE').length
  const assigned = eq.filter((e: any) => e.status === 'ASSIGNED').length
  const outOfService = eq.filter((e: any) => e.status === 'OUT_OF_SERVICE').length
  const maintenance = eq.filter((e: any) => e.status === 'MAINTENANCE').length

  const { count: openDamages } = await supabase
    .from('damage_reports')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'RESOLVED')

  const today = new Date()
  const inspectionOverdue = eq.filter((e: any) =>
    e.next_inspection_date && new Date(e.next_inspection_date) < today
  ).length
  const inspectionDueSoon = eq.filter((e: any) => {
    if (!e.next_inspection_date) return false
    const days = Math.floor((new Date(e.next_inspection_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return days >= 0 && days <= 30
  }).length

  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('assignments')
    .select('*')
    .gte('timestamp', thirtyDaysAgo)
  const recentAssignments = recent ?? []
  const totalCheckouts = recentAssignments.filter((a: any) => a.action === 'CHECK_OUT' && !a.damage_report_id).length
  const totalCheckins = recentAssignments.filter((a: any) => a.action === 'CHECK_IN').length
  const totalDamages = recentAssignments.filter((a: any) => a.damage_report_id).length

  const complianceRate = totalCheckouts + totalDamages > 0
    ? Math.round((totalCheckouts / (totalCheckouts + totalDamages)) * 100)
    : 100

  const totalHours = eq.reduce((sum: number, e: any) => sum + (e.total_operating_hours ?? 0), 0)
  const { count: allDamagesCount } = await supabase
    .from('damage_reports')
    .select('*', { count: 'exact', head: true })
  const mtbfHours = (allDamagesCount ?? 0) > 0 ? Math.round(totalHours / (allDamagesCount ?? 1)) : 0

  const { data: resolved } = await supabase
    .from('damage_reports')
    .select('created_at, resolved_at')
    .eq('status', 'RESOLVED')
    .not('resolved_at', 'is', null)
  const mttrHours = (resolved ?? []).length > 0
    ? Math.round((resolved ?? []).reduce((sum: number, d: any) => {
        const hours = d.resolved_at ? (new Date(d.resolved_at).getTime() - new Date(d.created_at).getTime()) / (1000 * 60 * 60) : 0
        return sum + hours
      }, 0) / (resolved ?? []).length)
    : 0

  const utilizationRate = total > 0 ? Math.round((assigned / total) * 100) : 0

  return {
    total, available, assigned, outOfService, maintenance, openDamages: openDamages ?? 0,
    inspectionOverdue, inspectionDueSoon,
    totalCheckouts, totalCheckins, complianceRate,
    mtbfHours, mttrHours, utilizationRate,
  }
}

export async function getActivityByDay(days = 30): Promise<ActivityByDay[]> {
  await requireAuth()

  if (isDemoMode()) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const assignments = await db.assignment.findMany({
      where: { timestamp: { gte: startDate } },
    })

    const byDay = new Map<string, ActivityByDay>()
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().slice(0, 10)
      byDay.set(dateStr, { date: dateStr, checkouts: 0, checkins: 0, damages: 0 })
    }

    for (const a of assignments) {
      const dateStr = a.timestamp.toISOString().slice(0, 10)
      const day = byDay.get(dateStr)
      if (!day) continue
      if (a.action === 'CHECK_OUT') day.checkouts++
      if (a.action === 'CHECK_IN') day.checkins++
      if (a.damageReportId) day.damages++
    }

    return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date))
  }

  // Supabase
  const supabase = await createSupabaseClient()
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('assignments')
    .select('action, timestamp, damage_report_id')
    .gte('timestamp', startDate)

  const byDay = new Map<string, ActivityByDay>()
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const dateStr = date.toISOString().slice(0, 10)
    byDay.set(dateStr, { date: dateStr, checkouts: 0, checkins: 0, damages: 0 })
  }

  for (const a of data ?? []) {
    const dateStr = new Date(a.timestamp).toISOString().slice(0, 10)
    const day = byDay.get(dateStr)
    if (!day) continue
    if (a.action === 'CHECK_OUT') day.checkouts++
    if (a.action === 'CHECK_IN') day.checkins++
    if (a.damage_report_id) day.damages++
  }

  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export async function getEquipmentUtilization(): Promise<EquipmentUtilization[]> {
  await requireAuth()

  if (isDemoMode()) {
    const equipment = await db.equipment.findMany()
    const assignments = await db.assignment.findMany({
      where: { damageReportId: null },
    })
    const damages = await db.damageReport.groupBy({
      by: ['equipmentId'],
      _count: true,
    })

    return equipment.map((e) => {
      const eqAssignments = assignments.filter((a) => a.equipmentId === e.id && a.action === 'CHECK_OUT')
      const eqDamages = damages.find((d) => d.equipmentId === e.id)?._count ?? 0
      const lastActivity = assignments
        .filter((a) => a.equipmentId === e.id)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp ?? null

      // Utilization = broj zaduženja u zadnjih 30 dana / 30 dana
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const recentCheckouts = eqAssignments.filter((a) => a.timestamp >= thirtyDaysAgo).length
      const utilizationRate = Math.min(100, Math.round((recentCheckouts / 30) * 100))

      return {
        code: e.code,
        name: e.name,
        type: e.type,
        checkouts: eqAssignments.length,
        utilizationRate,
        damages: eqDamages,
        lastActivity: lastActivity?.toISOString() ?? null,
      }
    }).sort((a, b) => b.checkouts - a.checkouts)
  }

  // Supabase
  const supabase = await createSupabaseClient()
  const { data: equipment } = await supabase.from('equipment').select('*')
  const { data: assignments } = await supabase
    .from('assignments')
    .select('equipment_id, action, timestamp, damage_report_id')
    .is('damage_report_id', null)
  const { data: damages } = await supabase
    .from('damage_reports')
    .select('equipment_id')

  return (equipment ?? []).map((e: any) => {
    const eqAssignments = (assignments ?? []).filter((a: any) => a.equipment_id === e.id && a.action === 'CHECK_OUT')
    const eqDamages = (damages ?? []).filter((d: any) => d.equipment_id === e.id).length
    const lastActivity = (assignments ?? [])
      .filter((a: any) => a.equipment_id === e.id)
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.timestamp ?? null

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recentCheckouts = eqAssignments.filter((a: any) => new Date(a.timestamp) >= thirtyDaysAgo).length
    const utilizationRate = Math.min(100, Math.round((recentCheckouts / 30) * 100))

    return {
      code: e.code,
      name: e.name,
      type: e.type,
      checkouts: eqAssignments.length,
      utilizationRate,
      damages: eqDamages,
      lastActivity,
    }
  }).sort((a, b) => b.checkouts - a.checkouts)
}

export async function getInspectionAlerts() {
  await requireAuth()

  if (isDemoMode()) {
    const equipment = await db.equipment.findMany({
      where: { nextInspectionDate: { not: null } },
    })
    const today = new Date()
    return equipment
      .map((e) => {
        const days = e.nextInspectionDate! ? Math.floor((new Date(e.nextInspectionDate!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null
        let status: 'OVERDUE' | 'DUE_SOON' | 'OK' = 'OK'
        if (days !== null && days < 0) status = 'OVERDUE'
        else if (days !== null && days <= 30) status = 'DUE_SOON'
        return {
          id: e.id,
          code: e.code,
          name: e.name,
          type: e.type,
          lastInspectionDate: e.lastInspectionDate?.toISOString() ?? null,
          nextInspectionDate: e.nextInspectionDate!.toISOString(),
          daysUntilDue: days,
          status,
        }
      })
      .sort((a, b) => (a.daysUntilDue ?? 999) - (b.daysUntilDue ?? 999))
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('equipment')
    .select('*')
    .not('next_inspection_date', 'is', null)

  const today = new Date()
  return (data ?? []).map((e: any) => {
    const days = e.next_inspection_date ? Math.floor((new Date(e.next_inspection_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null
    let status: 'OVERDUE' | 'DUE_SOON' | 'OK' = 'OK'
    if (days !== null && days < 0) status = 'OVERDUE'
    else if (days !== null && days <= 30) status = 'DUE_SOON'
    return {
      id: e.id,
      code: e.code,
      name: e.name,
      type: e.type,
      lastInspectionDate: e.last_inspection_date ?? null,
      nextInspectionDate: e.next_inspection_date,
      daysUntilDue: days,
      status,
    }
  }).sort((a: any, b: any) => (a.daysUntilDue ?? 999) - (b.daysUntilDue ?? 999))
}

// =====================================================
// MAINTENANCE LOG
// =====================================================

export async function getMaintenanceLogs(equipmentId?: string) {
  await requireAuth()

  if (isDemoMode()) {
    return db.maintenanceLog.findMany({
      where: equipmentId ? { equipmentId } : {},
      orderBy: { performedAt: 'desc' },
    })
  }

  const supabase = await createSupabaseClient()
  let query = supabase.from('maintenance_log').select('*').order('performed_at', { ascending: false })
  if (equipmentId) query = query.eq('equipment_id', equipmentId)
  const { data } = await query
  return (data ?? []).map((m: any) => ({
    id: m.id,
    equipmentId: m.equipment_id,
    equipmentCode: m.equipment_code,
    equipmentName: m.equipment_name,
    maintenanceType: m.maintenance_type,
    description: m.description,
    performedBy: m.performed_by,
    performedByCardId: m.performed_by_card_id,
    cost: m.cost,
    durationHours: m.duration_hours,
    operatingHoursAtService: m.operating_hours_at_service,
    certificateNumber: m.certificate_number,
    partsReplaced: m.parts_replaced,
    nextDueHours: m.next_due_hours,
    nextDueDate: m.next_due_date,
    status: m.status,
    performedAt: new Date(m.performed_at),
    createdAt: new Date(m.created_at),
    updatedAt: new Date(m.updated_at),
  }))
}

export async function createMaintenanceLog(params: {
  equipmentId: string
  maintenanceType: 'PREVENTIVE' | 'CORRECTIVE' | 'INSPECTION' | 'OVERHAUL'
  description: string
  performedBy?: string
  performedByCardId?: string
  cost?: number
  durationHours?: number
  operatingHoursAtService?: number
  certificateNumber?: string
  partsReplaced?: string
  nextDueHours?: number
  nextDueDate?: string
  status?: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
}) {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    const equipment = await db.equipment.findUnique({ where: { id: params.equipmentId } })
    if (!equipment) return { ok: false, error: 'Oprema nije pronađena' }

    const log = await db.maintenanceLog.create({
      data: {
        equipmentId: equipment.id,
        equipmentCode: equipment.code,
        equipmentName: equipment.name,
        maintenanceType: params.maintenanceType,
        description: params.description,
        performedBy: params.performedBy ?? null,
        performedByCardId: params.performedByCardId ?? null,
        cost: params.cost ?? null,
        durationHours: params.durationHours ?? null,
        operatingHoursAtService: params.operatingHoursAtService ?? null,
        certificateNumber: params.certificateNumber ?? null,
        partsReplaced: params.partsReplaced ?? null,
        nextDueHours: params.nextDueHours ?? null,
        nextDueDate: params.nextDueDate ? new Date(params.nextDueDate) : null,
        status: params.status ?? 'COMPLETED',
      },
    })

    // Ako je COMPLETED, ažuriraj equipment last_maintenance_hours i next_due_date
    if (params.status === 'COMPLETED' || !params.status) {
      await db.equipment.update({
        where: { id: equipment.id },
        data: {
          lastMaintenanceHours: params.operatingHoursAtService ?? equipment.lastMaintenanceHours,
          ...(params.nextDueDate ? { nextInspectionDate: new Date(params.nextDueDate) } : {}),
        },
      })
    }

    revalidatePath('/')
    return { ok: true, id: log.id }
  }

  // Supabase
  const supabase = await createSupabaseClient()
  const { data: equipment } = await supabase
    .from('equipment')
    .select('*')
    .eq('id', params.equipmentId)
    .single()

  if (!equipment) return { ok: false, error: 'Oprema nije pronađena' }

  const { data, error } = await supabase.from('maintenance_log').insert({
    equipment_id: equipment.id,
    equipment_code: equipment.code,
    equipment_name: equipment.name,
    maintenance_type: params.maintenanceType,
    description: params.description,
    performed_by: params.performedBy ?? null,
    performed_by_card_id: params.performedByCardId ?? null,
    cost: params.cost ?? null,
    duration_hours: params.durationHours ?? null,
    operating_hours_at_service: params.operatingHoursAtService ?? null,
    certificate_number: params.certificateNumber ?? null,
    parts_replaced: params.partsReplaced ?? null,
    next_due_hours: params.nextDueHours ?? null,
    next_due_date: params.nextDueDate ?? null,
    status: params.status ?? 'COMPLETED',
  }).select().single()

  if (error) throw error

  if (params.status === 'COMPLETED' || !params.status) {
    await supabase.from('equipment').update({
      last_maintenance_hours: params.operatingHoursAtService ?? equipment.last_maintenance_hours,
      ...(params.nextDueDate ? { next_inspection_date: params.nextDueDate } : {}),
    }).eq('id', equipment.id)
  }

  revalidatePath('/')
  return { ok: true, id: data?.id }
}

// =====================================================
// PHOTO EVIDENCE
// =====================================================

export async function addPhotoToDamage(params: {
  damageReportId: string
  equipmentId: string
  photoData: string  // base64
  photoType?: string
  caption?: string
  takenByCardId?: string
  takenByName?: string
}) {
  await requireAuth()

  if (isDemoMode()) {
    const photo = await db.equipmentPhoto.create({
      data: {
        damageReportId: params.damageReportId,
        equipmentId: params.equipmentId,
        photoData: params.photoData,
        photoType: params.photoType ?? 'image/jpeg',
        caption: params.caption ?? null,
        takenByCardId: params.takenByCardId ?? null,
        takenByName: params.takenByName ?? null,
      },
    })
    revalidatePath('/')
    return { ok: true, id: photo.id }
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.from('equipment_photos').insert({
    damage_report_id: params.damageReportId,
    equipment_id: params.equipmentId,
    photo_data: params.photoData,
    photo_type: params.photoType ?? 'image/jpeg',
    caption: params.caption ?? null,
    taken_by_card_id: params.takenByCardId ?? null,
    taken_by_name: params.takenByName ?? null,
  }).select().single()

  if (error) throw error
  revalidatePath('/')
  return { ok: true, id: data?.id }
}

export async function getPhotosForDamage(damageReportId: string) {
  await requireAuth()

  if (isDemoMode()) {
    return db.equipmentPhoto.findMany({
      where: { damageReportId },
      orderBy: { takenAt: 'desc' },
    })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('equipment_photos')
    .select('*')
    .eq('damage_report_id', damageReportId)
    .order('taken_at', { ascending: false })

  return (data ?? []).map((p: any) => ({
    id: p.id,
    damageReportId: p.damage_report_id,
    equipmentId: p.equipment_id,
    photoData: p.photo_data,
    photoType: p.photo_type,
    caption: p.caption,
    takenByCardId: p.taken_by_card_id,
    takenByName: p.taken_by_name,
    takenAt: new Date(p.taken_at),
  }))
}

// =====================================================
// QUALIFICATIONS
// =====================================================

export async function getQualifications(employeeCardId?: string) {
  await requireAuth()

  if (isDemoMode()) {
    return db.equipmentQualification.findMany({
      where: employeeCardId ? { employeeCardId } : {},
      orderBy: { createdAt: 'desc' },
    })
  }

  const supabase = await createSupabaseClient()
  let query = supabase.from('equipment_qualifications').select('*').order('created_at', { ascending: false })
  if (employeeCardId) query = query.eq('employee_card_id', employeeCardId)
  const { data } = await query

  return (data ?? []).map((q: any) => ({
    id: q.id,
    employeeId: q.employee_id,
    employeeCardId: q.employee_card_id,
    employeeName: q.employee_name,
    equipmentType: q.equipment_type,
    qualificationLevel: q.qualification_level,
    trainedAt: q.trained_at ? new Date(q.trained_at) : null,
    validUntil: q.valid_until ? new Date(q.valid_until) : null,
    certifiedBy: q.certified_by,
    certificateNumber: q.certificate_number,
    createdAt: new Date(q.created_at),
  }))
}

export async function checkQualification(employeeCardId: string, equipmentType: string) {
  await requireAuth()

  if (isDemoMode()) {
    // Pronađi employee prvo preko cardId, zatim qualification preko employeeId
    const employee = await db.employee.findUnique({ where: { cardId: employeeCardId } })
    if (!employee) return { qualified: false, reason: 'Nema kvalifikaciju za ovu vrstu opreme' }
    const qual = await db.equipmentQualification.findUnique({
      where: { employeeId_equipmentType: { employeeId: employee.id, equipmentType } },
    })
    if (!qual) return { qualified: false, reason: 'Nema kvalifikaciju za ovu vrstu opreme' }
    if (qual.validUntil && new Date(qual.validUntil) < new Date()) {
      return { qualified: false, reason: 'Kvalifikacija je istekla' }
    }
    return { qualified: true, qualification: qual }
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('equipment_qualifications')
    .select('*')
    .eq('employee_card_id', employeeCardId)
    .eq('equipment_type', equipmentType)
    .single()

  if (!data) return { qualified: false, reason: 'Nema kvalifikaciju za ovu vrstu opreme' }
  if (data.valid_until && new Date(data.valid_until) < new Date()) {
    return { qualified: false, reason: 'Kvalifikacija je istekla' }
  }
  return { qualified: true, qualification: data }
}

export async function createQualification(params: {
  employeeCardId: string
  employeeName: string
  equipmentType: string
  qualificationLevel?: 'OPERATOR' | 'SENIOR' | 'INSTRUCTOR'
  trainedAt?: string
  validUntil?: string
  certifiedBy?: string
  certificateNumber?: string
}) {
  await requireRole(['admin'])

  if (isDemoMode()) {
    // Find or create employee
    const employee = await db.employee.upsert({
      where: { cardId: params.employeeCardId },
      update: { name: params.employeeName },
      create: { cardId: params.employeeCardId, name: params.employeeName },
    })

    const qual = await db.equipmentQualification.create({
      data: {
        employeeId: employee.id,
        employeeCardId: params.employeeCardId,
        employeeName: params.employeeName,
        equipmentType: params.equipmentType,
        qualificationLevel: params.qualificationLevel ?? 'OPERATOR',
        trainedAt: params.trainedAt ? new Date(params.trainedAt) : null,
        validUntil: params.validUntil ? new Date(params.validUntil) : null,
        certifiedBy: params.certifiedBy ?? null,
        certificateNumber: params.certificateNumber ?? null,
      },
    })
    revalidatePath('/')
    return { ok: true, id: qual.id }
  }

  const supabase = await createSupabaseClient()
  const { data: employee } = await supabase
    .from('employees')
    .upsert(
      { card_id: params.employeeCardId, name: params.employeeName },
      { onConflict: 'card_id' }
    )
    .select()
    .single()

  const { data, error } = await supabase.from('equipment_qualifications').insert({
    employee_id: employee?.id ?? null,
    employee_card_id: params.employeeCardId,
    employee_name: params.employeeName,
    equipment_type: params.equipmentType,
    qualification_level: params.qualificationLevel ?? 'OPERATOR',
    trained_at: params.trainedAt ?? null,
    valid_until: params.validUntil ?? null,
    certified_by: params.certifiedBy ?? null,
    certificate_number: params.certificateNumber ?? null,
  }).select().single()

  if (error) throw error
  revalidatePath('/')
  return { ok: true, id: data?.id }
}

// =====================================================
// WEBHOOKS
// =====================================================

export async function getWebhooks() {
  await requireRole(['admin'])

  if (isDemoMode()) {
    return db.webhookSetting.findMany({ orderBy: { createdAt: 'desc' } })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('webhook_settings').select('*').order('created_at', { ascending: false })
  return (data ?? []).map((w: any) => ({
    id: w.id,
    name: w.name,
    webhookUrl: w.webhook_url,
    webhookType: w.webhook_type,
    enabled: w.enabled,
    triggerCriticalDamage: w.trigger_critical_damage,
    triggerDamageResolved: w.trigger_damage_resolved,
    triggerOutOfService: w.trigger_out_of_service,
    triggerInspectionOverdue: w.trigger_inspection_overdue,
    createdAt: new Date(w.created_at),
    updatedAt: new Date(w.updated_at),
  }))
}

export async function createWebhook(params: {
  name: string
  webhookUrl: string
  webhookType?: 'SLACK' | 'TEAMS' | 'GENERIC' | 'EMAIL'
  enabled?: boolean
  triggerCriticalDamage?: boolean
  triggerDamageResolved?: boolean
  triggerOutOfService?: boolean
  triggerInspectionOverdue?: boolean
}) {
  await requireRole(['admin'])

  if (isDemoMode()) {
    const w = await db.webhookSetting.create({
      data: {
        name: params.name,
        webhookUrl: params.webhookUrl,
        webhookType: params.webhookType ?? 'SLACK',
        enabled: params.enabled ?? true,
        triggerCriticalDamage: params.triggerCriticalDamage ?? true,
        triggerDamageResolved: params.triggerDamageResolved ?? false,
        triggerOutOfService: params.triggerOutOfService ?? true,
        triggerInspectionOverdue: params.triggerInspectionOverdue ?? true,
      },
    })
    revalidatePath('/')
    return { ok: true, id: w.id }
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.from('webhook_settings').insert({
    name: params.name,
    webhook_url: params.webhookUrl,
    webhook_type: params.webhookType ?? 'SLACK',
    enabled: params.enabled ?? true,
    trigger_critical_damage: params.triggerCriticalDamage ?? true,
    trigger_damage_resolved: params.triggerDamageResolved ?? false,
    trigger_out_of_service: params.triggerOutOfService ?? true,
    trigger_inspection_overdue: params.triggerInspectionOverdue ?? true,
  }).select().single()

  if (error) throw error
  revalidatePath('/')
  return { ok: true, id: data?.id }
}

export async function deleteWebhook(id: string) {
  await requireRole(['admin'])

  if (isDemoMode()) {
    await db.webhookSetting.delete({ where: { id } })
    revalidatePath('/')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  await supabase.from('webhook_settings').delete().eq('id', id)
  revalidatePath('/')
  return { ok: true }
}

// Helper: trigger webhook-ove za događaj
export async function triggerWebhooks(eventType: 'CRITICAL_DAMAGE' | 'DAMAGE_RESOLVED' | 'OUT_OF_SERVICE' | 'INSPECTION_OVERDUE', payload: any) {
  if (isDemoMode()) {
    const webhooks = await db.webhookSetting.findMany({ where: { enabled: true } })
    const matching = webhooks.filter((w) => {
      if (eventType === 'CRITICAL_DAMAGE') return w.triggerCriticalDamage
      if (eventType === 'DAMAGE_RESOLVED') return w.triggerDamageResolved
      if (eventType === 'OUT_OF_SERVICE') return w.triggerOutOfService
      if (eventType === 'INSPECTION_OVERDUE') return w.triggerInspectionOverdue
      return false
    })

    for (const w of matching) {
      try {
        const message = formatWebhookMessage(w.webhookType, eventType, payload)
        await fetch(w.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        })
      } catch (e) {
        console.error('Webhook failed:', e)
      }
    }
    return
  }

  // Supabase
  const supabase = await createSupabaseClient()
  const { data: webhooks } = await supabase.from('webhook_settings').select('*').eq('enabled', true)
  const matching = (webhooks ?? []).filter((w: any) => {
    if (eventType === 'CRITICAL_DAMAGE') return w.trigger_critical_damage
    if (eventType === 'DAMAGE_RESOLVED') return w.trigger_damage_resolved
    if (eventType === 'OUT_OF_SERVICE') return w.trigger_out_of_service
    if (eventType === 'INSPECTION_OVERDUE') return w.trigger_inspection_overdue
    return false
  })

  for (const w of matching) {
    try {
      const message = formatWebhookMessage(w.webhook_type, eventType, payload)
      await fetch(w.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      })
    } catch (e) {
      console.error('Webhook failed:', e)
    }
  }
}

function formatWebhookMessage(webhookType: string, eventType: string, payload: any) {
  const eventLabels: Record<string, string> = {
    CRITICAL_DAMAGE: '🚨 KRITIČNO OŠTEĆENJE',
    DAMAGE_RESOLVED: '✅ Oštećenje riješeno',
    OUT_OF_SERVICE: '⚠️ Oprema van upotrebe',
    INSPECTION_OVERDUE: '📅 Inspekcija istekla',
  }

  const title = eventLabels[eventType] ?? eventType
  const description = payload.description ?? ''
  const equipmentCode = payload.equipmentCode ?? ''
  const equipmentName = payload.equipmentName ?? ''
  const reportedBy = payload.reportedByName ?? ''

  if (webhookType === 'SLACK') {
    return {
      text: `${title}`,
      attachments: [{
        color: eventType === 'CRITICAL_DAMAGE' || eventType === 'OUT_OF_SERVICE' ? 'danger' : 'good',
        fields: [
          { title: 'Oprema', value: `${equipmentCode} - ${equipmentName}`, short: true },
          { title: 'Prijavio', value: reportedBy, short: true },
          { title: 'Detalji', value: description, short: false },
        ],
      }],
    }
  }

  if (webhookType === 'TEAMS') {
    return {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: eventType === 'CRITICAL_DAMAGE' || eventType === 'OUT_OF_SERVICE' ? 'FF0000' : '00FF00',
      summary: title,
      sections: [{
        activityTitle: title,
        facts: [
          { name: 'Oprema', value: `${equipmentCode} - ${equipmentName}` },
          { name: 'Prijavio', value: reportedBy },
          { name: 'Detalji', value: description },
        ],
      }],
    }
  }

  // Generic
  return { event: eventType, title, equipmentCode, equipmentName, reportedBy, description, payload }
}

// =====================================================
// AUDIT LOG
// =====================================================

export async function logAudit(action: string, entityType?: string, entityId?: string, details?: string) {
  try {
    const user = await getCurrentUser()

    if (isDemoMode()) {
      await db.auditLog.create({
        data: {
          userId: user?.id ?? null,
          userEmail: user?.email ?? null,
          userRole: user?.role ?? null,
          action,
          entityType: entityType ?? null,
          entityId: entityId ?? null,
          details: details ?? null,
        },
      })
      return
    }

    const supabase = await createSupabaseClient()
    await supabase.from('audit_log').insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      user_role: user?.role ?? null,
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      details: details ?? null,
    })
  } catch (e) {
    // Audit log ne smije srušiti aplikaciju
    console.error('Audit log failed:', e)
  }
}

export async function getAuditLog(limit = 100) {
  await requireRole(['admin'])

  if (isDemoMode()) {
    return db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map((a: any) => ({
    id: a.id,
    userId: a.user_id,
    userEmail: a.user_email,
    userRole: a.user_role,
    action: a.action,
    entityType: a.entity_type,
    entityId: a.entity_id,
    details: a.details,
    ipAddress: a.ip_address,
    userAgent: a.user_agent,
    createdAt: new Date(a.created_at),
  }))
}

// =====================================================
// APP SETTINGS
// =====================================================

export async function getAppSettings() {
  if (isDemoMode()) {
    const settings = await db.appSetting.findFirst({ where: { id: 1 } })
    if (!settings) {
      return await db.appSetting.create({ data: { id: 1 } })
    }
    return settings
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single()
  return data
}

export async function updateAppSettings(params: {
  airportName?: string
  airportCode?: string
  requirePhotoForDamage?: boolean
  requireQualificationForCheckout?: boolean
  enableWebhookNotifications?: boolean
  inspectionReminderDays?: number
}) {
  await requireRole(['admin'])

  if (isDemoMode()) {
    await db.appSetting.upsert({
      where: { id: 1 },
      update: params,
      create: { id: 1, ...params },
    })
    revalidatePath('/')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const update: Record<string, unknown> = {}
  if (params.airportName !== undefined) update.airport_name = params.airportName
  if (params.airportCode !== undefined) update.airport_code = params.airportCode
  if (params.requirePhotoForDamage !== undefined) update.require_photo_for_damage = params.requirePhotoForDamage
  if (params.requireQualificationForCheckout !== undefined) update.require_qualification_for_checkout = params.requireQualificationForCheckout
  if (params.enableWebhookNotifications !== undefined) update.enable_webhook_notifications = params.enableWebhookNotifications
  if (params.inspectionReminderDays !== undefined) update.inspection_reminder_days = params.inspectionReminderDays

  await supabase.from('app_settings').upsert({ id: 1, ...update })
  revalidatePath('/')
  return { ok: true }
}

// =====================================================
// EXPORT CSV
// =====================================================

export async function exportEquipmentCSV(): Promise<string> {
  await requireAuth()

  if (isDemoMode()) {
    const equipment = await db.equipment.findMany({ orderBy: { code: 'asc' } })
    const headers = ['Code', 'Name', 'Type', 'Serial Number', 'Location', 'Status', 'Notes', 'Last Inspection', 'Next Inspection', 'Operating Hours']
    const rows = equipment.map((e) => [
      e.code,
      e.name,
      e.type,
      e.serialNumber ?? '',
      e.location,
      e.status,
      (e.notes ?? '').replace(/,/g, ';').replace(/\n/g, ' '),
      e.lastInspectionDate ? e.lastInspectionDate.toISOString().slice(0, 10) : '',
      e.nextInspectionDate ? e.nextInspectionDate.toISOString().slice(0, 10) : '',
      e.totalOperatingHours?.toString() ?? '0',
    ])
    return [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('equipment').select('*').order('code', { ascending: true })
  const headers = ['Code', 'Name', 'Type', 'Serial Number', 'Location', 'Status', 'Notes', 'Last Inspection', 'Next Inspection', 'Operating Hours']
  const rows = (data ?? []).map((e: any) => [
    e.code,
    e.name,
    e.type,
    e.serial_number ?? '',
    e.location,
    e.status,
    (e.notes ?? '').replace(/,/g, ';').replace(/\n/g, ' '),
    e.last_inspection_date ?? '',
    e.next_inspection_date ?? '',
    e.total_operating_hours?.toString() ?? '0',
  ])
  return [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
}

export async function exportActivityCSV(): Promise<string> {
  await requireAuth()

  if (isDemoMode()) {
    const assignments = await db.assignment.findMany({ orderBy: { timestamp: 'desc' } })
    const headers = ['Timestamp', 'Action', 'Equipment Code', 'Equipment Name', 'Employee Card ID', 'Employee Name', 'Inspection Result', 'Notes']
    const rows = assignments.map((a) => [
      a.timestamp.toISOString(),
      a.action,
      a.equipmentCode,
      a.equipmentName,
      a.employeeCardId,
      a.employeeName,
      a.inspectionResult,
      (a.inspectionNotes ?? '').replace(/,/g, ';').replace(/\n/g, ' '),
    ])
    return [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('assignments').select('*').order('timestamp', { ascending: false })
  const headers = ['Timestamp', 'Action', 'Equipment Code', 'Equipment Name', 'Employee Card ID', 'Employee Name', 'Inspection Result', 'Notes']
  const rows = (data ?? []).map((a: any) => [
    a.timestamp,
    a.action,
    a.equipment_code,
    a.equipment_name,
    a.employee_card_id,
    a.employee_name,
    a.inspection_result,
    (a.inspection_notes ?? '').replace(/,/g, ';').replace(/\n/g, ' '),
  ])
  return [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
}

export async function exportDamagesCSV(): Promise<string> {
  await requireAuth()

  if (isDemoMode()) {
    const damages = await db.damageReport.findMany({ orderBy: { createdAt: 'desc' } })
    const headers = ['Created At', 'Equipment Code', 'Equipment Name', 'Severity', 'Status', 'Description', 'Reported By', 'Resolved At', 'Resolution', 'Root Cause']
    const rows = damages.map((d) => [
      d.createdAt.toISOString(),
      d.equipmentCode,
      d.equipmentName,
      d.severity,
      d.status,
      d.description.replace(/,/g, ';').replace(/\n/g, ' '),
      d.reportedByName,
      d.resolvedAt ? d.resolvedAt.toISOString() : '',
      (d.resolution ?? '').replace(/,/g, ';').replace(/\n/g, ' '),
      (d.rootCause ?? '').replace(/,/g, ';').replace(/\n/g, ' '),
    ])
    return [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('damage_reports').select('*').order('created_at', { ascending: false })
  const headers = ['Created At', 'Equipment Code', 'Equipment Name', 'Severity', 'Status', 'Description', 'Reported By', 'Resolved At', 'Resolution', 'Root Cause']
  const rows = (data ?? []).map((d: any) => [
    d.created_at,
    d.equipment_code,
    d.equipment_name,
    d.severity,
    d.status,
    (d.description ?? '').replace(/,/g, ';').replace(/\n/g, ' '),
    d.reported_by_name,
    d.resolved_at ?? '',
    (d.resolution ?? '').replace(/,/g, ';').replace(/\n/g, ' '),
    (d.root_cause ?? '').replace(/,/g, ';').replace(/\n/g, ' '),
  ])
  return [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
}

// =====================================================
// BULK IMPORT
// =====================================================

export async function bulkImportEquipment(items: Array<{
  code: string
  name: string
  type: string
  serialNumber?: string
  location: string
}>) {
  await requireRole(['admin'])

  let created = 0
  let skipped = 0
  const errors: string[] = []

  for (const item of items) {
    try {
      if (isDemoMode()) {
        const existing = await db.equipment.findUnique({ where: { code: item.code } })
        if (existing) {
          skipped++
          continue
        }
        await db.equipment.create({
          data: {
            code: item.code,
            name: item.name,
            type: item.type,
            serialNumber: item.serialNumber ?? null,
            location: item.location,
            status: 'AVAILABLE',
          },
        })
        created++
      } else {
        const supabase = await createSupabaseClient()
        const { error } = await supabase.from('equipment').insert({
          code: item.code,
          name: item.name,
          type: item.type,
          serial_number: item.serialNumber ?? null,
          location: item.location,
          status: 'AVAILABLE',
        })
        if (error) {
          if (error.code === '23505') {
            skipped++
          } else {
            errors.push(`${item.code}: ${error.message}`)
          }
        } else {
          created++
        }
      }
    } catch (e: any) {
      errors.push(`${item.code}: ${e?.message ?? e}`)
    }
  }

  revalidatePath('/')
  return { ok: true, created, skipped, errors }
}
