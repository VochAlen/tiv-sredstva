import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'

const STATUS_LABELS: Record<string, string> = { ON_TRACK: 'Na putu', AT_RISK: 'U riziku', OFF_TRACK: 'Van puta', ACHIEVED: 'Postignuto', MISSED: 'Propusteno' }

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  let spis: any[] = []
  let spts: any[] = []
  if (isDemoMode()) {
    [spis, spts] = await Promise.all([
      db.sPI.findMany({ orderBy: { createdAt: 'desc' } }),
      db.sPT.findMany({ orderBy: { targetDate: 'asc' } }),
    ])
  } else {
    const supabase = await createSupabaseClient()
    const [s, st] = await Promise.all([
      supabase.from('sms_spis').select('*').order('created_at', { ascending: false }),
      supabase.from('sms_spts').select('*').order('target_date', { ascending: true }),
    ])
    spis = (s.data ?? []).map((x: any) => ({
      spiId: x.spi_id, name: x.name, description: x.description, category: x.category,
      unit: x.unit, frequency: x.frequency, targetValue: x.target_value, alertLevel: x.alert_level,
      tolerableLimit: x.tolerable_limit, currentValue: x.current_value, currentPeriod: x.current_period,
      trend: x.trend, status: x.status,
    }))
    spts = (st.data ?? []).map((x: any) => ({
      sptId: x.spt_id, name: x.name, description: x.description, category: x.category,
      baselineValue: x.baseline_value, targetValue: x.target_value, currentValue: x.current_value,
      unit: x.unit, startDate: x.start_date, targetDate: x.target_date, status: x.status,
      progressPercent: x.progress_percent, notes: x.notes,
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

  addText('GSE CONTROL — SPI / SPT IZVJESTAJ', margin, y, { size: 16, font: fontBold }); y -= 20
  addText(`Safety Performance Indicators & Targets · ICAO Annex 19`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 20

  // SPI Summary
  const greenSPI = spis.filter(s => s.status === 'GREEN').length
  const amberSPI = spis.filter(s => s.status === 'AMBER').length
  const redSPI = spis.filter(s => s.status === 'RED').length

  addText('SAZETAK SPI:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Zeleni (unutar cilja): ${greenSPI}`, margin + 10, y, { size: 10, color: rgb(0.1, 0.55, 0.15) }); y -= 12
  addText(`• Zuti (alert nivo): ${amberSPI}`, margin + 10, y, { size: 10, color: rgb(0.85, 0.55, 0.1) }); y -= 12
  addText(`• Crveni (preko limita): ${redSPI}`, margin + 10, y, { size: 10, color: redSPI > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 20

  // SPI Table
  addText('SAFETY PERFORMANCE INDIKATORI (SPI):', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 70, margin + 220, margin + 290, margin + 340, margin + 390, margin + 440, margin + 490]
  ;['ID', 'Naziv', 'Trenutno', 'Cilj', 'Alert', 'Limit', 'Trend', 'Status'].forEach((h, i) => addText(h, cols[i], y, { size: 7, font: fontBold }))
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const s of spis) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    const color = s.status === 'RED' ? rgb(0.86, 0.15, 0.15) : s.status === 'AMBER' ? rgb(0.85, 0.55, 0.1) : rgb(0.1, 0.55, 0.15)
    addText(s.spiId, cols[0], y, { size: 7, font: fontBold })
    addText((s.name || '').slice(0, 28), cols[1], y, { size: 7 })
    addText(s.currentValue != null ? `${s.currentValue} ${s.unit}` : '-', cols[2], y, { size: 7 })
    addText(`${s.targetValue}`, cols[3], y, { size: 7 })
    addText(`${s.alertLevel}`, cols[4], y, { size: 7 })
    addText(`${s.tolerableLimit}`, cols[5], y, { size: 7 })
    addText(s.trend || '-', cols[6], y, { size: 7 })
    addText(s.status, cols[7], y, { size: 7, color, font: fontBold })
    y -= 11
  }

  // SPT
  y -= 10
  if (y < 150) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('SAFETY PERFORMANCE TARGETS (SPT):', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols2 = [margin, margin + 60, margin + 220, margin + 280, margin + 330, margin + 380, margin + 430, margin + 490]
  ;['ID', 'Naziv', 'Baseline', 'Cilj', 'Trenutno', 'Napredak %', 'Rok', 'Status'].forEach((h, i) => addText(h, cols2[i], y, { size: 7, font: fontBold }))
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const s of spts) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    const color = s.status === 'OFF_TRACK' || s.status === 'MISSED' ? rgb(0.86, 0.15, 0.15) : s.status === 'AT_RISK' ? rgb(0.85, 0.55, 0.1) : rgb(0.1, 0.55, 0.15)
    addText(s.sptId, cols2[0], y, { size: 7, font: fontBold })
    addText((s.name || '').slice(0, 28), cols2[1], y, { size: 7 })
    addText(`${s.baselineValue} ${s.unit}`, cols2[2], y, { size: 7 })
    addText(`${s.targetValue}`, cols2[3], y, { size: 7 })
    addText(s.currentValue != null ? `${s.currentValue}` : '-', cols2[4], y, { size: 7 })
    addText(`${s.progressPercent.toFixed(0)}%`, cols2[5], y, { size: 7 })
    addText(new Date(s.targetDate).toLocaleDateString('hr-HR'), cols2[6], y, { size: 7 })
    addText(STATUS_LABELS[s.status] || s.status, cols2[7], y, { size: 7, color, font: fontBold })
    y -= 11
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="sms-spi-spt-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
