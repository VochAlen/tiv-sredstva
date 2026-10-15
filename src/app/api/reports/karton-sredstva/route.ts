// src/app/api/reports/karton-sredstva/route.ts
//
// KARTON SREDSTVA - kompletna evidencija jednog sredstva za inspekciju / audit (crtanje je u lib/pdf-equipment-record.ts).
// Jednostranični "karton ispravnosti" za zadnjih 30 dana je zaseban izvještaj: gse-equipment-card.

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-server'
import { getEquipmentRecord } from '@/lib/actions-equipment-record'
import { buildEquipmentRecordPdf } from '@/lib/pdf-equipment-record'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  if (user.role !== 'engineer' && user.role !== 'admin') return new NextResponse('Forbidden', { status: 403 })
  const code = (new URL(request.url).searchParams.get('code') ?? '').trim()
  if (!code) return new NextResponse('Missing code', { status: 400 })
  const rec = await getEquipmentRecord(code)
  if (!rec) return new NextResponse('Equipment not found', { status: 404 })
  const bytes = await buildEquipmentRecordPdf(rec, user.full_name || user.email)
  return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="karton-sredstva-${rec.equipment.code}.pdf"`, 'Cache-Control': 'no-store' },
  })
}
