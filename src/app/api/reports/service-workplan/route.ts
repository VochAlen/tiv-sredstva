// src/app/api/reports/service-workplan/route.ts
//
// Plan rada servisa sredstava - A4 portrait (više strana ako treba), dizajn isti kao ostali GSE izvještaji.
// ?h=THIS_MONTH|NEXT_MONTH|QUARTER|YEAR  (engineer i admin)

import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { getServiceWorkPlan } from '@/lib/actions-service-plan'
import { isHorizon, fmtDateBHS } from '@/lib/service-plan'
import {
  W, H, M, NAVY, ACCENT, INK, MUTED, ZEBRA, GREEN, AMBER, RED, WHITE,
  makeCtx, drawHeader, drawKpis, drawSectionTitle, drawTableHead, drawRemarksAndFooter, prettyDate, type Ctx,
} from '@/lib/pdf-gse-kit'

export const dynamic = 'force-dynamic'

const MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar']
const REASON: Record<string, string> = { DATE: 'Rok (mj.)', KM: 'Kilometri', HOURS: 'Radni sati' }
const ROW = 13
const BOTTOM = 70

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  if (user.role !== 'admin' && user.role !== 'engineer') return new NextResponse('Forbidden', { status: 403 })
  const h = new URL(request.url).searchParams.get('h') ?? 'NEXT_MONTH'
  if (!isHorizon(h)) return new NextResponse('Nepoznat period', { status: 400 })

  let plan
  try { plan = await getServiceWorkPlan(h) } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : 'Greska', { status: 500 })
  }

  const pdf = await PDFDocument.create()
  pdf.setTitle(`Plan rada servisa - ${plan.label} (${plan.from} - ${plan.to})`)
  pdf.setAuthor('GSE Control - Aerodrom Tivat')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const newPage = (first: boolean): { c: Ctx; y: number } => {
    const page = pdf.addPage([W, H])
    const c = makeCtx(page, font, bold)
    if (first) {
      const hb = drawHeader(c, {
        title: 'PLAN RADA - SERVISI SREDSTAVA',
        subtitle: `${plan.label}  |  preventivno odrzavanje po IATA AHM 917 (minor / major)`,
        line3: 'GSE Control  -  Aerodrom Tivat (LYTV)',
        bigRight: prettyDate(plan.from),
        smallRight: `DO: ${prettyDate(plan.to)}`,
        smallRight2: `Izradeno: ${prettyDate(plan.today)}`,
      })
      const kb = drawKpis(c, hb - 9, [
        ['SERVISA U PERIODU', plan.totals.all, NAVY],
        ['SREDSTAVA', plan.totals.equipment, ACCENT],
        ['DOSPJELO (ODMAH)', plan.totals.overdue, plan.totals.overdue ? RED : GREEN],
        ['EKSTERNI SERVISER', plan.totals.external, AMBER],
        ['INTERNO', plan.totals.internal, GREEN],
      ])
      return { c, y: kb - 12 }
    }
    c.page.drawRectangle({ x: 0, y: H - 26, width: W, height: 26, color: NAVY })
    c.T(`PLAN RADA - SERVISI SREDSTAVA  |  ${plan.label}`, M, H - 17, 9, bold, WHITE)
    c.TR(`${prettyDate(plan.from)} - ${prettyDate(plan.to)}`, W - M, H - 17, 8, font, WHITE)
    return { c, y: H - 40 }
  }

  const cols = [
    { label: 'DATUM', x: M + 6 }, { label: 'SREDSTVO', x: M + 62 }, { label: 'VRSTA', x: M + 218 }, { label: 'OSNOV', x: M + 258 }, { label: 'KO SERVISIRA / KONTAKT', x: M + 322 },
  ]
  let { c, y } = newPage(true)

  const ensure = (need: number) => {
    if (y - need < BOTTOM) { ;({ c, y } = newPage(false)) }
  }

  const groups: Array<{ title: string; items: typeof plan.items }> = []
  const over = plan.items.filter((i) => i.overdue)
  if (over.length) groups.push({ title: `DOSPJELO - ODMAH (${over.length})`, items: over })
  for (const m of plan.byMonth) {
    groups.push({ title: `${MONTHS[Number(m.month.slice(5, 7)) - 1].toUpperCase()} ${m.month.slice(0, 4)} (${m.count})`, items: plan.items.filter((i) => !i.overdue && i.date.startsWith(m.month)) })
  }

  if (plan.items.length === 0) {
    c.T('Nema planiranih servisa u izabranom periodu.', M, y - 6, 9, font, MUTED)
    y -= 24
  }

  for (const g of groups) {
    ensure(10 + 11 + ROW * 2)
    y = drawSectionTitle(c, g.title, y)
    y = drawTableHead(c, y, cols)
    g.items.forEach((it, idx) => {
      if (y - ROW < BOTTOM) {
        ;({ c, y } = newPage(false))
        y = drawTableHead(c, y, cols)
      }
      if (idx % 2 === 0) c.page.drawRectangle({ x: M, y: y - ROW, width: W - 2 * M, height: ROW, color: ZEBRA })
      const yy = y - 9
      c.T(it.overdue ? 'ODMAH' : fmtDateBHS(it.date), cols[0].x, yy, 7.4, bold, it.overdue ? RED : INK)
      c.T(c.fit(`${it.code}  ${it.name}`, font, 7.4, 150), cols[1].x, yy, 7.4, font, INK)
      c.T(it.kind === 'MAJOR' ? 'Major' : 'Minor', cols[2].x, yy, 7.2, bold, it.kind === 'MAJOR' ? RED : NAVY)
      c.T(REASON[it.reason], cols[3].x, yy, 7.2, font, INK)
      const who = it.external ? `${it.provider ?? 'Eksterni serviser'}${it.phone ? '  ' + it.phone : ''}` : 'Interno'
      c.T(c.fit(who, it.external ? bold : font, 7.2, W - M - cols[4].x - 4), cols[4].x, yy, 7.2, it.external ? bold : font, it.external ? NAVY : MUTED)
      y -= ROW
    })
    y -= 8
  }

  if (plan.noBaseline.length) {
    ensure(26)
    c.T(c.fit(`Bez upisanog zadnjeg servisa (nisu u planu, ${plan.noBaseline.length}): ${plan.noBaseline.map((n) => n.code).join(', ')}`, font, 6.6, W - 2 * M), M, y - 4, 6.6, font, MUTED)
    y -= 14
  }
  c.T('Datumi su procjena na osnovu dosadasnje potrosnje km / radnih sati; konacan termin dogovara sef tehnicke sluzbe.', M, y - 4, 6.6, font, MUTED)
  y -= 14

  if (y < 200) ({ c, y } = newPage(false))
  drawRemarksAndFooter(c, {
    boxTop: Math.min(y - 6, 210), boxBottom: 78,
    generatedBy: user.full_name || user.email,
    generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    right: 'GSE Control - Plan rada servisa',
    remarksTitle: 'NAPOMENE / REMARKS',
    sigLabels: ['Izradio / Prepared by (ime i potpis)', 'Sef tehnicke sluzbe / Approved by (potpis i pecat)'],
  })

  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="plan-rada-servisi-${plan.from}.pdf"`, 'Cache-Control': 'no-store' },
  })
}
