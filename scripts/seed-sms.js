// Seed SMS data (Demo mode)
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const now = new Date()
  const lastWeek = new Date(now.getTime() - 7 * 86400000)
  const lastMonth = new Date(now.getTime() - 30 * 86400000)
  const last3Months = new Date(now.getTime() - 90 * 86400000)

  // 1. Critical hazard — FOD na RWY
  const h1 = await prisma.hazard.create({
    data: {
      hazardId: 'HZ-2026-001',
      title: 'FOD na RWY 14/32 tokom jutarnjih operacija',
      description: 'Tokom jutarnjih inspekcija u zadnja 3 mjeseca konstantno pronalazimo FOD (foreign object debris) na RWY 14/32, posebno oko praga 14. Uključuje šrafove, plastične komade, alat. Visok rizik od usisavanja u motore.',
      category: 'OPERATIONAL',
      source: 'INSPECTION',
      location: 'RWY 14/32, 200m from threshold 14',
      reportedBy: 'Milica Medenica',
      reportedByCardId: 'EMP-1004',
      reportedAt: last3Months,
      initialProbability: 4,
      initialSeverity: 4,
      initialRiskLevel: 'HIGH',
      status: 'MITIGATED',
      assignedTo: 'Blažo Adžić',
      dueDate: lastMonth,
      mitigation: 'Uvedena dodatna jutarnja FOD inspekcija 30 min prije prvog leta. Obuka GSE operatera o FOD awareness-u. Postavljeni FOD bins na apronu.',
      residualProbability: 2,
      residualSeverity: 4,
      residualRiskLevel: 'MEDIUM',
      alarpJustification: 'Dodatne mitigacione mjere (FOD covers na opremi, češće inspekcije) bi koštale >50.000€ a smanjile rizik sa 8 na 6. Razlika nije opravdana.',
      alarpReviewedAt: lastMonth,
      alarpReviewedBy: 'Blažo Adžić',
    },
  })

  // 2. High hazard — GSE brzina na apronu
  const h2 = await prisma.hazard.create({
    data: {
      hazardId: 'HZ-2026-002',
      title: 'Prekoračenje brzine GSE na apronu',
      description: 'Vozila na apronu često prelaze dozvoljenih 15 km/h, posebno traktori i bus-ovi. Predstavlja rizik od sudara sa avionima, opremom i pješacima.',
      category: 'OPERATIONAL',
      source: 'EMPLOYEE',
      location: 'Apron 1, Stand A1-A5',
      reportedBy: 'Vukan Vojvodić',
      reportedByCardId: 'EMP-1001',
      reportedAt: lastWeek,
      initialProbability: 5,
      initialSeverity: 3,
      initialRiskLevel: 'HIGH',
      status: 'ASSESSED',
      assignedTo: 'Milica Medenica',
      dueDate: new Date(now.getTime() + 14 * 86400000),
    },
  })

  // 3. Medium hazard — Istočni vjetar
  const h3 = await prisma.hazard.create({
    data: {
      hazardId: 'HZ-2026-003',
      title: 'Snažan istočni vjetar tokom pristajanja',
      description: 'U proljeće i jesen, snažan istočni vjetar (>25kt) može otežati pristajanje na Stand A1-A3 zbog vjetroturbulencija od obližnje zgrade terminala.',
      category: 'ENVIRONMENTAL',
      source: 'INCIDENT',
      location: 'Apron 1, Stand A1-A3',
      reportedBy: 'Blažo Adžić',
      reportedByCardId: 'EMP-1005',
      reportedAt: lastMonth,
      initialProbability: 3,
      initialSeverity: 3,
      initialRiskLevel: 'MEDIUM',
      status: 'MONITORED',
      assignedTo: 'Milica Medenica',
      mitigation: 'ATC obaviješten da daje informacije o vjetru pilots. Piloti obaviješteni da koriste minimalni thrust priko aprona.',
      residualProbability: 2,
      residualSeverity: 2,
      residualRiskLevel: 'LOW',
    },
  })

  // 4. Critical hazard — Stara drenaža
  const h4 = await prisma.hazard.create({
    data: {
      hazardId: 'HZ-2026-004',
      title: 'Zastarjeli drenažni sistem na zapadnom dijelu aerodroma',
      description: 'Drenažni sistem na zapadnom dijelu (oko TWY B) je star 30+ godina i ne može primiti obilne padavine. Poslednja 2 mjeseca došlo je do 3 plavljenja. Rizik od oštećenja kolovoza i stvaranja stajaće vode.',
      category: 'TECHNICAL',
      source: 'INSPECTION',
      location: 'TWY B i okolina',
      reportedBy: 'Milica Medenica',
      reportedByCardId: 'EMP-1004',
      reportedAt: lastMonth,
      initialProbability: 4,
      initialSeverity: 4,
      initialRiskLevel: 'CRITICAL',
      status: 'OPEN',
      assignedTo: 'Blažo Adžić',
      dueDate: new Date(now.getTime() + 60 * 86400000),
    },
  })

  console.log('Created hazards:', h1.hazardId, h2.hazardId, h3.hazardId, h4.hazardId)

  // SPI — Safety Performance Indicators
  const spi1 = await prisma.sPI.create({
    data: {
      spiId: 'SPI-001',
      name: 'Broj GSE incidenata po 10.000 pokreta',
      description: 'Lagging indicator — mjeri broj incidenata sa GSE opremom',
      category: 'OUTPUT',
      unit: 'incidents/10k',
      frequency: 'MONTHLY',
      targetValue: 0.5,
      alertLevel: 1.0,
      tolerableLimit: 2.0,
      currentValue: 0.8,
      currentPeriod: now.toISOString().slice(0, 7),
      trend: 'IMPROVING',
      status: 'GREEN',
    },
  })

  const spi2 = await prisma.sPI.create({
    data: {
      spiId: 'SPI-002',
      name: 'Postotak otkazivanja opreme',
      description: 'Mjeri % GSE opreme koja je out-of-service u toku mjeseca',
      category: 'PROCESS',
      unit: '%',
      frequency: 'MONTHLY',
      targetValue: 2.0,
      alertLevel: 5.0,
      tolerableLimit: 10.0,
      currentValue: 6.5,
      currentPeriod: now.toISOString().slice(0, 7),
      trend: 'WORSENING',
      status: 'AMBER',
    },
  })

  const spi3 = await prisma.sPI.create({
    data: {
      spiId: 'SPI-003',
      name: 'MTBF trend (Mean Time Between Failures)',
      description: 'Vrijeme između kvarova opreme — što veće to bolje',
      category: 'PROCESS',
      unit: 'hours',
      frequency: 'QUARTERLY',
      targetValue: 500,
      alertLevel: 300,
      tolerableLimit: 150,
      currentValue: 120,
      currentPeriod: now.toISOString().slice(0, 7),
      trend: 'WORSENING',
      status: 'RED',
    },
  })

  const spi4 = await prisma.sPI.create({
    data: {
      spiId: 'SPI-004',
      name: 'Broj sigurnosnih prijava po zaposlenom',
      description: 'Leading indicator — mjeri proaktivnu sigurnosnu kulturu',
      category: 'LEADING',
      unit: 'reports/emp',
      frequency: 'MONTHLY',
      targetValue: 2.0,
      alertLevel: 1.0,
      tolerableLimit: 0.5,
      currentValue: 2.5,
      currentPeriod: now.toISOString().slice(0, 7),
      trend: 'IMPROVING',
      status: 'GREEN',
    },
  })

  console.log('Created SPIs:', spi1.spiId, spi2.spiId, spi3.spiId, spi4.spiId)

  // SPT — Safety Performance Targets
  const spt1 = await prisma.sPT.create({
    data: {
      sptId: 'SPT-001',
      name: 'Smanjiti GSE incidente za 20% YoY',
      description: 'U odnosu na 2025. godinu, smanjiti broj GSE incidenata za 20%',
      category: 'SAFETY',
      baselineValue: 15,
      targetValue: 12,
      currentValue: 8,
      unit: 'incidents',
      startDate: new Date(now.getFullYear(), 0, 1),
      targetDate: new Date(now.getFullYear(), 11, 31),
      status: 'ON_TRACK',
      progressPercent: 70,
    },
  })

  const spt2 = await prisma.sPT.create({
    data: {
      sptId: 'SPT-002',
      name: 'Postići 95% compliance sa Daily Inspection',
      description: '95% zakazanih dnevnih inspekcija mora biti izvršeno na vrijeme',
      category: 'COMPLIANCE',
      baselineValue: 75,
      targetValue: 95,
      currentValue: 92,
      unit: '%',
      startDate: new Date(now.getFullYear(), 0, 1),
      targetDate: new Date(now.getFullYear(), 11, 31),
      status: 'ON_TRACK',
      progressPercent: 85,
    },
  })

  const spt3 = await prisma.sPT.create({
    data: {
      sptId: 'SPT-003',
      name: 'Smanjiti MTBF incidente za 30%',
      description: 'Povećati MTBF sa 120h na 200h (smanjenje kvarova)',
      category: 'OPERATIONAL',
      baselineValue: 120,
      targetValue: 200,
      currentValue: 110,
      unit: 'hours',
      startDate: new Date(now.getFullYear(), 0, 1),
      targetDate: new Date(now.getFullYear(), 11, 31),
      status: 'OFF_TRACK',
      progressPercent: -12,
    },
  })

  console.log('Created SPTs:', spt1.sptId, spt2.sptId, spt3.sptId)

  // Safety Actions
  const a1 = await prisma.safetyAction.create({
    data: {
      actionId: 'SAP-2026-001',
      title: 'Uvesti dodatnu FOD inspekciju prije prvog leta',
      description: 'Dodati FOD inspekciju 30 minuta prije prvog planiranog leta, sa fokustom na RWY 14/32 pr.',
      category: 'PREVENTIVE',
      priority: 'HIGH',
      hazardId: 'HZ-2026-001',
      assignedTo: 'Milica Medenica',
      assignedToCardId: 'EMP-1004',
      dueDate: new Date(now.getTime() + 7 * 86400000),
      status: 'IN_PROGRESS',
      estimatedCost: 5000,
      progressNotes: 'Obuka urađena, oprema kupljena. Testiranje u toku.',
    },
  })

  const a2 = await prisma.safetyAction.create({
    data: {
      actionId: 'SAP-2026-002',
      title: 'Instalirati radar za kontrolu brzine na apronu',
      description: 'Postaviti 4 radarska senzora na apronu za monitoring brzine GSE vozila.',
      category: 'MITIGATION',
      priority: 'CRITICAL',
      hazardId: 'HZ-2026-002',
      assignedTo: 'Blažo Adžić',
      assignedToCardId: 'EMP-1005',
      dueDate: new Date(now.getTime() - 14 * 86400000), // overdue
      status: 'OPEN',
      estimatedCost: 25000,
      progressNotes: 'Tražena ponuda od 3 vendor-a. Čeka se odobrenje budžeta.',
    },
  })

  const a3 = await prisma.safetyAction.create({
    data: {
      actionId: 'SAP-2026-003',
      title: 'Rekonstrukcija drenažnog sistema TWY B',
      description: 'Kompletna zamjena drenažnih cijevi i izgradnja retencije na zapadnom dijelu.',
      category: 'CORRECTIVE',
      priority: 'CRITICAL',
      hazardId: 'HZ-2026-004',
      assignedTo: 'Blažo Adžić',
      assignedToCardId: 'EMP-1005',
      dueDate: new Date(now.getTime() + 90 * 86400000),
      status: 'OPEN',
      estimatedCost: 250000,
      progressNotes: 'Projekat urađen. Tender objavljen. Čeka se izbor izvođača.',
    },
  })

  const a4 = await prisma.safetyAction.create({
    data: {
      actionId: 'SAP-2026-004',
      title: 'Obuka GSE operatera o FOD awareness-u',
      description: 'Svi GSE operateri moraju proći obuku o prepoznavanju i prijavljivanju FOD-a.',
      category: 'PREVENTIVE',
      priority: 'MEDIUM',
      hazardId: 'HZ-2026-001',
      assignedTo: 'Vukan Vojvodić',
      assignedToCardId: 'EMP-1001',
      dueDate: new Date(now.getTime() - 7 * 86400000),
      completedAt: new Date(now.getTime() - 5 * 86400000),
      status: 'COMPLETED',
      actualCost: 1500,
      verificationResult: 'Svi operateri (15) završili obuku. Test urađen, prosjek 92%. FOD prijave povećane za 40%.',
    },
  })

  console.log('Created actions:', a1.actionId, a2.actionId, a3.actionId, a4.actionId)
  console.log('\nSeed complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
