'use server'

// =====================================================
// Kandidati za zamjenu opreme ("procurement planning")
//
// Rangira flotu po signalima koji VEĆ postoje u bazi - bez ikakvog
// novog unosa podataka: učestalost kvarova (DamageReport u zadnjih
// 12mj), odnos radnih sati naspram intervala održavanja, procijenjeno
// vrijeme van stroja (iz trajanja otvorenih/riješenih prijava), i
// starost sredstva (modelYear/purchaseDate - polja već postoje u
// schema.prisma, samo možda nisu popunjena za sve jedinice).
//
// Score je transparentan i rastavljen na komponente (ne crna kutija),
// jer odluka o nabavci mora biti objašnjiva - bitno i za EASA/CAA
// revizioni trag.
// =====================================================

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'

async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  return user
}

export interface ReplacementCandidate {
  id: string
  code: string
  name: string
  type: string
  status: string
  manufacturer: string | null
  modelYear: number | null
  purchaseDate: Date | null
  ageYears: number | null

  faultCount12m: number
  downtimeDays12m: number
  maintenanceCost12m: number
  maintenanceCount12m: number
  hoursRatio: number | null // totalOperatingHours / maintenanceIntervalHours
  kmRatio: number | null // totalKm / maintenanceIntervalKm

  score: number
  tier: 'PRIORITY' | 'WATCH' | 'OK'
}

const TIER_CUTOFF_PRIORITY = 55
const TIER_CUTOFF_WATCH = 30

function computeScore(input: {
  faultCount12m: number
  downtimeDays12m: number
  hoursRatio: number | null
  kmRatio: number | null
  ageYears: number | null
}): { score: number; tier: 'PRIORITY' | 'WATCH' | 'OK' } {
  const faultScore = Math.min(40, input.faultCount12m * 8)
  const downtimeScore = Math.min(25, input.downtimeDays12m * 1.5)
  const serviceRatio = Math.max(input.hoursRatio ?? 0, input.kmRatio ?? 0)
  const serviceScore = Math.min(20, serviceRatio * 10)
  const ageScore = input.ageYears != null ? Math.min(15, Math.max(0, input.ageYears - 3) * 1.5) : 0

  const score = Math.round(faultScore + downtimeScore + serviceScore + ageScore)
  const tier: 'PRIORITY' | 'WATCH' | 'OK' =
    score >= TIER_CUTOFF_PRIORITY ? 'PRIORITY' : score >= TIER_CUTOFF_WATCH ? 'WATCH' : 'OK'

  return { score, tier }
}

