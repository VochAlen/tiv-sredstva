import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const days = Number(searchParams.get('days') ?? 90)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  let findings: any[] = []

  if (isDemoMode()) {
    findings = await db.inspectionFinding.findMany({
      where: { latitude: { not: null }, longitude: { not: null }, createdAt: { gte: since } },
      select: {
        id: true,
        category: true,
        severity: true,
        description: true,
        latitude: true,
        longitude: true,
        status: true,
        createdAt: true,
      },
    })
  } else {
    const supabase = await createSupabaseClient()
    const { data } = await supabase
      .from('inspection_findings')
      .select('id, category, severity, description, latitude, longitude, status, created_at')
      .not('latitude', 'is', null)
      .gte('created_at', since.toISOString())
    findings = (data ?? []).map((f: any) => ({
      id: f.id,
      category: f.category,
      severity: f.severity,
      description: f.description,
      latitude: f.latitude,
      longitude: f.longitude,
      status: f.status,
      createdAt: f.created_at,
    }))
  }

  return NextResponse.json(findings)
}