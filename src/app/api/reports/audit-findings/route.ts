import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'

const CLASSIFICATION_LABELS: Record<string, string> = {
  MAJOR: 'Major', MINOR: 'Minor', OBSERVATION: 'Opservacija', POSITIVE: 'Pozitivno',
}
const FINDING_CATEGORY_LABELS: Record<string, string> = {
  DOCUMENTATION: 'Dokumentacija', PROCESS: 'Proces', TRAINING: 'Obuka',
  EQUIPMENT: 'Oprema', SAFETY: 'Sigurnost', COMPLIANCE: 'Sukladnost',
  RECORDS: 'Evidencije', OTHER: 'Ostalo',
}
const FINDING_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Otvoren', IN_PROGRESS: 'U toku', CORRECTED: 'Korigovan',
  VERIFIED: 'Verifikovan', CLOSED: 'Zatvoren', DEFERRED: 'Odgodjen',
}

function fmtDate(d: any): string {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('hr-HR') } catch { return '-' }
}

function classColor(c: string): any {
  return c === 'MAJOR' ? rgb(0.86, 0.15, 0.15)
    : c === 'MINOR' ? rgb(0.85, 0.55, 0.1)
    : c === 'POSITIVE' ? rgb(0.1, 0.55, 0.15)
    : rgb(0.2, 0.4, 0.7)
}

function mapFinding(f: any, audit?: any) {
  const a = audit ?? f.audits ?? f.audit
  return {
    findingId: f.findingId ?? f.finding_id,
    auditId: f.auditId ?? f.audit_id,
    classification: f.classification,
    category: f.category,
    title: f.title,
    description: f.description,
    criteria: f.criteria,
    evidence: f.evidence,
    area: f.area,
    process: f.process,
    rootCause: f.rootCause ?? f.root_cause,
    correctiveAction: f.correctiveAction ?? f.corrective_action,
    preventiveAction: f.preventiveAction ?? f.preventive_action,
    status: f.status,
    assignedTo: f.assignedTo ?? f.assigned_to,
    dueDate: f.dueDate ?? (f.due_date ? new Date(f.due_date) : null),
    verificationResult: f.verificationResult ?? f.verification_result,
    verifiedBy: f.verifiedBy ?? f.verified_by,
    riskLevel: f.riskLevel ?? f.risk_level,
    audit: a ? {
      auditId: a.auditId ?? a.audit_id,
      title: a.title,
    } : null,
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

  let findings: any[] = []
  if (isDemoMode()) {
    findings = (await db.auditFinding.findMany({
      orderBy: { createdAt: 'desc' }, include: { audit: true },
    })).map((f: any) => mapFinding(f, f.audit))
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('audit_findings').select('*, audits(*)').order('created_at', { ascending: false })
    findings = (data ?? []).map((f: any) => mapFinding(f))
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
  addText('GSE CONTROL — AUDIT FINDINGS (NALAZI AUDITA)', margin, y, { size: 15, font: fontBold }); y -= 18
  addText('ADR.OPS.D.005 · EASA Part-145.A.65', margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 20

  // Summary po klasifikaciji
  const major = findings.filter(f => f.classification === 'MAJOR').length
  const minor = findings.filter(f => f.classification === 'MINOR').length
  const obs = findings.filter(f => f.classification === 'OBSERVATION').length
  const pos = findings.filter(f => f.classification === 'POSITIVE').length
  const overdue = findings.filter(f => f.dueDate && new Date(f.dueDate) < today && f.status !== 'CLOSED' && f.status !== 'VERIFIED').length

  addText('SAZETAK PO KLASIFIKACIJI:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Ukupno nalaza: ${findings.length}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Major: ${major}`, margin + 10, y, { size: 10, color: major > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 12
  addText(`• Minor: ${minor}`, margin + 10, y, { size: 10, color: minor > 0 ? rgb(0.85, 0.55, 0.1) : rgb(0, 0, 0) }); y -= 12
  addText(`• Opservacija: ${obs}`, margin + 10, y, { size: 10, color: rgb(0.2, 0.4, 0.7) }); y -= 12
  addText(`• Pozitivno: ${pos}`, margin + 10, y, { size: 10, color: rgb(0.1, 0.55, 0.15) }); y -= 12
  addText(`• Prekoraceni rok: ${overdue}`, margin + 10, y, { size: 10, color: overdue > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 20

  // Table
  addText('TABELA NALAZA:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 60, margin + 120, margin + 245, margin + 340, margin + 400, margin + 460]
  ;['ID', 'Klasa', 'Kategorija', 'Naslov', 'Status', 'Zaduzen', 'Rok'].forEach((h, i) =>
    addText(h, cols[i], y, { size: 8, font: fontBold }))
  y -= 4
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const f of findings) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText((f.findingId || '').slice(0, 10), cols[0], y, { size: 7, font: fontBold })
    addText((CLASSIFICATION_LABELS[f.classification] || f.classification || '').slice(0, 14), cols[1], y, { size: 7, color: classColor(f.classification), font: fontBold })
    addText((FINDING_CATEGORY_LABELS[f.category] || f.category || '').slice(0, 18), cols[2], y, { size: 7 })
    addText((f.title || '').slice(0, 16), cols[3], y, { size: 7 })
    addText((FINDING_STATUS_LABELS[f.status] || f.status || '').slice(0, 12), cols[4], y, { size: 7 })
    addText((f.assignedTo || '-').slice(0, 12), cols[5], y, { size: 7 })
    addText(fmtDate(f.dueDate).slice(0, 12), cols[6], y, { size: 7 })
    y -= 11
  }

  // Details per finding
  y -= 8
  if (y < 200) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('DETALJNI PRIKAZ NALAZA:', margin, y, { size: 12, font: fontBold }); y -= 16

  for (const f of findings) {
    if (y < 180) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText(`${f.findingId} — ${f.title}`, margin, y, { size: 10, font: fontBold, color: classColor(f.classification) }); y -= 13
    addText(`Klasa: ${CLASSIFICATION_LABELS[f.classification] || f.classification}    Kategorija: ${FINDING_CATEGORY_LABELS[f.category] || f.category}    Status: ${FINDING_STATUS_LABELS[f.status] || f.status}    Rizik: ${f.riskLevel || '-'}`, margin + 5, y, { size: 9 }); y -= 12
    addText(`Audit: ${f.audit ? f.audit.auditId + ' — ' + (f.audit.title || '') : f.auditId || '-'}`, margin + 5, y, { size: 9 }); y -= 12
    addText(`Oblast: ${f.area || '-'}    Proces: ${f.process || '-'}    Zaduzen: ${f.assignedTo || '-'}    Rok: ${fmtDate(f.dueDate)}`, margin + 5, y, { size: 9 }); y -= 14

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

    writeBlock('Opis', f.description)
    writeBlock('Kriterijum', f.criteria)
    writeBlock('Dokaz', f.evidence)
    writeBlock('Korektivna akcija', f.correctiveAction)
    writeBlock('Verifikacija', f.verificationResult ? `${f.verificationResult}${f.verifiedBy ? ' (od ' + f.verifiedBy + ')' : ''}` : undefined)
    y -= 4
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="audit-findings-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
