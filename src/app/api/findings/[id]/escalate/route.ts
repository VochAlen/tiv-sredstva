// src/app/api/findings/[id]/escalate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { createHazardFromFinding, buildNotamDraftFromFinding } from '@/lib/inspection-escalation'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params

  let finding: any
  let inspection: any

  if (isDemoMode()) {
    finding = await db.inspectionFinding.findUnique({ where: { id } })
    if (!finding) return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    inspection = await db.aerodromeInspection.findUnique({ where: { id: finding.inspectionId } })
  } else {
    const supabase = await createSupabaseClient()
    const { data: f } = await supabase.from('inspection_findings').select('*').eq('id', id).single()
    if (!f) return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    finding = f
    const { data: insp } = await supabase.from('aerodrome_inspections').select('*').eq('id', f.inspection_id).single()
    inspection = insp
  }

  if (!['CRITICAL', 'HIGH'].includes(finding.severity)) {
    return NextResponse.json({ error: 'Eskalacija je dozvoljena samo za HIGH/CRITICAL nalaze' }, { status: 400 })
  }

  const hazard = await createHazardFromFinding({
    findingId: finding.id,
    category: finding.category,
    severity: finding.severity,
    description: finding.description,
    location: finding.location,
    inspectionType: inspection?.inspectionType ?? inspection?.inspection_type,
    reportedBy: user.full_name,
    reportedByCardId: user.card_id ?? null,
  })

  const notamDraft =
    finding.severity === 'CRITICAL'
      ? buildNotamDraftFromFinding({
          findingId: finding.id,
          inspectionId: inspection?.id,
          category: finding.category,
          description: finding.description,
          location: finding.location,
          inspectionType: inspection?.inspectionType ?? inspection?.inspection_type,
          runwayCode: inspection?.runwayCode ?? inspection?.runway_code,
          taxiwayCode: inspection?.taxiwayCode ?? inspection?.taxiway_code,
          apronArea: inspection?.apronArea ?? inspection?.apron_area,
        })
      : null

  return NextResponse.json({ hazard, notamDraft })
}