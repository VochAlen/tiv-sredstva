// Dodaje realne demo podatke za screenshootove
import { db } from '../src/lib/db'

async function main() {
  console.log('Adding demo data...')

  // 1. Zaduži nekoliko vozila (kreiraj zaposlene + check-out)
  const emp1 = await db.employee.upsert({
    where: { cardId: 'EMP-1001' },
    update: { name: 'Aldin Hodić' },
    create: { cardId: 'EMP-1001', name: 'Aldin Hodić', department: 'Ramp', role: 'Operator' },
  })
  const emp2 = await db.employee.upsert({
    where: { cardId: 'EMP-1002' },
    update: { name: 'Marija Kovač' },
    create: { cardId: 'EMP-1002', name: 'Marija Kovač', department: 'Ramp', role: 'Operator' },
  })
  const emp3 = await db.employee.upsert({
    where: { cardId: 'EMP-1003' },
    update: { name: 'Nikola Petrović' },
    create: { cardId: 'EMP-1003', name: 'Nikola Petrović', department: 'Ramp', role: 'Senior Operator' },
  })
  const emp4 = await db.employee.upsert({
    where: { cardId: 'EMP-1004' },
    update: { name: 'Ana Novak' },
    create: { cardId: 'EMP-1004', name: 'Ana Novak', department: 'Maintenance', role: 'Technician' },
  })

  // Zaduži 4 sredstva
  const toAssign = ['GSE-TOW-001', 'GSE-BLT-001', 'GSE-PB-001', 'GSE-BUS-001']
  for (const code of toAssign) {
    const eq = await db.equipment.findUnique({ where: { code } })
    if (!eq) continue
    await db.equipment.update({ where: { id: eq.id }, data: { status: 'ASSIGNED' } })
    const emp = code === 'GSE-TOW-001' ? emp1 : code === 'GSE-BLT-001' ? emp2 : code === 'GSE-PB-001' ? emp3 : emp2
    await db.assignment.create({
      data: {
        equipmentId: eq.id,
        equipmentCode: eq.code,
        equipmentName: eq.name,
        employeeId: emp.id,
        employeeCardId: emp.cardId,
        employeeName: emp.name,
        action: 'CHECK_OUT',
        inspectionResult: 'OK',
        inspectionNotes: 'Sve u redu',
        checklistJson: '[]',
        timestamp: new Date(Date.now() - Math.floor(Math.random() * 4 * 3600 * 1000)),
      },
    })
  }

  // 2. Kreiraj nekoliko damage reports
  const damages = [
    { code: 'GSE-GPU-003', sev: 'MAJOR', desc: 'Oštećen kabel za napajanje aviona, izloženi provodnici na dijelu oko konektora', status: 'OPEN', emp: emp1 },
    { code: 'GSE-BLT-002', sev: 'MINOR', desc: 'Manja ogrebotina na bočnoj strani karoserije, ne utiče na funkcionalnost', status: 'IN_REPAIR', emp: emp2 },
    { code: 'GSE-STR-001', sev: 'CRITICAL', desc: 'Hidraulična pumpa za podizanje stepenica ne radi - vozilo ne može podići stepenice', status: 'OPEN', emp: emp3 },
    { code: 'GSE-DLY-001', sev: 'MINOR', desc: 'Pričvršćivač za LD3 kontejner blago savijen', status: 'OPEN', emp: emp1 },
    { code: 'GSE-TOW-002', sev: 'MAJOR', desc: 'Curenje hidrauličnog ulja iz zadnje osovine', status: 'IN_REPAIR', emp: emp3 },
  ]

  for (const d of damages) {
    const eq = await db.equipment.findUnique({ where: { code: d.code } })
    if (!eq) continue
    await db.equipment.update({
      where: { id: eq.id },
      data: { status: 'OUT_OF_SERVICE', notes: `Oštećenje prijavljeno: ${d.desc.slice(0, 80)}` },
    })
    await db.damageReport.create({
      data: {
        equipmentId: eq.id,
        equipmentCode: eq.code,
        equipmentName: eq.name,
        reportedByCardId: d.emp.cardId,
        reportedByName: d.emp.name,
        employeeId: d.emp.id,
        severity: d.sev,
        description: d.desc,
        status: d.status,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 72 * 3600 * 1000)),
      },
    })
  }

  // 3. Jedno riješeno oštećenje (istorija)
  const eqBLT3 = await db.equipment.findUnique({ where: { code: 'GSE-BLT-003' } })
  if (eqBLT3) {
    await db.damageReport.create({
      data: {
        equipmentId: eqBLT3.id,
        equipmentCode: eqBLT3.code,
        equipmentName: eqBLT3.name,
        reportedByCardId: emp1.cardId,
        reportedByName: emp1.name,
        employeeId: emp1.id,
        severity: 'MINOR',
        description: 'Traka za utovar blago istrošena, potrebna zamjena',
        status: 'RESOLVED',
        resolution: 'Traka zamijenjena novom, testirano pod opterećenjem - radi ispravno',
        createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
        resolvedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      },
    })
  }

  // 4. Dodaj nešto istorije aktivnosti (check-in / check-out u prošlosti)
  const historyItems = [
    { code: 'GSE-TOW-002', action: 'CHECK_IN', emp: emp1, result: 'OK', notes: 'Sve OK', hoursAgo: 28 },
    { code: 'GSE-TOW-002', action: 'CHECK_OUT', emp: emp1, result: 'OK', notes: '', hoursAgo: 36 },
    { code: 'GSE-BLT-001', action: 'CHECK_IN', emp: emp3, result: 'OK', notes: 'Sve u redu', hoursAgo: 50 },
    { code: 'GSE-BLT-001', action: 'CHECK_OUT', emp: emp3, result: 'OK', notes: '', hoursAgo: 58 },
    { code: 'GSE-GPU-001', action: 'CHECK_IN', emp: emp2, result: 'MINOR_DAMAGE', notes: 'Primijećena manja ogrebotina', hoursAgo: 72 },
    { code: 'GSE-GPU-001', action: 'CHECK_OUT', emp: emp2, result: 'OK', notes: '', hoursAgo: 80 },
    { code: 'GSE-BUS-002', action: 'CHECK_IN', emp: emp1, result: 'OK', notes: '', hoursAgo: 100 },
    { code: 'GSE-BUS-002', action: 'CHECK_OUT', emp: emp1, result: 'OK', notes: '', hoursAgo: 108 },
    { code: 'GSE-PB-002', action: 'CHECK_IN', emp: emp3, result: 'OK', notes: '', hoursAgo: 130 },
    { code: 'GSE-PB-002', action: 'CHECK_OUT', emp: emp3, result: 'OK', notes: '', hoursAgo: 140 },
  ]

  for (const h of historyItems) {
    const eq = await db.equipment.findUnique({ where: { code: h.code } })
    if (!eq) continue
    const emp = await db.employee.findUnique({ where: { cardId: h.emp.cardId } })
    if (!emp) continue
    await db.assignment.create({
      data: {
        equipmentId: eq.id,
        equipmentCode: eq.code,
        equipmentName: eq.name,
        employeeId: emp.id,
        employeeCardId: emp.cardId,
        employeeName: emp.name,
        action: h.action,
        inspectionResult: h.result,
        inspectionNotes: h.notes || null,
        checklistJson: '[]',
        timestamp: new Date(Date.now() - h.hoursAgo * 3600 * 1000),
      },
    })
  }

  console.log('Demo data added:')
  console.log('- 4 active check-outs')
  console.log('- 5 open/in-repair damages')
  console.log('- 1 resolved damage (history)')
  console.log('- 10 historical assignments')
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await db.$disconnect()
    process.exit(1)
  })
