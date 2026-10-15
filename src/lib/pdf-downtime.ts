// Crtanje PDF-a "Izvještaj o zastojima" (odvojeno od rute da se može testirati bez baze).
//
// Mjesečni izvještaj o zastojima sredstava (A4, jedna strana): prosječno vrijeme popravke, raspoloživost po sredstvu,
// kvarovi po tipu/kategoriji i najčešći uzroci. Za menadžment i pregled sigurnosti (SMS).

import { PDFDocument, StandardFonts } from 'pdf-lib'
import type { DowntimeStats } from '@/lib/downtime'
import { EQUIPMENT_TYPE_LABELS } from '@/lib/types'
import {
  W, H, M, NAVY, ACCENT, INK, MUTED, LINE, ZEBRA, GREEN, AMBER, RED, GRAY,
  makeCtx, drawHeader, drawKpis, drawSectionTitle, drawTableHead, drawRemarksAndFooter,
} from '@/lib/pdf-gse-kit'
import { transliterate as tr } from '@/lib/pdf-utils'

const MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar']
const hoursText = (h: number | null) => (h == null ? '-' : h >= 48 ? `${Math.round((h / 24) * 10) / 10} dana` : `${h} h`)

export async function buildDowntimePdf(st: DowntimeStats, generatedBy: string): Promise<Uint8Array> {
  const month = st.month
  const fleetSize = st.fleetSize
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Zastoji sredstava ${month}`)
  pdf.setAuthor('GSE Control - Aerodrom Tivat')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([W, H])
  const c = makeCtx(page, font, bold)
  const { T, TR, fit } = c

  let y = drawHeader(c, {
    title: 'IZVJESTAJ O ZASTOJIMA SREDSTAVA',
    subtitle: 'Equipment Downtime Report  |  Vehicle maintenance, ADR.OPS.C.007',
    line3: 'GSE Control  -  Aerodrom Tivat (LYTV)',
    bigRight: month,
    smallRight: `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}.`,
    smallRight2: `Flota: ${fleetSize} sredstava`,
  })

  y -= 10
  y = drawKpis(c, y, [
    ['PRIJAVLJENO KVAROVA', st.reported, NAVY], ['RIJESENO', st.resolved, GREEN], ['JOS OTVORENO', st.stillOpen, st.stillOpen ? AMBER : GREEN],
    ['PROSJECNA POPRAVKA', hoursText(st.mttrHours), ACCENT], ['PROSJECNA REAKCIJA', hoursText(st.reactionHours), ACCENT],
    ['RASPOLOZIVOST FLOTE', st.fleetAvailabilityPct == null ? '-' : `${st.fleetAvailabilityPct}%`, st.fleetAvailabilityPct != null && st.fleetAvailabilityPct < 95 ? RED : GREEN],
  ]) - 8
  T('Zastoj = vrijeme dok je otvoren kvar tezine MAJOR/CRITICAL (sredstvo blokirano). Popravka = od preuzimanja kvara do povratka u rad. Reakcija = od prijavljivanja do preuzimanja.', M, y, 6.3, font, MUTED)
  T(`Prosjecno vrijeme u radionici (dovezeno -> rijeseno): ${hoursText(st.workshopHours)}.`, M, y - 8, 6.3, font, MUTED)
  y -= 28

  // ---- Raspoloživost po sredstvu ----
  const ROW = 11
  y = drawSectionTitle(c, 'RASPOLOZIVOST PO SREDSTVU (najveci zastoj prvo)', y) + 4
  const cols = [{ label: 'SREDSTVO', x: M + 4 }, { label: 'NAZIV', x: M + 70 }, { label: 'KVAROVA', x: M + 330 }, { label: 'ZASTOJ (h)', x: M + 390 }, { label: 'RASPOLOZIVOST', x: M + 460 }]
  y = drawTableHead(c, y, cols)
  if (st.byEquipment.length === 0) { T('Nema kvarova ni zastoja u ovom mjesecu.', M + 4, y - 8, 7, font, MUTED); y -= ROW + 8 }
  st.byEquipment.slice(0, 18).forEach((r, i) => {
    if (i % 2 === 0) page.drawRectangle({ x: M, y: y - ROW, width: W - 2 * M, height: ROW, color: ZEBRA })
    const yt = y - ROW + 3.2
    T(r.code, cols[0].x, yt, 6.8, bold, INK)
    T(fit(r.name, font, 6.8, 250), cols[1].x, yt, 6.8, font, INK)
    T(String(r.faults), cols[2].x, yt, 6.8, font, INK)
    T(String(r.downtimeHours), cols[3].x, yt, 6.8, font, INK)
    T(`${r.availabilityPct}%`, cols[4].x, yt, 6.8, bold, r.availabilityPct < 90 ? RED : r.availabilityPct < 98 ? AMBER : GREEN)
    y -= ROW
  })
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.4, color: LINE })
  y -= 16

  // ---- Tri male tabele jedna do druge ----
  const colW = (W - 2 * M - 20) / 3
  const small = (title: string, x: number, items: Array<{ label: string; count: number }>) => {
    let yy = y
    T(title, x, yy, 7.5, bold, NAVY)
    page.drawLine({ start: { x, y: yy - 3 }, end: { x: x + colW, y: yy - 3 }, thickness: 0.6, color: ACCENT })
    yy -= 14
    if (items.length === 0) T('Nema podataka.', x, yy, 7, font, MUTED)
    const max = Math.max(1, ...items.map((i) => i.count))
    items.forEach((it) => {
      T(fit(it.label, font, 7, colW - 24), x, yy, 7, font, INK)
      TR(String(it.count), x + colW, yy, 7, bold, INK)
      page.drawRectangle({ x, y: yy - 4.5, width: colW, height: 2, color: ZEBRA })
      page.drawRectangle({ x, y: yy - 4.5, width: (colW * it.count) / max, height: 2, color: ACCENT })
      yy -= 15
    })
  }
  small('KVAROVI PO TIPU SREDSTVA', M, st.byType.map((t) => ({ label: (EQUIPMENT_TYPE_LABELS as Record<string, string>)[t.label] ?? t.label, count: t.count })))
  small('KVAROVI PO KATEGORIJI', M + colW + 10, st.byCategory)
  small('NAJCESCI UZROCI', M + 2 * (colW + 10), st.topCauses)

  drawRemarksAndFooter(c, {
    boxTop: 170, boxBottom: 80,
    generatedBy: generatedBy,
    generatedAt: new Date().toLocaleString('hr-HR', { timeZone: 'Europe/Podgorica' }),
    right: `Zastoji ${tr(month)}  |  EASA ADR.OPS.C.007`,
    remarksTitle: 'ZAKLJUCCI / MJERE (pregled sigurnosti)',
    sigLabels: ['Sastavio / Prepared by (ime i potpis)', 'Sef sluzbe / Approved by (potpis i pecat)'],
  })

  return await pdf.save()
}
