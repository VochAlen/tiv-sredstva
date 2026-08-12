import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'

const CAPA_TYPE_LABELS: Record<string, string> = {
  CORRECTIVE: 'Korektivna', PREVENTIVE: 'Preventivna', CORRECTIVE_AND_PREVENTIVE: 'Korektivna + Preventivna',
}
const CAPA_SOURCE_LABELS: Record<string, string> = {
  AUDIT_FINDING: 'Nalaz audita', INCIDENT: 'Incident', HAZARD: 'Hazard',
  SMS: 'SMS', MANAGEMENT_REVIEW: 'Menadzment revizija',
  EXTERNAL_AUDIT: 'Eksterni audit', CUSTOMER_COMPLAINT: 'Zalba klijenta', OTHER: 'Ostalo',
}
const CAPA_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Otvorena', IN_PROGRESS: 'U toku', IMPLEMENTED: 'Implementirana',
  VERIFIED: 'Verifikovana', CLOSED: 'Zatvorena', OVERDUE: 'Prekoracena',
}

function fmtDate(d: any): string {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('hr-HR') } catch { return '-' }
}

function statusColor(s: string): any {
  return s === 'OVERDUE' ? rgb(0.86, 0.15, 0.15)
    : s === 'CLOSED' || s === 'VERIFIED' ? rgb(0.1, 0.55, 0.15)
    : s === 'IMPLEMENTED' ? rgb(0.2, 0.4, 0.7)
    : s === 'IN_PROGRESS' ? rgb(0.85, 0.55, 0.1)
    : rgb(0, 0, 0)
}

