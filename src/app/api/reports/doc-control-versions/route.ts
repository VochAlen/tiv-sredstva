import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { transliterate } from '@/lib/pdf-utils'
import { getDocuments } from '@/lib/actions-document-control'

// ============== LABELS ==============
const VERSION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nacrt', UNDER_REVIEW: 'Na pregledu', APPROVED: 'Odobren',
  PUBLISHED: 'Objavljen', SUPERSEDED: 'Zamijenjen',
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

function versionStatusColor(s: string): any {
  if (s === 'PUBLISHED') return GREEN
  if (s === 'APPROVED') return BLUE
  if (s === 'UNDER_REVIEW') return YELLOW
  if (s === 'DRAFT') return GREY
  if (s === 'SUPERSEDED') return YELLOW
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

  // Flatten versions with parent doc reference (docId, title)
  const versions: any[] = []
  for (const d of docs) {
    for (const v of (d.versions || [])) {
      versions.push({ ...v, _docId: d.docId, _docTitle: d.title })
    }
  }

  // ====== Sažetak ======
  const total = versions.length
  const recentCutoff = new Date(today.getTime() - 90 * 86400000)
  const recent = versions.filter(v => new Date(v.revisionDate) >= recentCutoff).length
  const byStatus: Record<string, number> = {}
  for (const v of versions) {
    byStatus[v.status] = (byStatus[v.status] || 0) + 1
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
  addText('GSE CONTROL — DOCUMENT VERSIONS HISTORY', margin, y, { size: 15, font: fontBold }); y -= 18
  addText('EASA Part-145.A.65 · ISO 9001', margin, y, { size: 9, color: GREY }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 20

  // Sažetak
  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Ukupno verzija: ${total}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Nedavne (posljednjih 90 dana): ${recent}`, margin + 10, y, { size: 10, color: recent > 0 ? BLUE : rgb(0, 0, 0) }); y -= 12
  addText('• Po statusu:', margin + 10, y, { size: 10, font: fontBold }); y -= 12
  for (const status of Object.keys(VERSION_STATUS_LABELS)) {
    const count = byStatus[status] || 0
    addText(`   - ${VERSION_STATUS_LABELS[status]}: ${count}`, margin + 15, y, { size: 10, color: versionStatusColor(status) }); y -= 12
  }
  y -= 8

  // Tabela
  if (y < 200) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('TABELA VERZIJA:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 60, margin + 130, margin + 220, margin + 290, margin + 360, margin + 430]
  ;['DocID', 'Verzija', 'Datum revizije', 'Revidirao', 'Status', 'Promjena'].forEach((h, i) =>
    addText(h, cols[i], y, { size: 8, font: fontBold }))
  y -= 4
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const v of versions) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText((v._docId || '').slice(0, 10), cols[0], y, { size: 7, font: fontBold })
    addText((v.versionNumber || '-').slice(0, 14), cols[1], y, { size: 7 })
    addText(fmtDate(v.revisionDate).slice(0, 16), cols[2], y, { size: 7 })
    addText((v.revisedBy || '-').slice(0, 14), cols[3], y, { size: 7 })
    addText((VERSION_STATUS_LABELS[v.status] || v.status || '-').slice(0, 14), cols[4], y, { size: 7, color: versionStatusColor(v.status), font: fontBold })
    addText((v.changeDescription || '-').slice(0, 22), cols[5], y, { size: 7 })
    y -= 11
  }

  // Detalji po verziji
  y -= 8
  if (y < 200) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('DETALJNI PRIKAZ VERZIJA:', margin, y, { size: 12, font: fontBold }); y -= 16

  for (const v of versions) {
    if (y < 180) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText(`${v._docId} v${v.versionNumber} — ${v._docTitle || ''}`, margin, y, { size: 10, font: fontBold, color: versionStatusColor(v.status) }); y -= 13
    addText(`Datum revizije: ${fmtDate(v.revisionDate)}    Revidirao: ${v.revisedBy || '-'}    Status: ${VERSION_STATUS_LABELS[v.status] || v.status}    Efektivno od: ${fmtDate(v.effectiveDate)}`, margin + 5, y, { size: 9 }); y -= 12

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

    writeBlock('Change description (Opis promjene)', v.changeDescription)
    writeBlock('Change reason (Razlog promjene)', v.changeReason)
    writeBlock('Affected sections (Pogodjene sekcije)', v.affectedSections)
    if (v.approvedBy) {
      addText(`Approved by: ${v.approvedBy}${v.approvedAt ? ' (' + fmtDate(v.approvedAt) + ')' : ''}`, margin + 5, y, { size: 9, color: GREEN }); y -= 12
    }
    if (v.fileUrl) {
      addText(`File URL: ${v.fileUrl}`, margin + 5, y, { size: 9, color: BLUE }); y -= 12
    }
    y -= 6
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="doc-control-versions-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
