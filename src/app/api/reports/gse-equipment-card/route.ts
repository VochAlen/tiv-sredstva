// src/app/api/reports/gse-equipment-card/route.ts
//
// Karton ispravnosti POJEDINAČNOG sredstva - jedna A4 strana (portrait), isti dizajn kao dnevna lista.
// Sadrži: podatke o sredstvu i trenutno stanje (+ograničenja), traku pregleda po danima,
// zadnje dnevne preglede sa neispravnim stavkama, kvarove/popravke i evidenciju održavanja,
// prazan okvir za ručna zapažanja i potpise.

import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { getEquipmentReport, type DailyState } from '@/lib/actions-daily-report'
import { localDate } from '@/lib/local-day'
import { EQUIPMENT_TYPE_LABELS } from '@/lib/types'
import {
  W, H, M, NAVY, ACCENT, INK, MUTED, LINE, ZEBRA, GREEN, AMBER, RED, GRAY, WHITE,
  STATE_COLOR, STATE_LABEL, makeCtx, drawStateIcon, drawHeader, drawKpis, drawSectionTitle, drawTableHead, drawRemarksAndFooter, prettyDate,
} from '@/lib/pdf-gse-kit'
import { transliterate as tr } from '@/lib/pdf-utils'

const STATUS_LABEL: Record<string, { text: string; color: typeof GREEN }> = {
  AVAILABLE: { text: 'DOSTUPNO', color: GREEN },
  ASSIGNED: { text: 'ZADUZENO', color: AMBER },
  OUT_OF_SERVICE: { text: 'NEISPRAVNO', color: RED },
  MAINTENANCE: { text: 'NA ODRZAVANJU', color: AMBER },
}
const SEV: Record<string, string> = { MINOR: 'Manje', MAJOR: 'Vece', CRITICAL: 'Kriticno' }
const DMG_STATUS: Record<string, string> = { OPEN: 'Otvoreno', IN_REPAIR: 'U popravci', AWAITING_APPROVAL: 'Ceka odobrenje', RESOLVED: 'Rijeseno' }
const MNT_TYPE: Record<string, string> = { PREVENTIVE: 'Preventivno', CORRECTIVE: 'Korektivno', INSPECTION: 'Inspekcija', OVERHAUL: 'Remont' }
const MNT_STATUS: Record<string, string> = { SCHEDULED: 'Zakazano', IN_PROGRESS: 'U toku', COMPLETED: 'Zavrseno', CANCELLED: 'Otkazano' }
const DEPT: Record<string, string> = { TEHNICKA_SLUZBA: 'Tehnicka sluzba', SLUZBA_PO: 'Sluzba zemaljskog opsluzivanja' }

