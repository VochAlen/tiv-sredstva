import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, PDFPage } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from "@/lib/supabase/server"
import { transliterate } from '@/lib/pdf-utils'

// ─── Brand colors ────────────────────────────────────────────────────────────
const C = {
  navy:      rgb(0.063, 0.161, 0.322),   // #102952  – header / accents
  navyLight: rgb(0.118, 0.235, 0.447),   // #1E3C72
  gold:      rgb(0.749, 0.557, 0.122),   // #BF8E1F  – highlights
  red:       rgb(0.780, 0.122, 0.122),   // #C71F1F
  orange:    rgb(0.831, 0.318, 0.043),   // #D4510B
  amber:     rgb(0.718, 0.490, 0.035),   // #B77C09
  green:     rgb(0.082, 0.502, 0.259),   // #158042
  purple:    rgb(0.384, 0.180, 0.718),   // #622EB7
  gray:      rgb(0.420, 0.420, 0.440),
  grayLight: rgb(0.894, 0.898, 0.910),   // row stripe
  white:     rgb(1, 1, 1),
  black:     rgb(0, 0, 0),
}

// ─── Layout constants ────────────────────────────────────────────────────────
const PW = 595.28   // A4 width  (pt)
const PH = 841.89   // A4 height (pt)
const ML = 45       // margin left
const MR = 45       // margin right
const CW = PW - ML - MR

