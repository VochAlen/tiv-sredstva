// Seed: realan aerodromski GSE inventar + primjeri zaposlenih
// Pokrenite: bun run db:seed

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const equipment = [
  // TOW TRACTORS (vukeri)
  { code: 'GSE-TOW-001', name: 'Tow Tractor Goldhofer AST-2', type: 'TOW_TRACTOR', serialNumber: 'GH-2019-045', location: 'Stand B12', status: 'AVAILABLE' },
  { code: 'GSE-TOW-002', name: 'Tow Tractor Douglas KT-15', type: 'TOW_TRACTOR', serialNumber: 'DK-2021-082', location: 'Stand B14', status: 'AVAILABLE' },
  { code: 'GSE-TOW-003', name: 'Tow Tractor JBT AeroTech', type: 'TOW_TRACTOR', serialNumber: 'JBT-2020-117', location: 'Maintenance Hangar', status: 'MAINTENANCE', notes: 'Zamjena hidraulike - planirano završetak 18.06.' },

  // GPU - Ground Power Units
  { code: 'GSE-GPU-001', name: 'GPU ITW GSE 1400', type: 'GPU', serialNumber: 'ITW-2018-011', location: 'Stand A1', status: 'AVAILABLE' },
  { code: 'GSE-GPU-002', name: 'GPU Textron GSE 90kVA', type: 'GPU', serialNumber: 'TX-2022-034', location: 'Stand A3', status: 'AVAILABLE' },
  { code: 'GSE-GPU-003', name: 'GPU Houchin Diesel', type: 'GPU', serialNumber: 'HC-2017-008', location: 'Stand C5', status: 'OUT_OF_SERVICE', notes: 'Oštećen kabel - prijava otvorena' },

  // BELT LOADERS (trakasti utovarivači)
  { code: 'GSE-BLT-001', name: 'Belt Loader TLD TB-150', type: 'BELT_LOADER', serialNumber: 'TLD-2019-201', location: 'Stand A2', status: 'AVAILABLE' },
  { code: 'GSE-BLT-002', name: 'Belt Loader Mallaghan BL-7', type: 'BELT_LOADER', serialNumber: 'MG-2020-145', location: 'Stand B11', status: 'AVAILABLE' },
  { code: 'GSE-BLT-003', name: 'Belt Loader NMC WDS50', type: 'BELT_LOADER', serialNumber: 'NMC-2023-008', location: 'Stand C2', status: 'AVAILABLE' },

  // PUSHBACK
  { code: 'GSE-PB-001', name: 'Pushback Goldhofer AST-1X', type: 'PUSHBACK', serialNumber: 'GH-2020-019', location: 'Head-of-stand A', status: 'AVAILABLE' },
  { code: 'GSE-PB-002', name: 'Pushback Douglas KPD-40', type: 'PUSHBACK', serialNumber: 'DK-2021-022', location: 'Head-of-stand B', status: 'AVAILABLE' },

  // PASSENGER STAIRS
  { code: 'GSE-STR-001', name: 'Passenger Stairs TLD PS-30', type: 'STAIRS', serialNumber: 'TLD-2018-088', location: 'Remote Stand R3', status: 'AVAILABLE' },
  { code: 'GSE-STR-002', name: 'Passenger Stairs Mallaghan', type: 'STAIRS', serialNumber: 'MG-2019-045', location: 'Remote Stand R5', status: 'AVAILABLE' },

  // CARGO DOLLY
  { code: 'GSE-DLY-001', name: 'Cargo Dolly CD-10T', type: 'DOLLY', serialNumber: 'CD-2017-301', location: 'Cargo Area', status: 'AVAILABLE' },
  { code: 'GSE-DLY-002', name: 'Container Dolly PMC', type: 'DOLLY', serialNumber: 'CD-2020-122', location: 'Cargo Area', status: 'AVAILABLE' },

  // LAVATORY SERVICE
  { code: 'GSE-LAV-001', name: 'Lavatory Service Truck', type: 'LAVATORY', serialNumber: 'LS-2019-007', location: 'Service Road S1', status: 'AVAILABLE' },

  // WATER SERVICE
  { code: 'GSE-WTR-001', name: 'Potable Water Truck 5000L', type: 'WATER', serialNumber: 'PW-2021-014', location: 'Service Road S2', status: 'AVAILABLE' },

  // BUS
  { code: 'GSE-BUS-001', name: 'Passenger Bus Cobus 3000', type: 'BUS', serialNumber: 'CB-2018-002', location: 'Bus Stop 1', status: 'AVAILABLE' },
  { code: 'GSE-BUS-002', name: 'Passenger Bus Cobus 3000', type: 'BUS', serialNumber: 'CB-2019-005', location: 'Bus Stop 2', status: 'AVAILABLE' },
]

