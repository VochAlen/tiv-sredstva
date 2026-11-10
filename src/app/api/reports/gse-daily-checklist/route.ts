// src/app/api/reports/gse-daily-checklist/route.ts
//
// Ček liste dnevne ispravnosti GSE koje se svako jutro nose u Operativni centar:
//   OBR1 = PRO.03.04. OBR.1  (Služba zemaljskog opsluživanja, 2 kolone, 47 redova)
//   OBR2 = PRO.03.04. OBR2   (Tehnička služba, 1 tabela, 15 redova)
// Izgled i spisak sredstava prate papirne obrasce (IZD./REV.01/02, dec. 2025).
// Spisak redova je fiksan kao na obrascu; sredstvo iz aplikacije se pronalazi po "Reg./oznaka"
// (Int.br. iz polja serijski broj, npr. "Int.br. 32 (H)" -> 32, ili registarska tablica) i dobija
// zaokružen Y (ispravno) ili N (neispravno) prema današnjem digitalnom dnevnom pregledu.
// Nepregledano ostaje prazno (zaokružuje se rukom). ?inline=1 otvara u pregledaču, inače se preuzima.

import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { getDailyInspectionStatus, type DailyInspectionStatusRow } from '@/lib/actions-adr'
import { localDate } from '@/lib/local-day'
import { transliterate as tr } from '@/lib/pdf-utils'

export const dynamic = 'force-dynamic'

type Item = { reg: string; name: string }
type Group = { roman: string; title: string; items: Item[] }

// ---- PRO.03.04. OBR.1 (Služba zemaljskog opsluživanja) ----
const OBR1: Group[] = [
  { roman: 'I', title: 'STAIRS / STEPENICE', items: [
    { reg: '32', name: 'AVIOGEI' }, { reg: '33', name: 'AVIOGEI' }, { reg: '83', name: 'AVIOGEI' }, { reg: '74', name: 'AVIOGEI' }, { reg: '54', name: 'AVIOGEI' },
    { reg: '55', name: 'Električne TBD' }, { reg: '56', name: 'Električne TBD' }, { reg: '57', name: 'Električne TBD' }, { reg: '58', name: 'Električne TBD' },
  ] },
  { roman: 'II', title: 'CONVEYOR / ELEVATOR', items: [
    { reg: '29', name: 'AVIOGEI' }, { reg: '30', name: 'AVIOGEI' }, { reg: '63', name: 'AVIOGEI' }, { reg: '64', name: 'AVIOGEI' }, { reg: '65', name: 'AVIOGEI' },
    { reg: '66', name: 'AVIOGEI' }, { reg: '67', name: 'AVIOGEI' },
  ] },
  { roman: 'III', title: 'GPU / ASU', items: [
    { reg: '15', name: 'GUINAULT agregat' }, { reg: '60', name: 'BERTOLI agregat' }, { reg: '61', name: 'BERTOLI agregat' },
    { reg: '70', name: 'HITZINGER agregat' }, { reg: '37', name: 'GUINAULT vazdušni' }, { reg: '', name: 'HOUCHIN agregat' },
  ] },
  { roman: 'IV', title: 'TRACTOR / TRAKTOR', items: [
    { reg: '1', name: 'IMT' }, { reg: '3', name: 'IMT' }, { reg: '5', name: 'IMT' }, { reg: '6', name: 'IMT' }, { reg: '7', name: 'IMT' },
    { reg: '34', name: 'IMT' }, { reg: '35', name: 'IMT' },
    { reg: '38', name: 'AGT' }, { reg: '39', name: 'AGT' }, { reg: '40', name: 'AGT' }, { reg: '41', name: 'AGT' }, { reg: '42', name: 'AGT' },
    { reg: '50', name: 'AGT' }, { reg: '51', name: 'AGT' }, { reg: '52', name: 'AGT' },
  ] },
  { roman: 'V', title: 'VEHICLE / VOZILA', items: [
    { reg: '16', name: 'AVIOGEI (water)' }, { reg: '31', name: 'AVIOGEI (toilet)' }, { reg: '44', name: 'Elektr. AVIOGEI (toilet)' },
    { reg: '48', name: 'Loader utovarivač kont.' }, { reg: '71', name: 'LEKTRO pushback' },
    { reg: 'PGCG068', name: 'Ambulantno' }, { reg: 'PGCGJ47', name: 'Ambulantno' }, { reg: 'PGCGK32', name: 'Mercedes V class' },
    { reg: '13', name: 'Attiva 4.6' }, { reg: '28', name: 'Attiva 6LC.5' },
  ] },
]

