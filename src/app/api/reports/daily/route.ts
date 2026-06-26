import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from "@/lib/supabase/server"
import { transliterate } from '@/lib/pdf-utils'

// GET /api/reports/daily?date=2026-06-19
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const dateStr = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const date = new Date(dateStr)
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  let checkouts: any[] = []
  let checkins: any[] = []
  let damages: any[] = []
  let equipment: any[] = []

  if (isDemoMode()) {
    checkouts = await db.assignment.findMany({
      where: { action: 'CHECK_OUT', timestamp: { gte: startOfDay, lte: endOfDay } },
      orderBy: { timestamp: 'asc' },
    })
    checkins = await db.assignment.findMany({
      where: { action: 'CHECK_IN', timestamp: { gte: startOfDay, lte: endOfDay } },
      orderBy: { timestamp: 'asc' },
    })
    damages = await db.damageReport.findMany({
      where: { createdAt: { gte: startOfDay, lte: endOfDay } },
      orderBy: { createdAt: 'desc' },
    })
    equipment = await db.equipment.findMany({ orderBy: { code: 'asc' } })
  } else {
    const supabase = await createSupabaseClient()
    const startISO = startOfDay.toISOString()
    const endISO = endOfDay.toISOString()
    const [coRes, ciRes, dRes, eqRes] = await Promise.all([
      supabase.from('assignments').select('*').eq('action', 'CHECK_OUT').gte('timestamp', startISO).lte('timestamp', endISO).order('timestamp', { ascending: true }),
      supabase.from('assignments').select('*').eq('action', 'CHECK_IN').gte('timestamp', startISO).lte('timestamp', endISO).order('timestamp', { ascending: true }),
      supabase.from('damage_reports').select('*').gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false }),
      supabase.from('equipment').select('*').order('code', { ascending: true }),
    ])
    checkouts = coRes.data ?? []
    checkins = ciRes.data ?? []
    damages = dRes.data ?? []
    equipment = eqRes.data ?? []
  }

  // Generate PDF
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const pageWidth = 595.28  // A4
  const pageHeight = 841.89
  const margin = 50
  const contentWidth = pageWidth - 2 * margin

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const drawLine = (x1: number, y1: number, x2: number, y2: number, color: ReturnType<typeof rgb> = rgb(0.8, 0.8, 0.8)) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color })
  }

  const addText = (text: string, x: number, yVal: number, opts: { size?: number; font?: any; color?: ReturnType<typeof rgb>; maxWidth?: number; lineHeight?: number } = {}) => {
    const { size = 10, font: f = font, color = rgb(0, 0, 0), maxWidth, lineHeight } = opts
    const safeText = transliterate(text)
    try {
      if (maxWidth) {
        page.drawText(safeText, { x, y: yVal, size, font: f, color, maxWidth, lineHeight: lineHeight ?? size * 1.2 })
      } else {
        page.drawText(safeText, { x, y: yVal, size, font: f, color })
      }
    } catch (e) {
      // Final fallback - ukloni sve ne-ASCII
      const fallback = text.replace(/[^\x00-\x7F]/g, '?')
      page.drawText(fallback, { x, y: yVal, size, font: f, color, maxWidth, lineHeight: lineHeight ?? size * 1.2 })
    }
  }

  const checkPageBreak = (needed: number) => {
    if (y - needed < margin) {
      // Add footer
      addText(`GSE Control · Dnevni izvještaj · ${dateStr} · Strana ${pdfDoc.getPageCount()}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
      return true
    }
    return false
  }

  // ============== HEADER ==============
  addText('GSE CONTROL — DNEVNI IZVJEŠTAJ', margin, y, { size: 20, font: fontBold })
  y -= 25
  addText(`Datum: ${date.toLocaleDateString('hr-HR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y, { size: 11, color: rgb(0.4, 0.4, 0.4) })
  y -= 14
  addText(`Generisano: ${new Date().toLocaleString('hr-HR')} od ${user.full_name} (${user.role})`, margin, y, { size: 10, color: rgb(0.4, 0.4, 0.4) })
  y -= 20

  drawLine(margin, y, pageWidth - margin, y)
  y -= 25

  // ============== SAŽETAK ==============
  addText('Sažetak', margin, y, { size: 16, font: fontBold })
  y -= 20

  const totalActions = checkouts.length + checkins.length
  const successfulCheckouts = checkouts.filter((c) => !c.damageReportId && !c.damage_report_id).length
  const blockedCheckouts = checkouts.filter((c) => c.damageReportId || c.damage_report_id).length
  const complianceRate = checkouts.length > 0 ? Math.round((successfulCheckouts / checkouts.length) * 100) : 100

  const summaryRows: Array<[string, string]> = [
    ['Ukupno opreme u sistemu', equipment.length.toString()],
    ['Dostupno', equipment.filter((e) => e.status === 'AVAILABLE').length.toString()],
    ['Zaduženo', equipment.filter((e) => e.status === 'ASSIGNED').length.toString()],
    ['Neispravno', equipment.filter((e) => e.status === 'OUT_OF_SERVICE').length.toString()],
    ['Na održavanju', equipment.filter((e) => e.status === 'MAINTENANCE').length.toString()],
    ['', ''],
    ['Zaduživanja danas', checkouts.length.toString()],
    ['  Uspješna', successfulCheckouts.toString()],
    ['  Blokirana (oštećenje)', blockedCheckouts.toString()],
    ['Razduživanja danas', checkins.length.toString()],
    ['Nove prijave oštećenja', damages.length.toString()],
    ['', ''],
    ['Compliance rate (IATA AHM 340)', `${complianceRate}%`],
  ]

  for (const [label, value] of summaryRows) {
    if (label === '') { y -= 8; continue }
    checkPageBreak(20)
    addText(label, margin, y, { size: 11, font: font })
    addText(value, pageWidth - margin - 50, y, { size: 11, font: fontBold })
    y -= 16
  }

  y -= 15

  // ============== ZADUŽIVANJA ==============
  if (checkouts.length > 0) {
    checkPageBreak(60)
    addText('Zaduživanja', margin, y, { size: 16, font: fontBold })
    y -= 20

    checkouts.forEach((a, idx) => {
      checkPageBreak(50)
      const isBlocked = !!(a.damageReportId || a.damage_report_id)
      const time = new Date(a.timestamp || a.created_at).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })
      const color = isBlocked ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0)

      addText(`${idx + 1}. [${time}] ${a.equipmentCode || a.equipment_code} - ${(a.equipmentName || a.equipment_name).slice(0, 50)}`, margin, y, { size: 10, font: fontBold, color })
      y -= 13
      addText(`   Radnik: ${a.employeeName || a.employee_name} (${a.employeeCardId || a.employee_card_id})`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) })
      y -= 12
      addText(`   Rezultat: ${a.inspectionResult || a.inspection_result}${isBlocked ? ' - BLOKIRANO' : ''}`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) })
      y -= 18
    })
  }

  // ============== RAZDUŽIVANJA ==============
  if (checkins.length > 0) {
    checkPageBreak(60)
    addText('Razduživanja', margin, y, { size: 16, font: fontBold })
    y -= 20

    checkins.forEach((a, idx) => {
      checkPageBreak(40)
      const time = new Date(a.timestamp || a.created_at).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })

      addText(`${idx + 1}. [${time}] ${a.equipmentCode || a.equipment_code} - ${(a.equipmentName || a.equipment_name).slice(0, 50)}`, margin, y, { size: 10, font: fontBold })
      y -= 13
      addText(`   Radnik: ${a.employeeName || a.employee_name} (${a.employeeCardId || a.employee_card_id})`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) })
      y -= 13
      addText(`   Rezultat: ${a.inspectionResult || a.inspection_result}`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) })
      y -= 18
    })
  }

  // ============== OŠTEĆENJA ==============
  if (damages.length > 0) {
    checkPageBreak(60)
    addText('Nove prijave oštećenja', margin, y, { size: 16, font: fontBold, color: rgb(0.86, 0.15, 0.15) })
    y -= 20

    damages.forEach((d, idx) => {
      checkPageBreak(50)
      const time = new Date(d.createdAt || d.created_at).toLocaleString('hr-HR')
      const severity = d.severity
      const sevColor = severity === 'CRITICAL' ? rgb(0.86, 0.15, 0.15) : severity === 'MAJOR' ? rgb(0.92, 0.35, 0.05) : rgb(0.79, 0.54, 0.04)

      addText(`${idx + 1}. [${severity}] ${d.equipmentCode || d.equipment_code} - ${(d.equipmentName || d.equipment_name).slice(0, 50)}`, margin, y, { size: 10, font: fontBold, color: sevColor })
      y -= 13
      addText(`   Prijavio: ${d.reportedByName || d.reported_by_name} u ${time.slice(0, 16)}`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) })
      y -= 12
      const desc = (d.description || '').slice(0, 100)
      addText(`   Opis: ${desc}`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4), maxWidth: contentWidth })
      y -= 18
    })
  }

  // Footer na zadnjoj stranici
  addText(`GSE Control · Dnevni izvještaj · ${dateStr} · Strana ${pdfDoc.getPageCount()} · IATA AHM 340 compliant`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="dnevni-izvjestaj-${dateStr}.pdf"`,
    },
  })
}
