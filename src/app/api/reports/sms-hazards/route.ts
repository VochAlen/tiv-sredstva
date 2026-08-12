import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'

const RISK_LABELS: Record<string, string> = { LOW: 'Nizak', MEDIUM: 'Srednji', HIGH: 'Visok', CRITICAL: 'Kriticni' }
const CAT_LABELS: Record<string, string> = { OPERATIONAL: 'Operativni', TECHNICAL: 'Tehnicki', ENVIRONMENTAL: 'Ekoloski', HUMAN: 'Ljudski', ORGANIZATIONAL: 'Organizacioni', EXTERNAL: 'Spoljni' }

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  let hazards: any[] = []
  if (isDemoMode()) {
    hazards = await db.hazard.findMany({ orderBy: { reportedAt: 'desc' } })
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('sms_hazards').select('*').order('reported_at', { ascending: false })
    hazards = (data ?? []).map((h: any) => ({
      hazardId: h.hazard_id, title: h.title, description: h.description, category: h.category,
      source: h.source, location: h.location, reportedBy: h.reported_by, reportedAt: h.reported_at,
      initialProbability: h.initial_probability, initialSeverity: h.initial_severity,
      initialRiskLevel: h.initial_risk_level, status: h.status, assignedTo: h.assigned_to,
      dueDate: h.due_date, mitigation: h.mitigation, residualProbability: h.residual_probability,
      residualSeverity: h.residual_severity, residualRiskLevel: h.residual_risk_level,
      alarpJustification: h.alarp_justification, alarpReviewedBy: h.alarp_reviewed_by,
    }))
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

  addText('GSE CONTROL — SMS HAZARD IDENTIFICATION LOG', margin, y, { size: 16, font: fontBold }); y -= 20
  addText(`ICAO Annex 19 · EASA M.GEN.205`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 12
  addText(`Ukupno hazarda: ${hazards.length}`, margin, y, { size: 10 }); y -= 20

  // Summary
  const byRisk: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
  for (const h of hazards) byRisk[h.initialRiskLevel] = (byRisk[h.initialRiskLevel] || 0) + 1

  addText('SAZETAK PO NIVOU RIZIKA:', margin, y, { size: 12, font: fontBold }); y -= 14
  for (const [r, c] of Object.entries(byRisk)) {
    const color = r === 'CRITICAL' ? rgb(0.86, 0.15, 0.15) : r === 'HIGH' ? rgb(0.85, 0.4, 0.1) : r === 'MEDIUM' ? rgb(0.85, 0.55, 0.1) : rgb(0.1, 0.55, 0.15)
    addText(`• ${RISK_LABELS[r]}: ${c}`, margin + 10, y, { size: 10, color }); y -= 12
  }
  y -= 8

  // Table
  addText('HAZARD IDENTIFICATION LOG:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 75, margin + 175, margin + 280, margin + 340, margin + 400, margin + 470]
  ;['ID', 'Naslov', 'Kategorija', 'Rizik', 'Status', 'Zaduzen', 'Rok'].forEach((h, i) => addText(h, cols[i], y, { size: 8, font: fontBold }))
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const h of hazards) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    const riskColor = h.initialRiskLevel === 'CRITICAL' ? rgb(0.86, 0.15, 0.15) : h.initialRiskLevel === 'HIGH' ? rgb(0.85, 0.4, 0.1) : rgb(0, 0, 0)
    addText((h.hazardId || '').slice(0, 14), cols[0], y, { size: 7, font: fontBold })
    addText((h.title || '').slice(0, 20), cols[1], y, { size: 7 })
    addText((CAT_LABELS[h.category] || h.category).slice(0, 16), cols[2], y, { size: 7 })
    addText(`${RISK_LABELS[h.initialRiskLevel] || h.initialRiskLevel} (${h.initialProbability}x${h.initialSeverity})`, cols[3], y, { size: 7, color: riskColor, font: fontBold })
    addText(h.status, cols[4], y, { size: 7 })
    addText((h.assignedTo || '-').slice(0, 14), cols[5], y, { size: 7 })
    addText(h.dueDate ? new Date(h.dueDate).toLocaleDateString('hr-HR') : '-', cols[6], y, { size: 7 })
    y -= 11

    // Description and mitigation
    addText(`   ${(h.description || '').slice(0, 90)}`, margin, y, { size: 6, color: rgb(0.3, 0.3, 0.3) }); y -= 7
    if (h.mitigation) {
      const resRisk = h.residualRiskLevel ? ` [rezidualni: ${RISK_LABELS[h.residualRiskLevel]}]` : ''
      addText(`   Mitigacija: ${(h.mitigation || '').slice(0, 80)}${resRisk}`, margin, y, { size: 6, color: rgb(0.1, 0.5, 0.1) }); y -= 7
    }
    if (h.alarpJustification) {
      addText(`   ALARP: ${(h.alarpJustification || '').slice(0, 80)}`, margin, y, { size: 6, color: rgb(0.1, 0.3, 0.6) }); y -= 7
    }
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="sms-hazards-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
