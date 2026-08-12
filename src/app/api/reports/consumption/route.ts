import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  let consumption: any[] = []

  if (isDemoMode()) {
    consumption = await db.partConsumption.findMany({ orderBy: { consumedAt: 'desc' } })
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('part_consumption').select('*').order('consumed_at', { ascending: false })
    consumption = data ?? []
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

  addText('GSE CONTROL — UTROSAK REZERVNIH DIJELOVA', margin, y, { size: 16, font: fontBold }); y -= 20
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 12
  addText(`Ukupno zapisa: ${consumption.length}`, margin, y, { size: 10 }); y -= 20

  // Summary
  const totalCost = consumption.reduce((s, c) => s + (c.totalCost || c.total_cost || 0), 0)
  const totalQty = consumption.reduce((s, c) => s + (c.quantity || 0), 0)
  const uniqueParts = new Set(consumption.map(c => c.partNumber || c.part_number)).size
  const uniqueVehicles = new Set(consumption.map(c => c.equipmentCode || c.equipment_code).filter(Boolean)).size

  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Ukupna kolicina: ${totalQty} kom`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Ukupni trosak: ${totalCost.toFixed(2)} EUR`, margin + 10, y, { size: 10, color: rgb(0.86, 0.4, 0.1), font: fontBold }); y -= 12
  addText(`• Razlicitih dijelova: ${uniqueParts}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Razlicitih vozila: ${uniqueVehicles}`, margin + 10, y, { size: 10 }); y -= 20

  // Table
  addText('UTROSAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 110, margin + 250, margin + 330, margin + 400, margin + 470]
  ;['Datum', 'Dio', 'Vozilo', 'Kolicina', 'Trosak', 'Potrosac'].forEach((h, i) => addText(h, cols[i], y, { size: 9, font: fontBold }))
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const c of consumption) {
    if (y < 80) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
      ;['Datum', 'Dio', 'Vozilo', 'Kolicina', 'Trosak', 'Potrosac'].forEach((h, i) => addText(h, cols[i], y, { size: 9, font: fontBold }))
      y -= 14
    }
    const dt = new Date(c.consumedAt || c.consumed_at).toLocaleDateString('hr-HR')
    const partNum = (c.partNumber || c.part_number || '').slice(0, 18)
    const partName = (c.partName || c.part_name || '').slice(0, 18)
    const eqCode = (c.equipmentCode || c.equipment_code || '-').slice(0, 14)
    const cost = (c.totalCost || c.total_cost || 0).toFixed(2)
    const by = (c.consumedBy || c.consumed_by || '-').slice(0, 18)

    addText(dt, cols[0], y, { size: 8 })
    addText(partNum, cols[1], y, { size: 8, font: fontBold })
    addText(partName, cols[1], y - 9, { size: 7, color: rgb(0.4, 0.4, 0.4) })
    addText(eqCode, cols[2], y, { size: 8 })
    addText(`${c.quantity} kom`, cols[3], y, { size: 8 })
    addText(`${cost} EUR`, cols[4], y, { size: 8 })
    addText(by, cols[5], y, { size: 8 })
    y -= 22

    const notes = (c.notes || '').slice(0, 100)
    if (notes) {
      addText(`   ${notes}`, margin, y, { size: 7, color: rgb(0.3, 0.3, 0.3) })
      y -= 10
    }
  }

  // Totals row
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 12
  addText('UKUPNO:', cols[0], y, { size: 9, font: fontBold })
  addText(`${totalQty} kom`, cols[3], y, { size: 9, font: fontBold })
  addText(`${totalCost.toFixed(2)} EUR`, cols[4], y, { size: 9, font: fontBold, color: rgb(0.86, 0.4, 0.1) })

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="consumption-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
