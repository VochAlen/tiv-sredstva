// src/app/api/reports/daily-inspection/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'
import { getIndicativeRCC } from '@/lib/rcc'

const TYPE_LABELS: Record<string, string> = {
  RUNWAY: 'Runway',
  TAXIWAY: 'Taxiway',
  APRON: 'Apron',
  MOVEMENT_AREA_JOINT: 'Movement Area Joint',
  RUNWAY_STRIP: 'Osnovna staza PSS-a',
  TAXIWAY_STRIP: 'Osnovna staza RS-a',
  DRAINAGE: 'Sistem za odvodnjavanje',
  FENCE: 'Zicana ograda',
  BUILDING: 'Gradjevinski objekti',
  WATER_SEWAGE: 'Vodovod i kanalizacija',
  GREEN_AREA: 'Zelene povrsine',
}
const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Zavrseno',
  WITH_FINDINGS: 'Sa nalazima',
  CRITICAL: 'KRITICNO',
  ABORTED: 'Prekinuto',
}

// PRG.03.02 - referentna oznaka papirnog obrasca kojeg PDF digitalno
// zamjenjuje, po tipu pregleda (Sekcija 6, Tabela 10)
const PRG0302_FORM_CODE: Record<string, string> = {
  RUNWAY: 'PRG.03.02.OBR.3-5',
  TAXIWAY: 'PRG.03.02.OBR.6',
  APRON: 'PRG.03.02.OBR.7',
  RUNWAY_STRIP: 'PRG.03.02.OBR.8',
  TAXIWAY_STRIP: 'PRG.03.02.OBR.9',
  DRAINAGE: 'PRG.03.02.OBR.10',
  FENCE: 'PRG.03.02.OBR.11 (Prilog 1 za dnevnu FTO patrolu)',
  BUILDING: 'PRG.03.02.OBR.12',
  WATER_SEWAGE: 'PRG.03.02.OBR.13',
  GREEN_AREA: 'PRG.03.02.OBR.14',
}

// Regulatorna referenca po tipu inspekcije — Commission Regulation (EU) 139/2014, Part-ADR.OPS
const REGULATION_REF: Record<string, string> = {
  RUNWAY: 'ADR.OPS.B.015 (Monitoring & inspection) / ADR.OPS.A.065 (RCC/GRF)',
  TAXIWAY: 'ADR.OPS.B.015 (Monitoring & inspection of movement area)',
  APRON: 'ADR.OPS.B.015 / ADR.OPS.B.016 (FOD control programme)',
  MOVEMENT_AREA_JOINT: 'ADR.OPS.B.015 / ADR.OPS.B.020 (Wildlife strike hazard reduction)',
  RUNWAY_STRIP: 'PRG.03.02 3.2.5.1 - periodicni pregled osnovne staze PSS-a',
  TAXIWAY_STRIP: 'PRG.03.02 3.2.5.1 - periodicni pregled osnovne staze RS-a',
  DRAINAGE: 'PRG.03.02 3.2.5.2 - sistem za odvodnjavanje',
  FENCE: 'ADR.OPS.B.020 / PRG.03.02 3.2.3.3, 3.2.5.3 - zicana ograda',
  BUILDING: 'PRG.03.02 4.2 - gradjevinski objekti',
  WATER_SEWAGE: 'PRG.03.02 4.2.1 - vodovodne i kanalizacione instalacije',
  GREEN_AREA: 'PRG.03.02 4.3 - zelene povrsine',
}

// Tabela 7 (PRG.03.02) - kratak opis ocjene za PDF
const CONDITION_RATING_LABELS: Record<string, string> = {
  E: 'Odlicno',
  G: 'Zadovoljava',
  A: 'Prihvatljivo (granica)',
  NA: 'NEPRIHVATLJIVO',
}


