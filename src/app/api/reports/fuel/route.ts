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
  const startDate = searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const endDate = searchParams.get('to') || new Date().toISOString().slice(0, 10)

  let logs: any[] = []
  if (isDemoMode()) {
    logs = await db.fuelLog.findMany({ where: { fueledAt: { gte: new Date(startDate), lte: new Date(endDate + 'T23:59:59') } }, orderBy: { fueledAt: 'desc' } })
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('fuel_logs').select('*').gte('fueled_at', startDate).lte('fueled_at', endDate + 'T23:59:59').order('fueled_at', { ascending: false })
    logs = (data ?? []).map((f: any) => ({ equipmentCode: f.equipment_code, equipmentName: f.equipment_name, fuelType: f.fuel_type, amount: f.amount, unit: f.unit, levelBefore: f.level_before, levelAfter: f.level_after, pumpStation: f.pump_station, costPerUnit: f.cost_per_unit, totalCost: f.total_cost, operatorName: f.operator_name, fueledAt: new Date(f.fueled_at) }))
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
  addText('GSE CONTROL — IZVJESTAJ O TOCENJU GORIVA', margin, y, { size: 16, font: fontBold })
  y -= 20
  addText(`Period: ${startDate} do ${endDate}`, margin, y, { size: 10 })
  y -= 15
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 })
  y -= 25

  // Summary
  const totalDiesel = logs.filter(l => l.fuelType === 'DIESEL').reduce((s, l) => s + l.amount, 0)
  const totalElectric = logs.filter(l => l.fuelType === 'ELECTRIC').reduce((s, l) => s + l.amount, 0)
  const totalCost = logs.reduce((s, l) => s + (l.totalCost || 0), 0)

  addText(`Ukupno tocenja: ${logs.length}`, margin, y, { size: 11, font: fontBold }); y -= 14
  addText(`Dizel: ${totalDiesel.toFixed(1)} L`, margin, y, { size: 10 }); y -= 12
  addText(`Elektricna: ${totalElectric.toFixed(1)} kWh`, margin, y, { size: 10 }); y -= 12
  addText(`Ukupni trosak: ${totalCost.toFixed(2)} EUR`, margin, y, { size: 10 }); y -= 20

  // Table
  addText('STAVKE:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 80, margin + 220, margin + 290, margin + 360, margin + 430]
  const headers = ['Kod', 'Tip', 'Kolicina', 'Pumpa', 'Operater', 'Trosak']
  headers.forEach((h, i) => addText(h, cols[i], y, { size: 9, font: fontBold }))
  y -= 5; page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) }); y -= 12

  for (const log of logs) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText(log.equipmentCode || '', cols[0], y, { size: 8 })
    addText(log.fuelType || '', cols[1], y, { size: 8 })
    addText(`${log.amount} ${log.unit || 'L'}`, cols[2], y, { size: 8 })
    addText(log.pumpStation || '-', cols[3], y, { size: 8 })
    addText((log.operatorName || '').slice(0, 15), cols[4], y, { size: 8 })
    addText(log.totalCost ? `${log.totalCost.toFixed(2)} EUR` : '-', cols[5], y, { size: 8 })
    y -= 11
  }

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="fuel-report-${startDate}-to-${endDate}.pdf"` } })
}
