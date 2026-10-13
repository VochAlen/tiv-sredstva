import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate } from '@/lib/pdf-utils'
import type { ChecklistItem } from '@/lib/types'

// =====================================================
// GET /api/reports/gse-checklist?id=<assignmentId>
//
// Generiše A4 PDF dnevne pre-use inspekcijske čekliste - IDENTIČAN
// izgled kolona kao papirni obrazac "Dnevna čeklista ... Aviogei /
// Bliss-Fox" (Elemenat provjere / Grupa lokacije provjere / Period
// provjere), plus rezultat (Ispravno/Neispravno) po stavci koji je
// radnik unio prilikom zaduživanja.
//
// NAMJERNO JAVNA (bez login-a): radnik koji je upravo popunio
// checklistu na telefonu/tabletu (bez ulogovanja - identifikuje se
// PIN/ID karticom, isto kao checkOutEquipment) treba da odmah može
// preuzeti PDF za arhivu. Ruta je read-only i parametrizovana samo
// cuid-om zaduženja (nije sekvencijalan/predvidljiv), isti nivo
// izloženosti kao i sam checkout flow.
// =====================================================

interface AssignmentRecord {
  id: string
  equipmentCode: string
  equipmentName: string
  employeeName: string
  employeeCardId: string
  action: string
  inspectionResult: string
  inspectionNotes: string | null
  checklistJson: string
  shift: string | null
  timestamp: Date
}

