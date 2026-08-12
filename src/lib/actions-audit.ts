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
// AUDIT PROGRAMS
// ============================================================================

export async function getAuditPrograms() {
  await requireAuth()
  if (isDemoMode()) {
    return db.auditProgram.findMany({ orderBy: { plannedYear: 'desc' }, include: { audits: true } })
  }
  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('audit_programs').select('*, audits(*)').order('planned_year', { ascending: false })
  return (data ?? []).map((p: any) => mapProgram(p))
}

function mapProgram(p: any) {
  return {
    id: p.id,
    programId: p.program_id,
    title: p.title,
    auditType: p.audit_type,
    auditScope: p.audit_scope,
    auditStandard: p.audit_standard,
    plannedYear: p.planned_year,
    plannedQuarter: p.planned_quarter,
    plannedDate: p.planned_date ? new Date(p.planned_date) : null,
    actualDate: p.actual_date ? new Date(p.actual_date) : null,
    completedAt: p.completed_at ? new Date(p.completed_at) : null,
    leadAuditor: p.lead_auditor,
    leadAuditorCardId: p.lead_auditor_card_id,
    auditees: p.auditees,
    status: p.status,
    priority: p.priority,
    findingsCount: p.findings_count,
    majorFindings: p.major_findings,
    minorFindings: p.minor_findings,
    observations: p.observations,
    overallResult: p.overall_result,
    notes: p.notes,
  }
}

