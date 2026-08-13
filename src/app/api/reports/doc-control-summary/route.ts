// src/app/api/reports/doc-control-summary/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { getDocuments, getDocumentStats } from '@/lib/actions-document-control'
import { ReportBuilder, MARGIN, pdfResponse } from '@/lib/pdf-report-kit'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const [docs, stats] = await Promise.all([getDocuments(), getDocumentStats()])
  const today = new Date()

  const overdueDocs = docs
    .filter((d: any) => d.nextReviewDate && new Date(d.nextReviewDate) < today && d.status === 'PUBLISHED')
    .sort((a: any, b: any) => new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime())

  const dueSoonDocs = docs.filter((d: any) => {
    if (!d.nextReviewDate) return false
    const nr = new Date(d.nextReviewDate)
    return nr >= today && nr <= new Date(today.getTime() + 30 * 86400000)
  })

  const pendingAck = docs.flatMap((d: any) => (d.distributions ?? []).filter((dist: any) => !dist.acknowledged).map((dist: any) => ({ ...dist, docId: d.docId })))

  const topOwners = Object.entries(stats.byOwner).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5)

  const r = await ReportBuilder.create()
  r.header({
    title: 'EXECUTIVE SUMMARY — DOCUMENT CONTROL SYSTEM',
    subtitle: 'Sazeti pregled za management review sastanak',
    regRef: 'EASA Part-145.A.65 / A.70 / A.85 - Maintenance Organisation Exposition & Change Control',
    generatedBy: user.full_name,
    generatedRole: user.role,
  })

  r.kpiRow([
    { label: 'Ukupno dokumenata', value: stats.total },
    { label: 'Objavljeno', value: stats.publishedCount },
    { label: 'Review overdue', value: stats.reviewsOverdue },
    { label: 'Ack rate', value: `${stats.ackRate.toFixed(0)}%` },
  ])

  r.sectionTitle(`REVIEW OVERDUE — ZAHTIJEVA HITNU AKCIJU (${overdueDocs.length})`)
  if (overdueDocs.length === 0) {
    r.text('Nema dokumenata sa prekoracenim review rokom.', MARGIN, { size: 9, color: rgb(0.1, 0.55, 0.15) })
    r.line(16)
  } else {
    for (const d of overdueDocs) {
      r.ensureSpace(16)
const daysOverdue = Math.ceil((today.getTime() - new Date(d.nextReviewDate!).getTime()) / 86400000)
      r.text(`${d.docId} — ${(d.title ?? '').slice(0, 55)}`, MARGIN, { size: 8 })
      r.text(`${daysOverdue}d overdue`, MARGIN + 380, { size: 8, bold: true, color: rgb(0.86, 0.15, 0.15) })
      r.line(12)
    }
  }
  r.line(8)

  r.sectionTitle(`REVIEW USKORO — NAREDNIH 30 DANA (${dueSoonDocs.length})`)
  if (dueSoonDocs.length === 0) {
    r.text('Nema dokumenata sa review-om u narednih 30 dana.', MARGIN, { size: 9, color: rgb(0.4, 0.4, 0.4) })
    r.line(16)
  } else {
    for (const d of dueSoonDocs) {
      r.ensureSpace(16)
      r.text(`${d.docId} — ${(d.title ?? '').slice(0, 55)}`, MARGIN, { size: 8 })
   r.text(new Date(d.nextReviewDate!).toLocaleDateString('hr-HR'), MARGIN + 380, { size: 8, color: rgb(0.85, 0.55, 0.1) })
      r.line(12)
    }
  }
  r.line(8)

  r.sectionTitle(`DISTRIBUCIJE KOJE CEKAJU POTVRDU (${pendingAck.length})`)
  if (pendingAck.length === 0) {
    r.text('Sve distribuirane kopije su potvrdjene.', MARGIN, { size: 9, color: rgb(0.1, 0.55, 0.15) })
    r.line(16)
  } else {
    for (const p of pendingAck.slice(0, 20)) {
      r.ensureSpace(16)
      r.text(`${p.docId} — ${(p.recipientName ?? '').slice(0, 30)} (${p.recipientDepartment ?? '-'})`, MARGIN, { size: 8 })
      r.text(new Date(p.distributionDate).toLocaleDateString('hr-HR'), MARGIN + 380, { size: 8, color: rgb(0.85, 0.55, 0.1) })
      r.line(12)
    }
    if (pendingAck.length > 20) {
      r.text(`... i jos ${pendingAck.length - 20} zapisa. Kompletan pregled: Distribution PDF izvjestaj.`, MARGIN, { size: 7, color: rgb(0.5, 0.5, 0.5) })
      r.line(12)
    }
  }
  r.line(8)

  if (topOwners.length > 0) {
    r.sectionTitle('TOP VLASNICI DOKUMENATA')
    topOwners.forEach(([owner, count]: any) => {
      r.ensureSpace(14)
      r.text(`${owner}`, MARGIN, { size: 8 })
      r.text(`${count} dok.`, MARGIN + 380, { size: 8, bold: true })
      r.line(12)
    })
  }

  r.certificationBlock(user.full_name, user.role, 'Executive summary - EASA Part-145.A.65/A.70/A.85 document control review')
  r.finalizePageNumbers()

  const pdf = await r.save()
  return pdfResponse(pdf, `doc-control-summary-${new Date().toISOString().slice(0, 10)}.pdf`)
}