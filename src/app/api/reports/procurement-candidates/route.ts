import { NextResponse } from 'next/server'
import { rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { getReplacementCandidates } from '@/lib/actions-procurement'
import { ReportBuilder, pdfResponse, MARGIN, PAGE_WIDTH } from '@/lib/pdf-report-kit'

const TIER_LABELS: Record<string, string> = {
  PRIORITY: 'PRIORITET - razmotriti zamjenu',
  WATCH: 'Pratiti',
  OK: 'OK',
}

const TIER_COLORS: Record<string, ReturnType<typeof rgb>> = {
  PRIORITY: rgb(0.75, 0.1, 0.1),
  WATCH: rgb(0.75, 0.5, 0.05),
  OK: rgb(0.1, 0.5, 0.2),
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const candidates = await getReplacementCandidates()

  const b = await ReportBuilder.create()
  b.header({
    title: 'IZVJEŠTAJ: KANDIDATI ZA ZAMJENU OPREME',
    subtitle: 'Rangiranje flote po učestalosti kvarova, vremenu van stroja i intervalu održavanja - zadnjih 12 mjeseci',
    regRef: 'EASA Part-145 continuing airworthiness / procurement planning support',
    generatedBy: user.full_name,
    generatedRole: user.role,
  })

  const priority = candidates.filter((c) => c.tier === 'PRIORITY')
  const watch = candidates.filter((c) => c.tier === 'WATCH')

  b.kpiRow([
    { label: 'Ukupno sredstava', value: candidates.length },
    { label: 'Prioritet (zamjena)', value: priority.length },
    { label: 'Pratiti', value: watch.length },
    { label: 'OK', value: candidates.length - priority.length - watch.length },
  ])

  b.sectionTitle('Rang-lista (najveći score = najveća potreba za zamjenom)')

  b.tableHeader([
    { x: MARGIN, label: 'Sredstvo' },
    { x: MARGIN + 110, label: 'Tip' },
    { x: MARGIN + 180, label: 'Kvarovi/12mj' },
    { x: MARGIN + 240, label: 'Van stroja (dani)' },
    { x: MARGIN + 320, label: 'Servis %' },
    { x: MARGIN + 380, label: 'Starost' },
    { x: MARGIN + 430, label: 'Trošak/12mj €' },
    { x: PAGE_WIDTH - MARGIN - 70, label: 'Status' },
  ])

  for (const c of candidates) {
    b.ensureSpace(20)
    const serviceRatioPct = c.hoursRatio != null ? `${Math.round(c.hoursRatio * 100)}%` : c.kmRatio != null ? `${Math.round(c.kmRatio * 100)}%` : '-'
    b.text(`${c.code}`, MARGIN, { size: 8, bold: true })
    b.text(c.type.slice(0, 14), MARGIN + 110, { size: 8 })
    b.text(String(c.faultCount12m), MARGIN + 180, { size: 8 })
    b.text(String(c.downtimeDays12m), MARGIN + 240, { size: 8 })
    b.text(serviceRatioPct, MARGIN + 320, { size: 8 })
    b.text(c.ageYears != null ? `${c.ageYears}g` : '-', MARGIN + 380, { size: 8 })
    b.text(c.maintenanceCost12m > 0 ? c.maintenanceCost12m.toFixed(0) : '-', MARGIN + 430, { size: 8 })
    b.text(TIER_LABELS[c.tier], PAGE_WIDTH - MARGIN - 70, { size: 7, bold: c.tier === 'PRIORITY', color: TIER_COLORS[c.tier] })
    b.line(14)
    b.hr(rgb(0.9, 0.9, 0.9))
    b.line(2)
  }

  b.line(10)
  b.sectionTitle('Metodologija (transparentan score - bez novog unosa podataka)')
  const notes = [
    '- Kvarovi/12mj: broj prijava kvara (DamageReport) u zadnjih 12 mjeseci.',
    '- Van stroja: procijenjeni zbir dana koliko je sredstvo bilo neispravno (od prijave do rjesenja, ili do danas ako je jos otvoreno).',
    '- Servis %: odnos trenutnih radnih sati/km naspram intervala redovnog servisa (100%+ = dospjelo/prekoraceno).',
    '- Starost: godina proizvodnje (modelYear) u odnosu na danasnju godinu - prikazuje se samo ako je podatak unesen.',
    '- Trošak/12mj: zbir troskova iz Maintenance Log-a u zadnjih 12 mjeseci (ako su troskovi uneseni).',
    '- Status "PRIORITET" = score >= 55, "Pratiti" = score 30-54, "OK" = score < 30. Score nije automatska odluka - sluzi kao polazna tacka za planiranje nabavke.',
  ]
  for (const n of notes) {
    b.ensureSpace(16)
    b.text(n, MARGIN, { size: 8, color: rgb(0.4, 0.4, 0.4) })
    b.line(12)
  }

  b.certificationBlock(user.full_name, user.role, 'GSE Control - izvjestaj za potrebe planiranja nabavke/zamjene opreme')
  b.finalizePageNumbers()

  const bytes = await b.save()
  return pdfResponse(bytes, `kandidati-za-zamjenu-${new Date().toISOString().slice(0, 10)}.pdf`)
}
