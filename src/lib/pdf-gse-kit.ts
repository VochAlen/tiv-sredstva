// Zajednički dizajn za A4 izvještaje (dnevna lista svih sredstava, karton pojedinačnog sredstva).
// Jedno mjesto za boje, zaglavlje, KPI traku, ikone stanja, okvir za zapažanja i podnožje.

import { rgb, LineCapStyle, type PDFFont, type PDFPage } from 'pdf-lib'
import { transliterate as tr } from '@/lib/pdf-utils'

export const W = 595.28
export const H = 841.89
export const M = 28

export const NAVY = rgb(0.06, 0.16, 0.3)
export const ACCENT = rgb(0.0, 0.62, 0.62)
export const INK = rgb(0.12, 0.14, 0.18)
export const MUTED = rgb(0.45, 0.48, 0.53)
export const LINE = rgb(0.82, 0.85, 0.88)
export const ZEBRA = rgb(0.955, 0.965, 0.975)
export const GREEN = rgb(0.09, 0.55, 0.25)
export const AMBER = rgb(0.85, 0.5, 0.05)
export const RED = rgb(0.84, 0.13, 0.13)
export const GRAY = rgb(0.6, 0.63, 0.67)
export const WHITE = rgb(1, 1, 1)
type Color = ReturnType<typeof rgb>

export type ReportState = 'OK' | 'LIMITED' | 'FAULTY' | 'NOT_INSPECTED'
export const STATE_COLOR: Record<ReportState, Color> = { OK: GREEN, LIMITED: AMBER, FAULTY: RED, NOT_INSPECTED: GRAY }
export const STATE_LABEL: Record<ReportState, string> = { OK: 'Ispravno', LIMITED: 'Ispravno*', FAULTY: 'Neispravno', NOT_INSPECTED: 'Nije pregl.' }

export interface Ctx {
  page: PDFPage
  font: PDFFont
  bold: PDFFont
  T: (s: string, x: number, y: number, size: number, f?: PDFFont, color?: Color) => void
  TR: (s: string, xRight: number, y: number, size: number, f?: PDFFont, color?: Color) => void
  fit: (text: string, f: PDFFont, size: number, maxW: number) => string
}

export function makeCtx(page: PDFPage, font: PDFFont, bold: PDFFont): Ctx {
  return {
    page, font, bold,
    T: (s, x, y, size, f = font, color = INK) => page.drawText(tr(s), { x, y, size, font: f, color }),
    TR: (s, xRight, y, size, f = font, color = INK) =>
      page.drawText(tr(s), { x: xRight - f.widthOfTextAtSize(tr(s), size), y, size, font: f, color }),
    fit: (text, f, size, maxW) => {
      let t = tr(text)
      if (f.widthOfTextAtSize(t, size) <= maxW) return t
      while (t.length > 1 && f.widthOfTextAtSize(t + '..', size) > maxW) t = t.slice(0, -1)
      return t.trimEnd() + '..'
    },
  }
}

export function drawStateIcon(page: PDFPage, state: ReportState, x: number, y: number, s: number) {
  const c = STATE_COLOR[state]
  if (state === 'OK' || state === 'LIMITED') {
    page.drawLine({ start: { x, y: y + s * 0.5 }, end: { x: x + s * 0.35, y: y + s * 0.12 }, thickness: 1.5, color: c, lineCap: LineCapStyle.Round })
    page.drawLine({ start: { x: x + s * 0.35, y: y + s * 0.12 }, end: { x: x + s, y: y + s * 0.95 }, thickness: 1.5, color: c, lineCap: LineCapStyle.Round })
  } else if (state === 'FAULTY') {
    page.drawLine({ start: { x: x + s * 0.08, y: y + s * 0.05 }, end: { x: x + s * 0.92, y: y + s * 0.95 }, thickness: 1.7, color: c, lineCap: LineCapStyle.Round })
    page.drawLine({ start: { x: x + s * 0.08, y: y + s * 0.95 }, end: { x: x + s * 0.92, y: y + s * 0.05 }, thickness: 1.7, color: c, lineCap: LineCapStyle.Round })
  } else {
    page.drawRectangle({ x: x + s * 0.1, y: y + s * 0.1, width: s * 0.8, height: s * 0.8, borderColor: c, borderWidth: 0.7 })
  }
}

