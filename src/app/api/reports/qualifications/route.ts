import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'

const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  TOW_TRACTOR: 'Vukac', PUSHBACK: 'Pushback', GPU: 'GPU', BELT_LOADER: 'Belt Loader',
  PASSENGER_STAIRS: 'Stepenice', DOLLY: 'Dolly', LAVATORY_TRUCK: 'Lavatory', WATER_TRUCK: 'Vodeno',
  BUS: 'Bus', CARGO_LOADER: 'Cargo Loader', DEICER: 'Deicer', OTHER: 'Ostalo',
}
const LEVEL_LABELS: Record<string, string> = {
  OPERATOR: 'Operator', SENIOR: 'Senior', INSTRUCTOR: 'Instruktor',
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  let quals: any[] = []

  if (isDemoMode()) {
    quals = await db.equipmentQualification.findMany({ orderBy: { createdAt: 'desc' } })
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('equipment_qualifications').select('*').order('created_at', { ascending: false })
    quals = data ?? []
  }

  const today = new Date()

  const getStatus = (q: any): { key: string; label: string; color: any } => {
    const v = q.validUntil || q.valid_until
    if (!v) return { key: 'NO_EXPIRY', label: 'Bez roka', color: rgb(0.5, 0.5, 0.5) }
    const d = new Date(v)
    if (d < today) return { key: 'EXPIRED', label: 'ISTEKLA', color: rgb(0.86, 0.15, 0.15) }
    const days = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (days <= 30) return { key: 'EXPIRING_SOON', label: `ISTICZE (${days}d)`, color: rgb(0.85, 0.55, 0.1) }
    return { key: 'VALID', label: 'Vazeca', color: rgb(0.1, 0.55, 0.15) }
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

  addText('GSE CONTROL — KVALIFIKACIJE OPERATORA', margin, y, { size: 16, font: fontBold }); y -= 20
  addText(`IATA AHM 1110 · EASA Part-145`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 12
  addText(`Ukupno kvalifikacija: ${quals.length}`, margin, y, { size: 10 }); y -= 20

  // Summary
  const expired = quals.filter(q => getStatus(q).key === 'EXPIRED').length
  const expiringSoon = quals.filter(q => getStatus(q).key === 'EXPIRING_SOON').length
  const valid = quals.filter(q => getStatus(q).key === 'VALID').length

  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Vazece: ${valid}`, margin + 10, y, { size: 10, color: rgb(0.1, 0.55, 0.15) }); y -= 12
  addText(`• Istice uskoro (30 dana): ${expiringSoon}`, margin + 10, y, { size: 10, color: rgb(0.85, 0.55, 0.1) }); y -= 12
  addText(`• Istekle: ${expired}`, margin + 10, y, { size: 10, color: expired > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 20

  // Table
  addText('SPISAK KVALIFIKACIJA:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 90, margin + 220, margin + 310, margin + 410, margin + 480]
  ;['Kartica', 'Ime', 'Tip opreme', 'Nivo', 'Vazi do', 'Status'].forEach((h, i) => addText(h, cols[i], y, { size: 9, font: fontBold }))
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const q of quals) {
    if (y < 80) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
      ;['Kartica', 'Ime', 'Tip opreme', 'Nivo', 'Vazi do', 'Status'].forEach((h, i) => addText(h, cols[i], y, { size: 9, font: fontBold }))
      y -= 14
    }
    const card = (q.employeeCardId || q.employee_card_id || '').slice(0, 12)
    const name = (q.employeeName || q.employee_name || '').slice(0, 22)
    const tp = EQUIPMENT_TYPE_LABELS[q.equipmentType || q.equipment_type] || (q.equipmentType || q.equipment_type || '')
    const lvl = LEVEL_LABELS[q.qualificationLevel || q.qualification_level] || (q.qualificationLevel || q.qualification_level || '')
    const v = q.validUntil || q.valid_until
    const vUntil = v ? new Date(v).toLocaleDateString('hr-HR') : '-'
    const st = getStatus(q)

    addText(card, cols[0], y, { size: 8, font: fontBold })
    addText(name, cols[1], y, { size: 8 })
    addText(tp, cols[2], y, { size: 8 })
    addText(lvl, cols[3], y, { size: 8 })
    addText(vUntil, cols[4], y, { size: 8 })
    addText(st.label, cols[5], y, { size: 8, color: st.color, font: fontBold })
    y -= 11
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="qualifications-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
