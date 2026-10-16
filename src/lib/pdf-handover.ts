// A4 "Primopredaja smjene - radionica": stanje radionice + napomene za sljedeću smjenu + potpisi.
// Crta se u pregledniku (bez servera); ne čuva se ništa - napomene su samo na odštampanom papiru.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { W, H, M, NAVY, ACCENT, INK, MUTED, LINE, ZEBRA, RED, WHITE, makeCtx } from '@/lib/pdf-gse-kit'
import { transliterate as tr } from '@/lib/pdf-utils'

export interface HandoverRow {
  code: string
  name: string
  stage: string
  days: number | null
  status: string
  who: string
  stale: boolean
}
export interface HandoverInput {
  by: string
  at: Date
  newFaults: HandoverRow[]
  inWorkshop: HandoverRow[]
  notes: string
}

export async function buildHandoverPdf(inp: HandoverInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle('Primopredaja smjene - radionica')
  pdf.setAuthor('GSE Control - Aerodrom Tivat')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([W, H])
  const { T, fit } = makeCtx(page, font, bold)

  page.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: NAVY })
  T('PRIMOPREDAJA SMJENE - RADIONICA', M, H - 34, 20, bold, WHITE)
  T(`${inp.at.toLocaleString('hr-HR', { timeZone: 'Europe/Podgorica' })}   |   Sastavio/la: ${inp.by}`, M, H - 54, 10.5, font, rgb(0.8, 0.9, 0.95))

  let y = H - 92
  const MAXROWS = 11
  const table = (title: string, rows: HandoverRow[], color = NAVY) => {
    T(`${title} (${rows.length})`, M, y, 12, bold, color)
    page.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, thickness: 1, color: ACCENT })
    y -= 30
    if (rows.length === 0) { T('Nema.', M + 4, y, 10, font, MUTED); y -= 18; return }
    rows.slice(0, MAXROWS).forEach((r, i) => {
      if (i % 2 === 0) page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 24, color: ZEBRA })
      T(r.code, M + 4, y + 7, 10, bold, INK)
      T(fit(r.name, font, 10, 150), M + 62, y + 7, 10, font, INK)
      T(fit(r.stage + (r.days != null ? ` (${r.days} d)` : ''), font, 9, 150), M + 222, y + 7, 9, bold, r.stale ? RED : INK)
      T(fit(r.status || '-', font, 8.5, W - 2 * M - 380), M + 376, y + 7, 8.5, font, MUTED)
      T(fit(r.who ? `Preuzeo/la: ${r.who}` : '', font, 8, W - 2 * M - 220), M + 222, y - 2, 8, font, MUTED)
      y -= 24
    })
    if (rows.length > MAXROWS) { T(`+ još ${rows.length - MAXROWS} (pogledajte aplikaciju)`, M + 4, y + 2, 9, font, MUTED); y -= 14 }
    y -= 8
  }
  table('NOVI KVAROVI - cekaju preuzimanje', inp.newFaults, RED)
  table('SREDSTVA U RADIONICI', inp.inWorkshop)

  // Napomene
  const boxTop = Math.max(y, 190)
  const boxH = boxTop - 110
  T('NAPOMENE ZA SLJEDECU SMJENU', M, boxTop, 12, bold, NAVY)
  page.drawRectangle({ x: M, y: 110, width: W - 2 * M, height: boxH - 8, borderColor: LINE, borderWidth: 1 })
  const words = tr(inp.notes.trim() || '').split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w
    if (font.widthOfTextAtSize(t, 11) > W - 2 * M - 16) { lines.push(cur); cur = w } else cur = t
  }
  if (cur) lines.push(cur)
  const maxLines = Math.floor((boxH - 30) / 15)
  lines.slice(0, maxLines).forEach((l, i) => T(l, M + 8, boxTop - 26 - i * 15, 11, font, INK))

  // Potpisi
  page.drawLine({ start: { x: M, y: 70 }, end: { x: M + 220, y: 70 }, thickness: 0.8, color: INK })
  page.drawLine({ start: { x: W - M - 220, y: 70 }, end: { x: W - M, y: 70 }, thickness: 0.8, color: INK })
  T('Predao/la (ime i potpis)', M, 58, 9, font, MUTED)
  T('Preuzeo/la (ime i potpis)', W - M - 220, 58, 9, font, MUTED)
  T('GSE Control - Aerodrom Tivat (LYTV)', M, 30, 8, font, MUTED)

  return await pdf.save()
}
