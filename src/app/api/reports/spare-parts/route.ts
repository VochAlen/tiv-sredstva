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

  let parts: any[] = []
  let purchases: any[] = []
  let consumption: any[] = []

  if (isDemoMode()) {
    ;[parts, purchases, consumption] = await Promise.all([
      db.sparePart.findMany({ orderBy: { name: 'asc' } }),
      db.partPurchase.findMany({ orderBy: { createdAt: 'desc' } }),
      db.partConsumption.findMany({ orderBy: { consumedAt: 'desc' } }),
    ])
  } else {
    const supabase = await createSupabaseClient()
    const [p, pu, c] = await Promise.all([
      supabase.from('spare_parts').select('*').order('name', { ascending: true }),
      supabase.from('part_purchases').select('*').order('created_at', { ascending: false }),
      supabase.from('part_consumption').select('*').order('consumed_at', { ascending: false }),
    ])
    parts = p.data ?? []; purchases = pu.data ?? []; consumption = c.data ?? []
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

  addText('GSE CONTROL — REZERVNI DIJELOVI I TROSKOVNIK', margin, y, { size: 16, font: fontBold }); y -= 20
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 25

  // Summary
  const totalPurchases = purchases.reduce((s, p) => s + (p.totalGross || p.total_gross || 0), 0)
  const totalConsumption = consumption.reduce((s, c) => s + (c.totalCost || c.total_cost || 0), 0)
  const lowStock = parts.filter(p => (p.quantity ?? 0) <= (p.minQuantity ?? p.min_quantity ?? 1)).length

  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`Rezervni dijelovi u magacinu: ${parts.length}`, margin, y, { size: 10 }); y -= 12
  addText(`Niska zaliha: ${lowStock}`, margin, y, { size: 10, color: lowStock > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 12
  addText(`Nabavke: ${purchases.length} (${totalPurchases.toFixed(2)} EUR)`, margin, y, { size: 10 }); y -= 12
  addText(`Utrosak: ${consumption.length} (${totalConsumption.toFixed(2)} EUR)`, margin, y, { size: 10 }); y -= 20

  // Parts inventory
  addText('STANJE U MAGACINU:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 100, margin + 250, margin + 330, margin + 410]
  ;['Broj', 'Naziv', 'Kolicina', 'Cijena', 'Lokacija'].forEach((h, i) => addText(h, cols[i], y, { size: 9, font: fontBold }))
  y -= 5; page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) }); y -= 11

  for (const p of parts) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    const qty = p.quantity ?? p.quantity
    const minQty = p.minQuantity ?? p.min_quantity
    const price = p.unitPrice ?? p.unit_price
    addText((p.partNumber || p.part_number || ''), cols[0], y, { size: 8 })
    addText((p.name || '').slice(0, 30), cols[1], y, { size: 8, color: qty <= minQty ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) })
    addText(`${qty} ${p.unit || ''}`, cols[2], y, { size: 8 })
    addText(price ? `${price.toFixed(2)} EUR` : '-', cols[3], y, { size: 8 })
    addText(p.location || '-', cols[4], y, { size: 8 })
    y -= 10
  }

  y -= 10
  if (y < 100) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }

  // Purchases
  addText('NABAVKE:', margin, y, { size: 12, font: fontBold }); y -= 14
  ;['Dio', 'Dobavljac', 'Kolicina', 'Bez PDV', 'Sa PDV'].forEach((h, i) => addText(h, [margin, margin + 150, margin + 280, margin + 350, margin + 430][i], y, { size: 9, font: fontBold }))
  y -= 5; page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) }); y -= 11

  for (const pu of purchases) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText((pu.partName || pu.part_name || '').slice(0, 25), margin, y, { size: 8 })
    addText((pu.supplier || '').slice(0, 20), margin + 150, y, { size: 8 })
    addText(`${pu.quantity} kom`, margin + 280, y, { size: 8 })
    addText(`${(pu.totalNet || pu.total_net || 0).toFixed(2)}`, margin + 350, y, { size: 8 })
    addText(`${(pu.totalGross || pu.total_gross || 0).toFixed(2)}`, margin + 430, y, { size: 8 })
    y -= 10
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="spare-parts-report-${new Date().toISOString().slice(0, 10)}.pdf"` } })
}
