// src/app/api/reports/gse-daily-checklist/route.ts
//
// Digitalna zamjena za papirne obrasce PRO.03.04.OBR1 (Sluzba zemaljskog
// opsluzivanja / P-O) i PRO.03.04.OBR2 (Tehnicka sluzba) - "Ground Support
// Equipment (GSE) Daily Checklist". Prikazuje SVU opremu date sluzbe sa
// stvarnim statusom danasnje digitalne inspekcije (Y/N) ako postoji, ili
// praznu kolonu ako oprema jos nije digitalno pregledana tog dana (moze se
// tad rucno popuniti na odstampanom listu, kao prelazno rjesenje).

import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { getDailyInspectionStatus } from '@/lib/actions-adr'
import { EQUIPMENT_TYPE_LABELS } from '@/lib/types'
import { transliterate } from '@/lib/pdf-utils'

const DEPARTMENT_META: Record<string, { title: string; subtitle: string; formCode: string }> = {
  TEHNICKA_SLUZBA: {
    title: 'TEHNICKA SLUZBA',
    subtitle: 'TECHNICAL DEPARTMENT',
    formCode: 'PRO.03.04.OBR2',
  },
  SLUZBA_PO: {
    title: 'SLUZBA ZEMALJSKOG OPSLUZIVANJA AERODROMA TIVAT',
    subtitle: 'GROUND HANDLING DEPARTMENT',
    formCode: 'PRO.03.04.OBR1',
  },
}

