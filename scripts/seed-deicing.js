// Seed De-icing data (Demo mode)
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Add DEICER equipment
  const dei1 = await prisma.equipment.upsert({
    where: { code: 'GSE-DEI-001' },
    update: {},
    create: {
      code: 'GSE-DEI-001',
      name: 'De-icing Truck 1',
      type: 'DEICER',
      status: 'AVAILABLE',
      location: 'Hangar 1',
      manufacturer: 'Vestergaard',
      serialNumber: 'VST-2024-001',
      notes: 'De-icing truck — 8000L tank',
    },
  })

  const dei2 = await prisma.equipment.upsert({
    where: { code: 'GSE-DEI-002' },
    update: {},
    create: {
      code: 'GSE-DEI-002',
      name: 'De-icing Truck 2',
      type: 'DEICER',
      status: 'AVAILABLE',
      location: 'Hangar 1',
      manufacturer: 'Bucher',
      serialNumber: 'BCH-2024-002',
      notes: 'De-icing truck — 6000L tank',
    },
  })

  console.log('Created equipment:', dei1.code, dei2.code)

  // Add DeicingFluids
  const f1 = await prisma.deicingFluid.upsert({
    where: { batchNumber: 'KIL-2025-A001' },
    update: {},
    create: {
      fluidType: 'TYPE_I',
      brandName: 'Kilfrost ABC-I',
      manufacturer: 'Kilfrost',
      batchNumber: 'KIL-2025-A001',
      quantityLiters: 1000,
      unitPrice: 3.50,
      concentration: '100/0',
      expiryDate: new Date('2027-03-31'),
      storageLocation: 'Skladište B - Polica 1',
      notes: 'Type I fluid — za de-icing',
    },
  })

  const f2 = await prisma.deicingFluid.upsert({
    where: { batchNumber: 'CLA-2025-B042' },
    update: {},
    create: {
      fluidType: 'TYPE_IV',
      brandName: 'Clariant Safewing MP IV Launch',
      manufacturer: 'Clariant',
      batchNumber: 'CLA-2025-B042',
      quantityLiters: 500,
      unitPrice: 12.80,
      concentration: '100/0',
      expiryDate: new Date('2027-09-30'),
      storageLocation: 'Skladište B - Polica 2',
      notes: 'Type IV anti-icing fluid',
    },
  })

  const f3 = await prisma.deicingFluid.upsert({
    where: { batchNumber: 'KIL-2024-C015' },
    update: {},
    create: {
      fluidType: 'TYPE_II',
      brandName: 'Kilfrost ABC-S Plus',
      manufacturer: 'Kilfrost',
      batchNumber: 'KIL-2024-C015',
      quantityLiters: 80,
      unitPrice: 8.20,
      concentration: '75/25',
      expiryDate: new Date('2026-09-15'), // ističe uskoro
      storageLocation: 'Skladište B - Polica 3',
      notes: 'Type II 75/25 — ističe uskoro',
    },
  })

  const f4 = await prisma.deicingFluid.upsert({
    where: { batchNumber: 'OLD-2023-X001' },
    update: {},
    create: {
      fluidType: 'TYPE_I',
      brandName: 'Old Stock ABC-I',
      manufacturer: 'Generic',
      batchNumber: 'OLD-2023-X001',
      quantityLiters: 50,
      unitPrice: 2.80,
      concentration: '100/0',
      expiryDate: new Date('2025-03-15'), // isteklo
      storageLocation: 'Skladište B - Polica 5',
      notes: 'ISTEKLO — čeka disposal',
      isExpired: true,
    },
  })

  console.log('Created fluids:', f1.batchNumber, f2.batchNumber, f3.batchNumber, f4.batchNumber)

  // Add DeicingRecords
  const now = new Date()
  const yesterday = new Date(now.getTime() - 86400000)
  const lastWeek = new Date(now.getTime() - 7 * 86400000)

  const r1 = await prisma.deicingRecord.create({
    data: {
      flightNumber: 'AY1234',
      aircraftReg: 'OH-LXA',
      aircraftType: 'A320',
      standPosition: '5',
      operationType: 'DEICING',
      fluidType: 'TYPE_I',
      fluidBatchNumber: 'KIL-2025-A001',
      fluidUsedLiters: 250,
      applicationStart: yesterday,
      applicationEnd: new Date(yesterday.getTime() + 8 * 60000),
      durationMinutes: 8,
      oat: -2,
      precipitation: 'SNOW',
      precipitationIntensity: 'MODERATE',
      windSpeed: 4.2,
      windDirection: 320,
      visibility: 1500,
      holdoverTimeMinutes: 15,
      hotTableRef: 'TYPE_I 100/0 - SNOW MODERATE @ -2°C',
      equipmentCode: 'GSE-DEI-001',
      operatorName: 'Vukan Vojvodić',
      operatorCardId: 'EMP-1001',
      shift: 'Morning',
      inspectionResult: 'CLEAN',
      postCheckBy: 'Milica Medenica',
      notes: 'Standardna de-icing operacija',
    },
  })

  const r2 = await prisma.deicingRecord.create({
    data: {
      flightNumber: 'OS456',
      aircraftReg: 'OE-GLM',
      aircraftType: 'B737-800',
      standPosition: '3',
      operationType: 'ANTI_ICING',
      fluidType: 'TYPE_IV',
      concentration: '100/0',
      fluidBatchNumber: 'CLA-2025-B042',
      fluidUsedLiters: 80,
      applicationStart: lastWeek,
      applicationEnd: new Date(lastWeek.getTime() + 12 * 60000),
      durationMinutes: 12,
      oat: -5,
      precipitation: 'FREEZING_DRIZZLE',
      precipitationIntensity: 'LIGHT',
      windSpeed: 2.5,
      windDirection: 280,
      visibility: 3000,
      holdoverTimeMinutes: 35,
      hotTableRef: 'TYPE_IV 100/0 - FREEZING_DRIZZLE LIGHT @ -5°C',
      equipmentCode: 'GSE-DEI-002',
      operatorName: 'Blažo Adžić',
      operatorCardId: 'EMP-1005',
      shift: 'Night',
      inspectionResult: 'CLEAN',
      notes: 'Anti-icing prije polijetanja',
    },
  })

  console.log('Created records:', r1.flightNumber, r2.flightNumber)

  // Add Disposal
  const d1 = await prisma.deicingFluidDisposal.create({
    data: {
      disposalDate: new Date(now.getTime() - 14 * 86400000),
      fluidType: 'TYPE_I',
      batchNumber: 'OLD-2022-X099',
      quantityLiters: 30,
      disposalMethod: 'COLLECTED_BY_VENDOR',
      vendorName: 'EcoDispose d.o.o.',
      vendorLicense: 'LP-2025-001',
      manifestNumber: 'MAN-2025-014',
      disposalCost: 75.00,
      location: 'Skladište B',
      notes: 'Istekla tečnost — disposal preko ovogđenog vendora',
    },
  })

  console.log('Created disposal:', d1.manifestNumber)
  console.log('\nSeed complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
