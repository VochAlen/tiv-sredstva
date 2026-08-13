// src/lib/pdf-report-kit.ts
// Zajednički "kit" za generisanje profesionalnih PDF izvjestaja - letterhead,
// bar-chart helper za statistiku, potpis/certifikacijski blok, numeracija stranica.
// Koriste ga svi /api/reports/* endpointi da izgled bude konzistentan.

import { NextResponse } from 'next/server'
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, RGB } from 'pdf-lib'
import { transliterate } from '@/lib/pdf-utils'

export const PAGE_WIDTH = 595.28
export const PAGE_HEIGHT = 841.89
export const MARGIN = 50

const NAVY = rgb(0.05, 0.25, 0.45)
const GRAY = rgb(0.55, 0.55, 0.55)
const LIGHT_GRAY = rgb(0.7, 0.7, 0.7)
const DARK = rgb(0.15, 0.15, 0.15)

export class ReportBuilder {
  pdfDoc!: PDFDocument
  font!: PDFFont
  fontBold!: PDFFont
  page!: PDFPage
  y = PAGE_HEIGHT - MARGIN

  static async create(): Promise<ReportBuilder> {
    const b = new ReportBuilder()
    b.pdfDoc = await PDFDocument.create()
    b.font = await b.pdfDoc.embedFont(StandardFonts.Helvetica)
    b.fontBold = await b.pdfDoc.embedFont(StandardFonts.HelveticaBold)
    b.page = b.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    return b
  }

  text(str: string, x: number, opts: { size?: number; bold?: boolean; color?: RGB; y?: number } = {}) {
    const { size = 10, bold = false, color = rgb(0, 0, 0), y = this.y } = opts
    try {
      this.page.drawText(transliterate(String(str ?? '')), { x, y, size, font: bold ? this.fontBold : this.font, color })
    } catch {}
  }

  line(dy: number) {
    this.y -= dy
  }

  ensureSpace(needed: number) {
    if (this.y < needed) {
      this.page = this.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      this.y = PAGE_HEIGHT - MARGIN
    }
  }

  hr(color: RGB = LIGHT_GRAY) {
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_WIDTH - MARGIN, y: this.y }, thickness: 0.5, color })
  }

  /** Letterhead na vrhu prve strane — naslov, regulatorna referenca, ko je generisao. */
  header(opts: { title: string; subtitle: string; regRef: string; generatedBy: string; generatedRole: string; extra?: string[] }) {
    this.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: NAVY })
    this.text('GSE CONTROL — AERODROME LYTV (TIVAT)', MARGIN, { size: 16, bold: true })
    this.line(18)
    this.text(opts.title, MARGIN, { size: 12, bold: true, color: DARK })
    this.line(16)
    this.text(opts.subtitle, MARGIN, { size: 9, color: GRAY })
    this.line(11)
    this.text(opts.regRef, MARGIN, { size: 9, color: rgb(0.2, 0.2, 0.5) })
    this.line(12)
    this.text(`Generisao: ${opts.generatedBy} (${opts.generatedRole})`, MARGIN, { size: 9 })
    this.line(11)
    this.text(`Datum izvjestaja: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, MARGIN, { size: 9 })
    this.line(14)
    ;(opts.extra ?? []).forEach((l) => {
      this.text(l, MARGIN, { size: 9 })
      this.line(11)
    })
    this.line(6)
  }

  sectionTitle(t: string) {
    this.ensureSpace(30)
    this.text(t, MARGIN, { size: 12, bold: true })
    this.line(14)
  }

  tableHeader(cols: { x: number; label: string }[]) {
    this.ensureSpace(24)
    cols.forEach((c) => this.text(c.label, c.x, { size: 8, bold: true }))
    this.line(5)
    this.hr(rgb(0, 0, 0))
    this.line(11)
  }

  /** Horizontalni bar-chart red — za statistiku (npr. broj dokumenata po statusu). */
  bar(label: string, count: number, max: number, color: RGB = rgb(0.2, 0.4, 0.75)) {
    this.ensureSpace(20)
    this.text(label.slice(0, 26), MARGIN, { size: 8 })
    const barX = MARGIN + 140
    const barMaxWidth = PAGE_WIDTH - MARGIN - barX - 30
    const width = max > 0 ? (count / max) * barMaxWidth : 0
    this.page.drawRectangle({ x: barX, y: this.y - 8, width: barMaxWidth, height: 10, color: rgb(0.93, 0.93, 0.93) })
    if (width > 0) this.page.drawRectangle({ x: barX, y: this.y - 8, width, height: 10, color })
    this.text(`${count}`, barX + barMaxWidth + 6, { size: 8, bold: true })
    this.line(16)
  }

  /** KPI kartica u redu (4 po redu) — za statistics/summary izvjestaje. */
  kpiRow(kpis: { label: string; value: string | number }[]) {
    this.ensureSpace(40)
    const boxWidth = (PAGE_WIDTH - MARGIN * 2) / kpis.length
    kpis.forEach((k, idx) => {
      const x = MARGIN + idx * boxWidth
      this.page.drawRectangle({ x, y: this.y - 32, width: boxWidth - 8, height: 34, color: rgb(0.96, 0.97, 0.99), borderColor: rgb(0.85, 0.87, 0.92), borderWidth: 0.5 })
      this.text(`${k.value}`, x + 8, { size: 14, bold: true, y: this.y - 14 })
      this.text(k.label.slice(0, 22), x + 8, { size: 7, color: GRAY, y: this.y - 26 })
    })
    this.line(42)
  }

  /** Blok za potvrdu/certifikaciju na kraju izvjestaja. */
  certificationBlock(generatedBy: string, role: string, footerNote: string) {
    this.ensureSpace(90)
    this.line(10)
    this.hr()
    this.line(16)
    this.text('POTVRDA / CERTIFICATION', MARGIN, { size: 10, bold: true })
    this.line(14)
    this.text(`Izvjestaj generisao: ${generatedBy}`, MARGIN, { size: 9 })
    this.text('Potpis: _______________________', MARGIN + 260, { size: 9 })
    this.line(12)
    this.text(`Uloga: ${role}`, MARGIN, { size: 9 })
    this.text(`Datum/vrijeme: ${new Date().toLocaleString('hr-HR')}`, MARGIN + 260, { size: 9 })
    this.line(20)
    this.text(footerNote, MARGIN, { size: 7, color: GRAY })
  }

  /** Numeracija stranica + footer — poziva se posljednje, prije save(). */
  finalizePageNumbers(footerLabel = 'GSE Control - Tivat Airport (LYTV)') {
    const pages = this.pdfDoc.getPages()
    pages.forEach((p, idx) => {
      p.drawText(`${idx + 1} / ${pages.length}`, { x: PAGE_WIDTH - MARGIN - 30, y: 20, size: 8, font: this.font, color: GRAY })
      p.drawText(footerLabel, { x: MARGIN, y: 20, size: 7, font: this.font, color: GRAY })
    })
  }

  async save() {
    return this.pdfDoc.save()
  }
}

export function pdfResponse(bytes: Uint8Array, filename: string) {
  return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}