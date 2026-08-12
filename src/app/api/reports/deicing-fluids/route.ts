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

  if (isDemoMode()) {
    fluids = await db.deicingFluid.findMany({ orderBy: { receivedAt: 'desc' } })
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('deicing_fluids').select('*').order('received_at', { ascending: false })
    fluids = (data ?? []).map((f: any) => ({
      id: f.id, fluidType: f.fluid_type, brandName: f.brand_name, manufacturer: f.manufacturer,
      batchNumber: f.batch_number, quantityLiters: f.quantity_liters, unitPrice: f.unit_price,
      concentration: f.concentration, expiryDate: f.expiry_date, storageLocation: f.storage_location,
      notes: f.notes,
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

  addText('GSE CONTROL — INVENTAR TEČNOSTI ZA ZALEĐIVANJE', margin, y, { size: 16, font: fontBold }); y -= 20
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 12
  addText(`Ukupno stavki: ${fluids.length}`, margin, y, { size: 10 }); y -= 20

  // Summary
  const totalLiters = fluids.reduce((s, f) => s + f.quantityLiters, 0)
  const totalValue = fluids.reduce((s, f) => s + (f.quantityLiters * (f.unitPrice || 0)), 0)
  const expired = fluids.filter((f) => f.expiryDate && new Date(f.expiryDate) < today).length
  const expiringSoon = fluids.filter((f) => {
    if (!f.expiryDate) return false
    const d = new Date(f.expiryDate)
    if (d < today) return false
    return Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) <= 30
  }).length

  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Ukupna kolicina: ${totalLiters.toFixed(1)} L`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Vrijednost: ${totalValue.toFixed(2)} EUR`, margin + 10, y, { size: 10, color: rgb(0.1, 0.5, 0.1) }); y -= 12
  addText(`• Isteklo: ${expired}`, margin + 10, y, { size: 10, color: expired > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 12
  addText(`• Istice uskoro (30 dana): ${expiringSoon}`, margin + 10, y, { size: 10, color: expiringSoon > 0 ? rgb(0.85, 0.55, 0.1) : rgb(0, 0, 0) }); y -= 20

  // Table
  addText('INVENTAR:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 75, margin + 200, margin + 270, margin + 320, margin + 380, margin + 440, margin + 500]
  ;['Batch', 'Naziv', 'Tip', 'Konc.', 'Kol.', 'Cijena', 'Rok', 'Status'].forEach((h, i) => addText(h, cols[i], y, { size: 8, font: fontBold }))
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const f of fluids) {
    if (y < 80) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
      ;['Batch', 'Naziv', 'Tip', 'Konc.', 'Kol.', 'Cijena', 'Rok', 'Status'].forEach((h, i) => addText(h, cols[i], y, { size: 8, font: fontBold }))
      y -= 14
    }
    const isExpired = f.expiryDate && new Date(f.expiryDate) < today
    const isExpiringSoon = !isExpired && f.expiryDate && Math.floor((new Date(f.expiryDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) <= 30

    addText((f.batchNumber || '').slice(0, 14), cols[0], y, { size: 7, font: fontBold })
    addText((f.brandName || '').slice(0, 24), cols[1], y, { size: 7 })
    addText((FLUID_LABELS[f.fluidType] || f.fluidType).slice(0, 10), cols[2], y, { size: 7 })
    addText((f.concentration || '-').slice(0, 8), cols[3], y, { size: 7 })
    addText(`${f.quantityLiters} L`, cols[4], y, { size: 7 })
    addText(f.unitPrice ? `${f.unitPrice.toFixed(2)}€` : '-', cols[5], y, { size: 7 })
    addText(f.expiryDate ? new Date(f.expiryDate).toLocaleDateString('hr-HR') : '-', cols[6], y, { size: 7 })
    const status = isExpired ? 'ISTEKLO' : isExpiringSoon ? 'USKORO' : 'OK'
    addText(status, cols[7], y, {
      size: 7,
      font: fontBold,
      color: isExpired ? rgb(0.86, 0.15, 0.15) : isExpiringSoon ? rgb(0.85, 0.55, 0.1) : rgb(0.1, 0.55, 0.15),
    })
    y -= 11
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="deicing-fluids-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