const dmy = (iso: string) => {
  const d = new Date(iso)
  const loc = localDate(d)
  return `${loc.slice(8, 10)}.${loc.slice(5, 7)}.${loc.slice(2, 4)}`
}
const hm = (iso: string) => new Date(iso).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Podgorica' })
const SHIFT: Record<string, string> = { MORNING: 'Jutro', AFTERNOON: 'Popodne', NIGHT: 'Noc' }

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const code = (searchParams.get('code') ?? '').trim()
  if (!code) return new NextResponse('Missing code', { status: 400 })
  const rep = await getEquipmentReport(code, Number(searchParams.get('days') ?? 30))
  if (!rep) return new NextResponse('Equipment not found', { status: 404 })
  const eq = rep.equipment

  const pdf = await PDFDocument.create()
  pdf.setTitle(`Karton sredstva ${eq.code}`)
  pdf.setAuthor('GSE Control - Aerodrom Tivat')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([W, H])
  const c = makeCtx(page, font, bold)
  const { T, TR, fit } = c

  let y = drawHeader(c, {
    title: 'KARTON ISPRAVNOSTI SREDSTVA',
    subtitle: 'Equipment Serviceability Record  |  ADR.OPS.C.007',
    line3: 'GSE Control  -  Aerodrom Tivat (LYTV)',
    bigRight: eq.code,
    smallRight: `Period ${prettyDate(rep.from)} - ${prettyDate(rep.to)}`,
    smallRight2: eq.department ? DEPT[eq.department] ?? eq.department : undefined,
  })

  // ---------- Identitet + trenutno stanje ----------
  y -= 10
  const idH = 56
  page.drawRectangle({ x: M, y: y - idH, width: W - 2 * M, height: idH, color: ZEBRA })
  const st = STATUS_LABEL[eq.status] ?? { text: eq.status, color: GRAY }
  page.drawRectangle({ x: M, y: y - idH, width: 3, height: idH, color: st.color })
  T(fit(eq.name, bold, 13, W - 2 * M - 170), M + 12, y - 18, 13, bold, NAVY)
  const typeLabel = (EQUIPMENT_TYPE_LABELS as Record<string, string>)[eq.type] ?? eq.type
  T(fit(`${typeLabel}   |   S/N: ${eq.serialNumber ?? '-'}   |   Lokacija: ${eq.location}`, font, 7.5, W - 2 * M - 170), M + 12, y - 30, 7.5, font, MUTED)
  if (eq.notes) T(fit(`Napomena: ${eq.notes}`, font, 7, W - 2 * M - 170), M + 12, y - 41, 7, font, MUTED)
  // pill sa stanjem
  const pillW = bold.widthOfTextAtSize(st.text, 11) + 22
  page.drawRectangle({ x: W - M - pillW - 8, y: y - 28, width: pillW, height: 20, color: st.color })
  T(st.text, W - M - pillW + 3, y - 22, 11, bold, WHITE)
  // ograničenja
  if (eq.restrictions.length > 0) {
    const txt = 'OGRANICENJE: ' + eq.restrictions.map((r) => r.label).join(' | ')
    page.drawRectangle({ x: M + 12, y: y - idH + 3, width: W - 2 * M - 24, height: 11, color: rgb255(253, 230, 170), borderColor: AMBER, borderWidth: 0.6 })
    T(fit(txt, bold, 7, W - 2 * M - 36), M + 17, y - idH + 6, 7, bold, rgb255(120, 70, 0))
  }
  y -= idH + 10

  // ---------- KPI ----------
  const k = rep.counts
  y = drawKpis(c, y, [
    ['DANA PREGLEDANO', `${k.daysInspected}/${rep.days}`, ACCENT], ['ISPRAVNO (DANA)', k.ok, GREEN], ['SA OGRANICENJEM', k.limited, AMBER],
    ['NEISPRAVNO (DANA)', k.faulty, RED], ['NIJE PREGLEDANO', k.daysNotInspected, GRAY], ['OTVORENI KVAROVI', k.openDamages, k.openDamages ? RED : GREEN],
  ]) - 12

  // ---------- Traka pregleda po danima ----------
  y = drawSectionTitle(c, `ISTORIJA PREGLEDA - POSLJEDNJIH ${rep.days} DANA`, y) - 4
  const gap = 1.5
  const sw = (W - 2 * M - gap * (rep.days - 1)) / rep.days
  rep.strip.forEach((d, i) => {
    const x = M + i * (sw + gap)
    const col = d.state === 'NOT_INSPECTED' ? rgb255(226, 229, 233) : STATE_COLOR[d.state]
    page.drawRectangle({ x, y: y - 14, width: sw, height: 14, color: col })
  })
  T(prettyDate(rep.from), M, y - 23, 6, font, MUTED)
  TR(prettyDate(rep.to), W - M, y - 23, 6, font, MUTED)
  let lx = M + 150
  ;(['OK', 'LIMITED', 'FAULTY', 'NOT_INSPECTED'] as DailyState[]).forEach((s) => {
    page.drawRectangle({ x: lx, y: y - 23, width: 7, height: 7, color: s === 'NOT_INSPECTED' ? rgb255(226, 229, 233) : STATE_COLOR[s] })
    const label = s === 'OK' ? 'Ispravno' : s === 'LIMITED' ? 'Sa ogranicenjem' : s === 'FAULTY' ? 'Neispravno' : 'Nije pregledano'
    T(label, lx + 10, y - 22, 6.3, font, MUTED)
    lx += 16 + font.widthOfTextAtSize(label, 6.3) + 10
  })
  y -= 36

  // ---------- Generički prikaz tabele ----------
  type Col = { label: string; x: number; w: number }
  const ROW = 11
  const table = (title: string, cols: Col[], rows: Array<Array<string | { state: DailyState } | { text: string; color?: typeof RED; bold?: boolean }>>, empty: string) => {
    y -= 6
    y = drawSectionTitle(c, title, y) + 4
    y = drawTableHead(c, y, cols.map((cc) => ({ label: cc.label, x: cc.x }))) 
    if (rows.length === 0) { T(empty, M + 4, y - 8, 7, font, MUTED); y -= ROW + 8; return }
    rows.forEach((r, i) => {
      if (i % 2 === 0) page.drawRectangle({ x: M, y: y - ROW, width: W - 2 * M, height: ROW, color: ZEBRA })
      const yt = y - ROW + 3.2
      r.forEach((cell, ci) => {
        const col = cols[ci]
        if (typeof cell === 'string') T(fit(cell, font, 6.8, col.w), col.x, yt, 6.8, font, INK)
        else if ('state' in cell) {
          drawStateIcon(page, cell.state, col.x, y - ROW + 1.8, 7)
          T(STATE_LABEL[cell.state], col.x + 10, yt, 6.6, cell.state === 'FAULTY' ? bold : font, STATE_COLOR[cell.state])
        } else T(fit(cell.text, cell.bold ? bold : font, 6.8, col.w), col.x, yt, 6.8, cell.bold ? bold : font, cell.color ?? INK)
      })
      y -= ROW
    })
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.4, color: LINE })
    y -= 9
  }

  const stateOf = (res: string): DailyState => (res === 'UNFIT' ? 'FAULTY' : res === 'CONDITIONAL' ? 'LIMITED' : 'OK')
  table(
    'DNEVNI PREGLEDI',
    [{ label: 'DATUM / VRIJEME', x: M + 4, w: 70 }, { label: 'SMJENA', x: M + 84, w: 40 }, { label: 'PREGLEDAO/LA', x: M + 130, w: 100 }, { label: 'REZULTAT', x: M + 240, w: 60 }, { label: 'NEISPRAVNE STAVKE', x: M + 310, w: W - 2 * M - 316 }],
    rep.inspections.slice(0, 16).map((i) => [`${dmy(i.at)} ${hm(i.at)}`, SHIFT[i.shift ?? ''] ?? '-', i.inspector, { state: stateOf(i.result) }, i.failed.length ? i.failed.join('; ') : '-']),
    'Nema pregleda u ovom periodu.',
  )
  table(
    'KVAROVI I POPRAVKE',
    [{ label: 'DATUM', x: M + 4, w: 40 }, { label: 'TEZINA', x: M + 50, w: 36 }, { label: 'STATUS', x: M + 92, w: 62 }, { label: 'OPIS (OGRANICENJE / DIJELOVI)', x: M + 160, w: 215 }, { label: 'RADIO / ODOBRIO', x: M + 382, w: W - 2 * M - 388 }],
    rep.damages.slice(0, 7).map((d) => [
      dmy(d.createdAt), { text: SEV[d.severity] ?? d.severity, bold: d.severity === 'CRITICAL', color: d.severity === 'CRITICAL' ? RED : INK },
      DMG_STATUS[d.status] ?? d.status,
      [d.description, d.restriction ? `[${d.restriction}]` : '', d.parts ? `Dijelovi: ${d.parts}` : ''].filter(Boolean).join(' '),
      [d.workers ?? d.repairedBy, d.approvedBy].filter(Boolean).join(' / ') || '-',
    ]),
    'Nema evidentiranih kvarova.',
  )
  table(
    'ODRZAVANJE (EVIDENCIJA)',
    [{ label: 'DATUM', x: M + 4, w: 40 }, { label: 'TIP', x: M + 50, w: 56 }, { label: 'OPIS', x: M + 112, w: 270 }, { label: 'IZVEO/LA', x: M + 388, w: 80 }, { label: 'STATUS', x: M + 474, w: W - 2 * M - 478 }],
    rep.maintenance.slice(0, 6).map((m) => [dmy(m.performedAt), MNT_TYPE[m.type] ?? m.type, m.description, m.performedBy ?? '-', MNT_STATUS[m.status] ?? m.status]),
    'Nema zapisa o odrzavanju.',
  )

  drawRemarksAndFooter(c, {
    boxTop: Math.min(y - 4, 186), boxBottom: 80,
    generatedBy: user.full_name || user.email,
    generatedAt: `${prettyDate(localDate(new Date()))} ${hm(new Date().toISOString())}`,
    right: `Karton sredstva ${tr(eq.code)}  |  EASA ADR.OPS.C.007`,
  })

  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="karton-${eq.code}-${rep.to}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}

const rgb255 = (r: number, g: number, b: number) => rgb(r / 255, g / 255, b / 255)
