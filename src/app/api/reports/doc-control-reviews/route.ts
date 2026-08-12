import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { transliterate } from '@/lib/pdf-utils'
import { getDocuments } from '@/lib/actions-document-control'

// ============== LABELS ==============
const REVIEW_TYPE_LABELS: Record<string, string> = {
  SCHEDULED: 'Zakazani', AD_HOC: 'Ad hoc',
  CHANGE_REQUEST: 'Zahtjev za promjenu', INCIDENT_DRIVEN: 'Iz incidenta',
}
const REVIEW_RESULT_LABELS: Record<string, string> = {
  NO_CHANGE_NEEDED: 'Bez promjene', MINOR_UPDATE: 'Minor update',
  MAJOR_REVISION: 'Velika revizija', WITHDRAW: 'Povuci', SUPERSEDE: 'Zamijeniti',
}
const REVIEW_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Otvoren', IN_PROGRESS: 'U toku', COMPLETED: 'Zavrsen', CANCELLED: 'Otkazan',
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

function resultColor(r: string): any {
  if (r === 'NO_CHANGE_NEEDED') return GREEN
  if (r === 'MINOR_UPDATE') return BLUE
  if (r === 'MAJOR_REVISION') return YELLOW
  if (r === 'WITHDRAW') return RED
  if (r === 'SUPERSEDE') return YELLOW
  return rgb(0, 0, 0)
}

function reviewStatusColor(s: string): any {
  if (s === 'COMPLETED') return GREEN
  if (s === 'IN_PROGRESS') return BLUE
  if (s === 'OPEN') return YELLOW
  if (s === 'CANCELLED') return GREY
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

  // Flatten reviews with parent doc reference
  const reviews: any[] = []
  for (const d of docs) {
    for (const r of (d.reviews || [])) {
      reviews.push({ ...r, _docId: d.docId, _docTitle: d.title })
    }
  }

  // ====== Sažetak ======
  const total = reviews.length
  const byResult: Record<string, number> = {}
  for (const r of reviews) {
    byResult[r.result] = (byResult[r.result] || 0) + 1
  }

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
  addText('GSE CONTROL — DOCUMENT REVIEWS', margin, y, { size: 15, font: fontBold }); y -= 18
  addText('EASA Part-145.A.65 · ISO 9001', margin, y, { size: 9, color: GREY }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 20

  // Sažetak
  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Ukupno reviews: ${total}`, margin + 10, y, { size: 10 }); y -= 12
  addText('• Po rezultatu (result):', margin + 10, y, { size: 10, font: fontBold }); y -= 12
  for (const res of Object.keys(REVIEW_RESULT_LABELS)) {
    const count = byResult[res] || 0
    addText(`   - ${REVIEW_RESULT_LABELS[res]}: ${count}`, margin + 15, y, { size: 10, color: resultColor(res) }); y -= 12
  }
  y -= 8

  // Tabela
  if (y < 200) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('TABELA REVIEWS:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 60, margin + 160, margin + 235, margin + 310, margin + 400, margin + 460]
  ;['DocID', 'Tip review-a', 'Datum', 'Reviewer', 'Rezultat', 'Status'].forEach((h, i) =>
    addText(h, cols[i], y, { size: 8, font: fontBold }))
  y -= 4
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const r of reviews) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText((r._docId || '').slice(0, 10), cols[0], y, { size: 7, font: fontBold })
    addText((REVIEW_TYPE_LABELS[r.reviewType] || r.reviewType || '-').slice(0, 18), cols[1], y, { size: 7 })
    addText(fmtDate(r.reviewDate).slice(0, 16), cols[2], y, { size: 7 })
    addText((r.reviewer || '-').slice(0, 18), cols[3], y, { size: 7 })
    addText((REVIEW_RESULT_LABELS[r.result] || r.result || '-').slice(0, 18), cols[4], y, { size: 7, color: resultColor(r.result), font: fontBold })
    addText((REVIEW_STATUS_LABELS[r.status] || r.status || '-').slice(0, 14), cols[5], y, { size: 7, color: reviewStatusColor(r.status) })
    y -= 11
  }

  // Detalji po review-u
  y -= 8
  if (y < 200) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('DETALJNI PRIKAZ REVIEWS:', margin, y, { size: 12, font: fontBold }); y -= 16

  for (const r of reviews) {
    if (y < 180) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText(`${r._docId} — ${REVIEW_TYPE_LABELS[r.reviewType] || r.reviewType} (${fmtDate(r.reviewDate)})`, margin, y, { size: 10, font: fontBold, color: resultColor(r.result) }); y -= 13
    addText(`Reviewer: ${r.reviewer || '-'}    Tip: ${REVIEW_TYPE_LABELS[r.reviewType] || r.reviewType}    Rezultat: ${REVIEW_RESULT_LABELS[r.result] || r.result}    Status: ${REVIEW_STATUS_LABELS[r.status] || r.status}`, margin + 5, y, { size: 9 }); y -= 12
    if (r.completedAt) {
      addText(`Zavrseno: ${fmtDate(r.completedAt)}`, margin + 5, y, { size: 9, color: GREEN }); y -= 12
    }

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

    writeBlock('Review comments (Komentari pregleda)', r.reviewComments)
    writeBlock('Changes required (Potrebne promjene)', r.changesRequired)
    addText(`New version required: ${r.newVersionRequired ? 'DA' : 'NE'}`, margin + 5, y, { size: 9, color: r.newVersionRequired ? YELLOW : rgb(0, 0, 0), font: r.newVersionRequired ? fontBold : font }); y -= 12
    if (r.actionTaken) {
      writeBlock('Action taken (Preduzeta akcija)', r.actionTaken)
    }
    y -= 6
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="doc-control-reviews-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