// ---- PRO.03.04. OBR2 (Tehnička služba) ----
const OBR2: Group[] = [
  { roman: 'I', title: 'TRACTOR / TRAKTOR', items: [{ reg: '17', name: 'Rakovica' }, { reg: '53', name: 'Solis' }] },
  { roman: 'II', title: 'FIRE VEHICLE / VATROGASNA VOZILA', items: [
    { reg: 'PG CG B89', name: 'Rosenbauer Panther' }, { reg: 'PG CG B90', name: 'Rosenbauer Panther' }, { reg: 'PG CG S36', name: 'Rosenbauer Panther' },
    { reg: 'PG CG 799', name: 'Toyota Komandno' }, { reg: 'PG CG K64', name: 'Fiat Fiorino' }, { reg: 'PG MN 930', name: 'VW Caddy' },
  ] },
  { roman: 'III', title: 'SECURITY VEHICLE / VOZILA BEZBJEDNOSTI', items: [
    { reg: 'PG CG N51', name: 'Toyota Land Cruiser' }, { reg: 'PG CG P80', name: 'Toyota Hilux' }, { reg: '20', name: 'Attiva 4.6' },
  ] },
  { roman: 'IV', title: 'TECHNICAL VEHICLE / TEHNIČKA SLUŽBA', items: [
    { reg: '91', name: 'Attiva 6LC.5' }, { reg: '11', name: 'Viljuškar Toyota' }, { reg: 'PG MN 731', name: 'Toyota Hilux' }, { reg: 'PG CG L45', name: 'Dacia Duster' },
  ] },
]

const NOTE = 'Note / Bilješka: Light, Tires, Steering, Brakes, Body, Fluid leaks, Lifting platform (were applicable), portable fire extinguisher and Safety devices are visually checked. Svjetlosni system, Pneumatici, Upravljački mehanizam, Kočioni mehanizam, Curenje tečnosti, Nosive platforme (gdje je primjenljivo), protivpožarni aparat i sigurnosni uređaji su vizuelno pregledani.'