async function loadAssignment(id: string): Promise<AssignmentRecord | null> {
  if (isDemoMode()) {
    const a = await db.assignment.findUnique({ where: { id } })
    if (!a) return null
    return {
      id: a.id,
      equipmentCode: a.equipmentCode,
      equipmentName: a.equipmentName,
      employeeName: a.employeeName,
      employeeCardId: a.employeeCardId,
      action: a.action,
      inspectionResult: a.inspectionResult,
      inspectionNotes: a.inspectionNotes,
      checklistJson: a.checklistJson,
      shift: a.shift,
      timestamp: a.timestamp,
    }
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('assignments').select('*').eq('id', id).single()
  if (!data) return null
  return {
    id: data.id,
    equipmentCode: data.equipment_code,
    equipmentName: data.equipment_name,
    employeeName: data.employee_name,
    employeeCardId: data.employee_card_id,
    action: data.action,
    inspectionResult: data.inspection_result,
    inspectionNotes: data.inspection_notes,
    checklistJson: data.checklist_json,
    shift: data.shift,
    timestamp: new Date(data.timestamp),
  }
}

const RESULT_LABELS: Record<string, string> = {
  OK: 'Ispravno',
  MINOR_DAMAGE: 'Manje ostecenje',
  MAJOR_DAMAGE: 'Vece ostecenje',
  OUT_OF_SERVICE: 'Neispravno',
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return new NextResponse('Missing assignment id', { status: 400 })

  const assignment = await loadAssignment(id)
  if (!assignment) return new NextResponse('Assignment not found', { status: 404 })

  let checklist: ChecklistItem[] = []
  try {
    checklist = JSON.parse(assignment.checklistJson)
  } catch {
    checklist = []
  }

  const PAGE_WIDTH = 595.28
  const PAGE_HEIGHT = 841.89
  const MARGIN = 45

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  const text = (str: string, x: number, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {}) => {
    const { size = 9, bold = false, color = rgb(0, 0, 0) } = opts
    try {
      page.drawText(transliterate(String(str ?? '')), { x, y, size, font: bold ? fontBold : font, color })
    } catch {}
  }

  const ensureSpace = (needed: number) => {
    if (y < needed) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN
    }
  }

  // Letterhead
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: rgb(0.05, 0.25, 0.45) })
  text('GSE CONTROL — AERODROM TIVAT (LYTV)', MARGIN, { size: 14, bold: true })
  y -= 18
  text('DNEVNA CEKLISTA PRE-USE INSPEKCIJE', MARGIN, { size: 12, bold: true, color: rgb(0.05, 0.25, 0.45) })
  y -= 14
  text('PRG.03.02 / EASA ADR.OPS.B.005 - Pre-use inspekcija GSE sredstva', MARGIN, { size: 8, color: rgb(0.5, 0.5, 0.5) })
  y -= 16
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) })
  y -= 18

  // Equipment / employee info block
  const info: [string, string][] = [
    ['Sredstvo', `${assignment.equipmentCode} - ${assignment.equipmentName}`],
    ['Radnik', `${assignment.employeeName} (${assignment.employeeCardId})`],
    ['Datum i vrijeme', new Date(assignment.timestamp).toLocaleString('hr-HR')],
    ['Smjena', assignment.shift ?? '-'],
    ['Akcija', assignment.action === 'CHECK_OUT' ? 'Zaduzivanje' : 'Razduzivanje'],
    ['Rezultat pregleda', RESULT_LABELS[assignment.inspectionResult] ?? assignment.inspectionResult],
  ]
  for (const [label, value] of info) {
    text(label + ':', MARGIN, { size: 9, bold: true })
    text(value, MARGIN + 110, { size: 9 })
    y -= 13
  }
  y -= 8

  // Table header - identican rasporedu kolona iz papirnog obrasca
  const colBr = MARGIN
  const colElement = MARGIN + 25
  const colGroup = PAGE_WIDTH - MARGIN - 180
  const colPeriod = PAGE_WIDTH - MARGIN - 120
  const colResult = PAGE_WIDTH - MARGIN - 65

  const drawTableHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 4, width: PAGE_WIDTH - MARGIN * 2, height: 16, color: rgb(0.92, 0.94, 0.96) })
    text('Br.', colBr + 2, { size: 8, bold: true })
    text('Elemenat provjere', colElement, { size: 8, bold: true })
    text('Grupa', colGroup, { size: 8, bold: true })
    text('Period', colPeriod, { size: 8, bold: true })
    text('Rezultat', colResult, { size: 8, bold: true })
    y -= 16
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.75, color: rgb(0.6, 0.6, 0.6) })
    y -= 12
  }

  drawTableHeader()

  checklist.forEach((item, idx) => {
    ensureSpace(90)
    if (y === PAGE_HEIGHT - MARGIN - 16 - 12) {
      // fresh page continuation - redraw header context not needed, keep simple
    }
    const resultLabel = item.passed === true ? 'Ispravno' : item.passed === false ? 'NEISPRAVNO' : '-'
    const resultColor = item.passed === true ? rgb(0.05, 0.5, 0.2) : item.passed === false ? rgb(0.75, 0.1, 0.1) : rgb(0.5, 0.5, 0.5)

    text(String(idx + 1), colBr + 2, { size: 8 })
    text(item.label.slice(0, 68), colElement, { size: 8 })
    text(item.group ? String(item.group) : '-', colGroup, { size: 8 })
    text(item.period ?? 'Dnevno', colPeriod, { size: 8 })
    text(resultLabel, colResult, { size: 8, bold: item.passed === false, color: resultColor })
    y -= 15

    if (idx < checklist.length - 1) {
      page.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 4 }, thickness: 0.25, color: rgb(0.85, 0.85, 0.85) })
    }
  })

  y -= 10
  if (assignment.inspectionNotes) {
    ensureSpace(60)
    text('Napomene:', MARGIN, { size: 9, bold: true })
    y -= 13
    text(assignment.inspectionNotes.slice(0, 140), MARGIN, { size: 9 })
    y -= 20
  }

  // Potpis blok (kao na papirnom obrascu)
  ensureSpace(70)
  y -= 10
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 180, y }, thickness: 0.75, color: rgb(0.4, 0.4, 0.4) })
  page.drawLine({ start: { x: PAGE_WIDTH - MARGIN - 180, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.75, color: rgb(0.4, 0.4, 0.4) })
  y -= 10
  text('Potpis radnika', MARGIN, { size: 8, color: rgb(0.5, 0.5, 0.5) })
  text('Potpis / pecat sluzbe', PAGE_WIDTH - MARGIN - 180, { size: 8, color: rgb(0.5, 0.5, 0.5) })

  // Footer
  const savedY = y
  y = 25
  text(
    `GSE Control - generisano ${new Date().toLocaleString('hr-HR')} - ID zaduzenja: ${assignment.id}`,
    MARGIN,
    { size: 7, color: rgb(0.6, 0.6, 0.6) }
  )
  y = savedY

  const pdfBytes = await pdfDoc.save()
  return new NextResponse(Buffer.from(pdfBytes) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ceklista-${assignment.equipmentCode}-${new Date(assignment.timestamp).toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
