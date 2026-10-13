// src/app/api/reports/gse-inspection-report/route.ts
//
// Izvještaj dnevnog pregleda JEDNOG sredstva za JEDAN datum - jedna A4 strana (portrait).
// ?code=<sifra>&date=YYYY-MM-DD   (zadnji pregled tog dana)   ili   ?id=<id pregleda>
// Sadrži: podatke o sredstvu, rezultat, ko je pregledao + datum i vrijeme, SVE stavke checkliste
// (zelena kvačica = ispravno, crveni X = neispravno + posljedica), napomenu pregledača
// i prazan okvir ZAPAZANJA / REMARKS sa potpisima.

import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { getInspectionReport } from '@/lib/actions-daily-report'
import { localDate } from '@/lib/local-day'
import { EQUIPMENT_TYPE_LABELS } from '@/lib/types'
import {
  W, H, M, NAVY, ACCENT, INK, MUTED, LINE, ZEBRA, GREEN, AMBER, RED, GRAY, WHITE,
  makeCtx, drawStateIcon, drawHeader, drawSectionTitle, drawTableHead, drawRemarksAndFooter, prettyDate,
} from '@/lib/pdf-gse-kit'
import { transliterate as tr } from '@/lib/pdf-utils'

const SHIFT: Record<string, string> = { MORNING: 'Jutarnja', AFTERNOON: 'Popodnevna', NIGHT: 'Nocna' }
const DEPT: Record<string, string> = { TEHNICKA_SLUZBA: 'Tehnicka sluzba', SLUZBA_PO: 'Sluzba zemaljskog opsluzivanja' }
const RESULT: Record<string, { text: string; color: typeof GREEN }> = {
  FIT: { text: 'ISPRAVNO', color: GREEN },
  CONDITIONAL: { text: 'ISPRAVNO SA OGRANICENJEM', color: AMBER },
  UNFIT: { text: 'NEISPRAVNO - VAN UPOTREBE', color: RED },
}
const WEEKDAY = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'cetvrtak', 'petak', 'subota']
const hm = (iso: string) => new Date(iso).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Podgorica' })

