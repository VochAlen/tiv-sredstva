import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { transliterate } from '@/lib/pdf-utils'
import { getDocuments, getDocumentStats } from '@/lib/actions-document-control'

// ============== LABELS ==============
const CATEGORY_LABELS: Record<string, string> = {
  MANUAL: 'Manual', PROCEDURE: 'Procedura', WORK_INSTRUCTION: 'Radno uputstvo',
  FORM: 'Formular', RECORD: 'Evidencija', POLICY: 'Politika', PLAN: 'Plan', OTHER: 'Ostalo',
}
const DOC_TYPE_LABELS: Record<string, string> = {
  OPERATIONS: 'Operacije', MAINTENANCE: 'Odrzavanje', SAFETY: 'Sigurnost',
  QUALITY: 'Kvalitet', TRAINING: 'Obuka', ADMINISTRATIVE: 'Administrativno', TECHNICAL: 'Tehnicko',
}
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nacrt', UNDER_REVIEW: 'Na pregledu', APPROVED: 'Odobren',
  PUBLISHED: 'Objavljen', SUPERSEDED: 'Zamijenjen', WITHDRAWN: 'Povucen',
}
const CLASSIFICATION_LABELS: Record<string, string> = {
  PUBLIC: 'Javno', INTERNAL: 'Interni', CONFIDENTIAL: 'Povjerljivo', RESTRICTED: 'Ograniceno',
}
const REVIEW_RESULT_LABELS: Record<string, string> = {
  NO_CHANGE_NEEDED: 'Bez promjene', MINOR_UPDATE: 'Minor update',
  MAJOR_REVISION: 'Velika revizija', WITHDRAW: 'Povuci', SUPERSEDE: 'Zamijeniti',
}

const RED = rgb(0.86, 0.15, 0.15)
const GREEN = rgb(0.1, 0.55, 0.15)
const YELLOW = rgb(0.85, 0.55, 0.1)
const BLUE = rgb(0.2, 0.4, 0.7)
const GREY = rgb(0.4, 0.4, 0.4)

