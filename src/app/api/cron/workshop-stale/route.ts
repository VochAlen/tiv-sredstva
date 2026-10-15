// Dnevna provjera: sredstva u radionici bez promjene statusa 3, 6, 9... dana -> mail šefu tehničke službe.
// Isto upozorenje se vidi i u aplikaciji ("Moj zadatak" + crveno dugme na kartici); unos statusa ga gasi na 3 dana.
import { NextRequest, NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import { staleInfo, fmtDT, STALE_DAYS } from '@/lib/workshop'
import { sendServiceDigest } from '@/lib/service-notify'

export const dynamic = 'force-dynamic'

interface Row { code: string; name: string; status: string; ack: string | null; arrived: string | null; lastAt: string | null; lastText: string | null; dept: string | null }

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse('Unauthorized', { status: 401 })
  if (!isDemoMode() && !hasServiceClient()) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY nije postavljen' }, { status: 503 })

  let rows: Row[] = []
  try {
    if (isDemoMode()) {
      const r = await db.damageReport.findMany({ where: { status: { in: ['IN_REPAIR', 'AWAITING_APPROVAL'] } }, include: { equipment: { select: { department: true } } } })
      rows = r.map((x) => ({ code: x.equipmentCode, name: x.equipmentName, status: x.status, ack: x.acknowledgedAt?.toISOString() ?? null, arrived: x.workshopArrivedAt?.toISOString() ?? null, lastAt: x.lastStatusAt?.toISOString() ?? null, lastText: x.lastStatusText, dept: x.equipment?.department ?? null }))
    } else {
      const { data, error } = await createServiceClient().from('damage_reports')
        .select('equipment_code, equipment_name, status, acknowledged_at, workshop_arrived_at, last_status_at, last_status_text, equipment:equipment(department)')
        .in('status', ['IN_REPAIR', 'AWAITING_APPROVAL'])
      if (error) throw new Error(`${error.message} (pokrenuti migraciju 035?)`)
      rows = (data ?? []).map((x: any) => ({ code: x.equipment_code, name: x.equipment_name, status: x.status, ack: x.acknowledged_at, arrived: x.workshop_arrived_at, lastAt: x.last_status_at, lastText: x.last_status_text, dept: x.equipment?.department ?? null }))
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Greška' }, { status: 500 })
  }

  const now = new Date()
  const due = rows
    .map((r) => ({ r, s: staleInfo({ status: r.status, acknowledgedAt: r.ack, workshopArrivedAt: r.arrived, lastStatusAt: r.lastAt }, now) }))
    .filter((x) => x.s.due && x.s.days % STALE_DAYS === 0) // 3., 6., 9. ... dan
  if (!due.length) return NextResponse.json({ ok: true, sent: false, due: 0 })

  const lines = [`Sredstva bez popravke / promjene statusa ${STALE_DAYS}+ dana (${due.length}):`, '']
  for (const { r, s } of due) {
    lines.push(`• ${r.code} — ${r.name}${r.dept ? ` [${r.dept}]` : ''}: ${s.days} dana bez promjene (od ${fmtDT(s.since)})`)
    lines.push(`    Zadnji status: ${r.lastText ?? 'nije upisan'}`)
  }
  lines.push('', 'Radionica mora potvrditi upozorenje i upisati novi status (npr. "Čekaju se rezervni dijelovi") u aplikaciji.')
  const res = await sendServiceDigest(`[GSE] Radionica: ${due.length} sredstava bez statusa ${STALE_DAYS}+ dana`, 'Radionica — sredstva bez statusa', lines)
  return NextResponse.json({ ok: true, sent: res.ok, due: due.length, error: res.error })
}
