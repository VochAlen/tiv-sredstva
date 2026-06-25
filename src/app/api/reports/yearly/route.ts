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

  const startDate = new Date(year, 0, 1)
  const endDate = new Date(year, 11, 31, 23, 59, 59, 999)

  let assignments: any[] = []
  let damages: any[] = []
  let resolvedDamages: any[] = []
  let equipment: any[] = []
  let maintenanceLogs: any[] = []

  if (isDemoMode()) {
    assignments = await db.assignment.findMany({ where: { timestamp: { gte: startDate, lte: endDate } } })
    damages = await db.damageReport.findMany({ where: { createdAt: { gte: startDate, lte: endDate } } })
    resolvedDamages = await db.damageReport.findMany({ where: { resolvedAt: { gte: startDate, lte: endDate } } })
    equipment = await db.equipment.findMany()
    maintenanceLogs = await db.maintenanceLog.findMany({ where: { performedAt: { gte: startDate, lte: endDate } } })
  } else {
    const supabase = await createSupabaseClient()
    const startISO = startDate.toISOString()
    const endISO = endDate.toISOString()
    const [aRes, dRes, rRes, eRes, mRes] = await Promise.all([
      supabase.from('assignments').select('*').gte('timestamp', startISO).lte('timestamp', endISO),
      supabase.from('damage_reports').select('*').gte('created_at', startISO).lte('created_at', endISO),
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

  const checkouts = assignments.filter((a) => a.action === 'CHECK_OUT')
  const checkins = assignments.filter((a) => a.action === 'CHECK_IN')
  const successfulCheckouts = checkouts.filter((c) => !c.damageReportId && !c.damage_report_id)
  const blockedCheckouts = checkouts.filter((c) => c.damageReportId || c.damage_report_id)
  const complianceRate = checkouts.length > 0 ? Math.round((successfulCheckouts.length / checkouts.length) * 100) : 100

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec']
  const byMonth = monthNames.map((name) => ({ name, checkouts: 0, checkins: 0, damages: 0 }))
  assignments.forEach((a) => {
    const month = new Date(a.timestamp || a.created_at).getMonth()
    if (a.action === 'CHECK_OUT') byMonth[month].checkouts++
    if (a.action === 'CHECK_IN') byMonth[month].checkins++
    if (a.damageReportId || a.damage_report_id) byMonth[month].damages++
  })

  const severityCounts = {
    CRITICAL: damages.filter((d) => d.severity === 'CRITICAL').length,
    MAJOR: damages.filter((d) => d.severity === 'MAJOR').length,
    MINOR: damages.filter((d) => d.severity === 'MINOR').length,
  }

  const equipmentDamages = new Map<string, number>()
  damages.forEach((d) => {
    const code = d.equipmentCode || d.equipment_code
    equipmentDamages.set(code, (equipmentDamages.get(code) ?? 0) + 1)
  })
  const topProblematic = Array.from(equipmentDamages.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)

  const totalHours = equipment.reduce((sum, e) => sum + (e.totalOperatingHours ?? e.total_operating_hours ?? 0), 0)
  const mtbf = damages.length > 0 ? Math.round(totalHours / damages.length) : 0
  const resolvedWithDates = resolvedDamages.filter((d) => d.resolvedAt || d.resolved_at)
  const mttr = resolvedWithDates.length > 0
    ? Math.round(resolvedWithDates.reduce((sum, d) => {
        const created = new Date(d.createdAt || d.created_at).getTime()
        const resolved = new Date(d.resolvedAt || d.resolved_at).getTime()
        return sum + (resolved - created) / (1000 * 60 * 60)
      }, 0) / resolvedWithDates.length)
    : 0

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
      addText(`GSE Control · Godišnji izvještaj · ${year} · Strana ${pdfDoc.getPageCount()}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
      return true
    }
    return false
  }

  // COVER
  addText('GSE CONTROL', margin, y, { size: 32, font: fontBold })
  y -= 35
  addText(`GODIŠNJI IZVJEŠTAJ ${year}`, margin, y, { size: 22, color: rgb(0.4, 0.4, 0.4) })
  y -= 35
  addText('IATA AHM 340 + EASA Part-145 Compliance Report', margin, y, { size: 11, color: rgb(0.5, 0.5, 0.5) })
  y -= 80
  addText(`Generisano: ${new Date().toLocaleString('hr-HR')}`, margin, y, { size: 10, color: rgb(0.4, 0.4, 0.4) })
  y -= 14
  addText(`Od strane: ${user.full_name} (${user.role})`, margin, y, { size: 10, color: rgb(0.4, 0.4, 0.4) })

  // PAGE 2
  page = pdfDoc.addPage([pageWidth, pageHeight])
  y = pageHeight - margin

  // 1. EXECUTIVE SUMMARY
  addText('1. Executive Summary', margin, y, { size: 18, font: fontBold })
  y -= 25

  const summaryRows: Array<[string, string]> = [
    ['Period izvještaja', year.toString()],
    ['Ukupno opreme u sistemu', equipment.length.toString()],
    ['', ''],
    ['Ukupno aktivnosti', assignments.length.toString()],
    ['  Zaduzivanja', checkouts.length.toString()],
    ['  Uspješna', successfulCheckouts.length.toString()],
    ['  Blokirana (oštećenja)', blockedCheckouts.length.toString()],
    ['  Razduživanja', checkins.length.toString()],
    ['', ''],
    ['Prijave oštećenja', damages.length.toString()],
    ['  Kriticna', severityCounts.CRITICAL.toString()],
    ['  Veca', severityCounts.MAJOR.toString()],
    ['  Manja', severityCounts.MINOR.toString()],
    ['Riješena oštećenja', resolvedDamages.length.toString()],
    ['', ''],
    ['Aktivnosti održavanja', maintenanceLogs.length.toString()],
    ['', ''],
    ['Compliance rate (IATA AHM 340)', `${complianceRate}%`],
    ['MTBF (Mean Time Between Failures)', `${mtbf} sati`],
    ['MTTR (Mean Time To Repair)', `${mttr} sati`],
  ]

  for (const [label, value] of summaryRows) {
    if (label === '') { y -= 8; continue }
    checkPageBreak(18)
    addText(label, margin, y, { size: 11, font })
    addText(value, pageWidth - margin - 80, y, { size: 11, font: fontBold })
    y -= 16
  }

  // 2. AKTIVNOST PO MJESECIMA
  checkPageBreak(40)
  y -= 15
  addText('2. Aktivnost po mjesecima', margin, y, { size: 18, font: fontBold })
  y -= 25

  const col1X = margin, col2X = margin + 150, col3X = margin + 280, col4X = margin + 410
  addText('Mjesec', col1X, y, { size: 10, font: fontBold })
  addText('Zaduzivanja', col2X, y, { size: 10, font: fontBold })
  addText('Razduzivanja', col3X, y, { size: 10, font: fontBold })
  addText('Oštecenja', col4X, y, { size: 10, font: fontBold })
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 16

  byMonth.forEach((m) => {
    checkPageBreak(16)
    addText(m.name, col1X, y, { size: 10 })
    addText(m.checkouts.toString(), col2X, y, { size: 10 })
    addText(m.checkins.toString(), col3X, y, { size: 10 })
    addText(m.damages.toString(), col4X, y, { size: 10 })
    y -= 16
  })

  // Total
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 14
  addText('UKUPNO', col1X, y, { size: 10, font: fontBold })
  addText(byMonth.reduce((s, m) => s + m.checkouts, 0).toString(), col2X, y, { size: 10, font: fontBold })
  addText(byMonth.reduce((s, m) => s + m.checkins, 0).toString(), col3X, y, { size: 10, font: fontBold })
  addText(byMonth.reduce((s, m) => s + m.damages, 0).toString(), col4X, y, { size: 10, font: fontBold })

  // 3. NAJPROBLEMATIČNIJA OPREMA
  checkPageBreak(40)
  y -= 25
  addText('3. Najproblematičnija oprema', margin, y, { size: 18, font: fontBold, color: rgb(0.86, 0.15, 0.15) })
  y -= 25

  if (topProblematic.length === 0) {
    addText('Nema prijavljenih oštećenja u ovoj godini.', margin, y, { size: 11, color: rgb(0.4, 0.4, 0.4) })
    y -= 16
  } else {
    addText('#', margin, y, { size: 10, font: fontBold })
    addText('Kod opreme', margin + 30, y, { size: 10, font: fontBold })
    addText('Broj oštećenja', margin + 250, y, { size: 10, font: fontBold })
    y -= 5
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
    y -= 16
    topProblematic.forEach(([code, count], idx) => {
      checkPageBreak(16)
      addText(`${idx + 1}.`, margin, y, { size: 10 })
      addText(code, margin + 30, y, { size: 10 })
      addText(count.toString(), margin + 250, y, { size: 10 })
      y -= 16
    })
  }

  // 4. STATUS OPREME
  checkPageBreak(40)
  y -= 20
  addText('4. Status opreme (kraj godine)', margin, y, { size: 18, font: fontBold })
  y -= 25

  const statusRows: Array<[string, string]> = [
    ['Dostupno', equipment.filter((e) => e.status === 'AVAILABLE').length.toString()],
    ['Zaduženo', equipment.filter((e) => e.status === 'ASSIGNED').length.toString()],
    ['Neispravno', equipment.filter((e) => e.status === 'OUT_OF_SERVICE').length.toString()],
    ['Na održavanju', equipment.filter((e) => e.status === 'MAINTENANCE').length.toString()],
    ['UKUPNO', equipment.length.toString()],
  ]
  for (const [label, value] of statusRows) {
    checkPageBreak(16)
    addText(label, margin, y, { size: 11, font: label === 'UKUPNO' ? fontBold : font })
    addText(value, pageWidth - margin - 60, y, { size: 11, font: fontBold })
    y -= 16
  }

  // 5. ZAKLJUČAK
  checkPageBreak(100)
  y -= 20
  addText('5. Zaključak i preporuke', margin, y, { size: 18, font: fontBold })
  y -= 25

  const conclusion = `U ${year}. godini, sistem je zabilježio ${assignments.length} aktivnosti na ${equipment.length} komada GSE opreme. Compliance rate od ${complianceRate}% pokazuje ${complianceRate >= 95 ? 'odličan' : complianceRate >= 80 ? 'zadovoljavajuć' : 'potrebno poboljšanje'} nivo poštovanja IATA AHM 340 standarda.${severityCounts.CRITICAL > 0 ? ` Zabilježeno je ${severityCounts.CRITICAL} kritičnih oštećenja - preporučuje se dodatna obuka operatera.` : ''} MTBF od ${mtbf} sati ukazuje na ${mtbf > 500 ? 'visok' : mtbf > 200 ? 'umjeren' : 'nizak'} nivo pouzdanosti opreme. MTTR od ${mttr} sati pokazuje ${mttr < 24 ? 'efikasno' : mttr < 72 ? 'umjereno efikasno' : 'sporo'} reagovanje održavanja. Održavanje je izvršilo ${maintenanceLogs.length} aktivnosti.`

  addText(conclusion, margin, y, { size: 11, maxWidth: contentWidth, lineHeight: 14 })

  addText(`GSE Control · Godišnji izvještaj · ${year} · Strana ${pdfDoc.getPageCount()} · IATA AHM 340 + EASA Part-145 compliant`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="godisnji-izvjestaj-${year}.pdf"`,
    },
  })
}
