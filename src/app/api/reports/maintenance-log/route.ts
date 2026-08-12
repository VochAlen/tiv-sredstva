import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'

const TYPE_LABELS: Record<string, string> = {
  PREVENTIVE: 'Preventivno', CORRECTIVE: 'Korektivno', INSPECTION: 'Inspekcija', OVERHAUL: 'Generalni',
}
const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Zakazano', IN_PROGRESS: 'U toku', COMPLETED: 'Zavrseno', CANCELLED: 'Otkazano',
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  let logs: any[] = []

  if (isDemoMode()) {
    logs = await db.maintenanceLog.findMany({ orderBy: { performedAt: 'desc' } })
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('maintenance_log').select('*').order('performed_at', { ascending: false })
    logs = data ?? []
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

  addText('GSE CONTROL — DNEVNIK ODRZAVANJA', margin, y, { size: 16, font: fontBold }); y -= 20
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 12
  addText(`Ukupno zapisa: ${logs.length}`, margin, y, { size: 10 }); y -= 20

  // Summary by type
  const byType: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  let totalCost = 0
  for (const log of logs) {
    const t = log.maintenanceType || log.maintenance_type
    const s = log.status || 'COMPLETED'
    byType[t] = (byType[t] || 0) + 1
    byStatus[s] = (byStatus[s] || 0) + 1
    totalCost += log.cost || 0
  }

  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  for (const [t, n] of Object.entries(byType)) {
    addText(`• ${TYPE_LABELS[t] || t}: ${n}`, margin + 10, y, { size: 10 }); y -= 12
  }
  addText(`Ukupni trosak odrzavanja: ${totalCost.toFixed(2)} EUR`, margin + 10, y, { size: 10, color: rgb(0.1, 0.5, 0.1) }); y -= 20

  // Table header
  addText('DNEVNIK:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 90, margin + 180, margin + 280, margin + 380, margin + 460]
  ;['Datum', 'Oprema', 'Tip', 'Izveo', 'Status', 'Trosak'].forEach((h, i) => addText(h, cols[i], y, { size: 9, font: fontBold }))
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const log of logs) {
    if (y < 80) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
      ;['Datum', 'Oprema', 'Tip', 'Izveo', 'Status', 'Trosak'].forEach((h, i) => addText(h, cols[i], y, { size: 9, font: fontBold }))
      y -= 14
    }
    const dt = new Date(log.performedAt || log.performed_at).toLocaleDateString('hr-HR')
    const eqCode = (log.equipmentCode || log.equipment_code || '').slice(0, 14)
    const eqName = (log.equipmentName || log.equipment_name || '').slice(0, 14)
    const tp = TYPE_LABELS[log.maintenanceType || log.maintenance_type] || (log.maintenanceType || log.maintenance_type || '')
    const by = (log.performedBy || log.performed_by || '').slice(0, 18)
    const st = STATUS_LABELS[log.status] || log.status || 'Zavrseno'
    const cost = log.cost != null ? `${log.cost} EUR` : '-'

    addText(dt, cols[0], y, { size: 8 })
    addText(eqCode, cols[1], y, { size: 8, font: fontBold })
    addText(eqName, cols[1], y - 9, { size: 7, color: rgb(0.4, 0.4, 0.4) })
    addText(tp, cols[2], y, { size: 8 })
    addText(by, cols[3], y, { size: 8 })
    addText(st, cols[4], y, { size: 8 })
    addText(cost, cols[5], y, { size: 8 })
    y -= 22

    // Description on second line
    const desc = (log.description || '').slice(0, 100)
    if (desc) {
      addText(`   ${desc}`, margin, y, { size: 7, color: rgb(0.3, 0.3, 0.3) })
      y -= 10
    }
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="maintenance-log-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
