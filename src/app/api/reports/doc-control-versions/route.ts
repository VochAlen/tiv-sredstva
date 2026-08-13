// src/app/api/reports/doc-control-versions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { getDocuments } from '@/lib/actions-document-control'
import { ReportBuilder, MARGIN, pdfResponse, PAGE_WIDTH } from '@/lib/pdf-report-kit'

const VERSION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nacrt', UNDER_REVIEW: 'Na pregledu', APPROVED: 'Odobren',
  PUBLISHED: 'Objavljen', SUPERSEDED: 'Zamijenjen',
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const docs = await getDocuments()
  const allVersions = docs.flatMap((d: any) =>
    (d.versions || []).map((v: any) => ({ ...v, docId: d.docId, docTitle: d.title }))
  ).sort((a: any, b: any) => new Date(b.revisionDate).getTime() - new Date(a.revisionDate).getTime())

  const r = await ReportBuilder.create()
  r.header({
    title: 'ISTORIJA VERZIJA DOKUMENATA (VERSION HISTORY)',
    subtitle: 'Change control / configuration management',
    regRef: 'EASA Part-145.A.85 (Changes to the organisation) - amandmani i revizije',
    generatedBy: user.full_name,
    generatedRole: user.role,
    extra: [`Ukupno zabiljezenih verzija: ${allVersions.length}`],
  })

  const published = allVersions.filter((v: any) => v.status === 'PUBLISHED').length
  const approved = allVersions.filter((v: any) => v.status === 'APPROVED').length
  const draft = allVersions.filter((v: any) => v.status === 'DRAFT').length

  r.kpiRow([
    { label: 'Ukupno verzija', value: allVersions.length },
    { label: 'Objavljeno', value: published },
    { label: 'Odobreno', value: approved },
    { label: 'Nacrt', value: draft },
  ])

  r.sectionTitle('ISTORIJA REVIZIJA')
  const cols = [
    { x: MARGIN, label: 'Doc ID' },
    { x: MARGIN + 65, label: 'Verzija' },
    { x: MARGIN + 105, label: 'Status' },
    { x: MARGIN + 175, label: 'Datum' },
    { x: MARGIN + 245, label: 'Revidirao' },
    { x: MARGIN + 340, label: 'Odobrio' },
    { x: MARGIN + 420, label: 'Opis promjene' },
  ]
  r.tableHeader(cols)

  for (const v of allVersions) {
    r.ensureSpace(24)
    r.text(v.docId, cols[0].x, { size: 7, bold: true })
    r.text(`v${v.versionNumber}`, cols[1].x, { size: 7 })
    r.text(VERSION_STATUS_LABELS[v.status] ?? v.status, cols[2].x, { size: 7 })
    r.text(new Date(v.revisionDate).toLocaleDateString('hr-HR'), cols[3].x, { size: 7 })
    r.text((v.revisedBy ?? '').slice(0, 16), cols[4].x, { size: 7 })
    r.text((v.approvedBy ?? '-').slice(0, 14), cols[5].x, { size: 7 })
    r.text((v.changeDescription ?? '').slice(0, 24), cols[6].x, { size: 7 })
    r.line(11)
    if (v.changeReason) {
      r.text(`Razlog: ${v.changeReason}`.slice(0, 110), MARGIN + 10, { size: 6, color: rgb(0.6, 0.45, 0.1) })
      r.line(9)
    }
  }

  r.certificationBlock(user.full_name, user.role, 'Istorija verzija - EASA Part-145.A.85 (kontrola izmjena)')
  r.finalizePageNumbers()

  const pdf = await r.save()
  return pdfResponse(pdf, `doc-control-versions-${new Date().toISOString().slice(0, 10)}.pdf`)
}