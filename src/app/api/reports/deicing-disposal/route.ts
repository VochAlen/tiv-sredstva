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
const METHOD_LABELS: Record<string, string> = {
  RECYCLED: 'Reciklaza', INCINERATED: 'Incinacija', TREATMENT_PLANT: 'Tretman', COLLECTED_BY_VENDOR: 'Vendor',
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  let disposals: any[] = []

  if (isDemoMode()) {
    disposals = await db.deicingFluidDisposal.findMany({ orderBy: { disposalDate: 'desc' } })
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('deicing_fluid_disposal').select('*').order('disposal_date', { ascending: false })
    disposals = (data ?? []).map((d: any) => ({
      id: d.id, disposalDate: d.disposal_date, fluidType: d.fluid_type, batchNumber: d.batch_number,
      quantityLiters: d.quantity_liters, disposalMethod: d.disposal_method, vendorName: d.vendor_name,
      vendorLicense: d.vendor_license, manifestNumber: d.manifest_number, disposalCost: d.disposal_cost,
      location: d.location, notes: d.notes,
    }))
  }

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

  addText('GSE CONTROL — DISPOSAL RECORDS (OKOLINA)', margin, y, { size: 16, font: fontBold }); y -= 20
  addText(`ISO 14001 · Environmental Compliance`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 12
  addText(`Ukupno zapisa: ${disposals.length}`, margin, y, { size: 10 }); y -= 20

  // Summary
  const totalLiters = disposals.reduce((s, d) => s + d.quantityLiters, 0)
  const totalCost = disposals.reduce((s, d) => s + (d.disposalCost || 0), 0)
  const byMethod: Record<string, number> = {}
  for (const d of disposals) {
    byMethod[d.disposalMethod] = (byMethod[d.disposalMethod] || 0) + d.quantityLiters
  }

  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Ukupno odbačeno: ${totalLiters.toFixed(1)} L`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Ukupni trosak: ${totalCost.toFixed(2)} EUR`, margin + 10, y, { size: 10, color: rgb(0.86, 0.4, 0.1) }); y -= 12
  for (const [m, q] of Object.entries(byMethod)) {
    addText(`• ${METHOD_LABELS[m] || m}: ${q.toFixed(1)} L`, margin + 10, y, { size: 10 }); y -= 12
  }
  y -= 8

  // Table
  addText('DISPOSAL RECORDS:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 70, margin + 150, margin + 220, margin + 290, margin + 360, margin + 430, margin + 500]
  ;['Datum', 'Tip', 'Batch', 'Metoda', 'Kol.', 'Vendor', 'Manifest', 'Trosak'].forEach((h, i) => addText(h, cols[i], y, { size: 8, font: fontBold }))
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const d of disposals) {
    if (y < 80) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
      ;['Datum', 'Tip', 'Batch', 'Metoda', 'Kol.', 'Vendor', 'Manifest', 'Trosak'].forEach((h, i) => addText(h, cols[i], y, { size: 8, font: fontBold }))
      y -= 14
    }
    const dt = new Date(d.disposalDate).toLocaleDateString('hr-HR')
    addText(dt, cols[0], y, { size: 7 })
    addText((FLUID_LABELS[d.fluidType] || d.fluidType).slice(0, 8), cols[1], y, { size: 7 })
    addText((d.batchNumber || '-').slice(0, 14), cols[2], y, { size: 7 })
    addText((METHOD_LABELS[d.disposalMethod] || d.disposalMethod).slice(0, 14), cols[3], y, { size: 7 })
    addText(`${d.quantityLiters} L`, cols[4], y, { size: 7 })
    addText((d.vendorName || '-').slice(0, 16), cols[5], y, { size: 7 })
    addText((d.manifestNumber || '-').slice(0, 14), cols[6], y, { size: 7 })
    addText(d.disposalCost ? `${d.disposalCost.toFixed(2)}€` : '-', cols[7], y, { size: 7 })
    y -= 11
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="deicing-disposal-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
