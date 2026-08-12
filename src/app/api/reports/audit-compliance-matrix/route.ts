import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'

const COMPLIANCE_STATUS_LABELS: Record<string, string> = {
  COMPLIANT: 'Sukladno', NON_COMPLIANT: 'Nesukladno', PARTIAL: 'Djelomicno',
  NOT_APPLICABLE: 'Nije primjenjivo', PENDING_REVIEW: 'Ceka pregled',
}
const COMPLIANCE_CATEGORY_LABELS: Record<string, string> = {
  PERSONNEL: 'Osoblje', FACILITIES: 'Objekti', EQUIPMENT: 'Oprema',
  DOCUMENTATION: 'Dokumentacija', MAINTENANCE: 'Odrzavanje', SMS: 'SMS', OTHER: 'Ostalo',
}
const RISK_LABELS: Record<string, string> = { LOW: 'Nizak', MEDIUM: 'Srednji', HIGH: 'Visok' }

function fmtDate(d: any): string {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('hr-HR') } catch { return '-' }
}

function statusColor(s: string): any {
  return s === 'NON_COMPLIANT' ? rgb(0.86, 0.15, 0.15)
    : s === 'PARTIAL' ? rgb(0.85, 0.55, 0.1)
    : s === 'PENDING_REVIEW' ? rgb(0.2, 0.4, 0.7)
    : s === 'COMPLIANT' ? rgb(0.1, 0.55, 0.15)
    : rgb(0.5, 0.5, 0.5)
}

function riskColor(r: string | undefined): any {
  if (!r) return rgb(0, 0, 0)
  return r === 'HIGH' ? rgb(0.86, 0.15, 0.15)
    : r === 'MEDIUM' ? rgb(0.85, 0.55, 0.1)
    : rgb(0.1, 0.55, 0.15)
}

function mapItem(c: any) {
  return {
    itemId: c.itemId ?? c.item_id,
    regulation: c.regulation,
    requirement: c.requirement,
    requirementText: c.requirementText ?? c.requirement_text,
    category: c.category,
    internalDoc: c.internalDoc ?? c.internal_doc,
    docVersion: c.docVersion ?? c.doc_version,
    docOwner: c.docOwner ?? c.doc_owner,
    evidenceType: c.evidenceType ?? c.evidence_type,
    evidenceRef: c.evidenceRef ?? c.evidence_ref,
    evidenceDescription: c.evidenceDescription ?? c.evidence_description,
    lastVerified: c.lastVerified ?? (c.last_verified ? new Date(c.last_verified) : null),
    verifiedBy: c.verifiedBy ?? c.verified_by,
    status: c.status,
    riskLevel: c.riskLevel ?? c.risk_level,
    gapDescription: c.gapDescription ?? c.gap_description,
    correctiveAction: c.correctiveAction ?? c.corrective_action,
    nextReviewDate: c.nextReviewDate ?? (c.next_review_date ? new Date(c.next_review_date) : null),
    reviewFrequency: c.reviewFrequency ?? c.review_frequency,
  }
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

  let items: any[] = []
  if (isDemoMode()) {
    items = (await db.complianceItem.findMany({ orderBy: { regulation: 'asc' } })).map(mapItem)
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('compliance_items').select('*').order('regulation', { ascending: true })
    items = (data ?? []).map(mapItem)
  }

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
  addText('GSE CONTROL — COMPLIANCE MATRIX', margin, y, { size: 15, font: fontBold }); y -= 18
  addText('EASA Part-145 · ICAO Annex 14/15/19 · IATA AHM', margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 20

  // Summary
  const total = items.length
  const compliant = items.filter(i => i.status === 'COMPLIANT').length
  const nonCompliant = items.filter(i => i.status === 'NON_COMPLIANT').length
  const partial = items.filter(i => i.status === 'PARTIAL').length
  const complianceRate = total > 0 ? (compliant / total) * 100 : 0

  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Ukupno zahtjeva: ${total}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Sukladno: ${compliant}`, margin + 10, y, { size: 10, color: rgb(0.1, 0.55, 0.15) }); y -= 12
  addText(`• Nesukladno: ${nonCompliant}`, margin + 10, y, { size: 10, color: nonCompliant > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 12
  addText(`• Djelomicno: ${partial}`, margin + 10, y, { size: 10, color: partial > 0 ? rgb(0.85, 0.55, 0.1) : rgb(0, 0, 0) }); y -= 12
  const rateColor = complianceRate >= 90 ? rgb(0.1, 0.55, 0.15) : complianceRate >= 70 ? rgb(0.85, 0.55, 0.1) : rgb(0.86, 0.15, 0.15)
  addText(`• Stopa sukladnosti: ${complianceRate.toFixed(1)} %`, margin + 10, y, { size: 11, font: fontBold, color: rateColor }); y -= 20

  // Table
  addText('TABELA COMPLIANCE MATRIX:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 55, margin + 180, margin + 340, margin + 410, margin + 465]
  ;['ID', 'Regulativa', 'Zahtjev', 'Status', 'Rizik', 'Interni dok'].forEach((h, i) =>
    addText(h, cols[i], y, { size: 8, font: fontBold }))
  y -= 4
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const it of items) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText((it.itemId || '').slice(0, 9), cols[0], y, { size: 7, font: fontBold })
    addText((it.regulation || '').slice(0, 22), cols[1], y, { size: 7 })
    addText((it.requirement || '').slice(0, 30), cols[2], y, { size: 7 })
    addText((COMPLIANCE_STATUS_LABELS[it.status] || it.status || '').slice(0, 14), cols[3], y, { size: 7, color: statusColor(it.status), font: fontBold })
    addText((RISK_LABELS[it.riskLevel] || it.riskLevel || '-').slice(0, 10), cols[4], y, { size: 7, color: riskColor(it.riskLevel) })
    addText((it.internalDoc || '-').slice(0, 14), cols[5], y, { size: 7 })
    y -= 11
  }

  // Gap section za NON_COMPLIANT i PARTIAL
  const gapItems = items.filter(i => i.status === 'NON_COMPLIANT' || i.status === 'PARTIAL')
  if (gapItems.length > 0) {
    y -= 8
    if (y < 200) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText('GAP ANALIZA (NON_COMPLIANT i PARTIAL):', margin, y, { size: 12, font: fontBold }); y -= 16

    for (const it of gapItems) {
      if (y < 120) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
      addText(`${it.itemId} — ${it.regulation}: ${it.requirement}`, margin, y, { size: 10, font: fontBold, color: statusColor(it.status) }); y -= 13
      addText(`Status: ${COMPLIANCE_STATUS_LABELS[it.status] || it.status}    Rizik: ${RISK_LABELS[it.riskLevel] || it.riskLevel || '-'}    Interni dok: ${it.internalDoc || '-'}${it.docVersion ? ' v' + it.docVersion : ''}`, margin + 5, y, { size: 9 }); y -= 14

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
      writeBlock('Opis gap-a', it.gapDescription)
      writeBlock('Korektivna akcija', it.correctiveAction)
      y -= 4
    }
  } else {
    y -= 8
    addText('Nema nesukladnosti niti djelomicnih stavki — sve su sukladne ili nije primjenjivo.', margin, y, { size: 10, color: rgb(0.1, 0.55, 0.15), font: fontBold }); y -= 14
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="audit-compliance-matrix-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
