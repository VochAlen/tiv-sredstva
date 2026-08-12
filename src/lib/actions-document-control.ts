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
// CONTROLLED DOCUMENTS
// ============================================================================

export async function getDocuments() {
  await requireAuth()
  if (isDemoMode()) {
    return db.controlledDocument.findMany({
      orderBy: { docId: 'asc' },
      include: { versions: { orderBy: { revisionDate: 'desc' } }, reviews: { orderBy: { reviewDate: 'desc' } }, distributions: { orderBy: { distributionDate: 'desc' } } },
    })
  }
  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('controlled_documents')
    .select('*, document_versions(*) , document_reviews(*), document_distributions(*)')
    .order('doc_id', { ascending: true })
  return (data ?? []).map((d: any) => mapDocument(d))
}

function mapDocument(d: any) {
  return {
    id: d.id,
    docId: d.doc_id,
    title: d.title,
    description: d.description,
    category: d.category,
    docType: d.doc_type,
    standard: d.standard,
    currentVersion: d.current_version,
    status: d.status,
    effectiveDate: d.effective_date ? new Date(d.effective_date) : null,
    nextReviewDate: d.next_review_date ? new Date(d.next_review_date) : null,
    owner: d.owner,
    ownerCardId: d.owner_card_id,
    author: d.author,
    approver: d.approver,
    fileUrl: d.file_url,
    fileFormat: d.file_format,
    fileSize: d.file_size,
    location: d.location,
    reviewFrequency: d.review_frequency,
    lastReviewedAt: d.last_reviewed_at ? new Date(d.last_reviewed_at) : null,
    lastReviewedBy: d.last_reviewed_by,
    distributionList: d.distribution_list,
    classification: d.classification,
    keywords: d.keywords,
    notes: d.notes,
    versions: (d.document_versions ?? []).map((v: any) => mapVersion(v)).sort((a: any, b: any) => new Date(b.revisionDate).getTime() - new Date(a.revisionDate).getTime()),
    reviews: (d.document_reviews ?? []).map((r: any) => mapReview(r)).sort((a: any, b: any) => new Date(b.reviewDate).getTime() - new Date(a.reviewDate).getTime()),
    distributions: (d.document_distributions ?? []).map((dist: any) => mapDistribution(dist)).sort((a: any, b: any) => new Date(b.distributionDate).getTime() - new Date(a.distributionDate).getTime()),
  }
}

function mapVersion(v: any) {
  return {
    id: v.id,
    documentId: v.document_id,
    versionNumber: v.version_number,
    revisionDate: new Date(v.revision_date),
    revisedBy: v.revised_by,
    revisedByCardId: v.revised_by_card_id,
    approvedBy: v.approved_by,
    approvedAt: v.approved_at ? new Date(v.approved_at) : null,
    changeDescription: v.change_description,
    changeReason: v.change_reason,
    affectedSections: v.affected_sections,
    status: v.status,
    effectiveDate: v.effective_date ? new Date(v.effective_date) : null,
    fileUrl: v.file_url,
    fileSize: v.file_size,
    reviewNotes: v.review_notes,
  }
}

function mapReview(r: any) {
  return {
    id: r.id,
    documentId: r.document_id,
    reviewType: r.review_type,
    reviewDate: new Date(r.review_date),
    reviewer: r.reviewer,
    reviewerCardId: r.reviewer_card_id,
    result: r.result,
    reviewComments: r.review_comments,
    changesRequired: r.changes_required,
    newVersionRequired: r.new_version_required,
    actionTaken: r.action_taken,
    completedAt: r.completed_at ? new Date(r.completed_at) : null,
    status: r.status,
  }
}

function mapDistribution(d: any) {
  return {
    id: d.id,
    documentId: d.document_id,
    recipientName: d.recipient_name,
    recipientRole: d.recipient_role,
    recipientDepartment: d.recipient_department,
    recipientEmail: d.recipient_email,
    distributionDate: new Date(d.distribution_date),
    distributionMethod: d.distribution_method,
    distributedBy: d.distributed_by,
    acknowledged: d.acknowledged,
    acknowledgedAt: d.acknowledged_at ? new Date(d.acknowledged_at) : null,
    acknowledgedMethod: d.acknowledged_method,
    status: d.status,
    versionNumber: d.version_number,
    notes: d.notes,
  }
}

