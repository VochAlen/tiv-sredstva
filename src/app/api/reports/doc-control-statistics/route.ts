// src/app/api/reports/doc-control-statistics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { getDocuments, getDocumentStats } from '@/lib/actions-document-control'
import { ReportBuilder, MARGIN, pdfResponse } from '@/lib/pdf-report-kit'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nacrt', UNDER_REVIEW: 'Na pregledu', APPROVED: 'Odobren',
  PUBLISHED: 'Objavljen', SUPERSEDED: 'Zamijenjen', WITHDRAWN: 'Povucen',
}
const CATEGORY_LABELS: Record<string, string> = {
  MANUAL: 'Manual', PROCEDURE: 'Procedura', WORK_INSTRUCTION: 'Radno uputstvo',
  FORM: 'Formular', RECORD: 'Evidencija', POLICY: 'Politika', PLAN: 'Plan', OTHER: 'Ostalo',
}
const DOC_TYPE_LABELS: Record<string, string> = {
  OPERATIONS: 'Operacije', MAINTENANCE: 'Odrzavanje', SAFETY: 'Sigurnost',
  QUALITY: 'Kvalitet', TRAINING: 'Obuka', ADMINISTRATIVE: 'Administrativno', TECHNICAL: 'Tehnicko',
}
const CLASSIFICATION_LABELS: Record<string, string> = {
  PUBLIC: 'Javno', INTERNAL: 'Interni', CONFIDENTIAL: 'Povjerljivo', RESTRICTED: 'Ogranicno',
}
const REVIEW_RESULT_LABELS: Record<string, string> = {
  NO_CHANGE_NEEDED: 'Bez promjene', MINOR_UPDATE: 'Minor update',
  MAJOR_REVISION: 'Velika revizija', WITHDRAW: 'Povuci', SUPERSEDE: 'Zamijeniti',
}

function maxOf(obj: Record<string, number>) {
  const values = Object.values(obj)
  return values.length ? Math.max(...values, 1) : 1
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const [docs, stats] = await Promise.all([getDocuments(), getDocumentStats()])

  const r = await ReportBuilder.create()
  r.header({
    title: 'STATISTIKA DOCUMENT CONTROL SISTEMA',
    subtitle: 'Pregled stanja dokumentacije po statusu, kategoriji, tipu i klasifikaciji',
    regRef: 'EASA Part-145.A.65 / A.70 / A.85 - Document Control & Configuration Management',
    generatedBy: user.full_name,
    generatedRole: user.role,
  })

  r.kpiRow([
    { label: 'Ukupno dokumenata', value: stats.total },
    { label: 'Objavljeno', value: stats.publishedCount },
    { label: 'Reviews overdue', value: stats.reviewsOverdue },
    { label: 'Ack rate', value: `${stats.ackRate.toFixed(0)}%` },
  ])
  r.kpiRow([
    { label: 'Ukupno verzija', value: stats.totalVersions },
    { label: 'Nacrt dokumenata', value: stats.draftCount },
    { label: 'Reviews uskoro', value: stats.reviewsDueSoon },
    { label: 'Distribucija (potvrdjeno)', value: `${stats.acknowledgedDistributions}/${stats.totalDistributions}` },
  ])

  r.sectionTitle('PO STATUSU')
  const maxStatus = maxOf(stats.byStatus)
  Object.entries(STATUS_LABELS).forEach(([k, label]) => r.bar(label, (stats.byStatus as any)[k] ?? 0, maxStatus, rgb(0.2, 0.4, 0.75)))

  r.sectionTitle('PO KATEGORIJI')
  const maxCategory = maxOf(stats.byCategory)
  Object.entries(CATEGORY_LABELS).forEach(([k, label]) => r.bar(label, (stats.byCategory as any)[k] ?? 0, maxCategory, rgb(0.35, 0.25, 0.6)))

  r.sectionTitle('PO TIPU DOKUMENTA')
  const maxDocType = maxOf(stats.byDocType)
  Object.entries(DOC_TYPE_LABELS).forEach(([k, label]) => r.bar(label, (stats.byDocType as any)[k] ?? 0, maxDocType, rgb(0.15, 0.5, 0.45)))

  r.sectionTitle('PO KLASIFIKACIJI')
  const maxClass = maxOf(stats.byClassification)
  Object.entries(CLASSIFICATION_LABELS).forEach(([k, label]) => {
    const color = k === 'PUBLIC' ? rgb(0.1, 0.55, 0.15) : k === 'INTERNAL' ? rgb(0.2, 0.4, 0.75) : k === 'CONFIDENTIAL' ? rgb(0.85, 0.55, 0.1) : rgb(0.86, 0.15, 0.15)
    r.bar(label, (stats.byClassification as any)[k] ?? 0, maxClass, color)
  })

  if (Object.keys(stats.reviewsByResult).length > 0) {
    r.sectionTitle('REVIEWS PO REZULTATU')
    const maxResult = maxOf(stats.reviewsByResult)
    Object.entries(REVIEW_RESULT_LABELS).forEach(([k, label]) => r.bar(label, (stats.reviewsByResult as any)[k] ?? 0, maxResult, rgb(0.85, 0.55, 0.1)))
  }

  const topOwners = Object.entries(stats.byOwner).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10)
  if (topOwners.length > 0) {
    r.sectionTitle('TOP 10 VLASNIKA DOKUMENATA')
    const maxOwner = Math.max(...topOwners.map(([, v]: any) => v), 1)
    topOwners.forEach(([owner, count]: any) => r.bar(owner, count, maxOwner, rgb(0.3, 0.3, 0.3)))
  }

  r.certificationBlock(user.full_name, user.role, 'Statisticki pregled document control sistema - EASA Part-145.A.65/A.70/A.85')
  r.finalizePageNumbers()

  const pdf = await r.save()
  return pdfResponse(pdf, `doc-control-statistics-${new Date().toISOString().slice(0, 10)}.pdf`)
}