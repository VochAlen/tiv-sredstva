#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * GSE Control - Seed skripta (JavaScript verzija - radi sa Node.js bez tsx/bun)
 * Ubacuje mock podatke u SQLite bazu.
 *
 * Upotreba:
 *   node scripts/seed.js
 *   npm run seed:js
 */

const { PrismaClient } = require('@prisma/client')

const db = new PrismaClient()

const equipment = [
  { code: 'GSE-TOW-001', name: 'Tow Tractor Goldhofer AST-2', type: 'TOW_TRACTOR', serialNumber: 'GH-2019-045', location: 'Stand B12', status: 'AVAILABLE' },
  { code: 'GSE-TOW-002', name: 'Tow Tractor Douglas KT-15', type: 'TOW_TRACTOR', serialNumber: 'DK-2021-082', location: 'Stand B14', status: 'AVAILABLE' },
  { code: 'GSE-TOW-003', name: 'Tow Tractor JBT AeroTech', type: 'TOW_TRACTOR', serialNumber: 'JBT-2020-117', location: 'Maintenance Hangar', status: 'MAINTENANCE', notes: 'Zamjena hidraulike' },
  { code: 'GSE-GPU-001', name: 'GPU ITW GSE 1400', type: 'GPU', serialNumber: 'ITW-2018-011', location: 'Stand A1', status: 'AVAILABLE' },
  { code: 'GSE-GPU-002', name: 'GPU Textron GSE 90kVA', type: 'GPU', serialNumber: 'TX-2022-034', location: 'Stand A3', status: 'AVAILABLE' },
  { code: 'GSE-GPU-003', name: 'GPU Houchin Diesel', type: 'GPU', serialNumber: 'HC-2017-008', location: 'Stand C5', status: 'OUT_OF_SERVICE', notes: 'Oštećen kabel' },
  { code: 'GSE-BLT-001', name: 'Belt Loader TLD TB-150', type: 'BELT_LOADER', serialNumber: 'TLD-2019-201', location: 'Stand A2', status: 'AVAILABLE' },
  { code: 'GSE-BLT-002', name: 'Belt Loader Mallaghan BL-7', type: 'BELT_LOADER', serialNumber: 'MG-2020-145', location: 'Stand B11', status: 'AVAILABLE' },
  { code: 'GSE-BLT-003', name: 'Belt Loader NMC WDS50', type: 'BELT_LOADER', serialNumber: 'NMC-2023-008', location: 'Stand C2', status: 'AVAILABLE' },
  { code: 'GSE-PB-001', name: 'Pushback Goldhofer AST-1X', type: 'PUSHBACK', serialNumber: 'GH-2020-019', location: 'Head-of-stand A', status: 'AVAILABLE' },
  { code: 'GSE-PB-002', name: 'Pushback Douglas KPD-40', type: 'PUSHBACK', serialNumber: 'DK-2021-022', location: 'Head-of-stand B', status: 'AVAILABLE' },
  { code: 'GSE-STR-001', name: 'Passenger Stairs TLD PS-30', type: 'STAIRS', serialNumber: 'TLD-2018-088', location: 'Remote Stand R3', status: 'AVAILABLE' },
  { code: 'GSE-STR-002', name: 'Passenger Stairs Mallaghan', type: 'STAIRS', serialNumber: 'MG-2019-045', location: 'Remote Stand R5', status: 'AVAILABLE' },
  { code: 'GSE-DLY-001', name: 'Cargo Dolly CD-10T', type: 'DOLLY', serialNumber: 'CD-2017-301', location: 'Cargo Area', status: 'AVAILABLE' },
  { code: 'GSE-DLY-002', name: 'Container Dolly PMC', type: 'DOLLY', serialNumber: 'CD-2020-122', location: 'Cargo Area', status: 'AVAILABLE' },
  { code: 'GSE-LAV-001', name: 'Lavatory Service Truck', type: 'LAVATORY', serialNumber: 'LS-2019-007', location: 'Service Road S1', status: 'AVAILABLE' },
  { code: 'GSE-WTR-001', name: 'Potable Water Truck 5000L', type: 'WATER', serialNumber: 'PW-2021-014', location: 'Service Road S2', status: 'AVAILABLE' },
  { code: 'GSE-BUS-001', name: 'Passenger Bus Cobus 3000', type: 'BUS', serialNumber: 'CB-2018-002', location: 'Bus Stop 1', status: 'AVAILABLE' },
  { code: 'GSE-BUS-002', name: 'Passenger Bus Cobus 3000', type: 'BUS', serialNumber: 'CB-2019-005', location: 'Bus Stop 2', status: 'AVAILABLE' },
]

const employees = [
  { cardId: 'EMP-1001', name: 'Vukan Vojvodić', department: 'Ramp', role: 'Operator', pin: '1001', idCardQr: 'EMP-1001' },
  { cardId: 'EMP-1002', name: 'Milena Popović', department: 'Ramp', role: 'Operator', pin: '1002', idCardQr: 'EMP-1002' },
  { cardId: 'EMP-1003', name: 'Novak Knežević', department: 'Ramp', role: 'Senior Operator', pin: '1003', idCardQr: 'EMP-1003' },
  { cardId: 'EMP-1004', name: 'Milica Medenica', department: 'Maintenance', role: 'Technician', pin: '1004', idCardQr: 'EMP-1004' },
  { cardId: 'EMP-1005', name: 'Blažo Adžić', department: 'Operations', role: 'Supervisor', pin: '1005', idCardQr: 'EMP-1005' },
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
      update: { pin: emp.pin, idCardQr: emp.idCardQr },
      create: emp,
    })
  }

  console.log(`Seeded ${equipment.length} equipment items and ${employees.length} employees`)
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await db.$disconnect()
    process.exit(1)
  })