const CATEGORY_ORDER = [
  'GPU', 'AIR_STARTER', 'TOW_TRACTOR', 'BELT_LOADER', 'CARGO_LOADER', 'STAIRS',
  'WATER', 'LAVATORY', 'PUSHBACK', 'FORKLIFT', 'DOLLY', 'BUS', 'FIRE_TRUCK',
  'AMBULANCE', 'FOLLOW_ME', 'SERVICE_CAR', 'OTHER',
]

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const department = searchParams.get('department') ?? 'TEHNICKA_SLUZBA'
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const meta = DEPARTMENT_META[department] ?? DEPARTMENT_META.TEHNICKA_SLUZBA

  const all = await getDailyInspectionStatus(date)
  const rows = all.filter((r) => (r.department ?? 'TEHNICKA_SLUZBA') === department)

  // Grupisi po tipu (kategorije I, II, III... kao na papirnom obrascu)
  const byType = new Map<string, typeof rows>()
  for (const r of rows) {
    const list = byType.get(r.type) ?? []
    list.push(r)
    byType.set(r.type, list)
  }

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 45
  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const addText = (text: string, x: number, yVal: number, opts: any = {}) => {
    const { size = 9, font: f = font, color = rgb(0, 0, 0) } = opts
    try {
      page.drawText(transliterate(text), { x, y: yVal, size, font: f, color })
    } catch {}
  }
  const ensureSpace = (needed: number) => {
    if (y < needed) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  // ---- Zaglavlje ----
  page.drawRectangle({ x: 0, y: pageHeight - 6, width: pageWidth, height: 6, color: rgb(0.05, 0.25, 0.45) })
  addText('AERODROMI CRNE GORE - AERODROM TIVAT', margin, y, { size: 13, font: fontBold })
  y -= 15
  addText(`${meta.subtitle}   /   Ground Support Equipment (GSE) Daily Checklist`, margin, y, { size: 9, color: rgb(0.35, 0.35, 0.35) })
  y -= 16
  addText(meta.title, margin, y, { size: 12, font: fontBold, color: rgb(0.05, 0.25, 0.45) })
  y -= 14
  addText('Cek lista dnevne ispravnosti opreme za opsluzivanje vazduhoplova', margin, y, { size: 9, color: rgb(0.35, 0.35, 0.35) })
  y -= 18
  addText(`Datum: ${date}`, margin, y, { size: 10, font: fontBold })
  const totalCount = rows.length
  const inspectedCount = rows.filter((r) => r.inspection).length
  addText(`Pregledano: ${inspectedCount} / ${totalCount}`, margin + 200, y, {
    size: 10,
    font: fontBold,
    color: inspectedCount === totalCount ? rgb(0.1, 0.55, 0.15) : rgb(0.85, 0.55, 0.1),
  })
  y -= 20

  // ---- Kolone tabele ----
  const cols = [margin, margin + 40, margin + 85, margin + 340, margin + 420]
  const drawHeader = () => {
    ensureSpace(40)
    ;['Red.br.', 'Reg./oznaka', 'GSE / Naziv sredstva', 'Ispravnost (Y/N)', 'Pregledao / Vrijeme'].forEach((h, i) =>
      addText(h, cols[i], y, { size: 8, font: fontBold })
    )
    y -= 5
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.6, color: rgb(0, 0, 0) })
    y -= 12
  }
  drawHeader()

  let rowNo = 1
  for (const type of CATEGORY_ORDER) {
    const items = byType.get(type)
    if (!items || items.length === 0) continue

    ensureSpace(30)
    page.drawRectangle({ x: margin, y: y - 3, width: pageWidth - 2 * margin, height: 14, color: rgb(0.9, 0.93, 0.97) })
    addText(EQUIPMENT_TYPE_LABELS[type as keyof typeof EQUIPMENT_TYPE_LABELS] ?? type, margin + 4, y, { size: 8.5, font: fontBold })
    y -= 16

    for (const item of items) {
      ensureSpace(20)
      const regOznaka = item.code
      const inspected = item.inspection !== null
      const statusText = inspected
        ? (item.inspection!.result === 'FIT' ? 'Y' : item.inspection!.result === 'UNFIT' ? 'N' : 'Y*')
        : ''
      const statusColor = !inspected
        ? rgb(0, 0, 0)
        : item.inspection!.result === 'FIT'
        ? rgb(0.1, 0.55, 0.15)
        : item.inspection!.result === 'UNFIT'
        ? rgb(0.86, 0.15, 0.15)
        : rgb(0.85, 0.55, 0.1)

      addText(`${rowNo}`, cols[0], y, { size: 8 })
      addText(regOznaka, cols[1], y, { size: 8 })
      addText(item.name.slice(0, 42), cols[2], y, { size: 8 })
      addText(statusText, cols[3], y, { size: 9, font: fontBold, color: statusColor })
      if (inspected) {
        addText(
          `${item.inspection!.inspectorName.slice(0, 18)} / ${new Date(item.inspection!.inspectionDate).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}`,
          cols[4],
          y,
          { size: 7, color: rgb(0.4, 0.4, 0.4) }
        )
      }
      y -= 13
      rowNo++
    }
    y -= 4
  }

  // ---- Napomena (isti tekst kao papirni obrazac) ----
  ensureSpace(70)
  y -= 8
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.4, color: rgb(0.7, 0.7, 0.7) })
  y -= 14
  addText('Note / Bilješka:', margin, y, { size: 8, font: fontBold })
  y -= 11
  addText(
    'Svjetlosni sistem, Pneumatici, Upravljacki mehanizam, Kocioni mehanizam, Curenje tecnosti, Nosive platforme (gdje je',
    margin,
    y,
    { size: 7.5, color: rgb(0.3, 0.3, 0.3) }
  )
  y -= 10
  addText('promjenljivo), protivpozarni aparat i sigurnosni uredjaji su vizuelno pregledani.', margin, y, {
    size: 7.5,
    color: rgb(0.3, 0.3, 0.3),
  })
  y -= 10
  addText('* Y sa napomenom = CONDITIONAL (manje neispravnosti, sredstvo uslovno u upotrebi - vidi digitalnu evidenciju)', margin, y, {
    size: 7,
    color: rgb(0.5, 0.5, 0.5),
  })

  // ---- Potpis ----
  ensureSpace(60)
  y -= 20
  addText('Checked by / Pregled izvrsio:', margin, y, { size: 9, font: fontBold })
  y -= 14
  addText('Ime i prezime / Signature / Potpis: ______________________________________', margin, y, { size: 9 })
  y -= 10
  addText(`Izvjestaj generisao iz aplikacije: ${user.full_name}, ${new Date().toLocaleString('hr-HR')}`, margin, y, {
    size: 7,
    color: rgb(0.5, 0.5, 0.5),
  })

  // ---- Footer na svakoj strani ----
  const pages = pdfDoc.getPages()
  pages.forEach((p, idx) => {
    p.drawText(meta.formCode, { x: margin, y: 20, size: 8, font, color: rgb(0.55, 0.55, 0.55) })
    p.drawText('IZD./REV. 01/00', { x: pageWidth - margin - 70, y: 20, size: 8, font, color: rgb(0.55, 0.55, 0.55) })
    if (pages.length > 1) {
      p.drawText(`${idx + 1} / ${pages.length}`, { x: pageWidth / 2 - 10, y: 20, size: 8, font, color: rgb(0.55, 0.55, 0.55) })
    }
  })

  const pdf = await pdfDoc.save()
  const filename = `gse-dnevni-pregled-${department === 'TEHNICKA_SLUZBA' ? 'TS' : 'PO'}-${date}.pdf`

  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