function fmtDate(d: any): string {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('hr-HR') } catch { return '-' }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const [stats, docs]: [any, any[]] = await Promise.all([getDocumentStats(), getDocuments()])
  const today = new Date()

  // Overdue i due soon (za sekcije 7 i 8)
  const overdueDocs = docs.filter(d => d.nextReviewDate && new Date(d.nextReviewDate) < today && d.status === 'PUBLISHED')
  const dueSoonDocs = docs.filter(d => {
    if (!d.nextReviewDate) return false
    const nr = new Date(d.nextReviewDate)
    return nr >= today && nr <= new Date(today.getTime() + 30 * 86400000)
  })

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
  addText('GSE CONTROL — DOCUMENT CONTROL STATISTICS', margin, y, { size: 15, font: fontBold }); y -= 18
  addText('EASA Part-145.A.65 · ISO 9001', margin, y, { size: 9, color: GREY }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 20

  // 1. SAŽETAK
  sectionHeader('1. SAZETAK')
  addText(`• Ukupno dokumenata: ${stats.total}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Objavljeni (PUBLISHED): ${stats.publishedCount}`, margin + 10, y, { size: 10, color: GREEN }); y -= 12
  addText(`• Nacrti (DRAFT): ${stats.draftCount}`, margin + 10, y, { size: 10, color: GREY }); y -= 12
  addText(`• Zamijenjeni (SUPERSEDED): ${stats.supersededCount}`, margin + 10, y, { size: 10, color: YELLOW }); y -= 12
  addText(`• Ukupno verzija: ${stats.totalVersions}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Ukupno reviews: ${stats.totalReviews}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Ukupno distribucija: ${stats.totalDistributions}`, margin + 10, y, { size: 10 }); y -= 20

  // 2. PO STATUSU
  sectionHeader('2. PO STATUSU')
  for (const s of Object.keys(STATUS_LABELS)) {
    const count = stats.byStatus[s] || 0
    let color = rgb(0, 0, 0)
    if (s === 'PUBLISHED') color = GREEN
    else if (s === 'DRAFT') color = GREY
    else if (s === 'SUPERSEDED' || s === 'UNDER_REVIEW') color = YELLOW
    else if (s === 'WITHDRAWN') color = RED
    else if (s === 'APPROVED') color = BLUE
    addText(`• ${STATUS_LABELS[s]}: ${count}`, margin + 10, y, { size: 10, color }); y -= 12
  }
  y -= 8

  // 3. PO KATEGORIJI
  sectionHeader('3. PO KATEGORIJI')
  for (const c of Object.keys(CATEGORY_LABELS)) {
    const count = stats.byCategory[c] || 0
    addText(`• ${CATEGORY_LABELS[c]}: ${count}`, margin + 10, y, { size: 10 }); y -= 12
  }
  y -= 8

  // 4. PO TIPU DOKUMENTA
  sectionHeader('4. PO TIPU DOKUMENTA')
  for (const t of Object.keys(DOC_TYPE_LABELS)) {
    const count = stats.byDocType[t] || 0
    addText(`• ${DOC_TYPE_LABELS[t]}: ${count}`, margin + 10, y, { size: 10 }); y -= 12
  }
  y -= 8

  // 5. PO KLASIFIKACIJI
  sectionHeader('5. PO KLASIFIKACIJI')
  for (const cf of Object.keys(CLASSIFICATION_LABELS)) {
    const count = stats.byClassification[cf] || 0
    let color = rgb(0, 0, 0)
    if (cf === 'PUBLIC') color = GREEN
    else if (cf === 'INTERNAL') color = BLUE
    else if (cf === 'CONFIDENTIAL') color = YELLOW
    else if (cf === 'RESTRICTED') color = RED
    addText(`• ${CLASSIFICATION_LABELS[cf]}: ${count}`, margin + 10, y, { size: 10, color }); y -= 12
  }
  y -= 8

  // 6. REVIEWS BY RESULT
  sectionHeader('6. REVIEWS BY RESULT (Po rezultatu pregleda)')
  for (const r of Object.keys(REVIEW_RESULT_LABELS)) {
    const count = stats.reviewsByResult[r] || 0
    let color = rgb(0, 0, 0)
    if (r === 'NO_CHANGE_NEEDED') color = GREEN
    else if (r === 'MINOR_UPDATE') color = BLUE
    else if (r === 'MAJOR_REVISION') color = YELLOW
    else if (r === 'WITHDRAW' || r === 'SUPERSEDE') color = RED
    addText(`• ${REVIEW_RESULT_LABELS[r]}: ${count}`, margin + 10, y, { size: 10, color }); y -= 12
  }
  y -= 8

  // 7. OVERDUE REVIEWS
  sectionHeader(`7. OVERDUE REVIEWS (${overdueDocs.length})`)
  if (overdueDocs.length === 0) {
    addText('• Nema dokumenata sa prekoracenim rokom pregleda.', margin + 10, y, { size: 10, color: GREEN, font: fontBold }); y -= 12
  } else {
    addText(`Ukupno prekoracenih: ${overdueDocs.length}`, margin + 10, y, { size: 10, color: RED, font: fontBold }); y -= 14
    const ocols = [margin, margin + 60, margin + 200, margin + 320, margin + 400, margin + 460]
    ;['DocID', 'Naslov', 'Vlasnik', 'Sljed. pregled', 'Status'].forEach((h, i) =>
      addText(h, ocols[i], y, { size: 8, font: fontBold, color: RED }))
    y -= 4
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: RED })
    y -= 11
    for (const d of overdueDocs) {
      if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
      addText((d.docId || '').slice(0, 10), ocols[0], y, { size: 7, font: fontBold })
      addText((d.title || '').slice(0, 22), ocols[1], y, { size: 7 })
      addText((d.owner || '-').slice(0, 16), ocols[2], y, { size: 7 })
      addText(fmtDate(d.nextReviewDate).slice(0, 14), ocols[3], y, { size: 7, color: RED, font: fontBold })
      addText((STATUS_LABELS[d.status] || d.status || '').slice(0, 14), ocols[4], y, { size: 7 })
      y -= 11
    }
  }
  y -= 8

  // 8. REVIEWS DUE SOON (30 dana)
  sectionHeader(`8. REVIEWS DUE SOON (30 dana) — ${dueSoonDocs.length}`)
  if (dueSoonDocs.length === 0) {
    addText('• Nema dokumenata sa pregledom u narednih 30 dana.', margin + 10, y, { size: 10, color: GREY }); y -= 12
  } else {
    addText(`Ukupno predstojecih: ${dueSoonDocs.length}`, margin + 10, y, { size: 10, color: YELLOW, font: fontBold }); y -= 14
    const scols = [margin, margin + 60, margin + 200, margin + 320, margin + 400, margin + 460]
    ;['DocID', 'Naslov', 'Vlasnik', 'Sljed. pregled', 'Status'].forEach((h, i) =>
      addText(h, scols[i], y, { size: 8, font: fontBold, color: YELLOW }))
    y -= 4
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: YELLOW })
    y -= 11
    for (const d of dueSoonDocs) {
      if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
      addText((d.docId || '').slice(0, 10), scols[0], y, { size: 7, font: fontBold })
      addText((d.title || '').slice(0, 22), scols[1], y, { size: 7 })
      addText((d.owner || '-').slice(0, 16), scols[2], y, { size: 7 })
      addText(fmtDate(d.nextReviewDate).slice(0, 14), scols[3], y, { size: 7, color: YELLOW, font: fontBold })
      addText((STATUS_LABELS[d.status] || d.status || '').slice(0, 14), scols[4], y, { size: 7 })
      y -= 11
    }
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="doc-control-statistics-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
