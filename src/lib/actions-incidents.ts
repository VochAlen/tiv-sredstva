'use server'

// ADR.OPS.B.005 - Incident/Accident Reporting (SMS)
// EASA Safety Management System — prijava, pretraga, statistika

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

export interface IncidentData {
  id: string
  incidentNumber: string
  incidentType: string
  severity: string
  smorRequired: boolean
  location: string
  zone: string | null
  occurredAt: Date
  weather: string | null
  visibility: string | null
  surfaceCondition: string | null
  equipmentId: string | null
  equipmentCode: string | null
  equipmentName: string | null
  operatorCardId: string | null
  operatorName: string | null
  description: string
  immediateAction: string | null
  rootCause: string | null
  contributingFactors: string | null
  correctiveActions: string | null
  preventiveActions: string | null
  status: string
  reportedBy: string
  reportedByCardId: string | null
  reportedAt: Date
  injuriesReported: boolean
  injuryDetails: string | null
  damageEstimate: number | null
  authorityNotified: string | null
  notificationDate: Date | null
  notes: string | null
  createdAt: Date
}

// =====================================================
// CREATE incident — javna funkcija (radnici prijavljuju)
// =====================================================

export async function createIncident(params: {
  incidentType: string
  severity: string
  smorRequired?: boolean
  location: string
  zone?: string
  occurredAt: string
  weather?: string
  visibility?: string
  surfaceCondition?: string
  equipmentCode?: string
  equipmentName?: string
  operatorCardId?: string
  operatorName?: string
  description: string
  immediateAction?: string
  reportedBy: string
  reportedByCardId?: string
  injuriesReported?: boolean
  injuryDetails?: string
  damageEstimate?: number
}) {
  // Javna funkcija — radnici prijavljuju incidente bez login-a

  if (isDemoMode()) {
    const count = await db.incident.count()
    const year = new Date().getFullYear()
    const incidentNumber = `INC-${year}-${String(count + 1).padStart(3, '0')}`

    const incident = await db.incident.create({
      data: {
        incidentNumber,
        incidentType: params.incidentType,
        severity: params.severity,
        smorRequired: params.smorRequired ?? false,
        location: params.location,
        zone: params.zone ?? null,
        occurredAt: new Date(params.occurredAt),
        weather: params.weather ?? null,
        visibility: params.visibility ?? null,
        surfaceCondition: params.surfaceCondition ?? null,
        equipmentCode: params.equipmentCode ?? null,
        equipmentName: params.equipmentName ?? null,
        operatorCardId: params.operatorCardId ?? null,
        operatorName: params.operatorName ?? null,
        description: params.description,
        immediateAction: params.immediateAction ?? null,
        reportedBy: params.reportedBy,
        reportedByCardId: params.reportedByCardId ?? null,
        injuriesReported: params.injuriesReported ?? false,
        injuryDetails: params.injuryDetails ?? null,
        damageEstimate: params.damageEstimate ?? null,
      },
    })

    revalidatePath('/dashboard')
    return { ok: true, id: incident.id, incidentNumber }
  }

  // Supabase
  const supabase = await createSupabaseClient()
  // Broj incidenta se generiše preko RPC funkcije (sekvenca u bazi, vidi
  // migraciju 018) - ne čita tabelu incidents, pa radi i za anon pozivaoca
  // sada kada je SELECT na incidents ograničen na authenticated (migracija 017).
  const { data: numberData, error: numberError } = await supabase.rpc('next_incident_number')
  if (numberError) throw numberError
  const incidentNumber: string = numberData

  // ID se generiše unaprijed iz istog razloga kao u addFuelLog
  // (actions-fuel-parking.ts) - SELECT na incidents je ograničen na authenticated.
  const id = crypto.randomUUID()

  const { error } = await supabase.from('incidents').insert({
    id,
    incident_number: incidentNumber,
    incident_type: params.incidentType,
    severity: params.severity,
    smor_required: params.smorRequired ?? false,
    location: params.location,
    zone: params.zone ?? null,
    occurred_at: params.occurredAt,
    weather: params.weather ?? null,
    visibility: params.visibility ?? null,
    surface_condition: params.surfaceCondition ?? null,
    equipment_code: params.equipmentCode ?? null,
    equipment_name: params.equipmentName ?? null,
    operator_card_id: params.operatorCardId ?? null,
    operator_name: params.operatorName ?? null,
    description: params.description,
    immediate_action: params.immediateAction ?? null,
    reported_by: params.reportedBy,
    reported_by_card_id: params.reportedByCardId ?? null,
    injuries_reported: params.injuriesReported ?? false,
    injury_details: params.injuryDetails ?? null,
    damage_estimate: params.damageEstimate ?? null,
  })

  if (error) throw error
  revalidatePath('/dashboard')
  return { ok: true, id, incidentNumber }
}

