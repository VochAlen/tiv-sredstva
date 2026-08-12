import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'

const TYPE_LABELS: Record<string, string> = {
  RUNWAY: 'Runway', TAXIWAY: 'Taxiway', APRON: 'Apron', MOVEMENT_AREA_JOINT: 'Movement Area Joint',
}
const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Zavrseno', WITH_FINDINGS: 'Sa nalazima', CRITICAL: 'KRITICNO', ABORTED: 'Prekinuto',
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  let insp: any[] = []
  if (isDemoMode()) {
    insp = await db.aerodromeInspection.findMany({
      orderBy: { inspectionDate: 'desc' },
      include: { findings: true },
    })
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('aerodrome_inspections').select('*, inspection_findings(*)').order('inspection_date', { ascending: false })
    insp = (data ?? []).map((i: any) => ({
      inspectionType: i.inspection_type, inspectionDate: i.inspection_date, performedBy: i.performed_by,
      shift: i.shift, runwayCode: i.runway_code, taxiwayCode: i.taxiway_code, apronArea: i.apron_area,
      weatherConditions: i.weather_conditions, runwayCondition: i.runway_condition, status: i.status,
      findingsCount: i.inspection_findings?.length ?? 0,
      criticalCount: i.inspection_findings?.filter((f: any) => f.severity === 'CRITICAL').length ?? 0,
      notes: i.notes,
      findings: (i.inspection_findings ?? []).map((f: any) => ({
        category: f.category, severity: f.severity, description: f.description, location: f.location,
      })),
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

  addText('GSE CONTROL — DNEVNI IZVJESTAJ INSPEKCIJA AERODROMA', margin, y, { size: 16, font: fontBold }); y -= 20
  addText(`ADR.OPS.B.005 · ICAO Annex 14`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 12
  addText(`Ukupno inspekcija: ${insp.length}`, margin, y, { size: 10 }); y -= 20

  // Summary
  const critical = insp.filter(i => i.status === 'CRITICAL').length
  const withFindings = insp.filter(i => i.status === 'WITH_FINDINGS').length
  const completed = insp.filter(i => i.status === 'COMPLETED').length
  const totalFindings = insp.reduce((s, i) => s + (i.findingsCount || (i.findings?.length ?? 0)), 0)

  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Zavrsene inspekcije: ${completed}`, margin + 10, y, { size: 10, color: rgb(0.1, 0.55, 0.15) }); y -= 12
  addText(`• Sa nalazima: ${withFindings}`, margin + 10, y, { size: 10, color: rgb(0.85, 0.55, 0.1) }); y -= 12
  addText(`• Kriticne: ${critical}`, margin + 10, y, { size: 10, color: critical > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 12
  addText(`• Ukupno nalaza: ${totalFindings}`, margin + 10, y, { size: 10 }); y -= 20

  // Table
  addText('DNEVNE INSPEKCIJE:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 90, margin + 180, margin + 250, margin + 310, margin + 380, margin + 460]
  ;['Datum', 'Tip', 'Inspektor', 'Lokacija', 'Status', 'Nalaza', 'Kriticnih'].forEach((h, i) => addText(h, cols[i], y, { size: 8, font: fontBold }))
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const i of insp) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    const dt = new Date(i.inspectionDate).toLocaleString('hr-HR').slice(0, 12)
    const loc = i.runwayCode ? `RWY ${i.runwayCode}` : i.taxiwayCode ? `TWY ${i.taxiwayCode}` : i.apronArea || '-'
    const findingsCount = i.findingsCount || i.findings?.length || 0
    const criticalCount = i.criticalCount || i.findings?.filter((f: any) => f.severity === 'CRITICAL').length || 0

    addText(dt, cols[0], y, { size: 7 })
    addText((TYPE_LABELS[i.inspectionType] || i.inspectionType).slice(0, 12), cols[1], y, { size: 7, font: fontBold })
    addText((i.performedBy || '').slice(0, 16), cols[2], y, { size: 7 })
    addText(loc.slice(0, 14), cols[3], y, { size: 7 })
    const stColor = i.status === 'CRITICAL' ? rgb(0.86, 0.15, 0.15) : i.status === 'WITH_FINDINGS' ? rgb(0.85, 0.55, 0.1) : rgb(0.1, 0.55, 0.15)
    addText((STATUS_LABELS[i.status] || i.status).slice(0, 12), cols[4], y, { size: 7, color: stColor, font: fontBold })
    addText(`${findingsCount}`, cols[5], y, { size: 7 })
    addText(`${criticalCount}`, cols[6], y, { size: 7, color: criticalCount > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) })
    y -= 11

    // Findings details
    if (i.findings && i.findings.length > 0) {
      for (const f of i.findings) {
        if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
        const sevColor = f.severity === 'CRITICAL' ? rgb(0.86, 0.15, 0.15) : f.severity === 'HIGH' ? rgb(0.85, 0.4, 0.1) : rgb(0.3, 0.3, 0.3)
        addText(`   [${f.severity}] ${f.category}: ${f.description.slice(0, 80)}${f.location ? ` @ ${f.location}` : ''}`, margin, y, { size: 6, color: sevColor })
        y -= 8
      }
    }
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="daily-inspection-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