export async function createAuditProgram(input: {
  title: string
  auditType: string
  auditScope: string
  auditStandard?: string
  plannedYear: number
  plannedQuarter?: number
  plannedDate?: string
  leadAuditor: string
  leadAuditorCardId?: string
  auditees?: string
  priority?: string
  notes?: string
}) {
  await requireAuth()
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 900) + 100
  const programId = `AP-${year}-${random}`

  if (isDemoMode()) {
    const created = await db.auditProgram.create({
      data: {
        programId,
        title: input.title,
        auditType: input.auditType,
        auditScope: input.auditScope,
        auditStandard: input.auditStandard || null,
        plannedYear: input.plannedYear,
        plannedQuarter: input.plannedQuarter || null,
        plannedDate: input.plannedDate ? new Date(input.plannedDate) : null,
        leadAuditor: input.leadAuditor,
        leadAuditorCardId: input.leadAuditorCardId || null,
        auditees: input.auditees || null,
        priority: input.priority || 'MEDIUM',
        notes: input.notes || null,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, programId: created.programId }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('audit_programs').insert({
    program_id: programId,
    title: input.title,
    audit_type: input.auditType,
    audit_scope: input.auditScope,
    audit_standard: input.auditStandard || null,
    planned_year: input.plannedYear,
    planned_quarter: input.plannedQuarter || null,
    planned_date: input.plannedDate || null,
    lead_auditor: input.leadAuditor,
    lead_auditor_card_id: input.leadAuditorCardId || null,
    auditees: input.auditees || null,
    priority: input.priority || 'MEDIUM',
    notes: input.notes || null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true, programId }
}

export async function deleteAuditProgram(id: string) {
  await requireAuth()
  if (isDemoMode()) {
    await db.auditProgram.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('audit_programs').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================================
// AUDITS
// ============================================================================

export async function getAudits() {
  await requireAuth()
  if (isDemoMode()) {
    return db.audit.findMany({ orderBy: { scheduledDate: 'desc' }, include: { findings: true } })
  }
  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('audits').select('*, audit_findings(*)').order('scheduled_date', { ascending: false })
  return (data ?? []).map((a: any) => mapAudit(a))
}

function mapAudit(a: any) {
  return {
    id: a.id,
    auditId: a.audit_id,
    programId: a.program_id,
    title: a.title,
    auditType: a.audit_type,
    auditScope: a.audit_scope,
    auditStandard: a.audit_standard,
    description: a.description,
    scheduledDate: new Date(a.scheduled_date),
    startDate: a.start_date ? new Date(a.start_date) : null,
    endDate: a.end_date ? new Date(a.end_date) : null,
    reportDate: a.report_date ? new Date(a.report_date) : null,
    leadAuditor: a.lead_auditor,
    leadAuditorCardId: a.lead_auditor_card_id,
    auditTeam: a.audit_team,
    auditeeOrganization: a.auditee_organization,
    auditeeContact: a.auditee_contact,
    auditeeAreas: a.auditee_areas,
    status: a.status,
    overallResult: a.overall_result,
    summary: a.summary,
    recommendations: a.recommendations,
    reportUrl: a.report_url,
    findings: (a.audit_findings ?? []).map((f: any) => mapFinding(f)),
  }
}

export async function createAudit(input: {
  title: string
  auditType: string
  auditScope: string
  auditStandard?: string
  description?: string
  scheduledDate: string
  leadAuditor: string
  leadAuditorCardId?: string
  auditTeam?: string
  auditeeOrganization?: string
  auditeeContact?: string
  auditeeAreas?: string
  programId?: string
}) {
  await requireAuth()
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 900) + 100
  const auditId = `AUD-${year}-${random}`

  if (isDemoMode()) {
    const created = await db.audit.create({
      data: {
        auditId,
        programId: input.programId || null,
        title: input.title,
        auditType: input.auditType,
        auditScope: input.auditScope,
        auditStandard: input.auditStandard || null,
        description: input.description || null,
        scheduledDate: new Date(input.scheduledDate),
        leadAuditor: input.leadAuditor,
        leadAuditorCardId: input.leadAuditorCardId || null,
        auditTeam: input.auditTeam || null,
        auditeeOrganization: input.auditeeOrganization || null,
        auditeeContact: input.auditeeContact || null,
        auditeeAreas: input.auditeeAreas || null,
        status: 'SCHEDULED',
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, auditId: created.auditId }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('audits').insert({
    audit_id: auditId,
    program_id: input.programId || null,
    title: input.title,
    audit_type: input.auditType,
    audit_scope: input.auditScope,
    audit_standard: input.auditStandard || null,
    description: input.description || null,
    scheduled_date: input.scheduledDate,
    lead_auditor: input.leadAuditor,
    lead_auditor_card_id: input.leadAuditorCardId || null,
    audit_team: input.auditTeam || null,
    auditee_organization: input.auditeeOrganization || null,
    auditee_contact: input.auditeeContact || null,
    auditee_areas: input.auditeeAreas || null,
    status: 'SCHEDULED',
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true, auditId }
}

export async function updateAuditStatus(id: string, status: string, overallResult?: string, summary?: string, recommendations?: string) {
  await requireAuth()
  const updateData: any = { status }
  if (overallResult) updateData.overallResult = overallResult
  if (summary) updateData.summary = summary
  if (recommendations) updateData.recommendations = recommendations
  if (status === 'IN_PROGRESS' && !updateData.startDate) updateData.startDate = new Date()
  if (status === 'COMPLETED') {
    updateData.endDate = new Date()
    updateData.reportDate = new Date()
  }

  if (isDemoMode()) {
    await db.audit.update({ where: { id }, data: updateData })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supaUpdate: any = { status }
  if (overallResult) supaUpdate.overall_result = overallResult
  if (summary) supaUpdate.summary = summary
  if (recommendations) supaUpdate.recommendations = recommendations
  if (status === 'IN_PROGRESS') supaUpdate.start_date = new Date().toISOString()
  if (status === 'COMPLETED') {
    supaUpdate.end_date = new Date().toISOString()
    supaUpdate.report_date = new Date().toISOString()
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('audits').update(supaUpdate).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function deleteAudit(id: string) {
  await requireAuth()
  if (isDemoMode()) {
    await db.audit.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('audits').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================================
// AUDIT FINDINGS
// ============================================================================

export async function getFindings() {
  await requireAuth()
  if (isDemoMode()) {
    return db.auditFinding.findMany({ orderBy: { createdAt: 'desc' }, include: { audit: true } })
  }
  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('audit_findings').select('*, audits(*)').order('created_at', { ascending: false })
  return (data ?? []).map((f: any) => mapFinding(f))
}

function mapFinding(f: any) {
  const audit = f.audits || f.audit
  return {
    id: f.id,
    findingId: f.finding_id,
    auditId: f.audit_id,
    classification: f.classification,
    category: f.category,
    findingType: f.finding_type,
    title: f.title,
    description: f.description,
    criteria: f.criteria,
    evidence: f.evidence,
    area: f.area,
    process: f.process,
    rootCause: f.root_cause,
    immediateAction: f.immediate_action,
    preventiveAction: f.preventive_action,
    correctiveAction: f.corrective_action,
    status: f.status,
    assignedTo: f.assigned_to,
    dueDate: f.due_date ? new Date(f.due_date) : null,
    closedAt: f.closed_at ? new Date(f.closed_at) : null,
    closedBy: f.closed_by,
    verificationResult: f.verification_result,
    verifiedBy: f.verified_by,
    verifiedAt: f.verified_at ? new Date(f.verified_at) : null,
    riskLevel: f.risk_level,
    notes: f.notes,
    createdAt: new Date(f.created_at),
    audit: audit ? {
      id: audit.id,
      auditId: audit.audit_id,
      title: audit.title,
      auditType: audit.audit_type,
      scheduledDate: new Date(audit.scheduled_date),
      leadAuditor: audit.lead_auditor,
    } : null,
  }
}

export async function createFinding(input: {
  auditId: string
  classification: string
  category: string
  findingType: string
  title: string
  description: string
  criteria?: string
  evidence?: string
  area?: string
  process?: string
  assignedTo?: string
  dueDate?: string
  riskLevel?: string
  notes?: string
}) {
  await requireAuth()
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 900) + 100
  const findingId = `FIN-${year}-${random}`

  if (isDemoMode()) {
    const created = await db.auditFinding.create({
      data: {
        findingId,
        auditId: input.auditId,
        classification: input.classification,
        category: input.category,
        findingType: input.findingType,
        title: input.title,
        description: input.description,
        criteria: input.criteria || null,
        evidence: input.evidence || null,
        area: input.area || null,
        process: input.process || null,
        assignedTo: input.assignedTo || null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        riskLevel: input.riskLevel || null,
        notes: input.notes || null,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, findingId: created.findingId }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('audit_findings').insert({
    finding_id: findingId,
    audit_id: input.auditId,
    classification: input.classification,
    category: input.category,
    finding_type: input.findingType,
    title: input.title,
    description: input.description,
    criteria: input.criteria || null,
    evidence: input.evidence || null,
    area: input.area || null,
    process: input.process || null,
    assigned_to: input.assignedTo || null,
    due_date: input.dueDate || null,
    risk_level: input.riskLevel || null,
    notes: input.notes || null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true, findingId }
}

export async function updateFinding(id: string, input: {
  rootCause?: string
  immediateAction?: string
  correctiveAction?: string
  preventiveAction?: string
  status?: string
  verificationResult?: string
  verifiedBy?: string
}) {
  await requireAuth()
  const updateData: any = {}
  if (input.rootCause !== undefined) updateData.rootCause = input.rootCause
  if (input.immediateAction !== undefined) updateData.immediateAction = input.immediateAction
  if (input.correctiveAction !== undefined) updateData.correctiveAction = input.correctiveAction
  if (input.preventiveAction !== undefined) updateData.preventiveAction = input.preventiveAction
  if (input.status !== undefined) updateData.status = input.status
  if (input.verificationResult !== undefined) updateData.verificationResult = input.verificationResult
  if (input.verifiedBy !== undefined) updateData.verifiedBy = input.verifiedBy

  if (input.status === 'VERIFIED' || input.status === 'CLOSED') {
    updateData.verifiedAt = new Date()
    if (input.status === 'CLOSED') {
      updateData.closedAt = new Date()
      updateData.closedBy = input.verifiedBy
    }
  }

  if (isDemoMode()) {
    await db.auditFinding.update({ where: { id }, data: updateData })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supaUpdate: any = {}
  if (input.rootCause !== undefined) supaUpdate.root_cause = input.rootCause
  if (input.immediateAction !== undefined) supaUpdate.immediate_action = input.immediateAction
  if (input.correctiveAction !== undefined) supaUpdate.corrective_action = input.correctiveAction
  if (input.preventiveAction !== undefined) supaUpdate.preventive_action = input.preventiveAction
  if (input.status !== undefined) supaUpdate.status = input.status
  if (input.verificationResult !== undefined) supaUpdate.verification_result = input.verificationResult
  if (input.verifiedBy !== undefined) supaUpdate.verified_by = input.verifiedBy
  if (input.status === 'VERIFIED' || input.status === 'CLOSED') {
    supaUpdate.verified_at = new Date().toISOString()
    if (input.status === 'CLOSED') {
      supaUpdate.closed_at = new Date().toISOString()
      supaUpdate.closed_by = input.verifiedBy
    }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('audit_findings').update(supaUpdate).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function deleteFinding(id: string) {
  await requireAuth()
  if (isDemoMode()) {
    await db.auditFinding.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('audit_findings').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================================
// CAPA
// ============================================================================

export async function getCAPAs() {
  await requireAuth()
  if (isDemoMode()) {
    return db.cAPA.findMany({ orderBy: { createdAt: 'desc' } })
  }
  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('capas').select('*').order('created_at', { ascending: false })
  return (data ?? []).map((c: any) => mapCAPA(c))
}

function mapCAPA(c: any) {
  return {
    id: c.id,
    capaId: c.capa_id,
    title: c.title,
    description: c.description,
    type: c.type,
    source: c.source,
    sourceRef: c.source_ref,
    findingId: c.finding_id,
    problemStatement: c.problem_statement,
    rootCauseAnalysis: c.root_cause_analysis,
    rootCause: c.root_cause,
    correctiveAction: c.corrective_action,
    preventiveAction: c.preventive_action,
    actionPlan: c.action_plan,
    assignedTo: c.assigned_to,
    assignedToCardId: c.assigned_to_card_id,
    dueDate: new Date(c.due_date),
    completedAt: c.completed_at ? new Date(c.completed_at) : null,
    status: c.status,
    implementationEvidence: c.implementation_evidence,
    verificationMethod: c.verification_method,
    verificationResult: c.verification_result,
    verifiedBy: c.verified_by,
    verifiedAt: c.verified_at ? new Date(c.verified_at) : null,
    estimatedCost: c.estimated_cost,
    actualCost: c.actual_cost,
    progressNotes: c.progress_notes,
    closureNotes: c.closure_notes,
    createdAt: new Date(c.created_at),
  }
}

export async function createCAPA(input: {
  title: string
  description: string
  type: string
  source: string
  sourceRef?: string
  findingId?: string
  problemStatement: string
  rootCauseAnalysis?: string
  rootCause?: string
  correctiveAction?: string
  preventiveAction?: string
  actionPlan?: string
  assignedTo: string
  assignedToCardId?: string
  dueDate: string
  estimatedCost?: number
  notes?: string
}) {
  await requireAuth()
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 900) + 100
  const capaId = `CAPA-${year}-${random}`

  if (isDemoMode()) {
    const created = await db.cAPA.create({
      data: {
        capaId,
        title: input.title,
        description: input.description,
        type: input.type,
        source: input.source,
        sourceRef: input.sourceRef || null,
        findingId: input.findingId || null,
        problemStatement: input.problemStatement,
        rootCauseAnalysis: input.rootCauseAnalysis || null,
        rootCause: input.rootCause || null,
        correctiveAction: input.correctiveAction || null,
        preventiveAction: input.preventiveAction || null,
        actionPlan: input.actionPlan || null,
        assignedTo: input.assignedTo,
        assignedToCardId: input.assignedToCardId || null,
        dueDate: new Date(input.dueDate),
        estimatedCost: input.estimatedCost || null,
        progressNotes: input.notes || null,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, capaId: created.capaId }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('capas').insert({
    capa_id: capaId,
    title: input.title,
    description: input.description,
    type: input.type,
    source: input.source,
    source_ref: input.sourceRef || null,
    finding_id: input.findingId || null,
    problem_statement: input.problemStatement,
    root_cause_analysis: input.rootCauseAnalysis || null,
    root_cause: input.rootCause || null,
    corrective_action: input.correctiveAction || null,
    preventive_action: input.preventiveAction || null,
    action_plan: input.actionPlan || null,
    assigned_to: input.assignedTo,
    assigned_to_card_id: input.assignedToCardId || null,
    due_date: input.dueDate,
    estimated_cost: input.estimatedCost || null,
    progress_notes: input.notes || null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true, capaId }
}

export async function updateCAPA(id: string, input: {
  status?: string
  implementationEvidence?: string
  verificationMethod?: string
  verificationResult?: string
  verifiedBy?: string
  actualCost?: number
  progressNotes?: string
  closureNotes?: string
}) {
  await requireAuth()
  const updateData: any = {}
  if (input.status !== undefined) updateData.status = input.status
  if (input.implementationEvidence !== undefined) updateData.implementationEvidence = input.implementationEvidence
  if (input.verificationMethod !== undefined) updateData.verificationMethod = input.verificationMethod
  if (input.verificationResult !== undefined) updateData.verificationResult = input.verificationResult
  if (input.verifiedBy !== undefined) updateData.verifiedBy = input.verifiedBy
  if (input.actualCost !== undefined) updateData.actualCost = input.actualCost
  if (input.progressNotes !== undefined) updateData.progressNotes = input.progressNotes
  if (input.closureNotes !== undefined) updateData.closureNotes = input.closureNotes

  if (input.status === 'VERIFIED') {
    updateData.verifiedAt = new Date()
  }
  if (input.status === 'CLOSED') {
    updateData.completedAt = new Date()
    if (!updateData.verifiedAt) updateData.verifiedAt = new Date()
  }

  if (isDemoMode()) {
    await db.cAPA.update({ where: { id }, data: updateData })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supaUpdate: any = {}
  if (input.status !== undefined) supaUpdate.status = input.status
  if (input.implementationEvidence !== undefined) supaUpdate.implementation_evidence = input.implementationEvidence
  if (input.verificationMethod !== undefined) supaUpdate.verification_method = input.verificationMethod
  if (input.verificationResult !== undefined) supaUpdate.verification_result = input.verificationResult
  if (input.verifiedBy !== undefined) supaUpdate.verified_by = input.verifiedBy
  if (input.actualCost !== undefined) supaUpdate.actual_cost = input.actualCost
  if (input.progressNotes !== undefined) supaUpdate.progress_notes = input.progressNotes
  if (input.closureNotes !== undefined) supaUpdate.closure_notes = input.closureNotes
  if (input.status === 'VERIFIED') supaUpdate.verified_at = new Date().toISOString()
  if (input.status === 'CLOSED') {
    supaUpdate.completed_at = new Date().toISOString()
    if (!supaUpdate.verified_at) supaUpdate.verified_at = new Date().toISOString()
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('capas').update(supaUpdate).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function deleteCAPA(id: string) {
  await requireAuth()
  if (isDemoMode()) {
    await db.cAPA.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('capas').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================================
// COMPLIANCE MATRIX
// ============================================================================

export async function getComplianceItems() {
  await requireAuth()
  if (isDemoMode()) {
    return db.complianceItem.findMany({ orderBy: { regulation: 'asc' } })
  }
  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('compliance_items').select('*').order('regulation', { ascending: true })
  return (data ?? []).map((c: any) => mapCompliance(c))
}

function mapCompliance(c: any) {
  return {
    id: c.id,
    itemId: c.item_id,
    regulation: c.regulation,
    requirement: c.requirement,
    requirementText: c.requirement_text,
    category: c.category,
    internalDoc: c.internal_doc,
    docLocation: c.doc_location,
    docVersion: c.doc_version,
    docOwner: c.doc_owner,
    evidenceType: c.evidence_type,
    evidenceRef: c.evidence_ref,
    evidenceDescription: c.evidence_description,
    lastVerified: c.last_verified ? new Date(c.last_verified) : null,
    verifiedBy: c.verified_by,
    status: c.status,
    riskLevel: c.risk_level,
    gapDescription: c.gap_description,
    correctiveAction: c.corrective_action,
    nextReviewDate: c.next_review_date ? new Date(c.next_review_date) : null,
    reviewFrequency: c.review_frequency,
    notes: c.notes,
  }
}

export async function createComplianceItem(input: {
  regulation: string
  requirement: string
  requirementText?: string
  category: string
  internalDoc?: string
  docLocation?: string
  docVersion?: string
  docOwner?: string
  evidenceType?: string
  evidenceRef?: string
  evidenceDescription?: string
  status?: string
  riskLevel?: string
  gapDescription?: string
  correctiveAction?: string
  reviewFrequency?: string
  nextReviewDate?: string
  notes?: string
}) {
  await requireAuth()
  const random = Math.floor(Math.random() * 900) + 100
  const itemId = `CM-${random}`

  if (isDemoMode()) {
    const created = await db.complianceItem.create({
      data: {
        itemId,
        regulation: input.regulation,
        requirement: input.requirement,
        requirementText: input.requirementText || null,
        category: input.category,
        internalDoc: input.internalDoc || null,
        docLocation: input.docLocation || null,
        docVersion: input.docVersion || null,
        docOwner: input.docOwner || null,
        evidenceType: input.evidenceType || null,
        evidenceRef: input.evidenceRef || null,
        evidenceDescription: input.evidenceDescription || null,
        status: input.status || 'COMPLIANT',
        riskLevel: input.riskLevel || null,
        gapDescription: input.gapDescription || null,
        correctiveAction: input.correctiveAction || null,
        reviewFrequency: input.reviewFrequency || null,
        nextReviewDate: input.nextReviewDate ? new Date(input.nextReviewDate) : null,
        notes: input.notes || null,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, itemId: created.itemId }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('compliance_items').insert({
    item_id: itemId,
    regulation: input.regulation,
    requirement: input.requirement,
    requirement_text: input.requirementText || null,
    category: input.category,
    internal_doc: input.internalDoc || null,
    doc_location: input.docLocation || null,
    doc_version: input.docVersion || null,
    doc_owner: input.docOwner || null,
    evidence_type: input.evidenceType || null,
    evidence_ref: input.evidenceRef || null,
    evidence_description: input.evidenceDescription || null,
    status: input.status || 'COMPLIANT',
    risk_level: input.riskLevel || null,
    gap_description: input.gapDescription || null,
    corrective_action: input.correctiveAction || null,
    review_frequency: input.reviewFrequency || null,
    next_review_date: input.nextReviewDate || null,
    notes: input.notes || null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true, itemId }
}

export async function updateComplianceItem(id: string, input: {
  status?: string
  evidenceRef?: string
  evidenceDescription?: string
  lastVerified?: string
  verifiedBy?: string
  gapDescription?: string
  correctiveAction?: string
  nextReviewDate?: string
}) {
  await requireAuth()
  const updateData: any = {}
  if (input.status !== undefined) updateData.status = input.status
  if (input.evidenceRef !== undefined) updateData.evidenceRef = input.evidenceRef
  if (input.evidenceDescription !== undefined) updateData.evidenceDescription = input.evidenceDescription
  if (input.lastVerified !== undefined) updateData.lastVerified = new Date(input.lastVerified)
  if (input.verifiedBy !== undefined) updateData.verifiedBy = input.verifiedBy
  if (input.gapDescription !== undefined) updateData.gapDescription = input.gapDescription
  if (input.correctiveAction !== undefined) updateData.correctiveAction = input.correctiveAction
  if (input.nextReviewDate !== undefined) updateData.nextReviewDate = input.nextReviewDate ? new Date(input.nextReviewDate) : null

  if (isDemoMode()) {
    await db.complianceItem.update({ where: { id }, data: updateData })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supaUpdate: any = {}
  if (input.status !== undefined) supaUpdate.status = input.status
  if (input.evidenceRef !== undefined) supaUpdate.evidence_ref = input.evidenceRef
  if (input.evidenceDescription !== undefined) supaUpdate.evidence_description = input.evidenceDescription
  if (input.lastVerified !== undefined) supaUpdate.last_verified = input.lastVerified
  if (input.verifiedBy !== undefined) supaUpdate.verified_by = input.verifiedBy
  if (input.gapDescription !== undefined) supaUpdate.gap_description = input.gapDescription
  if (input.correctiveAction !== undefined) supaUpdate.corrective_action = input.correctiveAction
  if (input.nextReviewDate !== undefined) supaUpdate.next_review_date = input.nextReviewDate || null

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('compliance_items').update(supaUpdate).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function deleteComplianceItem(id: string) {
  await requireAuth()
  if (isDemoMode()) {
    await db.complianceItem.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('compliance_items').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================================
// AUDIT SUMMARY (za dashboard i PDF)
// ============================================================================

export async function getAuditSummary() {
  await requireAuth()
  const [programs, audits, findings, capas, items] = await Promise.all([
    getAuditPrograms(), getAudits(), getFindings(), getCAPAs(), getComplianceItems(),
  ])

  const today = new Date()

  // Programs
  const plannedPrograms = programs.filter(p => p.status === 'PLANNED' || p.status === 'SCHEDULED').length
  const completedPrograms = programs.filter(p => p.status === 'COMPLETED').length
  const overduePrograms = programs.filter(p => p.plannedDate && new Date(p.plannedDate) < today && p.status !== 'COMPLETED').length

  // Audits
  const scheduledAudits = audits.filter(a => a.status === 'SCHEDULED').length
  const completedAudits = audits.filter(a => a.status === 'COMPLETED').length
  const inProgressAudits = audits.filter(a => a.status === 'IN_PROGRESS').length

  // Findings
  const openFindings = findings.filter(f => f.status === 'OPEN' || f.status === 'IN_PROGRESS').length
  const closedFindings = findings.filter(f => f.status === 'CLOSED' || f.status === 'VERIFIED').length
  const majorFindings = findings.filter(f => f.classification === 'MAJOR').length
  const minorFindings = findings.filter(f => f.classification === 'MINOR').length
  const observations = findings.filter(f => f.classification === 'OBSERVATION').length
  const overdueFindings = findings.filter(f => f.dueDate && new Date(f.dueDate) < today && f.status !== 'CLOSED' && f.status !== 'VERIFIED').length

  // Findings by category
  const findingsByCategory: Record<string, number> = {}
  for (const f of findings) {
    findingsByCategory[f.category] = (findingsByCategory[f.category] || 0) + 1
  }

  // Findings by classification
  const findingsByClass: Record<string, number> = { MAJOR: 0, MINOR: 0, OBSERVATION: 0, POSITIVE: 0 }
  for (const f of findings) {
    findingsByClass[f.classification] = (findingsByClass[f.classification] || 0) + 1
  }

  // CAPA
  const openCAPAs = capas.filter(c => c.status === 'OPEN' || c.status === 'IN_PROGRESS').length
  const verifiedCAPAs = capas.filter(c => c.status === 'VERIFIED' || c.status === 'CLOSED').length
  const overdueCAPAs = capas.filter(c => c.dueDate && new Date(c.dueDate) < today && c.status !== 'CLOSED' && c.status !== 'VERIFIED').length

  // Compliance items
  const compliant = items.filter(i => i.status === 'COMPLIANT').length
  const nonCompliant = items.filter(i => i.status === 'NON_COMPLIANT').length
  const partial = items.filter(i => i.status === 'PARTIAL').length
  const pendingReview = items.filter(i => i.status === 'PENDING_REVIEW').length

  // Compliance by category
  const complianceByCategory: Record<string, { compliant: number; total: number }> = {}
  for (const i of items) {
    if (!complianceByCategory[i.category]) complianceByCategory[i.category] = { compliant: 0, total: 0 }
    complianceByCategory[i.category].total++
    if (i.status === 'COMPLIANT') complianceByCategory[i.category].compliant++
  }

  // Compliance rate
  const complianceRate = items.length > 0 ? (compliant / items.length) * 100 : 0

  return {
    programs: { total: programs.length, planned: plannedPrograms, completed: completedPrograms, overdue: overduePrograms },
    audits: { total: audits.length, scheduled: scheduledAudits, inProgress: inProgressAudits, completed: completedAudits },
    findings: {
      total: findings.length, open: openFindings, closed: closedFindings,
      major: majorFindings, minor: minorFindings, observations,
      overdue: overdueFindings, byCategory: findingsByCategory, byClass: findingsByClass,
    },
    capas: { total: capas.length, open: openCAPAs, verified: verifiedCAPAs, overdue: overdueCAPAs },
    compliance: {
      total: items.length, compliant, nonCompliant, partial, pendingReview,
      rate: complianceRate, byCategory: complianceByCategory,
    },
  }
}