const employees = [
  { cardId: 'EMP-1001', name: 'Vukan Vojvodić', department: 'Ramp', role: 'Operator' },
  { cardId: 'EMP-1002', name: 'Milena Popović', department: 'Ramp', role: 'Operator' },
  { cardId: 'EMP-1003', name: 'Novak Knežević', department: 'Ramp', role: 'Senior Operator' },
  { cardId: 'EMP-1004', name: 'Milica Medenica', department: 'Maintenance', role: 'Technician' },
  { cardId: 'EMP-1005', name: 'Blažo Adžić', department: 'Operations', role: 'Supervisor' },
]

async function main() {
  console.log('Seeding database...')

  for (const e of equipment) {
    await db.equipment.upsert({
      where: { code: e.code },
      update: {},
      create: {
        code: e.code,
        name: e.name,
        type: e.type,
        serialNumber: e.serialNumber,
        location: e.location,
        status: e.status,
        notes: e.notes,
      },
    })
  }

  for (const emp of employees) {
    await db.employee.upsert({
      where: { cardId: emp.cardId },
      update: {},
      create: emp,
    })
  }

  console.log(`Seeded ${equipment.length} equipment items and ${employees.length} employees`)

  // Seed equipment manuals — PDF fajlovi su u /public/manuals/
  const manuals = [
    { equipmentType: 'TOW_TRACTOR', title: 'Goldhofer AST-2 Operating Manual', manualUrl: '/manuals/tow-tractor-ast2.pdf', manualType: 'OPERATING', language: 'en', version: 'v3.0' },
    { equipmentType: 'TOW_TRACTOR', title: 'Tow Tractor Safety Procedures', manualUrl: '/manuals/tow-tractor-safety.pdf', manualType: 'SAFETY', language: 'en', version: 'v1.0' },
    { equipmentType: 'GPU', title: 'ITW GSE 1400 GPU Manual', manualUrl: '/manuals/gpu-itw-1400.pdf', manualType: 'OPERATING', language: 'en', version: 'v2.1' },
    { equipmentType: 'BELT_LOADER', title: 'TLD TB-150 Belt Loader Manual', manualUrl: '/manuals/belt-loader-tb150.pdf', manualType: 'OPERATING', language: 'en', version: 'v1.8' },
    { equipmentType: 'PUSHBACK', title: 'Goldhofer AST-1X Pushback Manual', manualUrl: '/manuals/pushback-ast1x.pdf', manualType: 'OPERATING', language: 'en', version: 'v2.5' },
    { equipmentType: 'STAIRS', title: 'Passenger Stairs Manual', manualUrl: '/manuals/stairs.pdf', manualType: 'OPERATING', language: 'en', version: 'v1.2' },
    { equipmentType: 'BUS', title: 'Cobus 3000 Operating Manual', manualUrl: '/manuals/cobus-3000.pdf', manualType: 'OPERATING', language: 'en', version: 'v4.0' },
  ]

  for (const m of manuals) {
    const existing = await db.equipmentManual.findFirst({
      where: { equipmentType: m.equipmentType, title: m.title },
    })
    if (!existing) {
      await db.equipmentManual.create({ data: m })
    }
  }

  // Dodaj manualUrl direktno na nekoliko opreme
  await db.equipment.updateMany({
    where: { code: 'GSE-TOW-001' },
    data: { manualUrl: '/manuals/tow-tractor-ast2.pdf' },
  })
  await db.equipment.updateMany({
    where: { code: 'GSE-GPU-001' },
    data: { manualUrl: '/manuals/gpu-itw-1400.pdf' },
  })

  console.log(`Seeded ${manuals.length} equipment manuals`)
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await db.$disconnect()
    process.exit(1)
  })
