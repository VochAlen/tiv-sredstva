// Dnevni servisni digest šefu tehničke službe: sredstva čiji je servis dospio ili uskoro dospijeva.
// Isto stanje se ne šalje svaki dan (service_notified_status); dospjela se ponavljaju ponedjeljkom.
import { NextRequest, NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import { loadPlanRows } from '@/lib/service-plan-data'
import { fmtDateBHS } from '@/lib/service-plan'
import { localDate } from '@/lib/local-day'
import { providerBlock, sendServiceDigest } from '@/lib/service-notify'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  if (!isDemoMode() && !hasServiceClient()) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY nije postavljen' }, { status: 503 })
  }

  const sb = isDemoMode() ? null : createServiceClient()
  let rows
  try { rows = await loadPlanRows(sb) } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Greška' }, { status: 500 })
  }

  const today = localDate(new Date())
  const monday = new Date(`${today}T12:00:00Z`).getUTCDay() === 1
  const due = rows.filter((r) => {
    const s = r.result.status
    if (s !== 'OVERDUE' && s !== 'SOON') return false
    return r.notifiedStatus !== s || (s === 'OVERDUE' && monday)
  })
  const noBaseline = rows.filter((r) => r.result.status === 'NO_BASELINE').length
  if (!due.length) return NextResponse.json({ ok: true, sent: false, due: 0, noBaseline })

  const overdue = due.filter((r) => r.result.status === 'OVERDUE')
  const soon = due.filter((r) => r.result.status === 'SOON')
  const lines: string[] = []
  const block = (title: string, list: typeof due) => {
    if (!list.length) return
    lines.push(title, '')
    for (const r of list) {
      lines.push(`• ${r.code} — ${r.name}: ${r.result.summary}${r.result.plannedDate ? ` (planirano oko ${fmtDateBHS(r.result.plannedDate)})` : ''}`)
      if (r.external) lines.push(...providerBlock({ provider: r.provider, phone: r.phone, email: r.email }).map((l) => `    ${l}`))
      else lines.push('    Interno održavanje')
    }
    lines.push('')
  }
  block(`DOSPJELI SERVISI (${overdue.length})`, overdue)
  block(`USKORO (${soon.length})`, soon)
  if (noBaseline) lines.push(`Napomena: ${noBaseline} sredstava nema upisan zadnji servis (Servisni plan > Plan).`)

  const res = await sendServiceDigest(
    `[GSE] Servisni plan: ${overdue.length} dospjelo, ${soon.length} uskoro`,
    'Servisni plan — potrebna akcija',
    lines,
  )
  if (!res.ok) return NextResponse.json({ ok: false, sent: false, error: res.error, due: due.length }, { status: 200 })

  const now = new Date()
  for (const r of due) {
    if (isDemoMode()) await db.equipment.update({ where: { id: r.id }, data: { serviceNotifiedStatus: r.result.status, serviceNotifiedAt: now } })
    else await sb!.from('equipment').update({ service_notified_status: r.result.status, service_notified_at: now.toISOString() }).eq('id', r.id)
  }
  return NextResponse.json({ ok: true, sent: true, overdue: overdue.length, soon: soon.length, noBaseline })
}
