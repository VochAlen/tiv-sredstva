// src/app/api/reports/competence-attempt/route.ts
// Izvještaj o provjeri osposobljenosti jednog radnika u formi MENTORSKOG IZVJEŠTAJA (A4):
// podaci o radniku i testu, sva pitanja sa odgovorima, nadzirane smjene uz mentora i polja za potpise.
// engineer i admin. Pitanja dolaze iz snimka u trenutku testa (revizijski trag).

import { NextResponse, type NextRequest } from 'next/server'
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { hasServiceClient } from '@/lib/supabase/service'
import { localDate } from '@/lib/competence-server'
import { transliterate as tr } from '@/lib/pdf-utils'
import { AUDIENCE_LABEL, COMPETENCE_RULES, type Audience } from '@/lib/competence-logic'
import { loadAttemptDetail, KIND_LABEL, fmtDateTime } from '@/lib/competence-results'
import { W, H, M, NAVY, INK, MUTED, ZEBRA, GREEN, AMBER, RED, WHITE, makeCtx, drawHeader, drawKpis, prettyDate, type Ctx } from '@/lib/pdf-gse-kit'

export const dynamic = 'force-dynamic'
const BOTTOM = 70

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  if (user.role !== 'admin' && user.role !== 'engineer') return new NextResponse('Forbidden', { status: 403 })
  if (isDemoMode() || !hasServiceClient()) return new NextResponse('Dostupno samo uz Supabase bazu', { status: 503 })

  const d = await loadAttemptDetail(req.nextUrl.searchParams.get('id') ?? '')
  if (!d) return new NextResponse('Pokušaj nije pronađen', { status: 404 })

  const pdf = await PDFDocument.create()
  pdf.setTitle(tr(`Izvjestaj o provjeri osposobljenosti - ${d.name}`))
  pdf.setAuthor('GSE Control - Aerodrom Tivat')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const wrap = (s: string, f: PDFFont, size: number, maxW: number): string[] => {
    const words = tr(String(s || '')).split(' '); const out: string[] = []; let cur = ''
    for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (f.widthOfTextAtSize(t, size) > maxW && cur) { out.push(cur); cur = w } else cur = t }
    if (cur) out.push(cur); return out.length ? out : ['']
  }

  const right = d.items.filter((i) => i.ok).length
  const wrong = d.items.length - right
  const outcome = d.passed ? 'POLOZIO' : d.criticalFailed ? 'PAO (sigurnosno pitanje)' : 'PAO'
  const outcomeColor = d.passed ? GREEN : RED

  const newPage = (first: boolean): { c: Ctx; y: number } => {
    const page = pdf.addPage([W, H]); const c = makeCtx(page, font, bold)
    if (first) {
      const hb = drawHeader(c, {
        title: 'IZVJESTAJ O PROVJERI OSPOSOBLJENOSTI', subtitle: 'Mentorski izvjestaj  |  ADR.OR.D.017, ADR.OPS.B.024',
        line3: 'GSE Control  -  Aerodrom Tivat (LYTV)', bigRight: prettyDate(localDate(new Date(d.takenAt))), smallRight: `REF: ${d.id.slice(0, 8).toUpperCase()}`,
      })
      const kb = drawKpis(c, hb - 9, [['TACNO', right, GREEN], ['POGRESNO', wrong, RED], ['PITANJA', d.items.length, NAVY], ['REZULTAT %', d.scorePct, outcomeColor]])
      return { c, y: kb - 12 }
    }
    c.page.drawRectangle({ x: 0, y: H - 26, width: W, height: 26, color: NAVY })
    c.T(tr(`IZVJESTAJ O PROVJERI OSPOSOBLJENOSTI - ${d.name}`).toUpperCase(), M, H - 17, 9, bold, WHITE)
    return { c, y: H - 40 }
  }
  let { c, y } = newPage(true)
  const section = (title: string) => {
    if (y - 40 < BOTTOM) ({ c, y } = newPage(false))
    c.page.drawRectangle({ x: M, y: y - 13, width: W - 2 * M, height: 14, color: NAVY })
    c.T(title, M + 4, y - 9, 8, bold, WHITE)
    y -= 18
  }
  const inner = W - 2 * M

  // 1. Radnik i test
  section('1. RADNIK I PROVJERA')
  const info: [string, string][] = [
    ['Ime i prezime', d.name], ['ID kartica', d.cardId], ['Sluzba', d.department || '-'], ['Uloga (set pitanja)', AUDIENCE_LABEL[d.audience as Audience] ?? d.audience],
    ['Vrsta provjere', KIND_LABEL[d.kind] ?? d.kind], ['Datum i vrijeme testa', fmtDateTime(d.takenAt)],
    ['Prag prolaza', d.passPct != null ? `${d.passPct}%` : '-'], ['Zadao / nadzirao', d.takenBy === 'SELF' || !d.takenBy ? 'Radnik sam (ID kartica)' : d.takenBy],
  ]
  const colW = inner / 2
  for (let i = 0; i < info.length; i += 2) {
    for (let k = 0; k < 2; k++) {
      const it = info[i + k]; if (!it) continue
      const x = M + 4 + k * colW
      c.T(tr(it[0]).toUpperCase(), x, y - 7, 6, font, MUTED)
      c.T(wrap(it[1], bold, 8.5, colW - 12)[0], x, y - 17, 8.5, bold, INK)
    }
    y -= 23
  }
  c.page.drawRectangle({ x: M, y: y - 16, width: 150, height: 16, color: outcomeColor })
  c.T(`ISHOD: ${outcome}`, M + 6, y - 11.5, 8.5, bold, WHITE)
  if (!d.snapshot) c.T(tr('Tekst pitanja procitan iz banke pitanja (test nema snimak iz trenutka polaganja).'), M + 160, y - 11, 6.4, font, MUTED)
  y -= 26

  // 2. Pitanja
  section('2. PITANJA I ODGOVORI')
  const X = { n: M + 4, q: M + 22, a: M + 232, ok: M + 362, st: M + 452 }
  const header = () => {
    c.T('Br', X.n, y - 8, 6.6, bold, MUTED); c.T('Pitanje', X.q, y - 8, 6.6, bold, MUTED)
    c.T('Odgovor radnika', X.a, y - 8, 6.6, bold, MUTED); c.T('Tacan odgovor', X.ok, y - 8, 6.6, bold, MUTED); c.T('Ishod', X.st, y - 8, 6.6, bold, MUTED)
    y -= 12
  }
  header()
  d.items.forEach((it, idx) => {
    const qL = wrap(`${it.topic ? `[${it.topic}] ` : ''}${it.question || '(pitanje je obrisano)'}`, font, 6.8, 202)
    const given = it.chosen >= 0 ? it.options[it.chosen] ?? `(odgovor ${it.chosen + 1})` : '(bez odgovora)'
    const aL = wrap(given, font, 6.8, 122)
    const cL = wrap(it.options[it.correct] ?? '-', font, 6.8, 118)
    const h = Math.max(qL.length, aL.length, cL.length, 2) * 8.4 + 5
    if (y - h < BOTTOM) { ;({ c, y } = newPage(false)); header() }
    if (idx % 2 === 0) c.page.drawRectangle({ x: M, y: y - h, width: inner, height: h, color: ZEBRA })
    c.T(String(it.n), X.n, y - 9, 6.8, bold, INK)
    qL.forEach((l, k) => c.T(l, X.q, y - 9 - k * 8.4, 6.8, font, INK))
    aL.forEach((l, k) => c.T(l, X.a, y - 9 - k * 8.4, 6.8, it.ok ? font : bold, it.ok ? INK : RED))
    cL.forEach((l, k) => c.T(l, X.ok, y - 9 - k * 8.4, 6.8, font, INK))
    c.page.drawRectangle({ x: X.st, y: y - 14, width: 48, height: 11, color: it.ok ? GREEN : RED })
    c.T(it.ok ? 'TACNO' : 'POGRESNO', X.st + 3, y - 11.5, 6.4, bold, WHITE)
    if (it.critical) c.T('SIGURNOSNO', X.st, y - 22, 5.8, bold, AMBER)
    y -= Math.max(h, it.critical ? 26 : 0)
  })
  y -= 10

  // 3. Nadzor mentora (poslije pada ili prije ponovnog testa)
  const supervised = !d.passed || d.kind === 'RETEST' || d.shifts.length > 0
  if (supervised) {
    const required = d.supervisedRequired || COMPETENCE_RULES.supervisedShiftsRequired
    section('3. NADZOR MENTORA (smjene pod nadzorom)')
    c.T(tr(`Nadzirane smjene: ${Math.min(d.shifts.length, required)}/${required}. Poslije pada radnik radi uz imenovanog mentora, a zatim polaze ponovni test.`), M + 4, y - 7, 7, font, INK)
    y -= 14
    const SX = { dt: M + 4, mn: M + 90, eq: M + 270, sg: M + 360 }
    c.T('Datum smjene', SX.dt, y - 8, 6.6, bold, MUTED); c.T('Mentor (ime i prezime)', SX.mn, y - 8, 6.6, bold, MUTED)
    c.T('Sredstvo', SX.eq, y - 8, 6.6, bold, MUTED); c.T('Potpis mentora', SX.sg, y - 8, 6.6, bold, MUTED)
    y -= 12
    const rowsN = Math.max(d.shifts.length, d.passed ? 0 : required)
    for (let i = 0; i < rowsN; i++) {
      if (y - 20 < BOTTOM) { ;({ c, y } = newPage(false)) }
      const s = d.shifts[i]
      if (i % 2 === 0) c.page.drawRectangle({ x: M, y: y - 20, width: inner, height: 20, color: ZEBRA })
      if (s) {
        c.T(tr(new Intl.DateTimeFormat('sr-Latn-ME', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${s.date}T00:00:00Z`))), SX.dt, y - 13, 7.4, font, INK)
        c.T(wrap(s.mentor, font, 7.4, 170)[0], SX.mn, y - 13, 7.4, font, INK)
        c.T(wrap(s.equipment ?? '-', font, 7.4, 80)[0], SX.eq, y - 13, 7.4, font, INK)
      }
      c.page.drawLine({ start: { x: SX.sg, y: y - 16 }, end: { x: W - M - 6, y: y - 16 }, thickness: 0.5, color: MUTED })
      y -= 20
    }
    y -= 10
  }

  // 4. Potpisi
  if (y - 110 < BOTTOM) ({ c, y } = newPage(false))
  section(`${supervised ? '4' : '3'}. POTPISI`)
  const labels = ['Radnik (ime i potpis)', 'Mentor / nadzirao (ime i potpis)', 'Odgovorni za obuku (potpis i pecat)']
  const sw = (inner - 20) / 3
  labels.forEach((l, i) => {
    const x = M + i * (sw + 10)
    c.page.drawLine({ start: { x, y: y - 40 }, end: { x: x + sw, y: y - 40 }, thickness: 0.6, color: INK })
    c.T(tr(l), x, y - 50, 6.8, font, MUTED)
  })
  c.T(tr('Datum: ____ . ____ . ________'), M, y - 72, 7, font, MUTED)

  // podnožje na svim stranicama
  const stamp = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`
  const pages = pdf.getPages()
  pages.forEach((p, i) => {
    p.drawText(tr(`GSE Control - Izvjestaj o provjeri osposobljenosti  |  Generisao: ${user.full_name || user.email}, ${stamp}`), { x: M, y: 28, size: 6.4, font, color: rgb(0.45, 0.45, 0.45) })
    p.drawText(`Strana ${i + 1}/${pages.length}`, { x: W - M - 46, y: 28, size: 6.4, font, color: rgb(0.45, 0.45, 0.45) })
  })

  const bytes = await pdf.save()
  const safe = tr(d.name).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'radnik'
  return new NextResponse(Buffer.from(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="mentorski-izvjestaj-${safe}-${d.takenAt.slice(0, 10)}.pdf"`, 'Cache-Control': 'no-store' } })
}
