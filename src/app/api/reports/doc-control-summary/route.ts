import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { transliterate } from '@/lib/pdf-utils'
import { getDocuments, getDocumentStats } from '@/lib/actions-document-control'

// ============== LABELS ==============
const VERSION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nacrt', UNDER_REVIEW: 'Na pregledu', APPROVED: 'Odobren',
  PUBLISHED: 'Objavljen', SUPERSEDED: 'Zamijenjen',
}
const REVIEW_RESULT_LABELS: Record<string, string> = {
  NO_CHANGE_NEEDED: 'Bez promjene', MINOR_UPDATE: 'Minor update',
  MAJOR_REVISION: 'Velika revizija', WITHDRAW: 'Povuci', SUPERSEDE: 'Zamijeniti',
}
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nacrt', UNDER_REVIEW: 'Na pregledu', APPROVED: 'Odobren',
  PUBLISHED: 'Objavljen', SUPERSEDED: 'Zamijenjen', WITHDRAWN: 'Povucen',
}

const RED = rgb(0.86, 0.15, 0.15)
const GREEN = rgb(0.1, 0.55, 0.15)
const YELLOW = rgb(0.85, 0.55, 0.1)
const BLUE = rgb(0.2, 0.4, 0.7)
const GREY = rgb(0.4, 0.4, 0.4)

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const [docs, stats]: [any[], any] = await Promise.all([getDocuments(), getDocumentStats()])
  const today = new Date()

  // ====== KPI proracuni ======
  // Versions
  let totalVersions = 0
  let recentVersions = 0
  const versionByStatus: Record<string, number> = {}
  const recentCutoff = new Date(today.getTime() - 90 * 86400000)
  for (const d of docs) {
    for (const v of (d.versions || [])) {
      totalVersions++
      versionByStatus[v.status] = (versionByStatus[v.status] || 0) + 1
      if (new Date(v.revisionDate) >= recentCutoff) recentVersions++
    }
  }

  // Reviews
  let totalReviews = 0
  const reviewsByResult: Record<string, number> = {}
  for (const d of docs) {
    for (const r of (d.reviews || [])) {
      totalReviews++
      reviewsByResult[r.result] = (reviewsByResult[r.result] || 0) + 1
    }
  }
  const overdueReviews = docs.filter(d => d.nextReviewDate && new Date(d.nextReviewDate) < today && d.status === 'PUBLISHED').length
  const dueSoonReviews = docs.filter(d => {
    if (!d.nextReviewDate) return false
    const nr = new Date(d.nextReviewDate)
    return nr >= today && nr <= new Date(today.getTime() + 30 * 86400000)
  }).length

  // Distribution
  let totalDistributions = 0
  let acknowledgedDistributions = 0
  for (const d of docs) {
    for (const dist of (d.distributions || [])) {
      totalDistributions++
      if (dist.acknowledged) acknowledgedDistributions++
    }
  }
  const pendingDistributions = totalDistributions - acknowledgedDistributions
  const ackRate = totalDistributions > 0 ? (acknowledgedDistributions / totalDistributions) * 100 : 0

  // ====== PDF ======
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const pageWidth = 595.28, pageHeight = 841.89, margin = 50
  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const addText = (text: string, x: number, yVal: number, opts: any = {}) => {
    const { size = 10, font: f = font, color = rgb(0, 0, 0) } = opts
    try { page.drawText(transliterate(text), { x, y: yVal, size, font: f, color }) } catch {}
  }

  const sectionHeader = (text: string) => {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText(text, margin, y, { size: 13, font: fontBold, color: BLUE }); y -= 15
  }

  // Header
  addText('GSE CONTROL — DOCUMENT CONTROL SUMMARY', margin, y, { size: 15, font: fontBold }); y -= 18
  addText('EASA Part-145.A.65 · ISO 9001', margin, y, { size: 9, color: GREY }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 20

  // 1. DOCUMENT REGISTER — KPI counts
  sectionHeader('1. DOCUMENT REGISTER — KPI')
  addText(`• Ukupno dokumenata: ${stats.total}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Objavljeni (PUBLISHED): ${stats.publishedCount}`, margin + 10, y, { size: 10, color: GREEN }); y -= 12
  addText(`• Nacrti (DRAFT): ${stats.draftCount}`, margin + 10, y, { size: 10, color: GREY }); y -= 12
  addText(`• Zamijenjeni (SUPERSEDED): ${stats.supersededCount}`, margin + 10, y, { size: 10, color: YELLOW }); y -= 12
  addText(`• Povuceni (WITHDRAWN): ${stats.byStatus.WITHDRAWN || 0}`, margin + 10, y, { size: 10, color: RED }); y -= 12
  addText(`• Na pregledu (UNDER_REVIEW): ${stats.byStatus.UNDER_REVIEW || 0}`, margin + 10, y, { size: 10, color: YELLOW }); y -= 12
  addText(`• Odobreni (APPROVED): ${stats.byStatus.APPROVED || 0}`, margin + 10, y, { size: 10, color: BLUE }); y -= 20

  // 2. VERSIONS
  sectionHeader('2. VERSIONS')
  addText(`• Ukupno verzija: ${totalVersions}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Nedavne (posljednjih 90 dana): ${recentVersions}`, margin + 10, y, { size: 10, color: recentVersions > 0 ? BLUE : rgb(0, 0, 0) }); y -= 12
  addText('• Po statusu:', margin + 10, y, { size: 10, font: fontBold }); y -= 12
  for (const s of Object.keys(VERSION_STATUS_LABELS)) {
    const count = versionByStatus[s] || 0
    let color = rgb(0, 0, 0)
    if (s === 'PUBLISHED') color = GREEN
    else if (s === 'DRAFT') color = GREY
    else if (s === 'SUPERSEDED' || s === 'UNDER_REVIEW') color = YELLOW
    else if (s === 'APPROVED') color = BLUE
    addText(`   - ${VERSION_STATUS_LABELS[s]}: ${count}`, margin + 15, y, { size: 10, color }); y -= 12
  }
  y -= 8

  // 3. REVIEWS
  sectionHeader('3. REVIEWS')
  addText(`• Ukupno reviews: ${totalReviews}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Prekoraceni (overdue): ${overdueReviews}`, margin + 10, y, { size: 10, color: overdueReviews > 0 ? RED : rgb(0, 0, 0) }); y -= 12
  addText(`• Predstojeci (due soon, 30 dana): ${dueSoonReviews}`, margin + 10, y, { size: 10, color: dueSoonReviews > 0 ? YELLOW : rgb(0, 0, 0) }); y -= 12
  addText('• Po rezultatu:', margin + 10, y, { size: 10, font: fontBold }); y -= 12
  for (const r of Object.keys(REVIEW_RESULT_LABELS)) {
    const count = reviewsByResult[r] || 0
    let color = rgb(0, 0, 0)
    if (r === 'NO_CHANGE_NEEDED') color = GREEN
    else if (r === 'MINOR_UPDATE') color = BLUE
    else if (r === 'MAJOR_REVISION') color = YELLOW
    else if (r === 'WITHDRAW' || r === 'SUPERSEDE') color = RED
    addText(`   - ${REVIEW_RESULT_LABELS[r]}: ${count}`, margin + 15, y, { size: 10, color }); y -= 12
  }
  y -= 8

  // 4. DISTRIBUTION
  sectionHeader('4. DISTRIBUTION')
  addText(`• Ukupno distribucija: ${totalDistributions}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Potvrdjeno (acknowledged): ${acknowledgedDistributions}`, margin + 10, y, { size: 10, color: GREEN }); y -= 12
  addText(`• Na cekanju (pending): ${pendingDistributions}`, margin + 10, y, { size: 10, color: pendingDistributions > 0 ? YELLOW : rgb(0, 0, 0) }); y -= 12
  const rateColor = ackRate >= 90 ? GREEN : ackRate >= 70 ? YELLOW : RED
  addText(`• Stopa potvrde (ack rate): ${ackRate.toFixed(1)} %`, margin + 10, y, { size: 11, font: fontBold, color: rateColor }); y -= 20

  // 5. ZAKLJUCAK
  sectionHeader('5. ZAKLJUCAK — Overall Health')

  // Health određen: overdue reviews i ack rate
  let healthText = ''
  let healthColor = GREEN
  if (overdueReviews > 0 || ackRate < 70) {
    healthText = 'Document Control sistem zahtijeva hitnu paznju — postoje prekoraceni pregledi dokumenata ili niska stopa potvrde distribucija.'
    healthColor = RED
  } else if (overdueReviews > 0 || pendingDistributions > 5 || ackRate < 90 || dueSoonReviews > 0) {
    healthText = 'Stanje Document Control sistema je prihvatljivo ali zahtijeva pracenje — postoje otvoreni pregledi ili nepotvrdjene distribucije.'
    healthColor = YELLOW
  } else {
    healthText = 'Stanje Document Control sistema je dobro — svi pregledi su na vrijeme, a distribucije su potvrdjene.'
    healthColor = GREEN
  }

  addText('Ukupna ocjena:', margin + 10, y, { size: 10, font: fontBold }); y -= 13
  // Wrap health text
  const words = healthText.split(/\s+/)
  let line = ''
  const maxChars = 95
  for (const w of words) {
    if ((line + ' ' + w).trim().length <= maxChars) {
      line = (line + ' ' + w).trim()
    } else {
      if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
      addText(line, margin + 10, y, { size: 10, color: healthColor }); y -= 12
      line = w
    }
  }
  if (line) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText(line, margin + 10, y, { size: 10, color: healthColor }); y -= 12
  }
  y -= 8

  addText('Preporuke:', margin + 10, y, { size: 10, font: fontBold }); y -= 13
  const recs: string[] = []
  if (overdueReviews > 0) recs.push(`• Hitno izvrsiti ${overdueReviews} prekoracenih pregleda dokumenata.`)
  if (dueSoonReviews > 0) recs.push(`• Pripremiti ${dueSoonReviews} pregleda koji su pred vratima (30 dana).`)
  if (pendingDistributions > 0) recs.push(`• Osigurati potvrdu za ${pendingDistributions} nepotvrdjenih distribucija.`)
  if (ackRate < 90) recs.push(`• Poboljsati stopu potvrde distribucija (trenutno ${ackRate.toFixed(1)} %).`)
  if (stats.draftCount > 0) recs.push(`• Kompletirati i objaviti ${stats.draftCount} dokumenata u statusu DRAFT.`)
  if (stats.byStatus.WITHDRAWN > 0) recs.push(`• Preispitati ${stats.byStatus.WITHDRAWN} povucenih dokumenata.`)
  if (recs.length === 0) recs.push('• Nastaviti sa redovnim pracenjem i odrzavanjem Document Control sistema.')
  for (const r of recs) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText(r, margin + 15, y, { size: 9, color: GREY }); y -= 11
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="doc-control-summary-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
