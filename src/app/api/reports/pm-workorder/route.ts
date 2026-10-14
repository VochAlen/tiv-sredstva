// src/app/api/reports/pm-workorder/route.ts
//
// Maintenance Work Order po IATA AHM 917 (PM check sheet) - A4 portrait, više strana.
// ?id=<id radnog naloga>. Prazna (tek otvorena) forma se štampa za rad na papiru; popunjena za arhivu.
// engineer i admin. Tekst stavki je namjerno na engleskom (originalni tekst IATA standarda).

import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { getPmWorkOrder } from '@/lib/actions-pm'
import { PM_CHECKLISTS, pmSectionsFor, type PmAnswer } from '@/lib/pm-checklists'
import { localDate } from '@/lib/local-day'
import {
  W, H, M, NAVY, ACCENT, INK, MUTED, LINE, ZEBRA, GREEN, AMBER, RED, WHITE,
  makeCtx, drawHeader, prettyDate, type Ctx,
} from '@/lib/pdf-gse-kit'
import { transliterate as tr } from '@/lib/pdf-utils'

export const dynamic = 'force-dynamic'

const FS = 6.6
const LH = 7.8
const BOTTOM = 44
const X_NO = M + 4, X_TASK = M + 24, X_OK = M + 330, X_NOK = M + 352, X_FIX = M + 382, X_NA = M + 410, X_CMT = M + 428
const TASK_W = 298, CMT_W = W - M - X_CMT - 3

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = []
  for (const para of tr(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) continue
    let line = ''
    for (const w of words) {
      const t = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(t, size) <= maxW) line = t
      else { if (line) out.push(line); line = w }
    }
    if (line) out.push(line)
  }
  return out.length ? out : ['']
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  if (user.role !== 'admin' && user.role !== 'engineer') return new NextResponse('Forbidden', { status: 403 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return new NextResponse('Nedostaje id radnog naloga', { status: 400 })
  let wo: Awaited<ReturnType<typeof getPmWorkOrder>>
  try { wo = await getPmWorkOrder(id) } catch (e) { return new NextResponse(e instanceof Error ? e.message : 'Greska', { status: 500 }) }
  if (!wo) return new NextResponse('Radni nalog nije pronadjen', { status: 404 })
  const cl = PM_CHECKLISTS[wo.checklistType]
  if (!cl) return new NextResponse('Nema check-sheet-a za ovaj tip', { status: 400 })

  const answers = new Map(wo.items.map((i) => [i.k, i]))
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Maintenance Work Order ${wo.no} - ${wo.equipmentCode}`)
  pdf.setAuthor('GSE Control - Aerodrom Tivat')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const pages: Ctx[] = []
  const kindTxt = wo.kind === 'MAJOR' ? 'MAJOR (checks + replace)' : 'MINOR (checks)'
  const issued = localDate(new Date(wo.issuedAt))

  const newPage = (): { c: Ctx; y: number } => {
    const page = pdf.addPage([W, H])
    const c = makeCtx(page, font, bold)
    pages.push(c)
    if (pages.length === 1) {
      const hb = drawHeader(c, {
        title: 'MAINTENANCE WORK ORDER',
        subtitle: `IATA AHM 917  |  ${kindTxt} preventive maintenance`,
        line3: `GSE Control  -  Aerodrom Tivat (LYTV)  |  ${cl.title}`,
        bigRight: prettyDate(issued),
        smallRight: `CHECK SHEET: ${wo.no}`,
        smallRight2: wo.status === 'DONE' ? 'STATUS: COMPLETED' : 'STATUS: OPEN',
      })
      return { c, y: hb - 6 }
    }
    page.drawRectangle({ x: 0, y: H - 22, width: W, height: 22, color: NAVY })
    c.T(`MAINTENANCE WORK ORDER ${wo.no}  |  ${wo.equipmentCode} ${wo.equipmentName}`, M, H - 15, 8, bold, WHITE)
    c.TR(kindTxt, W - M, H - 15, 7.5, font, WHITE)
    return { c, y: H - 32 }
  }
  let { c, y } = newPage()

  // ---------- zaglavlje naloga ----------
  const cell = (label: string, value: string, x: number, yy: number, w: number) => {
    c.page.drawRectangle({ x, y: yy - 22, width: w, height: 22, borderColor: LINE, borderWidth: 0.6 })
    c.T(label, x + 4, yy - 7, 5.6, bold, MUTED)
    c.T(c.fit(value || '-', bold, 8.5, w - 8), x + 4, yy - 17, 8.5, bold, INK)
  }
  const cw = (W - 2 * M) / 3
  const meter = [wo.meterHours != null ? `${Math.round(wo.meterHours)} h` : '', wo.meterKm != null ? `${Math.round(wo.meterKm)} km` : ''].filter(Boolean).join('  /  ')
  y -= 2
  cell('CHECK SHEET #', wo.no, M, y, cw); cell('GSE TYPE', cl.title, M + cw, y, cw * 2)
  y -= 22
  cell('ISSUING DATE', prettyDate(issued), M, y, cw); cell('ASSET ID', `${wo.equipmentCode}`, M + cw, y, cw); cell('MANUFACTURER / MODEL', [wo.manufacturer, wo.equipmentName].filter(Boolean).join(' - '), M + 2 * cw, y, cw)
  y -= 22
  cell('PM BASED ON', wo.pmBasedOn === 'HOURS' ? 'Hours' : wo.pmBasedOn === 'KM' ? 'Distance (km)' : wo.pmBasedOn === 'MONTHS' ? 'Months' : '', M, y, cw); cell('CURRENT METER READING', meter, M + cw, y, cw); cell('PM TYPE', kindTxt, M + 2 * cw, y, cw)
  y -= 22
  cell('LEAD MECHANIC', wo.leadMechanic ?? '', M, y, cw * 1.5); cell('ADDITIONAL MECHANIC', wo.additionalMechanic ?? '', M + cw * 1.5, y, cw * 1.5)
  y -= 26
  c.T('! The technical manual, specific to the equipment being serviced, should be consulted for recommended safety and service procedures !', M, y, 6.4, bold, RED)
  y -= 10

  const box = (x: number, yy: number, on: boolean, color: ReturnType<typeof rgbLike>) => {
    c.page.drawRectangle({ x, y: yy, width: 7.5, height: 7.5, borderColor: INK, borderWidth: 0.6, ...(on ? { color } : {}) })
  }

  // ---------- sekcije ----------
  const sections = pmSectionsFor(wo.checklistType, wo.kind)
  const heads = () => {
    c.page.drawRectangle({ x: M, y: y - 10, width: W - 2 * M, height: 10, color: NAVY })
    c.T('No.', X_NO, y - 7.2, 5.8, bold, WHITE); c.T('TASK', X_TASK, y - 7.2, 5.8, bold, WHITE)
    c.T('OK', X_OK, y - 7.2, 5.8, bold, WHITE); c.T('NOT OK', X_NOK - 4, y - 7.2, 5.8, bold, WHITE); c.T('FIXED', X_FIX - 1, y - 7.2, 5.8, bold, WHITE); c.T('N/A', X_NA, y - 7.2, 5.8, bold, WHITE)
    c.T('INTERVAL / COMMENT', X_CMT, y - 7.2, 5.8, bold, WHITE)
    y -= 10
  }
  for (const sec of sections) {
    const excluded = wo.excludedSections.includes(sec.id)
    const secNote = wo.kind === 'MAJOR' ? [sec.checkNote, sec.replaceNote].filter(Boolean).join('  |  ') : sec.checkNote
    const firstH = 14 + 10 + (sec.tasks[0] ? wrap(sec.tasks[0].text, font, FS, TASK_W).length * LH + 4 : 0)
    if (y - firstH < BOTTOM) ({ c, y } = newPage())
    y -= 4
    c.page.drawRectangle({ x: M, y: y - 12, width: W - 2 * M, height: 12, color: ACCENT })
    c.T(c.fit(sec.title.toUpperCase(), bold, 7.6, 250), M + 5, y - 8.6, 7.6, bold, WHITE)
    c.TR(c.fit(excluded ? 'NOT APPLICABLE TO THIS VEHICLE' : secNote, font, 5.8, W - 2 * M - 270), W - M - 4, y - 8.4, 5.8, font, WHITE)
    y -= 12
    if (sec.caution && !excluded) {
      const lines = wrap(`CAUTION: ${sec.caution.replace(/^CAUTION:\s*/i, '')}`, bold, 5.8, W - 2 * M - 8)
      lines.forEach((ln, i) => c.T(ln, M + 4, y - 7 - i * 7, 5.8, bold, RED))
      y -= lines.length * 7 + 3
    }
    if (excluded) { y -= 2; continue }
    heads()
    sec.tasks.forEach((t, idx) => {
      const lines = wrap(t.text, font, FS, TASK_W)
      const note = t.note ? wrap(t.note, font, 5.6, CMT_W) : []
      const item = answers.get(t.key)
      const cmt = item?.c ? wrap(item.c, font, 5.8, CMT_W) : []
      const h = Math.max(lines.length * LH, (note.length + cmt.length) * 6.6, 9) + 4
      if (y - h < BOTTOM) { ({ c, y } = newPage()); heads() }
      if (idx % 2 === 0) c.page.drawRectangle({ x: M, y: y - h, width: W - 2 * M, height: h, color: ZEBRA })
      c.T(String(t.no), X_NO, y - 8, FS, font, MUTED)
      lines.forEach((ln, i) => c.T(ln, X_TASK, y - 8 - i * LH, FS, font, INK))
      const by = y - 9
      const s: PmAnswer | undefined = item?.s
      box(X_OK, by, s === 'OK', GREEN); box(X_NOK + 3, by, s === 'NOT_OK', RED); box(X_FIX + 2, by, s === 'FIXED', AMBER); box(X_NA, by, s === 'NA', MUTED_C)
      let cy = y - 7
      note.forEach((ln) => { c.T(ln, X_CMT, cy, 5.6, font, MUTED); cy -= 6.6 })
      cmt.forEach((ln) => { c.T(ln, X_CMT, cy, 5.8, bold, NAVY); cy -= 6.6 })
      y -= h
    })
  }

  // ---------- zaključak i potpisi ----------
  const need = 190
  if (y - need < BOTTOM) ({ c, y } = newPage())
  y -= 10
  const money = (v: number | null) => (v != null ? v.toFixed(2) : '')
  const cw2 = (W - 2 * M) / 4
  cell('TOTAL HOURS', wo.hoursWorked != null ? String(wo.hoursWorked) : '', M, y, cw2); cell('TOTAL PARTS COSTS (excl. tires)', money(wo.partsCost), M + cw2, y, cw2)
  cell('TOTAL TIRE COSTS', money(wo.tireCost), M + 2 * cw2, y, cw2); cell('CHECK SHEET COMPLETED', wo.completedAt ? prettyDate(localDate(new Date(wo.completedAt))) : '', M + 3 * cw2, y, cw2)
  y -= 30
  c.T('I certify that the above inspection has been completed. The above unexpected defects:', M, y, 7.4, bold, NAVY)
  y -= 13
  const cb = (label: string, on: boolean | null, x: number, yy: number) => { box(x, yy - 1, on === true, NAVY_C); c.T(label, x + 12, yy, 7.2, font, INK) }
  cb('have been rectified', wo.defectsRectified === true, M + 8, y); cb('have not been rectified', wo.defectsRectified === false, M + 150, y)
  y -= 14
  c.T('In my opinion the equipment:', M, y, 7.4, bold, NAVY)
  y -= 13
  cb('is in a serviceable condition', wo.serviceable === true, M + 8, y); cb('is not in a serviceable condition', wo.serviceable === false, M + 150, y)
  y -= 14
  c.T('Comments / remarks:', M, y, 7, bold, MUTED)
  const cm = wo.comment ? wrap(wo.comment, font, 7.2, W - 2 * M - 8).slice(0, 4) : []
  c.page.drawRectangle({ x: M, y: y - 44, width: W - 2 * M, height: 40, borderColor: LINE, borderWidth: 0.7 })
  cm.forEach((ln, i) => c.T(ln, M + 4, y - 14 - i * 9, 7.2, font, INK))
  y -= 64
  const half = (W - 2 * M - 24) / 2
  for (const [lab, name, x] of [['Inspected by (print name / signature)', wo.completedBy ?? wo.leadMechanic ?? '', M], ['Responsible person (print name / signature)', '', M + half + 24]] as const) {
    c.page.drawLine({ start: { x, y }, end: { x: x + half, y }, thickness: 0.6, color: INK })
    c.T(lab, x, y - 8, 6.3, font, MUTED)
    if (name) c.T(c.fit(name, bold, 8, half - 4), x + 2, y + 3, 8, bold, INK)
  }

  // podnožje + numeracija strana
  const total = pages.length
  const when = new Date().toISOString().slice(0, 16).replace('T', ' ')
  pages.forEach((pc, i) => {
    pc.page.drawLine({ start: { x: M, y: 30 }, end: { x: W - M, y: 30 }, thickness: 0.4, color: LINE })
    pc.T(`Generisano iz GSE Control: ${user.full_name || user.email}, ${when}`, M, 20, 6.2, font, MUTED)
    pc.TR(`${wo.no}  |  IATA AHM 917  |  strana ${i + 1}/${total}`, W - M, 20, 6.2, font, MUTED)
  })

  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="pm-${wo.equipmentCode}-${wo.no}.pdf"`, 'Cache-Control': 'no-store' },
  })
}

// boje koje kit ne izvozi pod ovim imenom
import { rgb } from 'pdf-lib'
const rgbLike = rgb
const MUTED_C = rgb(0.45, 0.48, 0.53)
const NAVY_C = rgb(0.06, 0.16, 0.3)
