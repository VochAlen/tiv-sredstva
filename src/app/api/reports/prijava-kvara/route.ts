// src/app/api/reports/prijava-kvara/route.ts
//
// Digitalna zamjena za papirni obrazac "PRIJAVA KVARA na tehnickom
// sredstvu, opremi i objektu". Generise se za KONKRETNU prijavu kvara
// (DamageReport) - kombinuje ono sto aplikacija zna digitalno (opis kvara,
// ko je prijavio/popravio/odobrio, stanje sata/km) sa praznim linijama za
// ono sto se i dalje rucno popunjava na terenu (npr. tacno stanje goriva u
// litrima u trenutku primopredaje).

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
  const damageId = searchParams.get('id')
  if (!damageId) return new NextResponse('Nedostaje id prijave kvara', { status: 400 })

  let dr: any = null
  let equipment: any = null

  if (isDemoMode()) {
    dr = await db.damageReport.findUnique({ where: { id: damageId } })
    if (!dr) return new NextResponse('Prijava nije pronadjena', { status: 404 })
    equipment = await db.equipment.findUnique({ where: { id: dr.equipmentId } })
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('damage_reports').select('*').eq('id', damageId).maybeSingle()
    if (!data) return new NextResponse('Prijava nije pronadjena', { status: 404 })
    dr = {
      id: data.id, equipmentId: data.equipment_id, equipmentCode: data.equipment_code, equipmentName: data.equipment_name,
      reportedByName: data.reported_by_name, severity: data.severity, description: data.description, status: data.status,
      resolution: data.resolution, category: data.category,
      repairedByName: data.repaired_by_name, repairedAt: data.repaired_at,
      approvedByName: data.approved_by_name, approvedAt: data.approved_at,
      createdAt: data.created_at,
    }
    const { data: eq } = await supabase.from('equipment').select('*').eq('id', data.equipment_id).maybeSingle()
    equipment = eq
      ? { serialNumber: eq.serial_number, totalKm: eq.total_km, totalOperatingHours: eq.total_operating_hours }
      : null
  }

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 50
  const page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const addText = (text: string, x: number, yVal: number, opts: any = {}) => {
    const { size = 10, font: f = font, color = rgb(0, 0, 0) } = opts
    try {
      page.drawText(transliterate(text), { x, y: yVal, size, font: f, color })
    } catch {}
  }
  const drawBox = (x: number, yTop: number, w: number, h: number) => {
    page.drawRectangle({ x, y: yTop - h, width: w, height: h, borderColor: rgb(0, 0, 0), borderWidth: 0.7 })
  }

  // ---- Zaglavlje ----
  page.drawRectangle({ x: 0, y: pageHeight - 6, width: pageWidth, height: 6, color: rgb(0.05, 0.25, 0.45) })
  addText('AERODROMI CRNE GORE - AERODROM TIVAT', margin, y, { size: 13, font: fontBold })
  addText(`Datum: ${new Date(dr.createdAt).toLocaleDateString('hr-HR')}`, pageWidth - margin - 130, y, { size: 10, font: fontBold })
  y -= 30

  addText(`PRIJAVA KVARA br. ${dr.id.slice(0, 8).toUpperCase()}`, margin, y, { size: 14, font: fontBold })
  y -= 16
  addText('na tehnickom sredstvu, opremi i objektu', margin, y, { size: 10, font: italic })
  y -= 26

  const km = equipment?.totalKm != null ? `${equipment.totalKm}` : '________'
  const rh = equipment?.totalOperatingHours != null ? `${equipment.totalOperatingHours}` : '________'
  const invBr = equipment?.serialNumber ?? '________'
  addText(`Naziv: ${dr.equipmentName}   (${dr.equipmentCode})`, margin, y, { size: 10 })
  y -= 14
  addText(`Inv. br.: ${invBr}      Km: ${km}      Rh (sati rada): ${rh}`, margin, y, { size: 10 })
  y -= 20

  // ---- Opis kvara ----
  addText('OPIS KVARA:', margin, y, { size: 9, font: fontBold })
  const opisH = 70
  drawBox(margin, y + 12, pageWidth - 2 * margin, opisH)
  const descLines = wrapText(dr.description ?? '', 90)
  let dy = y - 4
  for (const line of descLines.slice(0, 6)) {
    addText(line, margin + 8, dy, { size: 9 })
    dy -= 12
  }
  y -= opisH + 10

  addText(`Kategorija kvara: ${dr.category ?? 'nije odredjena'}      Tezina: ${dr.severity}`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) })
  y -= 24

  addText(`Predao: ${dr.reportedByName}`, margin, y, { size: 9, font: fontBold })
  addText('(sluzba P/O)', margin, y - 11, { size: 7, font: italic, color: rgb(0.4, 0.4, 0.4) })
  addText(`Primio: ${dr.repairedByName ?? '_______________________'}`, pageWidth / 2 + 10, y, { size: 9, font: fontBold })
  addText('(Tehnicka sluzba)', pageWidth / 2 + 10, y - 11, { size: 7, font: italic, color: rgb(0.4, 0.4, 0.4) })
  y -= 34

  // ---- Drugi dio - stanje prilikom prijema iz TS ----
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.6, color: rgb(0, 0, 0) })
  y -= 16
  addText('STANJE PRILIKOM PRIJEMA IZ TEHNICKE SLUZBE', margin, y, { size: 10, font: fontBold })
  y -= 18

  addText('Opis izvedenih radova:', margin, y, { size: 9, font: fontBold })
  const radoviH = 50
  drawBox(margin, y + 12, pageWidth - 2 * margin, radoviH)
  const resLines = wrapText(dr.resolution ?? '', 90)
  let ry = y - 4
  for (const line of resLines.slice(0, 4)) {
    addText(line, margin + 8, ry, { size: 9 })
    ry -= 12
  }
  y -= radoviH + 10

  addText('Uocena vizuelna ostecenja:', margin, y, { size: 9, font: fontBold })
  drawBox(margin, y + 12, pageWidth - 2 * margin, 24)
  y -= 34

  // Stanje goriva/maziva/rashladne tecnosti - tabela kao na papirnom obrascu
  addText('Stanje goriva, maziva i rashladne tecnosti:', margin, y, { size: 9, font: fontBold })
  y -= 14
  const fuelCols = [margin, margin + 90, margin + 170, margin + 260, margin + 350, margin + 430]
  const fuelHeaders = ['Gorivo (lit.)', 'Ulje - Motor', 'Mjenjac i dif.', 'Hidraulika', 'Kocnice', 'Rashl. tecnost (lit.)']
  fuelHeaders.forEach((h, i) => addText(h, fuelCols[i], y, { size: 7, font: fontBold }))
  y -= 4
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.4, color: rgb(0.6, 0.6, 0.6) })
  y -= 20
  fuelCols.forEach((x) => addText('______', x, y, { size: 8, color: rgb(0.5, 0.5, 0.5) }))
  y -= 28

  addText(`Predao: ${dr.repairedByName ?? '_______________________'}`, margin, y, { size: 9, font: fontBold })
  addText('(Tehnicka sluzba)', margin, y - 11, { size: 7, font: italic, color: rgb(0.4, 0.4, 0.4) })
  addText(`Primio: ${dr.status === 'RESOLVED' ? dr.reportedByName ?? '' : '_______________________'}`, pageWidth / 2 + 10, y, { size: 9, font: fontBold })
  addText('(sluzba P/O)', pageWidth / 2 + 10, y - 11, { size: 7, font: italic, color: rgb(0.4, 0.4, 0.4) })
  y -= 30

  if (dr.approvedByName) {
    addText(`Odobrio (sef sluzbe): ${dr.approvedByName}${dr.approvedAt ? `, ${new Date(dr.approvedAt).toLocaleString('hr-HR')}` : ''}`, margin, y, {
      size: 8,
      color: rgb(0.1, 0.55, 0.15),
    })
    y -= 14
  }

  addText(`Status prijave: ${statusLabel(dr.status)}`, margin, y, { size: 9, font: fontBold })
  y -= 20
  addText(`Izvjestaj generisao iz aplikacije: ${user.full_name}, ${new Date().toLocaleString('hr-HR')}`, margin, y, {
    size: 7,
    color: rgb(0.5, 0.5, 0.5),
  })

  page.drawText('GSE Control - Aerodrom Tivat (LYTV)', { x: margin, y: 20, size: 7, font, color: rgb(0.55, 0.55, 0.55) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="prijava-kvara-${dr.equipmentCode}-${damageId.slice(0, 8)}.pdf"`,
    },
  })
}

function statusLabel(status: string): string {
  return { OPEN: 'Otvoreno', IN_REPAIR: 'U popravci', AWAITING_APPROVAL: 'Ceka odobrenje sefa', RESOLVED: 'Rijeseno i odobreno' }[status] ?? status
}

function wrapText(text: string, maxChars: number): string[] {
  if (!text) return []
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    if ((current + ' ' + w).trim().length > maxChars) {
      if (current) lines.push(current.trim())
      current = w
    } else {
      current = (current + ' ' + w).trim()
    }
  }
  if (current) lines.push(current)
  return lines
}