async function embedFindingPhoto(pdfDoc: PDFDocument, photoUrl: string) {
  try {
    const base64 = photoUrl.includes(',') ? photoUrl.split(',')[1] : photoUrl
    const bytes = Buffer.from(base64, 'base64')
    if (photoUrl.includes('image/png')) return await pdfDoc.embedPng(bytes)
    return await pdfDoc.embedJpg(bytes)
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const inspectionId = searchParams.get('id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const typeFilter = searchParams.get('type')

  let insp: any[] = []

  if (isDemoMode()) {
    insp = await db.aerodromeInspection.findMany({
      where: {
        ...(inspectionId ? { id: inspectionId } : {}),
        ...(from && to ? { inspectionDate: { gte: new Date(from), lte: new Date(`${to}T23:59:59`) } } : {}),
        ...(typeFilter ? { inspectionType: typeFilter } : {}),
      },
      orderBy: { inspectionDate: 'desc' },
      include: { findings: true },
    })
  } else {
    const supabase = await createSupabaseClient()
    let query = supabase
      .from('aerodrome_inspections')
      .select('*, inspection_findings(*)')
      .order('inspection_date', { ascending: false })

    if (inspectionId) query = query.eq('id', inspectionId)
    if (from && to) query = query.gte('inspection_date', from).lte('inspection_date', `${to}T23:59:59`)
    if (typeFilter) query = query.eq('inspection_type', typeFilter)

    const { data } = await query
    insp = (data ?? []).map((i: any) => ({
      id: i.id,
      inspectionType: i.inspection_type,
      inspectionDate: i.inspection_date,
      performedBy: i.performed_by,
      shift: i.shift,
      runwayCode: i.runway_code,
      taxiwayCode: i.taxiway_code,
      apronArea: i.apron_area,
      weatherConditions: i.weather_conditions,
      runwayCondition: i.runway_condition,
      status: i.status,
      findingsCount: i.inspection_findings?.length ?? 0,
      criticalCount: i.inspection_findings?.filter((f: any) => f.severity === 'CRITICAL').length ?? 0,
      notes: i.notes,
      // NAPOMENA: pretpostavljam snake_case nazive kolona (photo_url, action_taken) —
      // provjeri i po potrebi uskladi sa stvarnom Supabase šemom.
      findings: (i.inspection_findings ?? []).map((f: any) => ({
        category: f.category,
        severity: f.severity,
        description: f.description,
        location: f.location,
        photoUrl: f.photo_url,
        status: f.status,
        lengthM: f.length_m,
        maxWidthCm: f.max_width_cm,
        maxDepthCm: f.max_depth_cm,
        locationCode: f.location_code,
        isMarked: f.is_marked,
        conditionRating: f.condition_rating,
        fenceStubFrom: f.fence_stub_from,
        fenceStubTo: f.fence_stub_to,
      })),
    }))
  }

  if (inspectionId && insp.length === 0) return new NextResponse('Inspection not found', { status: 404 })

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 50
  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const addText = (text: string, x: number, yVal: number, opts: any = {}) => {
    const { size = 10, font: f = font, color = rgb(0, 0, 0) } = opts
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

  // ---- Letterhead ----
  page.drawRectangle({ x: 0, y: pageHeight - 8, width: pageWidth, height: 8, color: rgb(0.05, 0.25, 0.45) })
  addText('GSE CONTROL — AERODROME LYTV (TIVAT)', margin, y, { size: 16, font: fontBold })
  y -= 18
  addText(
    inspectionId ? 'IZVJESTAJ O INSPEKCIJI — POJEDINACNI ZAPIS' : 'DNEVNI IZVJESTAJ INSPEKCIJA AERODROMA',
    margin,
    y,
    { size: 12, font: fontBold, color: rgb(0.15, 0.15, 0.15) }
  )
  y -= 16
  addText('ICAO Annex 14, Vol I / Commission Regulation (EU) 139/2014, Part-ADR.OPS', margin, y, {
    size: 9,
    color: rgb(0.45, 0.45, 0.45),
  })
  y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 })
  y -= 12
  addText(`Datum izvjestaja: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 })
  y -= 12
  if (from && to) {
    addText(`Period: ${from} - ${to}`, margin, y, { size: 10 })
    y -= 12
  }
  addText(`Ukupno inspekcija: ${insp.length}`, margin, y, { size: 10 })
  y -= 20

  // ---- Sazetak (samo za daily/period pregled) ----
  if (!inspectionId) {
    const critical = insp.filter((i) => i.status === 'CRITICAL').length
    const withFindings = insp.filter((i) => i.status === 'WITH_FINDINGS').length
    const completed = insp.filter((i) => i.status === 'COMPLETED').length
    const totalFindings = insp.reduce((s, i) => s + (i.findingsCount || (i.findings?.length ?? 0)), 0)

    addText('SAZETAK:', margin, y, { size: 12, font: fontBold })
    y -= 14
    addText(`- Zavrsene inspekcije: ${completed}`, margin + 10, y, { size: 10, color: rgb(0.1, 0.55, 0.15) })
    y -= 12
    addText(`- Sa nalazima: ${withFindings}`, margin + 10, y, { size: 10, color: rgb(0.85, 0.55, 0.1) })
    y -= 12
    addText(`- Kriticne: ${critical}`, margin + 10, y, {
      size: 10,
      color: critical > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0),
    })
    y -= 12
    addText(`- Ukupno nalaza: ${totalFindings}`, margin + 10, y, { size: 10 })
    y -= 20
  }

  // ---- Tabela ----
  addText('PREGLED INSPEKCIJA:', margin, y, { size: 12, font: fontBold })
  y -= 14
  const cols = [margin, margin + 90, margin + 180, margin + 250, margin + 310, margin + 380, margin + 460]
  ;['Datum', 'Tip', 'Inspektor', 'Lokacija', 'Status', 'Nalaza', 'Kriticnih'].forEach((h, i) =>
    addText(h, cols[i], y, { size: 8, font: fontBold })
  )
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const i of insp) {
    ensureSpace(80)
    const dt = new Date(i.inspectionDate).toLocaleString('hr-HR').slice(0, 12)
    const loc = i.runwayCode ? `RWY ${i.runwayCode}` : i.taxiwayCode ? `TWY ${i.taxiwayCode}` : i.apronArea || '-'
    const findingsCount = i.findingsCount || i.findings?.length || 0
    const criticalCount = i.criticalCount || i.findings?.filter((f: any) => f.severity === 'CRITICAL').length || 0

    addText(dt, cols[0], y, { size: 7 })
    addText((TYPE_LABELS[i.inspectionType] || i.inspectionType).slice(0, 12), cols[1], y, { size: 7, font: fontBold })
    addText((i.performedBy || '').slice(0, 16), cols[2], y, { size: 7 })
    addText(loc.slice(0, 14), cols[3], y, { size: 7 })
    const stColor =
      i.status === 'CRITICAL' ? rgb(0.86, 0.15, 0.15) : i.status === 'WITH_FINDINGS' ? rgb(0.85, 0.55, 0.1) : rgb(0.1, 0.55, 0.15)
    addText((STATUS_LABELS[i.status] || i.status).slice(0, 12), cols[4], y, { size: 7, color: stColor, font: fontBold })
    addText(`${findingsCount}`, cols[5], y, { size: 7 })
    addText(`${criticalCount}`, cols[6], y, {
      size: 7,
      color: criticalCount > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0),
    })
    y -= 11

    addText(`Reg. reference: ${REGULATION_REF[i.inspectionType] || 'ADR.OPS.B.015'}`, margin + 10, y, {
      size: 6,
      color: rgb(0.5, 0.5, 0.5),
    })
    y -= 9

    if (PRG0302_FORM_CODE[i.inspectionType]) {
      addText(`Zamjenjuje papirni obrazac: ${PRG0302_FORM_CODE[i.inspectionType]}`, margin + 10, y, {
        size: 6,
        color: rgb(0.5, 0.5, 0.5),
      })
      y -= 9
    }

    if (i.inspectionType === 'RUNWAY' && i.runwayCondition) {
      const rcc = getIndicativeRCC(i.runwayCondition)
      addText(
        `Stanje piste: ${i.runwayCondition}${rcc.code !== null ? `  ·  Indikativni RCC: ${rcc.code} (${rcc.label})` : ''}`,
        margin + 10,
        y,
        { size: 7, color: rgb(0.2, 0.2, 0.5) }
      )
      y -= 10
    }

    if (i.findings && i.findings.length > 0) {
      for (const f of i.findings) {
        ensureSpace(90)
        const sevColor =
          f.severity === 'CRITICAL' ? rgb(0.86, 0.15, 0.15) : f.severity === 'HIGH' ? rgb(0.85, 0.4, 0.1) : rgb(0.3, 0.3, 0.3)
        addText(
          `   [${f.severity}] ${f.category}: ${f.description.slice(0, 80)}${f.location ? ` @ ${f.location}` : ''}`,
          margin,
          y,
          { size: 6, color: sevColor }
        )
        y -= 8

        // Strukturirani K-kod podaci (PRG.03.02, Tabela 5-7) - ako postoje
        const kBits: string[] = []
        if (f.lengthM != null) kBits.push(`dužina/pov.: ${f.lengthM}m`)
        if (f.maxWidthCm != null) kBits.push(`širina: ${f.maxWidthCm}cm`)
        if (f.maxDepthCm != null) kBits.push(`dubina/visina: ${f.maxDepthCm}cm`)
        if (f.locationCode) kBits.push(`lokacija: ${f.locationCode}`)
        if (f.fenceStubFrom != null) kBits.push(`stub: ${f.fenceStubFrom}${f.fenceStubTo && f.fenceStubTo !== f.fenceStubFrom ? `-${f.fenceStubTo}` : ''}`)
        if (f.isMarked) kBits.push('markirano')
        if (f.conditionRating) kBits.push(`ocjena: ${CONDITION_RATING_LABELS[f.conditionRating] ?? f.conditionRating}`)
        if (kBits.length > 0) {
          ensureSpace(15)
          addText(`      (${kBits.join(' / ')})`, margin, y, {
            size: 6,
            color: f.conditionRating === 'NA' ? rgb(0.86, 0.15, 0.15) : rgb(0.45, 0.45, 0.45),
          })
          y -= 9
        }

        if (f.photoUrl) {
          const img = await embedFindingPhoto(pdfDoc, f.photoUrl)
          if (img) {
            const dims = img.scaleToFit(90, 65)
            ensureSpace(dims.height + 15)
            page.drawImage(img, { x: margin + 12, y: y - dims.height, width: dims.width, height: dims.height })
            y -= dims.height + 6
          }
        }
      }
    }
    y -= 6
  }

  // ---- Blok za potpis / certifikaciju ----
  ensureSpace(90)
  y -= 10
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) })
  y -= 16
  addText('POTVRDA / CERTIFICATION', margin, y, { size: 10, font: fontBold })
  y -= 14
  addText(`Izvjestaj generisao: ${user.full_name}`, margin, y, { size: 9 })
  addText('Potpis: _______________________', margin + 260, y, { size: 9 })
  y -= 12
  addText(`Uloga: ${user.role}`, margin, y, { size: 9 })
  addText(`Datum/vrijeme: ${new Date().toLocaleString('hr-HR')}`, margin + 260, y, { size: 9 })
  y -= 20
  addText('Ovaj dokument predstavlja zapis o obavljenim inspekcijama u skladu sa ADR.OPS.B.015', margin, y, {
    size: 7,
    color: rgb(0.5, 0.5, 0.5),
  })

  // ---- Numeracija stranica + footer na svakoj strani ----
  const pages = pdfDoc.getPages()
  pages.forEach((p, idx) => {
    p.drawText(`${idx + 1} / ${pages.length}`, {
      x: pageWidth - margin - 30,
      y: 20,
      size: 8,
      font,
      color: rgb(0.55, 0.55, 0.55),
    })
    p.drawText('GSE Control - Tivat Airport (LYTV)', { x: margin, y: 20, size: 7, font, color: rgb(0.55, 0.55, 0.55) })
  })

  const pdf = await pdfDoc.save()
  const filename = inspectionId
    ? `inspection-${inspectionId.slice(0, 8)}.pdf`
    : `daily-inspection-${from ?? new Date().toISOString().slice(0, 10)}${to ? `_${to}` : ''}.pdf`

  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}