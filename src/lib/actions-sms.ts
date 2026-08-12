'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { calculateRiskLevel } from '@/lib/risk-matrix'

async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  return user
}

// Note: calculateRiskLevel is imported from '@/lib/risk-matrix' (shared utility)
// and used internally for auto-calculating risk levels.

// ============================================================================
// HAZARDS
// ============================================================================

export async function getHazards() {
  await requireAuth()
  if (isDemoMode()) {
    return db.hazard.findMany({ orderBy: { reportedAt: 'desc' } })
  }
  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('sms_hazards').select('*').order('reported_at', { ascending: false })
  return (data ?? []).map((h: any) => mapHazard(h))
}

function mapHazard(h: any) {
  return {
    id: h.id,
    hazardId: h.hazard_id,
    title: h.title,
    description: h.description,
    category: h.category,
    source: h.source,
    location: h.location,
    reportedBy: h.reported_by,
    reportedByCardId: h.reported_by_card_id,
    reportedAt: new Date(h.reported_at),
    initialProbability: h.initial_probability,
    initialSeverity: h.initial_severity,
    initialRiskLevel: h.initial_risk_level,
    status: h.status,
    assignedTo: h.assigned_to,
    dueDate: h.due_date ? new Date(h.due_date) : null,
    mitigation: h.mitigation,
    residualProbability: h.residual_probability,
    residualSeverity: h.residual_severity,
    residualRiskLevel: h.residual_risk_level,
    alarpJustification: h.alarp_justification,
    alarpReviewedAt: h.alarp_reviewed_at ? new Date(h.alarp_reviewed_at) : null,
    alarpReviewedBy: h.alarp_reviewed_by,
    actionPlanId: h.action_plan_id,
    closedAt: h.closed_at ? new Date(h.closed_at) : null,
    closedBy: h.closed_by,
    notes: h.notes,
  }
}

