// src/app/api/reports/doc-control-documents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { getDocuments } from '@/lib/actions-document-control'
import { ReportBuilder, MARGIN, pdfResponse, PAGE_WIDTH } from '@/lib/pdf-report-kit'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nacrt', UNDER_REVIEW: 'Na pregledu', APPROVED: 'Odobren',
  PUBLISHED: 'Objavljen', SUPERSEDED: 'Zamijenjen', WITHDRAWN: 'Povucen',
}
const CATEGORY_LABELS: Record<string, string> = {
  MANUAL: 'Manual', PROCEDURE: 'Procedura', WORK_INSTRUCTION: 'Radno uputstvo',
  FORM: 'Formular', RECORD: 'Evidencija', POLICY: 'Politika', PLAN: 'Plan', OTHER: 'Ostalo',
}
const CLASSIFICATION_LABELS: Record<string, string> = {
  PUBLIC: 'Javno', INTERNAL: 'Interni', CONFIDENTIAL: 'Povjerljivo', RESTRICTED: 'Ogranicno',
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')
  const categoryFilter = searchParams.get('category')

  const allDocs = await getDocuments()
  const docs = allDocs.filter((d: any) => {
    if (statusFilter && d.status !== statusFilter) return false
    if (categoryFilter && d.category !== categoryFilter) return false
    return true
  })

  const r = await ReportBuilder.create()
  r.header({
    title: 'REGISTAR KONTROLISANIH DOKUMENATA (DOCUMENT REGISTER)',
    subtitle: 'ICAO Annex 19 / ISO 9001 - Document Control',
    regRef: 'EASA Part-145.A.65 / A.70 (Maintenance Organisation Exposition) / A.85 (Amandmani)',
    generatedBy: user.full_name,
    generatedRole: user.role,
    extra: [`Ukupno dokumenata u registru: ${docs.length}`],
  })

  const today = new Date()
  const overdue = docs.filter((d: any) => d.nextReviewDate && new Date(d.nextReviewDate) < today && d.status === 'PUBLISHED').length
  const published = docs.filter((d: any) => d.status === 'PUBLISHED').length
  const draft = docs.filter((d: any) => d.status === 'DRAFT').length

  r.kpiRow([
    { label: 'Ukupno', value: docs.length },
    { label: 'Objavljeno', value: published },
    { label: 'Nacrt', value: draft },
    { label: 'Review overdue', value: overdue },
  ])

  r.sectionTitle('REGISTAR DOKUMENATA')
  const cols = [
    { x: MARGIN, label: 'Doc ID' },
    { x: MARGIN + 65, label: 'Naslov' },
    { x: MARGIN + 260, label: 'Kategorija' },
    { x: MARGIN + 340, label: 'Status' },
    { x: MARGIN + 410, label: 'Verzija' },
    { x: MARGIN + 455, label: 'Vlasnik' },
    { x: PAGE_WIDTH - MARGIN - 70, label: 'Rok pregl.' },
  ]
  r.tableHeader(cols)

  for (const d of docs) {
    r.ensureSpace(24)
const isOverdue = !!(d.nextReviewDate && new Date(d.nextReviewDate) < today && d.status === 'PUBLISHED')
    r.text(d.docId, cols[0].x, { size: 7, bold: true })
    r.text((d.title ?? '').slice(0, 34), cols[1].x, { size: 7 })
    r.text(CATEGORY_LABELS[d.category] ?? d.category, cols[2].x, { size: 7 })
    r.text(STATUS_LABELS[d.status] ?? d.status, cols[3].x, { size: 7 })
    r.text(`v${d.currentVersion}`, cols[4].x, { size: 7 })
    r.text((d.owner ?? '').slice(0, 12), cols[5].x, { size: 7 })
    if (d.nextReviewDate) {
      r.text(new Date(d.nextReviewDate).toLocaleDateString('hr-HR'), cols[6].x, {
        size: 7,
        color: isOverdue ? rgb(0.86, 0.15, 0.15) : undefined,
        bold: isOverdue,
      })
    } else {
      r.text('-', cols[6].x, { size: 7 })
    }
    r.line(11)
    if (d.standard) {
      r.text(`Standard: ${d.standard}  ·  Klasifikacija: ${CLASSIFICATION_LABELS[d.classification] ?? d.classification}`, MARGIN + 10, { size: 6, color: rgb(0.5, 0.5, 0.5) })
      r.line(9)
    }
  }

  r.certificationBlock(user.full_name, user.role, 'Registar kontrolisanih dokumenata - EASA Part-145.A.70 (Maintenance Organisation Exposition)')
  r.finalizePageNumbers()

  const pdf = await r.save()
  return pdfResponse(pdf, `doc-control-documents-${new Date().toISOString().slice(0, 10)}.pdf`)
}