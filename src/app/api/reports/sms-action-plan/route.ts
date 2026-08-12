import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'

const CAT_LABELS: Record<string, string> = { CORRECTIVE: 'Korektivna', PREVENTIVE: 'Preventivna', MITIGATION: 'Mitigacija', IMPROVEMENT: 'Unapredjenje' }
const PRIO_LABELS: Record<string, string> = { LOW: 'Nizak', MEDIUM: 'Srednji', HIGH: 'Visok', CRITICAL: 'Kriticni' }
const STATUS_LABELS: Record<string, string> = { OPEN: 'Otvorena', IN_PROGRESS: 'U toku', COMPLETED: 'Zavrsena', OVERDUE: 'Prekoracena', CANCELLED: 'Otkazana' }

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  let actions: any[] = []
  if (isDemoMode()) {
    actions = await db.safetyAction.findMany({ orderBy: { dueDate: 'asc' } })
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase.from('sms_safety_actions').select('*').order('due_date', { ascending: true })
    actions = (data ?? []).map((a: any) => ({
      actionId: a.action_id, title: a.title, description: a.description, category: a.category,
      priority: a.priority, assignedTo: a.assigned_to, dueDate: a.due_date, completedAt: a.completed_at,
      status: a.status, estimatedCost: a.estimated_cost, actualCost: a.actual_cost,
      progressNotes: a.progress_notes, verificationResult: a.verification_result,
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

  addText('GSE CONTROL — SAFETY ACTION PLAN', margin, y, { size: 16, font: fontBold }); y -= 20
  addText(`ICAO Annex 19 · EASA M.GEN.205`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) }); y -= 12
  addText(`Generisao: ${user.full_name} (${user.role})`, margin, y, { size: 10 }); y -= 12
  addText(`Datum: ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, y, { size: 10 }); y -= 12
  addText(`Ukupno akcija: ${actions.length}`, margin, y, { size: 10 }); y -= 20

  // Summary
  const today = new Date()
  const open = actions.filter(a => a.status === 'OPEN' || a.status === 'IN_PROGRESS').length
  const completed = actions.filter(a => a.status === 'COMPLETED').length
  const overdue = actions.filter(a => a.dueDate && new Date(a.dueDate) < today && a.status !== 'COMPLETED').length
  const critical = actions.filter(a => a.priority === 'CRITICAL' && a.status !== 'COMPLETED').length
  const totalCost = actions.reduce((s, a) => s + (a.actualCost || a.estimatedCost || 0), 0)

  addText('SAZETAK:', margin, y, { size: 12, font: fontBold }); y -= 14
  addText(`• Otvorene: ${open}`, margin + 10, y, { size: 10, color: rgb(0.85, 0.55, 0.1) }); y -= 12
  addText(`• Zavrsene: ${completed}`, margin + 10, y, { size: 10, color: rgb(0.1, 0.55, 0.15) }); y -= 12
  addText(`• Prekoracene: ${overdue}`, margin + 10, y, { size: 10, color: overdue > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 12
  addText(`• Kriticne (otvorene): ${critical}`, margin + 10, y, { size: 10, color: critical > 0 ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) }); y -= 12
  addText(`• Ukupni trosak: ${totalCost.toFixed(2)} EUR`, margin + 10, y, { size: 10 }); y -= 20

  // Table
  addText('ACTION PLAN:', margin, y, { size: 12, font: fontBold }); y -= 14
  const cols = [margin, margin + 80, margin + 200, margin + 270, margin + 320, margin + 380, margin + 440, margin + 500]
  ;['ID', 'Naslov', 'Kategorija', 'Prioritet', 'Zaduzen', 'Rok', 'Status', 'Trosak'].forEach((h, i) => addText(h, cols[i], y, { size: 7, font: fontBold }))
  y -= 5
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 11

  for (const a of actions) {
    if (y < 80) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin }
    const isOverdue = a.dueDate && new Date(a.dueDate) < today && a.status !== 'COMPLETED'
    const prioColor = a.priority === 'CRITICAL' ? rgb(0.86, 0.15, 0.15) : a.priority === 'HIGH' ? rgb(0.85, 0.4, 0.1) : rgb(0, 0, 0)

    addText(a.actionId, cols[0], y, { size: 7, font: fontBold })
    addText((a.title || '').slice(0, 20), cols[1], y, { size: 7 })
    addText((CAT_LABELS[a.category] || a.category).slice(0, 12), cols[2], y, { size: 7 })
    addText(PRIO_LABELS[a.priority] || a.priority, cols[3], y, { size: 7, color: prioColor, font: fontBold })
    addText((a.assignedTo || '').slice(0, 14), cols[4], y, { size: 7 })
    addText(new Date(a.dueDate).toLocaleDateString('hr-HR'), cols[5], y, { size: 7, color: isOverdue ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0) })
    addText(STATUS_LABELS[a.status] || a.status, cols[6], y, { size: 7 })
    addText(a.actualCost ? `${a.actualCost}€` : a.estimatedCost ? `~${a.estimatedCost}€` : '-', cols[7], y, { size: 7 })
    y -= 11

    if (a.progressNotes) {
      addText(`   ${(a.progressNotes || '').slice(0, 90)}`, margin, y, { size: 6, color: rgb(0.3, 0.3, 0.3) }); y -= 7
    }
    if (a.verificationResult) {
      addText(`   Verifikacija: ${(a.verificationResult || '').slice(0, 85)}`, margin, y, { size: 6, color: rgb(0.1, 0.5, 0.1) }); y -= 7
    }
  }

  addText(`GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}`, margin, 30, { size: 8, color: rgb(0.6, 0.6, 0.6) })

  const pdf = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="sms-action-plan-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
