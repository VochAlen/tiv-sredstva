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

  const { searchParams } = new URL(request.url)
  const authId = searchParams.get('id')
  const days = parseInt(searchParams.get('days') || '0') // 0 = all, 30/60 = expiring within X days

  let list: any[] = []
  if (isDemoMode()) {
    if (authId) {
      const a = await db.driverAuthorization.findUnique({ where: { id: authId } })
      if (a) list = [a]
    } else if (days > 0) {
      const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      list = await db.driverAuthorization.findMany({ where: { active: true, validUntil: { lte: futureDate } }, orderBy: { validUntil: 'asc' } })
    } else {
      list = await db.driverAuthorization.findMany({ orderBy: { employeeName: 'asc' } })
    }
  } else {
    const supabase = await createSupabaseClient()
    if (authId) {
      const { data } = await supabase.from('driver_authorizations').select('*').eq('id', authId).single()
      if (data) list = [data]
    } else if (days > 0) {
      const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase.from('driver_authorizations').select('*').eq('active', true).lte('valid_until', futureDate).order('valid_until', { ascending: true })
      list = data ?? []
    } else {
      const { data } = await supabase.from('driver_authorizations').select('*').order('employee_name', { ascending: true })
      list = data ?? []
    }
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

  const title = days > 0 ? `DOZVOLE KOJE ISTICU U ROKU ${days} DANA` : authId ? 'POJEDINACNA DOZVOLA' : 'SVE DOZVOLE'
  addText(`GSE CONTROL — ${title}`, margin, y, { size: 16, font: fontBold }); y -= 20
  addText('ADR.OPS.C.005 — Driver Authorization za Movement Area', margin, y, { size: 10 }); y -= 15
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 25

  if (days > 0) {
    const expired = list.filter(a => new Date(a.validUntil || a.valid_until) < new Date()).length
    const expiring = list.length - expired
    addText(`Ukupno: ${list.length} (Istekle: ${expired}, Uskoro isticu: ${expiring})`, margin, y, { size: 11, font: fontBold }); y -= 20
  }

  for (const auth of list) {
    if (y < 100) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    const vu = auth.validUntil || auth.valid_until
    const te = auth.trainingExpiry || auth.training_expiry
    const cat1 = auth.category1 ?? auth.category1
    const cat2 = auth.category2 ?? auth.category2
    const cat3 = auth.category3 ?? auth.category3

    addText(`${auth.employeeCardId || auth.employee_card_id} — ${auth.employeeName || auth.employee_name}`, margin, y, { size: 11, font: fontBold }); y -= 13
    addText(`Licenca: ${auth.licenseNumber || auth.license_number || '-'} | Vazi do: ${vu ? new Date(vu).toLocaleDateString('hr-HR') : '-'}`, margin, y, { size: 9 }); y -= 11
    addText(`Kategorije: Cat.1=${cat1 ? 'DA' : 'NE'} Cat.2=${cat2 ? 'DA' : 'NE'} Cat.3=${cat3 ? 'DA' : 'NE'}`, margin, y, { size: 9 }); y -= 11
    addText(`Obuka istice: ${te ? new Date(te).toLocaleDateString('hr-HR') : '-'} | Status: ${auth.active ? 'AKTIVAN' : 'SUSPENDOVAN'}`, margin, y, { size: 9 }); y -= 15
  }

  addText(`GSE Control · ADR.OPS.C.005 · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="driver-auth-${days > 0 ? days + 'd-' : ''}${Date.now()}.pdf"` } })
}
