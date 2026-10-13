'use server'

// ADR.OPS.C.007 Compliance Server Actions
// Vehicle Fitness Certificate + Maintenance Schedule + Daily Inspection

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { DAILY_INSPECTION_CHECKLIST } from '@/lib/constants-export'
import { parseRestrictions, serializeRestrictions } from '@/lib/checklist-evaluation'

async function requireRole(roles: Array<'operator' | 'engineer' | 'admin'>): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  if (!roles.includes(user.role)) {
    throw new Error(`Nemate dozvolu. Potrebna rola: ${roles.join(' ili ')}`)
  }
  return user
}

// =====================================================
// VEHICLE FITNESS CERTIFICATE (ADR.OPS.C.007(a))
// =====================================================

export async function calculateVehicleFitness(equipmentId: string) {
  // Javna funkcija - može se pozvati i bez auth (nakon check-out/check-in)

  if (isDemoMode()) {
    const equipment = await db.equipment.findUnique({ where: { id: equipmentId } })
    if (!equipment) return { fitness: 'UNFIT', reason: 'Oprema nije pronađena' }

    let fitness = 'FIT'
    let reasons: string[] = []

    // Provjeri status
    if (equipment.status === 'OUT_OF_SERVICE') {
      fitness = 'UNFIT'
      reasons.push('Status: Neispravno')
    } else if (equipment.status === 'MAINTENANCE') {
      fitness = 'UNFIT'
      reasons.push('Status: Na održavanju')
    }

    // Provjeri inspekcije
    if (equipment.nextInspectionDate && new Date(equipment.nextInspectionDate) < new Date()) {
      fitness = fitness === 'FIT' ? 'CONDITIONAL' : fitness
      reasons.push('Inspekcija istekla')
    }

    // Provjeri otvorena oštećenja
    const openDamages = await db.damageReport.count({
      where: { equipmentId, status: { not: 'RESOLVED' } },
    })
    if (openDamages > 0) {
      fitness = fitness === 'FIT' ? 'CONDITIONAL' : fitness
      reasons.push(`${openDamages} otvorenih oštećenja`)
    }

    // Provjeri maintenance interval
    const hoursSinceMaintenance = equipment.totalOperatingHours - equipment.lastMaintenanceHours
    if (hoursSinceMaintenance > equipment.maintenanceIntervalHours) {
      fitness = fitness === 'FIT' ? 'CONDITIONAL' : fitness
      reasons.push(`Prekoračen interval održavanja (${hoursSinceMaintenance}h / ${equipment.maintenanceIntervalHours}h)`)
    }

    // Ažuriraj equipment
    await db.equipment.update({
      where: { id: equipmentId },
      data: {
        fitnessStatus: fitness,
        fitnessCalculatedAt: new Date(),
        fitnessReason: reasons.length > 0 ? reasons.join('; ') : null,
      },
    })

    return { fitness, reason: reasons.join('; ') || 'Sve u redu' }
  }

  // Supabase
  const supabase = await createSupabaseClient()
  const { data: equipment } = await supabase.from('equipment').select('*').eq('id', equipmentId).single()
  if (!equipment) return { fitness: 'UNFIT', reason: 'Oprema nije pronađena' }

  let fitness = 'FIT'
  let reasons: string[] = []

  if (equipment.status === 'OUT_OF_SERVICE') {
    fitness = 'UNFIT'
    reasons.push('Status: Neispravno')
  } else if (equipment.status === 'MAINTENANCE') {
    fitness = 'UNFIT'
    reasons.push('Status: Na održavanju')
  }

  if (equipment.next_inspection_date && new Date(equipment.next_inspection_date) < new Date()) {
    fitness = fitness === 'FIT' ? 'CONDITIONAL' : fitness
    reasons.push('Inspekcija istekla')
  }

  const { count: openDamages } = await supabase
    .from('damage_reports')
    .select('*', { count: 'exact', head: true })
    .eq('equipment_id', equipmentId)
    .neq('status', 'RESOLVED')

  if ((openDamages ?? 0) > 0) {
    fitness = fitness === 'FIT' ? 'CONDITIONAL' : fitness
    reasons.push(`${openDamages} otvorenih oštećenja`)
  }

  const hoursSinceMaintenance = (equipment.total_operating_hours ?? 0) - (equipment.last_maintenance_hours ?? 0)
  if (hoursSinceMaintenance > (equipment.maintenance_interval_hours ?? 500)) {
    fitness = fitness === 'FIT' ? 'CONDITIONAL' : fitness
    reasons.push(`Prekoračen interval održavanja (${Math.round(hoursSinceMaintenance)}h / ${equipment.maintenance_interval_hours}h)`)
  }

  await supabase.from('equipment').update({
    fitness_status: fitness,
    fitness_calculated_at: new Date().toISOString(),
    fitness_reason: reasons.length > 0 ? reasons.join('; ') : null,
  }).eq('id', equipmentId)

  return { fitness, reason: reasons.join('; ') || 'Sve u redu' }
}

