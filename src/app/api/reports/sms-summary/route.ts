import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'

const CAT_LABELS: Record<string, string> = { OPERATIONAL: 'Operativni', TECHNICAL: 'Tehnicki', ENVIRONMENTAL: 'Ekoloski', HUMAN: 'Ljudski', ORGANIZATIONAL: 'Organizacioni', EXTERNAL: 'Spoljni' }

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  let hazards: any[] = [], spis: any[] = [], spts: any[] = [], actions: any[] = []
  if (isDemoMode()) {
    [hazards, spis, spts, actions] = await Promise.all([
      db.hazard.findMany(), db.sPI.findMany(), db.sPT.findMany(), db.safetyAction.findMany(),
    ])
  } else {
    const supabase = await createSupabaseClient()
    const [h, s, st, a] = await Promise.all([
      supabase.from('sms_hazards').select('*'),
      supabase.from('sms_spis').select('*'),
      supabase.from('sms_spts').select('*'),
      supabase.from('sms_safety_actions').select('*'),
    ])
    hazards = (h.data ?? []).map((x: any) => ({ category: x.category, initialRiskLevel: x.initial_risk_level, status: x.status, source: x.source }))
    spis = (s.data ?? []).map((x: any) => ({ status: x.status }))
    spts = (st.data ?? []).map((x: any) => ({ status: x.status }))
    actions = (a.data ?? []).map((x: any) => ({ status: x.status, priority: x.priority, dueDate: x.due_date, actualCost: x.actual_cost, estimatedCost: x.estimated_cost }))
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

  addText('GSE CONTROL — SMS SAZETAK', margin, y, { size: 18, font: fontBold }); y -= 20
  addText(`Safety Management System · ICAO Annex 19 · EASA M.GEN.205`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 20

  // Hazards summary
  addText('1. HAZARD IDENTIFICATION:', margin, y, { size: 14, font: fontBold }); y -= 16
  const openH = hazards.filter(h => h.status === 'OPEN' || h.status === 'ASSESSED').length
  const mitigatedH = hazards.filter(h => h.status === 'MITIGATED' || h.status === 'CLOSED').length
  const criticalH = hazards.filter(h => h.initialRiskLevel === 'CRITICAL').length
  const highH = hazards.filter(h => h.initialRiskLevel === 'HIGH').length
  addText(`• Ukupno hazarda: ${hazards.length}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Otvoreni: ${openH}`, margin + 10, y, { size: 10, color: openH > 0 ? rgb(0.85, 0.55, 0.1) : rgb(0, 0, 0) }); y -= 12
  addText(`• Mitigirani/Zatvoreni: ${mitigatedH}`, margin + 10, y, { size: 10, color: rgb(0.1, 0.55, 0.15) }); y -= 12
  addText(`• Kriticni: ${criticalH}`, margin + 10, y, { size: 10, color: criticalH > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 12
  addText(`• Visoki: ${highH}`, margin + 10, y, { size: 10, color: highH > 0 ? rgb(0.85, 0.4, 0.1) : rgb(0, 0, 0) }); y -= 20

  // Risk distribution
  addText('   Distribucija po nivou rizika:', margin, y, { size: 10, font: fontBold }); y -= 12
  const byRisk: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
  for (const h of hazards) byRisk[h.initialRiskLevel] = (byRisk[h.initialRiskLevel] || 0) + 1
  for (const [r, c] of Object.entries(byRisk)) {
    const color = r === 'CRITICAL' ? rgb(0.86, 0.15, 0.15) : r === 'HIGH' ? rgb(0.85, 0.4, 0.1) : r === 'MEDIUM' ? rgb(0.85, 0.55, 0.1) : rgb(0.1, 0.55, 0.15)
    addText(`   - ${r}: ${c}`, margin + 20, y, { size: 10, color }); y -= 11
  }
  y -= 8

  // By category
  addText('   Hazardi po kategoriji:', margin, y, { size: 10, font: fontBold }); y -= 12
  const byCat: Record<string, number> = {}
  for (const h of hazards) byCat[h.category] = (byCat[h.category] || 0) + 1
  for (const [c, n] of Object.entries(byCat)) {
    addText(`   - ${CAT_LABELS[c] || c}: ${n}`, margin + 20, y, { size: 10 }); y -= 11
  }
  y -= 12

  // SPI
  if (y < 200) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('2. SAFETY PERFORMANCE INDIKATORI (SPI):', margin, y, { size: 14, font: fontBold }); y -= 16
  const green = spis.filter(s => s.status === 'GREEN').length
  const amber = spis.filter(s => s.status === 'AMBER').length
  const red = spis.filter(s => s.status === 'RED').length
  addText(`• Ukupno: ${spis.length}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Zeleni (unutar cilja): ${green}`, margin + 10, y, { size: 10, color: rgb(0.1, 0.55, 0.15) }); y -= 12
  addText(`• Zuti (alert): ${amber}`, margin + 10, y, { size: 10, color: amber > 0 ? rgb(0.85, 0.55, 0.1) : rgb(0, 0, 0) }); y -= 12
  addText(`• Crveni (preko limita): ${red}`, margin + 10, y, { size: 10, color: red > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 20

  // SPT
  addText('3. SAFETY PERFORMANCE TARGETS (SPT):', margin, y, { size: 14, font: fontBold }); y -= 16
  const achieved = spts.filter(s => s.status === 'ACHIEVED').length
  const onTrack = spts.filter(s => s.status === 'ON_TRACK').length
  const atRisk = spts.filter(s => s.status === 'AT_RISK').length
  const offTrack = spts.filter(s => s.status === 'OFF_TRACK').length
  addText(`• Ukupno: ${spts.length}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Postignuto: ${achieved}`, margin + 10, y, { size: 10, color: rgb(0.1, 0.55, 0.15) }); y -= 12
  addText(`• Na putu: ${onTrack}`, margin + 10, y, { size: 10, color: rgb(0.1, 0.55, 0.15) }); y -= 12
  addText(`• U riziku: ${atRisk}`, margin + 10, y, { size: 10, color: atRisk > 0 ? rgb(0.85, 0.55, 0.1) : rgb(0, 0, 0) }); y -= 12
  addText(`• Van puta: ${offTrack}`, margin + 10, y, { size: 10, color: offTrack > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 20

  // Actions
  addText('4. SAFETY ACTION PLAN:', margin, y, { size: 14, font: fontBold }); y -= 16
  const openA = actions.filter(a => a.status === 'OPEN' || a.status === 'IN_PROGRESS').length
  const completedA = actions.filter(a => a.status === 'COMPLETED').length
  const overdueA = actions.filter(a => a.dueDate && new Date(a.dueDate) < today && a.status !== 'COMPLETED').length
  const criticalA = actions.filter(a => a.priority === 'CRITICAL' && a.status !== 'COMPLETED').length
  const totalCost = actions.reduce((s, a) => s + (a.actualCost || a.estimatedCost || 0), 0)
  addText(`• Ukupno: ${actions.length}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Otvorene: ${openA}`, margin + 10, y, { size: 10, color: openA > 0 ? rgb(0.85, 0.55, 0.1) : rgb(0, 0, 0) }); y -= 12
  addText(`• Zavrsene: ${completedA}`, margin + 10, y, { size: 10, color: rgb(0.1, 0.55, 0.15) }); y -= 12
  addText(`• Prekoracene: ${overdueA}`, margin + 10, y, { size: 10, color: overdueA > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 12
  addText(`• Kriticne (otvorene): ${criticalA}`, margin + 10, y, { size: 10, color: criticalA > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 12
  addText(`• Ukupni trosak: ${totalCost.toFixed(2)} EUR`, margin + 10, y, { size: 10 }); y -= 20

  // Conclusion
  if (y < 150) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('ZAKLJUCAK:', margin, y, { size: 14, font: fontBold }); y -= 16
  const overallHealth = red > 0 || criticalH > 0 || overdueA > 0
    ? 'Sigurnosno stanje zahtijeva hitnu paznju — identifikovani su kriticni rizici.'
    : amber > 0 || atRisk > 0
    ? 'Sigurnosno stanje je prihvatljivo ali zahtijeva pracenje — neki indikatori u alert zoni.'
    : 'Sigurnosno stanje je dobro — svi indikatori unutar cilja.'
  addText(overallHealth, margin + 10, y, { size: 10 }); y -= 14
  addText(`Preporuka: ${criticalH > 0 ? 'Hitno mitigirati kriticne hazarde. ' : ''}${red > 0 ? 'Analizirati SPI u crvenom. ' : ''}${overdueA > 0 ? 'Zatvoriti prekoracene akcije. ' : ''}Nastaviti sa redovnim pracenjem.`, margin + 10, y, { size: 9, color: rgb(0.3, 0.3, 0.3) })

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="sms-summary-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
