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
const PROGRAM_STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planiran', SCHEDULED: 'Zakazan', IN_PROGRESS: 'U toku',
  COMPLETED: 'Zavrsen', CANCELLED: 'Otkazan', OVERDUE: 'Prekoracen',
}
const RESULT_LABELS: Record<string, string> = {
  CONFORMANT: 'Sukladan', NON_CONFORMANT: 'Nesukladan', CONDITIONAL: 'Uslovno',
}
const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Nizak', MEDIUM: 'Srednji', HIGH: 'Visok', CRITICAL: 'Kritican',
}

function fmtDate(d: any): string {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('hr-HR') } catch { return '-' }
}

function mapProgram(p: any) {
  return {
    programId: p.programId ?? p.program_id,
    title: p.title,
    auditType: p.auditType ?? p.audit_type,
    auditScope: p.auditScope ?? p.audit_scope,
    auditStandard: p.auditStandard ?? p.audit_standard,
    plannedYear: p.plannedYear ?? p.planned_year,
    plannedQuarter: p.plannedQuarter ?? p.planned_quarter,
    plannedDate: p.plannedDate ?? (p.planned_date ? new Date(p.planned_date) : null),
    leadAuditor: p.leadAuditor ?? p.lead_auditor,
    auditees: p.auditees,
    status: p.status,
    priority: p.priority,
    findingsCount: p.findingsCount ?? p.findings_count ?? 0,
    majorFindings: p.majorFindings ?? p.major_findings ?? 0,
    minorFindings: p.minorFindings ?? p.minor_findings ?? 0,
    observations: p.observations ?? 0,
    overallResult: p.overallResult ?? p.overall_result,
    notes: p.notes,
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  let programs: any[] = []
  if (isDemoMode()) {
    programs = (await db.auditProgram.findMany({ orderBy: { plannedYear: 'desc' } })).map(mapProgram)
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('audit_programs').select('*').order('planned_year', { ascending: false })
    programs = (data ?? []).map(mapProgram)
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
  addText('GSE CONTROL — AUDIT PROGRAM', margin, y, { size: 16, font: fontBold }); y -= 18
  addText('ADR.OPS.D.005 · EASA Part-145.A.65', margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 20

  // Summary
  const planned = programs.filter(p => p.status === 'PLANNED' || p.status === 'SCHEDULED').length
  const completed = programs.filter(p => p.status === 'COMPLETED').length
  const overdue = programs.filter(p => p.plannedDate && new Date(p.plannedDate) < today && p.status !== 'COMPLETED').length

  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Ukupno programa: ${programs.length}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Planirano/Zakazano: ${planned}`, margin + 10, y, { size: 10, color: planned > 0 ? rgb(0.85, 0.55, 0.1) : rgb(0, 0, 0) }); y -= 12
  addText(`• Zavrseno: ${completed}`, margin + 10, y, { size: 10, color: rgb(0.1, 0.55, 0.15) }); y -= 12
  addText(`• Prekoraceno: ${overdue}`, margin + 10, y, { size: 10, color: overdue > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 20

  // Table
  addText('TABELA PROGRAMA:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 65, margin + 145, margin + 215, margin + 305, margin + 375, margin + 445]
  ;['ID', 'Naslov', 'Tip', 'Auditor', 'Status', 'Rezultat', 'Nalaza'].forEach((h, i) =>
    addText(h, cols[i], y, { size: 8, font: fontBold }))
  y -= 4
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const p of programs) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    const statusColor = p.status === 'OVERDUE' ? rgb(0.86, 0.15, 0.15)
      : p.status === 'COMPLETED' ? rgb(0.1, 0.55, 0.15)
      : p.status === 'IN_PROGRESS' ? rgb(0.85, 0.55, 0.1)
      : rgb(0, 0, 0)
    addText((p.programId || '').slice(0, 12), cols[0], y, { size: 7, font: fontBold })
    addText((p.title || '').slice(0, 24), cols[1], y, { size: 7 })
    addText((AUDIT_TYPE_LABELS[p.auditType] || p.auditType || '').slice(0, 16), cols[2], y, { size: 7 })
    addText((p.leadAuditor || '').slice(0, 20), cols[3], y, { size: 7 })
    addText((PROGRAM_STATUS_LABELS[p.status] || p.status || '').slice(0, 16), cols[4], y, { size: 7, color: statusColor, font: fontBold })
    addText((RESULT_LABELS[p.overallResult] || p.overallResult || '-').slice(0, 16), cols[5], y, { size: 7 })
    addText(String(p.findingsCount ?? 0), cols[6], y, { size: 7 })
    y -= 11
  }

  // Details per program
  y -= 8
  if (y < 200) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('DETALJNI PRIKAZ PROGRAMA:', margin, y, { size: 12, font: fontBold }); y -= 16

  for (const p of programs) {
    if (y < 130) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText(`${p.programId} — ${p.title}`, margin, y, { size: 10, font: fontBold, color: rgb(0.15, 0.3, 0.6) }); y -= 13
    addText(`Tip: ${AUDIT_TYPE_LABELS[p.auditType] || p.auditType || '-'}    Status: ${PROGRAM_STATUS_LABELS[p.status] || p.status}    Prioritet: ${PRIORITY_LABELS[p.priority] || p.priority || '-'}`, margin + 5, y, { size: 9 }); y -= 12
    addText(`Opseg: ${p.auditScope || '-'}`, margin + 5, y, { size: 9 }); y -= 12
    addText(`Standard: ${p.auditStandard || '-'}`, margin + 5, y, { size: 9 }); y -= 12
    addText(`Auditees: ${p.auditees || '-'}`, margin + 5, y, { size: 9 }); y -= 12
    addText(`Planirani datum: ${fmtDate(p.plannedDate)} (${p.plannedYear}${p.plannedQuarter ? ' / Q' + p.plannedQuarter : ''})`, margin + 5, y, { size: 9 }); y -= 12
    addText(`Auditor: ${p.leadAuditor || '-'}`, margin + 5, y, { size: 9 }); y -= 12
    addText(`Nalazi: ukupno ${p.findingsCount ?? 0} (Major: ${p.majorFindings ?? 0}, Minor: ${p.minorFindings ?? 0}, Opservacije: ${p.observations ?? 0})    Rezultat: ${RESULT_LABELS[p.overallResult] || p.overallResult || '-'}`, margin + 5, y, { size: 9 }); y -= 16
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="audit-program-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
