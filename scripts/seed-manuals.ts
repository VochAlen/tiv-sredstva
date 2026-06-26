import { db } from '../src/lib/db'
import { EQUIPMENT_TYPE_LABELS } from '../src/lib/types'

async function main() {
  console.log('Seeding equipment manuals...')

  // Demo PDF URLs (zamijenite stvarnim PDF linkovima)
  const manuals = [
    { equipmentType: 'TOW_TRACTOR', title: 'Goldhofer AST-2 Operating Manual', manualUrl: 'https://www.goldhofer.com/fileadmin/user_upload/Downloads/Products/AST-2_Manual.pdf', manualType: 'OPERATING', language: 'en', version: 'v3.0' },
    { equipmentType: 'TOW_TRACTOR', title: 'Tow Tractor Safety Procedures', manualUrl: 'https://example.com/safety/tow-tractor-safety.pdf', manualType: 'SAFETY', language: 'en', version: 'v1.0' },
    { equipmentType: 'GPU', title: 'ITW GSE 1400 GPU Manual', manualUrl: 'https://www.itwgse.com/products/gpu-1400/manual.pdf', manualType: 'OPERATING', language: 'en', version: 'v2.1' },
    { equipmentType: 'BELT_LOADER', title: 'TLD TB-150 Belt Loader Manual', manualUrl: 'https://www.tld-group.com/products/belt-loaders/tb-150/manual.pdf', manualType: 'OPERATING', language: 'en', version: 'v1.8' },
    { equipmentType: 'PUSHBACK', title: 'Goldhofer AST-1X Pushback Manual', manualUrl: 'https://www.goldhofer.com/fileadmin/user_upload/Downloads/Products/AST-1X_Manual.pdf', manualType: 'OPERATING', language: 'en', version: 'v2.5' },
    { equipmentType: 'STAIRS', title: 'Passenger Stairs Manual', manualUrl: 'https://example.com/manuals/stairs-manual.pdf', manualType: 'OPERATING', language: 'en', version: 'v1.2' },
    { equipmentType: 'BUS', title: 'Cobus 3000 Operating Manual', manualUrl: 'https://example.com/manuals/cobus-3000-manual.pdf', manualType: 'OPERATING', language: 'en', version: 'v4.0' },
  ]

  for (const m of manuals) {
    const existing = await db.equipmentManual.findFirst({
      where: { equipmentType: m.equipmentType, title: m.title },
    })
    if (!existing) {
      await db.equipmentManual.create({ data: m })
      console.log(`  + ${m.title} (${m.equipmentType})`)
    } else {
      console.log(`  = ${m.title} (already exists)`)
    }
  }

  // Takođe, dodaj manualUrl direktno na nekoliko equipment-a
  const tow001 = await db.equipment.findUnique({ where: { code: 'GSE-TOW-001' } })
  if (tow001 && !tow001.manualUrl) {
    await db.equipment.update({
      where: { id: tow001.id },
      data: { manualUrl: 'https://www.goldhofer.com/fileadmin/user_upload/Downloads/Products/AST-2_Manual.pdf' },
    })
    console.log('  + Added manualUrl to GSE-TOW-001')
  }

  const gpu001 = await db.equipment.findUnique({ where: { code: 'GSE-GPU-001' } })
  if (gpu001 && !gpu001.manualUrl) {
    await db.equipment.update({
      where: { id: gpu001.id },
      data: { manualUrl: 'https://www.itwgse.com/products/gpu-1400/manual.pdf' },
    })
    console.log('  + Added manualUrl to GSE-GPU-001')
  }

  console.log('Done!')
}

main().then(() => db.$disconnect()).catch(console.error)
