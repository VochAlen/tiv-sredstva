// src/app/api/reports/easa-compliance/route.ts
// Pregled usklađenosti sa EASA 139/2014 (održavanje opreme i sredstava) - A4 za štampu. engineer i admin.

import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { localDate } from '@/lib/local-day'
import { transliterate as tr } from '@/lib/pdf-utils'
import { COMPLIANCE, STATUS_META, ASSESSED_ON, BASIS, countStatuses, type CStatus } from '@/lib/easa-compliance'
import { W, H, M, NAVY, INK, MUTED, ZEBRA, GREEN, AMBER, RED, GRAY, WHITE, makeCtx, drawHeader, drawKpis, drawRemarksAndFooter, prettyDate, type Ctx } from '@/lib/pdf-gse-kit'

export const dynamic = 'force-dynamic'
const COLOR: Record<CStatus, ReturnType<typeof rgb>> = { DONE: GREEN, PARTIAL: AMBER, MISSING: RED, ORG: GRAY }
const BOTTOM = 60

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  if (user.role !== 'admin' && user.role !== 'engineer') return new NextResponse('Forbidden', { status: 403 })

  const today = localDate(new Date())
  const cnt = countStatuses()
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Uskladjenost sa EASA - odrzavanje opreme ${today}`)
  pdf.setAuthor('GSE Control - Aerodrom Tivat')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const wrap = (s: string, f: PDFFont, size: number, maxW: number): string[] => {
    const words = tr(s).split(' '); const out: string[] = []; let cur = ''
    for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (f.widthOfTextAtSize(t, size) > maxW && cur) { out.push(cur); cur = w } else cur = t }
    if (cur) out.push(cur); return out
  }
  const X = { ref: M + 4, req: M + 78, st: M + 270, wh: M + 322 }
  const newPage = (first: boolean): { c: Ctx; y: number } => {
    const page = pdf.addPage([W, H]); const c = makeCtx(page, font, bold)
    if (first) {
      const hb = drawHeader(c, {
        title: 'USKLADJENOST SA EASA PROPISIMA', subtitle: 'Odrzavanje opreme, vozila i sredstava  |  Reg. (EU) 139/2014',
        line3: 'GSE Control  -  Aerodrom Tivat (LYTV)', bigRight: prettyDate(today), smallRight: `PROCJENA: ${prettyDate(ASSESSED_ON)}`,
      })
      const kb = drawKpis(c, hb - 9, [['URADJENO', cnt.DONE, GREEN], ['DJELIMICNO', cnt.PARTIAL, AMBER], ['NEDOSTAJE', cnt.MISSING, RED], ['PROCEDURA', cnt.ORG, GRAY], ['UKUPNO', cnt.total, NAVY]])
      return { c, y: kb - 12 }
    }
    c.page.drawRectangle({ x: 0, y: H - 26, width: W, height: 26, color: NAVY })
    c.T('USKLADJENOST SA EASA - ODRZAVANJE OPREME', M, H - 17, 9, bold, WHITE)
    return { c, y: H - 40 }
  }
  let { c, y } = newPage(true)

  for (const g of COMPLIANCE) {
    if (y - 60 < BOTTOM) ({ c, y } = newPage(false))
    c.page.drawRectangle({ x: M, y: y - 13, width: W - 2 * M, height: 14, color: NAVY })
    c.T(`${g.rule}  -  ${g.title}`, M + 4, y - 9, 8, bold, WHITE)
    y -= 17
    g.items.forEach((i, idx) => {
      const reqL = wrap(i.req, font, 7, 182)
      const whL = wrap(i.where + (i.note ? `. ${i.note}` : ''), font, 6.8, W - M - X.wh - 4)
      const h = Math.max(reqL.length, whL.length, 2) * 8.6 + 6
      if (y - h < BOTTOM) { ;({ c, y } = newPage(false)) }
      if (idx % 2 === 0) c.page.drawRectangle({ x: M, y: y - h, width: W - 2 * M, height: h, color: ZEBRA })
      c.T(wrap(i.ref, bold, 6.8, 70)[0], X.ref, y - 9, 6.8, bold, INK)
      reqL.forEach((l, k) => c.T(l, X.req, y - 9 - k * 8.6, 7, font, INK))
      c.page.drawRectangle({ x: X.st, y: y - 14, width: 46, height: 11, color: COLOR[i.status] })
      c.T(STATUS_META[i.status].short, X.st + 3, y - 11.5, 6.6, bold, WHITE)
      whL.forEach((l, k) => c.T(l, X.wh, y - 9 - k * 8.6, 6.8, font, MUTED))
      y -= h
    })
    y -= 8
  }

  c.T(tr(`Osnova: ${BASIS}. Tehnicka procjena stanja u aplikaciji, ne pravni zakljucak. Nacionalni pravilnici (caa.me) nisu uklјuceni.`), M, y - 4, 6.4, font, MUTED)
  y -= 14
  if (y < 190) ({ c, y } = newPage(false))
  drawRemarksAndFooter(c, {
    boxTop: Math.min(y - 6, 170), boxBottom: 70,
    generatedBy: user.full_name || user.email, generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    right: 'GSE Control - Uskladjenost sa EASA', remarksTitle: 'NAPOMENE / REMARKS',
    sigLabels: ['Pregledao / Reviewed by (ime i potpis)', 'Odgovorni rukovodilac / Approved by (potpis i pecat)'],
  })
  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="uskladjenost-easa-${today}.pdf"`, 'Cache-Control': 'no-store' } })
}
