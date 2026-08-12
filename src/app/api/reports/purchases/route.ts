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

  let purchases: any[] = []

  if (isDemoMode()) {
    purchases = await db.partPurchase.findMany({ orderBy: { createdAt: 'desc' } })
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('part_purchases').select('*').order('created_at', { ascending: false })
    purchases = data ?? []
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

  addText('GSE CONTROL — NABAVKE REZERVNIH DIJELOVA', margin, y, { size: 16, font: fontBold }); y -= 20
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 12
  addText(`Ukupno nabavki: ${purchases.length}`, margin, y, { size: 10 }); y -= 20

  // Summary
  const totalNet = purchases.reduce((s, p) => s + (p.totalNet || p.total_net || 0), 0)
  const totalGross = purchases.reduce((s, p) => s + (p.totalGross || p.total_gross || 0), 0)
  const totalVat = totalGross - totalNet
  const paid = purchases.filter(p => p.paid).length
  const unpaid = purchases.length - paid

  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Ukupno bez PDV: ${totalNet.toFixed(2)} EUR`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• PDV: ${totalVat.toFixed(2)} EUR`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Ukupno sa PDV: ${totalGross.toFixed(2)} EUR`, margin + 10, y, { size: 10, color: rgb(0.1, 0.5, 0.1), font: fontBold }); y -= 12
  addText(`• Placeno: ${paid}  ·  Nije placeno: ${unpaid}`, margin + 10, y, { size: 10, color: unpaid > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 20

  // Table
  addText('NABAVKE:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 110, margin + 220, margin + 290, margin + 360, margin + 430, margin + 500]
  ;['Datum', 'Dio', 'Dobavljac', 'Kolicina', 'Bez PDV', 'PDV', 'Sa PDV'].forEach((h, i) => addText(h, cols[i], y, { size: 9, font: fontBold }))
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const p of purchases) {
    if (y < 80) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
      ;['Datum', 'Dio', 'Dobavljac', 'Kolicina', 'Bez PDV', 'PDV', 'Sa PDV'].forEach((h, i) => addText(h, cols[i], y, { size: 9, font: fontBold }))
      y -= 14
    }
    const dt = p.invoiceDate || p.invoice_date
      ? new Date(p.invoiceDate || p.invoice_date).toLocaleDateString('hr-HR')
      : new Date(p.createdAt || p.created_at).toLocaleDateString('hr-HR')
    const partNum = (p.partNumber || p.part_number || '').slice(0, 18)
    const partName = (p.partName || p.part_name || '').slice(0, 18)
    const supplier = (p.supplier || '').slice(0, 18)
    const net = (p.totalNet || p.total_net || 0).toFixed(2)
    const vat = ((p.totalGross || p.total_gross || 0) - (p.totalNet || p.total_net || 0)).toFixed(2)
    const gross = (p.totalGross || p.total_gross || 0).toFixed(2)

    addText(dt, cols[0], y, { size: 8 })
    addText(partNum, cols[1], y, { size: 8, font: fontBold })
    addText(partName, cols[1], y - 9, { size: 7, color: rgb(0.4, 0.4, 0.4) })
    addText(supplier, cols[2], y, { size: 8 })
    addText(`${p.quantity} kom`, cols[3], y, { size: 8 })
    addText(`${net}`, cols[4], y, { size: 8 })
    addText(`${vat}`, cols[5], y, { size: 8 })
    addText(`${gross}`, cols[6], y, { size: 8, font: fontBold })

    if (!p.paid) {
      addText('NEPLACENO', cols[6], y - 9, { size: 7, color: rgb(0.86, 0.15, 0.15), font: fontBold })
    }

    y -= 22
  }

  // Totals row
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 12
  addText('UKUPNO:', cols[0], y, { size: 9, font: fontBold })
  addText(`${totalNet.toFixed(2)}`, cols[4], y, { size: 9, font: fontBold })
  addText(`${totalVat.toFixed(2)}`, cols[5], y, { size: 9, font: fontBold })
  addText(`${totalGross.toFixed(2)}`, cols[6], y, { size: 9, font: fontBold, color: rgb(0.1, 0.5, 0.1) })

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="purchases-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