// =====================================================
// MAINTENANCE SCHEDULE (ADR.OPS.C.007(b))
// =====================================================

export async function getMaintenanceSchedule() {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    return db.maintenanceSchedule.findMany({
      orderBy: [{ status: 'asc' }, { priority: 'asc' }],
    })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('maintenance_schedule')
    .select('*')
    .order('status', { ascending: true })
    .order('priority', { ascending: true })

  return (data ?? []).map((m: any) => ({
    id: m.id,
    equipmentId: m.equipment_id,
    equipmentCode: m.equipment_code,
    equipmentName: m.equipment_name,
    maintenanceType: m.maintenance_type,
    title: m.title,
    description: m.description,
    triggerHours: m.trigger_hours,
    triggerDate: m.trigger_date ? new Date(m.trigger_date) : null,
    triggerInterval: m.trigger_interval,
    status: m.status,
    priority: m.priority,
    completedAt: m.completed_at ? new Date(m.completed_at) : null,
    completedBy: m.completed_by,
    completionNotes: m.completion_notes,
    actualHours: m.actual_hours,
    autoGenerated: m.auto_generated,
    createdAt: new Date(m.created_at),
    updatedAt: new Date(m.updated_at),
  }))
}

export async function generateMaintenanceScheduleForEquipment(equipmentId: string) {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    const equipment = await db.equipment.findUnique({ where: { id: equipmentId } })
    if (!equipment) return { ok: false, error: 'Oprema nije pronađena' }

    // Generiši preventivno održavanje na osnovu intervala
    const existing = await db.maintenanceSchedule.findFirst({
      where: { equipmentId, maintenanceType: 'PREVENTIVE', status: { in: ['SCHEDULED', 'DUE'] } },
    })

    if (!existing) {
      await db.maintenanceSchedule.create({
        data: {
          equipmentId: equipment.id,
          equipmentCode: equipment.code,
          equipmentName: equipment.name,
          maintenanceType: 'PREVENTIVE',
          title: `Preventivno održavanje (${equipment.maintenanceIntervalHours}h)`,
          description: 'Zamjena ulja, filtera i opća inspekcija',
          triggerHours: equipment.lastMaintenanceHours + equipment.maintenanceIntervalHours,
          triggerInterval: equipment.maintenanceIntervalHours,
          status: 'SCHEDULED',
          priority: 'MEDIUM',
          autoGenerated: true,
        },
      })
    }

    // Generiši godišnji pregled ako ne postoji
    const annual = await db.maintenanceSchedule.findFirst({
      where: { equipmentId, maintenanceType: 'ANNUAL', status: { in: ['SCHEDULED', 'DUE'] } },
    })

    if (!annual && equipment.nextInspectionDate) {
      await db.maintenanceSchedule.create({
        data: {
          equipmentId: equipment.id,
          equipmentCode: equipment.code,
          equipmentName: equipment.name,
          maintenanceType: 'ANNUAL',
          title: 'Godišnji tehnički pregled',
          description: 'Kompletna godišnja inspekcija vozila',
          triggerDate: equipment.nextInspectionDate,
          status: 'SCHEDULED',
          priority: 'HIGH',
          autoGenerated: true,
        },
      })
    }

    revalidatePath('/dashboard')
    return { ok: true }
  }

  // Supabase
  const supabase = await createSupabaseClient()
  const { data: equipment } = await supabase.from('equipment').select('*').eq('id', equipmentId).single()
  if (!equipment) return { ok: false, error: 'Oprema nije pronađena' }

  const { data: existing } = await supabase
    .from('maintenance_schedule')
    .select('id')
    .eq('equipment_id', equipmentId)
    .eq('maintenance_type', 'PREVENTIVE')
    .in('status', ['SCHEDULED', 'DUE'])

  if (!existing || existing.length === 0) {
    await supabase.from('maintenance_schedule').insert({
      equipment_id: equipment.id,
      equipment_code: equipment.code,
      equipment_name: equipment.name,
      maintenance_type: 'PREVENTIVE',
      title: `Preventivno održavanje (${equipment.maintenance_interval_hours}h)`,
      description: 'Zamjena ulja, filtera i opća inspekcija',
      trigger_hours: (equipment.last_maintenance_hours ?? 0) + (equipment.maintenance_interval_hours ?? 500),
      trigger_interval: equipment.maintenance_interval_hours ?? 500,
      status: 'SCHEDULED',
      priority: 'MEDIUM',
      auto_generated: true,
    })
  }

  revalidatePath('/dashboard')
  return { ok: true }
}