const norm = (s: string) => s.toUpperCase().replace(/\s+/g, '')
/** "Int.br. 32 (H)" -> "32"; "Int.br. PG CG 799 (F)" -> "PGCG799" */
function regOf(r: DailyInspectionStatusRow): string[] {
  const out: string[] = [norm(r.code)]
  const m = (r.serialNumber ?? '').match(/Int\.?\s*br\.?\s*([A-Za-z0-9 ]+?)\s*(?:\(|$)/i)
  if (m) out.unshift(norm(m[1]))
  return out
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const sp = new URL(request.url).searchParams
  const department = sp.get('department') === 'SLUZBA_PO' ? 'SLUZBA_PO' : 'TEHNICKA_SLUZBA'
  const dateParam = sp.get('date')
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : localDate(new Date())
  const isPO = department === 'SLUZBA_PO'
  const groups = isPO ? OBR1 : OBR2

  const all = await getDailyInspectionStatus(date)
  const byReg = new Map<string, DailyInspectionStatusRow>()
  for (const r of all) for (const k of regOf(r)) if (!byReg.has(k)) byReg.set(k, r)
  const resultOf = (reg: string): string | null => (reg ? byReg.get(norm(reg))?.inspection?.result ?? null : null)

  const pdf = await PDFDocument.create()
  pdf.setTitle(`${isPO ? 'PRO.03.04. OBR.1' : 'PRO.03.04. OBR2'} - GSE dnevna ček lista ${date}`)
  pdf.setAuthor('GSE Control - Aerodrom Tivat')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ital = await pdf.embedFont(StandardFonts.HelveticaOblique)
  const page = pdf.addPage([595.28, 841.89])
  const W = 595.28, H = 841.89
  const BLACK = rgb(0, 0, 0), GREY = rgb(0.85, 0.85, 0.85)

  const T = (s: string, x: number, y: number, size: number, f: PDFFont = font, color = BLACK) => { try { page.drawText(tr(s), { x, y, size, font: f, color }) } catch { /* ignore */ } }
  const TC = (s: string, cx: number, y: number, size: number, f: PDFFont = font) => { const t = tr(s); T(t, cx - f.widthOfTextAtSize(t, size) / 2, y, size, f) }
  const wrap = (s: string, size: number, maxW: number, f: PDFFont = font): string[] => {
    const words = tr(s).split(' '); const lines: string[] = []; let cur = ''
    for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (f.widthOfTextAtSize(t, size) > maxW && cur) { lines.push(cur); cur = w } else cur = t }
    if (cur) lines.push(cur); return lines
  }
  const rect = (x: number, y: number, w: number, h: number, fill?: ReturnType<typeof rgb>) =>
    page.drawRectangle({ x, y, width: w, height: h, borderColor: BLACK, borderWidth: 0.7, ...(fill ? { color: fill } : {}) })

  // ---- zaglavlje: logo + adresa (isti kao na obrascu) ----
  try {
    const res = await fetch(new URL('/images/acg-form-header.png', request.url))
    if (res.ok) {
      const img = await pdf.embedPng(new Uint8Array(await res.arrayBuffer()))
      const w = W - 2 * 30
      page.drawImage(img, { x: 30, y: H - 24 - (w * img.height) / img.width, width: w, height: (w * img.height) / img.width })
    } else throw new Error('no logo')
  } catch {
    T('AERODROMI CRNE GORE - Airports of Montenegro', 30, H - 40, 12, bold)
  }

  let ringsFor: Array<{ x: number; y: number; res: string | null }> = []
  const ringLater = (x: number, y: number, res: string | null) => ringsFor.push({ x, y, res })

  // ---- jedna tabela (X, širina, kolone) ----
  const drawRow = (x: number, yTop: number, cw: number[], h: number, g?: { roman: string; title: string }, it?: { no: number; reg: string; name: string; res: string | null }) => {
    const yb = yTop - h
    const [c0, c1, c2, c3] = cw
    if (g) {
      rect(x, yb, c0 + c1 + c2 + c3, h, GREY)
      page.drawLine({ start: { x: x + c0 + c1, y: yb }, end: { x: x + c0 + c1, y: yTop }, thickness: 0.7, color: BLACK })
      TC(g.roman, x + (c0 + c1) / 2, yb + h / 2 - 3, 8.5, bold)
      TC(g.title, x + c0 + c1 + (c2 + c3) / 2, yb + h / 2 - 3, 8.5, bold)
      return
    }
    rect(x, yb, c0 + c1 + c2 + c3, h)
    let cx = x
    for (const w of [c0, c1, c2]) { cx += w; page.drawLine({ start: { x: cx, y: yb }, end: { x: cx, y: yTop }, thickness: 0.7, color: BLACK }) }
    if (it) {
      TC(String(it.no), x + c0 / 2, yb + h / 2 - 3, 8.5)
      TC(it.reg, x + c0 + c1 / 2, yb + h / 2 - 3, bold.widthOfTextAtSize(it.reg, 8.5) > c1 - 4 ? 6.3 : 8.5, bold)
      TC(it.name, x + c0 + c1 + c2 / 2, yb + h / 2 - 3, 8.5)
      const sx = x + c0 + c1 + c2
      T('Y', sx + c3 * 0.28, yb + h / 2 - 3, 8.5)
      T('N', sx + c3 * 0.66, yb + h / 2 - 3, 8.5)
      ringLater(sx, yb + h / 2, it.res)
    }
  }
  const drawHead = (x: number, yTop: number, cw: number[], h: number) => {
    const yb = yTop - h
    rect(x, yb, cw[0] + cw[1] + cw[2] + cw[3], h)
    let cx = x
    for (const w of [cw[0], cw[1], cw[2]]) { cx += w; page.drawLine({ start: { x: cx, y: yb }, end: { x: cx, y: yTop }, thickness: 0.7, color: BLACK }) }
    const mid = yb + h / 2
    TC('No./', x + cw[0] / 2, mid + 2, 6.5); TC('Red.br', x + cw[0] / 2, mid - 6, 6.5)
    TC('Reg./', x + cw[0] + cw[1] / 2, mid + 2, 6.5); TC('oznaka', x + cw[0] + cw[1] / 2, mid - 6, 6.5)
    TC('GSE / Naziv sredstva', x + cw[0] + cw[1] + cw[2] / 2, mid - 3, 8)
    const sx = x + cw[0] + cw[1] + cw[2] + cw[3] / 2
    TC('Status /', sx, mid + 7, 6.5); TC('ispravnost', sx, mid - 1, 6.5); TC('Y / N', sx, mid - 9, 6.5)
  }

  let no = 1
  const flatten = (gs: Group[]) => gs.flatMap((g) => [{ g: { roman: g.roman, title: g.title } } as { g?: { roman: string; title: string }; it?: { no: number; reg: string; name: string; res: string | null } }]
    .concat(g.items.map((i) => ({ it: { no: no++, reg: i.reg, name: i.name, res: resultOf(i.reg) } }))))

  const dispDate = `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}.`
  const rowsAll = flatten(groups)
  const failed = rowsAll.filter((r) => r.it?.res === 'UNFIT').map((r) => `${r.it!.reg || '-'} ${r.it!.name}`)
  const cond = rowsAll.filter((r) => r.it && r.it.res && r.it.res !== 'FIT' && r.it.res !== 'UNFIT').map((r) => `${r.it!.reg || '-'} ${r.it!.name}`)

  if (isPO) {
    TC('GROUND HANDLING DEPARTMENT OF TIVAT AIRPORT / SLUŽBA ZEMALJSKOG OPSLUŽIVANJA AERODROMA TIVAT', W / 2, H - 92, 9.5, bold)
    TC('Ground Support Equipment (GSE) Daily Checklist / Ček lista dnevne ispravnosti opreme za opsluživanje vazduhoplova', W / 2, H - 106, 8.3)
    T('Date / Datum:', 50, H - 126, 9.5); T(dispDate, 118, H - 126, 9.5, bold)
    page.drawLine({ start: { x: 116, y: H - 128 }, end: { x: 205, y: H - 128 }, thickness: 0.5, color: BLACK })
    T('Nedeljni pregled/weekly check:', 372, H - 126, 9.5); rect(528, H - 131, 11, 11)

    const cw = [34, 34, 146, 46]
    const tw = cw.reduce((a, b) => a + b, 0)
    const xL = 26, xR = 26 + tw + 11
    const topY = H - 140, headH = 26, rowH = 17
    drawHead(xL, topY, cw, headH); drawHead(xR, topY, cw, headH)
    // lijeva kolona: grupe I-IV do (i uključujući) traktor br. 27; desna: ostatak + V + Remarks
    const split = rowsAll.findIndex((r) => r.it?.no === 28)
    const left = rowsAll.slice(0, split), right = rowsAll.slice(split)
    let y = topY - headH
    for (const r of left) { drawRow(xL, y, cw, rowH, r.g, r.it); y -= rowH }
    const tableBottom = y
    y = topY - headH
    for (const r of right) { drawRow(xR, y, cw, rowH, r.g, r.it); y -= rowH }
    // Remarks / Primjedbe
    rect(xR, tableBottom, tw, y - tableBottom)
    T('Remarks / Primjedbe:', xR + 4, y - 11, 8.5)
    let ry = y - 24
    if (failed.length) for (const l of wrap(`Neispravno (N): ${failed.join('; ')}`, 7, tw - 10)) { T(l, xR + 4, ry, 7, bold); ry -= 9 }
    if (cond.length) for (const l of wrap(`Y* sa ograničenjem: ${cond.join('; ')}`, 7, tw - 10)) { T(l, xR + 4, ry, 7); ry -= 9 }
    // Note
    const noteTop = tableBottom - 8
    const nl = wrap(NOTE, 7.3, 2 * tw + 11 - 10)
    rect(xL, noteTop - (nl.length * 9 + 8), 2 * tw + 11, nl.length * 9 + 8)
    nl.forEach((l, i) => T(l, xL + 5, noteTop - 11 - i * 9, 7.3))
    const sigY = noteTop - (nl.length * 9 + 8) - 22
    T('Checked by: / Pregled izvršio:', W - 26 - bold.widthOfTextAtSize('Checked by: / Pregled izvrsio:', 8.5) - 2, sigY, 8.5, bold)
    T('Name and surname / Ime i prezime // Signature / Potpis', 30, sigY - 22, 8.5, ital)
    page.drawLine({ start: { x: 300, y: sigY - 24 }, end: { x: W - 26, y: sigY - 24 }, thickness: 0.6, color: BLACK })
    T('PRO.03.04. OBR.1', 30, 26, 8.5); T('IZD./REV.01/02', W - 30 - font.widthOfTextAtSize('IZD./REV.01/02', 8.5), 26, 8.5)
  } else {
    TC('TECHNICAL DEPARTMENT OF TIVAT AIRPORT / TEHNIČKA SLUŽBA AERODROMA TIVAT', W / 2, H - 100, 10, bold)
    TC('Ground Support Equipment (GSE) Daily Checklist / Ček lista dnevne ispravnosti opreme', W / 2, H - 116, 9, ital)
    T('Date / Datum:', 62, H - 148, 10); T(dispDate, 135, H - 148, 10, bold)
    page.drawLine({ start: { x: 133, y: H - 150 }, end: { x: 230, y: H - 150 }, thickness: 0.5, color: BLACK })
    T('Nedjeljni pregled / weekly check:', 350, H - 148, 10); rect(522, H - 153, 12, 12)

    const cw = [76, 104, 178, 66]
    const tw = cw.reduce((a, b) => a + b, 0)
    const x0 = (W - tw) / 2
    const topY = H - 170, headH = 34, rowH = 17.5
    drawHead(x0, topY, cw, headH)
    // zaglavlje OBR2 koristi "No. / Red.br." u jednom redu
    let y = topY - headH
    for (const r of rowsAll) { drawRow(x0, y, cw, rowH, r.g, r.it); y -= rowH }
    // Remarks | Note
    const remH = 92
    rect(x0, y - remH, cw[0] + cw[1], remH, GREY)
    rect(x0 + cw[0] + cw[1], y - remH, cw[2] + cw[3], remH, GREY)
    T('Remarks / Primjedbe:', x0 + 4, y - 12, 8.5)
    let ry = y - 26
    const rw = cw[0] + cw[1] - 8
    if (failed.length) for (const l of wrap(`Neispravno (N): ${failed.join('; ')}`, 7, rw)) { T(l, x0 + 4, ry, 7, bold); ry -= 9 }
    if (cond.length) for (const l of wrap(`Y* sa ograničenjem: ${cond.join('; ')}`, 7, rw)) { T(l, x0 + 4, ry, 7); ry -= 9 }
    wrap(NOTE.replace(/^Note \/ Bilješka: /, 'Note / Bilješka: '), 7.6, cw[2] + cw[3] - 12, ital).forEach((l, i) => T(l, x0 + cw[0] + cw[1] + 6, y - 12 - i * 9.5, 7.6, ital))
    const sigY = y - remH - 38
    T('Checked by: / Pregled izvršio:', x0 + tw - bold.widthOfTextAtSize('Checked by: / Pregled izvrsio:', 8.5), sigY, 8.5, bold)
    T('Name and surname / Ime i prezime // Signature / Potpis:', 42, sigY - 26, 8.5, ital)
    page.drawLine({ start: { x: 300, y: sigY - 28 }, end: { x: W - 40, y: sigY - 28 }, thickness: 0.6, color: BLACK })
    T('PRO.03.04. OBR2', 30, 26, 8.5); T('IZD./REV.01/02', W - 30 - font.widthOfTextAtSize('IZD./REV.01/02', 8.5), 26, 8.5)
  }

  // ---- zaokruživanje Y / N prema digitalnom pregledu ----
  for (const r of ringsFor) {
    if (!r.res) continue
    const sw = isPO ? 46 : 66
    const yc = r.y
    const cx = r.x + sw * (r.res === 'UNFIT' ? 0.66 : 0.28) + 3
    ;(page as PDFPage).drawEllipse({ x: cx, y: yc + 0.5, xScale: 6.2, yScale: 6.2, borderColor: BLACK, borderWidth: 1.1 })
    if (r.res !== 'FIT' && r.res !== 'UNFIT') T('*', cx + 7, yc + 1, 9, bold)
  }
  ringsFor = []

  const bytes = await pdf.save()
  const inline = sp.get('inline') === '1'
  return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${isPO ? 'PRO.03.04.OBR1-PO' : 'PRO.03.04.OBR2-TS'}-${date}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
