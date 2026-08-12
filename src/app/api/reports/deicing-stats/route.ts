import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'

const FLUID_LABELS: Record<string, string> = {
  TYPE_I: 'Type I', TYPE_II: 'Type II', TYPE_III: 'Type III', TYPE_IV: 'Type IV',
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  let fluids: any[] = []
  let records: any[] = []
  let disposals: any[] = []

  if (isDemoMode()) {
    [fluids, records, disposals] = await Promise.all([
      db.deicingFluid.findMany(),
      db.deicingRecord.findMany(),
      db.deicingFluidDisposal.findMany(),
    ])
  } else {
    const supabase = await createSupabaseClient()
    const [f, r, d] = await Promise.all([
      supabase.from('deicing_fluids').select('*'),
      supabase.from('deicing_records').select('*'),
      supabase.from('deicing_fluid_disposal').select('*'),
    ])
    fluids = f.data ?? []
    records = (r.data ?? []).map((x: any) => ({
      fluidType: x.fluid_type, fluidUsedLiters: x.fluid_used_liters,
      applicationStart: x.application_start, equipmentCode: x.equipment_code,
    }))
    disposals = (d.data ?? []).map((x: any) => ({
      fluidType: x.fluid_type, quantityLiters: x.quantity_liters, disposalCost: x.disposal_cost, disposalMethod: x.disposal_method,
    }))
  }

  const today = new Date()

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const pageWidth = 595.28, pageHeight = 841.89, margin = 50
  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const addText = (text: string, x: number, yVal: number, opts: any = {}) => {
    const { size = 10, font: f = font, color = rgb(0, 0, 0) } = opts
    try { page.drawText(transliterate(text), { x, y: yVal, size, font: f, color }) } catch {}
  }

  addText('GSE CONTROL — DE-ICING STATISTIKA', margin, y, { size: 16, font: fontBold }); y -= 20
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 20

  // Summary
  const totalStock = fluids.reduce((s, f) => s + f.quantityLiters, 0)
  const stockValue = fluids.reduce((s, f) => s + (f.quantityLiters * (f.unitPrice || 0)), 0)
  const totalUsed = records.reduce((s, r) => s + (r.fluidUsedLiters || 0), 0)
  const totalDisposed = disposals.reduce((s, d) => s + d.quantityLiters, 0)
  const totalDisposalCost = disposals.reduce((s, d) => s + (d.disposalCost || 0), 0)
  const expired = fluids.filter((f) => f.expiryDate && new Date(f.expiryDate) < today).length

  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Tečnosti u stock: ${totalStock.toFixed(1)} L (${fluids.length} stavki)`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Vrijednost stock: ${stockValue.toFixed(2)} EUR`, margin + 10, y, { size: 10, color: rgb(0.1, 0.5, 0.1) }); y -= 12
  addText(`• Ukupno potrošeno: ${totalUsed.toFixed(1)} L (${records.length} operacija)`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Ukupno odbačeno: ${totalDisposed.toFixed(1)} L`, margin + 10, y, { size: 10, color: rgb(0.86, 0.4, 0.1) }); y -= 12
  addText(`• Trosak disposal-a: ${totalDisposalCost.toFixed(2)} EUR`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Istekle tečnosti: ${expired}`, margin + 10, y, { size: 10, color: expired > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 20

  // By type
  addText('PO TIPU TEČNOSTI:', margin, y, { size: 12, font: fontBold }); y -= 14
  const byType: Record<string, { stock: number; used: number; disposed: number }> = {}
  for (const f of fluids) {
    if (!byType[f.fluidType]) byType[f.fluidType] = { stock: 0, used: 0, disposed: 0 }
    byType[f.fluidType].stock += f.quantityLiters
  }
  for (const r of records) {
    if (!byType[r.fluidType]) byType[r.fluidType] = { stock: 0, used: 0, disposed: 0 }
    byType[r.fluidType].used += r.fluidUsedLiters || 0
  }
  for (const d of disposals) {
    if (!byType[d.fluidType]) byType[d.fluidType] = { stock: 0, used: 0, disposed: 0 }
    byType[d.fluidType].disposed += d.quantityLiters
  }
  ;['Tip', 'Stock (L)', 'Potrošeno (L)', 'Odbačeno (L)'].forEach((h, i) => addText(h, [margin, margin + 130, margin + 250, margin + 380][i], y, { size: 9, font: fontBold }))
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 12
  for (const [t, d] of Object.entries(byType)) {
    addText((FLUID_LABELS[t] || t).slice(0, 18), margin, y, { size: 9 })
    addText(d.stock.toFixed(1), margin + 130, y, { size: 9 })
    addText(d.used.toFixed(1), margin + 250, y, { size: 9 })
    addText(d.disposed.toFixed(1), margin + 380, y, { size: 9 })
    y -= 11
  }
  y -= 10

  // By vehicle
  if (y < 150) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('PO VOZILU (ISKORIŠTENOST DEICER-A):', margin, y, { size: 12, font: fontBold }); y -= 14
  const byVehicle: Record<string, { ops: number; liters: number }> = {}
  for (const r of records) {
    const code = r.equipmentCode || 'Nepoznato'
    if (!byVehicle[code]) byVehicle[code] = { ops: 0, liters: 0 }
    byVehicle[code].ops += 1
    byVehicle[code].liters += r.fluidUsedLiters || 0
  }
  ;['Vozilo', 'Operacija', 'Potrošeno (L)'].forEach((h, i) => addText(h, [margin, margin + 200, margin + 350][i], y, { size: 9, font: fontBold }))
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 12
  for (const [code, d] of Object.entries(byVehicle)) {
    addText(code.slice(0, 25), margin, y, { size: 9, font: fontBold })
    addText(`${d.ops}`, margin + 200, y, { size: 9 })
    addText(d.liters.toFixed(1), margin + 350, y, { size: 9 })
    y -= 11
  }
  y -= 10

  // By month (last 12)
  if (y < 200) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('OPERACIJE PO MJESECU (POSLEDNJIH 12):', margin, y, { size: 12, font: fontBold }); y -= 14
  const byMonth: Record<string, { ops: number; liters: number }> = {}
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    byMonth[key] = { ops: 0, liters: 0 }
  }
  for (const r of records) {
    const d = new Date(r.applicationStart)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (byMonth[key]) {
      byMonth[key].ops += 1
      byMonth[key].liters += r.fluidUsedLiters || 0
    }
  }
  ;['Mjesec', 'Operacija', 'Potrošeno (L)'].forEach((h, i) => addText(h, [margin, margin + 200, margin + 350][i], y, { size: 9, font: fontBold }))
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 12
  for (const [month, d] of Object.entries(byMonth)) {
    addText(month, margin, y, { size: 9, font: fontBold })
    addText(`${d.ops}`, margin + 200, y, { size: 9 })
    addText(d.liters.toFixed(1), margin + 350, y, { size: 9 })
    y -= 11
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="deicing-stats-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
