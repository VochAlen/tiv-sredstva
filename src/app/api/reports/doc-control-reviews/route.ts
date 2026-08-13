// src/app/api/reports/doc-control-reviews/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { getDocuments } from '@/lib/actions-document-control'
import { ReportBuilder, MARGIN, pdfResponse } from '@/lib/pdf-report-kit'

const REVIEW_TYPE_LABELS: Record<string, string> = {
  SCHEDULED: 'Zakazani', AD_HOC: 'Ad hoc', CHANGE_REQUEST: 'Zahtjev za promjenu', INCIDENT_DRIVEN: 'Iz incidenta',
}
const REVIEW_RESULT_LABELS: Record<string, string> = {
  NO_CHANGE_NEEDED: 'Bez promjene', MINOR_UPDATE: 'Minor update',
  MAJOR_REVISION: 'Velika revizija', WITHDRAW: 'Povuci', SUPERSEDE: 'Zamijeniti',
}
const REVIEW_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Otvoren', IN_PROGRESS: 'U toku', COMPLETED: 'Zavrsen', CANCELLED: 'Otkazan',
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const docs = await getDocuments()
  const allReviews = docs.flatMap((d: any) =>
    (d.reviews || []).map((rv: any) => ({ ...rv, docId: d.docId, docTitle: d.title }))
  ).sort((a: any, b: any) => new Date(b.reviewDate).getTime() - new Date(a.reviewDate).getTime())

  const r = await ReportBuilder.create()
  r.header({
    title: 'IZVJESTAJ O PREGLEDIMA DOKUMENATA (DOCUMENT REVIEWS)',
    subtitle: 'Periodicni i ad-hoc pregledi kontrolisanih dokumenata',
    regRef: 'EASA Part-145.A.65 (procedures & quality system review cycle)',
    generatedBy: user.full_name,
    generatedRole: user.role,
    extra: [`Ukupno zabiljezenih pregleda: ${allReviews.length}`],
  })

  const completed = allReviews.filter((rv: any) => rv.status === 'COMPLETED').length
  const open = allReviews.filter((rv: any) => rv.status === 'OPEN').length
  const majorRevision = allReviews.filter((rv: any) => rv.result === 'MAJOR_REVISION').length

  r.kpiRow([
    { label: 'Ukupno pregleda', value: allReviews.length },
    { label: 'Zavrseno', value: completed },
    { label: 'Otvoreno', value: open },
    { label: 'Velike revizije', value: majorRevision },
  ])

  r.sectionTitle('PREGLEDI')
  const cols = [
    { x: MARGIN, label: 'Doc ID' },
    { x: MARGIN + 65, label: 'Tip' },
    { x: MARGIN + 140, label: 'Datum' },
    { x: MARGIN + 205, label: 'Reviewer' },
    { x: MARGIN + 300, label: 'Rezultat' },
    { x: MARGIN + 400, label: 'Status' },
    { x: MARGIN + 460, label: 'Nova ver.' },
  ]
  r.tableHeader(cols)

  for (const rv of allReviews) {
    r.ensureSpace(24)
    r.text(rv.docId, cols[0].x, { size: 7, bold: true })
    r.text(REVIEW_TYPE_LABELS[rv.reviewType] ?? rv.reviewType, cols[1].x, { size: 7 })
    r.text(new Date(rv.reviewDate).toLocaleDateString('hr-HR'), cols[2].x, { size: 7 })
    r.text((rv.reviewer ?? '').slice(0, 16), cols[3].x, { size: 7 })
    const isMajor = rv.result === 'MAJOR_REVISION' || rv.result === 'WITHDRAW'
    r.text(REVIEW_RESULT_LABELS[rv.result] ?? rv.result, cols[4].x, { size: 7, color: isMajor ? rgb(0.8, 0.3, 0.1) : undefined, bold: isMajor })
    r.text(REVIEW_STATUS_LABELS[rv.status] ?? rv.status, cols[5].x, { size: 7 })
    r.text(rv.newVersionRequired ? 'DA' : '-', cols[6].x, { size: 7, bold: rv.newVersionRequired })
    r.line(11)
    if (rv.changesRequired) {
      r.text(`Potrebne promjene: ${rv.changesRequired}`.slice(0, 110), MARGIN + 10, { size: 6, color: rgb(0.6, 0.45, 0.1) })
      r.line(9)
    }
  }

  r.certificationBlock(user.full_name, user.role, 'Izvjestaj o pregledima - EASA Part-145.A.65 (quality feedback loop)')
  r.finalizePageNumbers()

  const pdf = await r.save()
  return pdfResponse(pdf, `doc-control-reviews-${new Date().toISOString().slice(0, 10)}.pdf`)
}