export async function getReplacementCandidates(): Promise<ReplacementCandidate[]> {
  await requireAuth()

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 12)
  const now = new Date()

  if (isDemoMode()) {
    const equipment = await db.equipment.findMany({
      include: {
        damages: { where: { createdAt: { gte: cutoff } } },
        maintenanceLogs: { where: { performedAt: { gte: cutoff } } },
      },
    })

    return equipment
      .map((eq) => {
        const faultCount12m = eq.damages.length
        const downtimeDays12m = eq.damages.reduce((sum, d) => {
          const end = d.resolvedAt ?? now
          const days = (end.getTime() - d.createdAt.getTime()) / 86400000
          return sum + Math.max(0, days)
        }, 0)
        const maintenanceCost12m = eq.maintenanceLogs.reduce((sum, m) => sum + (m.cost ?? 0), 0)
        const maintenanceCount12m = eq.maintenanceLogs.length

        const hoursRatio = eq.maintenanceIntervalHours > 0 ? eq.totalOperatingHours / eq.maintenanceIntervalHours : null
        const kmRatio = eq.maintenanceIntervalKm > 0 ? eq.totalKm / eq.maintenanceIntervalKm : null
        const ageYears = eq.modelYear ? now.getFullYear() - eq.modelYear : null

        const { score, tier } = computeScore({ faultCount12m, downtimeDays12m, hoursRatio, kmRatio, ageYears })

        return {
          id: eq.id,
          code: eq.code,
          name: eq.name,
          type: eq.type,
          status: eq.status,
          manufacturer: eq.manufacturer,
          modelYear: eq.modelYear,
          purchaseDate: eq.purchaseDate,
          ageYears,
          faultCount12m,
          downtimeDays12m: Math.round(downtimeDays12m * 10) / 10,
          maintenanceCost12m: Math.round(maintenanceCost12m * 100) / 100,
          maintenanceCount12m,
          hoursRatio: hoursRatio != null ? Math.round(hoursRatio * 100) / 100 : null,
          kmRatio: kmRatio != null ? Math.round(kmRatio * 100) / 100 : null,
          score,
          tier,
        } satisfies ReplacementCandidate
      })
      .sort((a, b) => b.score - a.score)
  }

  // Supabase
  const supabase = await createSupabaseClient()

  const [{ data: equipmentRows }, { data: damageRows }, { data: maintenanceRows }] = await Promise.all([
    supabase.from('equipment').select('*'),
    supabase.from('damage_reports').select('equipment_id, created_at, resolved_at').gte('created_at', cutoff.toISOString()),
    supabase.from('maintenance_logs').select('equipment_id, cost, performed_at').gte('performed_at', cutoff.toISOString()),
  ])

  const damagesByEq = new Map<string, { createdAt: Date; resolvedAt: Date | null }[]>()
  for (const d of damageRows ?? []) {
    const list = damagesByEq.get(d.equipment_id) ?? []
    list.push({ createdAt: new Date(d.created_at), resolvedAt: d.resolved_at ? new Date(d.resolved_at) : null })
    damagesByEq.set(d.equipment_id, list)
  }

  const maintenanceByEq = new Map<string, { cost: number }[]>()
  for (const m of maintenanceRows ?? []) {
    const list = maintenanceByEq.get(m.equipment_id) ?? []
    list.push({ cost: m.cost ?? 0 })
    maintenanceByEq.set(m.equipment_id, list)
  }

  return (equipmentRows ?? [])
    .map((eq: any) => {
      const damages = damagesByEq.get(eq.id) ?? []
      const maintenance = maintenanceByEq.get(eq.id) ?? []

      const faultCount12m = damages.length
      const downtimeDays12m = damages.reduce((sum, d) => {
        const end = d.resolvedAt ?? now
        const days = (end.getTime() - d.createdAt.getTime()) / 86400000
        return sum + Math.max(0, days)
      }, 0)
      const maintenanceCost12m = maintenance.reduce((sum, m) => sum + m.cost, 0)
      const maintenanceCount12m = maintenance.length

      const maintenanceIntervalHours = eq.maintenance_interval_hours ?? 0
      const maintenanceIntervalKm = eq.maintenance_interval_km ?? 0
      const hoursRatio = maintenanceIntervalHours > 0 ? (eq.total_operating_hours ?? 0) / maintenanceIntervalHours : null
      const kmRatio = maintenanceIntervalKm > 0 ? (eq.total_km ?? 0) / maintenanceIntervalKm : null
      const ageYears = eq.model_year ? now.getFullYear() - eq.model_year : null

      const { score, tier } = computeScore({ faultCount12m, downtimeDays12m, hoursRatio, kmRatio, ageYears })

      return {
        id: eq.id,
        code: eq.code,
        name: eq.name,
        type: eq.type,
        status: eq.status,
        manufacturer: eq.manufacturer,
        modelYear: eq.model_year,
        purchaseDate: eq.purchase_date ? new Date(eq.purchase_date) : null,
        ageYears,
        faultCount12m,
        downtimeDays12m: Math.round(downtimeDays12m * 10) / 10,
        maintenanceCost12m: Math.round(maintenanceCost12m * 100) / 100,
        maintenanceCount12m,
        hoursRatio: hoursRatio != null ? Math.round(hoursRatio * 100) / 100 : null,
        kmRatio: kmRatio != null ? Math.round(kmRatio * 100) / 100 : null,
        score,
        tier,
      } satisfies ReplacementCandidate
    })
    .sort((a: ReplacementCandidate, b: ReplacementCandidate) => b.score - a.score)
}
