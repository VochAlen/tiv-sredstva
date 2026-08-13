// src/app/api/reports/doc-control-distribution/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { getDocuments } from '@/lib/actions-document-control'
import { ReportBuilder, MARGIN, pdfResponse } from '@/lib/pdf-report-kit'

const METHOD_LABELS: Record<string, string> = {
  EMAIL: 'Email', HARD_COPY: 'Hard copy', PORTAL: 'Portal', TRAINING: 'Obuka', OTHER: 'Ostalo',
}
const STATUS_LABELS: Record<string, string> = {
  DISTRIBUTED: 'Distribuirano', ACKNOWLEDGED: 'Potvrdjeno', RETURNED: 'Vraceno', SUPERSEDED: 'Zamijenjeno',
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const docs = await getDocuments()
  const allDist = docs.flatMap((d: any) =>
    (d.distributions || []).map((dist: any) => ({ ...dist, docId: d.docId, docTitle: d.title }))
  ).sort((a: any, b: any) => new Date(b.distributionDate).getTime() - new Date(a.distributionDate).getTime())

  const acknowledged = allDist.filter((d: any) => d.acknowledged).length
  const pending = allDist.length - acknowledged
  const ackRate = allDist.length > 0 ? (acknowledged / allDist.length) * 100 : 0

  const r = await ReportBuilder.create()
  r.header({
    title: 'IZVJESTAJ O DISTRIBUCIJI DOKUMENATA (DISTRIBUTION & ACKNOWLEDGMENT)',
    subtitle: 'Kontrolisana distribucija dokumenata - dokaz da su primaoci upoznati sa vazecom verzijom',
    regRef: 'EASA Part-145.A.65 / A.30(b) - postholders informed of applicable procedures',
    generatedBy: user.full_name,
    generatedRole: user.role,
    extra: [`Ukupno zapisa o distribuciji: ${allDist.length}`],
  })

  r.kpiRow([
    { label: 'Ukupno distribuirano', value: allDist.length },
    { label: 'Potvrdjeno', value: acknowledged },
    { label: 'Ceka potvrdu', value: pending },
    { label: 'Ack rate', value: `${ackRate.toFixed(0)}%` },
  ])

  r.sectionTitle('ZAPISI O DISTRIBUCIJI')
  const cols = [
    { x: MARGIN, label: 'Doc ID' },
    { x: MARGIN + 60, label: 'Primaoc' },
    { x: MARGIN + 165, label: 'Odjeljenje' },
    { x: MARGIN + 260, label: 'Metoda' },
    { x: MARGIN + 320, label: 'Datum' },
    { x: MARGIN + 385, label: 'Status' },
    { x: MARGIN + 460, label: 'Potvrdjeno' },
  ]
  r.tableHeader(cols)

  for (const d of allDist) {
    r.ensureSpace(20)
    r.text(d.docId, cols[0].x, { size: 7, bold: true })
    r.text((d.recipientName ?? '').slice(0, 18), cols[1].x, { size: 7 })
    r.text((d.recipientDepartment ?? '-').slice(0, 16), cols[2].x, { size: 7 })
    r.text(METHOD_LABELS[d.distributionMethod] ?? d.distributionMethod, cols[3].x, { size: 7 })
    r.text(new Date(d.distributionDate).toLocaleDateString('hr-HR'), cols[4].x, { size: 7 })
    r.text(STATUS_LABELS[d.status] ?? d.status, cols[5].x, { size: 7 })
    r.text(
      d.acknowledged ? (d.acknowledgedAt ? new Date(d.acknowledgedAt).toLocaleDateString('hr-HR') : 'DA') : 'NE',
      cols[6].x,
      { size: 7, color: d.acknowledged ? rgb(0.1, 0.55, 0.15) : rgb(0.85, 0.55, 0.1), bold: !d.acknowledged }
    )
    r.line(12)
  }

  r.certificationBlock(user.full_name, user.role, 'Distribucija i potvrde prijema - dokaz upoznatosti osoblja sa vazecom dokumentacijom')
  r.finalizePageNumbers()

  const pdf = await r.save()
  return pdfResponse(pdf, `doc-control-distribution-${new Date().toISOString().slice(0, 10)}.pdf`)
}