function mapCAPA(c: any) {
  return {
    capaId: c.capaId ?? c.capa_id,
    title: c.title,
    description: c.description,
    type: c.type,
    source: c.source,
    sourceRef: c.sourceRef ?? c.source_ref,
    problemStatement: c.problemStatement ?? c.problem_statement,
    rootCause: c.rootCause ?? c.root_cause,
    correctiveAction: c.correctiveAction ?? c.corrective_action,
    preventiveAction: c.preventiveAction ?? c.preventive_action,
    assignedTo: c.assignedTo ?? c.assigned_to,
    dueDate: c.dueDate ?? (c.due_date ? new Date(c.due_date) : null),
    status: c.status,
    implementationEvidence: c.implementationEvidence ?? c.implementation_evidence,
    verificationResult: c.verificationResult ?? c.verification_result,
    verifiedBy: c.verifiedBy ?? c.verified_by,
    estimatedCost: c.estimatedCost ?? c.estimated_cost,
    actualCost: c.actualCost ?? c.actual_cost,
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

  let capas: any[] = []
  if (isDemoMode()) {
    capas = (await db.cAPA.findMany({ orderBy: { createdAt: 'desc' } })).map(mapCAPA)
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('capas').select('*').order('created_at', { ascending: false })
    capas = (data ?? []).map(mapCAPA)
  }

  const today = new Date()

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
  addText('GSE CONTROL — CAPA (Corrective and Preventive Actions)', margin, y, { size: 14, font: fontBold }); y -= 18
  addText('ADR.OPS.D.005 · EASA Part-145.A.65 · ICAO Annex 19', margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 20

  // Summary
  const open = capas.filter(c => c.status === 'OPEN' || c.status === 'IN_PROGRESS').length
  const implemented = capas.filter(c => c.status === 'IMPLEMENTED').length
  const verified = capas.filter(c => c.status === 'VERIFIED').length
  const closed = capas.filter(c => c.status === 'CLOSED').length
  const overdue = capas.filter(c => c.dueDate && new Date(c.dueDate) < today && c.status !== 'CLOSED' && c.status !== 'VERIFIED').length
  const totalCost = capas.reduce((s, c) => s + (c.actualCost ?? c.estimatedCost ?? 0), 0)

  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Ukupno CAPA: ${capas.length}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Otvorene: ${open}`, margin + 10, y, { size: 10, color: open > 0 ? rgb(0.85, 0.55, 0.1) : rgb(0, 0, 0) }); y -= 12
  addText(`• Implementirane: ${implemented}`, margin + 10, y, { size: 10, color: rgb(0.2, 0.4, 0.7) }); y -= 12
  addText(`• Verifikovane: ${verified}`, margin + 10, y, { size: 10, color: rgb(0.2, 0.4, 0.7) }); y -= 12
  addText(`• Zatvorene: ${closed}`, margin + 10, y, { size: 10, color: rgb(0.1, 0.55, 0.15) }); y -= 12
  addText(`• Prekoracene: ${overdue}`, margin + 10, y, { size: 10, color: overdue > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 12
  addText(`• Ukupni trosak: ${totalCost.toFixed(2)} EUR`, margin + 10, y, { size: 10, font: fontBold }); y -= 20

  // Table
  addText('TABELA CAPA:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 65, margin + 180, margin + 275, margin + 365, margin + 425, margin + 480]
  ;['ID', 'Tip', 'Naslov', 'Izvor', 'Zaduzen', 'Rok', 'Status'].forEach((h, i) =>
    addText(h, cols[i], y, { size: 8, font: fontBold }))
  y -= 4
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const c of capas) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText((c.capaId || '').slice(0, 12), cols[0], y, { size: 7, font: fontBold })
    addText((CAPA_TYPE_LABELS[c.type] || c.type || '').slice(0, 20), cols[1], y, { size: 7 })
    addText((c.title || '').slice(0, 18), cols[2], y, { size: 7 })
    addText((CAPA_SOURCE_LABELS[c.source] || c.source || '').slice(0, 16), cols[3], y, { size: 7 })
    addText((c.assignedTo || '-').slice(0, 12), cols[4], y, { size: 7 })
    addText(fmtDate(c.dueDate).slice(0, 12), cols[5], y, { size: 7 })
    addText((CAPA_STATUS_LABELS[c.status] || c.status || '').slice(0, 14), cols[6], y, { size: 7, color: statusColor(c.status), font: fontBold })
    y -= 11
  }

  // Details per CAPA
  y -= 8
  if (y < 200) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('DETALJNI PRIKAZ CAPA:', margin, y, { size: 12, font: fontBold }); y -= 16

  for (const c of capas) {
    if (y < 180) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText(`${c.capaId} — ${c.title}`, margin, y, { size: 10, font: fontBold, color: rgb(0.15, 0.3, 0.6) }); y -= 13
    addText(`Tip: ${CAPA_TYPE_LABELS[c.type] || c.type}    Izvor: ${CAPA_SOURCE_LABELS[c.source] || c.source}${c.sourceRef ? ' (' + c.sourceRef + ')' : ''}    Status: ${CAPA_STATUS_LABELS[c.status] || c.status}`, margin + 5, y, { size: 9 }); y -= 12
    addText(`Zaduzen: ${c.assignedTo || '-'}    Rok: ${fmtDate(c.dueDate)}    Trosak: ${((c.actualCost ?? c.estimatedCost) ?? 0).toFixed(2)} EUR${c.actualCost != null && c.estimatedCost != null ? ' (est: ' + c.estimatedCost.toFixed(2) + ')' : ''}`, margin + 5, y, { size: 9 }); y -= 14

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

    writeBlock('Problem', c.problemStatement)
    writeBlock('Korijenski uzrok', c.rootCause)
    writeBlock('Korektivna akcija', c.correctiveAction)
    writeBlock('Preventivna akcija', c.preventiveAction)
    writeBlock('Verifikacija', c.verificationResult ? `${c.verificationResult}${c.verifiedBy ? ' (od ' + c.verifiedBy + ')' : ''}` : undefined)
    writeBlock('Dokaz implementacije', c.implementationEvidence)
    y -= 4
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="audit-capa-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
