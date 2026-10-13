// src/app/api/reports/safety-stats/route.ts
//
// Statistika FOD & Wildlife prijava - A4 portrait, jedna strana, isti dizajn kao ostali GSE izvještaji.
// ?period=1m|3m|6m|12m  (mjesečna / tromjesečna / polugodišnja / godišnja). SAMO admin.

import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { getSafetyStats, type CountRow } from '@/lib/actions-safety-stats'
import { isStatsPeriod, PERIOD_LABEL } from '@/lib/safety-stats-shared'
import { localDate } from '@/lib/local-day'
import {
  W, H, M, NAVY, ACCENT, INK, MUTED, LINE, ZEBRA, GREEN, AMBER, RED, WHITE,
  makeCtx, drawHeader, drawKpis, drawRemarksAndFooter, prettyDate, type Ctx,
} from '@/lib/pdf-gse-kit'

const GAP = 12
const PW = (W - 2 * M - GAP) / 2
const FULL = W - 2 * M

function hex(c: string) {
  const n = parseInt(c.replace('#', ''), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

function panel(c: Ctx, x: number, top: number, w: number, h: number, title: string): number {
  c.page.drawRectangle({ x, y: top - h, width: w, height: h, borderColor: LINE, borderWidth: 0.8 })
  c.page.drawRectangle({ x, y: top - 15, width: w, height: 15, color: NAVY })
  c.T(title, x + 8, top - 10.5, 7.2, c.bold, WHITE)
  return top - 15 - 5
}

/** Horizontalne trake; svaka sa bojom, brojem i opcionim dodatnim tekstom. Vraća y ispod. */
function bars(c: Ctx, x: number, y: number, w: number, rows: Array<CountRow & { extra?: string }>, pitch = 12, labelW = 118): number {
  const max = Math.max(1, ...rows.map((r) => r.count))
  const extraW = rows.some((r) => r.extra) ? 62 : 0
  const trackW = w - 16 - labelW - 24 - extraW
  rows.forEach((r, i) => {
    const yy = y - 9 - i * pitch
    c.T(c.fit(r.label, c.font, 7.2, labelW - 6), x + 8, yy, 7.2, c.font, INK)
    c.page.drawRectangle({ x: x + 8 + labelW, y: yy - 2, width: trackW, height: 7.5, color: ZEBRA })
    if (r.count > 0) c.page.drawRectangle({ x: x + 8 + labelW, y: yy - 2, width: Math.max(2, (r.count / max) * trackW), height: 7.5, color: hex(r.color) })
    c.TR(String(r.count), x + 8 + labelW + trackW + 20, yy, 8, c.bold, INK)
    if (r.extra) c.TR(r.extra, x + w - 8, yy, 6.4, c.font, MUTED)
  })
  return y - rows.length * pitch - 2
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  if (user.role !== 'admin') return new NextResponse('Forbidden: samo admin', { status: 403 })

  const p = new URL(request.url).searchParams.get('period') ?? '3m'
  if (!isStatsPeriod(p)) return new NextResponse('Nepoznat period (1m, 3m, 6m, 12m)', { status: 400 })
  const s = await getSafetyStats(p)

  const pdf = await PDFDocument.create()
  pdf.setTitle(`Statistika FOD & Wildlife - ${PERIOD_LABEL[p]} ${s.from} - ${s.to}`)
  pdf.setAuthor('GSE Control - Aerodrom Tivat')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([W, H])
  const c = makeCtx(page, font, bold)
  const { T, TR, fit } = c

  const headerBottom = drawHeader(c, {
    title: 'STATISTIKA FOD & WILDLIFE',
    subtitle: `${PERIOD_LABEL[p]} statistika  |  ADR.OPS.B.016 / ADR.OPS.B.020`,
    line3: 'GSE Control  -  Aerodrom Tivat (LYTV)',
    bigRight: prettyDate(s.to),
    smallRight: `PERIOD: ${PERIOD_LABEL[p].toUpperCase()}`,
    smallRight2: `${prettyDate(s.from)} - ${prettyDate(s.to)}`,
  })

  const topSpecies = s.species[0]
  const topWx = s.weather.find((w) => w.id !== 'UNKNOWN')
  const kBottom = drawKpis(c, headerBottom - 9, [
    ['UKUPNO PRIJAVA', s.totals.all, NAVY],
    ['FOD', s.totals.fod, AMBER],
    ['WILDLIFE', s.totals.wildlife, GREEN],
    ['SUDARI', s.totals.strikes, s.totals.strikes === 0 ? GREEN : RED],
    ['NAJCESCA VRSTA', topSpecies ? fit(topSpecies.label, bold, 14, 70) : '-', ACCENT],
    ['NAJCESCI USLOVI', topWx ? fit(topWx.label, bold, 14, 70) : '-', ACCENT],
  ])

  const xL = M, xR = M + PW + GAP
  let top = kBottom - 12

  // ---------- Red 1: vrsta prijave | FOD predmeti ----------
  const h1 = 108
  {
    let y = panel(c, xL, top, PW, h1, '1. PO VRSTI PRIJAVE')
    y = bars(c, xL, y, PW, s.byType)
    const d = (cur: number, prev: number) => (prev === 0 ? (cur === 0 ? '0' : `+${cur}`) : `${cur - prev >= 0 ? '+' : ''}${cur - prev} (${cur >= prev ? '+' : ''}${Math.round(((cur - prev) / prev) * 100)}%)`)
    T(`Prethodni isti period:  ukupno ${s.previous.all} (${d(s.totals.all, s.previous.all)})  |  FOD ${s.previous.fod}  |  wildlife ${s.previous.wildlife}  |  sudari ${s.previous.strikes}`, xL + 8, y - 8, 6.2, font, MUTED)
  }
  {
    const top7 = s.fodItems.slice(0, 6)
    const rest = s.fodItems.slice(6).reduce((a, r) => a + r.count, 0)
    const rows = rest > 0 ? [...top7, { id: 'REST', label: 'Ostalo', color: '#d97706', count: rest }] : top7
    const y = panel(c, xR, top, PW, h1, '2. FOD PO VRSTI PREDMETA')
    if (rows.length === 0) T('Nema FOD prijava u periodu.', xR + 8, y - 10, 7.4, font, MUTED)
    else bars(c, xR, y, PW, rows, 11.5, 100)
  }
  top -= h1 + 10

  // ---------- Red 2: vrsta životinje | zone ----------
  const h2 = 152
  {
    const t = s.species.slice(0, 9)
    const rest = s.species.slice(9)
    const rows: Array<CountRow & { extra?: string }> = t.map((r) => ({ ...r, extra: `${r.animals} jed.${r.strikes ? ` / ${r.strikes} sud.` : ''}` }))
    if (rest.length) rows.push({ id: 'REST', label: 'Ostale vrste', color: '#6b7280', count: rest.reduce((a, r) => a + r.count, 0), extra: `${rest.reduce((a, r) => a + r.animals, 0)} jed.` })
    const y = panel(c, xL, top, PW, h2, '3. WILDLIFE PO VRSTI ZIVOTINJE  (prijava / jedinki / sudara)')
    if (rows.length === 0) T('Nema wildlife prijava u periodu.', xL + 8, y - 10, 7.4, font, MUTED)
    else bars(c, xL, y, PW, rows, 12.8, 92)
  }
  {
    const y = panel(c, xR, top, PW, h2, '4. WILDLIFE PO ZONI AERODROMA')
    bars(c, xR, y, PW, s.zones, 12.8, 100)
    const withZone = s.zones.reduce((a, z) => a + z.count, 0)
    if (withZone < s.totals.wildlife) T(`${s.totals.wildlife - withZone} prijava bez oznacene zone (starije prijave).`, xR + 8, y - 6 * 12.8 - 14, 6.2, font, MUTED)
  }
  top -= h2 + 10

  // ---------- Red 3: vremenski uslovi (puna sirina) ----------
  const rowsW = s.weather
  const pitch = 11.2
  const h3 = 15 + 8 + Math.max(1, rowsW.length) * pitch + 18
  {
    const y = panel(c, M, top, FULL, h3, '5. PO VREMENSKIM USLOVIMA  (FOD + wildlife)')
    const max = Math.max(1, ...rowsW.map((r) => r.total))
    const labelW = 96, trackW = FULL - 16 - labelW - 30 - 150
    rowsW.forEach((r, i) => {
      const yy = y - 9 - i * pitch
      T(r.label, M + 8, yy, 7.2, font, INK)
      page.drawRectangle({ x: M + 8 + labelW, y: yy - 2, width: trackW, height: 7, color: ZEBRA })
      const fodW = (r.fod / max) * trackW, wlW = (r.wildlife / max) * trackW
      if (r.fod > 0) page.drawRectangle({ x: M + 8 + labelW, y: yy - 2, width: Math.max(1.5, fodW), height: 7, color: hex('#d97706') })
      if (r.wildlife > 0) page.drawRectangle({ x: M + 8 + labelW + fodW, y: yy - 2, width: Math.max(1.5, wlW), height: 7, color: hex('#059669') })
      TR(String(r.total), M + 8 + labelW + trackW + 24, yy, 8, bold, INK)
      TR(`FOD ${r.fod}  |  wildlife ${r.wildlife}${r.strikes ? `  |  sudari ${r.strikes}` : ''}`, W - M - 8, yy, 6.6, font, MUTED)
    })
    const ly = top - h3 + 6
    page.drawRectangle({ x: M + 8, y: ly, width: 7, height: 6, color: hex('#d97706') }); T('FOD', M + 18, ly, 6.4, font, MUTED)
    page.drawRectangle({ x: M + 44, y: ly, width: 7, height: 6, color: hex('#059669') }); T('Wildlife', M + 54, ly, 6.4, font, MUTED)
    T('"Nije upisano" = starije prijave bez vremenskih uslova', M + 100, ly, 6.4, font, MUTED)
  }
  top -= h3 + 10

  // ---------- Red 4: trend po mjesecima ----------
  const h4 = 92
  {
    const y = panel(c, M, top, FULL, h4, '6. TREND PO MJESECIMA  (FOD + wildlife)')
    const n = s.trend.length
    const maxV = Math.max(1, ...s.trend.map((t) => t.fod + t.wildlife))
    const chartH = h4 - 15 - 30
    const slot = (FULL - 24) / Math.max(1, n)
    const bw = Math.min(26, slot * 0.6)
    const base = top - h4 + 16
    s.trend.forEach((t, i) => {
      const x = M + 12 + i * slot + (slot - bw) / 2
      const hFod = (t.fod / maxV) * chartH, hWl = (t.wildlife / maxV) * chartH
      if (t.fod > 0) page.drawRectangle({ x, y: base, width: bw, height: hFod, color: hex('#d97706') })
      if (t.wildlife > 0) page.drawRectangle({ x, y: base + hFod, width: bw, height: hWl, color: hex('#059669') })
      const tot = t.fod + t.wildlife
      TR(String(tot), x + bw / 2 + font.widthOfTextAtSize(String(tot), 7) / 2, base + hFod + hWl + 3, 7, bold, INK)
      const lab = `${t.month.slice(5, 7)}/${t.month.slice(2, 4)}`
      T(lab, x + bw / 2 - font.widthOfTextAtSize(lab, 6.4) / 2, base - 9, 6.4, font, MUTED)
    })
    page.drawLine({ start: { x: M + 8, y: base }, end: { x: W - M - 8, y: base }, thickness: 0.5, color: LINE })
  }
  top -= h4 + 8

  drawRemarksAndFooter(c, {
    boxTop: Math.max(120, top), boxBottom: 80,
    generatedBy: user.full_name || user.email,
    generatedAt: `${prettyDate(localDate(new Date()))} ${new Date().toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Podgorica' })}`,
    remarksTitle: 'ZAPAZANJA / ZAKLJUCCI / REMARKS',
    sigLabels: ['Pripremio / Prepared by (ime i potpis)', 'Odobrio / Approved by (potpis i pecat)'],
    right: 'ADR.OPS.B.016 / B.020  |  Aerodrom Tivat',
  })

  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="statistika-fod-wildlife-${p}-${s.to}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
