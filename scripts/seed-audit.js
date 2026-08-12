// Seed Audit & Compliance data
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const now = new Date()
  const lastWeek = new Date(now.getTime() - 7 * 86400000)
  const lastMonth = new Date(now.getTime() - 30 * 86400000)
  const last3Months = new Date(now.getTime() - 90 * 86400000)
  const nextWeek = new Date(now.getTime() + 7 * 86400000)
  const nextMonth = new Date(now.getTime() + 30 * 86400000)

  // 1. Audit Program — Q1 2026 GSE Operations
  const p1 = await prisma.auditProgram.create({
    data: {
      programId: 'AP-2026-001',
      title: 'Interni audit GSE operacija Q1 2026',
      auditType: 'INTERNAL',
      auditScope: 'GSE maintenance, QR check-out sistem, fuel operations, driver authorization',
      auditStandard: 'EASA Part-145 · ADR.OPS.D.005',
      plannedYear: 2026,
      plannedQuarter: 1,
      plannedDate: lastMonth,
      actualDate: lastMonth,
      completedAt: lastMonth,
      leadAuditor: 'Milica Medenica',
      leadAuditorCardId: 'EMP-1004',
      auditees: 'Maintenance Dept, Ramp Ops, Fuel Service',
      status: 'COMPLETED',
      priority: 'HIGH',
      findingsCount: 5,
      majorFindings: 1,
      minorFindings: 3,
      observations: 1,
      overallResult: 'NON_CONFORMANT',
      notes: 'Kompletan pregled GSE operacija sa fokusom na Part-145 compliance',
    },
  })

  // 2. Program — Q2 SMS audit
  const p2 = await prisma.auditProgram.create({
    data: {
      programId: 'AP-2026-002',
      title: 'Audit SMS sistema Q2 2026',
      auditType: 'SYSTEM',
      auditScope: 'Safety Management System — hazard identification, risk assessment, SPI/SPT',
      auditStandard: 'ICAO Annex 19 · EASA M.GEN.205',
      plannedYear: 2026,
      plannedQuarter: 2,
      plannedDate: nextMonth,
      leadAuditor: 'Blažo Adžić',
      leadAuditorCardId: 'EMP-1005',
      auditees: 'Safety Department, All Operational Units',
      status: 'SCHEDULED',
      priority: 'CRITICAL',
    },
  })

  // 3. Program — Q3 Compliance audit
  const p3 = await prisma.auditProgram.create({
    data: {
      programId: 'AP-2026-003',
      title: 'Compliance audit aerodromskih inspekcija Q3 2026',
      auditType: 'COMPLIANCE',
      auditScope: 'Daily inspection program, NOTAM procedure, FOD management',
      auditStandard: 'ADR.OPS.B.005 · ICAO Annex 14',
      plannedYear: 2026,
      plannedQuarter: 3,
      leadAuditor: 'Milica Medenica',
      auditees: 'Airside Operations',
      status: 'PLANNED',
      priority: 'MEDIUM',
    },
  })

  console.log('Created programs:', p1.programId, p2.programId, p3.programId)

  // Audits
  const a1 = await prisma.audit.create({
    data: {
      auditId: 'AUD-2026-001',
      programId: p1.id,
      title: 'Audit GSE maintenance logs i CRS procedura',
      auditType: 'INTERNAL',
      auditScope: 'Maintenance log review, CRS issuing, equipment qualifications',
      auditStandard: 'EASA Part-145.A.50/A.65',
      description: 'Detaljan pregled svih maintenance logova i CRS dokumenata za posljednja 3 mjeseca',
      scheduledDate: lastMonth,
      startDate: lastMonth,
      endDate: new Date(lastMonth.getTime() + 3 * 86400000),
      reportDate: new Date(lastMonth.getTime() + 5 * 86400000),
      leadAuditor: 'Milica Medenica',
      auditTeam: 'Blažo Adžić, Vukan Vojvodić',
      auditeeOrganization: 'Maintenance Department',
      auditeeContact: 'Blažo Adžić',
      auditeeAreas: 'Workshop, Ramp, Hangar 1',
      status: 'COMPLETED',
      overallResult: 'NON_CONFORMANT',
      summary: 'Pronađena 1 major nesukladnost (CRS bez certifying staff) i 3 minor nesukladnosti. SMS procedura generalno sukladna ali potreban update.',
      recommendations: '1. Hitno obučiti 2 zaposlena za certifying staff. 2. Ažurirati maintenance log template. 3. Uvesti monthly internal review.',
    },
  })

  const a2 = await prisma.audit.create({
    data: {
      auditId: 'AUD-2026-002',
      programId: p1.id,
      title: 'Audit QR check-out sistema i driver authorization',
      auditType: 'INTERNAL',
      auditScope: 'Worker flow, PIN identifikacija, driver auth records',
      auditStandard: 'ADR.OPS.C.005 · IATA AHM 340',
      scheduledDate: lastWeek,
      startDate: lastWeek,
      endDate: now,
      leadAuditor: 'Blažo Adžić',
      auditeeOrganization: 'Ramp Operations',
      status: 'IN_PROGRESS',
      summary: 'U toku — provjera driver auth records za sve operatere',
    },
  })

  const a3 = await prisma.audit.create({
    data: {
      auditId: 'AUD-2026-003',
      title: 'Eksterni audit dobavljača — Kilfrost (de-icing fluid)',
      auditType: 'SUPPLIER',
      auditScope: 'Proizvodnja, kontrola kvaliteta, isporuka',
      auditStandard: 'ISO 9001 · SAE AMS 1428',
      scheduledDate: nextWeek,
      leadAuditor: 'Milica Medenica',
      auditeeOrganization: 'Kilfrost Ltd',
      status: 'SCHEDULED',
    },
  })

  console.log('Created audits:', a1.auditId, a2.auditId, a3.auditId)

  // Findings
  const f1 = await prisma.auditFinding.create({
    data: {
      findingId: 'FIN-2026-001',
      auditId: a1.id,
      classification: 'MAJOR',
      category: 'PERSONNEL',
      findingType: 'CONFORMITY',
      title: 'CRS issued without certifying staff authorization',
      description: 'Pronađeno 5 CRS dokumenata u posljednja 3 mjeseca koja su izdata od strane osoblja koje nema važeću certifying staff autorizaciju u skladu sa Part-145.A.35.',
      criteria: 'EASA Part-145.A.35(b) — Certifying staff authorization',
      evidence: 'Pregled CRS database vs training records. 5 CRS issuances unutar 90 dana.',
      area: 'CRS issuance process',
      process: 'Maintenance release',
      rootCause: 'Nedostatak validacije certifying staff statusa prije CRS izdavanja. System ne blokira CRS izdavanje za neautorizovano osoblje.',
      immediateAction: 'Obustaviti CRS izdavanje dok se ne validira osoblje. Hitna obuka.',
      correctiveAction: 'Modifikovati sistem da automatski blokira CRS izdavanje za osoblje bez važeće authorizacije.',
      preventiveAction: 'Implementisati pre-issuance check u aplikaciji. Periodična obuka.',
      status: 'IN_PROGRESS',
      assignedTo: 'Blažo Adžić',
      dueDate: new Date(now.getTime() + 14 * 86400000),
      riskLevel: 'CRITICAL',
    },
  })

  const f2 = await prisma.auditFinding.create({
    data: {
      findingId: 'FIN-2026-002',
      auditId: a1.id,
      classification: 'MINOR',
      category: 'DOCUMENTATION',
      findingType: 'CONFORMITY',
      title: 'Maintenance log template missing mandatory fields',
      description: 'Aktuelni maintenance log template ne sadrži polja za operating hours at service i next due date.',
      criteria: 'EASA Part-145.A.55(c) — Maintenance records',
      evidence: 'Pregled 15 maintenance log zapisa — 15/15 nemaju navedena polja.',
      area: 'Maintenance documentation',
      process: 'Maintenance logging',
      rootCause: 'Template kreiran prije 2 godine, nije ažuriran nakon promjene regulative.',
      correctiveAction: 'Ažurirati template sa svim obaveznim poljima.',
      status: 'CORRECTED',
      assignedTo: 'Milica Medenica',
      dueDate: lastWeek,
      verifiedBy: 'Blažo Adžić',
      verifiedAt: lastWeek,
      verificationResult: 'Template ažuriran i testiran. Novi zapisi koriste ispravan template.',
    },
  })

  const f3 = await prisma.auditFinding.create({
    data: {
      findingId: 'FIN-2026-003',
      auditId: a1.id,
      classification: 'MINOR',
      category: 'TRAINING',
      findingType: 'CONFORMITY',
      title: 'Human Factors training not current for 2 staff',
      description: '2 zaposlena u maintenance-u nemaju obnovljenu Human Factors obuku (istekla prije 60 dana).',
      criteria: 'EASA Part-145.A.35(e) — Human Factors training',
      evidence: 'Training records review.',
      area: 'Training records',
      process: 'Recurrent training',
      correctiveAction: 'Zakazati Human Factors obuku za 2 zaposlena u roku 30 dana.',
      status: 'OPEN',
      assignedTo: 'Milica Medenica',
      dueDate: new Date(now.getTime() + 30 * 86400000),
      riskLevel: 'MEDIUM',
    },
  })

  const f4 = await prisma.auditFinding.create({
    data: {
      findingId: 'FIN-2026-004',
      auditId: a1.id,
      classification: 'MINOR',
      category: 'RECORDS',
      findingType: 'CONFORMITY',
      title: 'Equipment qualifications missing for 3 operators',
      description: '3 operatora na platformi rade sa opremom za koju nemaju zabilježenu kvalifikaciju.',
      criteria: 'IATA AHM 1110 · Part-145.A.30',
      evidence: 'Cross-check operator assignments vs qualification database.',
      area: 'Operator qualifications',
      correctiveAction: 'Dodati kvalifikacije za 3 operatora ili obustaviti rad sa navedenom opremom.',
      status: 'OPEN',
      assignedTo: 'Vukan Vojvodić',
      dueDate: new Date(now.getTime() + 21 * 86400000),
    },
  })

  const f5 = await prisma.auditFinding.create({
    data: {
      findingId: 'FIN-2026-005',
      auditId: a1.id,
      classification: 'OBSERVATION',
      category: 'PROCESS',
      findingType: 'OPPORTUNITY_FOR_IMPROVEMENT',
      title: 'Digital sign-off for inspections could improve traceability',
      description: 'Trenutno inspekcijske checkliste koriste PIN identifikaciju. Digitalni potpis bi poboljšao audit trail.',
      evidence: 'Posmatranje worker flow-a.',
      area: 'Worker flow',
      status: 'DEFERRED',
      notes: 'Planirano u Q3 2026 sa novom verzijom aplikacije',
    },
  })

  console.log('Created findings:', f1.findingId, f2.findingId, f3.findingId, f4.findingId, f5.findingId)

  // CAPA
  const c1 = await prisma.cAPA.create({
    data: {
      capaId: 'CAPA-2026-001',
      title: 'Blokirati CRS izdavanje za neautorizovano osoblje',
      description: 'Sistemsku modifikaciju da automatski blokira CRS izdavanje kada osoblje nema važeću certifying staff autorizaciju.',
      type: 'CORRECTIVE_AND_PREVENTIVE',
      source: 'AUDIT_FINDING',
      sourceRef: 'FIN-2026-001',
      findingId: f1.id,
      problemStatement: 'Sistem dozvoljava CRS izdavanje od strane osoblja bez važeće authorizacije — 5 slučajeva u 90 dana.',
      rootCauseAnalysis: '5-Why: Zašto su izdati CRS? Osoblje nije imalo authorizaciju. Zašto sistem nije blokirao? Nema pre-issuance check. Zašto nema check-a? Nije predviđeno u specifikaciji. Zašto? Nedostatak analize rizika pri dizajnu.',
      rootCause: 'Nedostatak pre-issuance validacije u sistemskom dizajnu — propust u requirements analizi.',
      correctiveAction: '1. Razviti pre-issuance check modul. 2. Testiranje. 3. Deploy. 4. Obuka osoblja.',
      preventiveAction: 'Uvesti redovan review svih system controls sa sigurnosnim implikacijama.',
      actionPlan: 'Sprint 1: Development (5 dana). Sprint 2: Testing (3 dana). Sprint 3: Deploy + obuka (2 dana).',
      assignedTo: 'Blažo Adžić',
      assignedToCardId: 'EMP-1005',
      dueDate: new Date(now.getTime() + 14 * 86400000),
      status: 'IN_PROGRESS',
      estimatedCost: 5000,
      progressNotes: 'Development u toku. Developer dodijeljen. ETA testiranje za 5 dana.',
    },
  })

  const c2 = await prisma.cAPA.create({
    data: {
      capaId: 'CAPA-2026-002',
      title: 'Ažurirati maintenance log template',
      description: 'Dodati sva obavezna polja u template prema Part-145.A.55(c).',
      type: 'CORRECTIVE',
      source: 'AUDIT_FINDING',
      sourceRef: 'FIN-2026-002',
      findingId: f2.id,
      problemStatement: 'Maintenance log template ne sadrži obavezna polja: operating hours at service i next due date.',
      rootCause: 'Template kreiran prije 2 godine, nije ažuriran nakon promjene regulative.',
      correctiveAction: 'Ažurirati template, testirati, obući osoblje.',
      assignedTo: 'Milica Medenica',
      dueDate: lastWeek,
      completedAt: lastWeek,
      status: 'VERIFIED',
      implementationEvidence: 'Template ažuriran i deplojed. Svi novi zapisi koriste ispravan template.',
      verificationMethod: 'Review novih zapisa nakon implementacije',
      verificationResult: 'EFFECTIVE',
      verifiedBy: 'Blažo Adžić',
      verifiedAt: lastWeek,
      actualCost: 200,
    },
  })

  const c3 = await prisma.cAPA.create({
    data: {
      capaId: 'CAPA-2026-003',
      title: 'Zakazati Human Factors obuku za 2 zaposlena',
      description: 'Obnoviti Human Factors obuku koja je istekla prije 60 dana.',
      type: 'CORRECTIVE',
      source: 'AUDIT_FINDING',
      sourceRef: 'FIN-2026-003',
      findingId: f3.id,
      problemStatement: '2 zaposlena rade u maintenance-u sa isteklom Human Factors obukom.',
      rootCause: 'Nema automatskog alert sistema za istek obuke.',
      correctiveAction: 'Zakazati obuku u roku 30 dana.',
      preventiveAction: 'Uvesti alert sistem za istek obuka (30/60/90 dana unaprijed).',
      assignedTo: 'Milica Medenica',
      dueDate: new Date(now.getTime() + 30 * 86400000),
      status: 'OPEN',
      estimatedCost: 1500,
    },
  })

  const c4 = await prisma.cAPA.create({
    data: {
      capaId: 'CAPA-2026-004',
      title: 'Dodati kvalifikacije za 3 operatora',
      description: 'Validirati i dodati kvalifikacije za 3 operatora koji rade sa opremom bez zabilježene kvalifikacije.',
      type: 'CORRECTIVE',
      source: 'AUDIT_FINDING',
      sourceRef: 'FIN-2026-004',
      findingId: f4.id,
      problemStatement: '3 operatora rade sa opremom bez zabilježene kvalifikacije — rizik od nesigurne upotrebe.',
      correctiveAction: 'Provjera obuke za 3 operatora i dodavanje u sistem ili obustava rada sa opremom.',
      assignedTo: 'Vukan Vojvodić',
      dueDate: new Date(now.getTime() - 7 * 86400000), // overdue
      status: 'OPEN',
      progressNotes: 'Čeka se dokumentacija o obuci od HR odjela.',
    },
  })

  console.log('Created CAPAs:', c1.capaId, c2.capaId, c3.capaId, c4.capaId)

  // Compliance Items
  const items = [
    {
      itemId: 'CM-001', regulation: 'EASA Part-145.A.30', requirement: 'Personnel Requirements — adequate number of qualified staff',
      category: 'PERSONNEL', internalDoc: 'MOM-001', docVersion: '2.1', docOwner: 'Blažo Adžić',
      evidenceType: 'RECORD', evidenceRef: 'HR-001', evidenceDescription: 'Personnel register sa svim kvalifikacijama',
      status: 'COMPLIANT', lastVerified: last3Months, verifiedBy: 'Milica Medenica',
      reviewFrequency: 'ANNUAL', nextReviewDate: new Date(now.getTime() + 9 * 30 * 86400000),
    },
    {
      itemId: 'CM-002', regulation: 'EASA Part-145.A.35', requirement: 'Certifying staff authorization',
      category: 'PERSONNEL', internalDoc: 'MOM-002', docVersion: '1.5', docOwner: 'Blažo Adžić',
      evidenceType: 'RECORD', evidenceRef: 'FIN-2026-001', evidenceDescription: 'Nesukladnost identifikovana u AUD-2026-001',
      status: 'NON_COMPLIANT', riskLevel: 'HIGH', gapDescription: '5 CRS izdato bez važeće authorizacije',
      correctiveAction: 'CAPA-2026-001 u toku', lastVerified: lastMonth, verifiedBy: 'Milica Medenica',
      reviewFrequency: 'QUARTERLY', nextReviewDate: nextMonth,
    },
    {
      itemId: 'CM-003', regulation: 'EASA Part-145.A.40', requirement: 'Equipment, tools and material — calibrated',
      category: 'EQUIPMENT', internalDoc: 'OPS-MAN-3.2', docVersion: '1.0', docOwner: 'Milica Medenica',
      evidenceType: 'RECORD', evidenceRef: 'CAL-001', evidenceDescription: 'Calibration register',
      status: 'COMPLIANT', lastVerified: lastMonth, verifiedBy: 'Blažo Adžić',
      reviewFrequency: 'ANNUAL', nextReviewDate: new Date(now.getTime() + 11 * 30 * 86400000),
    },
    {
      itemId: 'CM-004', regulation: 'EASA Part-145.A.50', requirement: 'Certificate of Release to Service (CRS)',
      category: 'MAINTENANCE', internalDoc: 'MOM-005', docVersion: '2.0', docOwner: 'Blažo Adžić',
      evidenceType: 'RECORD', evidenceRef: 'AUD-2026-001', evidenceDescription: 'Audit audita pronalazi nesukladnosti',
      status: 'PARTIAL', riskLevel: 'MEDIUM', gapDescription: 'Sistem ne blokira CRS izdavanje za neautorizovano osoblje',
      correctiveAction: 'CAPA-2026-001 u toku — sistemski fix', lastVerified: lastMonth, verifiedBy: 'Milica Medenica',
      reviewFrequency: 'QUARTERLY', nextReviewDate: nextMonth,
    },
    {
      itemId: 'CM-005', regulation: 'EASA Part-145.A.55', requirement: 'Maintenance records retention 3 years',
      category: 'RECORDS', internalDoc: 'OPS-MAN-4.1', docVersion: '1.2', docOwner: 'Milica Medenica',
      evidenceType: 'DOCUMENT', evidenceRef: 'ARCHIVE-001', evidenceDescription: 'Digital archive sa svim zapisima',
      status: 'COMPLIANT', lastVerified: last3Months, verifiedBy: 'Blažo Adžić',
      reviewFrequency: 'ANNUAL', nextReviewDate: new Date(now.getTime() + 9 * 30 * 86400000),
    },
    {
      itemId: 'CM-006', regulation: 'EASA Part-145.A.65', requirement: 'Quality System — audit program',
      category: 'COMPLIANCE', internalDoc: 'QM-001', docVersion: '3.0', docOwner: 'Blažo Adžić',
      evidenceType: 'RECORD', evidenceRef: 'AP-2026-001', evidenceDescription: 'Aktivan audit program za 2026',
      status: 'COMPLIANT', lastVerified: lastMonth, verifiedBy: 'Milica Medenica',
      reviewFrequency: 'ANNUAL', nextReviewDate: new Date(now.getTime() + 11 * 30 * 86400000),
    },
    {
      itemId: 'CM-007', regulation: 'ADR.OPS.B.005', requirement: 'Aerodrome Daily Inspection',
      category: 'SMS', internalDoc: 'AD-OPS-001', docVersion: '1.0', docOwner: 'Milica Medenica',
      evidenceType: 'RECORD', evidenceRef: 'AeroInspect-001', evidenceDescription: 'Daily inspection records',
      status: 'COMPLIANT', lastVerified: lastWeek, verifiedBy: 'Blažo Adžić',
      reviewFrequency: 'QUARTERLY', nextReviewDate: new Date(now.getTime() + 3 * 30 * 86400000),
    },
    {
      itemId: 'CM-008', regulation: 'ADR.OPS.D.005', requirement: 'Compliance Monitoring — internal audit program',
      category: 'COMPLIANCE', internalDoc: 'QM-002', docVersion: '1.5', docOwner: 'Blažo Adžić',
      evidenceType: 'RECORD', evidenceRef: 'AP-2026-001', evidenceDescription: 'Aktivan compliance program',
      status: 'COMPLIANT', lastVerified: lastMonth, verifiedBy: 'Milica Medenica',
      reviewFrequency: 'ANNUAL', nextReviewDate: new Date(now.getTime() + 11 * 30 * 86400000),
    },
    {
      itemId: 'CM-009', regulation: 'ICAO Annex 19', requirement: 'Safety Management System (SMS)',
      category: 'SMS', internalDoc: 'SMS-MAN-001', docVersion: '2.0', docOwner: 'Blažo Adžić',
      evidenceType: 'RECORD', evidenceRef: 'SMS-001', evidenceDescription: 'Hazard log, SPI/SPT, Safety Action Plan',
      status: 'COMPLIANT', lastVerified: lastWeek, verifiedBy: 'Milica Medenica',
      reviewFrequency: 'ANNUAL', nextReviewDate: new Date(now.getTime() + 11 * 30 * 86400000),
    },
    {
      itemId: 'CM-010', regulation: 'IATA AHM 340', requirement: 'Pre-use inspection checklist',
      category: 'OPERATIONAL', internalDoc: 'OPS-MAN-2.3', docVersion: '1.0', docOwner: 'Vukan Vojvodić',
      evidenceType: 'OBSERVATION', evidenceRef: 'WorkerFlow-001', evidenceDescription: 'Worker flow sa checklistom',
      status: 'COMPLIANT', lastVerified: lastWeek, verifiedBy: 'Blažo Adžić',
      reviewFrequency: 'QUARTERLY', nextReviewDate: new Date(now.getTime() + 3 * 30 * 86400000),
    },
    {
      itemId: 'CM-011', regulation: 'ICAO Annex 14', requirement: 'Aerodromes — runway/taxiway inspection',
      category: 'FACILITIES', internalDoc: 'AD-OPS-002', docVersion: '1.1', docOwner: 'Milica Medenica',
      evidenceType: 'RECORD', evidenceRef: 'AeroInspect-001', evidenceDescription: 'Daily RWY/TWY inspection records',
      status: 'COMPLIANT', lastVerified: lastWeek, verifiedBy: 'Blažo Adžić',
      reviewFrequency: 'QUARTERLY', nextReviewDate: new Date(now.getTime() + 3 * 30 * 86400000),
    },
    {
      itemId: 'CM-012', regulation: 'ICAO Annex 15', requirement: 'NOTAM procedure',
      category: 'DOCUMENTATION', internalDoc: 'AIS-001', docVersion: '1.0', docOwner: 'Milica Medenica',
      evidenceType: 'RECORD', evidenceRef: 'NOTAM-001', evidenceDescription: 'NOTAM generation system aktivna',
      status: 'COMPLIANT', lastVerified: lastMonth, verifiedBy: 'Blažo Adžić',
      reviewFrequency: 'ANNUAL', nextReviewDate: new Date(now.getTime() + 11 * 30 * 86400000),
    },
  ]

  for (const item of items) {
    await prisma.complianceItem.create({ data: item })
  }
  console.log(`Created ${items.length} compliance items`)

  console.log('\nSeed complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
