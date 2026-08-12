import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'

const FLUID_LABELS: Record<string, string> = {
  TYPE_I: 'Type I', TYPE_II: 'Type II', TYPE_III: 'Type III', TYPE_IV: 'Type IV',
}
const OP_LABELS: Record<string, string> = {
  DEICING: 'De-icing', ANTI_ICING: 'Anti-icing', BOTH: 'De+Anti-icing',
}
const PRECIP_LABELS: Record<string, string> = {
  SNOW: 'Snijeg', LIGHT_FREEZING_RAIN: 'Lag. ledeni pljusak', FREEZING_DRIZZLE: 'Ledeno rominjanje',
  RAIN_COLD_SOAK: 'Kisa na hladnom krilu', FREEZING_FOG: 'Ledena magla', COLD_SOAK: 'Hladno krilo', NONE: '-',
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  let records: any[] = []

  if (isDemoMode()) {
    records = await db.deicingRecord.findMany({ orderBy: { applicationStart: 'desc' } })
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('deicing_records').select('*').order('application_start', { ascending: false })
    records = (data ?? []).map((r: any) => ({
      flightNumber: r.flight_number, aircraftReg: r.aircraft_reg, aircraftType: r.aircraft_type,
      standPosition: r.stand_position, operationType: r.operation_type, fluidType: r.fluid_type,
      concentration: r.concentration, fluidBatchNumber: r.fluid_batch_number,
      fluidUsedLiters: r.fluid_used_liters, applicationStart: r.application_start,
      applicationEnd: r.application_end, durationMinutes: r.duration_minutes, oat: r.oat,
      precipitation: r.precipitation, precipitationIntensity: r.precipitation_intensity,
      holdoverTimeMinutes: r.holdover_time_minutes, hotTableRef: r.hot_table_ref,
      equipmentCode: r.equipment_code, operatorName: r.operator_name, operatorCardId: r.operator_card_id,
      shift: r.shift, inspectionResult: r.inspection_result, notes: r.notes,
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

  addText('GSE CONTROL — DE-ICING / ANTI-ICING OPERACIJE', margin, y, { size: 16, font: fontBold }); y -= 20
  addText(`ICAO Annex 3 · AEA Recommendations · ISO 11076`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 12
  addText(`Ukupno operacija: ${records.length}`, margin, y, { size: 10 }); y -= 20

  // Summary
  const totalFluidUsed = records.reduce((s, r) => s + (r.fluidUsedLiters || 0), 0)
  const byType: Record<string, number> = {}
  for (const r of records) {
    byType[r.fluidType] = (byType[r.fluidType] || 0) + (r.fluidUsedLiters || 0)
  }

  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Ukupno potroseno tečnosti: ${totalFluidUsed.toFixed(1)} L`, margin + 10, y, { size: 10 }); y -= 12
  for (const [t, q] of Object.entries(byType)) {
    addText(`• ${FLUID_LABELS[t] || t}: ${q.toFixed(1)} L`, margin + 10, y, { size: 10 }); y -= 12
  }
  y -= 8

  // Table
  addText('OPERACIJE:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 75, margin + 145, margin + 200, margin + 240, margin + 290, margin + 340, margin + 410, margin + 480]
  ;['Datum', 'Let', 'Avion', 'Stand', 'Tip', 'Tečnost', 'L', 'OAT', 'HOT'].forEach((h, i) => addText(h, cols[i], y, { size: 8, font: fontBold }))
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const r of records) {
    if (y < 80) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
      ;['Datum', 'Let', 'Avion', 'Stand', 'Tip', 'Tečnost', 'L', 'OAT', 'HOT'].forEach((h, i) => addText(h, cols[i], y, { size: 8, font: fontBold }))
      y -= 14
    }
    const dt = new Date(r.applicationStart).toLocaleString('hr-HR').slice(0, 12)
    addText(dt, cols[0], y, { size: 7 })
    addText((r.flightNumber || '-').slice(0, 8), cols[1], y, { size: 7, font: fontBold })
    addText((r.aircraftReg || '-').slice(0, 10), cols[2], y, { size: 7 })
    addText((r.standPosition || '-').slice(0, 6), cols[3], y, { size: 7 })
    addText((OP_LABELS[r.operationType] || r.operationType || '').slice(0, 10), cols[4], y, { size: 7 })
    addText((FLUID_LABELS[r.fluidType] || r.fluidType).slice(0, 10), cols[5], y, { size: 7 })
    addText(`${r.fluidUsedLiters} L`, cols[6], y, { size: 7 })
    addText(`${r.oat}°C`, cols[7], y, { size: 7 })
    addText(r.holdoverTimeMinutes != null ? `${r.holdoverTimeMinutes}m` : '-', cols[8], y, { size: 7, color: r.holdoverTimeMinutes != null ? rgb(0.7, 0.4, 0) : rgb(0, 0, 0) })
    y -= 10

    // Drugi red: padavine, vozilo, operater
    const precipText = r.precipitation && r.precipitation !== 'NONE'
      ? `${PRECIP_LABELS[r.precipitation] || r.precipitation}${r.precipitationIntensity ? ` (${r.precipitationIntensity.toLowerCase()})` : ''}`
      : '-'
    addText(`   ${precipText} | ${r.equipmentCode || '-'} | ${r.operatorName || '-'}`, margin, y, { size: 6, color: rgb(0.4, 0.4, 0.4) })
    y -= 8
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="deicing-records-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