export async function createDocument(input: {
  docId: string
  title: string
  description?: string
  category: string
  docType: string
  standard?: string
  currentVersion?: string
  status?: string
  effectiveDate?: string
  nextReviewDate?: string
  owner: string
  ownerCardId?: string
  author?: string
  approver?: string
  fileUrl?: string
  fileFormat?: string
  location?: string
  reviewFrequency?: string
  classification?: string
  keywords?: string
  notes?: string
}) {
  await requireAuth()

  if (isDemoMode()) {
    const created = await db.controlledDocument.create({
      data: {
        docId: input.docId,
        title: input.title,
        description: input.description || null,
        category: input.category,
        docType: input.docType,
        standard: input.standard || null,
        currentVersion: input.currentVersion || '1.0',
        status: input.status || 'DRAFT',
        effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null,
        nextReviewDate: input.nextReviewDate ? new Date(input.nextReviewDate) : null,
        owner: input.owner,
        ownerCardId: input.ownerCardId || null,
        author: input.author || null,
        approver: input.approver || null,
        fileUrl: input.fileUrl || null,
        fileFormat: input.fileFormat || null,
        location: input.location || null,
        reviewFrequency: input.reviewFrequency || 'ANNUAL',
        classification: input.classification || 'INTERNAL',
        keywords: input.keywords || null,
        notes: input.notes || null,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, docId: created.docId }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('controlled_documents').insert({
    doc_id: input.docId,
    title: input.title,
    description: input.description || null,
    category: input.category,
    doc_type: input.docType,
    standard: input.standard || null,
    current_version: input.currentVersion || '1.0',
    status: input.status || 'DRAFT',
    effective_date: input.effectiveDate || null,
    next_review_date: input.nextReviewDate || null,
    owner: input.owner,
    owner_card_id: input.ownerCardId || null,
    author: input.author || null,
    approver: input.approver || null,
    file_url: input.fileUrl || null,
    file_format: input.fileFormat || null,
    location: input.location || null,
    review_frequency: input.reviewFrequency || 'ANNUAL',
    classification: input.classification || 'INTERNAL',
    keywords: input.keywords || null,
    notes: input.notes || null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true, docId: input.docId }
}

export async function updateDocument(id: string, input: {
  title?: string
  description?: string
  status?: string
  effectiveDate?: string
  nextReviewDate?: string
  owner?: string
  approver?: string
  fileUrl?: string
  classification?: string
  keywords?: string
  notes?: string
}) {
  await requireAuth()
  const updateData: any = {}
  if (input.title !== undefined) updateData.title = input.title
  if (input.description !== undefined) updateData.description = input.description
  if (input.status !== undefined) updateData.status = input.status
  if (input.effectiveDate !== undefined) updateData.effectiveDate = input.effectiveDate ? new Date(input.effectiveDate) : null
  if (input.nextReviewDate !== undefined) updateData.nextReviewDate = input.nextReviewDate ? new Date(input.nextReviewDate) : null
  if (input.owner !== undefined) updateData.owner = input.owner
  if (input.approver !== undefined) updateData.approver = input.approver
  if (input.fileUrl !== undefined) updateData.fileUrl = input.fileUrl
  if (input.classification !== undefined) updateData.classification = input.classification
  if (input.keywords !== undefined) updateData.keywords = input.keywords
  if (input.notes !== undefined) updateData.notes = input.notes

  if (input.status === 'PUBLISHED' && !updateData.effectiveDate) {
    updateData.effectiveDate = new Date()
  }

  if (isDemoMode()) {
    await db.controlledDocument.update({ where: { id }, data: updateData })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supaUpdate: any = {}
  if (input.title !== undefined) supaUpdate.title = input.title
  if (input.description !== undefined) supaUpdate.description = input.description
  if (input.status !== undefined) supaUpdate.status = input.status
  if (input.effectiveDate !== undefined) supaUpdate.effective_date = input.effectiveDate || null
  if (input.nextReviewDate !== undefined) supaUpdate.next_review_date = input.nextReviewDate || null
  if (input.owner !== undefined) supaUpdate.owner = input.owner
  if (input.approver !== undefined) supaUpdate.approver = input.approver
  if (input.fileUrl !== undefined) supaUpdate.file_url = input.fileUrl
  if (input.classification !== undefined) supaUpdate.classification = input.classification
  if (input.keywords !== undefined) supaUpdate.keywords = input.keywords
  if (input.notes !== undefined) supaUpdate.notes = input.notes
  if (input.status === 'PUBLISHED' && !supaUpdate.effective_date) {
    supaUpdate.effective_date = new Date().toISOString()
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('controlled_documents').update(supaUpdate).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function deleteDocument(id: string) {
  await requireAuth()
  if (isDemoMode()) {
    await db.controlledDocument.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('controlled_documents').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================================
// DOCUMENT VERSIONS
// ============================================================================

export async function createVersion(input: {
  documentId: string
  versionNumber: string
  revisedBy: string
  revisedByCardId?: string
  approvedBy?: string
  changeDescription: string
  changeReason?: string
  affectedSections?: string
  status?: string
  effectiveDate?: string
  fileUrl?: string
  reviewNotes?: string
}) {
  await requireAuth()

  if (isDemoMode()) {
    const created = await db.documentVersion.create({
      data: {
        documentId: input.documentId,
        versionNumber: input.versionNumber,
        revisedBy: input.revisedBy,
        revisedByCardId: input.revisedByCardId || null,
        approvedBy: input.approvedBy || null,
        approvedAt: input.approvedBy ? new Date() : null,
        changeDescription: input.changeDescription,
        changeReason: input.changeReason || null,
        affectedSections: input.affectedSections || null,
        status: input.status || 'DRAFT',
        effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null,
        fileUrl: input.fileUrl || null,
        reviewNotes: input.reviewNotes || null,
      },
    })

    // Update document's current version
    if (input.status === 'PUBLISHED') {
      await db.controlledDocument.update({
        where: { id: input.documentId },
        data: {
          currentVersion: input.versionNumber,
          status: 'PUBLISHED',
          effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : new Date(),
        },
      })
    }

    revalidatePath('/dashboard')
    return { ok: true, id: created.id }
  }

  const supabase = await createSupabaseClient()
  const { data: version, error } = await supabase.from('document_versions').insert({
    document_id: input.documentId,
    version_number: input.versionNumber,
    revised_by: input.revisedBy,
    revised_by_card_id: input.revisedByCardId || null,
    approved_by: input.approvedBy || null,
    approved_at: input.approvedBy ? new Date().toISOString() : null,
    change_description: input.changeDescription,
    change_reason: input.changeReason || null,
    affected_sections: input.affectedSections || null,
    status: input.status || 'DRAFT',
    effective_date: input.effectiveDate || null,
    file_url: input.fileUrl || null,
    review_notes: input.reviewNotes || null,
  }).select().single()

  if (error) return { ok: false, error: error.message }

  // Update document's current version
  if (input.status === 'PUBLISHED') {
    await supabase.from('controlled_documents').update({
      current_version: input.versionNumber,
      status: 'PUBLISHED',
      effective_date: input.effectiveDate || new Date().toISOString(),
    }).eq('id', input.documentId)
  }

  revalidatePath('/dashboard')
  return { ok: true, id: version?.id }
}

export async function deleteVersion(id: string) {
  await requireAuth()
  if (isDemoMode()) {
    await db.documentVersion.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('document_versions').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================================
// DOCUMENT REVIEWS
// ============================================================================

export async function createReview(input: {
  documentId: string
  reviewType: string
  reviewer: string
  reviewerCardId?: string
  result: string
  reviewComments?: string
  changesRequired?: string
  newVersionRequired?: boolean
  actionTaken?: string
  status?: string
}) {
  await requireAuth()

  const status = input.status || 'OPEN'
  const completedAt = status === 'COMPLETED' ? new Date() : null

  if (isDemoMode()) {
    const created = await db.documentReview.create({
      data: {
        documentId: input.documentId,
        reviewType: input.reviewType,
        reviewer: input.reviewer,
        reviewerCardId: input.reviewerCardId || null,
        result: input.result,
        reviewComments: input.reviewComments || null,
        changesRequired: input.changesRequired || null,
        newVersionRequired: input.newVersionRequired || false,
        actionTaken: input.actionTaken || null,
        status,
        completedAt,
      },
    })

    // Update document's last reviewed
    await db.controlledDocument.update({
      where: { id: input.documentId },
      data: {
        lastReviewedAt: new Date(),
        lastReviewedBy: input.reviewer,
      },
    })

    revalidatePath('/dashboard')
    return { ok: true, id: created.id }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('document_reviews').insert({
    document_id: input.documentId,
    review_type: input.reviewType,
    reviewer: input.reviewer,
    reviewer_card_id: input.reviewerCardId || null,
    result: input.result,
    review_comments: input.reviewComments || null,
    changes_required: input.changesRequired || null,
    new_version_required: input.newVersionRequired || false,
    action_taken: input.actionTaken || null,
    status,
    completed_at: completedAt?.toISOString() || null,
  })

  if (error) return { ok: false, error: error.message }

  // Update document's last reviewed
  await supabase.from('controlled_documents').update({
    last_reviewed_at: new Date().toISOString(),
    last_reviewed_by: input.reviewer,
  }).eq('id', input.documentId)

  revalidatePath('/dashboard')
  return { ok: true }
}

export async function deleteReview(id: string) {
  await requireAuth()
  if (isDemoMode()) {
    await db.documentReview.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('document_reviews').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================================
// DOCUMENT DISTRIBUTION
// ============================================================================

export async function createDistribution(input: {
  documentId: string
  recipientName: string
  recipientRole?: string
  recipientDepartment?: string
  recipientEmail?: string
  distributionMethod: string
  distributedBy: string
  versionNumber?: string
  notes?: string
}) {
  await requireAuth()

  if (isDemoMode()) {
    const created = await db.documentDistribution.create({
      data: {
        documentId: input.documentId,
        recipientName: input.recipientName,
        recipientRole: input.recipientRole || null,
        recipientDepartment: input.recipientDepartment || null,
        recipientEmail: input.recipientEmail || null,
        distributionMethod: input.distributionMethod,
        distributedBy: input.distributedBy,
        versionNumber: input.versionNumber || null,
        notes: input.notes || null,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, id: created.id }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('document_distributions').insert({
    document_id: input.documentId,
    recipient_name: input.recipientName,
    recipient_role: input.recipientRole || null,
    recipient_department: input.recipientDepartment || null,
    recipient_email: input.recipientEmail || null,
    distribution_method: input.distributionMethod,
    distributed_by: input.distributedBy,
    version_number: input.versionNumber || null,
    notes: input.notes || null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function acknowledgeDistribution(id: string, method: string) {
  await requireAuth()
  if (isDemoMode()) {
    await db.documentDistribution.update({
      where: { id },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedMethod: method,
        status: 'ACKNOWLEDGED',
      },
    })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('document_distributions').update({
    acknowledged: true,
    acknowledged_at: new Date().toISOString(),
    acknowledged_method: method,
    status: 'ACKNOWLEDGED',
  }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function deleteDistribution(id: string) {
  await requireAuth()
  if (isDemoMode()) {
    await db.documentDistribution.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('document_distributions').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================================
// STATISTICS / SUMMARY
// ============================================================================

export async function getDocumentStats() {
  await requireAuth()
  const docs = await getDocuments()
  const today = new Date()

  // By status
  const byStatus: Record<string, number> = {}
  for (const d of docs) {
    byStatus[d.status] = (byStatus[d.status] || 0) + 1
  }

  // By category
  const byCategory: Record<string, number> = {}
  for (const d of docs) {
    byCategory[d.category] = (byCategory[d.category] || 0) + 1
  }

  // By doc type
  const byDocType: Record<string, number> = {}
  for (const d of docs) {
    byDocType[d.docType] = (byDocType[d.docType] || 0) + 1
  }

  // By owner
  const byOwner: Record<string, number> = {}
  for (const d of docs) {
    byOwner[d.owner] = (byOwner[d.owner] || 0) + 1
  }

  // By classification
  const byClassification: Record<string, number> = {}
  for (const d of docs) {
    byClassification[d.classification] = (byClassification[d.classification] || 0) + 1
  }

  // Reviews due (next 30 days)
  const reviewsDueSoon = docs.filter(d => d.nextReviewDate && d.nextReviewDate <= new Date(today.getTime() + 30 * 86400000) && d.nextReviewDate >= today)
  // Reviews overdue
  const reviewsOverdue = docs.filter(d => d.nextReviewDate && d.nextReviewDate < today && d.status === 'PUBLISHED')
  // Never reviewed
  const neverReviewed = docs.filter(d => !d.lastReviewedAt && d.status === 'PUBLISHED')

  // Total versions across all documents
  let totalVersions = 0
  let totalReviews = 0
  let totalDistributions = 0
  for (const d of docs) {
    totalVersions += d.versions?.length || 0
    totalReviews += d.reviews?.length || 0
    totalDistributions += d.distributions?.length || 0
  }

  // Acknowledgment rate
  const acknowledgedDistributions = docs.reduce((sum, d) => sum + (d.distributions?.filter(dist => dist.acknowledged).length || 0), 0)
  const ackRate = totalDistributions > 0 ? (acknowledgedDistributions / totalDistributions) * 100 : 0

  // Reviews by result
  const reviewsByResult: Record<string, number> = {}
  for (const d of docs) {
    for (const r of (d.reviews || [])) {
      reviewsByResult[r.result] = (reviewsByResult[r.result] || 0) + 1
    }
  }

  // Recent version changes (last 90 days)
  const recentCutoff = new Date(today.getTime() - 90 * 86400000)
  const recentVersions = docs.reduce((sum, d) => sum + (d.versions?.filter(v => new Date(v.revisionDate) >= recentCutoff).length || 0), 0)

  return {
    total: docs.length,
    byStatus,
    byCategory,
    byDocType,
    byOwner,
    byClassification,
    reviewsDueSoon: reviewsDueSoon.length,
    reviewsOverdue: reviewsOverdue.length,
    neverReviewed: neverReviewed.length,
    totalVersions,
    totalReviews,
    totalDistributions,
    acknowledgedDistributions,
    ackRate,
    reviewsByResult,
    recentVersions,
    publishedCount: byStatus.PUBLISHED || 0,
    draftCount: byStatus.DRAFT || 0,
    supersededCount: byStatus.SUPERSEDED || 0,
  }
}
