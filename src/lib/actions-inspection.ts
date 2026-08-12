'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'

async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  return user
}

// ============================================================================
// AERODROME INSPECTIONS
// ============================================================================

export async function getAerodromeInspections() {
  await requireAuth()

  if (isDemoMode()) {
    const insp = await db.aerodromeInspection.findMany({
      orderBy: { inspectionDate: 'desc' },
      include: { findings: true },
    })
    return insp.map((i: any) => ({ ...i, findingsCount: i.findings?.length ?? 0, criticalCount: i.findings?.filter((f: any) => f.severity === 'CRITICAL').length ?? 0 }))
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('aerodrome_inspections')
    .select('*, inspection_findings(*)')
    .order('inspection_date', { ascending: false })

  return (data ?? []).map((i: any) => ({
    id: i.id,
    inspectionType: i.inspection_type,
    inspectionDate: new Date(i.inspection_date),
    performedBy: i.performed_by,
    performedByCardId: i.performed_by_card_id,
    shift: i.shift,
    runwayCode: i.runway_code,
    taxiwayCode: i.taxiway_code,
    apronArea: i.apron_area,
    weatherConditions: i.weather_conditions,
    visibility: i.visibility,
    runwayCondition: i.runway_condition,
    status: i.status,
    findingsCount: i.inspection_findings?.length ?? i.findings_count ?? 0,
    criticalCount: i.inspection_findings?.filter((f: any) => f.severity === 'CRITICAL').length ?? i.critical_count ?? 0,
    runwaySurface: i.runway_surface,
    runwayMarkings: i.runway_markings,
    runwayLights: i.runway_lights,
    papiLights: i.papi_lights,
    windDirectionIndicators: i.wind_direction_indicators,
    taxiwaySurface: i.taxiway_surface,
    taxiwaySigns: i.taxiway_signs,
    taxiwayLights: i.taxiway_lights,
    gseParking: i.gse_parking,
    fodCheck: i.fod_check,
    markings: i.markings,
    fuelingArea: i.fueling_area,
    drainageSystem: i.drainage_system,
    perimeterFence: i.perimeter_fence,
    wildlifeActivity: i.wildlife_activity,
    notes: i.notes,
    findings: (i.inspection_findings ?? []).map((f: any) => mapFinding(f)),
  }))
}

export async function createAerodromeInspection(input: {
  inspectionType: string
  inspectionDate: string
  performedBy: string
  performedByCardId?: string
  shift?: string
  runwayCode?: string
  taxiwayCode?: string
  apronArea?: string
  weatherConditions?: string
  visibility?: number
  runwayCondition?: string
  runwaySurface?: string
  runwayMarkings?: string
  runwayLights?: string
  papiLights?: string
  windDirectionIndicators?: string
  taxiwaySurface?: string
  taxiwaySigns?: string
  taxiwayLights?: string
  gseParking?: string
  fodCheck?: string
  markings?: string
  fuelingArea?: string
  drainageSystem?: string
  perimeterFence?: string
  wildlifeActivity?: string
  notes?: string
  findings?: Array<{
    category: string
    severity: string
    description: string
    location?: string
    latitude?: number
    longitude?: number
    photoUrl?: string
    actionRequired?: string
  }>
}) {
  await requireAuth()

  // Determine status based on findings
  let status = 'COMPLETED'
  let criticalCount = 0
  if (input.findings && input.findings.length > 0) {
    criticalCount = input.findings.filter(f => f.severity === 'CRITICAL').length
    status = criticalCount > 0 ? 'CRITICAL' : 'WITH_FINDINGS'
  }
  const findingsCount = input.findings?.length ?? 0

  if (isDemoMode()) {
    const created = await db.aerodromeInspection.create({
      data: {
        inspectionType: input.inspectionType,
        inspectionDate: new Date(input.inspectionDate),
        performedBy: input.performedBy,
        performedByCardId: input.performedByCardId || null,
        shift: input.shift || null,
        runwayCode: input.runwayCode || null,
        taxiwayCode: input.taxiwayCode || null,
        apronArea: input.apronArea || null,
        weatherConditions: input.weatherConditions || null,
        visibility: input.visibility || null,
        runwayCondition: input.runwayCondition || null,
        status,
        findingsCount,
        criticalCount,
        runwaySurface: input.runwaySurface || null,
        runwayMarkings: input.runwayMarkings || null,
        runwayLights: input.runwayLights || null,
        papiLights: input.papiLights || null,
        windDirectionIndicators: input.windDirectionIndicators || null,
        taxiwaySurface: input.taxiwaySurface || null,
        taxiwaySigns: input.taxiwaySigns || null,
        taxiwayLights: input.taxiwayLights || null,
        gseParking: input.gseParking || null,
        fodCheck: input.fodCheck || null,
        markings: input.markings || null,
        fuelingArea: input.fuelingArea || null,
        drainageSystem: input.drainageSystem || null,
        perimeterFence: input.perimeterFence || null,
        wildlifeActivity: input.wildlifeActivity || null,
        notes: input.notes || null,
        findings: input.findings && input.findings.length > 0 ? {
          create: input.findings.map(f => ({
            category: f.category,
            severity: f.severity,
            description: f.description,
            location: f.location || null,
            latitude: f.latitude || null,
            longitude: f.longitude || null,
            photoUrl: f.photoUrl || null,
            actionRequired: f.actionRequired || null,
          }))
        } : undefined,
      },
      include: { findings: true },
    })
    revalidatePath('/dashboard')
    return { ok: true, id: created.id, findingsCount, criticalCount }
  }

  const supabase = await createSupabaseClient()
  const { data: insp, error } = await supabase.from('aerodrome_inspections').insert({
    inspection_type: input.inspectionType,
    inspection_date: input.inspectionDate,
    performed_by: input.performedBy,
    performed_by_card_id: input.performedByCardId || null,
    shift: input.shift || null,
    runway_code: input.runwayCode || null,
    taxiway_code: input.taxiwayCode || null,
    apron_area: input.apronArea || null,
    weather_conditions: input.weatherConditions || null,
    visibility: input.visibility || null,
    runway_condition: input.runwayCondition || null,
    status,
    findings_count: findingsCount,
    critical_count: criticalCount,
    runway_surface: input.runwaySurface || null,
    runway_markings: input.runwayMarkings || null,
    runway_lights: input.runwayLights || null,
    papi_lights: input.papiLights || null,
    wind_direction_indicators: input.windDirectionIndicators || null,
    taxiway_surface: input.taxiwaySurface || null,
    taxiway_signs: input.taxiwaySigns || null,
    taxiway_lights: input.taxiwayLights || null,
    gse_parking: input.gseParking || null,
    fod_check: input.fodCheck || null,
    markings: input.markings || null,
    fueling_area: input.fuelingArea || null,
    drainage_system: input.drainageSystem || null,
    perimeter_fence: input.perimeterFence || null,
    wildlife_activity: input.wildlifeActivity || null,
    notes: input.notes || null,
  }).select().single()

  if (error) return { ok: false, error: error.message }
  if (!insp) return { ok: false, error: 'Greška pri kreiranju' }

  // Insert findings if any
  if (input.findings && input.findings.length > 0) {
    const { error: fError } = await supabase.from('inspection_findings').insert(
      input.findings.map(f => ({
        inspection_id: insp.id,
        category: f.category,
        severity: f.severity,
        description: f.description,
        location: f.location || null,
        latitude: f.latitude || null,
        longitude: f.longitude || null,
        photo_url: f.photoUrl || null,
        action_required: f.actionRequired || null,
      }))
    )
    if (fError) console.error('Findings error:', fError)
  }

  revalidatePath('/dashboard')
  return { ok: true, id: insp.id, findingsCount, criticalCount }
}

export async function deleteAerodromeInspection(id: string) {
  await requireAuth()
  if (isDemoMode()) {
    await db.aerodromeInspection.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('aerodrome_inspections').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================================
// FINDINGS (nalazi)
// ============================================================================

export async function getFindings() {
  await requireAuth()
  if (isDemoMode()) {
    return db.inspectionFinding.findMany({
      orderBy: { createdAt: 'desc' },
      include: { inspection: true },
    })
  }
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('inspection_findings')
    .select('*, aerodrome_inspections(*)')
    .order('created_at', { ascending: false })
  return (data ?? []).map((f: any) => mapFinding(f))
}

function mapFinding(f: any) {
  const insp = f.aerodrome_inspections || f.inspection
  return {
    id: f.id,
    inspectionId: f.inspection_id,
    category: f.category,
    severity: f.severity,
    description: f.description,
    location: f.location,
    latitude: f.latitude,
    longitude: f.longitude,
    photoUrl: f.photo_url,
    actionRequired: f.action_required,
    actionTaken: f.action_taken,
    status: f.status,
    resolvedAt: f.resolved_at ? new Date(f.resolved_at) : null,
    resolvedBy: f.resolved_by,
    notamGenerated: f.notam_generated,
    notamNumber: f.notam_number,
    createdAt: new Date(f.created_at),
    inspection: insp ? {
      id: insp.id,
      inspectionType: insp.inspection_type,
      inspectionDate: new Date(insp.inspection_date),
      runwayCode: insp.runway_code,
      taxiwayCode: insp.taxiway_code,
      apronArea: insp.apron_area,
    } : null,
  }
}

export async function updateFindingStatus(id: string, status: string, actionTaken?: string, resolvedBy?: string) {
  await requireAuth()
  const updateData: any = { status }
  if (actionTaken) updateData.actionTaken = actionTaken
  if (status === 'RESOLVED') {
    updateData.resolvedAt = new Date()
    updateData.resolvedBy = resolvedBy || null
  }

  if (isDemoMode()) {
    await db.inspectionFinding.update({ where: { id }, data: updateData })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supabase = await createSupabaseClient()
  const supaUpdate: any = {
    status,
    action_taken: actionTaken || null,
  }
  if (status === 'RESOLVED') {
    supaUpdate.resolved_at = new Date().toISOString()
    supaUpdate.resolved_by = resolvedBy || null
  }
  const { error } = await supabase.from('inspection_findings').update(supaUpdate).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function deleteFinding(id: string) {
  await requireAuth()
  if (isDemoMode()) {
    await db.inspectionFinding.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('inspection_findings').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================================
// NOTAM
// ============================================================================

export async function getNotams() {
  await requireAuth()
  if (isDemoMode()) {
    return db.notam.findMany({ orderBy: { createdAt: 'desc' } })
  }
  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('notams').select('*').order('created_at', { ascending: false })
  return (data ?? []).map((n: any) => ({
    id: n.id,
    notamNumber: n.notam_number,
    series: n.series,
    qualifier: n.qualifier,
    refNotamNumber: n.ref_notam_number,
    fir: n.fir,
    aerodrome: n.aerodrome,
    subject: n.subject,
    condition: n.condition,
    purpose: n.purpose,
    scope: n.scope,
    traffic: n.traffic,
    lowerLimit: n.lower_limit,
    upperLimit: n.upper_limit,
    coordinates: n.coordinates,
    radius: n.radius,
    text: n.text,
    createdFromFindingId: n.created_from_finding_id,
    createdFromInspectionId: n.created_from_inspection_id,
    status: n.status,
    validFrom: new Date(n.valid_from),
    validTo: new Date(n.valid_to),
    createdBy: n.created_by,
    createdAt: new Date(n.created_at),
  }))
}

export async function createNotam(input: {
  series?: string
  qualifier?: string
  aerodrome?: string
  subject: string
  condition: string
  text: string
  validTo: string
  findingId?: string
  inspectionId?: string
  createdBy?: string
}) {
  await requireAuth()

  // Generate NOTAM number: A1234/26 (series + 4-digit + /2-digit year)
  const year = new Date().getFullYear().toString().slice(-2)
  const randomNum = Math.floor(1000 + Math.random() * 9000)
  const series = input.series || 'A'
  const notamNumber = `${series}${randomNum}/${year}`

  if (isDemoMode()) {
    const created = await db.notam.create({
      data: {
        notamNumber,
        series,
        qualifier: input.qualifier || 'NOTAMN',
        aerodrome: input.aerodrome || 'LYTV',
        subject: input.subject,
        condition: input.condition,
        purpose: 'B',
        scope: 'A',
        traffic: 'IV',
        text: input.text,
        createdFromFindingId: input.findingId || null,
        createdFromInspectionId: input.inspectionId || null,
        status: 'ACTIVE',
        validFrom: new Date(),
        validTo: new Date(input.validTo),
        createdBy: input.createdBy || null,
      },
    })

    // Update finding if linked
    if (input.findingId) {
      await db.inspectionFinding.update({
        where: { id: input.findingId },
        data: { notamGenerated: true, notamNumber },
      })
    }

    revalidatePath('/dashboard')
    return { ok: true, notamNumber: created.notamNumber }
  }

  const supabase = await createSupabaseClient()
  const { data: notam, error } = await supabase.from('notams').insert({
    notam_number: notamNumber,
    series,
    qualifier: input.qualifier || 'NOTAMN',
    aerodrome: input.aerodrome || 'LYTV',
    subject: input.subject,
    condition: input.condition,
    purpose: 'B',
    scope: 'A',
    traffic: 'IV',
    text: input.text,
    created_from_finding_id: input.findingId || null,
    created_from_inspection_id: input.inspectionId || null,
    status: 'ACTIVE',
    valid_from: new Date().toISOString(),
    valid_to: input.validTo,
    created_by: input.createdBy || null,
  }).select().single()

  if (error) return { ok: false, error: error.message }

  // Update finding if linked
  if (input.findingId) {
    await supabase.from('inspection_findings').update({
      notam_generated: true,
      notam_number: notamNumber,
    }).eq('id', input.findingId)
  }

  revalidatePath('/dashboard')
  return { ok: true, notamNumber }
}

export async function cancelNotam(id: string) {
  await requireAuth()
  if (isDemoMode()) {
    await db.notam.update({ where: { id }, data: { status: 'CANCELLED' } })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('notams').update({ status: 'CANCELLED' }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function deleteNotam(id: string) {
  await requireAuth()
  if (isDemoMode()) {
    await db.notam.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('notams').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================================
// STATISTIKE
// ============================================================================

export async function getInspectionStats(period?: 'monthly' | 'semiannual' | 'annual', year?: number) {
  await requireAuth()
  const insp = await getAerodromeInspections()
  const findings = await getFindings()

  const targetYear = year ?? new Date().getFullYear()
  let filtered = insp.filter((i: any) => new Date(i.inspectionDate).getFullYear() === targetYear)

  if (period === 'monthly') {
    // Last 30 days or specific month
    filtered = insp.filter((i: any) => {
      const d = new Date(i.inspectionDate)
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 30)
      return d >= cutoff
    })
  } else if (period === 'semiannual') {
    filtered = insp.filter((i: any) => {
      const d = new Date(i.inspectionDate)
      const cutoff = new Date()
      cutoff.setMonth(cutoff.getMonth() - 6)
      return d >= cutoff
    })
  } else if (period === 'annual') {
    filtered = insp.filter((i: any) => {
      const d = new Date(i.inspectionDate)
      const cutoff = new Date()
      cutoff.setFullYear(cutoff.getFullYear() - 1)
      return d >= cutoff
    })
  }

  // By type
  const byType: Record<string, number> = {}
  for (const i of filtered) {
    byType[i.inspectionType] = (byType[i.inspectionType] || 0) + 1
  }

  // By status
  const byStatus: Record<string, number> = {}
  for (const i of filtered) {
    byStatus[i.status] = (byStatus[i.status] || 0) + 1
  }

  // Findings by category
  const findingsByCategory: Record<string, number> = {}
  for (const f of findings) {
    findingsByCategory[f.category] = (findingsByCategory[f.category] || 0) + 1
  }

  // Findings by severity
  const findingsBySeverity: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
  for (const f of findings) {
    findingsBySeverity[f.severity] = (findingsBySeverity[f.severity] || 0) + 1
  }

  // Findings by status (open vs resolved)
  const findingsByStatus: Record<string, number> = {}
  for (const f of findings) {
    findingsByStatus[f.status] = (findingsByStatus[f.status] || 0) + 1
  }

  // By inspector
  const byInspector: Record<string, number> = {}
  for (const i of filtered) {
    byInspector[i.performedBy] = (byInspector[i.performedBy] || 0) + 1
  }

  // By month (for trend)
  const byMonth: Record<string, number> = {}
  for (let m = 0; m < 12; m++) {
    const monthName = new Date(targetYear, m, 1).toLocaleString('hr-HR', { month: 'short' })
    byMonth[monthName] = 0
  }
  for (const i of insp) {
    const d = new Date(i.inspectionDate)
    if (d.getFullYear() === targetYear) {
      const monthName = d.toLocaleString('hr-HR', { month: 'short' })
      byMonth[monthName] = (byMonth[monthName] || 0) + 1
    }
  }

  // Critical findings trend (per month)
  const criticalByMonth: Record<string, number> = {}
  for (let m = 0; m < 12; m++) {
    const monthName = new Date(targetYear, m, 1).toLocaleString('hr-HR', { month: 'short' })
    criticalByMonth[monthName] = 0
  }
  for (const i of insp) {
    if (i.status === 'CRITICAL') {
      const d = new Date(i.inspectionDate)
      if (d.getFullYear() === targetYear) {
        const monthName = d.toLocaleString('hr-HR', { month: 'short' })
        criticalByMonth[monthName] = (criticalByMonth[monthName] || 0) + 1
      }
    }
  }

  // Top problem locations (by finding location)
  const topProblemLocations: Array<{ location: string; count: number }> = []
  const locMap: Record<string, number> = {}
  for (const f of findings) {
    if (f.location) {
      locMap[f.location] = (locMap[f.location] || 0) + 1
    }
  }
  for (const [loc, count] of Object.entries(locMap)) {
    topProblemLocations.push({ location: loc, count })
  }
  topProblemLocations.sort((a, b) => b.count - a.count)

  // Top problem categories
  const topProblemCategories = Object.entries(findingsByCategory)
    .map(([cat, count]) => ({ category: cat, count }))
    .sort((a, b) => b.count - a.count)

  return {
    period: period || 'all',
    totalInspections: filtered.length,
    totalFindings: findings.length,
    openFindings: findings.filter((f: any) => f.status === 'OPEN' || f.status === 'IN_PROGRESS').length,
    resolvedFindings: findings.filter((f: any) => f.status === 'RESOLVED').length,
    criticalFindings: findings.filter((f: any) => f.severity === 'CRITICAL').length,
    byType,
    byStatus,
    findingsByCategory,
    findingsBySeverity,
    findingsByStatus,
    byInspector,
    byMonth,
    criticalByMonth,
    topProblemLocations: topProblemLocations.slice(0, 10),
    topProblemCategories,
    notamsGenerated: findings.filter((f: any) => f.notamGenerated).length,
  }
}
