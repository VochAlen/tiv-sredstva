// src/app/api/reports/zastoji/route.ts
//
// Mjesečni izvještaj o zastojima sredstava (A4, jedna strana). Crtanje je u lib/pdf-downtime.ts.

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-server'
import { loadDowntimeInputs } from '@/lib/actions-workshop-extras'
import { computeDowntime, isMonth } from '@/lib/downtime'
import { localDate } from '@/lib/local-day'
import { buildDowntimePdf } from '@/lib/pdf-downtime'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  if (user.role !== 'engineer' && user.role !== 'admin') return new NextResponse('Forbidden', { status: 403 })
  const q = new URL(request.url).searchParams.get('month')
  const month = isMonth(q) ? q : localDate(new Date()).slice(0, 7)
  const { rows, fleetSize } = await loadDowntimeInputs(month)
  const bytes = await buildDowntimePdf(computeDowntime(rows, month, fleetSize), user.full_name || user.email)
  return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="zastoji-${month}.pdf"`, 'Cache-Control': 'no-store' },
  })
}
