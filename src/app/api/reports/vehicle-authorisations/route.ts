// src/app/api/reports/vehicle-authorisations/route.ts
//
// Registar ovlaštenja vozila (ADR.OPS.B.026) - A4. Za svako sredstvo sa zapisom: zone, pozivni znak, radio/transponder,
// označavanje/svjetla, status. Na kraju spisak sredstava bez ovlaštenja. engineer i admin.

import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { listVehicleAuthorisations } from '@/lib/actions-vehicle-auth'
import { localDate } from '@/lib/local-day'
import { W, H, M, NAVY, INK, MUTED, ZEBRA, GREEN, RED, AMBER, makeCtx, drawHeader, drawSectionTitle, drawTableHead, drawRemarksAndFooter, prettyDate, type Ctx } from '@/lib/pdf-gse-kit'

export const dynamic = 'force-dynamic'
const ROW = 13
const BOTTOM = 90

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  if (user.role !== 'admin' && user.role !== 'engineer') return new NextResponse('Forbidden', { status: 403 })

  const { rows, without } = await listVehicleAuthorisations()
  const today = localDate(new Date())
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Registar ovlastenja vozila ${today}`)
  pdf.setAuthor('GSE Control - Aerodrom Tivat')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const cols = [
    { label: 'SREDSTVO', x: M + 4 }, { label: 'POZIVNI ZNAK', x: M + 160 }, { label: 'ZONE', x: M + 235 },
    { label: 'RADIO', x: M + 300 }, { label: 'TRANSP.', x: M + 336 }, { label: 'OZNAKE', x: M + 376 }, { label: 'SVJETLA', x: M + 416 }, { label: 'STATUS', x: M + 462 },
  ]
  const newPage = (first: boolean): { c: Ctx; y: number } => {
    const page = pdf.addPage([W, H])
    const c = makeCtx(page, font, bold)
    if (first) {
      const hb = drawHeader(c, {
        title: 'REGISTAR OVLASTENJA VOZILA',
        subtitle: 'ADR.OPS.B.026  |  Authorisation of vehicles',
        line3: 'GSE Control  -  Aerodrom Tivat (LYTV)',
        bigRight: prettyDate(today),
        smallRight: `OVLASTENO: ${rows.filter((r) => r.status === 'ACTIVE').length}`,
        smallRight2: `Bez ovlastenja: ${without.length}`,
      })
      return { c, y: hb - 16 }
    }
    return { c, y: H - 40 }
  }
  let { c, y } = newPage(true)
  y = drawSectionTitle(c, 'OVLASTENA VOZILA', y)
  y = drawTableHead(c, y, cols)
  const yn = (v: boolean) => (v ? 'Da' : 'Ne')
  const zones = (r: (typeof rows)[number]) => [r.areaApron && 'Staj.', r.areaOther && 'Ceste', r.areaManoeuvring && 'Manev.'].filter(Boolean).join(', ')
  rows.forEach((r, i) => {
    if (y - ROW < BOTTOM) { ;({ c, y } = newPage(false)); y = drawTableHead(c, y, cols) }
    if (i % 2 === 0) c.page.drawRectangle({ x: M, y: y - ROW, width: W - 2 * M, height: ROW, color: ZEBRA })
    const yy = y - 9
    c.T(c.fit(r.equipmentCode, bold, 7.4, 150), cols[0].x, yy, 7.4, bold, INK)
    c.T(c.fit(r.callSign || '-', font, 7.2, 70), cols[1].x, yy, 7.2, font, INK)
    c.T(c.fit(zones(r), font, 6.6, 62), cols[2].x, yy, 6.6, font, INK)
    c.T(yn(r.radioEquipped), cols[3].x, yy, 7.2, font, INK)
    c.T(yn(r.transponderEquipped), cols[4].x, yy, 7.2, font, INK)
    c.T(yn(r.markingOk), cols[5].x, yy, 7.2, font, INK)
    c.T(yn(r.lightingOk), cols[6].x, yy, 7.2, font, INK)
    c.T(r.status === 'ACTIVE' ? 'Vazi' : r.status === 'SUSPENDED' ? 'Suspend.' : 'Opozvano', cols[7].x, yy, 7.2, bold, r.status === 'ACTIVE' ? GREEN : RED)
    y -= ROW
  })
  if (rows.length === 0) { c.T('Nijedno ovlastenje nije izdato.', M, y - 6, 9, font, MUTED); y -= 20 }

  if (without.length) {
    y -= 14
    if (y < BOTTOM + 40) ({ c, y } = newPage(false))
    y = drawSectionTitle(c, `SREDSTVA BEZ OVLASTENJA (${without.length})`, y)
    const txt = without.map((w) => w.code).join(', ')
    const words = txt.split(', '); let line = ''
    for (const w of words) {
      const t = line ? `${line}, ${w}` : w
      if (font.widthOfTextAtSize(t, 7) > W - 2 * M - 80 && line) { c.T(line + ',', M, y - 8, 7, font, AMBER); y -= 10; line = w } else line = t
    }
    if (line) { c.T(line, M, y - 8, 7, font, AMBER); y -= 12 }
  }
  y -= 8
  c.T('Ovlastenje vazi dok su uslovi ispunjeni. Suspenzija i opoziv se evidentiraju sa razlogom. Zapisi se cuvaju najmanje 4 godine nakon povlacenja vozila.', M, y - 4, 6.6, font, MUTED)

  drawRemarksAndFooter(c, {
    boxTop: Math.min(y - 14, 170), boxBottom: 70,
    generatedBy: user.full_name || user.email,
    generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    right: 'GSE Control - Registar ovlastenja vozila',
    remarksTitle: 'NAPOMENE / REMARKS',
    sigLabels: ['Izradio / Prepared by (ime i potpis)', 'Odobrio / Approved by (potpis i pecat)'],
  })
  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="registar-ovlastenja-vozila-${today}.pdf"`, 'Cache-Control': 'no-store' } })
}
