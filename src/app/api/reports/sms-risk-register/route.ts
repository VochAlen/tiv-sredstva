import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'

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
      hazardId: h.hazard_id, title: h.title, initialProbability: h.initial_probability,
      initialSeverity: h.initial_severity, initialRiskLevel: h.initial_risk_level,
      residualProbability: h.residual_probability, residualSeverity: h.residual_severity,
      residualRiskLevel: h.residual_risk_level, mitigation: h.mitigation, alarpJustification: h.alarp_justification,
      status: h.status,
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

  addText('GSE CONTROL — RISK REGISTER', margin, y, { size: 16, font: fontBold }); y -= 20
  addText(`5x5 Risk Matrix · ICAO Annex 19 · ALARP Principle`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 20

  // Risk matrix visualization (text-based 5x5 grid)
  addText('RISK MATRIX 5x5 (Severity x Probability):', margin, y, { size: 12, font: fontBold }); y -= 14

  // Build matrix counts
  const matrix: number[][] = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0))
  for (const h of hazards) {
    const p = h.initialProbability - 1
    const s = h.initialSeverity - 1
    if (p >= 0 && p < 5 && s >= 0 && s < 5) matrix[s][p]++
  }

  // Header
  addText('Posljedica \\ Vjerovatnoca', margin, y, { size: 8, font: fontBold }); y -= 10
  addText('     1    2    3    4    5', margin + 100, y, { size: 8, font: fontBold }); y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 10

  for (let s = 4; s >= 0; s--) {
    addText(`${s + 1}`, margin, y, { size: 8, font: fontBold })
    for (let p = 0; p < 5; p++) {
      const score = (p + 1) * (s + 1)
      let color = rgb(0.7, 0.9, 0.7) // green
      if (score >= 15) color = rgb(0.95, 0.6, 0.6) // red
      else if (score >= 10) color = rgb(1, 0.75, 0.55) // orange
      else if (score >= 5) color = rgb(1, 0.9, 0.6) // amber

      const count = matrix[s][p]
      if (count > 0) {
        page.drawRectangle({ x: margin + 100 + p * 35, y: y - 5, width: 30, height: 14, color, opacity: 0.7 })
        addText(`${count}`, margin + 110 + p * 35, y, { size: 9, font: fontBold })
      } else {
        page.drawRectangle({ x: margin + 100 + p * 35, y: y - 5, width: 30, height: 14, color: rgb(0.9, 0.9, 0.9), opacity: 0.3 })
      }
    }
    y -= 16
  }
  y -= 10

  // Legend
  addText('Legenda: ', margin, y, { size: 8, font: fontBold })
  addText('Zeleni (1-4)  Zuti (5-9)  Narandzasti (10-14)  Crveni (15-25)', margin + 50, y, { size: 8 })
  y -= 20

  // Risk register table
  addText('RISK REGISTER:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 70, margin + 130, margin + 200, margin + 270, margin + 340, margin + 410, margin + 480]
  ;['ID', 'Inic.', 'Kat.', 'Inic. Rizik', 'Mitig.', 'Rezid.', 'Rez. Rizik', 'ALARP'].forEach((h, i) => addText(h, cols[i], y, { size: 7, font: fontBold }))
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const h of hazards) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText((h.hazardId || '').slice(0, 14), cols[0], y, { size: 7, font: fontBold })
    addText(`${h.initialProbability}x${h.initialSeverity}`, cols[1], y, { size: 7 })
    addText(h.initialRiskLevel, cols[2], y, { size: 7 })
    addText((h.mitigation ? 'DA' : '-').slice(0, 8), cols[3], y, { size: 7 })
    addText(h.residualProbability ? `${h.residualProbability}x${h.residualSeverity}` : '-', cols[4], y, { size: 7 })
    addText(h.residualRiskLevel || '-', cols[5], y, { size: 7 })
    addText(h.alarpJustification ? 'DA' : '-', cols[6], y, { size: 7 })
    addText(h.status, cols[7], y, { size: 7 })
    y -= 11

    addText(`   ${(h.title || '').slice(0, 90)}`, margin, y, { size: 6, color: rgb(0.3, 0.3, 0.3) })
    if (h.mitigation) {
      addText(`   Mitig: ${(h.mitigation || '').slice(0, 85)}`, margin, y - 6, { size: 6, color: rgb(0.1, 0.5, 0.1) })
      y -= 6
    }
    if (h.alarpJustification) {
      addText(`   ALARP: ${(h.alarpJustification || '').slice(0, 85)}`, margin, y - 6, { size: 6, color: rgb(0.1, 0.3, 0.6) })
      y -= 6
    }
    y -= 11
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="sms-risk-register-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
