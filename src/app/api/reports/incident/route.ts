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
  const incidentId = searchParams.get('id')
  if (!incidentId) return new NextResponse('Missing incident ID', { status: 400 })

  let inc: any = null
  if (isDemoMode()) {
    inc = await db.incident.findUnique({ where: { id: incidentId } })
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('incidents').select('*').eq('id', incidentId).single()
    inc = data ? {
      incidentNumber: data.incident_number, incidentType: data.incident_type, severity: data.severity, smorRequired: data.smor_required,
      location: data.location, zone: data.zone, occurredAt: new Date(data.occurred_at), weather: data.weather, visibility: data.visibility,
      surfaceCondition: data.surface_condition, equipmentCode: data.equipment_code, equipmentName: data.equipment_name,
      operatorCardId: data.operator_card_id, operatorName: data.operator_name, description: data.description, immediateAction: data.immediate_action,
      rootCause: data.root_cause, contributingFactors: data.contributing_factors, correctiveActions: data.corrective_actions,
      preventiveActions: data.preventive_actions, status: data.status, reportedBy: data.reported_by, reportedAt: new Date(data.reported_at),
      injuriesReported: data.injuries_reported, injuryDetails: data.injury_details, damageEstimate: data.damage_estimate,
      authorityNotified: data.authority_notified, notes: data.notes,
    } : null
  }

  if (!inc) return new NextResponse('Incident not found', { status: 404 })

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const page = pdfDoc.addPage([595.28, 841.89])
  const margin = 50
  let y = 841.89 - margin

  const addText = (text: string, x: number, yVal: number, opts: any = {}) => {
    const { size = 10, font: f = font, color = rgb(0, 0, 0) } = opts
    try { page.drawText(transliterate(text), { x, y: yVal, size, font: f, color }) } catch {}
  }

  const sevColor = inc.severity === 'ACCIDENT' ? rgb(0.86, 0.15, 0.15) : inc.severity === 'SERIOUS' ? rgb(0.92, 0.35, 0.05) : inc.severity === 'MAJOR' ? rgb(0.79, 0.54, 0.04) : rgb(0.3, 0.5, 0.8)

  // Header
  addText('IZVJESTAJ O INCIDENTU', margin, y, { size: 20, font: fontBold }); y -= 25
  addText(inc.incidentNumber, margin, y, { size: 14, font: fontBold, color: sevColor }); y -= 20
  page.drawLine({ start: { x: margin, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) }); y -= 20

  const rows: [string, string][] = [
    ['Tip incidenta', inc.incidentType], ['Tezina', inc.severity], ['SMOR obavezan', inc.smorRequired ? 'DA' : 'NE'],
    ['Status', inc.status], ['Lokacija', `${inc.location} (${inc.zone || '-'})`],
    ['Vrijeme dogadjaja', new Date(inc.occurredAt).toLocaleString('hr-HR')],
    ['Vremenski uslovi', `${inc.weather || '-'} / ${inc.visibility || '-'}`],
    ['Stanje podloge', inc.surfaceCondition || '-'],
    ['GSE', `${inc.equipmentCode || '-'} ${inc.equipmentName || ''}`],
    ['Operater', `${inc.operatorName || '-'} (${inc.operatorCardId || '-'})`],
    ['Prijavio', `${inc.reportedBy} (${new Date(inc.reportedAt).toLocaleDateString('hr-HR')})`],
    ['Ozljede', inc.injuriesReported ? `DA: ${inc.injuryDetails || '-'}` : 'NE'],
    ['Steta (EUR)', inc.damageEstimate ? inc.damageEstimate.toFixed(2) : '-'],
    ['Autoritet obavijesten', inc.authorityNotified || '-'],
  ]

  for (const [label, value] of rows) {
    if (y < 100) break
    addText(label + ':', margin, y, { size: 10, font: fontBold }); addText(value, margin + 150, y, { size: 10 }); y -= 14
  }

  y -= 10
  addText('OPIS DOGADJAJA:', margin, y, { size: 11, font: fontBold }); y -= 14
  addText(inc.description, margin, y, { size: 10, color: rgb(0.2, 0.2, 0.2) }); y -= 20

  if (inc.immediateAction) { addText('HITNE MJERE:', margin, y, { size: 11, font: fontBold }); y -= 14; addText(inc.immediateAction, margin, y, { size: 10 }); y -= 20 }
  if (inc.rootCause) { addText('ROOT CAUSE:', margin, y, { size: 11, font: fontBold }); y -= 14; addText(inc.rootCause, margin, y, { size: 10 }); y -= 20 }
  if (inc.correctiveActions) { addText('KOREKTIVNE AKCIJE:', margin, y, { size: 11, font: fontBold, color: rgb(0.05, 0.6, 0.4) }); y -= 14; addText(inc.correctiveActions, margin, y, { size: 10 }); y -= 20 }
  if (inc.preventiveActions) { addText('PREVENTIVNE AKCIJE:', margin, y, { size: 11, font: fontBold, color: rgb(0.05, 0.6, 0.4) }); y -= 14; addText(inc.preventiveActions, margin, y, { size: 10 }); y -= 20 }
  if (inc.notes) { addText('NAPOMENE:', margin, y, { size: 11, font: fontBold }); y -= 14; addText(inc.notes, margin, y, { size: 10 }); y -= 20 }

  // Footer
  addText(`GSE Control · ADR.OPS.B.005 · Generisao: ${user.full_name} · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${inc.incidentNumber}.pdf"` } })
}
