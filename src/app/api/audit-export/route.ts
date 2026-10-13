// CSV izvoz traga izmjena (audit_log) — samo admin. ?from=YYYY-MM-DD&to=YYYY-MM-DD
import { NextRequest, NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const esc = (v: unknown) => {
  let s = v == null ? '' : String(v)
  // zaštita od CSV/formula injekcije pri otvaranju u Excelu
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return new NextResponse('Forbidden', { status: 403 })

  const p = request.nextUrl.searchParams
  const valid = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
  const from = valid(p.get('from'))
  const to = valid(p.get('to'))
  const fromIso = from ? `${from}T00:00:00.000Z` : null
  const toIso = to ? `${to}T23:59:59.999Z` : null

  let rows: any[] = []
  if (isDemoMode()) {
    rows = (await db.auditLog.findMany({
      where: { createdAt: { ...(fromIso ? { gte: new Date(fromIso) } : {}), ...(toIso ? { lte: new Date(toIso) } : {}) } },
      orderBy: { createdAt: 'asc' },
      take: 50000,
    })).map((a) => ({ at: a.createdAt.toISOString(), email: a.userEmail, role: a.userRole, action: a.action, type: a.entityType, id: a.entityId, details: a.details }))
  } else {
    const supabase = await createSupabaseClient()
    let q = supabase.from('audit_log').select('*').order('created_at', { ascending: true }).limit(50000)
    if (fromIso) q = q.gte('created_at', fromIso)
    if (toIso) q = q.lte('created_at', toIso)
    const { data, error } = await q
    if (error) return new NextResponse(error.message, { status: 500 })
    rows = (data ?? []).map((a: any) => ({ at: a.created_at, email: a.user_email, role: a.user_role, action: a.action, type: a.entity_type, id: a.entity_id, details: a.details }))
  }

  const header = ['Vrijeme (UTC)', 'Korisnik', 'Rola', 'Radnja', 'Tip', 'ID', 'Detalji']
  const csv = '﻿' + [header, ...rows.map((r) => [r.at, r.email, r.role, r.action, r.type, r.id, r.details])]
    .map((line) => line.map(esc).join(',')).join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-trail-${from ?? 'start'}_${to ?? 'danas'}.csv"`,
    },
  })
}