// =====================================================
// GET incidents — sa pretragom i filtriranjem
// =====================================================

export async function getIncidents(params?: {
  search?: string
  typeFilter?: string
  severityFilter?: string
  statusFilter?: string
  zoneFilter?: string
  limit?: number
}) {
  await requireRole(['engineer', 'admin'])

  const limit = params?.limit ?? 100

  if (isDemoMode()) {
    let where: any = {}

    if (params?.typeFilter && params.typeFilter !== 'ALL') where.incidentType = params.typeFilter
    if (params?.severityFilter && params.severityFilter !== 'ALL') where.severity = params.severityFilter
    if (params?.statusFilter && params.statusFilter !== 'ALL') where.status = params.statusFilter
    if (params?.zoneFilter && params.zoneFilter !== 'ALL') where.zone = params.zoneFilter

    if (params?.search) {
      const s = params.search.toLowerCase()
      where.OR = [
        { incidentNumber: { contains: s } },
        { description: { contains: s } },
        { location: { contains: s } },
        { equipmentCode: { contains: s } },
        { operatorName: { contains: s } },
      ]
    }

    return db.incident.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: limit,
    })
  }

  // Supabase
  const supabase = await createSupabaseClient()
  let query = supabase.from('incidents').select('*')

  if (params?.typeFilter && params.typeFilter !== 'ALL') query = query.eq('incident_type', params.typeFilter)
  if (params?.severityFilter && params.severityFilter !== 'ALL') query = query.eq('severity', params.severityFilter)
  if (params?.statusFilter && params.statusFilter !== 'ALL') query = query.eq('status', params.statusFilter)
  if (params?.zoneFilter && params.zoneFilter !== 'ALL') query = query.eq('zone', params.zoneFilter)

  query = query.order('occurred_at', { ascending: false }).limit(limit)

  const { data } = await query

  let results = (data ?? []).map(mapSupabaseIncident)

  // Text search (client-side for Supabase since we can't do OR easily)
  if (params?.search) {
    const s = params.search.toLowerCase()
    results = results.filter((i: any) =>
      i.incidentNumber?.toLowerCase().includes(s) ||
      i.description?.toLowerCase().includes(s) ||
      i.location?.toLowerCase().includes(s) ||
      i.equipmentCode?.toLowerCase().includes(s) ||
      i.operatorName?.toLowerCase().includes(s)
    )
  }

  return results
}

// =====================================================
// GET incident statistics
// =====================================================

export async function getIncidentStats() {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    const [incidents, openIncidents, smorIncidents, injuryIncidents] = await Promise.all([
      db.incident.count(),
      db.incident.count({ where: { status: { not: 'CLOSED' } } }),
      db.incident.count({ where: { smorRequired: true } }),
      db.incident.count({ where: { injuriesReported: true } }),
    ])

    const byType = await db.incident.groupBy({ by: ['incidentType'], _count: true })
    const bySeverity = await db.incident.groupBy({ by: ['severity'], _count: true })
    const totalDamage = await db.incident.aggregate({ _sum: { damageEstimate: true } })

    return {
      total: incidents,
      open: openIncidents,
      smorRequired: smorIncidents,
      withInjuries: injuryIncidents,
      totalDamageEstimate: totalDamage._sum.damageEstimate ?? 0,
      byType: byType.map((t) => ({ type: t.incidentType, count: t._count })),
      bySeverity: bySeverity.map((s) => ({ severity: s.severity, count: s._count })),
    }
  }

  // Supabase — paralelno
  const supabase = await createSupabaseClient()
  const [allRes, openRes, smorRes, injuryRes] = await Promise.all([
    supabase.from('incidents').select('*', { count: 'exact', head: true }),
    supabase.from('incidents').select('*', { count: 'exact', head: true }).neq('status', 'CLOSED'),
    supabase.from('incidents').select('*', { count: 'exact', head: true }).eq('smor_required', true),
    supabase.from('incidents').select('*', { count: 'exact', head: true }).eq('injuries_reported', true),
  ])

  const { data: allIncidents } = await supabase.from('incidents').select('incident_type, severity, damage_estimate')

  const byTypeMap = new Map<string, number>()
  const bySeverityMap = new Map<string, number>()
  let totalDamage = 0

  for (const inc of allIncidents ?? []) {
    byTypeMap.set(inc.incident_type, (byTypeMap.get(inc.incident_type) ?? 0) + 1)
    bySeverityMap.set(inc.severity, (bySeverityMap.get(inc.severity) ?? 0) + 1)
    totalDamage += inc.damage_estimate ?? 0
  }

  return {
    total: allRes.count ?? 0,
    open: openRes.count ?? 0,
    smorRequired: smorRes.count ?? 0,
    withInjuries: injuryRes.count ?? 0,
    totalDamageEstimate: totalDamage,
    byType: Array.from(byTypeMap.entries()).map(([type, count]) => ({ type, count })),
    bySeverity: Array.from(bySeverityMap.entries()).map(([severity, count]) => ({ severity, count })),
  }
}

