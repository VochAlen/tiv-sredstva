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
    if (!dr) return new NextResponse('Kvar nije pronadjen', { status: 404 })
    equipment = await db.equipment.findUnique({ where: { id: dr.equipmentId } })
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('damage_reports').select('*').eq('id', damageId).maybeSingle()
    if (!data) return new NextResponse('Kvar nije pronadjen', { status: 404 })
    dr = {
      id: data.id, equipmentId: data.equipment_id, equipmentCode: data.equipment_code, equipmentName: data.equipment_name,
      reportedByName: data.reported_by_name, severity: data.severity, description: data.description, status: data.status,
      resolution: data.resolution, category: data.category,
      repairedByName: data.repaired_by_name, repairedAt: data.repaired_at,
      approvedByName: data.approved_by_name, approvedAt: data.approved_at,
      createdAt: data.created_at,
      reportedByCardId: data.reported_by_card_id,
      acknowledgedAt: data.acknowledged_at, acknowledgedBy: data.acknowledged_by,
      workshopArrivedAt: data.workshop_arrived_at, workshopArrivedBy: data.workshop_arrived_by,
      chiefName: data.chief_name, chiefInspectedAt: data.chief_inspected_at, chiefResult: data.chief_result,
      handoverTo: data.handover_to, handoverAt: data.handover_at,
      workerNames: data.worker_names, partsJson: data.parts_json, workHours: data.work_hours, workCost: data.work_cost,
    }
    const { data: eq } = await supabase.from('equipment').select('*').eq('id', data.equipment_id).maybeSingle()
    equipment = eq
      ? { serialNumber: eq.serial_number, totalKm: eq.total_km, totalOperatingHours: eq.total_operating_hours }
      : null
  }

  let log: Array<{ at: string; text: string; by: string }> = []
  try {
    if (isDemoMode()) {
      const rows = await db.repairStatusLog.findMany({ where: { damageId }, orderBy: { at: 'asc' }, take: 40 })
      log = rows.map((r) => ({ at: r.at.toISOString(), text: r.text ?? r.kind, by: r.byName }))
    } else {
      const supabase = await createSupabaseClient()
      const { data: rows } = await supabase.from('repair_status_log').select('at, text, kind, by_name').eq('damage_id', damageId).order('at', { ascending: true }).limit(40)
      log = (rows ?? []).map((r: any) => ({ at: r.at, text: r.text ?? r.kind, by: r.by_name }))
    }
  } catch { /* migracija 035 još nije pokrenuta - evidencija bez istorije */ }

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

  addText(`Status kvara: ${statusLabel(dr.status)}`, margin, y, { size: 9, font: fontBold })
  y -= 20
  addText(`Izvjestaj generisao iz aplikacije: ${user.full_name}, ${new Date().toLocaleString('hr-HR')}`, margin, y, {
    size: 7,
    color: rgb(0.5, 0.5, 0.5),
  })

  page.drawText('GSE Control - Aerodrom Tivat (LYTV)', { x: margin, y: 20, size: 7, font, color: rgb(0.55, 0.55, 0.55) })

  // ---- Strana 2: evidencija radionice (AMC1 ADR.OPS.C.007(b)(3): tip, šta je pregledano/popravljeno, ulaz/izlaz, ko je radio) ----
  const p2 = pdfDoc.addPage([pageWidth, pageHeight])
  let y2 = pageHeight - margin
  const t2 = (text: string, x: number, yy: number, o: { size?: number; font?: typeof font; color?: ReturnType<typeof rgb> } = {}) => {
    try { p2.drawText(transliterate(text), { x, y: yy, size: o.size ?? 9, font: o.font ?? font, color: o.color ?? rgb(0, 0, 0) }) } catch {}
  }
  const dt = (v: unknown) => (v ? new Date(v as string).toLocaleString('hr-HR', { timeZone: 'Europe/Podgorica' }) : '-')
  p2.drawRectangle({ x: 0, y: pageHeight - 6, width: pageWidth, height: 6, color: rgb(0.05, 0.25, 0.45) })
  t2('EVIDENCIJA RADIONICE', margin, y2, { size: 14, font: fontBold })
  y2 -= 14
  t2('Zapis o održavanju vozila - ADR.OPS.C.007(b)(3), Reg. (EU) 139/2014', margin, y2, { size: 9, font: italic })
  y2 -= 22
  t2(`${dr.equipmentName}   (${dr.equipmentCode})      Kvar br. ${dr.id.slice(0, 8).toUpperCase()}`, margin, y2, { size: 10, font: fontBold })
  y2 -= 14
  t2('Vrsta održavanja: KOREKTIVNO (kvar prijavljen tokom upotrebe)', margin, y2, { size: 9 })
  y2 -= 22

  const colX = [margin, margin + 215, margin + 380]
  p2.drawRectangle({ x: margin, y: y2 - 4, width: pageWidth - 2 * margin, height: 15, color: rgb(0.06, 0.16, 0.3) })
  ;['DOGAĐAJ', 'DATUM I VRIJEME', 'OSOBA'].forEach((h, i) => t2(h, colX[i] + 4, y2, { size: 8, font: fontBold, color: rgb(1, 1, 1) }))
  y2 -= 18
  const events: Array<[string, unknown, string | null | undefined]> = [
    ['1. Kvar prijavljen', dr.createdAt, dr.reportedByName],
    ['2. Kvar preuzet u radionicu', dr.acknowledgedAt, dr.acknowledgedBy],
    ['3. Sredstvo doveženo u radionicu (ULAZ)', dr.workshopArrivedAt, dr.workshopArrivedBy ? `dovezao/la: ${dr.workshopArrivedBy}` : null],
    ['4. Popravka završena', dr.repairedAt, dr.repairedByName],
    [`5. Pregled šefa službe${dr.chiefResult ? (dr.chiefResult === 'OK' ? ' - PROŠAO' : ' - NIJE PROŠAO') : ''}`, dr.chiefInspectedAt, dr.chiefName],
    ['6. Sredstvo preuzeto iz radionice (IZLAZ)', dr.handoverAt, dr.handoverTo ? `preuzeo/la: ${dr.handoverTo}` : null],
  ]
  events.forEach(([label, when, who], i) => {
    if (i % 2 === 0) p2.drawRectangle({ x: margin, y: y2 - 5, width: pageWidth - 2 * margin, height: 16, color: rgb(0.955, 0.965, 0.975) })
    t2(label, colX[0] + 4, y2, { size: 8.5 })
    t2(dt(when), colX[1] + 4, y2, { size: 8.5, font: fontBold })
    t2(who ?? '-', colX[2] + 4, y2, { size: 8.5 })
    y2 -= 16
  })
  y2 -= 10

  const parts = (() => { try { const v = typeof dr.partsJson === 'string' ? JSON.parse(dr.partsJson) : dr.partsJson; return Array.isArray(v) ? v.map((x: any) => `${x.name} x${x.qty}`).join(', ') : '' } catch { return '' } })()
  const kv = (k: string, v: string) => {
    const lines = wrapText(v || '-', 85)
    t2(k, margin, y2, { size: 8.5, font: fontBold })
    lines.slice(0, 4).forEach((ln, i) => t2(ln, margin + 130, y2 - i * 11, { size: 8.5 }))
    y2 -= Math.max(1, Math.min(lines.length, 4)) * 11 + 4
  }
  kv('Pregledano / popravljeno:', dr.resolution ?? '')
  kv('Zamijenjeni dijelovi:', parts)
  kv('Radili:', dr.workerNames ?? dr.repairedByName ?? '')
  kv('Utrošeno sati / trošak:', `${dr.workHours ?? '-'} h  /  ${dr.workCost != null ? `${dr.workCost} EUR` : '-'}`)
  y2 -= 8

  t2('ISTORIJA STATUSA I KORAKA', margin, y2, { size: 9, font: fontBold })
  y2 -= 14
  if (log.length === 0) t2('Nema upisa.', margin, y2, { size: 8.5, color: rgb(0.45, 0.48, 0.53) })
  for (const l of log) {
    if (y2 < 70) break
    const line = `${dt(l.at)}  -  ${l.text}  (${l.by})`
    wrapText(line, 110).slice(0, 2).forEach((ln, i) => t2(ln, margin, y2 - i * 10.5, { size: 8 }))
    y2 -= wrapText(line, 110).slice(0, 2).length * 10.5 + 2
  }
  p2.drawLine({ start: { x: margin, y: 52 }, end: { x: pageWidth - margin, y: 52 }, thickness: 0.4, color: rgb(0.8, 0.82, 0.85) })
  t2(`Generisao: ${user.full_name}, ${new Date().toLocaleString('hr-HR')}  |  Zapis se čuva uz evidenciju održavanja vozila.`, margin, 40, { size: 7, color: rgb(0.5, 0.5, 0.5) })

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
