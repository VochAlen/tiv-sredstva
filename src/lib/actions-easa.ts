'use server'

// EASA Part-145 compliance server actions
// Komponente sa ograničenim vijekom, Service Bulletins, Airworthiness Directives, Shift Handovers

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from 'next/cache'

async function requireRole(roles: Array<'operator' | 'engineer' | 'admin'>): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  if (!roles.includes(user.role)) {
    throw new Error(`Nemate dozvolu. Potrebna rola: ${roles.join(' ili ')}`)
  }
  return user
}

// =====================================================
// EQUIPMENT COMPONENTS (Life-limited parts)
// =====================================================

export async function getComponents(equipmentId?: string) {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    return db.equipmentComponent.findMany({
      where: equipmentId ? { equipmentId } : {},
      orderBy: [{ status: 'asc' }, { componentName: 'asc' }],
    })
  }

  const supabase = await createSupabaseClient()
  let query = supabase.from('equipment_components').select('*').order('status', { ascending: true }).order('component_name', { ascending: true })
  if (equipmentId) query = query.eq('equipment_id', equipmentId)
  const { data } = await query

  return (data ?? []).map((c: any) => ({
    id: c.id,
    equipmentId: c.equipment_id,
    equipmentCode: c.equipment_code,
    componentName: c.component_name,
    componentType: c.component_type,
    serialNumber: c.serial_number,
    manufacturer: c.manufacturer,
    installedAt: c.installed_at ? new Date(c.installed_at) : null,
    installedHours: c.installed_hours,
    lifeLimitHours: c.life_limit_hours,
    lifeLimitCycles: c.life_limit_cycles,
    currentHours: c.current_hours,
    currentCycles: c.current_cycles,
    status: c.status,
    replacedAt: c.replaced_at ? new Date(c.replaced_at) : null,
    replacedBy: c.replaced_by,
    replacementCost: c.replacement_cost,
    notes: c.notes,
    createdAt: new Date(c.created_at),
    updatedAt: new Date(c.updated_at),
  }))
}