// =====================================================
// UPDATE incident — root cause, corrective actions, status
// =====================================================

export async function updateIncident(params: {
  incidentId: string
  status?: string
  rootCause?: string
  contributingFactors?: string
  correctiveActions?: string
  preventiveActions?: string
  authorityNotified?: string
  notes?: string
}) {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    await db.incident.update({
      where: { id: params.incidentId },
      data: {
        ...(params.status ? { status: params.status } : {}),
        ...(params.rootCause !== undefined ? { rootCause: params.rootCause } : {}),
        ...(params.contributingFactors !== undefined ? { contributingFactors: params.contributingFactors } : {}),
        ...(params.correctiveActions !== undefined ? { correctiveActions: params.correctiveActions } : {}),
        ...(params.preventiveActions !== undefined ? { preventiveActions: params.preventiveActions } : {}),
        ...(params.authorityNotified !== undefined ? { authorityNotified: params.authorityNotified, notificationDate: params.authorityNotified ? new Date() : null } : {}),
        ...(params.notes !== undefined ? { notes: params.notes } : {}),
      },
    })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const update: Record<string, unknown> = {}
  if (params.status) update.status = params.status
  if (params.rootCause !== undefined) update.root_cause = params.rootCause
  if (params.contributingFactors !== undefined) update.contributing_factors = params.contributingFactors
  if (params.correctiveActions !== undefined) update.corrective_actions = params.correctiveActions
  if (params.preventiveActions !== undefined) update.preventive_actions = params.preventiveActions
  if (params.authorityNotified !== undefined) {
    update.authority_notified = params.authorityNotified
    update.notification_date = params.authorityNotified ? new Date().toISOString() : null
  }
  if (params.notes !== undefined) update.notes = params.notes

  await supabase.from('incidents').update(update).eq('id', params.incidentId)
  revalidatePath('/dashboard')
  return { ok: true }
}

// =====================================================
// Helper
// =====================================================

function mapSupabaseIncident(i: any): IncidentData {
  return {
    id: i.id,
    incidentNumber: i.incident_number,
    incidentType: i.incident_type,
    severity: i.severity,
    smorRequired: i.smor_required,
    location: i.location,
    zone: i.zone,
    occurredAt: new Date(i.occurred_at),
    weather: i.weather,
    visibility: i.visibility,
    surfaceCondition: i.surface_condition,
    equipmentId: i.equipment_id,
    equipmentCode: i.equipment_code,
    equipmentName: i.equipment_name,
    operatorCardId: i.operator_card_id,
    operatorName: i.operator_name,
    description: i.description,
    immediateAction: i.immediate_action,
    rootCause: i.root_cause,
    contributingFactors: i.contributing_factors,
    correctiveActions: i.corrective_actions,
    preventiveActions: i.preventive_actions,
    status: i.status,
    reportedBy: i.reported_by,
    reportedByCardId: i.reported_by_card_id,
    reportedAt: new Date(i.reported_at),
    injuriesReported: i.injuries_reported,
    injuryDetails: i.injury_details,
    damageEstimate: i.damage_estimate,
    authorityNotified: i.authority_notified,
    notificationDate: i.notification_date ? new Date(i.notification_date) : null,
    notes: i.notes,
    createdAt: new Date(i.created_at),
  }
}

// =====================================================
// Labels (exported via constants-export pattern — not 'use server')
// These are returned from a server action, so they're OK as return values
// =====================================================

export async function getIncidentTypeLabels() {
  return {
    GSE_AIRCRAFT: 'GSE → Avion',
    GSE_PERSON: 'GSE → Osoba',
    GSE_INFRASTRUCTURE: 'GSE → Infrastruktura',
    GSE_GSE: 'GSE → GSE',
    FOD: 'Strano tijelo (FOD)',
    SPILL: 'Izlivanje',
    OTHER: 'Ostalo',
  }
}

export async function getSeverityLabels() {
  return {
    MINOR: 'Manji',
    MAJOR: 'Veći',
    SERIOUS: 'Ozbiljan',
    ACCIDENT: 'Nesreća',
  }
}