// GET /api/reports/daily?date=2026-06-19
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const dateStr = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const date = new Date(dateStr)
  const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0)
  const endOfDay   = new Date(date); endOfDay.setHours(23, 59, 59, 999)

  let checkouts: any[] = [], checkins: any[] = [], damages: any[] = [], equipment: any[] = []

  if (isDemoMode()) {
    checkouts  = await db.assignment.findMany({ where: { action: 'CHECK_OUT', timestamp: { gte: startOfDay, lte: endOfDay } }, orderBy: { timestamp: 'asc' } })
    checkins   = await db.assignment.findMany({ where: { action: 'CHECK_IN',  timestamp: { gte: startOfDay, lte: endOfDay } }, orderBy: { timestamp: 'asc' } })
    damages    = await db.damageReport.findMany({ where: { createdAt: { gte: startOfDay, lte: endOfDay } }, orderBy: { createdAt: 'desc' } })
    equipment  = await db.equipment.findMany({ orderBy: { code: 'asc' } })
  } else {
    const supabase = await createSupabaseClient()
    const s = startOfDay.toISOString(), e = endOfDay.toISOString()
    const [coRes, ciRes, dRes, eqRes] = await Promise.all([
      supabase.from('assignments').select('*').eq('action', 'CHECK_OUT').gte('timestamp', s).lte('timestamp', e).order('timestamp', { ascending: true }),
      supabase.from('assignments').select('*').eq('action', 'CHECK_IN' ).gte('timestamp', s).lte('timestamp', e).order('timestamp', { ascending: true }),
      supabase.from('damage_reports').select('*').gte('created_at', s).lte('created_at', e).order('created_at', { ascending: false }),
      supabase.from('equipment').select('*').order('code', { ascending: true }),
    ])
    checkouts = coRes.data ?? []; checkins = ciRes.data ?? []; damages = dRes.data ?? []; equipment = eqRes.data ?? []
  }

  // ── PDF scaffold ────────────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(`GSE Dnevni izvjestaj ${dateStr}`)
  pdfDoc.setAuthor('Aerodromi Crne Gore a.d.')
  pdfDoc.setCreator('GSE Control System')

  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let page = pdfDoc.addPage([PW, PH])
  let y = PH - ML
  let pageNum = 1

  // ── Helper: safe text ───────────────────────────────────────────────────────
  const T = (text: string, x: number, yy: number, opts: {
    size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; maxWidth?: number
  } = {}) => {
    const { size = 10, bold = false, color = C.black, maxWidth } = opts
    const f = bold ? fontBold : font
    const safe = transliterate(String(text ?? ''))
    try {
      page.drawText(safe, { x, y: yy, size, font: f, color, ...(maxWidth ? { maxWidth, lineHeight: size * 1.35 } : {}) })
    } catch {
      page.drawText(safe.replace(/[^\x00-\x7F]/g, '?'), { x, y: yy, size, font: f, color })
    }
  }

  const line = (x1: number, y1: number, x2: number, y2: number, color = C.grayLight, thickness = 0.5) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color })

  const rect = (x: number, yy: number, w: number, h: number, fill: ReturnType<typeof rgb>, stroke?: ReturnType<typeof rgb>) =>
    page.drawRectangle({ x, y: yy, width: w, height: h, color: fill, ...(stroke ? { borderColor: stroke, borderWidth: 0.5 } : {}) })

  // ── Page break ──────────────────────────────────────────────────────────────
  const newPage = () => {
    // Footer on current page
    line(ML, 38, PW - MR, 38, C.navy, 0.5)
    T('Aerodromi Crne Gore a.d.  ·  GSE Control System  ·  IATA AHM 340 compliant', ML, 26, { size: 7, color: C.gray })
    T(`Strana ${pageNum}`, PW - MR - 30, 26, { size: 7, color: C.gray })
    pageNum++
    page = pdfDoc.addPage([PW, PH])
    y = PH - ML
    // Repeat small header
    rect(0, PH - 28, PW, 28, C.navy)
    T('AERODROMI CRNE GORE a.d.  —  GSE CONTROL', ML, PH - 18, { size: 8, bold: true, color: C.white })
    T(`Dnevni izvjestaj  |  ${dateStr}`, PW - MR - 130, PH - 18, { size: 8, color: C.gold })
    y = PH - 44
  }

  const guard = (needed: number) => { if (y - needed < 55) newPage() }

  // ══════════════════════════════════════════════════════════════════════════════
  //  COVER HEADER
  // ══════════════════════════════════════════════════════════════════════════════
  // Navy header band
  rect(0, PH - 95, PW, 95, C.navy)

  // Gold accent strip
  rect(0, PH - 99, PW, 4, C.gold)

  // Company name
  T('AERODROMI CRNE GORE a.d.', ML, PH - 32, { size: 11, bold: true, color: C.gold })
  T('Bezbjednost · Efikasnost · Uskladjenost', ML, PH - 47, { size: 8, color: rgb(0.75, 0.79, 0.85) })

  // Report title
  T('DNEVNI IZVJESTAJ', ML, PH - 68, { size: 22, bold: true, color: C.white })
  T('Ground Support Equipment — GSE Control System', ML, PH - 84, { size: 9, color: rgb(0.70, 0.78, 0.88) })

  // Date badge (right side)
  rect(PW - MR - 115, PH - 88, 115, 70, C.navyLight)
  rect(PW - MR - 115, PH - 22, 115, 22, C.gold)
  T('DATUM', PW - MR - 100, PH - 14, { size: 7, bold: true, color: C.navy })
  T(date.toLocaleDateString('sr-Latn-ME', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    PW - MR - 108, PH - 49, { size: 18, bold: true, color: C.white })
  T(date.toLocaleDateString('sr-Latn-ME', { weekday: 'long' }).toUpperCase(),
    PW - MR - 105, PH - 67, { size: 8, color: C.gold })
  T(`Gen: ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`,
    PW - MR - 97, PH - 80, { size: 7, color: rgb(0.65, 0.72, 0.82) })

  y = PH - 112

  // Meta info row
  rect(ML, y - 22, CW, 22, rgb(0.95, 0.96, 0.98))
  line(ML, y - 22, ML + CW, y - 22, C.grayLight)
  T(`Generisao: ${user.full_name}`, ML + 8, y - 14, { size: 8.5, color: C.gray })
  T(`Uloga: ${user.role.toUpperCase()}`, ML + 180, y - 14, { size: 8.5, color: C.gray })
  T(`Sistem: GSE Control  ·  IATA AHM 340`, ML + 310, y - 14, { size: 8.5, color: C.gray })
  y -= 38

  // ══════════════════════════════════════════════════════════════════════════════
  //  KPI TILES
  // ══════════════════════════════════════════════════════════════════════════════
  const totalEq  = equipment.length
  const avail    = equipment.filter(e => e.status === 'AVAILABLE').length
  const assigned = equipment.filter(e => e.status === 'ASSIGNED').length
  const oos      = equipment.filter(e => e.status === 'OUT_OF_SERVICE').length
  const maint    = equipment.filter(e => e.status === 'MAINTENANCE').length
  const successCO = checkouts.filter(c => !c.damageReportId && !c.damage_report_id).length
  const blockedCO = checkouts.length - successCO
  const compliance = checkouts.length > 0 ? Math.round((successCO / checkouts.length) * 100) : 100

  const tiles = [
    { label: 'UKUPNO OPREME',   value: totalEq,          color: C.navyLight },
    { label: 'DOSTUPNO',        value: avail,             color: C.green     },
    { label: 'U UPOTREBI',      value: assigned,          color: C.amber     },
    { label: 'NEISPRAVNO',      value: oos,               color: C.red       },
    { label: 'ODRZAVANJE',      value: maint,             color: C.purple    },
    { label: 'COMPLIANCE',      value: `${compliance}%`,  color: compliance >= 95 ? C.green : compliance >= 80 ? C.amber : C.red },
  ]

  const tileW = Math.floor(CW / 6) - 3
  tiles.forEach((tile, i) => {
    const tx = ML + i * (tileW + 3.6)
    rect(tx, y - 46, tileW, 46, tile.color)
    const valStr = String(tile.value)
    const valSize = valStr.length > 3 ? 16 : 22
    const valX = tx + tileW / 2 - (font.widthOfTextAtSize(valStr, valSize) / 2)
    T(valStr, valX, y - 24, { size: valSize, bold: true, color: C.white })
    const lblW = fontBold.widthOfTextAtSize(tile.label, 6.5)
    T(tile.label, tx + tileW / 2 - lblW / 2, y - 39, { size: 6.5, bold: true, color: rgb(1,1,1,) })
  })
  y -= 62

  // ══════════════════════════════════════════════════════════════════════════════
  //  SECTION HELPER
  // ══════════════════════════════════════════════════════════════════════════════
  const sectionHeader = (title: string, color = C.navy) => {
    guard(30)
    rect(ML, y - 20, CW, 20, color)
    T(title.toUpperCase(), ML + 8, y - 13, { size: 9, bold: true, color: C.white })
    y -= 26
  }

  // ── Table helpers ───────────────────────────────────────────────────────────
  const tableHeader = (cols: { label: string; x: number; w: number; right?: boolean }[]) => {
    rect(ML, y - 16, CW, 16, C.navyLight)
    cols.forEach(col => {
      const tx = col.right ? col.x + col.w - font.widthOfTextAtSize(col.label, 7.5) - 3 : col.x + 4
      T(col.label, tx, y - 11, { size: 7.5, bold: true, color: C.white })
    })
    y -= 16
  }

  const tableRow = (cols: { text: string; x: number; w: number; right?: boolean; color?: ReturnType<typeof rgb>; bold?: boolean }[], idx: number) => {
    if (idx % 2 === 0) rect(ML, y - 14, CW, 14, rgb(0.965, 0.968, 0.975))
    line(ML, y - 14, ML + CW, y - 14, C.grayLight)
    cols.forEach(col => {
      const tx = col.right ? col.x + col.w - font.widthOfTextAtSize(col.text, 8.5) - 3 : col.x + 4
      T(col.text, tx, y - 10, { size: 8.5, color: col.color ?? C.black, bold: col.bold })
    })
    y -= 14
  }

  // ══════════════════════════════════════════════════════════════════════════════
  //  1. ZADUŽIVANJA
  // ══════════════════════════════════════════════════════════════════════════════
  sectionHeader(`1. Zaduzivanja — ${checkouts.length} ukupno`, C.navy)

  if (checkouts.length === 0) {
    T('Nema zaduzivanja u ovom periodu.', ML + 8, y, { size: 9, color: C.gray })
    y -= 18
  } else {
    const cols = [
      { label: '#',         x: ML,        w: 18  },
      { label: 'VRIJEME',   x: ML + 18,   w: 42  },
      { label: 'KOD',       x: ML + 60,   w: 48  },
      { label: 'NAZIV',     x: ML + 108,  w: 145 },
      { label: 'RADNIK',    x: ML + 253,  w: 110 },
      { label: 'KARTA',     x: ML + 363,  w: 60  },
      { label: 'REZULTAT',  x: ML + 423,  w: 77  },
    ]
    tableHeader(cols)

    checkouts.forEach((a, idx) => {
      guard(16)
      const isBlocked = !!(a.damageReportId || a.damage_report_id)
      const time = new Date(a.timestamp || a.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      const result = isBlocked ? 'BLOKIRANO' : (a.inspectionResult || a.inspection_result || 'OK')
      const resultColor = isBlocked ? C.red : C.green

      tableRow([
        { text: String(idx + 1), x: ML,       w: 18,  right: true },
        { text: time,            x: ML + 18,  w: 42  },
        { text: a.equipmentCode || a.equipment_code, x: ML + 60, w: 48, bold: true, color: C.navyLight },
        { text: (a.equipmentName || a.equipment_name || '').slice(0, 38), x: ML + 108, w: 145 },
        { text: (a.employeeName || a.employee_name || '').slice(0, 26),   x: ML + 253, w: 110 },
        { text: a.employeeCardId || a.employee_card_id || '',              x: ML + 363, w: 60  },
        { text: result, x: ML + 423, w: 77, color: resultColor, bold: isBlocked },
      ], idx)
    })
  }

  y -= 8

  // ══════════════════════════════════════════════════════════════════════════════
  //  2. RAZDUŽIVANJA
  // ══════════════════════════════════════════════════════════════════════════════
  guard(40)
  sectionHeader(`2. Razduzivanja — ${checkins.length} ukupno`, C.navyLight)

  if (checkins.length === 0) {
    T('Nema razduzivanja u ovom periodu.', ML + 8, y, { size: 9, color: C.gray })
    y -= 18
  } else {
    const cols = [
      { label: '#',        x: ML,       w: 18  },
      { label: 'VRIJEME',  x: ML + 18,  w: 42  },
      { label: 'KOD',      x: ML + 60,  w: 48  },
      { label: 'NAZIV',    x: ML + 108, w: 155 },
      { label: 'RADNIK',   x: ML + 263, w: 120 },
      { label: 'KARTA',    x: ML + 383, w: 65  },
      { label: 'STATUS',   x: ML + 448, w: 52  },
    ]
    tableHeader(cols)

    checkins.forEach((a, idx) => {
      guard(16)
      const time = new Date(a.timestamp || a.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      tableRow([
        { text: String(idx + 1), x: ML,       w: 18, right: true },
        { text: time,            x: ML + 18,  w: 42  },
        { text: a.equipmentCode || a.equipment_code, x: ML + 60, w: 48, bold: true, color: C.navyLight },
        { text: (a.equipmentName || a.equipment_name || '').slice(0, 40), x: ML + 108, w: 155 },
        { text: (a.employeeName || a.employee_name || '').slice(0, 28),   x: ML + 263, w: 120 },
        { text: a.employeeCardId || a.employee_card_id || '',              x: ML + 383, w: 65  },
        { text: 'VRATIO',        x: ML + 448, w: 52, color: C.green, bold: true },
      ], idx)
    })
  }

  y -= 8

  // ══════════════════════════════════════════════════════════════════════════════
  //  3. OŠTEĆENJA
  // ══════════════════════════════════════════════════════════════════════════════
  if (damages.length > 0) {
    guard(50)
    sectionHeader(`3. Prijave ostecenja — ${damages.length} ukupno`, C.red)

    damages.forEach((d, idx) => {
      guard(52)
      const sev = d.severity
      const sevColor = sev === 'CRITICAL' ? C.red : sev === 'MAJOR' ? C.orange : C.amber
      const sevLabel = sev === 'CRITICAL' ? 'KRITICNO' : sev === 'MAJOR' ? 'VECE' : 'MANJE'
      const time = new Date(d.createdAt || d.created_at).toLocaleString('de-DE').slice(0, 16)
      const code = d.equipmentCode || d.equipment_code || ''
      const name = (d.equipmentName || d.equipment_name || '').slice(0, 55)
      const who  = d.reportedByName || d.reported_by_name || ''
      const desc = (d.description || '').slice(0, 120)

      // Severity pill
      rect(ML, y - 18, 60, 18, sevColor)
      T(sevLabel, ML + 4, y - 12, { size: 8, bold: true, color: C.white })
      // Item header
      T(`${String(idx + 1).padStart(2, '0')}.  ${code}  —  ${name}`, ML + 66, y - 12, { size: 9, bold: true, color: C.navy })
      y -= 20
      T(`Prijavio: ${who}  ·  Datum/Vrijeme: ${time}`, ML + 8, y, { size: 8, color: C.gray })
      y -= 13
      T(`Opis: ${desc}`, ML + 8, y, { size: 8, color: C.black, maxWidth: CW - 12 })
      y -= 16
      line(ML, y, ML + CW, y, C.grayLight)
      y -= 6
    })
  } else {
    guard(30)
    sectionHeader('3. Prijave ostecenja', C.red)
    T('Nema prijavljenih ostecenja za ovaj dan.', ML + 8, y, { size: 9, color: C.green, bold: true })
    y -= 18
  }

  // ══════════════════════════════════════════════════════════════════════════════
  //  4. STATUSOVI OPREME
  // ══════════════════════════════════════════════════════════════════════════════
  guard(50)
  sectionHeader('4. Trenutni status flote', C.navy)

  const statusGroups = [
    { status: 'AVAILABLE',    label: 'DOSTUPNO',    color: C.green  },
    { status: 'ASSIGNED',     label: 'U UPOTREBI',  color: C.amber  },
    { status: 'OUT_OF_SERVICE', label: 'NEISPRAVNO', color: C.red    },
    { status: 'MAINTENANCE',  label: 'ODRZAVANJE',  color: C.purple },
  ]

  const colsEq = [
    { label: 'KOD',     x: ML,       w: 55  },
    { label: 'NAZIV',   x: ML + 55,  w: 190 },
    { label: 'TIP',     x: ML + 245, w: 145 },
    { label: 'STATUS',  x: ML + 390, w: 110 },
  ]
  tableHeader(colsEq)

  equipment.forEach((e, idx) => {
    guard(16)
    const sg = statusGroups.find(s => s.status === e.status)
    tableRow([
      { text: e.code || '',   x: ML,       w: 55,  bold: true, color: C.navyLight },
      { text: (e.name || '').slice(0, 44), x: ML + 55, w: 190 },
      { text: (e.type || '').slice(0, 34), x: ML + 245, w: 145, color: C.gray },
      { text: sg?.label ?? e.status, x: ML + 390, w: 110, color: sg?.color ?? C.gray, bold: true },
    ], idx)
  })

  // ══════════════════════════════════════════════════════════════════════════════
  //  LAST PAGE FOOTER
  // ══════════════════════════════════════════════════════════════════════════════
  y -= 10
  guard(40)
  line(ML, y, PW - MR, y, C.gold, 1)
  y -= 14
  T('Digitalno generisan dokument — nije potreban potpis  ·  Cuvati minimum 5 godina (EASA Part-145)', ML, y, { size: 7, color: C.gray })
  y -= 10
  T(`Compliance rate: ${compliance}%  |  Zaduzivanja: ${checkouts.length}  |  Razduzivanja: ${checkins.length}  |  Ostecenja: ${damages.length}`, ML, y, { size: 7, color: C.gray })

  // Footer on last page
  line(ML, 38, PW - MR, 38, C.navy, 0.5)
  T('Aerodromi Crne Gore a.d.  ·  GSE Control System  ·  IATA AHM 340 compliant', ML, 26, { size: 7, color: C.gray })
  T(`Strana ${pageNum}`, PW - MR - 30, 26, { size: 7, color: C.gray })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="dnevni-izvjestaj-${dateStr}.pdf"`,
    },
  })
}