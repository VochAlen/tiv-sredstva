import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { transliterate } from '@/lib/pdf-utils'
import { getDocuments } from '@/lib/actions-document-control'

// ============== LABELS (isti kao u document-control-view.tsx) ==============
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
const REVIEW_FREQUENCY_LABELS: Record<string, string> = {
  ANNUAL: 'Godisnje', BIENNIAL: 'Bienalno', QUARTERLY: 'Kvartalno',
  ON_CHANGE: 'Na promjenu', AD_HOC: 'Ad hoc',
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

function statusColor(s: string): any {
  if (s === 'PUBLISHED') return GREEN
  if (s === 'APPROVED') return BLUE
  if (s === 'UNDER_REVIEW') return YELLOW
  if (s === 'DRAFT') return GREY
  if (s === 'SUPERSEDED') return YELLOW
  if (s === 'WITHDRAWN') return RED
  return rgb(0, 0, 0)
}

function wrapText(text: string, maxChars: number): string[] {
  if (!text) return []
  const words = String(text).split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length <= maxChars) {
      line = (line + ' ' + w).trim()
    } else {
      if (line) lines.push(line)
      if (w.length > maxChars) {
        lines.push(w.slice(0, maxChars))
        line = ''
      } else {
        line = w
      }
    }
  }
  if (line) lines.push(line)
  return lines
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const docs: any[] = await getDocuments()
  const today = new Date()

  // ====== Sažetak ======
  const total = docs.length
  const published = docs.filter(d => d.status === 'PUBLISHED').length
  const draft = docs.filter(d => d.status === 'DRAFT').length
  const superseded = docs.filter(d => d.status === 'SUPERSEDED').length
  const overdueReviews = docs.filter(d => d.nextReviewDate && new Date(d.nextReviewDate) < today && d.status === 'PUBLISHED').length

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

  // Header
  addText('GSE CONTROL — DOCUMENT REGISTER', margin, y, { size: 15, font: fontBold }); y -= 18
  addText('EASA Part-145.A.65 · ISO 9001', margin, y, { size: 9, color: GREY }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 20

  // Sažetak
  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Ukupno dokumenata: ${total}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Objavljeni (PUBLISHED): ${published}`, margin + 10, y, { size: 10, color: GREEN }); y -= 12
  addText(`• Nacrti (DRAFT): ${draft}`, margin + 10, y, { size: 10, color: GREY }); y -= 12
  addText(`• Zamijenjeni (SUPERSEDED): ${superseded}`, margin + 10, y, { size: 10, color: YELLOW }); y -= 12
  addText(`• Prekoraceni pregledi (overdue reviews): ${overdueReviews}`, margin + 10, y, { size: 10, color: overdueReviews > 0 ? RED : rgb(0, 0, 0) }); y -= 20

  // Tabela
  addText('TABELA DOKUMENATA:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 60, margin + 160, margin + 240, margin + 290, margin + 345, margin + 395, margin + 460]
  ;['DocID', 'Naslov', 'Kategorija', 'Verzija', 'Status', 'Vlasnik', 'Sljed. pregled'].forEach((h, i) =>
    addText(h, cols[i], y, { size: 8, font: fontBold }))
  y -= 4
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const d of docs) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText((d.docId || '').slice(0, 10), cols[0], y, { size: 7, font: fontBold })
    addText((d.title || '').slice(0, 18), cols[1], y, { size: 7 })
    addText((CATEGORY_LABELS[d.category] || d.category || '').slice(0, 14), cols[2], y, { size: 7 })
    addText((d.currentVersion || '-').slice(0, 10), cols[3], y, { size: 7 })
    addText((STATUS_LABELS[d.status] || d.status || '').slice(0, 12), cols[4], y, { size: 7, color: statusColor(d.status), font: fontBold })
    addText((d.owner || '-').slice(0, 12), cols[5], y, { size: 7 })
    addText(fmtDate(d.nextReviewDate).slice(0, 12), cols[6], y, { size: 7 })
    y -= 11
  }

  // Detalji po dokumentu
  y -= 8
  if (y < 200) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('DETALJNI PRIKAZ DOKUMENATA:', margin, y, { size: 12, font: fontBold }); y -= 16

  for (const d of docs) {
    if (y < 200) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText(`${d.docId} — ${d.title}`, margin, y, { size: 10, font: fontBold, color: statusColor(d.status) }); y -= 13
    addText(`Status: ${STATUS_LABELS[d.status] || d.status}    Verzija: ${d.currentVersion || '-'}    Kategorija: ${CATEGORY_LABELS[d.category] || d.category}    Tip: ${DOC_TYPE_LABELS[d.docType] || d.docType || '-'}`, margin + 5, y, { size: 9 }); y -= 12

    const writeBlock = (label: string, text: string | undefined) => {
      if (!text) return
      if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
      addText(label + ':', margin + 5, y, { size: 9, font: fontBold }); y -= 11
      for (const ln of wrapText(text, 110)) {
        if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
        addText(ln, margin + 10, y, { size: 8, color: rgb(0.3, 0.3, 0.3) }); y -= 10
      }
      y -= 2
    }

    writeBlock('Description (Opis)', d.description)
    addText(`Standard: ${d.standard || '-'}    Klasifikacija: ${CLASSIFICATION_LABELS[d.classification] || d.classification || '-'}    Frekvencija pregleda: ${REVIEW_FREQUENCY_LABELS[d.reviewFrequency] || d.reviewFrequency || '-'}`, margin + 5, y, { size: 9 }); y -= 12
    addText(`Vlasnik (Owner): ${d.owner || '-'}    Autor: ${d.author || '-'}    Approver: ${d.approver || '-'}`, margin + 5, y, { size: 9 }); y -= 12
    addText(`Datum efikasnosti: ${fmtDate(d.effectiveDate)}    Sljedeci pregled: ${fmtDate(d.nextReviewDate)}    Zadnji pregled: ${fmtDate(d.lastReviewedAt)}`, margin + 5, y, { size: 9 }); y -= 12
    if (d.fileUrl) {
      addText(`File URL: ${d.fileUrl}`, margin + 5, y, { size: 9, color: BLUE }); y -= 12
    }
    if (d.keywords) {
      writeBlock('Keywords (Kljucne rijeci)', d.keywords)
    }
    y -= 6
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="doc-control-documents-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