export async function createHazard(input: {
  title: string
  description: string
  category: string
  source: string
  location?: string
  reportedBy: string
  reportedByCardId?: string
  initialProbability: number
  initialSeverity: number
  assignedTo?: string
  dueDate?: string
  notes?: string
}) {
  await requireAuth()

  const initialRiskLevel = calculateRiskLevel(input.initialProbability, input.initialSeverity)

  // Generate hazard ID: HZ-YYYY-NNN
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 900) + 100
  const hazardId = `HZ-${year}-${random}`

  if (isDemoMode()) {
    const created = await db.hazard.create({
      data: {
        hazardId,
        title: input.title,
        description: input.description,
        category: input.category,
        source: input.source,
        location: input.location || null,
        reportedBy: input.reportedBy,
        reportedByCardId: input.reportedByCardId || null,
        initialProbability: input.initialProbability,
        initialSeverity: input.initialSeverity,
        initialRiskLevel,
        assignedTo: input.assignedTo || null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        notes: input.notes || null,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, hazardId: created.hazardId }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('sms_hazards').insert({
    hazard_id: hazardId,
    title: input.title,
    description: input.description,
    category: input.category,
    source: input.source,
    location: input.location || null,
    reported_by: input.reportedBy,
    reported_by_card_id: input.reportedByCardId || null,
    initial_probability: input.initialProbability,
    initial_severity: input.initialSeverity,
    initial_risk_level: initialRiskLevel,
    assigned_to: input.assignedTo || null,
    due_date: input.dueDate || null,
    notes: input.notes || null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true, hazardId }
}

export async function updateHazardMitigation(id: string, input: {
  mitigation: string
  residualProbability: number
  residualSeverity: number
  alarpJustification?: string
  alarpReviewedBy?: string
  status?: string
}) {
  await requireAuth()

  const residualRiskLevel = calculateRiskLevel(input.residualProbability, input.residualSeverity)
  const status = input.status || 'MITIGATED'

  if (isDemoMode()) {
    await db.hazard.update({
      where: { id },
      data: {
        mitigation: input.mitigation,
        residualProbability: input.residualProbability,
        residualSeverity: input.residualSeverity,
        residualRiskLevel,
        alarpJustification: input.alarpJustification || null,
        alarpReviewedAt: input.alarpJustification ? new Date() : null,
        alarpReviewedBy: input.alarpReviewedBy || null,
        status,
        ...(status === 'CLOSED' && { closedAt: new Date(), closedBy: input.alarpReviewedBy }),
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, residualRiskLevel }
  }

  const supabase = await createSupabaseClient()
  const updateData: any = {
    mitigation: input.mitigation,
    residual_probability: input.residualProbability,
    residual_severity: input.residualSeverity,
    residual_risk_level: residualRiskLevel,
    alarp_justification: input.alarpJustification || null,
    alarp_reviewed_by: input.alarpReviewedBy || null,
    status,
  }
  if (input.alarpJustification) updateData.alarp_reviewed_at = new Date().toISOString()
  if (status === 'CLOSED') {
    updateData.closed_at = new Date().toISOString()
    updateData.closed_by = input.alarpReviewedBy || null
  }
  const { error } = await supabase.from('sms_hazards').update(updateData).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true, residualRiskLevel }
}

export async function deleteHazard(id: string) {
  await requireAuth()
  if (isDemoMode()) {
    await db.hazard.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('sms_hazards').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================================
// SPI
// ============================================================================

export async function getSPIs() {
  await requireAuth()
  if (isDemoMode()) {
    return db.sPI.findMany({ orderBy: { createdAt: 'desc' } })
  }
  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('sms_spis').select('*').order('created_at', { ascending: false })
  return (data ?? []).map((s: any) => mapSPI(s))
}

function mapSPI(s: any) {
  return {
    id: s.id,
    spiId: s.spi_id,
    name: s.name,
    description: s.description,
    category: s.category,
    unit: s.unit,
    frequency: s.frequency,
    targetValue: s.target_value,
    alertLevel: s.alert_level,
    tolerableLimit: s.tolerable_limit,
    currentValue: s.current_value,
    currentPeriod: s.current_period,
    trend: s.trend,
    status: s.status,
    lastUpdated: new Date(s.last_updated),
    sptId: s.spt_id,
  }
}

export async function createSPI(input: {
  name: string
  description?: string
  category: string
  unit: string
  frequency: string
  targetValue: number
  alertLevel: number
  tolerableLimit: number
  currentValue?: number
  currentPeriod?: string
  sptId?: string
}) {
  await requireAuth()
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 900) + 100
  const spiId = `SPI-${random}`

  // Calculate status based on current value
  let status = 'GREEN'
  if (input.currentValue != null) {
    if (input.currentValue > input.tolerableLimit) status = 'RED'
    else if (input.currentValue > input.alertLevel) status = 'AMBER'
  }

  if (isDemoMode()) {
    const created = await db.sPI.create({
      data: {
        spiId,
        name: input.name,
        description: input.description || null,
        category: input.category,
        unit: input.unit,
        frequency: input.frequency,
        targetValue: input.targetValue,
        alertLevel: input.alertLevel,
        tolerableLimit: input.tolerableLimit,
        currentValue: input.currentValue || null,
        currentPeriod: input.currentPeriod || null,
        status,
        sptId: input.sptId || null,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, spiId: created.spiId }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('sms_spis').insert({
    spi_id: spiId,
    name: input.name,
    description: input.description || null,
    category: input.category,
    unit: input.unit,
    frequency: input.frequency,
    target_value: input.targetValue,
    alert_level: input.alertLevel,
    tolerable_limit: input.tolerableLimit,
    current_value: input.currentValue || null,
    current_period: input.currentPeriod || null,
    status,
    spt_id: input.sptId || null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true, spiId }
}

export async function updateSPIValue(id: string, currentValue: number, currentPeriod: string) {
  await requireAuth()

  // Get SPI to determine thresholds
  const spis = await getSPIs()
  const spi = spis.find((s: any) => s.id === id)
  if (!spi) return { ok: false, error: 'SPI not found' }

  let status = 'GREEN'
  if (currentValue > spi.tolerableLimit) status = 'RED'
  else if (currentValue > spi.alertLevel) status = 'AMBER'

  const trend = spi.currentValue != null
    ? (currentValue < spi.currentValue ? 'IMPROVING' : currentValue > spi.currentValue ? 'WORSENING' : 'STABLE')
    : 'STABLE'

  if (isDemoMode()) {
    await db.sPI.update({
      where: { id },
      data: { currentValue, currentPeriod, status, trend, lastUpdated: new Date() },
    })
    revalidatePath('/dashboard')
    return { ok: true, status, trend }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('sms_spis').update({
    current_value: currentValue,
    current_period: currentPeriod,
    status,
    trend,
    last_updated: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true, status, trend }
}

export async function deleteSPI(id: string) {
  await requireAuth()
  if (isDemoMode()) {
    await db.sPI.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('sms_spis').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================================
// SPT
// ============================================================================

export async function getSPTs() {
  await requireAuth()
  if (isDemoMode()) {
    return db.sPT.findMany({ orderBy: { targetDate: 'asc' } })
  }
  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('sms_spts').select('*').order('target_date', { ascending: true })
  return (data ?? []).map((s: any) => mapSPT(s))
}

function mapSPT(s: any) {
  return {
    id: s.id,
    sptId: s.spt_id,
    name: s.name,
    description: s.description,
    category: s.category,
    baselineValue: s.baseline_value,
    targetValue: s.target_value,
    currentValue: s.current_value,
    unit: s.unit,
    startDate: new Date(s.start_date),
    targetDate: new Date(s.target_date),
    status: s.status,
    progressPercent: s.progress_percent,
    notes: s.notes,
  }
}

export async function createSPT(input: {
  name: string
  description?: string
  category: string
  baselineValue: number
  targetValue: number
  unit: string
  startDate: string
  targetDate: string
  notes?: string
}) {
  await requireAuth()
  const random = Math.floor(Math.random() * 900) + 100
  const sptId = `SPT-${random}`

  if (isDemoMode()) {
    const created = await db.sPT.create({
      data: {
        sptId,
        name: input.name,
        description: input.description || null,
        category: input.category,
        baselineValue: input.baselineValue,
        targetValue: input.targetValue,
        unit: input.unit,
        startDate: new Date(input.startDate),
        targetDate: new Date(input.targetDate),
        notes: input.notes || null,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, sptId: created.sptId }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('sms_spts').insert({
    spt_id: sptId,
    name: input.name,
    description: input.description || null,
    category: input.category,
    baseline_value: input.baselineValue,
    target_value: input.targetValue,
    unit: input.unit,
    start_date: input.startDate,
    target_date: input.targetDate,
    notes: input.notes || null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true, sptId }
}

export async function updateSPTProgress(id: string, currentValue: number) {
  await requireAuth()

  const spts = await getSPTs()
  const spt = spts.find((s: any) => s.id === id)
  if (!spt) return { ok: false, error: 'SPT not found' }

  // Calculate progress %
  const totalChange = spt.targetValue - spt.baselineValue
  const currentChange = currentValue - spt.baselineValue
  const progressPercent = totalChange !== 0 ? Math.max(0, Math.min(100, (currentChange / totalChange) * 100)) : 0

  // Determine status
  let status = 'ON_TRACK'
  const now = new Date()
  const totalDuration = spt.targetDate.getTime() - spt.startDate.getTime()
  const elapsed = now.getTime() - spt.startDate.getTime()
  const expectedProgress = (elapsed / totalDuration) * 100

  if (progressPercent >= 100) status = 'ACHIEVED'
  else if (progressPercent >= expectedProgress - 10) status = 'ON_TRACK'
  else if (progressPercent >= expectedProgress - 25) status = 'AT_RISK'
  else status = 'OFF_TRACK'

  if (isDemoMode()) {
    await db.sPT.update({
      where: { id },
      data: { currentValue, progressPercent, status },
    })
    revalidatePath('/dashboard')
    return { ok: true, status, progressPercent }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('sms_spts').update({
    current_value: currentValue,
    progress_percent: progressPercent,
    status,
  }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true, status, progressPercent }
}

export async function deleteSPT(id: string) {
  await requireAuth()
  if (isDemoMode()) {
    await db.sPT.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('sms_spts').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================================
// SAFETY ACTIONS
// ============================================================================

export async function getSafetyActions() {
  await requireAuth()
  if (isDemoMode()) {
    return db.safetyAction.findMany({ orderBy: { dueDate: 'asc' } })
  }
  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('sms_safety_actions').select('*').order('due_date', { ascending: true })
  return (data ?? []).map((a: any) => mapAction(a))
}

function mapAction(a: any) {
  return {
    id: a.id,
    actionId: a.action_id,
    title: a.title,
    description: a.description,
    category: a.category,
    priority: a.priority,
    hazardId: a.hazard_id,
    spiId: a.spi_id,
    sptId: a.spt_id,
    assignedTo: a.assigned_to,
    assignedToCardId: a.assigned_to_card_id,
    dueDate: new Date(a.due_date),
    completedAt: a.completed_at ? new Date(a.completed_at) : null,
    status: a.status,
    estimatedCost: a.estimated_cost,
    actualCost: a.actual_cost,
    progressNotes: a.progress_notes,
    verificationResult: a.verification_result,
  }
}

export async function createSafetyAction(input: {
  title: string
  description: string
  category: string
  priority: string
  hazardId?: string
  spiId?: string
  sptId?: string
  assignedTo: string
  assignedToCardId?: string
  dueDate: string
  estimatedCost?: number
  notes?: string
}) {
  await requireAuth()
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 900) + 100
  const actionId = `SAP-${year}-${random}`

  if (isDemoMode()) {
    const created = await db.safetyAction.create({
      data: {
        actionId,
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority,
        hazardId: input.hazardId || null,
        spiId: input.spiId || null,
        sptId: input.sptId || null,
        assignedTo: input.assignedTo,
        assignedToCardId: input.assignedToCardId || null,
        dueDate: new Date(input.dueDate),
        estimatedCost: input.estimatedCost || null,
        progressNotes: input.notes || null,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, actionId: created.actionId }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('sms_safety_actions').insert({
    action_id: actionId,
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
    hazard_id: input.hazardId || null,
    spi_id: input.spiId || null,
    spt_id: input.sptId || null,
    assigned_to: input.assignedTo,
    assigned_to_card_id: input.assignedToCardId || null,
    due_date: input.dueDate,
    estimated_cost: input.estimatedCost || null,
    progress_notes: input.notes || null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true, actionId }
}

export async function updateSafetyActionStatus(id: string, status: string, progressNotes?: string, verificationResult?: string, actualCost?: number) {
  await requireAuth()
  const updateData: any = { status }
  if (progressNotes) updateData.progressNotes = progressNotes
  if (verificationResult) updateData.verificationResult = verificationResult
  if (actualCost != null) updateData.actualCost = actualCost
  if (status === 'COMPLETED') updateData.completedAt = new Date()

  if (isDemoMode()) {
    await db.safetyAction.update({ where: { id }, data: updateData })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supaUpdate: any = { status }
  if (progressNotes) supaUpdate.progress_notes = progressNotes
  if (verificationResult) supaUpdate.verification_result = verificationResult
  if (actualCost != null) supaUpdate.actual_cost = actualCost
  if (status === 'COMPLETED') supaUpdate.completed_at = new Date().toISOString()

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('sms_safety_actions').update(supaUpdate).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function deleteSafetyAction(id: string) {
  await requireAuth()
  if (isDemoMode()) {
    await db.safetyAction.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('sms_safety_actions').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================================
// SMS SUMMARY (za dashboard i PDF)
// ============================================================================

export async function getSMSSummary() {
  await requireAuth()
  const [hazards, spis, spts, actions] = await Promise.all([
    getHazards(), getSPIs(), getSPTs(), getSafetyActions(),
  ])

  const today = new Date()

  // Hazards
  const openHazards = hazards.filter(h => h.status === 'OPEN' || h.status === 'ASSESSED').length
  const mitigatedHazards = hazards.filter(h => h.status === 'MITIGATED' || h.status === 'CLOSED').length
  const criticalHazards = hazards.filter(h => h.initialRiskLevel === 'CRITICAL').length
  const highHazards = hazards.filter(h => h.initialRiskLevel === 'HIGH').length
  const overdueHazards = hazards.filter(h => h.dueDate && new Date(h.dueDate) < today && h.status !== 'CLOSED').length

  // Risk matrix distribution
  const riskMatrix: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
  for (const h of hazards) {
    riskMatrix[h.initialRiskLevel] = (riskMatrix[h.initialRiskLevel] || 0) + 1
  }

  // SPI status
  const greenSPIs = spis.filter(s => s.status === 'GREEN').length
  const amberSPIs = spis.filter(s => s.status === 'AMBER').length
  const redSPIs = spis.filter(s => s.status === 'RED').length

  // SPT progress
  const achievedSPTs = spts.filter(s => s.status === 'ACHIEVED').length
  const onTrackSPTs = spts.filter(s => s.status === 'ON_TRACK').length
  const atRiskSPTs = spts.filter(s => s.status === 'AT_RISK').length
  const offTrackSPTs = spts.filter(s => s.status === 'OFF_TRACK').length

  // Actions
  const openActions = actions.filter(a => a.status === 'OPEN' || a.status === 'IN_PROGRESS').length
  const completedActions = actions.filter(a => a.status === 'COMPLETED').length
  const overdueActions = actions.filter(a => a.dueDate && new Date(a.dueDate) < today && a.status !== 'COMPLETED').length
  const criticalActions = actions.filter(a => a.priority === 'CRITICAL' && a.status !== 'COMPLETED').length

  // By category (hazards)
  const hazardsByCategory: Record<string, number> = {}
  for (const h of hazards) {
    hazardsByCategory[h.category] = (hazardsByCategory[h.category] || 0) + 1
  }

  // By source (hazards)
  const hazardsBySource: Record<string, number> = {}
  for (const h of hazards) {
    hazardsBySource[h.source] = (hazardsBySource[h.source] || 0) + 1
  }

  return {
    hazards: {
      total: hazards.length,
      open: openHazards,
      mitigated: mitigatedHazards,
      critical: criticalHazards,
      high: highHazards,
      overdue: overdueHazards,
      byRiskLevel: riskMatrix,
      byCategory: hazardsByCategory,
      bySource: hazardsBySource,
    },
    spis: {
      total: spis.length,
      green: greenSPIs,
      amber: amberSPIs,
      red: redSPIs,
    },
    spts: {
      total: spts.length,
      achieved: achievedSPTs,
      onTrack: onTrackSPTs,
      atRisk: atRiskSPTs,
      offTrack: offTrackSPTs,
    },
    actions: {
      total: actions.length,
      open: openActions,
      completed: completedActions,
      overdue: overdueActions,
      critical: criticalActions,
    },
  }
}
