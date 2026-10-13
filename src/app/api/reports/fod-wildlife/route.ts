import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'
import { FOD_ITEM_TYPE_LABELS } from '@/lib/constants-export'

// ADR.OPS.B.016(c) — "The FOD control programme should be periodically
// reviewed... The sources of the FODs, including their location and the
// activities generating FOD... should be identified, recorded and analysed
// to identify trends". Ovaj izvještaj daje upravo to.

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const since = new Date()
  since.setMonth(since.getMonth() - 12)

  let fodReports: any[] = []
  let wildlifeReports: any[] = []

  if (isDemoMode()) {
    fodReports = await db.fodReport.findMany({ where: { foundAt: { gte: since } }, orderBy: { foundAt: 'desc' } })
    wildlifeReports = await db.wildlifeReport.findMany({ where: { observedAt: { gte: since } }, orderBy: { observedAt: 'desc' } })
  } else {
    const supabase = await createSupabaseClient()
    const [{ data: fr }, { data: wr }] = await Promise.all([
      supabase.from('fod_reports').select('*').gte('found_at', since.toISOString()).order('found_at', { ascending: false }),
      supabase.from('wildlife_reports').select('*').gte('observed_at', since.toISOString()).order('observed_at', { ascending: false }),
    ])
    fodReports = (fr ?? []).map((f: any) => ({
      location: f.location, itemType: f.item_type, description: f.description,
      aircraftPartSuspected: f.aircraft_part_suspected, removed: f.removed, foundByName: f.found_by_name,
      foundAt: new Date(f.found_at),
    }))
    wildlifeReports = (wr ?? []).map((w: any) => ({
      species: w.species, count: w.count, location: w.location, strike: w.strike,
      reportedByName: w.reported_by_name, observedAt: new Date(w.observed_at),
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
  const ensureSpace = () => { if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin } }

  addText('GSE CONTROL — FOD & WILDLIFE IZVJESTAJ (12 mjeseci)', margin, y, { size: 15, font: fontBold }); y -= 20
  addText('ADR.OPS.B.016 — FOD kontrolni program · ADR.OPS.B.020 — Wildlife strike hazard reduction', margin, y, { size: 9 }); y -= 14
  addText(`Generisao: ${user.full_name} (${user.role}) · ${new Date().toLocaleDateString('hr-HR')}`, margin, y, { size: 9 }); y -= 25

  // FOD summary + trend po lokaciji
  const byLocation: Record<string, number> = {}
  const byType: Record<string, number> = {}
  fodReports.forEach((f) => {
    byLocation[f.location] = (byLocation[f.location] ?? 0) + 1
    byType[f.itemType] = (byType[f.itemType] ?? 0) + 1
  })
  const aircraftPartCount = fodReports.filter((f) => f.aircraftPartSuspected).length

  addText('FOD — SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`Ukupno prijava: ${fodReports.length}    Sumnja - dio vazduhoplova: ${aircraftPartCount}`, margin, y, { size: 10 }); y -= 16

  addText('Najcesce lokacije:', margin, y, { size: 10, font: fontBold }); y -= 12
  Object.entries(byLocation).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([loc, c]) => {
    ensureSpace(); addText(`  ${loc}: ${c}`, margin, y, { size: 9 }); y -= 11
  })
  y -= 6
  addText('Po tipu predmeta:', margin, y, { size: 10, font: fontBold }); y -= 12
  Object.entries(byType).forEach(([t, c]) => {
    ensureSpace(); addText(`  ${FOD_ITEM_TYPE_LABELS[t] ?? t}: ${c}`, margin, y, { size: 9 }); y -= 11
  })
  y -= 15

  addText('FOD — DETALJI:', margin, y, { size: 11, font: fontBold }); y -= 13
  const fodCols = [margin, margin + 90, margin + 170, margin + 350, margin + 440]
  ;['Datum', 'Lokacija', 'Tip', 'Opis', 'Prijavio'].forEach((h, i) => addText(h, fodCols[i], y, { size: 8, font: fontBold }))
  y -= 4; page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5 }); y -= 10
  for (const f of fodReports) {
    ensureSpace()
    addText(new Date(f.foundAt).toLocaleDateString('hr-HR'), fodCols[0], y, { size: 8 })
    addText((f.location || '').slice(0, 16), fodCols[1], y, { size: 8 })
    addText((FOD_ITEM_TYPE_LABELS[f.itemType] ?? f.itemType).slice(0, 18), fodCols[2], y, { size: 8 })
    addText((f.description || '').slice(0, 20), fodCols[3], y, { size: 8 })
    addText((f.foundByName || '').slice(0, 14), fodCols[4], y, { size: 8 })
    y -= 10
  }

  // Wildlife
  y -= 15
  ensureSpace()
  addText('WILDLIFE — SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  const strikeCount = wildlifeReports.filter((w) => w.strike).length
  addText(`Ukupno opazanja: ${wildlifeReports.length}    Sudara: ${strikeCount}`, margin, y, { size: 10 }); y -= 20

  addText('WILDLIFE — DETALJI:', margin, y, { size: 11, font: fontBold }); y -= 13
  const wCols = [margin, margin + 90, margin + 220, margin + 320, margin + 380, margin + 460]
  ;['Datum', 'Vrsta', 'Lokacija', 'Broj', 'Sudar', 'Prijavio'].forEach((h, i) => addText(h, wCols[i], y, { size: 8, font: fontBold }))
  y -= 4; page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5 }); y -= 10
  for (const w of wildlifeReports) {
    ensureSpace()
    addText(new Date(w.observedAt).toLocaleDateString('hr-HR'), wCols[0], y, { size: 8 })
    addText((w.species || '').slice(0, 20), wCols[1], y, { size: 8 })
    addText((w.location || '').slice(0, 14), wCols[2], y, { size: 8 })
    addText(String(w.count ?? 1), wCols[3], y, { size: 8 })
    addText(w.strike ? 'DA' : 'ne', wCols[4], y, { size: 8 })
    addText((w.reportedByName || '').slice(0, 14), wCols[5], y, { size: 8 })
    y -= 10
  }

  addText(`GSE Control · ADR.OPS.B.016/B.020 · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="fod-wildlife-izvjestaj.pdf"' } })
}