export async function createComponent(params: {
  equipmentId: string
  equipmentCode: string
  componentName: string
  componentType: string
  serialNumber?: string
  manufacturer?: string
  installedAt?: string
  installedHours?: number
  lifeLimitHours?: number
  lifeLimitCycles?: number
  currentHours?: number
  currentCycles?: number
  notes?: string
}) {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    const comp = await db.equipmentComponent.create({
      data: {
        equipmentId: params.equipmentId,
        equipmentCode: params.equipmentCode,
        componentName: params.componentName,
        componentType: params.componentType,
        serialNumber: params.serialNumber ?? null,
        manufacturer: params.manufacturer ?? null,
        installedAt: params.installedAt ? new Date(params.installedAt) : null,
        installedHours: params.installedHours ?? 0,
        lifeLimitHours: params.lifeLimitHours ?? null,
        lifeLimitCycles: params.lifeLimitCycles ?? null,
        currentHours: params.currentHours ?? 0,
        currentCycles: params.currentCycles ?? 0,
        notes: params.notes ?? null,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, id: comp.id }
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.from('equipment_components').insert({
    equipment_id: params.equipmentId,
    equipment_code: params.equipmentCode,
    component_name: params.componentName,
    component_type: params.componentType,
    serial_number: params.serialNumber ?? null,
    manufacturer: params.manufacturer ?? null,
    installed_at: params.installedAt ?? null,
    installed_hours: params.installedHours ?? 0,
    life_limit_hours: params.lifeLimitHours ?? null,
    life_limit_cycles: params.lifeLimitCycles ?? null,
    current_hours: params.currentHours ?? 0,
    current_cycles: params.currentCycles ?? 0,
    notes: params.notes ?? null,
  }).select().single()

  if (error) throw error
  revalidatePath('/dashboard')
  return { ok: true, id: data?.id }
}

export async function updateComponentHours(componentId: string, hours: number) {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    await db.equipmentComponent.update({
      where: { id: componentId },
      data: { currentHours: hours },
    })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  await supabase.from('equipment_components').update({ current_hours: hours }).eq('id', componentId)
  revalidatePath('/dashboard')
  return { ok: true }
}

// =====================================================
// SERVICE BULLETINS
// =====================================================

export async function getServiceBulletins() {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    return db.serviceBulletin.findMany({ orderBy: [{ status: 'asc' }, { issuedAt: 'desc' }] })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('service_bulletins').select('*').order('status', { ascending: true }).order('issued_at', { ascending: false })

  return (data ?? []).map((s: any) => ({
    id: s.id,
    bulletinNumber: s.bulletin_number,
    title: s.title,
    manufacturer: s.manufacturer,
    equipmentType: s.equipment_type,
    serialRange: s.serial_range,
    description: s.description,
    requiredAction: s.required_action,
    partsRequired: s.parts_required,
    estimatedHours: s.estimated_hours,
    priority: s.priority,
    complianceDeadline: s.compliance_deadline ? new Date(s.compliance_deadline) : null,
    status: s.status,
    issuedAt: new Date(s.issued_at),
    completedAt: s.completed_at ? new Date(s.completed_at) : null,
    completedBy: s.completed_by,
    completionNotes: s.completion_notes,
    createdAt: new Date(s.created_at),
    updatedAt: new Date(s.updated_at),
  }))
}

export async function updateBulletinStatus(bulletinId: string, status: string, completionNotes?: string) {
  await requireRole(['engineer', 'admin'])
  const user = await getCurrentUser()

  if (isDemoMode()) {
    await db.serviceBulletin.update({
      where: { id: bulletinId },
      data: {
        status,
        ...(status === 'COMPLETED' ? {
          completedAt: new Date(),
          completedBy: user?.full_name ?? 'Unknown',
          completionNotes: completionNotes ?? null,
        } : {}),
      },
    })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const update: Record<string, unknown> = { status }
  if (status === 'COMPLETED') {
    update.completed_at = new Date().toISOString()
    update.completed_by = user?.full_name ?? 'Unknown'
    update.completion_notes = completionNotes ?? null
  }
  await supabase.from('service_bulletins').update(update).eq('id', bulletinId)
  revalidatePath('/dashboard')
  return { ok: true }
}

// =====================================================
// AIRWORTHINESS DIRECTIVES
// =====================================================

export async function getAirworthinessDirectives() {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    return db.airworthinessDirective.findMany({ orderBy: [{ status: 'asc' }, { priority: 'asc' }] })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('airworthiness_directives').select('*').order('status', { ascending: true }).order('priority', { ascending: true })

  return (data ?? []).map((a: any) => ({
    id: a.id,
    adNumber: a.ad_number,
    title: a.title,
    equipmentType: a.equipment_type,
    description: a.description,
    requiredAction: a.required_action,
    complianceMethod: a.compliance_method,
    priority: a.priority,
    effectiveDate: new Date(a.effective_date),
    complianceDeadline: a.compliance_deadline ? new Date(a.compliance_deadline) : null,
    recurring: a.recurring,
    recurringIntervalHours: a.recurring_interval_hours,
    status: a.status,
    compliedAt: a.complied_at ? new Date(a.complied_at) : null,
    compliedBy: a.complied_by,
    complianceNotes: a.compliance_notes,
    createdAt: new Date(a.created_at),
    updatedAt: new Date(a.updated_at),
  }))
}

export async function updateDirectiveStatus(directiveId: string, status: string, complianceNotes?: string) {
  await requireRole(['engineer', 'admin'])
  const user = await getCurrentUser()

  if (isDemoMode()) {
    await db.airworthinessDirective.update({
      where: { id: directiveId },
      data: {
        status,
        ...(status === 'COMPLIED' ? {
          compliedAt: new Date(),
          compliedBy: user?.full_name ?? 'Unknown',
          complianceNotes: complianceNotes ?? null,
        } : {}),
      },
    })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const update: Record<string, unknown> = { status }
  if (status === 'COMPLIED') {
    update.complied_at = new Date().toISOString()
    update.complied_by = user?.full_name ?? 'Unknown'
    update.compliance_notes = complianceNotes ?? null
  }
  await supabase.from('airworthiness_directives').update(update).eq('id', directiveId)
  revalidatePath('/dashboard')
  return { ok: true }
}

// =====================================================
// SHIFT HANDOVERS
// =====================================================

export async function getShiftHandovers(limit = 20) {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    return db.shiftHandover.findMany({
      orderBy: { shiftDate: 'desc' },
      take: limit,
    })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('shift_handovers').select('*').order('shift_date', { ascending: false }).limit(limit)

  return (data ?? []).map((h: any) => ({
    id: h.id,
    shiftDate: new Date(h.shift_date),
    shiftType: h.shift_type,
    outgoingCardId: h.outgoing_card_id,
    outgoingName: h.outgoing_name,
    outgoingSignature: h.outgoing_signature,
    incomingCardId: h.incoming_card_id,
    incomingName: h.incoming_name,
    incomingSignature: h.incoming_signature,
    assignedEquipmentCount: h.assigned_equipment_count,
    openDamagesCount: h.open_damages_count,
    notes: h.notes,
    status: h.status,
    handoverAt: new Date(h.handover_at),
    createdAt: new Date(h.created_at),
  }))
}

export async function createShiftHandover(params: {
  shiftType: 'MORNING' | 'AFTERNOON' | 'NIGHT'
  outgoingCardId: string
  outgoingName: string
  incomingCardId: string
  incomingName: string
  notes?: string
}) {
  // Javna akcija - radnici mogu kreirati handover bez auth
  // (ali se loguje ko je kreirao)

  if (isDemoMode()) {
    // Izračunaj count trenutno zaduženih sredstava
    const activeAssignments = await db.assignment.findMany({
      where: { damageReportId: null, action: 'CHECK_OUT' },
    })
    const byEquip = new Map<string, typeof activeAssignments[number]>()
    for (const a of activeAssignments) {
      if (!byEquip.has(a.equipmentId)) byEquip.set(a.equipmentId, a)
    }
    const assignedCount = Array.from(byEquip.values()).filter((a) => a.action === 'CHECK_OUT').length

    const openDamages = await db.damageReport.count({ where: { status: { not: 'RESOLVED' } } })

    const handover = await db.shiftHandover.create({
      data: {
        shiftDate: new Date(),
        shiftType: params.shiftType,
        outgoingCardId: params.outgoingCardId,
        outgoingName: params.outgoingName,
        incomingCardId: params.incomingCardId,
        incomingName: params.incomingName,
        assignedEquipmentCount: assignedCount,
        openDamagesCount: openDamages,
        notes: params.notes ?? null,
        status: 'COMPLETED',
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, id: handover.id }
  }

  // Supabase
  const supabase = await createSupabaseClient()

  // Count active assignments
  const { data: activeData } = await supabase
    .from('assignments')
    .select('equipment_id, action, damage_report_id')
    .is('damage_report_id', null)
    .order('timestamp', { ascending: false })

  const byEquip = new Map<string, any>()
  for (const a of activeData ?? []) {
    if (!byEquip.has(a.equipment_id)) byEquip.set(a.equipment_id, a)
  }
  const assignedCount = Array.from(byEquip.values()).filter((a: any) => a.action === 'CHECK_OUT').length

  const { count: openDamages } = await supabase
    .from('damage_reports')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'RESOLVED')

  const { data, error } = await supabase.from('shift_handovers').insert({
    shift_date: new Date().toISOString().slice(0, 10),
    shift_type: params.shiftType,
    outgoing_card_id: params.outgoingCardId,
    outgoing_name: params.outgoingName,
    incoming_card_id: params.incomingCardId,
    incoming_name: params.incomingName,
    assigned_equipment_count: assignedCount,
    open_damages_count: openDamages ?? 0,
    notes: params.notes ?? null,
    status: 'COMPLETED',
  }).select().single()

  if (error) throw error
  revalidatePath('/dashboard')
  return { ok: true, id: data?.id }
}
