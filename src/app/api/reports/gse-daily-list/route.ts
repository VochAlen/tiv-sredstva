// src/app/api/reports/gse-daily-list/route.ts
//
// Dnevna lista ispravnosti SVIH sredstava - jedna A4 strana (portrait).
// Ispravno = zelena kvačica, Neispravno = crveni X, Ispravno sa ograničenjem = žuta kvačica (*),
// nepregledano = prazan kvadrat. Dole je prazan prostor za ručna zapažanja i potpise.

import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { getDailyListReport, type DailyListRow, type DailyState } from '@/lib/actions-daily-report'
import { localDate } from '@/lib/local-day'
import {
  W, H, M, NAVY, ACCENT, INK, MUTED, LINE, ZEBRA, GREEN, AMBER, RED, GRAY, WHITE,
  STATE_COLOR as COLOR, STATE_LABEL as LABEL, makeCtx, drawStateIcon as icon, drawHeader, drawKpis, drawRemarksAndFooter, prettyDate,
} from '@/lib/pdf-gse-kit'
import { transliterate as tr } from '@/lib/pdf-utils'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const dept = searchParams.get('department')
  const report = await getDailyListReport(searchParams.get('date') ?? undefined)
  const rows: DailyListRow[] = dept ? report.rows.filter((r) => (r.department ?? 'TEHNICKA_SLUZBA') === dept) : report.rows
  const n = (s: DailyState) => rows.filter((r) => r.state === s).length
  const counts = { total: rows.length, inspected: rows.filter((r) => r.inspectedAt).length, ok: n('OK'), limited: n('LIMITED'), faulty: n('FAULTY'), notInspected: n('NOT_INSPECTED') }

  const pdf = await PDFDocument.create()
  pdf.setTitle(`GSE dnevna lista ispravnosti ${report.date}`)
  pdf.setAuthor('GSE Control - Aerodrom Tivat')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([W, H])
  const c = makeCtx(page, font, bold)
  const { T, fit } = c

  const d = new Date(`${report.date}T12:00:00Z`)
  const weekday = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'cetvrtak', 'petak', 'subota'][d.getUTCDay()]
  const headerBottom = drawHeader(c, {
    title: 'DNEVNA LISTA ISPRAVNOSTI OPREME',
    subtitle: 'Ground Support Equipment (GSE)  |  Daily Serviceability Checklist',
    line3: 'GSE Control  -  Aerodrom Tivat (LYTV)',
    bigRight: prettyDate(report.date),
    smallRight: weekday.toUpperCase(),
    smallRight2: dept ? (dept === 'SLUZBA_PO' ? 'Sluzba zemaljskog opsluzivanja' : 'Tehnicka sluzba') : undefined,
  })

  const kTop = headerBottom - 9
  const kBottom = drawKpis(c, kTop, [
    ['UKUPNO', counts.total, NAVY], ['PREGLEDANO', counts.inspected, ACCENT], ['ISPRAVNO', counts.ok, GREEN],
    ['SA OGRANICENJEM', counts.limited, AMBER], ['NEISPRAVNO', counts.faulty, RED], ['NIJE PREGLEDANO', counts.notInspected, GRAY],
  ])

  // ---------- Tabela (2 ili 3 kolone, jedna strana) ----------
  const tableTop = kBottom - 10
  const tableBottom = 236
  const avail = tableTop - 13 - tableBottom
  let cols = 2
  if (Math.ceil(rows.length / 2) * 8.2 > avail) cols = 3
  const perCol = Math.max(1, Math.ceil(rows.length / cols))
  const rowH = Math.min(11, avail / perCol)
  const fs = Math.max(5.2, Math.min(7.2, rowH * 0.68))
  const gap = 14
  const colW = (W - 2 * M - gap * (cols - 1)) / cols
  const codeW = cols === 2 ? 44 : 36
  const stateW = cols === 2 ? 58 : 50

  for (let ci = 0; ci < cols; ci++) {
    const x0 = M + ci * (colW + gap)
    page.drawRectangle({ x: x0, y: tableTop - 11, width: colW, height: 11, color: NAVY })
    T('SIFRA', x0 + 4, tableTop - 8, 6, bold, WHITE)
    T('SREDSTVO', x0 + codeW + 4, tableTop - 8, 6, bold, WHITE)
    T('STANJE', x0 + colW - stateW + 12, tableTop - 8, 6, bold, WHITE)
    rows.slice(ci * perCol, (ci + 1) * perCol).forEach((r, i) => {
      const yTop = tableTop - 13 - i * rowH
      if (i % 2 === 0) page.drawRectangle({ x: x0, y: yTop - rowH, width: colW, height: rowH, color: ZEBRA })
      const yText = yTop - rowH / 2 - fs * 0.33
      T(fit(r.code, bold, fs, codeW - 4), x0 + 4, yText, fs, bold, NAVY)
      T(fit(r.name, font, fs, colW - codeW - stateW - 6), x0 + codeW + 4, yText, fs, font, INK)
      const s = Math.min(8, rowH * 0.78)
      icon(page, r.state, x0 + colW - stateW + 2, yTop - rowH / 2 - s / 2, s)
      T(LABEL[r.state], x0 + colW - stateW + 4 + s + 2, yText, Math.min(fs, 6.4), r.state === 'FAULTY' ? bold : font, COLOR[r.state])
    })
    page.drawRectangle({ x: x0, y: tableTop - 13 - perCol * rowH, width: colW, height: 0.5, color: LINE })
  }

  // ---------- Legenda + automatske napomene ----------
  let y = tableTop - 13 - perCol * rowH - 12
  let lx = M
  ;(['OK', 'LIMITED', 'FAULTY', 'NOT_INSPECTED'] as DailyState[]).forEach((st) => {
    icon(page, st, lx, y - 1, 7)
    const label = st === 'OK' ? 'Ispravno' : st === 'LIMITED' ? 'Ispravno sa ogranicenjem (*)' : st === 'FAULTY' ? 'Neispravno / van upotrebe' : 'Nije pregledano'
    T(label, lx + 10, y, 6.5, font, MUTED)
    lx += 12 + font.widthOfTextAtSize(tr(label), 6.5) + 14
  })
  y -= 11

  const faulty = rows.filter((r) => r.state === 'FAULTY').map((r) => r.code)
  const limited = rows.filter((r) => r.state === 'LIMITED' || r.restrictions.length > 0)
    .map((r) => `${r.code} (${r.restrictions.map((x) => x.label.replace(/^Koristiti\s+/i, '')).join(', ') || 'manji nedostaci'})`)
  const BOX_BOTTOM = 80, BOX_TOP = 166
  const wrap = (label: string, items: string[], color: typeof RED, maxLines: number) => {
    if (items.length === 0 || maxLines < 1) return
    const lw = bold.widthOfTextAtSize(label, 6.5) + 4
    const maxW = W - 2 * M - lw
    const words = tr(items.join(', ')).split(' ')
    const lines: string[] = []
    let line = ''
    for (const w of words) {
      const next = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(next, 6.5) > maxW) { lines.push(line); line = w } else line = next
    }
    if (line) lines.push(line)
    const shown = lines.slice(0, maxLines)
    if (lines.length > maxLines) shown[maxLines - 1] = fit(shown[maxLines - 1] + ' ...', font, 6.5, maxW)
    shown.forEach((l, i) => { if (i === 0) T(label, M, y, 6.5, bold, color); T(l, M + lw, y, 6.5, font, INK); y -= 8.5 })
  }
  const linesLeft = () => Math.max(0, Math.floor((y - (BOX_TOP + 16)) / 8.5))
  wrap('NEISPRAVNO:', faulty, RED, Math.min(2, linesLeft()))
  wrap('OGRANICENJA:', limited, AMBER, linesLeft())

  drawRemarksAndFooter(c, {
    boxTop: BOX_TOP, boxBottom: BOX_BOTTOM,
    generatedBy: user.full_name || user.email,
    generatedAt: `${prettyDate(localDate(new Date()))} ${new Date().toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Podgorica' })}`,
  })

  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="gse-dnevna-lista-${report.date}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