export const prettyDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`

/** Tamna traka sa naslovom (lijevo) i velikim tekstom (desno). Visina trake = 56. */
export function drawHeader(c: Ctx, o: { title: string; subtitle: string; line3: string; bigRight: string; smallRight: string; smallRight2?: string }) {
  const bandH = 56
  c.page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: NAVY })
  c.page.drawRectangle({ x: 0, y: H - bandH - 3, width: W, height: 3, color: ACCENT })
  c.T(o.title, M, H - 24, 16, c.bold, WHITE)
  c.T(o.subtitle, M, H - 37, 8, c.font, rgb(0.72, 0.8, 0.9))
  c.T(o.line3, M, H - 48, 7.5, c.font, rgb(0.55, 0.68, 0.8))
  c.TR(o.bigRight, W - M, H - 28, 20, c.bold, WHITE)
  c.TR(o.smallRight, W - M, H - 40, 8, c.font, rgb(0.72, 0.8, 0.9))
  if (o.smallRight2) c.TR(o.smallRight2, W - M, H - 51, 7.5, c.font, rgb(0.55, 0.68, 0.8))
  return H - bandH - 3
}

/** KPI traka; vraća y donje ivice. */
export function drawKpis(c: Ctx, top: number, items: Array<[string, string | number, Color]>): number {
  const kH = 30, gap = 5
  const kW = (W - 2 * M - gap * (items.length - 1)) / items.length
  items.forEach(([label, val, color], i) => {
    const x = M + i * (kW + gap)
    c.page.drawRectangle({ x, y: top - kH, width: kW, height: kH, color: ZEBRA })
    c.page.drawRectangle({ x, y: top - kH, width: 3, height: kH, color })
    c.T(String(val), x + 9, top - 18, 14, c.bold, color)
    c.T(label, x + 9, top - 26, 5.8, c.bold, MUTED)
  })
  return top - kH
}

/** Naslov sekcije sa tankom linijom. Vraća y ispod naslova. */
export function drawSectionTitle(c: Ctx, text: string, y: number): number {
  c.T(text, M, y, 7.5, c.bold, NAVY)
  c.page.drawLine({ start: { x: M, y: y - 3 }, end: { x: W - M, y: y - 3 }, thickness: 0.6, color: ACCENT })
  return y - 10
}

/** Zaglavlje tabele (tamna traka) sa kolonama [{label, x}]. */
export function drawTableHead(c: Ctx, y: number, cols: Array<{ label: string; x: number }>): number {
  c.page.drawRectangle({ x: M, y: y - 11, width: W - 2 * M, height: 11, color: NAVY })
  cols.forEach((col) => c.T(col.label, col.x, y - 8, 6, c.bold, WHITE))
  return y - 11
}

/** Prazan okvir za ručna zapažanja + potpisi + podnožje. */
export function drawRemarksAndFooter(c: Ctx, o: { boxTop: number; boxBottom: number; generatedBy: string; generatedAt: string; right?: string; remarksTitle?: string; sigLabels?: [string, string] }) {
  c.T(o.remarksTitle ?? 'ZAPAZANJA / REMARKS', M, o.boxTop - 6, 7.5, c.bold, NAVY)
  c.page.drawRectangle({ x: M, y: o.boxBottom, width: W - 2 * M, height: o.boxTop - 12 - o.boxBottom, borderColor: LINE, borderWidth: 0.8 })
  for (let ly = o.boxTop - 12 - 13; ly > o.boxBottom + 3; ly -= 13) {
    c.page.drawLine({ start: { x: M + 6, y: ly }, end: { x: W - M - 6, y: ly }, thickness: 0.4, color: LINE })
  }
  const sigY = 62
  const half = (W - 2 * M - 30) / 2
  ;([[o.sigLabels?.[0] ?? 'Pregledao / Checked by (ime i potpis)', M], [o.sigLabels?.[1] ?? 'Sef sluzbe / Approved by (potpis i pecat)', M + half + 30]] as Array<[string, number]>).forEach(([label, x]) => {
    c.page.drawLine({ start: { x, y: sigY }, end: { x: x + half, y: sigY }, thickness: 0.6, color: INK })
    c.T(label, x, sigY - 9, 6.5, c.font, MUTED)
  })
  c.page.drawLine({ start: { x: M, y: 30 }, end: { x: W - M, y: 30 }, thickness: 0.4, color: LINE })
  c.T(`Generisano iz GSE Control: ${o.generatedBy}, ${o.generatedAt}`, M, 20, 6.5, c.font, MUTED)
  c.TR(o.right ?? 'Aerodrom Tivat  |  EASA ADR.OPS.C.007', W - M, 20, 6.5, c.font, MUTED)
}