export async function completeMaintenanceTask(taskId: string, completionNotes: string, actualHours?: number) {
  await requireRole(['engineer', 'admin'])
  const user = await getCurrentUser()

  if (isDemoMode()) {
    await db.maintenanceSchedule.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completedBy: user?.full_name ?? 'Unknown',
        completionNotes,
        actualHours: actualHours ?? null,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  await supabase.from('maintenance_schedule').update({
    status: 'COMPLETED',
    completed_at: new Date().toISOString(),
    completed_by: user?.full_name ?? 'Unknown',
    completion_notes: completionNotes,
    actual_hours: actualHours ?? null,
  }).eq('id', taskId)

  revalidatePath('/dashboard')
  return { ok: true }
}

// =====================================================
// DAILY INSPECTION (ADR.OPS.C.007(c))
// =====================================================

// Za dnevni pregled po službama - svako sredstvo sa statusom da li je
// VEĆ pregledano danas (koristi dashboard "Dnevni pregled" prikaz i
// worker daily-check ekran da zna šta je preskočiti). Javna funkcija -
// worker kiosk je poziva bez logina.
export interface DailyInspectionStatusRow {
  id: string
  code: string
  name: string
  type: string
  department: string | null
  status: string
  inspection: { id: string; result: string; inspectorName: string; inspectionDate: Date; shift: string } | null
}

export async function getDailyInspectionStatus(dateStr?: string): Promise<DailyInspectionStatusRow[]> {
  const date = dateStr ?? new Date().toISOString().slice(0, 10)
  const startOfDay = `${date}T00:00:00.000Z`
  const endOfDay = `${date}T23:59:59.999Z`

  if (isDemoMode()) {
    const equipment = await db.equipment.findMany({ orderBy: [{ department: 'asc' }, { type: 'asc' }, { code: 'asc' }] })
    const inspections = await db.dailyInspection.findMany({
      where: { inspectionDate: { gte: new Date(startOfDay), lte: new Date(endOfDay) } },
      orderBy: { inspectionDate: 'desc' },
    })
    const byEquipment = new Map<string, (typeof inspections)[number]>()
    for (const insp of inspections) {
      if (!byEquipment.has(insp.equipmentId)) byEquipment.set(insp.equipmentId, insp)
    }
    return equipment.map((e) => {
      const insp = byEquipment.get(e.id)
      return {
        id: e.id, code: e.code, name: e.name, type: e.type, department: e.department, status: e.status,
        inspection: insp ? { id: insp.id, result: insp.result, inspectorName: insp.inspectorName, inspectionDate: insp.inspectionDate, shift: insp.shift } : null,
      }
    })
  }

  const supabase = await createSupabaseClient()
  const [{ data: equipment }, { data: inspections }] = await Promise.all([
    supabase.from('equipment').select('*').order('department').order('type').order('code'),
    supabase.from('daily_inspections').select('*').gte('inspection_date', startOfDay).lte('inspection_date', endOfDay).order('inspection_date', { ascending: false }),
  ])
  const byEquipment = new Map<string, any>()
  for (const insp of inspections ?? []) {
    if (!byEquipment.has(insp.equipment_id)) byEquipment.set(insp.equipment_id, insp)
  }
  return (equipment ?? []).map((e: any) => {
    const insp = byEquipment.get(e.id)
    return {
      id: e.id, code: e.code, name: e.name, type: e.type, department: e.department, status: e.status,
      inspection: insp ? { id: insp.id, result: insp.result, inspectorName: insp.inspector_name, inspectionDate: new Date(insp.inspection_date), shift: insp.shift } : null,
    }
  })
}

export async function getDailyInspections(equipmentId?: string, limit = 50) {
  if (isDemoMode()) {
    return db.dailyInspection.findMany({
      where: equipmentId ? { equipmentId } : {},
      orderBy: { inspectionDate: 'desc' },
      take: limit,
    })
  }

  const supabase = await createSupabaseClient()
  let query = supabase.from('daily_inspections').select('*').order('inspection_date', { ascending: false }).limit(limit)
  if (equipmentId) query = query.eq('equipment_id', equipmentId)
  const { data } = await query

  return (data ?? []).map((d: any) => ({
    id: d.id,
    equipmentId: d.equipment_id,
    equipmentCode: d.equipment_code,
    equipmentName: d.equipment_name,
    inspectorCardId: d.inspector_card_id,
    inspectorName: d.inspector_name,
    inspectionDate: new Date(d.inspection_date),
    shift: d.shift,
    checklistJson: d.checklist_json,
    result: d.result,
    notes: d.notes,
    issuesFound: d.issues_found,
    issuesJson: d.issues_json,
    createdAt: new Date(d.created_at),
  }))
}

export async function createDailyInspection(params: {
  equipmentCode: string
  inspectorCardId: string
  inspectorName: string
  shift: 'MORNING' | 'AFTERNOON' | 'NIGHT'
  checklist: Array<{ id: string; label: string; passed: boolean }>
  notes?: string
}): Promise<{ ok: boolean; error?: string; id?: string; result?: string; blocking?: number; restrictive?: number; damageReports?: number }> {
  // Javna funkcija - radnici mogu kreirati daily inspection bez login-a.
  // Težina stavki, kategorija i ograničenja uzimaju se SA SERVERA (DAILY_INSPECTION_CHECKLIST),
  // nikad od klijenta - klijent šalje samo id + passed.
  const defs = new Map(DAILY_INSPECTION_CHECKLIST.map((d) => [d.id, d]))
  const checklist = params.checklist.map((c) => {
    const d = defs.get(c.id)
    return {
      id: c.id,
      label: d?.label ?? c.label,
      passed: c.passed === true,
      severity: d?.severity ?? 'MINOR',
      category: d?.category ?? 'OPSTE',
      damageSeverity: d?.damageSeverity,
      restrictionCode: d?.restrictionCode,
      restrictionLabel: d?.restrictionLabel,
    }
  })

  if (isDemoMode()) {
    const equipment = await db.equipment.findUnique({ where: { code: params.equipmentCode } })
    if (!equipment) return { ok: false, error: 'Oprema nije pronađena' }

    const failedItems = checklist.filter((c) => !c.passed)
    const blocking = failedItems.filter((c) => c.severity === 'BLOCKING')
    const restrictive = failedItems.filter((c) => c.severity === 'RESTRICTIVE')
    const result = blocking.length > 0 ? 'UNFIT' : failedItems.length > 0 ? 'CONDITIONAL' : 'FIT'

    const inspection = await db.dailyInspection.create({
      data: {
        equipmentId: equipment.id,
        equipmentCode: equipment.code,
        equipmentName: equipment.name,
        inspectorCardId: params.inspectorCardId,
        inspectorName: params.inspectorName,
        shift: params.shift,
        checklistJson: JSON.stringify(checklist),
        result,
        notes: params.notes ?? null,
        issuesFound: failedItems.length,
        issuesJson: JSON.stringify(failedItems),
      },
    })

    // Prijava kvara za svaku neispravnu stavku (bez dupliranja otvorene prijave iste stavke)
    let created = 0
    for (const item of failedItems) {
      const source = `daily:${item.id}`
      const open = await db.damageReport.findFirst({ where: { equipmentId: equipment.id, sourceItem: source, status: { not: 'RESOLVED' } } })
      if (open) continue
      await db.damageReport.create({
        data: {
          equipmentId: equipment.id,
          equipmentCode: equipment.code,
          equipmentName: equipment.name,
          reportedByCardId: params.inspectorCardId,
          reportedByName: params.inspectorName,
          severity: item.severity === 'BLOCKING' ? (item.damageSeverity ?? 'MAJOR') : 'MINOR',
          description: `Dnevni pregled: neispravno - ${item.label}${item.severity === 'RESTRICTIVE' ? ` (ograničenje: ${item.restrictionLabel ?? ''})` : ''}${params.notes?.trim() ? `. Napomena: ${params.notes.trim()}` : ''}`,
          status: 'OPEN',
          category: item.category,
          restrictionCode: item.severity === 'RESTRICTIVE' ? (item.restrictionCode ?? item.id.toUpperCase()) : null,
          restrictionLabel: item.severity === 'RESTRICTIVE' ? (item.restrictionLabel ?? 'Ograničena upotreba') : null,
          sourceItem: source,
        },
      })
      created++
    }

    // Ograničenja = ograničenja iz zaduženja + ograničenja svih otvorenih prijava
    const openRestrictive = await db.damageReport.findMany({
      where: { equipmentId: equipment.id, status: { not: 'RESOLVED' }, restrictionCode: { not: null } },
    })
    const flags = openRestrictive.map((d) => ({ code: d.restrictionCode, label: d.restrictionLabel ?? d.restrictionCode, source: d.sourceItem ?? 'damage', since: d.createdAt.toISOString(), damageId: d.id }))
    const kept = parseRestrictions(equipment.activeRestrictions).filter((f: any) => !f.damageId)

    await db.equipment.update({
      where: { id: equipment.id },
      data: {
        fitnessStatus: result,
        fitnessCalculatedAt: new Date(),
        fitnessReason: result === 'UNFIT'
          ? `Dnevni pregled: neispravno (${blocking.length} blokirajućih stavki)`
          : result === 'CONDITIONAL' ? (restrictive.length > 0 ? 'Dnevni pregled: ispravno sa ograničenjem' : 'Dnevni pregled: manji nedostaci') : null,
        ...(result === 'UNFIT' && equipment.status !== 'ASSIGNED' ? { status: 'OUT_OF_SERVICE', notes: `Dnevni pregled ${new Date().toISOString().slice(0, 10)} (${params.inspectorName}): sredstvo neispravno - vidi prijave kvarova` } : {}),
        activeRestrictions: serializeRestrictions([...kept, ...flags] as any),
      },
    })

    revalidatePath('/dashboard')
    revalidatePath('/')
    return { ok: true, id: inspection.id, result, blocking: blocking.length, restrictive: restrictive.length, damageReports: created }
  }

  // Supabase
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.rpc('fn_create_daily_inspection', {
    p_equipment_code: params.equipmentCode,
    p_inspector_card_id: params.inspectorCardId,
    p_inspector_name: params.inspectorName,
    p_shift: params.shift,
    p_checklist: checklist,
    p_notes: params.notes ?? null,
  })

  if (error) throw error
  const rpcResult = data as { ok: boolean; error?: string; id?: string; result?: string; blocking?: number; restrictive?: number; damageReports?: number }
  if (!rpcResult.ok) return { ok: false, error: rpcResult.error ?? 'Greška pri snimanju inspekcije' }

  revalidatePath('/dashboard')
  revalidatePath('/')
  return { ok: true, id: rpcResult.id, result: rpcResult.result, blocking: rpcResult.blocking, restrictive: rpcResult.restrictive, damageReports: rpcResult.damageReports }
}
