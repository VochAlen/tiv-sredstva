// Seed Document Control data
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const now = new Date()
  const lastWeek = new Date(now.getTime() - 7 * 86400000)
  const lastMonth = new Date(now.getTime() - 30 * 86400000)
  const last3Months = new Date(now.getTime() - 90 * 86400000)
  const last6Months = new Date(now.getTime() - 180 * 86400000)
  const lastYear = new Date(now.getTime() - 365 * 86400000)
  const nextWeek = new Date(now.getTime() + 7 * 86400000)
  const nextMonth = new Date(now.getTime() + 30 * 86400000)
  const next3Months = new Date(now.getTime() + 90 * 86400000)
  const next6Months = new Date(now.getTime() + 180 * 86400000)
  const next9Months = new Date(now.getTime() + 270 * 86400000)
  const next11Months = new Date(now.getTime() + 335 * 86400000)
  const overdue1 = new Date(now.getTime() - 14 * 86400000)
  const overdue2 = new Date(now.getTime() - 30 * 86400000)
  const dueSoon1 = new Date(now.getTime() + 10 * 86400000)
  const dueSoon2 = new Date(now.getTime() + 20 * 86400000)

  // ============================================================================
  // CONTROLLED DOCUMENTS
  // ============================================================================

  const d1 = await prisma.controlledDocument.create({
    data: {
      docId: 'MOM-001',
      title: 'Maintenance Organization Manual (MOM)',
      description: 'Glavni prirunik organizacije za održavanje u skladu sa EASA Part-145. Sadrži organizacionu strukturu, odgovornosti, procedure i resurse.',
      category: 'MANUAL',
      docType: 'MAINTENANCE',
      standard: 'EASA Part-145.A.200',
      currentVersion: '3.2',
      status: 'PUBLISHED',
      effectiveDate: last3Months,
      nextReviewDate: next9Months,
      owner: 'Blažo Adžić',
      ownerCardId: 'EMP-1005',
      author: 'Milica Medenica',
      approver: 'Blažo Adžić',
      fileUrl: '/documents/MOM-001-v3.2.pdf',
      fileFormat: 'PDF',
      fileSize: 2500000,
      location: 'Server /Documents/MOM/',
      reviewFrequency: 'ANNUAL',
      lastReviewedAt: last3Months,
      lastReviewedBy: 'Milica Medenica',
      classification: 'INTERNAL',
      keywords: 'maintenance, organization, EASA, Part-145, manual',
      notes: 'Glavni dokument za Part-145 certifikaciju',
    },
  })

  const d2 = await prisma.controlledDocument.create({
    data: {
      docId: 'OPS-MAN-2.3',
      title: 'Aerodrom Operations Manual — Section 2.3: GSE Operations',
      description: 'Procedura za upravljanje Ground Support Equipment na aerodromskoj platformi.',
      category: 'PROCEDURE',
      docType: 'OPERATIONS',
      standard: 'ADR.OPS.C.007 · IATA AHM 340',
      currentVersion: '1.5',
      status: 'PUBLISHED',
      effectiveDate: last6Months,
      nextReviewDate: next6Months,
      owner: 'Milica Medenica',
      ownerCardId: 'EMP-1004',
      author: 'Vukan Vojvodić',
      approver: 'Blažo Adžić',
      fileUrl: '/documents/OPS-MAN-2.3-v1.5.pdf',
      fileFormat: 'PDF',
      fileSize: 850000,
      location: 'Server /Documents/OPS-MAN/',
      reviewFrequency: 'ANNUAL',
      lastReviewedAt: last6Months,
      lastReviewedBy: 'Blažo Adžić',
      classification: 'INTERNAL',
      keywords: 'GSE, operations, aerodrom, procedure, ADR.OPS',
      notes: 'Aktivna procedura za GSE operacije',
    },
  })

  const d3 = await prisma.controlledDocument.create({
    data: {
      docId: 'SMS-MAN-001',
      title: 'Safety Management System (SMS) Manual',
      description: 'Kompletan SMS priručnik u skladu sa ICAO Annex 19 i EASA M.GEN.205. Sadrži hazard identification, risk assessment, SPI/SPT i Safety Action Plan procedure.',
      category: 'MANUAL',
      docType: 'SAFETY',
      standard: 'ICAO Annex 19 · EASA M.GEN.205',
      currentVersion: '2.0',
      status: 'PUBLISHED',
      effectiveDate: lastMonth,
      nextReviewDate: next11Months,
      owner: 'Blažo Adžić',
      ownerCardId: 'EMP-1005',
      author: 'Milica Medenica',
      approver: 'Blažo Adžić',
      fileUrl: '/documents/SMS-MAN-001-v2.0.pdf',
      fileFormat: 'PDF',
      fileSize: 1800000,
      location: 'Server /Documents/SMS/',
      reviewFrequency: 'ANNUAL',
      lastReviewedAt: lastMonth,
      lastReviewedBy: 'Milica Medenica',
      classification: 'CONFIDENTIAL',
      keywords: 'SMS, safety, ICAO Annex 19, hazard, risk, SPI, SPT',
      notes: 'Glavni SMS dokument za aerodromsku sertifikaciju',
    },
  })

  const d4 = await prisma.controlledDocument.create({
    data: {
      docId: 'QM-001',
      title: 'Quality Management System Manual',
      description: 'Priručnik sistema upravljanja kvalitetom u skladu sa ISO 9001 i EASA Part-145.A.65.',
      category: 'MANUAL',
      docType: 'QUALITY',
      standard: 'ISO 9001 · EASA Part-145.A.65',
      currentVersion: '3.0',
      status: 'PUBLISHED',
      effectiveDate: lastYear,
      nextReviewDate: overdue1, // OVERDUE
      owner: 'Blažo Adžić',
      ownerCardId: 'EMP-1005',
      author: 'Milica Medenica',
      approver: 'Blažo Adžić',
      fileUrl: '/documents/QM-001-v3.0.pdf',
      fileFormat: 'PDF',
      fileSize: 2100000,
      location: 'Server /Documents/Quality/',
      reviewFrequency: 'ANNUAL',
      lastReviewedAt: lastYear,
      lastReviewedBy: 'Blažo Adžić',
      classification: 'INTERNAL',
      keywords: 'quality, ISO 9001, audit, compliance, Part-145.A.65',
      notes: 'OVERDUE — treba hitno review',
    },
  })

  const d5 = await prisma.controlledDocument.create({
    data: {
      docId: 'WI-GSE-001',
      title: 'Work Instruction: QR Code Check-out Procedure',
      description: 'Detaljno uputstvo za radnike kako da koriste QR check-out sistem na platformi.',
      category: 'WORK_INSTRUCTION',
      docType: 'OPERATIONS',
      standard: 'IATA AHM 340',
      currentVersion: '1.2',
      status: 'PUBLISHED',
      effectiveDate: last3Months,
      nextReviewDate: dueSoon1, // DUE SOON
      owner: 'Vukan Vojvodić',
      ownerCardId: 'EMP-1001',
      author: 'Vukan Vojvodić',
      approver: 'Milica Medenica',
      fileUrl: '/documents/WI-GSE-001-v1.2.pdf',
      fileFormat: 'PDF',
      fileSize: 450000,
      location: 'Server /Documents/WI/',
      reviewFrequency: 'BIENNIAL',
      lastReviewedAt: last3Months,
      lastReviewedBy: 'Milica Medenica',
      classification: 'INTERNAL',
      keywords: 'work instruction, QR, check-out, worker, AHM 340',
    },
  })

  const d6 = await prisma.controlledDocument.create({
    data: {
      docId: 'FORM-INS-001',
      title: 'Form: Daily Inspection Checklist',
      description: 'Formular za dnevnu inspekciju runway-a, taxiway-a i aprona.',
      category: 'FORM',
      docType: 'SAFETY',
      standard: 'ICAO Annex 14 · ADR.OPS.B.005',
      currentVersion: '2.1',
      status: 'PUBLISHED',
      effectiveDate: lastMonth,
      nextReviewDate: dueSoon2, // DUE SOON
      owner: 'Milica Medenica',
      ownerCardId: 'EMP-1004',
      author: 'Milica Medenica',
      approver: 'Blažo Adžić',
      fileUrl: '/documents/FORM-INS-001-v2.1.docx',
      fileFormat: 'DOCX',
      fileSize: 180000,
      location: 'Server /Documents/Forms/',
      reviewFrequency: 'QUARTERLY',
      lastReviewedAt: lastMonth,
      lastReviewedBy: 'Blažo Adžić',
      classification: 'INTERNAL',
      keywords: 'form, inspection, daily, runway, taxiway, apron, Annex 14',
    },
  })

  const d7 = await prisma.controlledDocument.create({
    data: {
      docId: 'POL-SAFETY-001',
      title: 'Safety Policy',
      description: 'Politika sigurnosti koju je odobrio Accountable Manager.',
      category: 'POLICY',
      docType: 'SAFETY',
      standard: 'ICAO Annex 19 · EASA M.GEN.200',
      currentVersion: '1.0',
      status: 'PUBLISHED',
      effectiveDate: last6Months,
      nextReviewDate: next6Months,
      owner: 'Blažo Adžić',
      ownerCardId: 'EMP-1005',
      author: 'Blažo Adžić',
      approver: 'Blažo Adžić',
      fileUrl: '/documents/POL-SAFETY-001-v1.0.pdf',
      fileFormat: 'PDF',
      fileSize: 95000,
      location: 'Server /Documents/Policy/',
      reviewFrequency: 'ANNUAL',
      lastReviewedAt: last6Months,
      lastReviewedBy: 'Blažo Adžić',
      classification: 'PUBLIC',
      keywords: 'policy, safety, ICAO Annex 19, accountable manager',
      notes: 'Potpisao Accountable Manager',
    },
  })

  const d8 = await prisma.controlledDocument.create({
    data: {
      docId: 'PROC-CRS-001',
      title: 'Procedure: Certificate of Release to Service (CRS)',
      description: 'Procedura za izdavanje CRS-a u skladu sa EASA Part-145.A.50.',
      category: 'PROCEDURE',
      docType: 'MAINTENANCE',
      standard: 'EASA Part-145.A.50',
      currentVersion: '2.0',
      status: 'UNDER_REVIEW',
      effectiveDate: lastYear,
      nextReviewDate: nextMonth,
      owner: 'Milica Medenica',
      ownerCardId: 'EMP-1004',
      author: 'Milica Medenica',
      approver: 'Blažo Adžić',
      fileUrl: '/documents/PROC-CRS-001-v2.0.pdf',
      fileFormat: 'PDF',
      fileSize: 620000,
      location: 'Server /Documents/Procedures/',
      reviewFrequency: 'ANNUAL',
      lastReviewedAt: lastYear,
      lastReviewedBy: 'Blažo Adžić',
      classification: 'INTERNAL',
      keywords: 'CRS, certificate, release, Part-145.A.50, procedure',
      notes: 'Trenutno na reviziji — dodatak za automatsku blokadu',
    },
  })

  const d9 = await prisma.controlledDocument.create({
    data: {
      docId: 'TR-PLAN-2026',
      title: 'Training Plan 2026',
      description: 'Godišnji plan obuke za osoblje u skladu sa Part-145.A.35.',
      category: 'PLAN',
      docType: 'TRAINING',
      standard: 'EASA Part-145.A.35',
      currentVersion: '1.0',
      status: 'DRAFT',
      owner: 'Milica Medenica',
      ownerCardId: 'EMP-1004',
      author: 'Milica Medenica',
      reviewFrequency: 'ANNUAL',
      classification: 'INTERNAL',
      keywords: 'training, plan, 2026, Part-145.A.35, human factors',
      notes: 'U pripremi — čeka odobrenje',
    },
  })

  const d10 = await prisma.controlledDocument.create({
    data: {
      docId: 'REC-AUDIT-001',
      title: 'Record: Internal Audit Reports 2025',
      description: 'Arhiva internih audit izvještaja za 2025. godinu.',
      category: 'RECORD',
      docType: 'QUALITY',
      standard: 'EASA Part-145.A.65 · ADR.OPS.D.005',
      currentVersion: '1.0',
      status: 'PUBLISHED',
      effectiveDate: lastYear,
      nextReviewDate: next3Months,
      owner: 'Blažo Adžić',
      ownerCardId: 'EMP-1005',
      author: 'Milica Medenica',
      approver: 'Blažo Adžić',
      location: 'Server /Documents/Records/Audit/2025/',
      reviewFrequency: 'ANNUAL',
      lastReviewedAt: last3Months,
      lastReviewedBy: 'Milica Medenica',
      classification: 'CONFIDENTIAL',
      keywords: 'audit, internal, records, 2025, ADR.OPS.D.005',
    },
  })

  const d11 = await prisma.controlledDocument.create({
    data: {
      docId: 'PROC-DEICE-001',
      title: 'Procedure: De-icing / Anti-icing Operations',
      description: 'Procedura za de-icing i anti-icing operacije na avionima u skladu sa ICAO Annex 3 i AEA Recommendations.',
      category: 'PROCEDURE',
      docType: 'OPERATIONS',
      standard: 'ICAO Annex 3 · AEA Recommendations · ISO 11076',
      currentVersion: '1.3',
      status: 'PUBLISHED',
      effectiveDate: last3Months,
      nextReviewDate: nextMonth,
      owner: 'Milica Medenica',
      ownerCardId: 'EMP-1004',
      author: 'Vukan Vojvodić',
      approver: 'Blažo Adžić',
      fileUrl: '/documents/PROC-DEICE-001-v1.3.pdf',
      fileFormat: 'PDF',
      fileSize: 720000,
      location: 'Server /Documents/Procedures/',
      reviewFrequency: 'ANNUAL',
      lastReviewedAt: last3Months,
      lastReviewedBy: 'Blažo Adžić',
      classification: 'INTERNAL',
      keywords: 'de-icing, anti-icing, HOT, ISO 11076, AEA, winter ops',
    },
  })

  const d12 = await prisma.controlledDocument.create({
    data: {
      docId: 'MOM-002',
      title: 'Maintenance Organization Manual — Old Version (SUPERSEDED)',
      description: 'Stara verzija MOM-a, zamijenjena verzijom 3.2.',
      category: 'MANUAL',
      docType: 'MAINTENANCE',
      standard: 'EASA Part-145.A.200',
      currentVersion: '3.1',
      status: 'SUPERSEDED',
      effectiveDate: lastYear,
      owner: 'Blažo Adžić',
      ownerCardId: 'EMP-1005',
      author: 'Milica Medenica',
      approver: 'Blažo Adžić',
      reviewFrequency: 'ANNUAL',
      lastReviewedAt: lastYear,
      lastReviewedBy: 'Blažo Adžić',
      classification: 'INTERNAL',
      keywords: 'MOM, maintenance, superseded, old version',
      notes: 'Zamijenjeno sa MOM-001 v3.2',
    },
  })

  console.log('Created documents:', d1.docId, d2.docId, d3.docId, '...', d12.docId)

  // ============================================================================
  // VERSIONS — nekoliko verzija za razne dokumente
  // ============================================================================

  // MOM-001 versions
  await prisma.documentVersion.createMany({
    data: [
      {
        documentId: d1.id, versionNumber: '3.0', revisionDate: lastYear,
        revisedBy: 'Milica Medenica', approvedBy: 'Blažo Adžić', approvedAt: lastYear,
        changeDescription: 'Kompletna revizija u skladu sa novom EASA regulativom',
        changeReason: 'Promjena EASA Part-145.A.200 zahtjeva',
        affectedSections: 'Sve sekcije',
        status: 'SUPERSEDED', effectiveDate: lastYear,
      },
      {
        documentId: d1.id, versionNumber: '3.1', revisionDate: last6Months,
        revisedBy: 'Milica Medenica', approvedBy: 'Blažo Adžić', approvedAt: last6Months,
        changeDescription: 'Dodatak za novu CRS proceduru i kvalifikacije',
        changeReason: 'Update procedura nakon internog audita',
        affectedSections: 'Sekcija 4, 5, 7',
        status: 'SUPERSEDED', effectiveDate: last6Months,
      },
      {
        documentId: d1.id, versionNumber: '3.2', revisionDate: last3Months,
        revisedBy: 'Milica Medenica', approvedBy: 'Blažo Adžić', approvedAt: last3Months,
        changeDescription: 'Dodatak SMS procedures i referenci na ICAO Annex 19',
        changeReason: 'Implementacija SMS sistema',
        affectedSections: 'Sekcija 8, 9, novi Aneks B',
        status: 'PUBLISHED', effectiveDate: last3Months,
        reviewNotes: 'Review je uradila Milica Medenica u saradnji sa Blažo Adžić',
      },
    ],
  })

  // OPS-MAN-2.3 versions
  await prisma.documentVersion.createMany({
    data: [
      {
        documentId: d2.id, versionNumber: '1.0', revisionDate: lastYear,
        revisedBy: 'Vukan Vojvodić', approvedBy: 'Blažo Adžić', approvedAt: lastYear,
        changeDescription: 'Inicijalna verzija procedure',
        changeReason: 'Kreiranje procedure za GSE operacije',
        affectedSections: 'Sve',
        status: 'SUPERSEDED', effectiveDate: lastYear,
      },
      {
        documentId: d2.id, versionNumber: '1.5', revisionDate: last6Months,
        revisedBy: 'Vukan Vojvodić', approvedBy: 'Blažo Adžić', approvedAt: last6Months,
        changeDescription: 'Dodat QR check-out proces i PIN identifikacija',
        changeReason: 'Implementacija digitalnog sistema',
        affectedSections: 'Sekcija 3, 4, 5',
        status: 'PUBLISHED', effectiveDate: last6Months,
      },
    ],
  })

  // SMS-MAN-001 versions
  await prisma.documentVersion.createMany({
    data: [
      {
        documentId: d3.id, versionNumber: '1.0', revisionDate: lastYear,
        revisedBy: 'Milica Medenica', approvedBy: 'Blažo Adžić', approvedAt: lastYear,
        changeDescription: 'Inicijalna verzija SMS priručnika',
        changeReason: 'Implementacija ICAO Annex 19',
        affectedSections: 'Sve',
        status: 'SUPERSEDED', effectiveDate: lastYear,
      },
      {
        documentId: d3.id, versionNumber: '2.0', revisionDate: lastMonth,
        revisedBy: 'Milica Medenica', approvedBy: 'Blažo Adžić', approvedAt: lastMonth,
        changeDescription: 'Dodat SPI/SPT sistem, ALARP princip i Safety Action Plan',
        changeReason: 'Kompletna revizija nakon godinu dana rada',
        affectedSections: 'Sekcija 5, 6, 7, novi Aneks A',
        status: 'PUBLISHED', effectiveDate: lastMonth,
      },
    ],
  })

  // FORM-INS-001 versions
  await prisma.documentVersion.createMany({
    data: [
      {
        documentId: d6.id, versionNumber: '2.0', revisionDate: last3Months,
        revisedBy: 'Milica Medenica', approvedBy: 'Blažo Adžić', approvedAt: last3Months,
        changeDescription: 'Dodat NOTAM sekcija i koordinate polja',
        changeReason: 'Implementacija NOTAM sistema',
        affectedSections: 'Sekcija 3, 4',
        status: 'SUPERSEDED', effectiveDate: last3Months,
      },
      {
        documentId: d6.id, versionNumber: '2.1', revisionDate: lastMonth,
        revisedBy: 'Milica Medenica', approvedBy: 'Blažo Adžić', approvedAt: lastMonth,
        changeDescription: 'Ispravka typo grešaka i dodatak fielda za potpis',
        changeReason: 'Minor update nakon user feedback-a',
        affectedSections: 'Sekcija 2',
        status: 'PUBLISHED', effectiveDate: lastMonth,
      },
    ],
  })

  // PROC-CRS-001 — verzija u draftu
  await prisma.documentVersion.create({
    data: {
      documentId: d8.id, versionNumber: '2.1', revisionDate: lastWeek,
      revisedBy: 'Milica Medenica',
      changeDescription: 'Dodatak za automatsku blokadu CRS izdavanja za neautorizovano osoblje',
      changeReason: 'Major finding iz audita AUD-2026-001',
      affectedSections: 'Sekcija 5, 6, novi Aneks C',
      status: 'DRAFT',
      reviewNotes: 'Čeka se review od strane Blažo Adžić',
    },
  })

  console.log('Created document versions')

  // ============================================================================
  // REVIEWS
  // ============================================================================

  await prisma.documentReview.createMany({
    data: [
      {
        documentId: d1.id, reviewType: 'SCHEDULED', reviewDate: last3Months,
        reviewer: 'Milica Medenica', reviewerCardId: 'EMP-1004',
        result: 'MAJOR_REVISION',
        reviewComments: 'Potrebno dodati SMS procedures i referenci na ICAO Annex 19',
        changesRequired: 'Dodatak sekcija 8, 9 i novi Aneks B',
        newVersionRequired: true,
        actionTaken: 'Kreirana verzija 3.2',
        status: 'COMPLETED',
        completedAt: last3Months,
      },
      {
        documentId: d2.id, reviewType: 'SCHEDULED', reviewDate: last6Months,
        reviewer: 'Blažo Adžić', reviewerCardId: 'EMP-1005',
        result: 'MINOR_UPDATE',
        reviewComments: 'Dodat QR check-out proces',
        changesRequired: 'Dodatak sekcija 3, 4, 5',
        newVersionRequired: true,
        actionTaken: 'Kreirana verzija 1.5',
        status: 'COMPLETED',
        completedAt: last6Months,
      },
      {
        documentId: d3.id, reviewType: 'SCHEDULED', reviewDate: lastMonth,
        reviewer: 'Milica Medenica', reviewerCardId: 'EMP-1004',
        result: 'MAJOR_REVISION',
        reviewComments: 'Kompletna revizija — dodat SPI/SPT i ALARP',
        changesRequired: 'Sve sekcije',
        newVersionRequired: true,
        actionTaken: 'Kreirana verzija 2.0',
        status: 'COMPLETED',
        completedAt: lastMonth,
      },
      {
        documentId: d4.id, reviewType: 'SCHEDULED', reviewDate: overdue1,
        reviewer: 'Blažo Adžić', reviewerCardId: 'EMP-1005',
        result: 'MAJOR_REVISION',
        reviewComments: 'OVERDUE — potreban hitan review i update',
        changesRequired: 'Kompletna revizija u skladu sa novim ISO 9001:2015',
        newVersionRequired: true,
        status: 'OPEN',
      },
      {
        documentId: d5.id, reviewType: 'SCHEDULED', reviewDate: dueSoon1,
        reviewer: 'Milica Medenica', reviewerCardId: 'EMP-1004',
        result: 'NO_CHANGE_NEEDED',
        reviewComments: 'Dokument je ažuran i u skladu sa praksom',
        status: 'OPEN',
      },
      {
        documentId: d6.id, reviewType: 'CHANGE_REQUEST', reviewDate: lastWeek,
        reviewer: 'Vukan Vojvodić', reviewerCardId: 'EMP-1001',
        result: 'MINOR_UPDATE',
        reviewComments: 'User feedback — potreban dodatni field za potpis',
        changesRequired: 'Sekcija 2',
        newVersionRequired: true,
        actionTaken: 'Kreirana verzija 2.1',
        status: 'COMPLETED',
        completedAt: lastMonth,
      },
      {
        documentId: d8.id, reviewType: 'INCIDENT_DRIVEN', reviewDate: lastWeek,
        reviewer: 'Milica Medenica', reviewerCardId: 'EMP-1004',
        result: 'MAJOR_REVISION',
        reviewComments: 'Nakon major finding-a u auditu — potrebna blokada CRS izdavanja',
        changesRequired: 'Sekcija 5, 6, novi Aneks C',
        newVersionRequired: true,
        actionTaken: 'Verzija 2.1 u draftu',
        status: 'IN_PROGRESS',
      },
      {
        documentId: d11.id, reviewType: 'AD_HOC', reviewDate: last3Months,
        reviewer: 'Blažo Adžić', reviewerCardId: 'EMP-1005',
        result: 'MINOR_UPDATE',
        reviewComments: 'Dodat HOT kalkulator reference',
        changesRequired: 'Sekcija 4',
        newVersionRequired: true,
        actionTaken: 'Kreirana verzija 1.3',
        status: 'COMPLETED',
        completedAt: last3Months,
      },
    ],
  })

  console.log('Created document reviews')

  // ============================================================================
  // DISTRIBUTIONS
  // ============================================================================

  await prisma.documentDistribution.createMany({
    data: [
      // MOM-001 distributions
      {
        documentId: d1.id, recipientName: 'Blažo Adžić', recipientRole: 'Accountable Manager',
        recipientDepartment: 'Management', recipientEmail: 'admin@gse.control',
        distributionDate: last3Months, distributionMethod: 'PORTAL',
        distributedBy: 'Milica Medenica', versionNumber: '3.2',
        acknowledged: true, acknowledgedAt: last3Months, acknowledgedMethod: 'SYSTEM_CONFIRM',
        status: 'ACKNOWLEDGED',
      },
      {
        documentId: d1.id, recipientName: 'Milica Medenica', recipientRole: 'Maintenance Manager',
        recipientDepartment: 'Maintenance', recipientEmail: 'engineer@gse.control',
        distributionDate: last3Months, distributionMethod: 'PORTAL',
        distributedBy: 'Blažo Adžić', versionNumber: '3.2',
        acknowledged: true, acknowledgedAt: last3Months, acknowledgedMethod: 'EMAIL_REPLY',
        status: 'ACKNOWLEDGED',
      },
      {
        documentId: d1.id, recipientName: 'Vukan Vojvodić', recipientRole: 'Ramp Operator',
        recipientDepartment: 'Operations', recipientEmail: 'operator@gse.control',
        distributionDate: last3Months, distributionMethod: 'EMAIL',
        distributedBy: 'Milica Medenica', versionNumber: '3.2',
        acknowledged: false, status: 'DISTRIBUTED',
        notes: 'Poslat email — čeka se potvrda',
      },
      // SMS-MAN-001 distributions
      {
        documentId: d3.id, recipientName: 'Blažo Adžić', recipientRole: 'Accountable Manager',
        recipientDepartment: 'Management',
        distributionDate: lastMonth, distributionMethod: 'PORTAL',
        distributedBy: 'Milica Medenica', versionNumber: '2.0',
        acknowledged: true, acknowledgedAt: lastMonth, acknowledgedMethod: 'SYSTEM_CONFIRM',
        status: 'ACKNOWLEDGED',
      },
      {
        documentId: d3.id, recipientName: 'Milica Medenica', recipientRole: 'Safety Manager',
        recipientDepartment: 'Safety',
        distributionDate: lastMonth, distributionMethod: 'PORTAL',
        distributedBy: 'Blažo Adžić', versionNumber: '2.0',
        acknowledged: true, acknowledgedAt: lastMonth, acknowledgedMethod: 'SYSTEM_CONFIRM',
        status: 'ACKNOWLEDGED',
      },
      {
        documentId: d3.id, recipientName: 'Vukan Vojvodić', recipientRole: 'Ramp Operator',
        recipientDepartment: 'Operations',
        distributionDate: lastMonth, distributionMethod: 'EMAIL',
        distributedBy: 'Milica Medenica', versionNumber: '2.0',
        acknowledged: false, status: 'DISTRIBUTED',
      },
      {
        documentId: d3.id, recipientName: 'Ana Novak', recipientRole: 'Fuel Operator',
        recipientDepartment: 'Fuel Service',
        distributionDate: lastMonth, distributionMethod: 'TRAINING',
        distributedBy: 'Milica Medenica', versionNumber: '2.0',
        acknowledged: true, acknowledgedAt: lastWeek, acknowledgedMethod: 'SIGNATURE',
        status: 'ACKNOWLEDGED',
      },
      // POL-SAFETY-001 distributions — svima
      {
        documentId: d7.id, recipientName: 'All Staff', recipientRole: 'All Employees',
        recipientDepartment: 'All',
        distributionDate: last6Months, distributionMethod: 'EMAIL',
        distributedBy: 'Blažo Adžić', versionNumber: '1.0',
        acknowledged: true, acknowledgedAt: last6Months, acknowledgedMethod: 'EMAIL_REPLY',
        status: 'ACKNOWLEDGED',
      },
      // FORM-INS-001 — inspektorima
      {
        documentId: d6.id, recipientName: 'Milica Medenica', recipientRole: 'Inspector',
        recipientDepartment: 'Airside Ops',
        distributionDate: lastMonth, distributionMethod: 'PORTAL',
        distributedBy: 'Blažo Adžić', versionNumber: '2.1',
        acknowledged: true, acknowledgedAt: lastMonth, acknowledgedMethod: 'SYSTEM_CONFIRM',
        status: 'ACKNOWLEDGED',
      },
      {
        documentId: d6.id, recipientName: 'Blažo Adžić', recipientRole: 'Inspector',
        recipientDepartment: 'Airside Ops',
        distributionDate: lastMonth, distributionMethod: 'PORTAL',
        distributedBy: 'Milica Medenica', versionNumber: '2.1',
        acknowledged: false, status: 'DISTRIBUTED',
      },
      // PROC-DEICE-001 — winter ops tim
      {
        documentId: d11.id, recipientName: 'Vukan Vojvodić', recipientRole: 'De-icing Operator',
        recipientDepartment: 'Winter Ops',
        distributionDate: last3Months, distributionMethod: 'TRAINING',
        distributedBy: 'Milica Medenica', versionNumber: '1.3',
        acknowledged: true, acknowledgedAt: last3Months, acknowledgedMethod: 'SIGNATURE',
        status: 'ACKNOWLEDGED',
      },
      {
        documentId: d11.id, recipientName: 'Marko Marković', recipientRole: 'De-icing Operator',
        recipientDepartment: 'Winter Ops',
        distributionDate: last3Months, distributionMethod: 'TRAINING',
        distributedBy: 'Milica Medenica', versionNumber: '1.3',
        acknowledged: false, status: 'DISTRIBUTED',
        notes: 'Na godišnjem — čeka se povratak',
      },
    ],
  })

  console.log('Created document distributions')
  console.log('\nSeed complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
