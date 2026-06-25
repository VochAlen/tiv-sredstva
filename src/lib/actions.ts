'use server'

// Server Actions za GSE Control
// Dual-mode: Prisma (Demo Mode) ili Supabase (Production)
// Sve mutacije provjeravaju auth i role

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { DEFAULT_CHECKLIST, type ChecklistItem, type InspectionResult } from '@/lib/types'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from "@/lib/supabase/server"

// =====================================================
// AUTH HELPERS
// =====================================================

async function requireAuth(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Morate biti ulogovani za ovu akciju')
  }
  return user
}

async function requireRole(roles: Array<'operator' | 'engineer' | 'admin'>): Promise<AppUser> {
  const user = await requireAuth()
  if (!roles.includes(user.role)) {
    throw new Error(`Nemate dozvolu za ovu akciju. Potrebna rola: ${roles.join(' ili ')}`)
  }
  return user
}

// =====================================================
// SUPABASE FALLBACK HELPERS
// Koriste se kada je isDemoMode() === false
// =====================================================

// Konverzija između snake_case (Supabase) i camelCase (Prisma) tipova
type SupabaseEquipment = {
  id: string
  code: string
  name: string
  type: string
  serial_number: string | null
  location: string
  status: string
  notes: string | null
}

// =====================================================
// QUERY FUNCTIONS (read)
// =====================================================

export async function getAllEquipment() {
  await requireAuth()

  if (isDemoMode()) {
    return db.equipment.findMany({
      orderBy: [{ status: 'asc' }, { code: 'asc' }],
      include: {
        _count: {
          select: {
            damages: { where: { status: { not: 'RESOLVED' } } },
          },
        },
      },
    })
  }

  // Supabase
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .order('status', { ascending: true })
    .order('code', { ascending: true })

  if (error) throw error

  // Za svaki equipment dohvati count otvorenih damages
  const equipmentIds = (data ?? []).map((e: SupabaseEquipment) => e.id)
  let damagesCount: Record<string, number> = {}
  if (equipmentIds.length > 0) {
    const { data: damages } = await supabase
      .from('damage_reports')
      .select('equipment_id')
      .neq('status', 'RESOLVED')
      .in('equipment_id', equipmentIds)
    damagesCount = (damages ?? []).reduce((acc: Record<string, number>, d: { equipment_id: string }) => {
      acc[d.equipment_id] = (acc[d.equipment_id] ?? 0) + 1
      return acc
    }, {})
  }

  return (data ?? []).map((e: SupabaseEquipment) => ({
    id: e.id,
    code: e.code,
    name: e.name,
    type: e.type,
    serialNumber: e.serial_number,
    location: e.location,
    status: e.status,
    notes: e.notes,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { damages: damagesCount[e.id] ?? 0 },
  }))
}

