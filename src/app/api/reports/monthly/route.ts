import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from "@/lib/supabase/server"
import { transliterate } from '@/lib/pdf-utils'

// ─── Brand colors ────────────────────────────────────────────────────────────
const C = {
  navy:      rgb(0.063, 0.161, 0.322),
  navyLight: rgb(0.118, 0.235, 0.447),
  gold:      rgb(0.749, 0.557, 0.122),
  red:       rgb(0.780, 0.122, 0.122),
  orange:    rgb(0.831, 0.318, 0.043),
  amber:     rgb(0.718, 0.490, 0.035),
  green:     rgb(0.082, 0.502, 0.259),
  purple:    rgb(0.384, 0.180, 0.718),
  gray:      rgb(0.420, 0.420, 0.440),
  grayLight: rgb(0.894, 0.898, 0.910),
  white:     rgb(1, 1, 1),
  black:     rgb(0, 0, 0),
}

const PW = 595.28
const PH = 841.89
const ML = 45
const MR = 45
const CW = PW - ML - MR

const MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar']

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const now = new Date()
  const year  = parseInt(searchParams.get('year')  ?? now.getFullYear().toString())
  const month = parseInt(searchParams.get('month') ?? (now.getMonth() + 1).toString())

  const startDate = new Date(year, month - 1, 1)
  const endDate   = new Date(year, month, 0, 23, 59, 59, 999)
  const monthName = MONTHS[month - 1]

  let assignments: any[] = [], damages: any[] = [], resolvedDamages: any[] = []
  let equipment: any[] = [], maintenanceLogs: any[] = []

  if (isDemoMode()) {
    assignments     = await db.assignment.findMany({ where: { timestamp:   { gte: startDate, lte: endDate } }, orderBy: { timestamp:   'asc' } })
    damages         = await db.damageReport.findMany({ where: { createdAt:  { gte: startDate, lte: endDate } }, orderBy: { createdAt:   'desc' } })
    resolvedDamages = await db.damageReport.findMany({ where: { resolvedAt: { gte: startDate, lte: endDate } } })
    equipment       = await db.equipment.findMany()
    maintenanceLogs = await db.maintenanceLog.findMany({ where: { performedAt: { gte: startDate, lte: endDate } } })
  } else {
    const supabase = await createSupabaseClient()
    const s = startDate.toISOString(), e = endDate.toISOString()
    const [aRes, dRes, rRes, eRes, mRes] = await Promise.all([
      supabase.from('assignments').select('*').gte('timestamp', s).lte('timestamp', e),
      supabase.from('damage_reports').select('*').gte('created_at', s).lte('created_at', e).order('created_at', { ascending: false }),
      supabase.from('damage_reports').select('*').gte('resolved_at', s).lte('resolved_at', e),
      supabase.from('equipment').select('*'),
      supabase.from('maintenance_log').select('*').gte('performed_at', s).lte('performed_at', e),
    ])
    assignments = aRes.data ?? []; damages = dRes.data ?? []; resolvedDamages = rRes.data ?? []
    equipment = eRes.data ?? []; maintenanceLogs = mRes.data ?? []
  }

  // ── Derived stats ───────────────────────────────────────────────────────────
  const checkouts        = assignments.filter(a => a.action === 'CHECK_OUT')
  const checkins         = assignments.filter(a => a.action === 'CHECK_IN')
  const successfulCO     = checkouts.filter(c => !c.damageReportId && !c.damage_report_id)
  const blockedCO        = checkouts.filter(c =>  c.damageReportId ||  c.damage_report_id)
  const compliance       = checkouts.length > 0 ? Math.round((successfulCO.length / checkouts.length) * 100) : 100
  const daysInMonth      = new Date(year, month, 0).getDate()
  const severityCounts   = {
    CRITICAL: damages.filter(d => d.severity === 'CRITICAL').length,
    MAJOR:    damages.filter(d => d.severity === 'MAJOR').length,
    MINOR:    damages.filter(d => d.severity === 'MINOR').length,
  }

  // Activity by day
  const byDay = new Map<string, { co: number; ci: number; dmg: number }>()
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    byDay.set(key, { co: 0, ci: 0, dmg: 0 })
  }
  assignments.forEach(a => {
    const key = new Date(a.timestamp || a.created_at).toISOString().slice(0, 10)
    const day = byDay.get(key)
    if (!day) return
    if (a.action === 'CHECK_OUT') day.co++
    if (a.action === 'CHECK_IN')  day.ci++
    if (a.damageReportId || a.damage_report_id) day.dmg++
  })

  // Top equipment by activity
  const eqActivity = new Map<string, number>()
  assignments.forEach(a => {
    const code = a.equipmentCode || a.equipment_code
    eqActivity.set(code, (eqActivity.get(code) ?? 0) + 1)
  })
  const topEquipment = Array.from(eqActivity.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)

  // Peak day
  let peakDay = '', peakCount = 0
  byDay.forEach((v, k) => { if (v.co + v.ci > peakCount) { peakCount = v.co + v.ci; peakDay = k } })
  const avgPerDay = daysInMonth > 0 ? Math.round((assignments.length / daysInMonth) * 10) / 10 : 0

  // ── PDF scaffold ────────────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(`GSE Mjesecni Izvjestaj ${monthName} ${year}`)
  pdfDoc.setAuthor('Aerodromi Crne Gore a.d.')
  pdfDoc.setCreator('GSE Control System')

  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let page = pdfDoc.addPage([PW, PH])
  let y = PH - ML
  let pageNum = 1

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

  const hline = (x1: number, y1: number, x2: number, y2: number, color = C.grayLight, thickness = 0.5) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color })

  const rect = (x: number, yy: number, w: number, h: number, fill: ReturnType<typeof rgb>) =>
    page.drawRectangle({ x, y: yy, width: w, height: h, color: fill })

  const newPage = () => {
    hline(ML, 38, PW - MR, 38, C.navy, 0.5)
    T('Aerodromi Crne Gore a.d.  ·  GSE Control System  ·  IATA AHM 340 + EASA Part-145 compliant', ML, 26, { size: 7, color: C.gray })
    T(`Strana ${pageNum}`, PW - MR - 30, 26, { size: 7, color: C.gray })
    pageNum++
    page = pdfDoc.addPage([PW, PH])
    y = PH - ML
    rect(0, PH - 28, PW, 28, C.navy)
    T(`AERODROMI CRNE GORE a.d.  —  GSE CONTROL  —  MJESECNI IZVJESTAJ  |  ${monthName.toUpperCase()} ${year}`, ML, PH - 18, { size: 8, bold: true, color: C.white })
    y = PH - 44
  }

  const guard = (needed: number) => { if (y - needed < 55) newPage() }

  const sectionHeader = (num: string, title: string, color = C.navy) => {
    guard(35)
    rect(ML, y - 22, CW, 22, color)
    rect(ML, y - 22, 28, 22, C.gold)
    T(num, ML + 8, y - 15, { size: 10, bold: true, color: C.navy })
    T(title.toUpperCase(), ML + 34, y - 15, { size: 9, bold: true, color: C.white })
    y -= 28
  }

  const tableHeader = (cols: { label: string; x: number; w: number; right?: boolean }[]) => {
    rect(ML, y - 16, CW, 16, C.navyLight)
    cols.forEach(col => {
      const tw = fontBold.widthOfTextAtSize(col.label, 7.5)
      const tx = col.right ? col.x + col.w - tw - 3 : col.x + 4
      T(col.label, tx, y - 11, { size: 7.5, bold: true, color: C.white })
    })
    y -= 16
  }

  const tableRow = (cols: { text: string; x: number; w: number; right?: boolean; color?: ReturnType<typeof rgb>; bold?: boolean }[], idx: number) => {
    if (idx % 2 === 0) rect(ML, y - 14, CW, 14, rgb(0.965, 0.968, 0.978))
    hline(ML, y - 14, ML + CW, y - 14, C.grayLight)
    cols.forEach(col => {
      const tw = (col.bold ? fontBold : font).widthOfTextAtSize(col.text, 8.5)
      const tx = col.right ? col.x + col.w - tw - 3 : col.x + 4
      T(col.text, tx, y - 10, { size: 8.5, color: col.color ?? C.black, bold: col.bold })
    })
    y -= 14
  }

  // ══════════════════════════════════════════════════════════════════════════════
  //  COVER HEADER
  // ══════════════════════════════════════════════════════════════════════════════
  rect(0, PH - 110, PW, 110, C.navy)
  rect(0, PH - 114, PW, 4, C.gold)

  T('AERODROMI CRNE GORE a.d.', ML, PH - 30, { size: 11, bold: true, color: C.gold })
  T('Bezbjednost · Efikasnost · Uskladjenost', ML, PH - 45, { size: 8, color: rgb(0.75, 0.79, 0.85) })
  T('MJESECNI IZVJESTAJ', ML, PH - 70, { size: 24, bold: true, color: C.white })
  T('Ground Support Equipment  —  GSE Control System', ML, PH - 86, { size: 9, color: rgb(0.70, 0.78, 0.88) })
  T('IATA AHM 340  ·  EASA Part-145', ML, PH - 100, { size: 8, color: C.gold })

  // Period badge
  rect(PW - MR - 120, PH - 105, 120, 80, C.navyLight)
  rect(PW - MR - 120, PH - 28, 120, 28, C.gold)
  T('PERIOD', PW - MR - 105, PH - 18, { size: 7.5, bold: true, color: C.navy })
  T(monthName.toUpperCase(), PW - MR - 115, PH - 55, { size: 19, bold: true, color: C.white })
  T(String(year), PW - MR - 88, PH - 72, { size: 14, bold: true, color: C.gold })
  T(`Gen: ${new Date().toLocaleDateString('de-DE')}`, PW - MR - 112, PH - 88, { size: 7, color: rgb(0.70, 0.78, 0.88) })

  y = PH - 128

  // Meta row
  rect(ML, y - 22, CW, 22, rgb(0.95, 0.96, 0.98))
  hline(ML, y - 22, ML + CW, y - 22, C.grayLight)
  T(`Generisao: ${user.full_name}  ·  Uloga: ${user.role.toUpperCase()}  ·  Sistem: GSE Control v2  ·  Datum generisanja: ${new Date().toLocaleString('de-DE')}`,
    ML + 8, y - 14, { size: 8, color: C.gray })
  y -= 38

  // ══════════════════════════════════════════════════════════════════════════════
  //  KPI TILES (2 rows)
  // ══════════════════════════════════════════════════════════════════════════════
  const row1 = [
    { label: 'UKUPNO OPREME',   value: equipment.length,        color: C.navyLight },
    { label: 'UKUPNO AKTIVN.',  value: assignments.length,      color: C.navyLight },
    { label: 'ZADUZIVANJA',     value: checkouts.length,        color: C.amber     },
    { label: 'RAZDUZIVANJA',    value: checkins.length,         color: C.green     },
  ]
  const row2 = [
    { label: 'BLOKIRANA',       value: blockedCO.length,        color: blockedCO.length > 0 ? C.red : C.green   },
    { label: 'OSTECENJA',       value: damages.length,          color: damages.length > 0 ? C.orange : C.green  },
    { label: 'RIJSENO',         value: resolvedDamages.length,  color: C.green     },
    { label: 'COMPLIANCE',      value: `${compliance}%`,        color: compliance >= 95 ? C.green : compliance >= 80 ? C.amber : C.red },
  ]

  const drawTileRow = (tiles: { label: string; value: number | string; color: ReturnType<typeof rgb> }[]) => {
    const tw = Math.floor(CW / 4) - 3
    tiles.forEach((tile, i) => {
      const tx = ML + i * (tw + 4)
      rect(tx, y - 44, tw, 44, tile.color)
      const vs = String(tile.value)
      const vsz = vs.length > 4 ? 14 : 20
      const vx = tx + tw/2 - (font.widthOfTextAtSize(vs, vsz)/2)
      T(vs, vx, y - 22, { size: vsz, bold: true, color: C.white })
      const lw2 = fontBold.widthOfTextAtSize(tile.label, 6.5)
      T(tile.label, tx + tw/2 - lw2/2, y - 36, { size: 6.5, bold: true, color: C.white })
    })
    y -= 50
  }

  drawTileRow(row1)
  drawTileRow(row2)
  y -= 4

  // ── Highlight stats row ─────────────────────────────────────────────────────
  const hlStats = [
    { label: 'Prosj. aktivnosti/dan', value: String(avgPerDay) },
    { label: 'Najaktivniji dan',      value: peakDay ? `${peakDay.slice(8,10)}.${peakDay.slice(5,7)}.` : '—' },
    { label: 'Akt. vrsnog dana',      value: String(peakCount) },
    { label: 'Odrzavanja',            value: String(maintenanceLogs.length) },
    { label: 'Kriticna ostecenja',    value: String(severityCounts.CRITICAL) },
    { label: 'Veca ostecenja',        value: String(severityCounts.MAJOR) },
  ]
  rect(ML, y - 26, CW, 26, rgb(0.96, 0.97, 0.99))
  hline(ML, y - 26, ML + CW, y - 26, C.grayLight)
  const statW = CW / hlStats.length
  hlStats.forEach((s, i) => {
    const sx = ML + i * statW
    if (i > 0) hline(sx, y - 2, sx, y - 24, C.grayLight)
    T(s.value, sx + statW/2 - fontBold.widthOfTextAtSize(s.value, 11)/2, y - 10, { size: 11, bold: true, color: C.navy })
    T(s.label,  sx + statW/2 - font.widthOfTextAtSize(s.label, 6.5)/2, y - 22, { size: 6.5, color: C.gray })
  })
  y -= 38

  // ══════════════════════════════════════════════════════════════════════════════
  //  1. SAŽETAK
  // ══════════════════════════════════════════════════════════════════════════════
  sectionHeader('1', 'Sazetak — Stanje flote')

  const statusGroups = [
    { status: 'AVAILABLE',      label: 'Dostupno',    color: C.green  },
    { status: 'ASSIGNED',       label: 'U upotrebi',  color: C.amber  },
    { status: 'OUT_OF_SERVICE', label: 'Neispravno',  color: C.red    },
    { status: 'MAINTENANCE',    label: 'Odrzavanje',  color: C.purple },
  ]

  // Mini status bar chart
  const barTotalW = CW - 16
  const eqTotal = equipment.length || 1
  let barX = ML + 8
  statusGroups.forEach(sg => {
    const cnt = equipment.filter(e => e.status === sg.status).length
    const w = Math.max(2, Math.round((cnt / eqTotal) * barTotalW))
    rect(barX, y - 10, w, 10, sg.color)
    barX += w
  })
  y -= 14

  // Legend
  statusGroups.forEach((sg, i) => {
    const cnt = equipment.filter(e => e.status === sg.status).length
    const lx = ML + 8 + i * (CW / 4)
    rect(lx, y - 8, 8, 8, sg.color)
    T(`${sg.label}: ${cnt}`, lx + 11, y - 7, { size: 8, color: C.gray })
  })
  y -= 18

  // ══════════════════════════════════════════════════════════════════════════════
  //  2. AKTIVNOST PO DANU
  // ══════════════════════════════════════════════════════════════════════════════
  guard(40)
  sectionHeader('2', 'Aktivnost po danu')

  // Mini bar chart for daily activity
  const allDays = Array.from(byDay.entries())
  const maxDaily = Math.max(...allDays.map(([, v]) => v.co + v.ci), 1)
  const chartH = 40
  const barWd = Math.floor(CW / allDays.length) - 1

  guard(chartH + 30)

  // Draw bar chart
  allDays.forEach(([, v], i) => {
    const bh = Math.max(1, Math.round(((v.co + v.ci) / maxDaily) * chartH))
    const bx = ML + i * (barWd + 1)
    // co bar
    const coH = Math.round((v.co / maxDaily) * chartH)
    rect(bx, y - chartH, barWd, coH, C.amber)
    // ci bar on top
    const ciH = Math.round((v.ci / maxDaily) * chartH)
    rect(bx, y - chartH + coH, barWd, ciH, C.green)
    // damage dot
    if (v.dmg > 0) {
      page.drawCircle({ x: bx + barWd/2, y: y - chartH + coH + ciH + 3, size: 2, color: C.red })
    }
  })

  // X-axis labels (every 5th day)
  allDays.forEach(([dateStr], i) => {
    if (parseInt(dateStr.slice(8)) % 5 === 1 || i === 0) {
      T(dateStr.slice(8), ML + i * (barWd + 1), y - chartH - 10, { size: 6.5, color: C.gray })
    }
  })

  // Chart legend
  const legendY = y - chartH - 22
  rect(ML, legendY - 6, 8, 8, C.amber); T('Zaduzivanja', ML + 11, legendY, { size: 7, color: C.gray })
  rect(ML + 90, legendY - 6, 8, 8, C.green); T('Razduzivanja', ML + 101, legendY, { size: 7, color: C.gray })
  page.drawCircle({ x: ML + 198, y: legendY - 2, size: 2.5, color: C.red }); T('Ostecenja', ML + 204, legendY, { size: 7, color: C.gray })

  y -= chartH + 36

  // Table with daily data
  guard(50)
  const dayColsConfig = [
    { label: 'DAN',            x: ML,       w: 80  },
    { label: 'ZADUZIVANJA',    x: ML + 80,  w: 100 },
    { label: 'RAZDUZIVANJA',   x: ML + 180, w: 100 },
    { label: 'OSTECENJA',      x: ML + 280, w: 80  },
    { label: 'UKUPNO',         x: ML + 360, w: 80, right: true },
    { label: 'NAPOMENA',       x: ML + 440, w: 60  },
  ]
  tableHeader(dayColsConfig)

  allDays.forEach(([dateStr, v], idx) => {
    guard(14)
    const day = parseInt(dateStr.slice(8))
    const total = v.co + v.ci
    const isWeekend = [0, 6].includes(new Date(dateStr).getDay())
    tableRow([
      { text: `${day}. ${monthName.slice(0,3)} ${year}`, x: ML, w: 80, color: isWeekend ? C.purple : C.black },
      { text: String(v.co), x: ML + 80,  w: 100, color: v.co > 0 ? C.amber : C.gray },
      { text: String(v.ci), x: ML + 180, w: 100, color: v.ci > 0 ? C.green : C.gray },
      { text: String(v.dmg), x: ML + 280, w: 80, color: v.dmg > 0 ? C.red : C.gray },
      { text: String(total), x: ML + 360, w: 80, bold: total > 0, right: true },
      { text: isWeekend ? 'vikend' : '', x: ML + 440, w: 60, color: C.gray },
    ], idx)
  })

  y -= 8

  // ══════════════════════════════════════════════════════════════════════════════
  //  3. TOP OPREMA
  // ══════════════════════════════════════════════════════════════════════════════
  guard(50)
  sectionHeader('3', 'Najkoriscenija oprema (Top 10)', C.navyLight)

  if (topEquipment.length === 0) {
    T('Nema aktivnosti u ovom periodu.', ML + 8, y, { size: 9, color: C.gray })
    y -= 18
  } else {
    const maxAct = topEquipment[0][1]
    const tcols = [
      { label: '#',              x: ML,       w: 22  },
      { label: 'KOD',            x: ML + 22,  w: 55  },
      { label: 'NAZIV',          x: ML + 77,  w: 160 },
      { label: 'TIP',            x: ML + 237, w: 110 },
      { label: 'BR. AKTIVNOSTI', x: ML + 347, w: 90, right: true },
      { label: 'UDIO',           x: ML + 437, w: 63  },
    ]
    tableHeader(tcols)

    topEquipment.forEach(([code, count], idx) => {
      guard(16)
      const eq = equipment.find(e => (e.code || e.equipment_code) === code)
      const pct = Math.round((count / assignments.length) * 100)
      tableRow([
        { text: String(idx + 1), x: ML, w: 22, right: true, color: C.gold, bold: true },
        { text: code, x: ML + 22, w: 55, bold: true, color: C.navyLight },
        { text: (eq?.name || '').slice(0, 38), x: ML + 77, w: 160 },
        { text: (eq?.type || '').slice(0, 26), x: ML + 237, w: 110, color: C.gray },
        { text: String(count), x: ML + 347, w: 90, right: true, bold: true },
        { text: `${pct}%`, x: ML + 437, w: 63, color: pct > 20 ? C.red : C.gray },
      ], idx)
    })
  }

  y -= 8

  // ══════════════════════════════════════════════════════════════════════════════
  //  4. PRIJAVE OŠTEĆENJA
  // ══════════════════════════════════════════════════════════════════════════════
  sectionHeader('4', `Prijave ostecenja — ${damages.length} ukupno`, C.red)

  if (damages.length === 0) {
    T('Nema prijavljenih ostecenja za ovaj period.', ML + 8, y, { size: 9, color: C.green, bold: true })
    y -= 18
  } else {
    // Severity summary pills
    const pills = [
      { label: `KRITICNA: ${severityCounts.CRITICAL}`, color: C.red    },
      { label: `VECA: ${severityCounts.MAJOR}`,         color: C.orange },
      { label: `MANJA: ${severityCounts.MINOR}`,        color: C.amber  },
      { label: `RIJESENA: ${resolvedDamages.length}`,   color: C.green  },
    ]
    pills.forEach((p, i) => {
      const pw2 = 95
      rect(ML + i * (pw2 + 4), y - 16, pw2, 16, p.color)
      const tw2 = fontBold.widthOfTextAtSize(p.label, 8)
      T(p.label, ML + i * (pw2 + 4) + pw2/2 - tw2/2, y - 11, { size: 8, bold: true, color: C.white })
    })
    y -= 22

    damages.forEach((d, idx) => {
      guard(54)
      const sev = d.severity
      const sevColor = sev === 'CRITICAL' ? C.red : sev === 'MAJOR' ? C.orange : C.amber
      const sevLabel = sev === 'CRITICAL' ? 'KRITICNO' : sev === 'MAJOR' ? 'VECE' : 'MANJE'
      const time = new Date(d.createdAt || d.created_at).toLocaleString('de-DE').slice(0, 16)
      const code = d.equipmentCode || d.equipment_code || ''
      const name = (d.equipmentName || d.equipment_name || '').slice(0, 55)
      const who  = d.reportedByName || d.reported_by_name || ''
      const desc = (d.description || '').slice(0, 115)
      const isResolved = !!(d.resolvedAt || d.resolved_at)

      // Header row
      rect(ML, y - 18, 65, 18, sevColor)
      T(sevLabel, ML + 4, y - 12.5, { size: 8, bold: true, color: C.white })
      if (isResolved) { rect(ML + 67, y - 18, 55, 18, C.green); T('RIJESENO', ML + 71, y - 12.5, { size: 8, bold: true, color: C.white }) }
      T(`${String(idx + 1).padStart(2,'0')}.  ${code}  —  ${name}`, ML + (isResolved ? 126 : 72), y - 12.5, { size: 9, bold: true, color: C.navy })
      y -= 20

      T(`Prijavio: ${who}  ·  ${time}`, ML + 8, y, { size: 8, color: C.gray })
      y -= 13
      T(`Opis: ${desc}`, ML + 8, y, { size: 8, maxWidth: CW - 12 })
      y -= 14

      if (d.resolution) {
        T(`Rjesenje: ${d.resolution.slice(0, 110)}`, ML + 8, y, { size: 8, color: C.green, maxWidth: CW - 12 })
        y -= 13
      }
      hline(ML, y, ML + CW, y, C.grayLight)
      y -= 7
    })
  }

  // ══════════════════════════════════════════════════════════════════════════════
  //  5. ODRŽAVANJE
  // ══════════════════════════════════════════════════════════════════════════════
  guard(40)
  sectionHeader('5', `Aktivnosti odrzavanja — EASA Part-145 (${maintenanceLogs.length} ukupno)`, C.purple)

  if (maintenanceLogs.length === 0) {
    T('Nema evidentiranih aktivnosti odrzavanja za ovaj period.', ML + 8, y, { size: 9, color: C.gray })
    y -= 18
  } else {
    const mcols = [
      { label: '#',       x: ML,       w: 22  },
      { label: 'DATUM',   x: ML + 22,  w: 70  },
      { label: 'TIP',     x: ML + 92,  w: 80  },
      { label: 'KOD',     x: ML + 172, w: 50  },
      { label: 'OPIS',    x: ML + 222, w: 200 },
      { label: 'IZVRSIO', x: ML + 422, w: 78  },
    ]
    tableHeader(mcols)

    maintenanceLogs.forEach((m, idx) => {
      guard(16)
      const mdate = new Date(m.performedAt || m.performed_at).toLocaleDateString('de-DE')
      tableRow([
        { text: String(idx + 1), x: ML, w: 22, right: true },
        { text: mdate, x: ML + 22, w: 70, color: C.navy },
        { text: (m.maintenanceType || m.maintenance_type || '').slice(0, 18), x: ML + 92, w: 80, color: C.purple, bold: true },
        { text: (m.equipmentCode || m.equipment_code || '').slice(0, 10), x: ML + 172, w: 50, bold: true, color: C.navyLight },
        { text: (m.description || '').slice(0, 45), x: ML + 222, w: 200, color: C.gray },
        { text: (m.performedBy || m.performed_by || '').slice(0, 18), x: ML + 422, w: 78 },
      ], idx)
    })
  }

  // ══════════════════════════════════════════════════════════════════════════════
  //  CLOSING DECLARATION
  // ══════════════════════════════════════════════════════════════════════════════
  guard(55)
  y -= 10
  hline(ML, y, PW - MR, y, C.gold, 1)
  y -= 16

  rect(ML, y - 36, CW, 36, rgb(0.96, 0.97, 0.99))
  T('IZJAVA O USKLADJENOSTI', ML + 8, y - 10, { size: 9, bold: true, color: C.navy })
  T('Ovaj izvjestaj generisan je automatski iz GSE Control sistema u skladu sa zahtjevima', ML + 8, y - 22, { size: 8, color: C.gray })
  T('IATA AHM 340 standarda za upravljanje zemaljskom opremom i EASA Part-145 zahtjevima za odrzavanje.', ML + 8, y - 32, { size: 8, color: C.gray })
  y -= 44

  T(`Compliance rate za ${monthName} ${year}: ${compliance}%`, ML, y, { size: 9, bold: true, color: compliance >= 95 ? C.green : compliance >= 80 ? C.amber : C.red })
  y -= 13
  T('Digitalno generisan dokument — nije potreban potpis  ·  Rok cuvanja: minimum 5 godina', ML, y, { size: 7.5, color: C.gray })

  // Last page footer
  hline(ML, 38, PW - MR, 38, C.navy, 0.5)
  T('Aerodromi Crne Gore a.d.  ·  GSE Control System  ·  IATA AHM 340 + EASA Part-145 compliant', ML, 26, { size: 7, color: C.gray })
  T(`Strana ${pageNum}`, PW - MR - 30, 26, { size: 7, color: C.gray })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="mjesecni-izvjestaj-${year}-${String(month).padStart(2,'0')}.pdf"`,
    },
  })
}