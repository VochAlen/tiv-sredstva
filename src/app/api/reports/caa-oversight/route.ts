import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { getIncidentStats } from '@/lib/actions-incidents'
import { getFodStats, getWildlifeStats, getFitnessDeclarations } from '@/lib/actions-safety-reports'
import { getAuditSummary } from '@/lib/actions-audit'
import { getSMSSummary } from '@/lib/actions-sms'
import { getAllCRS } from '@/lib/actions-crs'
import { localDate } from '@/lib/local-day'
import {
  W, H, M, NAVY, ACCENT, INK, MUTED, LINE, ZEBRA, GREEN, AMBER, RED, WHITE,
  makeCtx, drawHeader, drawKpis, drawRemarksAndFooter, prettyDate, type Ctx,
} from '@/lib/pdf-gse-kit'

// =====================================================
// CAA MONTENEGRO — NADZORNI IZVJESTAJ (Part-ADR.AR), A4 portrait, jedna strana
//
// Dok ostali izvjestaji dokazuju da AERODROM (operator) ispunjava
// ADR.OR/ADR.OPS, ovaj izvjestaj je namijenjen CAA Montenegro - organu
// nadleznom za kontinuirani nadzor aerodroma (ADR.AR.C.040 - "competent
// authority shall monitor... on an on-going basis"). Zato sadrzi SAMO
// agregatne brojke i trendove (compliance rate, otvoreni nalazi, hazardi,
// incidenti, FOD/wildlife, fitness-for-duty stopa) - NIKAD licna imena
// osoblja ili operativne detalje, cak i kad su ti podaci dostupni u
// pozadinskim funkcijama.
// Dizajn: isti kao GSE dnevne liste i kartoni (pdf-gse-kit).
// =====================================================

const GAP = 12
const PANEL_W = (W - 2 * M - GAP) / 2

type Metric = [label: string, value: string | number, color?: ReturnType<typeof rgb>]

/** Panel sa naslovom; vraca y ispod naslova (pocetak sadrzaja). */
function panel(c: Ctx, x: number, top: number, h: number, title: string): number {
  c.page.drawRectangle({ x, y: top - h, width: PANEL_W, height: h, borderColor: LINE, borderWidth: 0.8 })
  c.page.drawRectangle({ x, y: top - 15, width: PANEL_W, height: 15, color: NAVY })
  c.T(title, x + 8, top - 10.5, 7.2, c.bold, WHITE)
  return top - 15 - 6
}

function metrics(c: Ctx, x: number, y: number, items: Metric[]): number {
  items.forEach(([label, value, color], i) => {
    const yy = y - 9 - i * 14
    if (i % 2 === 0) c.page.drawRectangle({ x: x + 1, y: yy - 4, width: PANEL_W - 2, height: 14, color: ZEBRA })
    c.T(label, x + 8, yy, 7.6, c.font, INK)
    c.TR(String(value), x + PANEL_W - 8, yy, 8.6, c.bold, color ?? NAVY)
  })
  return y - items.length * 14 - 2
}

function bars(c: Ctx, x: number, y: number, items: Array<[string, number, ReturnType<typeof rgb>]>): number {
  const max = Math.max(1, ...items.map((i) => i[1]))
  const labelW = 62, valW = 22
  const trackW = PANEL_W - 16 - labelW - valW
  items.forEach(([label, value, color], i) => {
    const yy = y - 9 - i * 13
    c.T(label, x + 8, yy, 6.8, c.bold, MUTED)
    c.page.drawRectangle({ x: x + 8 + labelW, y: yy - 2, width: trackW, height: 8, color: ZEBRA })
    if (value > 0) c.page.drawRectangle({ x: x + 8 + labelW, y: yy - 2, width: Math.max(2, (value / max) * trackW), height: 8, color })
    c.TR(String(value), x + PANEL_W - 8, yy, 8, c.bold, INK)
  })
  return y - items.length * 13 - 2
}