function plain(status: number, text: string) {
  return new NextResponse(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const code = (searchParams.get('code') ?? '').trim()
  const date = (searchParams.get('date') ?? '').trim()
  const id = (searchParams.get('id') ?? '').trim()
  if (!id && !code) return plain(400, 'Nedostaje sifra sredstva ili ID pregleda.')
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return plain(400, 'Datum mora biti u formatu GGGG-MM-DD.')

  const rep = await getInspectionReport({ code: code || undefined, date: date || undefined, id: id || undefined })
  if (!rep) return plain(404, `Nema dnevnog pregleda${code ? ` za ${code}` : ''}${date ? ` na datum ${prettyDate(date)}` : ''}.`)
  const { equipment: eq, inspection: ins } = rep

  const pdf = await PDFDocument.create()
  pdf.setTitle(`Dnevni pregled ${eq.code} ${rep.date}`)
  pdf.setAuthor('GSE Control - Aerodrom Tivat')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([W, H])
  const c = makeCtx(page, font, bold)
  const { T, TR, fit } = c

  const d = new Date(`${rep.date}T12:00:00Z`)
  let y = drawHeader(c, {
    title: 'DNEVNI PREGLED VOZILA / OPREME',
    subtitle: 'Daily Pre-use Inspection Report  |  ADR.OPS.C.007',
    line3: 'GSE Control  -  Aerodrom Tivat (LYTV)',
    bigRight: prettyDate(rep.date),
    smallRight: WEEKDAY[d.getUTCDay()].toUpperCase(),
    smallRight2: eq.department ? DEPT[eq.department] ?? eq.department : undefined,
  })

  // ---------- Identitet + rezultat ----------
  const res = RESULT[ins.result] ?? { text: ins.result, color: GRAY }
  y -= 10
  const idH = 54
  page.drawRectangle({ x: M, y: y - idH, width: W - 2 * M, height: idH, color: ZEBRA })
  page.drawRectangle({ x: M, y: y - idH, width: 3, height: idH, color: res.color })
  T(fit(eq.name, bold, 14, W - 2 * M - 20), M + 12, y - 19, 14, bold, NAVY)
  const typeLabel = (EQUIPMENT_TYPE_LABELS as Record<string, string>)[eq.type] ?? eq.type
  T(fit(`Sifra: ${eq.code}   |   ${typeLabel}   |   S/N: ${eq.serialNumber ?? '-'}   |   Lokacija: ${eq.location}`, font, 8, W - 2 * M - 20), M + 12, y - 32, 8, font, MUTED)
  const pillTxt = res.text
  const pillW = bold.widthOfTextAtSize(pillTxt, 10) + 20
  page.drawRectangle({ x: M + 12, y: y - 49, width: pillW, height: 14, color: res.color })
  T(pillTxt, M + 22, y - 45, 10, bold, WHITE)
  y -= idH

  // ---------- Ko / kada ----------
  y -= 8
  const cells: Array<[string, string]> = [
    ['PREGLEDAO / INSPECTED BY', ins.inspector + (ins.inspectorCardId ? `  (${ins.inspectorCardId})` : '')],
    ['DATUM', prettyDate(rep.date)],
    ['VRIJEME', hm(ins.at)],
    ['SMJENA', (ins.shift ? SHIFT[ins.shift] ?? ins.shift : '-')],
  ]
  const widths = [0.46, 0.18, 0.14, 0.22]
  const total = W - 2 * M
  let cx = M
  cells.forEach(([label, val], i) => {
    const w = total * widths[i]
    page.drawRectangle({ x: cx, y: y - 30, width: w - 4, height: 30, borderColor: LINE, borderWidth: 0.8 })
    T(label, cx + 7, y - 10, 6, bold, MUTED)
    T(fit(val, bold, 10.5, w - 18), cx + 7, y - 23, 10.5, bold, INK)
    cx += w
  })
  y -= 30
  if (rep.countThatDay > 1) {
    y -= 9
    T(fit(`Napomena: tog dana evidentirano ${rep.countThatDay} pregleda (${[...rep.otherTimes.map(hm), hm(ins.at)].sort().join(', ')}). Prikazan je pregled u ${hm(ins.at)}.`, font, 6.8, total), M, y, 6.8, font, MUTED)
  }

  // ---------- Checklista ----------
  y -= 14
  y = drawSectionTitle(c, 'KONTROLNA LISTA / CHECKLIST', y)
  const colN = M + 6, colItem = M + 26, colState = M + 270, colEff = M + 392
  y = drawTableHead(c, y - 2, [
    { label: '#', x: colN }, { label: 'STAVKA / ITEM', x: colItem }, { label: 'STANJE', x: colState }, { label: 'POSLJEDICA', x: colEff },
  ])
  const items = ins.items
  const BOX_TOP = items.length <= 12 ? 250 : 198, BOX_BOTTOM = 80
  const noteLines = ins.notes ? 2 : 0
  const tableBottom = BOX_TOP + 22 + noteLines * 9
  const rowH = Math.max(10, Math.min(26, (y - tableBottom) / Math.max(1, items.length)))
  const fs = Math.max(6.4, Math.min(10.5, rowH * 0.46))
  items.forEach((it, i) => {
    const top = y - i * rowH
    if (i % 2 === 0) page.drawRectangle({ x: M, y: top - rowH, width: W - 2 * M, height: rowH, color: ZEBRA })
    const yt = top - rowH / 2 - fs * 0.33
    T(String(i + 1), colN, yt, fs, font, MUTED)
    T(fit(it.label, it.passed ? font : bold, fs, colState - colItem - 8), colItem, yt, fs, it.passed ? font : bold, INK)
    const s = Math.min(12, rowH * 0.58)
    drawStateIcon(page, it.passed ? 'OK' : 'FAULTY', colState, top - rowH / 2 - s / 2, s)
    T(it.passed ? 'Ispravno' : 'NEISPRAVNO', colState + s + 4, yt, fs, it.passed ? bold : bold, it.passed ? GREEN : RED)
    if (!it.passed) {
      const eff = it.severity === 'BLOCKING' ? 'Van upotrebe' : it.severity === 'RESTRICTIVE' ? (it.restrictionLabel ?? 'Ograniceno koristenje') : 'Manji nedostatak'
      T(fit(eff, bold, fs - 0.6, W - M - colEff - 4), colEff, yt, fs - 0.6, bold, it.severity === 'BLOCKING' ? RED : AMBER)
    }
  })
  const tEnd = y - items.length * rowH
  page.drawRectangle({ x: M, y: tEnd, width: W - 2 * M, height: 0.5, color: LINE })
  if (items.length === 0) T('Pregled nema upisanih stavki.', M + 6, y - 12, 8, font, MUTED)

  const failed = items.filter((x) => !x.passed).length
  let yy = tEnd - 12
  T(`Ukupno stavki: ${items.length}   |   ispravno: ${items.length - failed}   |   neispravno: ${failed}`, M, yy, 7.5, bold, NAVY)
  if (ins.notes) {
    yy -= 11
    const lines: string[] = []
    let line = ''
    for (const w of tr(`Napomena pregledaca: ${ins.notes}`).split(/\s+/)) {
      const next = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(next, 7) > total) { lines.push(line); line = w } else line = next
    }
    if (line) lines.push(line)
    lines.slice(0, 2).forEach((l, i) => { T(i === 1 && lines.length > 2 ? fit(l + ' ...', font, 7, total) : l, M, yy, 7, font, INK); yy -= 9 })
  }

  drawRemarksAndFooter(c, {
    boxTop: BOX_TOP, boxBottom: BOX_BOTTOM,
    generatedBy: user.full_name || user.email,
    generatedAt: `${prettyDate(localDate(new Date()))} ${hm(new Date().toISOString())}`,
    right: `Pregled ID ${String(ins.id).slice(0, 8)}  |  Aerodrom Tivat`,
  })
  void ACCENT; void H; void TR; void INK

  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="dnevni-pregled-${eq.code}-${rep.date}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
