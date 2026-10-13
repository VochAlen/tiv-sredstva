import { NextRequest, NextResponse } from 'next/server'
import { rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { ReportBuilder, pdfResponse } from '@/lib/pdf-report-kit'
import { getIncidentStats } from '@/lib/actions-incidents'
import { getFodStats, getWildlifeStats, getFitnessDeclarations } from '@/lib/actions-safety-reports'
import { getAuditSummary } from '@/lib/actions-audit'
import { getSMSSummary } from '@/lib/actions-sms'
import { getAllCRS } from '@/lib/actions-crs'

// =====================================================
// CAA MONTENEGRO — NADZORNI IZVJESTAJ (Part-ADR.AR)
//
// Dok ostali izvjestaji dokazuju da AERODROM (operator) ispunjava
// ADR.OR/ADR.OPS, ovaj izvjestaj je namijenjen CAA Montenegro - organu
// nadleznom za kontinuirani nadzor aerodroma (ADR.AR.C.040 - "competent
// authority shall monitor... on an on-going basis"). Zato sadrzi SAMO
// agregatne brojke i trendove (compliance rate, otvoreni nalazi, hazardi,
// incidenti, FOD/wildlife, fitness-for-duty stopa) - NIKAD licna imena
// osoblja ili operativne detalje, cak i kad su ti podaci dostupni u
// pozadinskim funkcijama.
// =====================================================

export async function GET(request: NextRequest) {
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

  const b = await ReportBuilder.create()

  b.header({
    title: 'IZVJESTAJ ZA CAA MONTENEGRO — KONTINUIRANI NADZOR AERODROMA',
    subtitle: 'Aerodrom Tivat (LYTV) — podrska nadleznom organu u ispunjavanju Part-ADR.AR obaveze nadzora',
    regRef: 'ADR.AR.C.040 (kontinuirani nadzor) · ADR.AR.C.050 (nalazi i korektivne mjere)',
    generatedBy: user.full_name,
    generatedRole: user.role,
    extra: [`Period trendova: zadnjih 12 mjeseci (od ${since.toLocaleDateString('hr-HR')})`],
  })

  b.kpiRow([
    { label: 'Compliance rate', value: `${auditSummary.compliance.rate.toFixed(0)}%` },
    { label: 'Otvoreni nalazi', value: auditSummary.findings.open },
    { label: 'Nalazi dospjeli', value: auditSummary.findings.overdue },
    { label: 'Otvoreni incidenti', value: incidentStats.open },
  ])

  // --- AUDIT & COMPLIANCE ---
  b.sectionTitle('1. AUDIT & COMPLIANCE (Part-145 / ADR.OR interni sistem)')
  b.text(`Programi audita: ${auditSummary.programs.total} (dospjelih: ${auditSummary.programs.overdue})  ·  Sprovedeni auditi: ${auditSummary.audits.completed}/${auditSummary.audits.total}`, 50, { size: 9 })
  b.line(16)
  b.text(`Compliance stavke: ${auditSummary.compliance.compliant}/${auditSummary.compliance.total} usklađeno (${auditSummary.compliance.rate.toFixed(1)}%)  ·  Neusklađeno: ${auditSummary.compliance.nonCompliant}  ·  Djelimično: ${auditSummary.compliance.partial}`, 50, { size: 9 })
  b.line(18)
  b.text('Nalazi po klasifikaciji:', 50, { size: 9, bold: true })
  b.line(14)
  const findingsMax = Math.max(1, auditSummary.findings.major, auditSummary.findings.minor, auditSummary.findings.observations)
  b.bar('MAJOR', auditSummary.findings.major, findingsMax, rgb(0.75, 0.2, 0.2))
  b.bar('MINOR', auditSummary.findings.minor, findingsMax, rgb(0.85, 0.6, 0.1))
  b.bar('OBSERVATION', auditSummary.findings.observations, findingsMax, rgb(0.3, 0.5, 0.75))
  b.line(4)
  b.text(`CAPA: ${auditSummary.capas.open} otvoreno, ${auditSummary.capas.overdue} dospjelo, ${auditSummary.capas.verified} verifikovano/zatvoreno`, 50, { size: 9 })
  b.line(18)

  // --- SMS ---
  b.sectionTitle('2. SAFETY MANAGEMENT SYSTEM (SMS)')
  b.text(`Hazardi: ${smsSummary.hazards.total} ukupno  ·  ${smsSummary.hazards.open} otvoreno  ·  ${smsSummary.hazards.overdue} dospjelo za mjeru`, 50, { size: 9 })
  b.line(16)
  b.text('Hazardi po nivou rizika:', 50, { size: 9, bold: true })
  b.line(14)
  const riskMax = Math.max(1, ...(Object.values(smsSummary.hazards.byRiskLevel) as number[]))
  b.bar('KRITICAN', smsSummary.hazards.byRiskLevel.CRITICAL ?? 0, riskMax, rgb(0.75, 0.15, 0.15))
  b.bar('VISOK', smsSummary.hazards.byRiskLevel.HIGH ?? 0, riskMax, rgb(0.85, 0.45, 0.1))
  b.bar('SREDNJI', smsSummary.hazards.byRiskLevel.MEDIUM ?? 0, riskMax, rgb(0.85, 0.7, 0.15))
  b.bar('NIZAK', smsSummary.hazards.byRiskLevel.LOW ?? 0, riskMax, rgb(0.3, 0.65, 0.35))
  b.line(4)
  b.text(`Safety Performance Indicators: ${smsSummary.spis.green} GREEN · ${smsSummary.spis.amber} AMBER · ${smsSummary.spis.red} RED`, 50, { size: 9 })
  b.line(18)

  // --- INCIDENTI ---
  b.sectionTitle('3. INCIDENTI (ADR.OPS)')
  b.text(`Ukupno: ${incidentStats.total}  ·  Otvoreno: ${incidentStats.open}  ·  SMOR obavezan: ${incidentStats.smorRequired}  ·  Sa povredama: ${incidentStats.withInjuries}`, 50, { size: 9 })
  b.line(18)

  // --- FOD / WILDLIFE ---
  b.sectionTitle('4. FOD & WILDLIFE (ADR.OPS.B.016 / ADR.OPS.B.020)')
  b.text(`FOD prijave (12mj): ${fodStats.last12m} (ukupno: ${fodStats.total})  ·  Wildlife opažanja: ${wildlifeStats.total}  ·  Sudari: ${wildlifeStats.strikes}`, 50, { size: 9 })
  b.line(18)

  // --- FITNESS FOR DUTY ---
  b.sectionTitle('5. FITNESS FOR DUTY (ADR.OR.C.045)')
  b.text(`Potvrda sposobnosti za rad prije svakog zaduženja/razduženja — stopa potvrđivanja (12mj): ${fitnessRate.toFixed(1)}% (${fitnessConfirmed}/${fitnessTotal})`, 50, { size: 9 })
  b.line(12)
  b.text('Napomena: evidentira se samo potvrda da/ne i vrijeme — bez zdravstvenih podataka.', 50, { size: 7, color: rgb(0.5, 0.5, 0.5) })
  b.line(18)

  // --- CRS ---
  b.sectionTitle('6. CERTIFICATE OF RELEASE TO SERVICE (Part-145.A.50)')
  b.text(`Aktivni CRS: ${crsActive}  ·  Povučeni: ${crsRevoked}  ·  Istekli (još aktivni u sistemu): ${crsExpired}`, 50, { size: 9 })

  b.certificationBlock(
    user.full_name,
    user.role,
    'Ovaj izvjestaj je generisan automatski iz GSE Control sistema radi podrske kontinuiranom nadzoru CAA Montenegro nad Aerodromom Tivat (ADR.AR.C.040). Sadrzi samo agregatne pokazatelje.',
  )
  b.finalizePageNumbers('GSE Control - CAA nadzorni izvjestaj - Tivat Airport (LYTV)')

  const pdf = await b.save()
  return pdfResponse(pdf, 'caa-nadzorni-izvjestaj.pdf')
}