export async function getEquipmentByCode(code: string) {
  // Javna funkcija - može se zvati i iz Worker view-a prije auth
  // ali će akcije koje slijede provjeravati auth

  if (isDemoMode()) {
    return db.equipment.findUnique({
      where: { code },
      include: {
        assignments: {
          orderBy: { timestamp: 'desc' },
          take: 10,
        },
        damages: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    })
  }

  const supabase = await createSupabaseClient()
  const { data: equipment, error } = await supabase
    .from('equipment')
    .select('*')
    .eq('code', code)
    .single()

  if (error || !equipment) return null

  const eq = equipment as SupabaseEquipment

  const [assignmentsRes, damagesRes] = await Promise.all([
    supabase
      .from('assignments')
      .select('*')
      .eq('equipment_id', eq.id)
      .order('timestamp', { ascending: false })
      .limit(10),
    supabase
      .from('damage_reports')
      .select('*')
      .eq('equipment_id', eq.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return {
    id: eq.id,
    code: eq.code,
    name: eq.name,
    type: eq.type,
    serialNumber: eq.serial_number,
    location: eq.location,
    status: eq.status,
    notes: eq.notes,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignments: (assignmentsRes.data ?? []).map((a: any) => ({
      id: a.id,
      equipmentId: a.equipment_id,
      equipmentCode: a.equipment_code,
      equipmentName: a.equipment_name,
      employeeId: a.employee_id,
      employeeCardId: a.employee_card_id,
      employeeName: a.employee_name,
      action: a.action,
      inspectionResult: a.inspection_result,
      inspectionNotes: a.inspection_notes,
      checklistJson: a.checklist_json,
      shift: a.shift,
      damageReportId: a.damage_report_id,
      timestamp: new Date(a.timestamp),
    })),
    damages: (damagesRes.data ?? []).map((d: any) => ({
      id: d.id,
      equipmentId: d.equipment_id,
      equipmentCode: d.equipment_code,
      equipmentName: d.equipment_name,
      reportedByCardId: d.reported_by_card_id,
      reportedByName: d.reported_by_name,
      employeeId: d.employee_id,
      severity: d.severity,
      description: d.description,
      status: d.status,
      resolution: d.resolution,
      resolvedAt: d.resolved_at ? new Date(d.resolved_at) : null,
      createdAt: new Date(d.created_at),
      updatedAt: new Date(d.updated_at),
    })),
  }
}

export async function getActiveAssignments() {
  await requireAuth()

  if (isDemoMode()) {
    const recent = await db.assignment.findMany({
      where: { damageReportId: null },
      orderBy: { timestamp: 'desc' },
      take: 200,
      include: { equipment: true },
    })
    const byEquip = new Map<string, typeof recent[number]>()
    for (const a of recent) {
      if (!byEquip.has(a.equipmentId)) byEquip.set(a.equipmentId, a)
    }
    return Array.from(byEquip.values())
      .filter((a) => a.action === 'CHECK_OUT')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  // Supabase - zadnja akcija po equipmentu je CHECK_OUT i bez damage
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .is('damage_report_id', null)
    .order('timestamp', { ascending: false })
    .limit(200)

  if (error) throw error

  const byEquip = new Map<string, any>()
  for (const a of data ?? []) {
    if (!byEquip.has(a.equipment_id)) byEquip.set(a.equipment_id, a)
  }
  return Array.from(byEquip.values())
    .filter((a: any) => a.action === 'CHECK_OUT')
    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map((a: any) => ({
      id: a.id,
      equipmentId: a.equipment_id,
      equipmentCode: a.equipment_code,
      equipmentName: a.equipment_name,
      employeeId: a.employee_id,
      employeeCardId: a.employee_card_id,
      employeeName: a.employee_name,
      action: a.action,
      inspectionResult: a.inspection_result,
      inspectionNotes: a.inspection_notes,
      checklistJson: a.checklist_json,
      shift: a.shift,
      damageReportId: a.damage_report_id,
      timestamp: new Date(a.timestamp),
    }))
}

export async function getRecentActivity(limit = 50) {
  await requireAuth()

  if (isDemoMode()) {
    return db.assignment.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    })
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data ?? []).map((a: any) => ({
    id: a.id,
    equipmentId: a.equipment_id,
    equipmentCode: a.equipment_code,
    equipmentName: a.equipment_name,
    employeeId: a.employee_id,
    employeeCardId: a.employee_card_id,
    employeeName: a.employee_name,
    action: a.action,
    inspectionResult: a.inspection_result,
    inspectionNotes: a.inspection_notes,
    checklistJson: a.checklist_json,
    shift: a.shift,
    damageReportId: a.damage_report_id,
    timestamp: new Date(a.timestamp),
  }))
}

export async function getOpenDamages() {
  await requireAuth()

  if (isDemoMode()) {
    return db.damageReport.findMany({
      where: { status: { not: 'RESOLVED' } },
      orderBy: { createdAt: 'desc' },
      include: { equipment: true },
    })
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('damage_reports')
    .select('*, equipment:equipment(*)')
    .neq('status', 'RESOLVED')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((d: any) => ({
    id: d.id,
    equipmentId: d.equipment_id,
    equipmentCode: d.equipment_code,
    equipmentName: d.equipment_name,
    reportedByCardId: d.reported_by_card_id,
    reportedByName: d.reported_by_name,
    employeeId: d.employee_id,
    severity: d.severity,
    description: d.description,
    status: d.status,
    resolution: d.resolution,
    resolvedAt: d.resolved_at ? new Date(d.resolved_at) : null,
    createdAt: new Date(d.created_at),
    updatedAt: new Date(d.updated_at),
    equipment: d.equipment
      ? {
          id: d.equipment.id,
          code: d.equipment.code,
          name: d.equipment.name,
          type: d.equipment.type,
          serialNumber: d.equipment.serial_number,
          location: d.equipment.location,
          status: d.equipment.status,
          notes: d.equipment.notes,
        }
      : null,
  }))
}

export async function getAllDamages() {
  await requireAuth()

  if (isDemoMode()) {
    return db.damageReport.findMany({
      orderBy: { createdAt: 'desc' },
      include: { equipment: true },
    })
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('damage_reports')
    .select('*, equipment:equipment(*)')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((d: any) => ({
    id: d.id,
    equipmentId: d.equipment_id,
    equipmentCode: d.equipment_code,
    equipmentName: d.equipment_name,
    reportedByCardId: d.reported_by_card_id,
    reportedByName: d.reported_by_name,
    employeeId: d.employee_id,
    severity: d.severity,
    description: d.description,
    status: d.status,
    resolution: d.resolution,
    resolvedAt: d.resolved_at ? new Date(d.resolved_at) : null,
    createdAt: new Date(d.created_at),
    updatedAt: new Date(d.updated_at),
    equipment: d.equipment
      ? {
          id: d.equipment.id,
          code: d.equipment.code,
          name: d.equipment.name,
          type: d.equipment.type,
          serialNumber: d.equipment.serial_number,
          location: d.equipment.location,
          status: d.equipment.status,
          notes: d.equipment.notes,
        }
      : null,
  }))
}

// =====================================================
// MUTATION: CHECK-OUT (zaduživanje)
// =====================================================

export async function checkOutEquipment(params: {
  equipmentCode: string
  employeeCardId: string
  employeeName: string
  checklist: ChecklistItem[]
  inspectionResult: InspectionResult
  inspectionNotes?: string
  shift?: string
  damageDescription?: string
  damageSeverity?: 'MINOR' | 'MAJOR' | 'CRITICAL'
}) {
  // checkOut je JAVNA akcija - radnici se identifikuju preko PIN-a/ID kartice
  // (ne zahtijeva auth login)

  const {
    equipmentCode,
    employeeCardId,
    employeeName,
    checklist,
    inspectionResult,
    inspectionNotes,
    shift,
    damageDescription,
    damageSeverity = 'MINOR',
  } = params

  if (isDemoMode()) {
    return checkOutPrisma(params)
  }

  // Supabase
  const supabase = await createSupabaseClient()

  const { data: equipment, error: eqError } = await supabase
    .from('equipment')
    .select('*')
    .eq('code', equipmentCode)
    .single()

  if (eqError || !equipment) {
    return { ok: false, error: 'Sredstvo nije pronađeno' }
  }

  if (equipment.status === 'OUT_OF_SERVICE' || equipment.status === 'MAINTENANCE') {
    return {
      ok: false,
      error: `Sredstvo je trenutno u statusu: ${equipment.status}. Zaduživanje nije moguće.`,
    }
  }

  // Upsert employee
  const { data: employee } = await supabase
    .from('employees')
    .upsert(
      { card_id: employeeCardId, name: employeeName },
      { onConflict: 'card_id' }
    )
    .select()
    .single()

  // Ako je pronađeno oštećenje
  let damageReportId: string | null = null
  if (inspectionResult !== 'OK' && damageDescription) {
    const { data: dr, error: drError } = await supabase
      .from('damage_reports')
      .insert({
        equipment_id: equipment.id,
        equipment_code: equipment.code,
        equipment_name: equipment.name,
        reported_by_card_id: employeeCardId,
        reported_by_name: employeeName,
        employee_id: employee?.id ?? null,
        severity: damageSeverity,
        description: damageDescription,
        status: 'OPEN',
      })
      .select()
      .single()

    if (!drError && dr) {
      damageReportId = dr.id
    }

    // Bilo koja prijava oštećenja → OUT_OF_SERVICE
    await supabase
      .from('equipment')
      .update({
        status: 'OUT_OF_SERVICE',
        notes: `Oštećenje prijavljeno ${new Date().toISOString().slice(0, 10)} od ${employeeName}: ${damageDescription.slice(0, 100)}`,
      })
      .eq('id', equipment.id)

    const { error: assignErr1 } = await supabase.from('assignments').insert({
      equipment_id: equipment.id,
      equipment_code: equipment.code,
      equipment_name: equipment.name,
      employee_id: employee?.id ?? null,
      employee_card_id: employeeCardId,
      employee_name: employeeName,
      action: 'CHECK_OUT',
      inspection_result: inspectionResult,
      inspection_notes: inspectionNotes ?? null,
      checklist_json: JSON.stringify(checklist),
      shift: shift ?? null,
      damage_report_id: damageReportId,
    })
    if (assignErr1) {
      console.error('Assignment insert (blocked) failed:', assignErr1)
      return { ok: false, error: 'Greška pri bilježenju zaduženja u bazi' }
    }

    revalidatePath('/')
    return {
      ok: false,
      error: 'Sredstvo ne može biti zaduženo zbog oštećenja. Status promijenjen u OUT_OF_SERVICE.',
      damageReportId,
    }
  }

  // Sve OK - dozvoli zaduživanje
  const { error: eqUpdateErr } = await supabase.from('equipment').update({ status: 'ASSIGNED' }).eq('id', equipment.id)
  if (eqUpdateErr) {
    console.error('Equipment status update failed:', eqUpdateErr)
    return { ok: false, error: 'Greška pri ažuriranju statusa opreme' }
  }

  const { error: assignErr2 } = await supabase.from('assignments').insert({
    equipment_id: equipment.id,
    equipment_code: equipment.code,
    equipment_name: equipment.name,
    employee_id: employee?.id ?? null,
    employee_card_id: employeeCardId,
    employee_name: employeeName,
    action: 'CHECK_OUT',
    inspection_result: inspectionResult,
    inspection_notes: inspectionNotes ?? null,
    checklist_json: JSON.stringify(checklist),
    shift: shift ?? null,
    damage_report_id: damageReportId,
  })
  if (assignErr2) {
    console.error('Assignment insert failed:', assignErr2)
    return { ok: false, error: 'Greška pri bilježenju zaduženja u bazi' }
  }

  revalidatePath('/')
  return { ok: true, damageReportId }
}

// Prisma fallback za Demo Mode
async function checkOutPrisma(params: {
  equipmentCode: string
  employeeCardId: string
  employeeName: string
  checklist: ChecklistItem[]
  inspectionResult: InspectionResult
  inspectionNotes?: string
  shift?: string
  damageDescription?: string
  damageSeverity?: 'MINOR' | 'MAJOR' | 'CRITICAL'
}) {
  const {
    equipmentCode,
    employeeCardId,
    employeeName,
    checklist,
    inspectionResult,
    inspectionNotes,
    shift,
    damageDescription,
    damageSeverity = 'MINOR',
  } = params

  const equipment = await db.equipment.findUnique({ where: { code: equipmentCode } })
  if (!equipment) {
    return { ok: false, error: 'Sredstvo nije pronađeno' }
  }

  if (equipment.status === 'OUT_OF_SERVICE' || equipment.status === 'MAINTENANCE') {
    return {
      ok: false,
      error: `Sredstvo je trenutno u statusu: ${equipment.status}. Zaduživanje nije moguće.`,
    }
  }

  const employee = await db.employee.upsert({
    where: { cardId: employeeCardId },
    update: { name: employeeName },
    create: { cardId: employeeCardId, name: employeeName },
  })

  let damageReportId: string | null = null
  if (inspectionResult !== 'OK' && damageDescription) {
    const dr = await db.damageReport.create({
      data: {
        equipmentId: equipment.id,
        equipmentCode: equipment.code,
        equipmentName: equipment.name,
        reportedByCardId: employeeCardId,
        reportedByName: employeeName,
        employeeId: employee.id,
        severity: damageSeverity,
        description: damageDescription,
        status: 'OPEN',
      },
    })
    damageReportId = dr.id

    await db.equipment.update({
      where: { id: equipment.id },
      data: {
        status: 'OUT_OF_SERVICE',
        notes: `Oštećenje prijavljeno ${new Date().toISOString().slice(0, 10)} od ${employeeName}: ${damageDescription.slice(0, 100)}`,
      },
    })

    await db.assignment.create({
      data: {
        equipmentId: equipment.id,
        equipmentCode: equipment.code,
        equipmentName: equipment.name,
        employeeId: employee.id,
        employeeCardId: employee.cardId,
        employeeName: employee.name,
        action: 'CHECK_OUT',
        inspectionResult,
        inspectionNotes: inspectionNotes ?? null,
        checklistJson: JSON.stringify(checklist),
        shift: shift ?? null,
        damageReportId,
      },
    })

    revalidatePath('/')
    return {
      ok: false,
      error: 'Sredstvo ne može biti zaduženo zbog oštećenja. Status promijenjen u OUT_OF_SERVICE.',
      damageReportId,
    }
  }

  await db.equipment.update({
    where: { id: equipment.id },
    data: { status: 'ASSIGNED' },
  })

  await db.assignment.create({
    data: {
      equipmentId: equipment.id,
      equipmentCode: equipment.code,
      equipmentName: equipment.name,
      employeeId: employee.id,
      employeeCardId: employee.cardId,
      employeeName: employee.name,
      action: 'CHECK_OUT',
      inspectionResult,
      inspectionNotes: inspectionNotes ?? null,
      checklistJson: JSON.stringify(checklist),
      shift: shift ?? null,
      damageReportId,
    },
  })

  revalidatePath('/')
  return { ok: true, damageReportId }
}

// =====================================================
// MUTATION: CHECK-IN (razduživanje)
// =====================================================

export async function checkInEquipment(params: {
  equipmentCode: string
  employeeCardId: string
  employeeName: string
  notes?: string
  foundDamage?: string
  damageSeverity?: 'MINOR' | 'MAJOR' | 'CRITICAL'
}) {
  // checkIn je JAVNA akcija - radnici se identifikuju preko PIN-a/ID kartice

  if (isDemoMode()) {
    return checkInPrisma(params)
  }

  const { equipmentCode, employeeCardId, employeeName, notes, foundDamage, damageSeverity = 'MINOR' } = params

  const supabase = await createSupabaseClient()
  const { data: equipment, error } = await supabase
    .from('equipment')
    .select('*')
    .eq('code', equipmentCode)
    .single()

  if (error || !equipment) return { ok: false, error: 'Sredstvo nije pronađeno' }
  if (equipment.status === 'AVAILABLE') {
    return { ok: false, error: 'Ovo sredstvo je već razduženo.' }
  }

  const { data: employee } = await supabase
    .from('employees')
    .upsert(
      { card_id: employeeCardId, name: employeeName },
      { onConflict: 'card_id' }
    )
    .select()
    .single()

  let damageReportId: string | null = null
  let inspectionResult: InspectionResult = 'OK'

  if (foundDamage && foundDamage.trim().length > 0) {
    const { data: dr } = await supabase
      .from('damage_reports')
      .insert({
        equipment_id: equipment.id,
        equipment_code: equipment.code,
        equipment_name: equipment.name,
        reported_by_card_id: employeeCardId,
        reported_by_name: employeeName,
        employee_id: employee?.id ?? null,
        severity: damageSeverity,
        description: foundDamage,
        status: 'OPEN',
      })
      .select()
      .single()

    if (dr) damageReportId = dr.id
    inspectionResult = damageSeverity === 'CRITICAL' ? 'OUT_OF_SERVICE' : damageSeverity === 'MAJOR' ? 'MAJOR_DAMAGE' : 'MINOR_DAMAGE'

    if (damageSeverity === 'CRITICAL' || damageSeverity === 'MAJOR') {
      await supabase.from('equipment').update({ status: 'OUT_OF_SERVICE' }).eq('id', equipment.id)
    } else {
      await supabase
        .from('equipment')
        .update({
          status: 'AVAILABLE',
          notes: `Manje oštećenje prijavljeno ${new Date().toISOString().slice(0, 10)}`,
        })
        .eq('id', equipment.id)
    }
  } else {
    await supabase.from('equipment').update({ status: 'AVAILABLE', notes: null }).eq('id', equipment.id)
  }

  const { error: checkInAssignErr } = await supabase.from('assignments').insert({
    equipment_id: equipment.id,
    equipment_code: equipment.code,
    equipment_name: equipment.name,
    employee_id: employee?.id ?? null,
    employee_card_id: employeeCardId,
    employee_name: employeeName,
    action: 'CHECK_IN',
    inspection_result: inspectionResult,
    inspection_notes: notes ?? null,
    checklist_json: JSON.stringify(DEFAULT_CHECKLIST.map((i) => ({ ...i, passed: true }))),
    damage_report_id: damageReportId,
  })
  if (checkInAssignErr) {
    console.error('Check-in assignment insert failed:', checkInAssignErr)
    return { ok: false, error: 'Greška pri bilježenju razduživanja u bazi' }
  }

  revalidatePath('/')
  return { ok: true, damageReportId }
}

async function checkInPrisma(params: {
  equipmentCode: string
  employeeCardId: string
  employeeName: string
  notes?: string
  foundDamage?: string
  damageSeverity?: 'MINOR' | 'MAJOR' | 'CRITICAL'
}) {
  const { equipmentCode, employeeCardId, employeeName, notes, foundDamage, damageSeverity = 'MINOR' } = params

  const equipment = await db.equipment.findUnique({ where: { code: equipmentCode } })
  if (!equipment) return { ok: false, error: 'Sredstvo nije pronađeno' }
  if (equipment.status === 'AVAILABLE') {
    return { ok: false, error: 'Ovo sredstvo je već razduženo.' }
  }

  const employee = await db.employee.upsert({
    where: { cardId: employeeCardId },
    update: { name: employeeName },
    create: { cardId: employeeCardId, name: employeeName },
  })

  let damageReportId: string | null = null
  let inspectionResult: InspectionResult = 'OK'

  if (foundDamage && foundDamage.trim().length > 0) {
    const dr = await db.damageReport.create({
      data: {
        equipmentId: equipment.id,
        equipmentCode: equipment.code,
        equipmentName: equipment.name,
        reportedByCardId: employeeCardId,
        reportedByName: employeeName,
        employeeId: employee.id,
        severity: damageSeverity,
        description: foundDamage,
        status: 'OPEN',
      },
    })
    damageReportId = dr.id
    inspectionResult = damageSeverity === 'CRITICAL' ? 'OUT_OF_SERVICE' : damageSeverity === 'MAJOR' ? 'MAJOR_DAMAGE' : 'MINOR_DAMAGE'

    if (damageSeverity === 'CRITICAL' || damageSeverity === 'MAJOR') {
      await db.equipment.update({
        where: { id: equipment.id },
        data: { status: 'OUT_OF_SERVICE' },
      })
    } else {
      await db.equipment.update({
        where: { id: equipment.id },
        data: { status: 'AVAILABLE', notes: `Manje oštećenje prijavljeno ${new Date().toISOString().slice(0, 10)}` },
      })
    }
  } else {
    await db.equipment.update({
      where: { id: equipment.id },
      data: { status: 'AVAILABLE', notes: null },
    })
  }

  await db.assignment.create({
    data: {
      equipmentId: equipment.id,
      equipmentCode: equipment.code,
      equipmentName: equipment.name,
      employeeId: employee.id,
      employeeCardId: employee.cardId,
      employeeName: employee.name,
      action: 'CHECK_IN',
      inspectionResult,
      inspectionNotes: notes ?? null,
      checklistJson: JSON.stringify(DEFAULT_CHECKLIST.map((i) => ({ ...i, passed: true }))),
      damageReportId,
    },
  })

  revalidatePath('/')
  return { ok: true, damageReportId }
}

// =====================================================
// MUTATION: Dashboard - promjena statusa opreme (engineer+)
// =====================================================

export async function updateEquipmentStatus(params: {
  equipmentId: string
  status: 'AVAILABLE' | 'ASSIGNED' | 'OUT_OF_SERVICE' | 'MAINTENANCE'
  notes?: string
}) {
  await requireRole(['engineer', 'admin'])

  const { equipmentId, status, notes } = params

  if (isDemoMode()) {
    await db.equipment.update({
      where: { id: equipmentId },
      data: { status, ...(notes !== undefined ? { notes } : {}) },
    })
    revalidatePath('/')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const update: Record<string, unknown> = { status }
  if (notes !== undefined) update.notes = notes
  const { error } = await supabase.from('equipment').update(update).eq('id', equipmentId)
  if (error) throw error
  revalidatePath('/')
  return { ok: true }
}

// =====================================================
// MUTATION: Edit opreme (admin only)
// =====================================================

export async function updateEquipment(params: {
  equipmentId: string
  name?: string
  type?: string
  location?: string
  serialNumber?: string
  notes?: string
}) {
  await requireRole(['admin'])

  const { equipmentId, ...data } = params

  if (isDemoMode()) {
    await db.equipment.update({
      where: { id: equipmentId },
      data,
    })
    revalidatePath('/')
    return { ok: true }
  }

  // Konverzija camelCase → snake_case za Supabase
  const update: Record<string, unknown> = {}
  if (data.name !== undefined) update.name = data.name
  if (data.type !== undefined) update.type = data.type
  if (data.location !== undefined) update.location = data.location
  if (data.serialNumber !== undefined) update.serial_number = data.serialNumber
  if (data.notes !== undefined) update.notes = data.notes

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('equipment').update(update).eq('id', equipmentId)
  if (error) throw error
  revalidatePath('/')
  return { ok: true }
}

export async function createEquipment(params: {
  code: string
  name: string
  type: string
  serialNumber?: string
  location: string
}) {
  await requireRole(['admin'])

  if (isDemoMode()) {
    const existing = await db.equipment.findUnique({ where: { code: params.code } })
    if (existing) return { ok: false, error: 'Kod već postoji' }

    await db.equipment.create({
      data: {
        code: params.code,
        name: params.name,
        type: params.type,
        serialNumber: params.serialNumber ?? null,
        location: params.location,
        status: 'AVAILABLE',
      },
    })
    revalidatePath('/')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('equipment').insert({
    code: params.code,
    name: params.name,
    type: params.type,
    serial_number: params.serialNumber ?? null,
    location: params.location,
    status: 'AVAILABLE',
  })

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Kod već postoji' }
    throw error
  }
  revalidatePath('/')
  return { ok: true }
}

// =====================================================
// MUTATION: Damage report upravljanje (engineer+)
// =====================================================

export async function resolveDamageReport(params: {
  damageId: string
  resolution: string
  setEquipmentAvailable?: boolean
}) {
  await requireRole(['engineer', 'admin'])

  const { damageId, resolution, setEquipmentAvailable } = params

  if (isDemoMode()) {
    const dr = await db.damageReport.update({
      where: { id: damageId },
      data: {
        status: 'RESOLVED',
        resolution,
        resolvedAt: new Date(),
      },
    })

    if (setEquipmentAvailable) {
      await db.equipment.update({
        where: { id: dr.equipmentId },
        data: {
          status: 'AVAILABLE',
          notes: `Popravljeno ${new Date().toISOString().slice(0, 10)}: ${resolution.slice(0, 100)}`,
        },
      })
    }

    revalidatePath('/')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()

  // Dohvati damage report da znamo equipment_id
  const { data: dr } = await supabase
    .from('damage_reports')
    .select('equipment_id')
    .eq('id', damageId)
    .single()

  await supabase
    .from('damage_reports')
    .update({
      status: 'RESOLVED',
      resolution,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', damageId)

  if (setEquipmentAvailable && dr?.equipment_id) {
    await supabase
      .from('equipment')
      .update({
        status: 'AVAILABLE',
        notes: `Popravljeno ${new Date().toISOString().slice(0, 10)}: ${resolution.slice(0, 100)}`,
      })
      .eq('id', dr.equipment_id)
  }

  revalidatePath('/')
  return { ok: true }
}

export async function updateDamageStatus(params: {
  damageId: string
  status: 'OPEN' | 'IN_REPAIR' | 'RESOLVED'
}) {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    await db.damageReport.update({
      where: { id: params.damageId },
      data: {
        status: params.status,
        ...(params.status === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
      },
    })
    revalidatePath('/')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const update: Record<string, unknown> = { status: params.status }
  if (params.status === 'RESOLVED') {
    update.resolved_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('damage_reports')
    .update(update)
    .eq('id', params.damageId)

  if (error) throw error
  revalidatePath('/')
  return { ok: true }
}