function subTitle(c: Ctx, x: number, y: number, text: string): number {
  c.T(text, x + 8, y - 8, 6.6, c.bold, ACCENT)
  return y - 12
}

export async function GET(request: NextRequest) {
  void request
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const since = new Date()
  since.setMonth(since.getMonth() - 12)

  const [incidentStats, fodStats, wildlifeStats, auditSummary, smsSummary, crsList, fitnessDeclarations] =
    await Promise.all([
      getIncidentStats(),
      getFodStats(),
      getWildlifeStats(),
      getAuditSummary(),
      getSMSSummary(),
      getAllCRS(),
      getFitnessDeclarations({ limit: 2000 }),
    ])

  // CRS — samo brojke po statusu, bez detalja o certifikatoru
  const crsActive = crsList.filter((c: any) => c.status === 'ACTIVE').length
  const crsRevoked = crsList.filter((c: any) => c.status === 'REVOKED').length
  const crsExpired = crsList.filter((c: any) => c.validUntil && new Date(c.validUntil) < new Date() && c.status === 'ACTIVE').length

  // Fitness-for-duty — agregatna stopa potvrda za zadnjih 12 mjeseci (NIKAD imena)
  const recentDeclarations = (fitnessDeclarations as any[]).filter((f) => new Date(f.declaredAt) >= since)
  const fitnessTotal = recentDeclarations.length
  const fitnessConfirmed = recentDeclarations.filter((f) => f.confirmed).length
  const fitnessRate = fitnessTotal > 0 ? (fitnessConfirmed / fitnessTotal) * 100 : 100

  const pdf = await PDFDocument.create()
  pdf.setTitle('CAA Montenegro - nadzorni izvjestaj (Part-ADR.AR)')
  pdf.setAuthor('GSE Control - Aerodrom Tivat')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([W, H])
  const c = makeCtx(page, font, bold)
  const { T, fit } = c

  const today = localDate(new Date())
  const sinceIso = localDate(since)
  const headerBottom = drawHeader(c, {
    title: 'NADZORNI IZVJESTAJ ZA CAA MONTENEGRO',
    subtitle: 'Continuous Oversight Report  |  Part-ADR.AR  |  ADR.AR.C.040 / ADR.AR.C.050',
    line3: 'Aerodrom Tivat (LYTV)  -  samo agregatni pokazatelji, bez licnih podataka',
    bigRight: prettyDate(today),
    smallRight: `TRENDOVI: ZADNJIH 12 MJESECI`,
    smallRight2: `od ${prettyDate(sinceIso)}`,
  })

  const good = (ok: boolean) => (ok ? GREEN : RED)
  const kBottom = drawKpis(c, headerBottom - 9, [
    ['COMPLIANCE RATE', `${auditSummary.compliance.rate.toFixed(0)}%`, auditSummary.compliance.rate >= 90 ? GREEN : auditSummary.compliance.rate >= 75 ? AMBER : RED],
    ['OTVORENI NALAZI', auditSummary.findings.open, auditSummary.findings.open === 0 ? GREEN : AMBER],
    ['NALAZI DOSPJELI', auditSummary.findings.overdue, good(auditSummary.findings.overdue === 0)],
    ['OTVORENI INCIDENTI', incidentStats.open, incidentStats.open === 0 ? GREEN : AMBER],
    ['OTVORENI HAZARDI', smsSummary.hazards.open, smsSummary.hazards.open === 0 ? GREEN : AMBER],
    ['FITNESS STOPA', `${fitnessRate.toFixed(0)}%`, fitnessRate >= 98 ? GREEN : fitnessRate >= 90 ? AMBER : RED],
  ])

  const xL = M, xR = M + PANEL_W + GAP
  let top = kBottom - 12

  // ---------- Red 1: Audit | SMS ----------
  const h1 = 156
  {
    let y = panel(c, xL, top, h1, '1. AUDIT & COMPLIANCE  (Part-145 / ADR.OR)')
    y = metrics(c, xL, y, [
      ['Programi audita (dospjelih)', `${auditSummary.programs.total}  (${auditSummary.programs.overdue})`, good(auditSummary.programs.overdue === 0)],
      ['Sprovedeni auditi', `${auditSummary.audits.completed} / ${auditSummary.audits.total}`],
      ['Compliance stavke usklađene', `${auditSummary.compliance.compliant} / ${auditSummary.compliance.total}  (${auditSummary.compliance.rate.toFixed(1)}%)`],
      ['Neusklađeno / djelimično', `${auditSummary.compliance.nonCompliant} / ${auditSummary.compliance.partial}`, auditSummary.compliance.nonCompliant === 0 ? GREEN : RED],
    ])
    y = subTitle(c, xL, y, 'NALAZI PO KLASIFIKACIJI')
    y = bars(c, xL, y, [
      ['MAJOR', auditSummary.findings.major, rgb(0.75, 0.2, 0.2)],
      ['MINOR', auditSummary.findings.minor, rgb(0.85, 0.6, 0.1)],
      ['OBSERVATION', auditSummary.findings.observations, rgb(0.3, 0.5, 0.75)],
    ])
    T(`CAPA: ${auditSummary.capas.open} otvoreno  |  ${auditSummary.capas.overdue} dospjelo  |  ${auditSummary.capas.verified} zatvoreno`, xL + 8, y - 9, 7.4, bold, NAVY)
  }
  {
    let y = panel(c, xR, top, h1, '2. SAFETY MANAGEMENT SYSTEM  (SMS)')
    y = metrics(c, xR, y, [
      ['Hazardi ukupno', smsSummary.hazards.total],
      ['Otvoreno', smsSummary.hazards.open, smsSummary.hazards.open === 0 ? GREEN : AMBER],
      ['Dospjelo za mjeru', smsSummary.hazards.overdue, good(smsSummary.hazards.overdue === 0)],
    ])
    y = subTitle(c, xR, y, 'HAZARDI PO NIVOU RIZIKA')
    y = bars(c, xR, y, [
      ['KRITICAN', smsSummary.hazards.byRiskLevel.CRITICAL ?? 0, rgb(0.75, 0.15, 0.15)],
      ['VISOK', smsSummary.hazards.byRiskLevel.HIGH ?? 0, rgb(0.85, 0.45, 0.1)],
      ['SREDNJI', smsSummary.hazards.byRiskLevel.MEDIUM ?? 0, rgb(0.85, 0.7, 0.15)],
      ['NIZAK', smsSummary.hazards.byRiskLevel.LOW ?? 0, rgb(0.3, 0.65, 0.35)],
    ])
    // SPI (Safety Performance Indicators) kao tri oznake
    T('SPI', xR + 8, y - 9, 6.8, bold, MUTED)
    let px = xR + 34
    ;([['GREEN', smsSummary.spis.green, GREEN], ['AMBER', smsSummary.spis.amber, AMBER], ['RED', smsSummary.spis.red, RED]] as const).forEach(([l, n, col]) => {
      const txt = `${l}  ${n}`
      const w = bold.widthOfTextAtSize(txt, 7) + 12
      page.drawRectangle({ x: px, y: y - 12, width: w, height: 12, color: col })
      T(txt, px + 6, y - 9, 7, bold, WHITE)
      px += w + 5
    })
  }
  top -= h1 + 10

  // ---------- Red 2: Incidenti | FOD & Wildlife ----------
  const h2 = 78
  {
    let y = panel(c, xL, top, h2, '3. INCIDENTI  (ADR.OPS)')
    y = metrics(c, xL, y, [
      ['Ukupno prijavljenih', incidentStats.total],
      ['Otvoreno', incidentStats.open, incidentStats.open === 0 ? GREEN : AMBER],
      ['SMOR obavezan', incidentStats.smorRequired],
      ['Sa povredama', incidentStats.withInjuries, incidentStats.withInjuries === 0 ? GREEN : RED],
    ])
    void y
  }
  {
    let y = panel(c, xR, top, h2, '4. FOD & WILDLIFE  (ADR.OPS.B.016 / B.020)')
    y = metrics(c, xR, y, [
      ['FOD prijave (12 mj.)', fodStats.last12m],
      ['FOD prijave ukupno', fodStats.total],
      ['Wildlife opažanja', wildlifeStats.total],
      ['Wildlife sudari (strikes)', wildlifeStats.strikes, wildlifeStats.strikes === 0 ? GREEN : RED],
    ])
    void y
  }
  top -= h2 + 10

  // ---------- Red 3: Fitness | CRS ----------
  const h3 = 78
  {
    const y = panel(c, xL, top, h3, '5. FITNESS FOR DUTY  (ADR.OR.C.045)')
    const col = fitnessRate >= 98 ? GREEN : fitnessRate >= 90 ? AMBER : RED
    T(`${fitnessRate.toFixed(1)}%`, xL + 8, y - 20, 20, bold, col)
    T(`potvrda sposobnosti (${fitnessConfirmed} / ${fitnessTotal}), zadnjih 12 mj.`, xL + 8 + bold.widthOfTextAtSize(`${fitnessRate.toFixed(1)}%`, 20) + 8, y - 14, 6.8, font, MUTED)
    const trackW = PANEL_W - 16
    page.drawRectangle({ x: xL + 8, y: y - 36, width: trackW, height: 7, color: ZEBRA })
    page.drawRectangle({ x: xL + 8, y: y - 36, width: Math.max(2, (fitnessRate / 100) * trackW), height: 7, color: col })
    T(fit('Evidentira se samo potvrda da/ne i vrijeme - bez zdravstvenih podataka.', font, 6.4, trackW), xL + 8, y - 49, 6.4, font, MUTED)
  }
  {
    let y = panel(c, xR, top, h3, '6. CERTIFICATE OF RELEASE TO SERVICE  (Part-145.A.50)')
    y = metrics(c, xR, y, [
      ['Aktivni CRS', crsActive, GREEN],
      ['Povučeni', crsRevoked, crsRevoked === 0 ? GREEN : AMBER],
      ['Istekli (još aktivni u sistemu)', crsExpired, crsExpired === 0 ? GREEN : RED],
    ])
    void y
  }
  top -= h3 + 10

  // ---------- Napomena + okvir za zapazanja ----------
  const note = 'Izvjestaj je generisan automatski iz GSE Control sistema radi podrske kontinuiranom nadzoru CAA Montenegro nad Aerodromom Tivat (ADR.AR.C.040). Sadrzi samo agregatne pokazatelje.'
  const words = note.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(next, 6.8) > W - 2 * M) { lines.push(line); line = w } else line = next
  }
  if (line) lines.push(line)
  lines.forEach((l, i) => T(l, M, top - 4 - i * 9, 6.8, font, MUTED))

  drawRemarksAndFooter(c, {
    boxTop: Math.max(130, top - 4 - lines.length * 9 - 14), boxBottom: 80,
    generatedBy: user.full_name || user.email,
    generatedAt: `${prettyDate(today)} ${new Date().toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Podgorica' })} (${user.role})`,
    remarksTitle: 'ZAPAZANJA / REMARKS',
    sigLabels: ['Odgovorni rukovodilac / Accountable Manager (potpis)', 'Za CAA Montenegro / Received (potpis i pecat)'],
    right: 'CAA nadzorni izvjestaj  |  Aerodrom Tivat (LYTV)',
  })
  void MUTED

  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="caa-nadzorni-izvjestaj.pdf"',
      'Cache-Control': 'no-store',
    },
  })
}
