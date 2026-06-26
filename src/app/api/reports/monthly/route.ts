import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from "@/lib/supabase/server"
import { transliterate } from '@/lib/pdf-utils'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const now = new Date()
  const year = parseInt(searchParams.get('year') ?? now.getFullYear().toString())
  const month = parseInt(searchParams.get('month') ?? (now.getMonth() + 1).toString())

  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59, 999)

  let assignments: any[] = []
  let damages: any[] = []
  let resolvedDamages: any[] = []
  let equipment: any[] = []
  let maintenanceLogs: any[] = []

  if (isDemoMode()) {
    assignments = await db.assignment.findMany({ where: { timestamp: { gte: startDate, lte: endDate } }, orderBy: { timestamp: 'asc' } })
    damages = await db.damageReport.findMany({ where: { createdAt: { gte: startDate, lte: endDate } }, orderBy: { createdAt: 'desc' } })
    resolvedDamages = await db.damageReport.findMany({ where: { resolvedAt: { gte: startDate, lte: endDate } } })
    equipment = await db.equipment.findMany()
    maintenanceLogs = await db.maintenanceLog.findMany({ where: { performedAt: { gte: startDate, lte: endDate } } })
  } else {
    const supabase = await createSupabaseClient()
    const startISO = startDate.toISOString()
    const endISO = endDate.toISOString()
    const [aRes, dRes, rRes, eRes, mRes] = await Promise.all([
      supabase.from('assignments').select('*').gte('timestamp', startISO).lte('timestamp', endISO),
      supabase.from('damage_reports').select('*').gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false }),
      supabase.from('damage_reports').select('*').gte('resolved_at', startISO).lte('resolved_at', endISO),
      supabase.from('equipment').select('*'),
      supabase.from('maintenance_log').select('*').gte('performed_at', startISO).lte('performed_at', endISO),
    ])
    assignments = aRes.data ?? []
    damages = dRes.data ?? []
    resolvedDamages = rRes.data ?? []
    equipment = eRes.data ?? []
    maintenanceLogs = mRes.data ?? []
  }

  const monthNames = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar']
  const monthName = monthNames[month - 1]

  const checkouts = assignments.filter((a) => a.action === 'CHECK_OUT')
  const checkins = assignments.filter((a) => a.action === 'CHECK_IN')
  const successfulCheckouts = checkouts.filter((c) => !c.damageReportId && !c.damage_report_id)
  const blockedCheckouts = checkouts.filter((c) => c.damageReportId || c.damage_report_id)
  const complianceRate = checkouts.length > 0 ? Math.round((successfulCheckouts.length / checkouts.length) * 100) : 100

  // Aktivnost po danu
  const byDay = new Map<string, { checkouts: number; checkins: number; damages: number }>()
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    byDay.set(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`, { checkouts: 0, checkins: 0, damages: 0 })
  }
  assignments.forEach((a) => {
    const dateStr = new Date(a.timestamp || a.created_at).toISOString().slice(0, 10)
    const day = byDay.get(dateStr)
    if (day) {
      if (a.action === 'CHECK_OUT') day.checkouts++
      if (a.action === 'CHECK_IN') day.checkins++
      if (a.damageReportId || a.damage_report_id) day.damages++
    }
  })

  const statusCounts = {
    AVAILABLE: equipment.filter((e) => e.status === 'AVAILABLE').length,
    ASSIGNED: equipment.filter((e) => e.status === 'ASSIGNED').length,
    OUT_OF_SERVICE: equipment.filter((e) => e.status === 'OUT_OF_SERVICE').length,
    MAINTENANCE: equipment.filter((e) => e.status === 'MAINTENANCE').length,
  }

  const severityCounts = {
    CRITICAL: damages.filter((d) => d.severity === 'CRITICAL').length,
    MAJOR: damages.filter((d) => d.severity === 'MAJOR').length,
    MINOR: damages.filter((d) => d.severity === 'MINOR').length,
  }

  const equipmentActivity = new Map<string, number>()
  assignments.forEach((a) => {
    const code = a.equipmentCode || a.equipment_code
    equipmentActivity.set(code, (equipmentActivity.get(code) ?? 0) + 1)
  })
  const topEquipment = Array.from(equipmentActivity.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)

  // Generate PDF
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 50
  const contentWidth = pageWidth - 2 * margin

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const addText = (text: string, x: number, yVal: number, opts: { size?: number; font?: any; color?: ReturnType<typeof rgb>; maxWidth?: number; lineHeight?: number } = {}) => {
    const { size = 10, font: f = font, color = rgb(0, 0, 0), maxWidth, lineHeight } = opts
    const safeText = transliterate(text)
    try {
      page.drawText(safeText, { x, y: yVal, size, font: f, color, maxWidth, lineHeight: lineHeight ?? size * 1.2 })
    } catch (e) {}
  }

  const checkPageBreak = (needed: number) => {
    if (y - needed < margin) {
      addText(`GSE Control · Mjesecni izvjestaj · ${monthName} ${year} · Strana ${pdfDoc.getPageCount()}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
      return true
    }
    return false
  }

  // HEADER
  addText('GSE CONTROL', margin, y, { size: 22, font: fontBold })
  y -= 25
  addText(`MJESCNI IZVJESTAJ — ${monthName.toUpperCase()} ${year}`, margin, y, { size: 16, font: fontBold })
  y -= 18
  addText(`Generisano: ${new Date().toLocaleString('hr-HR')} od ${user.full_name} (${user.role})`, margin, y, { size: 10, color: rgb(0.4, 0.4, 0.4) })
  y -= 20
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
  y -= 25

  // 1. SAZETAK
  addText('1. Sažetak', margin, y, { size: 16, font: fontBold })
  y -= 20

  const summaryRows: Array<[string, string]> = [
    ['Ukupno opreme u sistemu', equipment.length.toString()],
    ['  Dostupno', statusCounts.AVAILABLE.toString()],
    ['  Zaduzeno', statusCounts.ASSIGNED.toString()],
    ['  Neispravno', statusCounts.OUT_OF_SERVICE.toString()],
    ['  Na održavanju', statusCounts.MAINTENANCE.toString()],
    ['', ''],
    ['Ukupno aktivnosti mjeseca', assignments.length.toString()],
    ['  Zaduzivanja', checkouts.length.toString()],
    ['  Uspješna', successfulCheckouts.length.toString()],
    ['  Blokirana', blockedCheckouts.length.toString()],
    ['  Razduživanja', checkins.length.toString()],
    ['', ''],
    ['Nove prijave oštećenja', damages.length.toString()],
    ['  Kriticna', severityCounts.CRITICAL.toString()],
    ['  Veca', severityCounts.MAJOR.toString()],
    ['  Manja', severityCounts.MINOR.toString()],
    ['Riješena oštećenja', resolvedDamages.length.toString()],
    ['', ''],
    ['Aktivnosti održavanja', maintenanceLogs.length.toString()],
    ['', ''],
    ['Compliance rate (IATA AHM 340)', `${complianceRate}%`],
  ]

  for (const [label, value] of summaryRows) {
    if (label === '') { y -= 8; continue }
    checkPageBreak(18)
    addText(label, margin, y, { size: 11, font })
    addText(value, pageWidth - margin - 60, y, { size: 11, font: fontBold })
    y -= 16
  }

  // 2. AKTIVNOST PO DANU
  checkPageBreak(40)
  y -= 10
  addText('2. Aktivnost po danu', margin, y, { size: 16, font: fontBold })
  y -= 22

  // Header tabele
  const col1X = margin, col2X = margin + 150, col3X = margin + 280, col4X = margin + 410
  addText('Dan', col1X, y, { size: 10, font: fontBold })
  addText('Zaduzivanja', col2X, y, { size: 10, font: fontBold })
  addText('Razduzivanja', col3X, y, { size: 10, font: fontBold })
  addText('Oštecenja', col4X, y, { size: 10, font: fontBold })
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 14

  Array.from(byDay.entries()).forEach(([dateStr, data]) => {
    const day = parseInt(dateStr.slice(8, 10))
    checkPageBreak(14)
    addText(`${day}. ${monthName.slice(0, 3)}`, col1X, y, { size: 9 })
    addText(data.checkouts.toString(), col2X, y, { size: 9 })
    addText(data.checkins.toString(), col3X, y, { size: 9 })
    addText(data.damages.toString(), col4X, y, { size: 9 })
    y -= 13
  })

  // 3. TOP OPREMA
  checkPageBreak(40)
  y -= 10
  addText('3. Najkorišćenija oprema', margin, y, { size: 16, font: fontBold })
  y -= 22

  if (topEquipment.length === 0) {
    addText('Nema aktivnosti u ovom mjesecu.', margin, y, { size: 11, color: rgb(0.4, 0.4, 0.4) })
    y -= 16
  } else {
    addText('#', margin, y, { size: 10, font: fontBold })
    addText('Kod opreme', margin + 30, y, { size: 10, font: fontBold })
    addText('Broj aktivnosti', margin + 250, y, { size: 10, font: fontBold })
    y -= 5
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
    y -= 14
    topEquipment.forEach(([code, count], idx) => {
      checkPageBreak(14)
      addText(`${idx + 1}.`, margin, y, { size: 10 })
      addText(code, margin + 30, y, { size: 10 })
      addText(count.toString(), margin + 250, y, { size: 10 })
      y -= 14
    })
  }

  // 4. PRIJAVE OŠTEĆENJA
  if (damages.length > 0) {
    checkPageBreak(40)
    y -= 10
    addText('4. Prijave oštećenja', margin, y, { size: 16, font: fontBold, color: rgb(0.86, 0.15, 0.15) })
    y -= 22

    damages.forEach((d, idx) => {
      checkPageBreak(50)
      const time = new Date(d.createdAt || d.created_at).toLocaleString('hr-HR').slice(0, 16)
      const sevColor = d.severity === 'CRITICAL' ? rgb(0.86, 0.15, 0.15) : d.severity === 'MAJOR' ? rgb(0.92, 0.35, 0.05) : rgb(0.79, 0.54, 0.04)

      addText(`${idx + 1}. [${d.severity}] ${d.equipmentCode || d.equipment_code} - ${(d.equipmentName || d.equipment_name).slice(0, 40)}`, margin, y, { size: 10, font: fontBold, color: sevColor })
      y -= 13
      addText(`   Prijavio: ${d.reportedByName || d.reported_by_name} u ${time}`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) })
      y -= 12
      addText(`   Opis: ${(d.description || '').slice(0, 100)}`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4), maxWidth: contentWidth })
      y -= 16
      if (d.resolution) {
        addText(`   Rješenje: ${d.resolution.slice(0, 100)}`, margin, y, { size: 9, color: rgb(0.05, 0.6, 0.4) })
        y -= 12
      }
      y -= 4
    })
  }

  // 5. ODRŽAVANJE
  if (maintenanceLogs.length > 0) {
    checkPageBreak(40)
    y -= 10
    addText('5. Aktivnosti održavanja (EASA Part-145)', margin, y, { size: 16, font: fontBold, color: rgb(0.49, 0.23, 0.93) })
    y -= 22

    maintenanceLogs.forEach((m, idx) => {
      checkPageBreak(40)
      const mdate = new Date(m.performedAt || m.performed_at).toLocaleDateString('hr-HR')
      addText(`${idx + 1}. [${m.maintenanceType || m.maintenance_type}] ${m.equipmentCode || m.equipment_code} - ${mdate}`, margin, y, { size: 10, font: fontBold })
      y -= 13
      addText(`   Opis: ${m.description}`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4), maxWidth: contentWidth })
      y -= 16
      if (m.performedBy || m.performed_by) {
        addText(`   Izveo: ${m.performedBy || m.performed_by}`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) })
        y -= 12
      }
      y -= 4
    })
  }

  addText(`GSE Control · Mjesecni izvjestaj · ${monthName} ${year} · Strana ${pdfDoc.getPageCount()} · IATA AHM 340 + EASA Part-145 compliant`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="mjesecni-izvjestaj-${year}-${String(month).padStart(2, '0')}.pdf"`,
    },
  })
}
