// Seed Aerodrome Inspection data (Demo mode)
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const now = new Date()
  const yesterday = new Date(now.getTime() - 86400000)
  const lastWeek = new Date(now.getTime() - 7 * 86400000)
  const lastMonth = new Date(now.getTime() - 30 * 86400000)

  // 1. Clean runway inspection (yesterday morning)
  const i1 = await prisma.aerodromeInspection.create({
    data: {
      inspectionType: 'RUNWAY',
      inspectionDate: new Date(yesterday.setHours(6, 30, 0, 0)),
      performedBy: 'Milica Medenica',
      performedByCardId: 'EMP-1004',
      shift: 'Morning',
      runwayCode: '14/32',
      weatherConditions: 'Clear, OAT 8°C, wind 280/6kt',
      visibility: 10000,
      runwayCondition: 'DRY',
      status: 'COMPLETED',
      findingsCount: 0,
      criticalCount: 0,
      runwaySurface: 'OK', runwayMarkings: 'OK', runwayLights: 'OK', papiLights: 'OK',
      windDirectionIndicators: 'OK',
      notes: 'Redovna jutarnja inspekcija prije prvog leta',
    },
  })

  // 2. Runway inspection with findings (last week)
  const i2 = await prisma.aerodromeInspection.create({
    data: {
      inspectionType: 'RUNWAY',
      inspectionDate: new Date(lastWeek.setHours(14, 0, 0, 0)),
      performedBy: 'Blažo Adžić',
      performedByCardId: 'EMP-1005',
      shift: 'Evening',
      runwayCode: '14/32',
      weatherConditions: 'Light rain, OAT 12°C, wind 320/10kt',
      visibility: 5000,
      runwayCondition: 'WET',
      status: 'WITH_FINDINGS',
      findingsCount: 2,
      criticalCount: 0,
      runwaySurface: 'NOT_OK', runwayMarkings: 'OK', runwayLights: 'OK', papiLights: 'OK',
      windDirectionIndicators: 'OK',
      notes: 'Pronađeni FOD i oštećenje oznaka',
      findings: {
        create: [
          {
            category: 'FOD', severity: 'MEDIUM',
            description: 'Komad metala pronađen na RWY 14, 200m od praga',
            location: 'RWY 14, 200m from threshold',
            latitude: 42.4047, longitude: 18.7321,
            actionRequired: 'Ukloniti FOD prije sljedećeg leta',
            status: 'RESOLVED',
            resolvedAt: new Date(lastWeek.getTime() + 3600000),
            resolvedBy: 'Vukan Vojvodić',
          },
          {
            category: 'MARKINGS', severity: 'LOW',
            description: 'Izbledjela centar linija na RWY 32',
            location: 'RWY 32, 500m from threshold',
            actionRequired: 'Planirati ponovno bojenje u proljeće',
            status: 'DEFERRED',
          },
        ],
      },
    },
  })

  // 3. Critical runway inspection (last month)
  const i3 = await prisma.aerodromeInspection.create({
    data: {
      inspectionType: 'RUNWAY',
      inspectionDate: new Date(lastMonth.setHours(10, 0, 0, 0)),
      performedBy: 'Milica Medenica',
      performedByCardId: 'EMP-1004',
      shift: 'Morning',
      runwayCode: '14/32',
      weatherConditions: 'Snow, OAT -2°C, wind 340/8kt',
      visibility: 2000,
      runwayCondition: 'SNOW',
      status: 'CRITICAL',
      findingsCount: 1,
      criticalCount: 1,
      runwaySurface: 'NOT_OK', runwayMarkings: 'OK', runwayLights: 'NOT_OK', papiLights: 'OK',
      windDirectionIndicators: 'OK',
      notes: 'Kritično — runway svjetla ne rade',
      findings: {
        create: [
          {
            category: 'LIGHTING', severity: 'CRITICAL',
            description: 'RWY edge lights sekvence 7-12 ne rade',
            location: 'RWY 14/32, 700-900m',
            latitude: 42.4050, longitude: 18.7325,
            actionRequired: 'Hitna zamjena lampi — obustaviti operacije noću',
            status: 'IN_PROGRESS',
          },
        ],
      },
    },
  })

  // 4. Taxiway inspection (yesterday)
  const i4 = await prisma.aerodromeInspection.create({
    data: {
      inspectionType: 'TAXIWAY',
      inspectionDate: new Date(yesterday.setHours(7, 0, 0, 0)),
      performedBy: 'Vukan Vojvodić',
      performedByCardId: 'EMP-1001',
      shift: 'Morning',
      taxiwayCode: 'A',
      weatherConditions: 'Clear, OAT 8°C',
      status: 'WITH_FINDINGS',
      findingsCount: 1,
      criticalCount: 0,
      taxiwaySurface: 'OK', taxiwaySigns: 'OK', taxiwayLights: 'NOT_OK',
      findings: {
        create: [
          {
            category: 'LIGHTING', severity: 'HIGH',
            description: '2 taxiway svjetla na TWY A ne rade',
            location: 'TWY A, blizu Intersection A1',
            actionRequired: 'Zamijeniti sijalice u toku smjene',
            status: 'OPEN',
          },
        ],
      },
    },
  })

  // 5. Apron inspection
  const i5 = await prisma.aerodromeInspection.create({
    data: {
      inspectionType: 'APRON',
      inspectionDate: new Date(now.getTime() - 2 * 3600000),
      performedBy: 'Blažo Adžić',
      performedByCardId: 'EMP-1005',
      shift: 'Morning',
      apronArea: 'Apron 1 - Stands A1-A5',
      weatherConditions: 'Clear, OAT 10°C',
      status: 'WITH_FINDINGS',
      findingsCount: 2,
      criticalCount: 0,
      gseParking: 'NOT_OK', fodCheck: 'OK', markings: 'OK', fuelingArea: 'OK',
      findings: {
        create: [
          {
            category: 'GSE_PARKING', severity: 'MEDIUM',
            description: 'GSE oprema nepravilno parkirana na Stand A3',
            location: 'Apron 1, Stand A3',
            latitude: 42.4040, longitude: 18.7315,
            actionRequired: 'Obavijestiti operatere da pravilno parkiraju',
            status: 'OPEN',
          },
          {
            category: 'FOD', severity: 'LOW',
            description: 'Plastični poklopac pronađen kod Stand A1',
            location: 'Apron 1, Stand A1',
            actionRequired: 'Ukloniti',
            status: 'RESOLVED',
            resolvedAt: new Date(),
            resolvedBy: 'Vukan Vojvodić',
          },
        ],
      },
    },
  })

  // 6. Movement area joint inspection
  const i6 = await prisma.aerodromeInspection.create({
    data: {
      inspectionType: 'MOVEMENT_AREA_JOINT',
      inspectionDate: new Date(now.getTime() - 3 * 86400000),
      performedBy: 'Milica Medenica',
      performedByCardId: 'EMP-1004',
      shift: 'Morning',
      weatherConditions: 'Clear, OAT 12°C',
      status: 'COMPLETED',
      findingsCount: 0,
      criticalCount: 0,
      drainageSystem: 'OK', perimeterFence: 'OK', wildlifeActivity: 'OK',
      notes: 'Zajednička inspekcija movement area — sve OK',
    },
  })

  console.log('Created inspections:', i1.id.slice(0, 8), i2.id.slice(0, 8), i3.id.slice(0, 8), i4.id.slice(0, 8), i5.id.slice(0, 8), i6.id.slice(0, 8))

  // Create NOTAM for critical finding
  const criticalFinding = await prisma.inspectionFinding.findFirst({
    where: { severity: 'CRITICAL' },
  })
  if (criticalFinding) {
    const n1 = await prisma.notam.create({
      data: {
        notamNumber: 'A1234/26',
        series: 'A',
        qualifier: 'NOTAMN',
        aerodrome: 'LYTV',
        subject: 'RWY',
        condition: 'LIGHTING U/S',
        purpose: 'B',
        scope: 'A',
        traffic: 'IV',
        text: 'RWY 14/32 EDGE LIGHTS SEQUENCE 7-12 U/S. NIGHT OPERATIONS PROHIBITED UNTIL REPAIRED.',
        createdFromFindingId: criticalFinding.id,
        createdFromInspectionId: i3.id,
        status: 'ACTIVE',
        validFrom: new Date(lastMonth),
        validTo: new Date(now.getTime() + 7 * 86400000),
        createdBy: 'Blažo Adžić',
      },
    })
    // Mark finding as having NOTAM
    await prisma.inspectionFinding.update({
      where: { id: criticalFinding.id },
      data: { notamGenerated: true, notamNumber: 'A1234/26' },
    })
    console.log('Created NOTAM:', n1.notamNumber)
  }

  // Cancelled NOTAM
  const n2 = await prisma.notam.create({
    data: {
      notamNumber: 'A1230/26',
      series: 'A',
      qualifier: 'NOTAMN',
      aerodrome: 'LYTV',
      subject: 'TWY',
      condition: 'CLOSED',
      purpose: 'B',
      scope: 'A',
      traffic: 'IV',
      text: 'TWY B CLOSED DUE TO PAVEMENT MAINTENANCE.',
      status: 'CANCELLED',
      validFrom: new Date(now.getTime() - 14 * 86400000),
      validTo: new Date(now.getTime() - 7 * 86400000),
      createdBy: 'Milica Medenica',
    },
  })
  console.log('Created cancelled NOTAM:', n2.notamNumber)

  console.log('\nSeed complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
