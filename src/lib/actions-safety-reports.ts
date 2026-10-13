'use server'

// =====================================================
// EASA ADR — nove funkcije (martovska 2026 revizija EAR za aerodrome):
//  - ADR.OPS.B.016 Foreign object debris (FOD) kontrolni program
//  - ADR.OPS.B.020 Wildlife strike hazard reduction
//  - ADR.OR.C.045  Fitness for duty (potvrda, bez zdravstvenih podataka)
// =====================================================

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function requireRole(roles: Array<'operator' | 'engineer' | 'admin'>): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  if (!roles.includes(user.role)) throw new Error(`Nemate dozvolu. Potrebna rola: ${roles.join(' ili ')}`)
  return user
}

// =====================================================
// FOD — ADR.OPS.B.016
// =====================================================

export async function createFodReport(params: {
  location: string
  itemType: string
  description: string
  aircraftPartSuspected?: boolean
  removed?: boolean
  atcNotified?: boolean
  foundByCardId?: string
  foundByName: string
}) {
  // Javna funkcija — radnici prijavljuju FOD bez login-a (ADR.OPS.B.016(b)(1):
  // "personnel should be actively encouraged to identify and report...")

  if (isDemoMode()) {
    const report = await db.fodReport.create({
      data: {
        location: params.location, itemType: params.itemType, description: params.description,
        aircraftPartSuspected: params.aircraftPartSuspected ?? false,
        removed: params.removed ?? true, atcNotified: params.atcNotified ?? false,
        foundByCardId: params.foundByCardId ?? null, foundByName: params.foundByName,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, id: report.id }
  }

  const supabase = await createSupabaseClient()
  // ID se generiše unaprijed (umjesto .select().single() čitanja nazad) jer je
  // SELECT na fod_reports ograničen na engineer+, a INSERT je namjerno javan.
  const id = crypto.randomUUID()
  const { error } = await supabase.from('fod_reports').insert({
    id,
    location: params.location, item_type: params.itemType, description: params.description,
    aircraft_part_suspected: params.aircraftPartSuspected ?? false,
    removed: params.removed ?? true, atc_notified: params.atcNotified ?? false,
    found_by_card_id: params.foundByCardId ?? null, found_by_name: params.foundByName,
  })

  if (error) throw error
  revalidatePath('/dashboard')
  return { ok: true, id }
}

export async function getFodReports(params?: { limit?: number }) {
  await requireRole(['engineer', 'admin'])
  const limit = params?.limit ?? 100

  if (isDemoMode()) {
    return db.fodReport.findMany({ orderBy: { foundAt: 'desc' }, take: limit })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('fod_reports').select('*').order('found_at', { ascending: false }).limit(limit)
  return (data ?? []).map((f: any) => ({
    id: f.id, location: f.location, itemType: f.item_type, description: f.description,
    aircraftPartSuspected: f.aircraft_part_suspected, removed: f.removed, atcNotified: f.atc_notified,
    foundByCardId: f.found_by_card_id, foundByName: f.found_by_name,
    foundAt: new Date(f.found_at), createdAt: new Date(f.created_at),
  }))
}

export async function getFodStats() {
  await requireRole(['engineer', 'admin'])
  const since = new Date(); since.setMonth(since.getMonth() - 12)

  if (isDemoMode()) {
    const [total, last12m, byLocationRaw] = await Promise.all([
      db.fodReport.count(),
      db.fodReport.count({ where: { foundAt: { gte: since } } }),
      db.fodReport.groupBy({ by: ['location'], _count: { location: true } }),
    ])
    const byLocation = byLocationRaw
      .map((r) => ({ location: r.location, count: r._count.location }))
      .sort((a, b) => b.count - a.count).slice(0, 5)
    return { total, last12m, byLocation }
  }

  const supabase = await createSupabaseClient()
  const [{ count: total }, { data: recent }] = await Promise.all([
    supabase.from('fod_reports').select('*', { count: 'exact', head: true }),
    supabase.from('fod_reports').select('location, found_at').gte('found_at', since.toISOString()),
  ])
  const byLocMap = new Map<string, number>()
  for (const r of recent ?? []) byLocMap.set(r.location, (byLocMap.get(r.location) ?? 0) + 1)
  const byLocation = Array.from(byLocMap.entries()).map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count).slice(0, 5)
  return { total: total ?? 0, last12m: (recent ?? []).length, byLocation }
}

// =====================================================
// WILDLIFE — ADR.OPS.B.020
// =====================================================

export async function createWildlifeReport(params: {
  species: string
  count?: number
  location: string
  strike?: boolean
  actionTaken?: string
  damageDescription?: string
  reportedByCardId?: string
  reportedByName: string
}) {
  // Javna funkcija — radnici prijavljuju opažanje/sudar bez login-a

  if (isDemoMode()) {
    const report = await db.wildlifeReport.create({
      data: {
        species: params.species, count: params.count ?? 1, location: params.location,
        strike: params.strike ?? false, actionTaken: params.actionTaken ?? null,
        damageDescription: params.damageDescription ?? null,
        reportedByCardId: params.reportedByCardId ?? null, reportedByName: params.reportedByName,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, id: report.id }
  }

  const supabase = await createSupabaseClient()
  const id = crypto.randomUUID()
  const { error } = await supabase.from('wildlife_reports').insert({
    id,
    species: params.species, count: params.count ?? 1, location: params.location,
    strike: params.strike ?? false, action_taken: params.actionTaken ?? null,
    damage_description: params.damageDescription ?? null,
    reported_by_card_id: params.reportedByCardId ?? null, reported_by_name: params.reportedByName,
  })

  if (error) throw error
  revalidatePath('/dashboard')
  return { ok: true, id }
}

export async function getWildlifeReports(params?: { limit?: number }) {
  await requireRole(['engineer', 'admin'])
  const limit = params?.limit ?? 100

  if (isDemoMode()) {
    return db.wildlifeReport.findMany({ orderBy: { observedAt: 'desc' }, take: limit })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('wildlife_reports').select('*').order('observed_at', { ascending: false }).limit(limit)
  return (data ?? []).map((w: any) => ({
    id: w.id, species: w.species, count: w.count, location: w.location, strike: w.strike,
    actionTaken: w.action_taken, damageDescription: w.damage_description,
    reportedByCardId: w.reported_by_card_id, reportedByName: w.reported_by_name,
    observedAt: new Date(w.observed_at), createdAt: new Date(w.created_at),
  }))
}

export async function getWildlifeStats() {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    const [total, strikes] = await Promise.all([
      db.wildlifeReport.count(),
      db.wildlifeReport.count({ where: { strike: true } }),
    ])
    return { total, strikes }
  }

  const supabase = await createSupabaseClient()
  const [{ count: total }, { count: strikes }] = await Promise.all([
    supabase.from('wildlife_reports').select('*', { count: 'exact', head: true }),
    supabase.from('wildlife_reports').select('*', { count: 'exact', head: true }).eq('strike', true),
  ])
  return { total: total ?? 0, strikes: strikes ?? 0 }
}

// =====================================================
// FITNESS FOR DUTY — ADR.OR.C.045
// Bilježi se SAMO potvrda (da/ne) i vrijeme - nikad zdravstveni podatak.
// =====================================================

export async function recordFitnessDeclaration(params: {
  employeeCardId?: string
  employeeName: string
  confirmed: boolean
}) {
  // Javna funkcija — dio istog bezlogin worker toka kao zaduženje/razduženje.
  // Best-effort: greška ovdje ne smije prekinuti glavni tok zaduženja.
  try {
    if (isDemoMode()) {
      await db.fitnessDeclaration.create({
        data: {
          employeeCardId: params.employeeCardId ?? null,
          employeeName: params.employeeName,
          confirmed: params.confirmed,
        },
      })
      return { ok: true }
    }

    const supabase = await createSupabaseClient()
    await supabase.from('fitness_declarations').insert({
      employee_card_id: params.employeeCardId ?? null,
      employee_name: params.employeeName,
      confirmed: params.confirmed,
    })
    return { ok: true }
  } catch (e) {
    console.error('Fitness declaration log failed:', e)
    return { ok: false }
  }
}

export async function getFitnessDeclarations(params?: { limit?: number }) {
  await requireRole(['engineer', 'admin'])
  const limit = params?.limit ?? 100

  if (isDemoMode()) {
    return db.fitnessDeclaration.findMany({ orderBy: { declaredAt: 'desc' }, take: limit })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('fitness_declarations').select('*').order('declared_at', { ascending: false }).limit(limit)
  return (data ?? []).map((f: any) => ({
    id: f.id, employeeCardId: f.employee_card_id, employeeName: f.employee_name,
    confirmed: f.confirmed, declaredAt: new Date(f.declared_at),
  }))
}
