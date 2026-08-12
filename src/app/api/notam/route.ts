// src/app/api/notam/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'

// Napomena: zamijeniti sa pravim sekvencijalnim brojačem iz baze u produkciji
// (trenutno je random suffix — dovoljno za demo/testiranje, ne za pravi NOTAM broj)
function generateNotamNumber() {
  const year = new Date().getFullYear().toString().slice(-2)
  const seq = Math.floor(1000 + Math.random() * 9000)
  return `A${seq}/${year}`
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const body = await request.json()
  const notamNumber = body.notamNumber ?? generateNotamNumber()
  const validTo = body.validTo ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const payload = {
    notamNumber,
    series: body.series ?? 'A',
    qualifier: body.qualifier ?? 'NOTAMN',
    fir: body.fir ?? 'LYBA',
    aerodrome: body.aerodrome ?? 'LYTV',
    subject: body.subject,
    condition: body.condition,
    purpose: body.purpose ?? 'B',
    scope: body.scope ?? 'A',
    traffic: body.traffic ?? 'IV',
    text: body.text,
    createdFromFindingId: body.createdFromFindingId ?? null,
    createdFromInspectionId: body.createdFromInspectionId ?? null,
    status: 'ACTIVE',
    validFrom: body.validFrom ?? new Date().toISOString(),
    validTo,
    createdBy: user.full_name,
  }

  if (isDemoMode()) {
    const notam = await db.notam.create({ data: payload as any })
    return NextResponse.json(notam)
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('notams')
    .insert({
      notam_number: payload.notamNumber,
      series: payload.series,
      qualifier: payload.qualifier,
      fir: payload.fir,
      aerodrome: payload.aerodrome,
      subject: payload.subject,
      condition: payload.condition,
      purpose: payload.purpose,
      scope: payload.scope,
      traffic: payload.traffic,
      text: payload.text,
      created_from_finding_id: payload.createdFromFindingId,
      created_from_inspection_id: payload.createdFromInspectionId,
      status: payload.status,
      valid_from: payload.validFrom,
      valid_to: payload.validTo,
      created_by: payload.createdBy,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}