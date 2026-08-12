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
  const startDate = searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const endDate = searchParams.get('to') || new Date().toISOString().slice(0, 10)

  let list: any[] = []
  if (isDemoMode()) {
    list = await db.parkingConfirmation.findMany({ where: { confirmedAt: { gte: new Date(startDate), lte: new Date(endDate + 'T23:59:59') } }, orderBy: { confirmedAt: 'desc' } })
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('parking_confirmations').select('*').gte('confirmed_at', startDate).lte('confirmed_at', endDate + 'T23:59:59').order('confirmed_at', { ascending: false })
    list = (data ?? []).map((p: any) => ({ equipmentCode: p.equipment_code, equipmentName: p.equipment_name, operatorName: p.operator_name, parkedAtDesignatedSpot: p.parked_at_designated_spot, handbrakeEngaged: p.handbrake_engaged, ignitionOff: p.ignition_off, lightsOff: p.lights_off, keyRemoved: p.key_removed, chocksPlaced: p.chocks_placed, parkingLocation: p.parking_location, allConfirmed: p.all_confirmed, issuesReported: p.issues_reported, confirmedAt: new Date(p.confirmed_at) }))
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

  addText('GSE CONTROL — PARKING POTVRDE (AHM 1115)', margin, y, { size: 16, font: fontBold }); y -= 20
  addText(`Period: ${startDate} do ${endDate}`, margin, y, { size: 10 }); y -= 15
  addText(`Generisao: ${user.full_name}`, margin, y, { size: 10 }); y -= 25

  const allOk = list.filter(p => p.allConfirmed).length
  const withIssues = list.filter(p => !p.allConfirmed).length
  addText(`Ukupno potvrda: ${list.length}`, margin, y, { size: 11, font: fontBold }); y -= 14
  addText(`Sve potvrdjeno: ${allOk}`, margin, y, { size: 10 }); y -= 12
  addText(`Sa problemima: ${withIssues}`, margin, y, { size: 10 }); y -= 20

  for (const p of list) {
    if (y < 120) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    addText(`${p.equipmentCode} - ${p.equipmentName}`, margin, y, { size: 10, font: fontBold }); y -= 12
    addText(`Operater: ${p.operatorName} | Lokacija: ${p.parkingLocation || '-'} | ${new Date(p.confirmedAt).toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 8 }); y -= 10
    const items = [
      ['Parkirano na mjestu', p.parkedAtDesignatedSpot], ['Rucna kocnica', p.handbrakeEngaged], ['Kontakt iskljucen', p.ignitionOff],
      ['Svjetla ugasena', p.lightsOff], ['Kljuc izvaden', p.keyRemoved], ['Klinovi', p.chocksPlaced],
    ]
    items.forEach(([label, ok]) => {
      addText(`${ok ? 'DA' : 'NE'} ${label}`, margin + 10, y, { size: 8, color: ok ? rgb(0.05, 0.6, 0.4) : rgb(0.86, 0.15, 0.15) })
      y -= 9
    })
    if (p.issuesReported) { addText(`Problem: ${p.issuesReported}`, margin + 10, y, { size: 8, color: rgb(0.86, 0.15, 0.15) }); y -= 9 }
    y -= 5
  }

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="parking-report-${startDate}-to-${endDate}.pdf"` } })
}
