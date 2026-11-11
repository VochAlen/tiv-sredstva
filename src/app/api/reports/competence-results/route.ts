// src/app/api/reports/competence-results/route.ts
// CSV izvoz rezultata testova (iste pretrage i filteri kao tabela). engineer i admin.
// Separator ";" i UTF-8 BOM, da se u Excelu (BHS regionalne postavke) otvori ispravno.

import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { hasServiceClient } from '@/lib/supabase/service'
import { localDate } from '@/lib/competence-server'
import { queryResults, resultsToCsv, type ResultFilters, type ResultRow } from '@/lib/competence-results'

export const dynamic = 'force-dynamic'
const MAX_ROWS = 10_000

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  if (user.role !== 'admin' && user.role !== 'engineer') return new NextResponse('Forbidden', { status: 403 })
  if (isDemoMode() || !hasServiceClient()) return new NextResponse('Dostupno samo uz Supabase bazu', { status: 503 })

  const sp = req.nextUrl.searchParams
  const base: ResultFilters = {
    q: sp.get('q') ?? '', department: sp.get('department') ?? '', from: sp.get('from') ?? undefined, to: sp.get('to') ?? undefined,
    outcome: (sp.get('outcome') as ResultFilters['outcome']) ?? 'ALL', kind: sp.get('kind') ?? undefined,
    sort: (sp.get('sort') as ResultFilters['sort']) ?? 'taken_at', dir: sp.get('dir') === 'asc' ? 'asc' : 'desc',
  }
  const rows: ResultRow[] = []
  try {
    for (let page = 1; rows.length < MAX_ROWS; page++) {
      const r = await queryResults({ ...base, page, pageSize: 1000 })
      rows.push(...r.rows)
      if (rows.length >= r.total || r.rows.length === 0) break
    }
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : 'Greška', { status: 500 })
  }
  return new NextResponse(resultsToCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rezultati-testova-${localDate()}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
