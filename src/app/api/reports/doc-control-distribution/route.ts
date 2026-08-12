import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { transliterate } from '@/lib/pdf-utils'
import { getDocuments } from '@/lib/actions-document-control'

// ============== LABELS ==============
const DISTRIBUTION_METHOD_LABELS: Record<string, string> = {
  EMAIL: 'Email', HARD_COPY: 'Hard copy', PORTAL: 'Portal', TRAINING: 'Obuka', OTHER: 'Ostalo',
}
const DISTRIBUTION_STATUS_LABELS: Record<string, string> = {
  DISTRIBUTED: 'Distribuirano', ACKNOWLEDGED: 'Potvrdjeno',
  RETURNED: 'Vraceno', SUPERSEDED: 'Zamijenjeno',
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

function distStatusColor(s: string, ack: boolean): any {
  if (ack) return GREEN
  if (s === 'DISTRIBUTED') return YELLOW
  if (s === 'RETURNED') return RED
  if (s === 'SUPERSEDED') return GREY
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

  // Flatten distributions with parent doc reference
  const distributions: any[] = []
  for (const d of docs) {
    for (const dist of (d.distributions || [])) {
      distributions.push({ ...dist, _docId: d.docId, _docTitle: d.title })
    }
  }

  // ====== Sažetak ======
  const total = distributions.length
  const acknowledged = distributions.filter(d => d.acknowledged).length
  const pending = distributions.filter(d => !d.acknowledged).length
  const ackRate = total > 0 ? (acknowledged / total) * 100 : 0

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
  addText('GSE CONTROL — DOCUMENT DISTRIBUTION LIST', margin, y, { size: 15, font: fontBold }); y -= 18
  addText('EASA Part-145.A.65 · ISO 9001', margin, y, { size: 9, color: GREY }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 20

  // Sažetak
  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Ukupno distribucija: ${total}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Potvrdjeno (acknowledged): ${acknowledged}`, margin + 10, y, { size: 10, color: GREEN }); y -= 12
  addText(`• Na cekanju (pending): ${pending}`, margin + 10, y, { size: 10, color: pending > 0 ? YELLOW : rgb(0, 0, 0) }); y -= 12
  const rateColor = ackRate >= 90 ? GREEN : ackRate >= 70 ? YELLOW : RED
  addText(`• Stopa potvrde (ack rate): ${ackRate.toFixed(1)} %`, margin + 10, y, { size: 11, font: fontBold, color: rateColor }); y -= 20

  // Tabela
  addText('TABELA DISTRIBUCIJA:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 60, margin + 160, margin + 245, margin + 335, margin + 395, margin + 460]
  ;['DocID', 'Primaoc', 'Odjel', 'Datum dist.', 'Metoda', 'Status'].forEach((h, i) =>
    addText(h, cols[i], y, { size: 8, font: fontBold }))
  y -= 4
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const d of distributions) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText((d._docId || '').slice(0, 10), cols[0], y, { size: 7, font: fontBold })
    addText((d.recipientName || '-').slice(0, 18), cols[1], y, { size: 7 })
    addText((d.recipientDepartment || '-').slice(0, 18), cols[2], y, { size: 7 })
    addText(fmtDate(d.distributionDate).slice(0, 16), cols[3], y, { size: 7 })
    addText((DISTRIBUTION_METHOD_LABELS[d.distributionMethod] || d.distributionMethod || '-').slice(0, 14), cols[4], y, { size: 7 })
    const statusLabel = d.acknowledged ? 'Potvrdjeno' : (DISTRIBUTION_STATUS_LABELS[d.status] || d.status || '-')
    addText(statusLabel.slice(0, 14), cols[5], y, { size: 7, color: distStatusColor(d.status, d.acknowledged), font: fontBold })
    y -= 11
  }

  // PENDING ACKNOWLEDGMENT sekcija
  y -= 8
  if (y < 200) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('PENDING ACKNOWLEDGMENT (Nepotvrdjene distribucije):', margin, y, { size: 12, font: fontBold, color: YELLOW }); y -= 4
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: YELLOW })
  y -= 14

  const pendingDistributions = distributions.filter(d => !d.acknowledged)
  if (pendingDistributions.length === 0) {
    addText('• Sve distribucije su potvrdjene.', margin + 10, y, { size: 10, color: GREEN, font: fontBold }); y -= 14
  } else {
    addText(`Ukupno nepotvrdjenih: ${pendingDistributions.length}`, margin + 10, y, { size: 10, font: fontBold, color: RED }); y -= 14
    const pcols = [margin, margin + 60, margin + 160, margin + 245, margin + 335, margin + 395, margin + 460]
    ;['DocID', 'Primaoc', 'Odjel', 'Datum dist.', 'Metoda', 'Email'].forEach((h, i) =>
      addText(h, pcols[i], y, { size: 8, font: fontBold, color: YELLOW }))
    y -= 4
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: YELLOW })
    y -= 11
    for (const d of pendingDistributions) {
      if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
      addText((d._docId || '').slice(0, 10), pcols[0], y, { size: 7, font: fontBold })
      addText((d.recipientName || '-').slice(0, 18), pcols[1], y, { size: 7 })
      addText((d.recipientDepartment || '-').slice(0, 18), pcols[2], y, { size: 7 })
      addText(fmtDate(d.distributionDate).slice(0, 16), pcols[3], y, { size: 7 })
      addText((DISTRIBUTION_METHOD_LABELS[d.distributionMethod] || d.distributionMethod || '-').slice(0, 14), pcols[4], y, { size: 7 })
      addText((d.recipientEmail || '-').slice(0, 18), pcols[5], y, { size: 7 })
      y -= 11
    }
  }

  // Detalji po distribuciji
  y -= 8
  if (y < 200) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('DETALJNI PRIKAZ DISTRIBUCIJA:', margin, y, { size: 12, font: fontBold }); y -= 16

  for (const d of distributions) {
    if (y < 160) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText(`${d._docId} → ${d.recipientName || '-'}`, margin, y, { size: 10, font: fontBold, color: distStatusColor(d.status, d.acknowledged) }); y -= 13
    addText(`Odjel: ${d.recipientDepartment || '-'}    Uloga: ${d.recipientRole || '-'}    Email: ${d.recipientEmail || '-'}`, margin + 5, y, { size: 9 }); y -= 12
    addText(`Datum distribucije: ${fmtDate(d.distributionDate)}    Metoda: ${DISTRIBUTION_METHOD_LABELS[d.distributionMethod] || d.distributionMethod}    Distribuirao: ${d.distributedBy || '-'}`, margin + 5, y, { size: 9 }); y -= 12
    addText(`Verzija: ${d.versionNumber || '-'}    Status: ${DISTRIBUTION_STATUS_LABELS[d.status] || d.status}    Potvrdjeno: ${d.acknowledged ? 'DA' : 'NE'}`, margin + 5, y, { size: 9, color: d.acknowledged ? GREEN : YELLOW }); y -= 12
    if (d.acknowledged && d.acknowledgedAt) {
      addText(`Potvrda: ${fmtDate(d.acknowledgedAt)}${d.acknowledgedMethod ? ' (' + d.acknowledgedMethod + ')' : ''}`, margin + 5, y, { size: 9, color: GREEN }); y -= 12
    }
    if (d.notes) {
      const writeBlock = (label: string, text: string) => {
        if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
        addText(label + ':', margin + 5, y, { size: 9, font: fontBold }); y -= 11
        for (const ln of wrapText(text, 110)) {
          if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
          addText(ln, margin + 10, y, { size: 8, color: rgb(0.3, 0.3, 0.3) }); y -= 10
        }
        y -= 2
      }
      writeBlock('Notes', d.notes)
    }
    y -= 6
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="doc-control-distribution-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
