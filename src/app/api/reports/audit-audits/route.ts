import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'

const AUDIT_TYPE_LABELS: Record<string, string> = {
  INTERNAL: 'Interni', EXTERNAL: 'Eksterni', REGULATORY: 'Regulatorni',
  SUPPLIER: 'Dobavljac', PROCESS: 'Procesni', SYSTEM: 'Sistemski',
}
const AUDIT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Zakazan', IN_PROGRESS: 'U toku', COMPLETED: 'Zavrsen', CANCELLED: 'Otkazan',
}
const RESULT_LABELS: Record<string, string> = {
  CONFORMANT: 'Sukladan', NON_CONFORMANT: 'Nesukladan', CONDITIONAL: 'Uslovno',
}

function fmtDate(d: any): string {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('hr-HR') } catch { return '-' }
}

function mapAudit(a: any) {
  return {
    auditId: a.auditId ?? a.audit_id,
    title: a.title,
    auditType: a.auditType ?? a.audit_type,
    auditScope: a.auditScope ?? a.audit_scope,
    auditStandard: a.auditStandard ?? a.audit_standard,
    scheduledDate: a.scheduledDate ?? (a.scheduled_date ? new Date(a.scheduled_date) : null),
    startDate: a.startDate ?? (a.start_date ? new Date(a.start_date) : null),
    endDate: a.endDate ?? (a.end_date ? new Date(a.end_date) : null),
    leadAuditor: a.leadAuditor ?? a.lead_auditor,
    auditTeam: a.auditTeam ?? a.audit_team,
    auditeeOrganization: a.auditeeOrganization ?? a.auditee_organization,
    auditeeAreas: a.auditeeAreas ?? a.auditee_areas,
    status: a.status,
    overallResult: a.overallResult ?? a.overall_result,
    summary: a.summary,
    recommendations: a.recommendations,
  }
}

// Word-wrap helper za duge tekstove (Summary, Recommendations, Opis)
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
      // Ako je rijec duza od maxChars, odsjeci je
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

  let audits: any[] = []
  if (isDemoMode()) {
    audits = (await db.audit.findMany({ orderBy: { scheduledDate: 'desc' } })).map(mapAudit)
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('audits').select('*').order('scheduled_date', { ascending: false })
    audits = (data ?? []).map(mapAudit)
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
  addText('GSE CONTROL — AUDITI', margin, y, { size: 16, font: fontBold }); y -= 18
  addText('ADR.OPS.D.005 · EASA Part-145.A.65', margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 20

  // Summary
  const scheduled = audits.filter(a => a.status === 'SCHEDULED').length
  const inProgress = audits.filter(a => a.status === 'IN_PROGRESS').length
  const completed = audits.filter(a => a.status === 'COMPLETED').length

  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Ukupno audita: ${audits.length}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Zakazano: ${scheduled}`, margin + 10, y, { size: 10, color: scheduled > 0 ? rgb(0.85, 0.55, 0.1) : rgb(0, 0, 0) }); y -= 12
  addText(`• U toku: ${inProgress}`, margin + 10, y, { size: 10, color: inProgress > 0 ? rgb(0.85, 0.55, 0.1) : rgb(0, 0, 0) }); y -= 12
  addText(`• Zavrseno: ${completed}`, margin + 10, y, { size: 10, color: rgb(0.1, 0.55, 0.15) }); y -= 20

  // Table
  addText('TABELA AUDITA:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 65, margin + 155, margin + 230, margin + 320, margin + 385, margin + 445]
  ;['ID', 'Naslov', 'Tip', 'Auditor', 'Datum', 'Status', 'Rezultat'].forEach((h, i) =>
    addText(h, cols[i], y, { size: 8, font: fontBold }))
  y -= 4
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const a of audits) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    const statusColor = a.status === 'COMPLETED' ? rgb(0.1, 0.55, 0.15)
      : a.status === 'IN_PROGRESS' ? rgb(0.85, 0.55, 0.1)
      : a.status === 'CANCELLED' ? rgb(0.86, 0.15, 0.15)
      : rgb(0, 0, 0)
    addText((a.auditId || '').slice(0, 10), cols[0], y, { size: 7, font: fontBold })
    addText((a.title || '').slice(0, 26), cols[1], y, { size: 7 })
    addText((AUDIT_TYPE_LABELS[a.auditType] || a.auditType || '').slice(0, 14), cols[2], y, { size: 7 })
    addText((a.leadAuditor || '').slice(0, 18), cols[3], y, { size: 7 })
    addText(fmtDate(a.scheduledDate).slice(0, 12), cols[4], y, { size: 7 })
    addText((AUDIT_STATUS_LABELS[a.status] || a.status || '').slice(0, 14), cols[5], y, { size: 7, color: statusColor, font: fontBold })
    addText((RESULT_LABELS[a.overallResult] || a.overallResult || '-').slice(0, 14), cols[6], y, { size: 7 })
    y -= 11
  }

  // Details per audit
  y -= 8
  if (y < 200) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('DETALJNI PRIKAZ AUDITA:', margin, y, { size: 12, font: fontBold }); y -= 16

  for (const a of audits) {
    if (y < 160) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText(`${a.auditId} — ${a.title}`, margin, y, { size: 10, font: fontBold, color: rgb(0.15, 0.3, 0.6) }); y -= 13
    addText(`Tip: ${AUDIT_TYPE_LABELS[a.auditType] || a.auditType || '-'}    Status: ${AUDIT_STATUS_LABELS[a.status] || a.status}    Rezultat: ${RESULT_LABELS[a.overallResult] || a.overallResult || '-'}`, margin + 5, y, { size: 9 }); y -= 12
    addText(`Opseg: ${a.auditScope || '-'}`, margin + 5, y, { size: 9 }); y -= 12
    addText(`Standard: ${a.auditStandard || '-'}`, margin + 5, y, { size: 9 }); y -= 12
    addText(`Auditees: ${[a.auditeeOrganization, a.auditeeAreas].filter(Boolean).join(' · ') || '-'}`, margin + 5, y, { size: 9 }); y -= 12
    addText(`Datum: ${fmtDate(a.scheduledDate)}${a.startDate ? ' — start: ' + fmtDate(a.startDate) : ''}${a.endDate ? ' / end: ' + fmtDate(a.endDate) : ''}`, margin + 5, y, { size: 9 }); y -= 12
    addText(`Auditor: ${a.leadAuditor || '-'}${a.auditTeam ? ' (tim: ' + a.auditTeam + ')' : ''}`, margin + 5, y, { size: 9 }); y -= 14

    if (a.summary) {
      addText('Summary:', margin + 5, y, { size: 9, font: fontBold }); y -= 11
      for (const ln of wrapText(a.summary, 110)) {
        if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
        addText(ln, margin + 10, y, { size: 8, color: rgb(0.3, 0.3, 0.3) }); y -= 10
      }
      y -= 2
    }
    if (a.recommendations) {
      if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
      addText('Recommendations:', margin + 5, y, { size: 9, font: fontBold }); y -= 11
      for (const ln of wrapText(a.recommendations, 110)) {
        if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
        addText(ln, margin + 10, y, { size: 8, color: rgb(0.3, 0.3, 0.3) }); y -= 10
      }
      y -= 2
    }
    y -= 6
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="audit-audits-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
