import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'

const TYPE_LABELS: Record<string, string> = { RUNWAY: 'Runway', TAXIWAY: 'Taxiway', APRON: 'Apron', MOVEMENT_AREA_JOINT: 'Mov. Area Joint' }
const STATUS_LABELS: Record<string, string> = { COMPLETED: 'Zavrseno', WITH_FINDINGS: 'Sa nalazima', CRITICAL: 'Kriticno', ABORTED: 'Prekinuto' }
const CATEGORY_LABELS: Record<string, string> = { FOD: 'FOD', PAVEMENT_DAMAGE: 'Kolovoz', MARKINGS: 'Oznake', LIGHTING: 'Svjetla', WILDLIFE: 'Divljac', DRAINAGE: 'Drenaza', GSE_PARKING: 'GSE', SIGNAGE: 'Znakovi', OTHER: 'Ostalo' }

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  let insp: any[] = []
  let findings: any[] = []

  if (isDemoMode()) {
    [insp, findings] = await Promise.all([
      db.aerodromeInspection.findMany({ include: { findings: true } }),
      db.inspectionFinding.findMany({ include: { inspection: true } }),
    ])
  } else {
    const supabase = await createSupabaseClient()
    const [i, f] = await Promise.all([
      supabase.from('aerodrome_inspections').select('*, inspection_findings(*)'),
      supabase.from('inspection_findings').select('*, aerodrome_inspections(*)'),
    ])
    insp = (i.data ?? []).map((x: any) => ({
      inspectionType: x.inspection_type, inspectionDate: x.inspection_date, performedBy: x.performed_by,
      status: x.status, findingsCount: x.inspection_findings?.length ?? 0,
    }))
    findings = (f.data ?? []).map((x: any) => ({
      category: x.category, severity: x.severity, status: x.status, location: x.location, createdAt: x.created_at,
    }))
  }

  // Filter last 30 days
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const recentInsp = insp.filter(i => new Date(i.inspectionDate) >= cutoff)

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

  addText('GSE CONTROL — MJSECNI STATISTICKI IZVJESTAJ', margin, y, { size: 16, font: fontBold }); y -= 20
  addText(`Period: posljednjih 30 dana (${cutoff.toLocaleDateString('hr-HR')} - ${new Date().toLocaleDateString('hr-HR')})`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 20

  // Summary
  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Ukupno inspekcija (30 dana): ${recentInsp.length}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Ukupno nalaza: ${findings.length}`, margin + 10, y, { size: 10 }); y -= 12
  addText(`• Otvoreni nalazi: ${findings.filter(f => f.status === 'OPEN' || f.status === 'IN_PROGRESS').length}`, margin + 10, y, { size: 10, color: rgb(0.85, 0.55, 0.1) }); y -= 12
  addText(`• Kriticni nalazi: ${findings.filter(f => f.severity === 'CRITICAL').length}`, margin + 10, y, { size: 10, color: rgb(0.86, 0.15, 0.15) }); y -= 20

  // By type
  addText('INSPEKCIJE PO TIPU:', margin, y, { size: 12, font: fontBold }); y -= 14
  const byType: Record<string, number> = {}
  for (const i of recentInsp) { byType[i.inspectionType] = (byType[i.inspectionType] || 0) + 1 }
  for (const [t, c] of Object.entries(byType)) {
    addText(`• ${TYPE_LABELS[t] || t}: ${c}`, margin + 10, y, { size: 10 }); y -= 12
  }
  y -= 8

  // By status
  addText('STATUS INSPEKCIJA:', margin, y, { size: 12, font: fontBold }); y -= 14
  const byStatus: Record<string, number> = {}
  for (const i of recentInsp) { byStatus[i.status] = (byStatus[i.status] || 0) + 1 }
  for (const [s, c] of Object.entries(byStatus)) {
    const color = s === 'CRITICAL' ? rgb(0.86, 0.15, 0.15) : s === 'WITH_FINDINGS' ? rgb(0.85, 0.55, 0.1) : rgb(0.1, 0.55, 0.15)
    addText(`• ${STATUS_LABELS[s] || s}: ${c}`, margin + 10, y, { size: 10, color }); y -= 12
  }
  y -= 8

  // Findings by category
  if (y < 150) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('NALAZI PO KATEGORIJI:', margin, y, { size: 12, font: fontBold }); y -= 14
  const byCat: Record<string, number> = {}
  for (const f of findings) { byCat[f.category] = (byCat[f.category] || 0) + 1 }
  const sortedCats = Object.entries(byCat).sort((a, b) => b[1] - a[1])
  for (const [c, n] of sortedCats) {
    addText(`• ${CATEGORY_LABELS[c] || c}: ${n}`, margin + 10, y, { size: 10 }); y -= 12
  }
  y -= 8

  // Top problem locations
  if (y < 200) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
  addText('TOP PROBLEMATICNE LOKACIJE:', margin, y, { size: 12, font: fontBold }); y -= 14
  const locMap: Record<string, number> = {}
  for (const f of findings) { if (f.location) locMap[f.location] = (locMap[f.location] || 0) + 1 }
  const sortedLocs = Object.entries(locMap).sort((a, b) => b[1] - a[1]).slice(0, 10)
  for (let i = 0; i < sortedLocs.length; i++) {
    const [loc, count] = sortedLocs[i]
    addText(`#${i + 1}: ${loc} (${count} nalaza)`, margin + 10, y, { size: 10, color: count >= 3 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 12
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="inspection-monthly-stats-${new Date().toISOString().slice(0, 7)}.pdf"`,
    },
  })
}
