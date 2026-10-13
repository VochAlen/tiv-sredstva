// src/app/api/cron/inspection-overdue/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import { sendWebhookNotification } from '@/lib/webhook-notify'

// Raspored je u vercel.json.
// (07:00 UTC — prilagoditi vremenu prve smjene / prvog pokreta na LYTV, uzevsi u obzir DST)

const REQUIRED_TYPES = ['RUNWAY', 'TAXIWAY', 'APRON']

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  if (!isDemoMode() && !hasServiceClient()) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY nije postavljen' }, { status: 503 })
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  let doneTypes: string[] = []

  if (isDemoMode()) {
    const todaysInspections = await db.aerodromeInspection.findMany({
      where: { inspectionDate: { gte: todayStart } },
      select: { inspectionType: true },
    })
    doneTypes = todaysInspections.map((i) => i.inspectionType)
  } else {
    // cron nema korisničku sesiju → service-role
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('aerodrome_inspections')
      .select('inspection_type')
      .gte('inspection_date', todayStart.toISOString())
    doneTypes = (data ?? []).map((i: any) => i.inspection_type)
  }

  const missing = REQUIRED_TYPES.filter((t) => !doneTypes.includes(t))

  if (missing.length > 0) {
    await sendWebhookNotification(
      'triggerInspectionOverdue',
      `GSE Control — dnevna inspekcija aerodroma (LYTV) jos nije zavrsena za: ${missing.join(', ')}. Rok po ADR.OPS.B.015.`,
      { missing }
    )
  }

  return NextResponse.json({ checked: REQUIRED_TYPES, missing })
}