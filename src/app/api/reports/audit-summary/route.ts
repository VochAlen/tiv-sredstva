import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'

// ============== LABELS ==============
const AUDIT_TYPE_LABELS: Record<string, string> = {
  INTERNAL: 'Interni', EXTERNAL: 'Eksterni', REGULATORY: 'Regulatorni',
  SUPPLIER: 'Dobavljac', PROCESS: 'Procesni', SYSTEM: 'Sistemski',
}
const PROGRAM_STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planiran', SCHEDULED: 'Zakazan', IN_PROGRESS: 'U toku',
  COMPLETED: 'Zavrsen', CANCELLED: 'Otkazan', OVERDUE: 'Prekoracen',
}
const AUDIT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Zakazan', IN_PROGRESS: 'U toku', COMPLETED: 'Zavrsen', CANCELLED: 'Otkazan',
}
const CLASSIFICATION_LABELS: Record<string, string> = {
  MAJOR: 'Major', MINOR: 'Minor', OBSERVATION: 'Opservacija', POSITIVE: 'Pozitivno',
}
const CAPA_TYPE_LABELS: Record<string, string> = {
  CORRECTIVE: 'Korektivna', PREVENTIVE: 'Preventivna', CORRECTIVE_AND_PREVENTIVE: 'Korektivna + Preventivna',
}
const CAPA_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Otvorena', IN_PROGRESS: 'U toku', IMPLEMENTED: 'Implementirana',
  VERIFIED: 'Verifikovana', CLOSED: 'Zatvorena', OVERDUE: 'Prekoracena',
}
const COMPLIANCE_STATUS_LABELS: Record<string, string> = {
  COMPLIANT: 'Sukladno', NON_COMPLIANT: 'Nesukladno', PARTIAL: 'Djelomicno',
  NOT_APPLICABLE: 'Nije primjenjivo', PENDING_REVIEW: 'Ceka pregled',
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

// ====== Mapperi (isti kao u pojedinacnim rutama, ali minimalni — samo ono sto treba za summary) ======
function mapProgram(p: any) {
  return {
    status: p.status,
    plannedDate: p.plannedDate ?? (p.planned_date ? new Date(p.planned_date) : null),
    auditType: p.auditType ?? p.audit_type,
  }
}
function mapAudit(a: any) {
  return { status: a.status, auditType: a.auditType ?? a.audit_type }
}
function mapFinding(f: any) {
  return {
    classification: f.classification,
    status: f.status,
    dueDate: f.dueDate ?? (f.due_date ? new Date(f.due_date) : null),
    riskLevel: f.riskLevel ?? f.risk_level,
  }
}
function mapCAPA(c: any) {
  return {
    status: c.status,
    dueDate: c.dueDate ?? (c.due_date ? new Date(c.due_date) : null),
    actualCost: c.actualCost ?? c.actual_cost,
    estimatedCost: c.estimatedCost ?? c.estimated_cost,
    type: c.type,
  }
}
function mapItem(i: any) {
  return {
    status: i.status,
    riskLevel: i.riskLevel ?? i.risk_level,
    category: i.category,
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  let programs: any[] = [], audits: any[] = [], findings: any[] = [], capas: any[] = [], items: any[] = []
  if (isDemoMode()) {
    [programs, audits, findings, capas, items] = await Promise.all([
      db.auditProgram.findMany(),
      db.audit.findMany(),
      db.auditFinding.findMany(),
      db.cAPA.findMany(),
      db.complianceItem.findMany(),
    ])
    programs = programs.map(mapProgram)
    audits = audits.map(mapAudit)
    findings = findings.map(mapFinding)
    capas = capas.map(mapCAPA)
    items = items.map(mapItem)
  } else {
    const supabase = await createSupabaseClient()
    const [p, a, f, c, i] = await Promise.all([
      supabase.from('audit_programs').select('status, planned_date, audit_type'),
      supabase.from('audits').select('status, audit_type'),
      supabase.from('audit_findings').select('classification, status, due_date, risk_level'),
      supabase.from('capas').select('status, due_date, actual_cost, estimated_cost, type'),
      supabase.from('compliance_items').select('status, risk_level, category'),
    ])
    programs = (p.data ?? []).map(mapProgram)
    audits = (a.data ?? []).map(mapAudit)
    findings = (f.data ?? []).map(mapFinding)
    capas = (c.data ?? []).map(mapCAPA)
    items = (i.data ?? []).map(mapItem)
  }

  const today = new Date()

  // ====== KPI proracuni ======
  const plannedP = programs.filter(p => p.status === 'PLANNED' || p.status === 'SCHEDULED').length
  const completedP = programs.filter(p => p.status === 'COMPLETED').length
  const overdueP = programs.filter(p => p.plannedDate && new Date(p.plannedDate) < today && p.status !== 'COMPLETED').length

  const scheduledA = audits.filter(a => a.status === 'SCHEDULED').length
  const inProgressA = audits.filter(a => a.status === 'IN_PROGRESS').length
  const completedA = audits.filter(a => a.status === 'COMPLETED').length

  const majorF = findings.filter(f => f.classification === 'MAJOR').length
  const minorF = findings.filter(f => f.classification === 'MINOR').length
  const obsF = findings.filter(f => f.classification === 'OBSERVATION').length
  const posF = findings.filter(f => f.classification === 'POSITIVE').length
  const openF = findings.filter(f => f.status === 'OPEN' || f.status === 'IN_PROGRESS').length
  const closedF = findings.filter(f => f.status === 'CLOSED' || f.status === 'VERIFIED').length
  const overdueF = findings.filter(f => f.dueDate && new Date(f.dueDate) < today && f.status !== 'CLOSED' && f.status !== 'VERIFIED').length
  const criticalOpenF = findings.filter(f => f.classification === 'MAJOR' && (f.status === 'OPEN' || f.status === 'IN_PROGRESS')).length

  const openC = capas.filter(c => c.status === 'OPEN' || c.status === 'IN_PROGRESS').length
  const implementedC = capas.filter(c => c.status === 'IMPLEMENTED').length
  const verifiedC = capas.filter(c => c.status === 'VERIFIED').length
  const closedC = capas.filter(c => c.status === 'CLOSED').length
  const overdueC = capas.filter(c => c.dueDate && new Date(c.dueDate) < today && c.status !== 'CLOSED' && c.status !== 'VERIFIED').length
  const totalCostC = capas.reduce((s, c) => s + (c.actualCost ?? c.estimatedCost ?? 0), 0)

  const compliantI = items.filter(i => i.status === 'COMPLIANT').length
  const nonCompliantI = items.filter(i => i.status === 'NON_COMPLIANT').length
  const partialI = items.filter(i => i.status === 'PARTIAL').length
  const pendingI = items.filter(i => i.status === 'PENDING_REVIEW').length
  const complianceRate = items.length > 0 ? (compliantI / items.length) * 100 : 0

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
  addText('GSE CONTROL — AUDIT & COMPLIANCE SAZETAK', margin, y, { size: 15, font: fontBold }); y -= 18
  addText('ADR.OPS.D.005 · EASA Part-145.A.65 · ICAO Annex 19 · EASA M.GEN.205', margin, y, { size: 9, color: GREY }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 20

  // 1. AUDIT PROGRAM
  addText('1. AUDIT PROGRAM', margin, y, { size: 13, font: fontBold, color: BLUE }); y -= 15
  addText(`• Ukupno programa: ${programs.length}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Planirano/Zakazano: ${plannedP}`, margin + 10, y, { size: 10, color: plannedP > 0 ? YELLOW : rgb(0, 0, 0) }); y -= 12
  addText(`• Zavrseno: ${completedP}`, margin + 10, y, { size: 10, color: GREEN }); y -= 12
  addText(`• Prekoraceno: ${overdueP}`, margin + 10, y, { size: 10, color: overdueP > 0 ? RED : rgb(0, 0, 0) }); y -= 18

  // 2. AUDITI
  addText('2. AUDITI', margin, y, { size: 13, font: fontBold, color: BLUE }); y -= 15
  addText(`• Ukupno audita: ${audits.length}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Zakazano: ${scheduledA}`, margin + 10, y, { size: 10, color: scheduledA > 0 ? YELLOW : rgb(0, 0, 0) }); y -= 12
  addText(`• U toku: ${inProgressA}`, margin + 10, y, { size: 10, color: inProgressA > 0 ? YELLOW : rgb(0, 0, 0) }); y -= 12
  addText(`• Zavrseno: ${completedA}`, margin + 10, y, { size: 10, color: GREEN }); y -= 18

  // 3. FINDINGS
  addText('3. FINDINGS (NALAZI AUDITA)', margin, y, { size: 13, font: fontBold, color: BLUE }); y -= 15
  addText(`• Ukupno nalaza: ${findings.length}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Major: ${majorF}`, margin + 10, y, { size: 10, color: majorF > 0 ? RED : rgb(0, 0, 0) }); y -= 12
  addText(`• Minor: ${minorF}`, margin + 10, y, { size: 10, color: minorF > 0 ? YELLOW : rgb(0, 0, 0) }); y -= 12
  addText(`• Opservacija: ${obsF}`, margin + 10, y, { size: 10, color: BLUE }); y -= 12
  addText(`• Pozitivno: ${posF}`, margin + 10, y, { size: 10, color: GREEN }); y -= 12
  addText(`• Otvoreni: ${openF}`, margin + 10, y, { size: 10, color: openF > 0 ? YELLOW : rgb(0, 0, 0) }); y -= 12
  addText(`• Zatvoreni: ${closedF}`, margin + 10, y, { size: 10, color: GREEN }); y -= 12
  addText(`• Prekoraceni rok: ${overdueF}`, margin + 10, y, { size: 10, color: overdueF > 0 ? RED : rgb(0, 0, 0) }); y -= 18

  // 4. CAPA
  if (y < 200) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('4. CAPA (Corrective and Preventive Actions)', margin, y, { size: 13, font: fontBold, color: BLUE }); y -= 15
  addText(`• Ukupno CAPA: ${capas.length}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Otvorene: ${openC}`, margin + 10, y, { size: 10, color: openC > 0 ? YELLOW : rgb(0, 0, 0) }); y -= 12
  addText(`• Implementirane: ${implementedC}`, margin + 10, y, { size: 10, color: BLUE }); y -= 12
  addText(`• Verifikovane: ${verifiedC}`, margin + 10, y, { size: 10, color: BLUE }); y -= 12
  addText(`• Zatvorene: ${closedC}`, margin + 10, y, { size: 10, color: GREEN }); y -= 12
  addText(`• Prekoracene: ${overdueC}`, margin + 10, y, { size: 10, color: overdueC > 0 ? RED : rgb(0, 0, 0) }); y -= 12
  addText(`• Ukupni trosak: ${totalCostC.toFixed(2)} EUR`, margin + 10, y, { size: 10, font: fontBold }); y -= 18

  // 5. COMPLIANCE MATRIX
  if (y < 200) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('5. COMPLIANCE MATRIX', margin, y, { size: 13, font: fontBold, color: BLUE }); y -= 15
  addText(`• Ukupno zahtjeva: ${items.length}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Sukladno: ${compliantI}`, margin + 10, y, { size: 10, color: GREEN }); y -= 12
  addText(`• Nesukladno: ${nonCompliantI}`, margin + 10, y, { size: 10, color: nonCompliantI > 0 ? RED : rgb(0, 0, 0) }); y -= 12
  addText(`• Djelomicno: ${partialI}`, margin + 10, y, { size: 10, color: partialI > 0 ? YELLOW : rgb(0, 0, 0) }); y -= 12
  addText(`• Ceka pregled: ${pendingI}`, margin + 10, y, { size: 10, color: pendingI > 0 ? BLUE : rgb(0, 0, 0) }); y -= 12
  const rateColor = complianceRate >= 90 ? GREEN : complianceRate >= 70 ? YELLOW : RED
  addText(`• Stopa sukladnosti: ${complianceRate.toFixed(1)} %`, margin + 10, y, { size: 11, font: fontBold, color: rateColor }); y -= 20

  // 6. ZAKLJUCAK — overall health
  if (y < 180) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('6. ZAKLJUCAK', margin, y, { size: 13, font: fontBold, color: BLUE }); y -= 16

  // Health određen: compliance rate + open critical findings (MAJOR + OPEN/IN_PROGRESS)
  const hasCriticalOpen = criticalOpenF > 0
  const hasHighGaps = nonCompliantI > 0 || overdueF > 0 || overdueC > 0 || overdueP > 0

  let healthText = ''
  let healthColor = GREEN
  if (complianceRate < 70 || hasCriticalOpen) {
    healthText = 'Uputenost za uskladjenost zahtijeva hitnu paznju — identifikovani su kriticni otvoreni nalazi ili niska stopa sukladnosti.'
    healthColor = RED
  } else if (complianceRate < 90 || hasHighGaps) {
    healthText = 'Stanje uskladjenosti je prihvatljivo ali zahtijeva pracenje — postoje otvoreni gap-ovi ili nesukladnosti.'
    healthColor = YELLOW
  } else {
    healthText = 'Stanje uskladjenosti je dobro — visoka stopa sukladnosti i nema kriticnih otvorenih nalaza.'
    healthColor = GREEN
  }

  addText('Ukupna ocjena:', margin + 10, y, { size: 10, font: fontBold }); y -= 13
  addText(healthText, margin + 10, y, { size: 10, color: healthColor }); y -= 18

  addText('Preporuke:', margin + 10, y, { size: 10, font: fontBold }); y -= 13
  const recs: string[] = []
  if (criticalOpenF > 0) recs.push(`• Hitno zatvoriti ${criticalOpenF} otvoreni(h) MAJOR nalaz(a).`)
  if (nonCompliantI > 0) recs.push(`• Izvrsiti korektivne akcije za ${nonCompliantI} nesukladnih stavki u Compliance Matrix.`)
  if (partialI > 0) recs.push(`• Kompletirati ${partialI} djelomicno sukladnih stavki.`)
  if (overdueF > 0) recs.push(`• Obraditi ${overdueF} prekoracenih nalaza (rok prosao).`)
  if (overdueC > 0) recs.push(`• Zatvoriti ${overdueC} prekoracenih CAPA akcija.`)
  if (overdueP > 0) recs.push(`• Preispitati ${overdueP} prekoracenih programa audita.`)
  if (openC > 0) recs.push(`• Verifikovati ${openC} otvorenih CAPA akcija.`)
  if (pendingI > 0) recs.push(`• Pregledati ${pendingI} stavki koje cekaju pregled.`)
  if (recs.length === 0) recs.push('• Nastaviti sa redovnim pracenjem i odrzavanjem sistema uskladjenosti.')
  for (const r of recs) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText(r, margin + 15, y, { size: 9, color: GREY }); y -= 11
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="audit-summary-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
