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

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null

  let startDate: Date, endDate: Date
  if (month) { startDate = new Date(year, month - 1, 1); endDate = new Date(year, month, 0, 23, 59, 59) }
  else { startDate = new Date(year, 0, 1); endDate = new Date(year, 11, 31, 23, 59, 59) }

  let incidents: any[] = []
  if (isDemoMode()) {
    incidents = await db.incident.findMany({ where: { occurredAt: { gte: startDate, lte: endDate } }, orderBy: { occurredAt: 'desc' } })
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('incidents').select('*').gte('occurred_at', startDate.toISOString()).lte('occurred_at', endDate.toISOString()).order('occurred_at', { ascending: false })
    incidents = (data ?? []).map((i: any) => ({ incidentNumber: i.incident_number, incidentType: i.incident_type, severity: i.severity, smorRequired: i.smor_required, location: i.location, zone: i.zone, occurredAt: new Date(i.occurred_at), equipmentCode: i.equipment_code, description: i.description, status: i.status, injuriesReported: i.injuries_reported, damageEstimate: i.damage_estimate }))
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

  const title = month ? `MJESECNI IZVJESTAJ — ${month}/${year}` : `GODISNJI IZVJESTAJ — ${year}`
  addText(`GSE CONTROL — ${title}`, margin, y, { size: 16, font: fontBold }); y -= 20
  addText(`ADR.OPS.B.005 — Incident/Accident Reporting (SMS)`, margin, y, { size: 10 }); y -= 15
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 25

  // Summary
  const byType: Record<string, number> = {}
  const bySeverity: Record<string, number> = {}
  incidents.forEach(i => { byType[i.incidentType] = (byType[i.incidentType] || 0) + 1; bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1 })
  const totalDamage = incidents.reduce((s, i) => s + (i.damageEstimate || 0), 0)
  const smorCount = incidents.filter(i => i.smorRequired).length
  const injuryCount = incidents.filter(i => i.injuriesReported).length

  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  const summary = [
    ['Ukupno incidenata', incidents.length.toString()],
    ['SMOR obavezni', smorCount.toString()],
    ['Sa ozljedama', injuryCount.toString()],
    ['Ukupna steta (EUR)', totalDamage.toFixed(2)],
  ]
  summary.forEach(([l, v]) => { addText(`${l}: ${v}`, margin, y, { size: 10 }); y -= 12 })
  y -= 10

  // By type
  addText('PO TIPU:', margin, y, { size: 11, font: fontBold }); y -= 12
  Object.entries(byType).forEach(([t, c]) => { addText(`  ${t}: ${c}`, margin, y, { size: 10 }); y -= 11 })
  y -= 8
  addText('PO TEZINI:', margin, y, { size: 11, font: fontBold }); y -= 12
  Object.entries(bySeverity).forEach(([s, c]) => { addText(`  ${s}: ${c}`, margin, y, { size: 10 }); y -= 11 })
  y -= 15

  // Details table
  addText('DETALJI:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 90, margin + 180, margin + 270, margin + 380, margin + 450]
  ;['Broj', 'Tip', 'Tezina', 'Lokacija', 'Status', 'Steta'].forEach((h, i) => addText(h, cols[i], y, { size: 9, font: fontBold }))
  y -= 5; page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) }); y -= 11

  for (const inc of incidents) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText(inc.incidentNumber, cols[0], y, { size: 8 })
    addText(inc.incidentType, cols[1], y, { size: 8 })
    addText(inc.severity, cols[2], y, { size: 8 })
    addText((inc.location || '').slice(0, 20), cols[3], y, { size: 8 })
    addText(inc.status, cols[4], y, { size: 8 })
    addText(inc.damageEstimate ? `${inc.damageEstimate.toFixed(0)} EUR` : '-', cols[5], y, { size: 8 })
    y -= 10
  }

  addText(`GSE Control · ADR.OPS.B.005 · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="incidents-${month ? month + '-' : ''}${year}.pdf"` } })
}
