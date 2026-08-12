import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'

const CATEGORY_LABELS: Record<string, string> = {
  FOD: 'FOD', PAVEMENT_DAMAGE: 'Ostecenje kolovoza', MARKINGS: 'Oznake', LIGHTING: 'Osvjetljenje',
  WILDLIFE: 'Divljac', DRAINAGE: 'Drenaza', GSE_PARKING: 'GSE parking', SIGNAGE: 'Znakovi', OTHER: 'Ostalo',
}
const SEVERITY_LABELS: Record<string, string> = { LOW: 'Nisko', MEDIUM: 'Srednje', HIGH: 'Visoko', CRITICAL: 'Kriticno' }

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  let findings: any[] = []
  if (isDemoMode()) {
    findings = await db.inspectionFinding.findMany({
      orderBy: { createdAt: 'desc' },
      include: { inspection: true },
    })
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('inspection_findings').select('*, aerodrome_inspections(*)').order('created_at', { ascending: false })
    findings = (data ?? []).map((f: any) => ({
      category: f.category, severity: f.severity, description: f.description, location: f.location,
      latitude: f.latitude, longitude: f.longitude, status: f.status, actionTaken: f.action_taken,
      notamNumber: f.notam_number, createdAt: f.created_at,
      inspection: f.aerodrome_inspections ? {
        inspectionType: f.aerodrome_inspections.inspection_type,
        runwayCode: f.aerodrome_inspections.runway_code,
        taxiwayCode: f.aerodrome_inspections.taxiway_code,
      } : null,
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

  addText('GSE CONTROL — NALAZI INSPEKCIJA AERODROMA', margin, y, { size: 16, font: fontBold }); y -= 20
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 12
  addText(`Ukupno nalaza: ${findings.length}`, margin, y, { size: 10 }); y -= 20

  // Summary
  const bySeverity: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
  const byStatus: Record<string, number> = {}
  for (const f of findings) { bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1; byStatus[f.status] = (byStatus[f.status] || 0) + 1 }

  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  for (const [s, c] of Object.entries(bySeverity)) {
    const color = s === 'CRITICAL' ? rgb(0.86, 0.15, 0.15) : s === 'HIGH' ? rgb(0.85, 0.4, 0.1) : s === 'MEDIUM' ? rgb(0.85, 0.55, 0.1) : rgb(0, 0, 0)
    addText(`• ${SEVERITY_LABELS[s]}: ${c}`, margin + 10, y, { size: 10, color }); y -= 12
  }
  y -= 4
  for (const [s, c] of Object.entries(byStatus)) {
    addText(`• ${s}: ${c}`, margin + 10, y, { size: 10 }); y -= 12
  }
  y -= 8

  // Table
  addText('NALAZI:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 70, margin + 140, margin + 280, margin + 360, margin + 440, margin + 500]
  ;['Datum', 'Tezina', 'Kategorija', 'Opis', 'Lokacija', 'Status', 'NOTAM'].forEach((h, i) => addText(h, cols[i], y, { size: 8, font: fontBold }))
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const f of findings) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    const dt = new Date(f.createdAt).toLocaleDateString('hr-HR')
    const sevColor = f.severity === 'CRITICAL' ? rgb(0.86, 0.15, 0.15) : f.severity === 'HIGH' ? rgb(0.85, 0.4, 0.1) : rgb(0, 0, 0)
    addText(dt, cols[0], y, { size: 7 })
    addText(SEVERITY_LABELS[f.severity] || f.severity, cols[1], y, { size: 7, color: sevColor, font: fontBold })
    addText((CATEGORY_LABELS[f.category] || f.category).slice(0, 14), cols[2], y, { size: 7 })
    addText((f.description || '').slice(0, 30), cols[3], y, { size: 7 })
    addText((f.location || '-').slice(0, 14), cols[4], y, { size: 7 })
    addText(f.status, cols[5], y, { size: 7 })
    addText(f.notamNumber || '-', cols[6], y, { size: 7 })
    y -= 11

    if (f.latitude != null && f.longitude != null) {
      addText(`   Koordinate: ${f.latitude.toFixed(4)}, ${f.longitude.toFixed(4)}`, margin, y, { size: 6, color: rgb(0.4, 0.4, 0.4) })
      y -= 7
    }
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="inspection-findings-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
