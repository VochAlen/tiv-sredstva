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
import { isWeatherId } from '@/lib/weather-conditions'
import { ZONE_IDS, SPECIES_IDS, speciesById, speciesGroupOf, zoneById, zoneLabel, zoneAt, fromNorm, approxPoint } from '@/lib/airport-map'

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
  weather?: string // SUNNY | CLOUDY | RAIN | WIND | FOG | SNOW | ICE | STORM
  foundByCardId?: string
  foundByName: string
}) {
  // Javna funkcija — radnici prijavljuju FOD bez login-a (ADR.OPS.B.016(b)(1):
  // "personnel should be actively encouraged to identify and report...")

  const weather = isWeatherId(params.weather) ? params.weather : null

  if (isDemoMode()) {
    const report = await db.fodReport.create({
      data: {
        location: params.location, itemType: params.itemType, description: params.description, weather,
        aircraftPartSuspected: params.aircraftPartSuspected ?? false,
        removed: params.removed ?? false, atcNotified: params.atcNotified ?? false,
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
  const fodRow = {
    id,
    location: params.location, item_type: params.itemType, description: params.description,
    aircraft_part_suspected: params.aircraftPartSuspected ?? false,
    removed: params.removed ?? false, atc_notified: params.atcNotified ?? false,
    found_by_card_id: params.foundByCardId ?? null, found_by_name: params.foundByName,
  }
  let { error } = await supabase.from('fod_reports').insert({ ...fodRow, weather })
  // Migracija 031 još nije pokrenuta: prijava se ipak snima (bez vremenskih uslova)
  if (error && /weather/i.test(error.message ?? '')) ({ error } = await supabase.from('fod_reports').insert(fodRow))

  if (error) throw error
  revalidatePath('/dashboard')
  return { ok: true, id }
}

/** Označava da je FOD stvarno uklonjen (inženjer/admin). Upisuje ko i kada. */
export async function markFodRemoved(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole(['engineer', 'admin'])
  const now = new Date()
  if (isDemoMode()) {
    await db.fodReport.update({ where: { id }, data: { removed: true, removedAt: now, removedBy: user.full_name } })
  } else {
    const supabase = await createSupabaseClient()
    const { error } = await supabase
      .from('fod_reports')
      .update({ removed: true, removed_at: now.toISOString(), removed_by: user.full_name })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath('/dashboard')
  return { ok: true }
}

/** Admin uređuje FOD prijavu i određuje status obrade. */
export async function updateFodReport(
  id: string,
  patch: {
    location?: string
    itemType?: string
    description?: string
    aircraftPartSuspected?: boolean
    atcNotified?: boolean
    removed?: boolean
    status?: (typeof WILDLIFE_STATUSES)[number]
    adminNotes?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole(['admin'])
  if (patch.status && !WILDLIFE_STATUSES.includes(patch.status)) return { ok: false, error: 'Nepoznat status' }
  if (patch.location !== undefined && !patch.location.trim()) return { ok: false, error: 'Lokacija je obavezna' }
  if (patch.description !== undefined && !patch.description.trim()) return { ok: false, error: 'Opis je obavezan' }

  const notes = patch.adminNotes === undefined ? undefined : patch.adminNotes && patch.adminNotes.trim() ? patch.adminNotes.trim() : null
  const now = new Date()

  if (isDemoMode()) {
    const cur = await db.fodReport.findUnique({ where: { id } })
    if (!cur) return { ok: false, error: 'Prijava nije pronađena' }
    const removedChange = patch.removed !== undefined && patch.removed !== cur.removed
    await db.fodReport.update({
      where: { id },
      data: {
        ...(patch.location !== undefined && { location: patch.location.trim() }),
        ...(patch.itemType !== undefined && { itemType: patch.itemType }),
        ...(patch.description !== undefined && { description: patch.description.trim() }),
        ...(patch.aircraftPartSuspected !== undefined && { aircraftPartSuspected: patch.aircraftPartSuspected }),
        ...(patch.atcNotified !== undefined && { atcNotified: patch.atcNotified }),
        ...(patch.status !== undefined && { status: patch.status }),
        ...(notes !== undefined && { adminNotes: notes }),
        ...(removedChange && (patch.removed
          ? { removed: true, removedAt: now, removedBy: user.full_name }
          : { removed: false, removedAt: null, removedBy: null })),
        updatedBy: user.full_name,
      },
    })
  } else {
    const supabase = await createSupabaseClient()
    const row: Record<string, unknown> = { updated_by: user.full_name, updated_at: now.toISOString() }
    if (patch.location !== undefined) row.location = patch.location.trim()
    if (patch.itemType !== undefined) row.item_type = patch.itemType
    if (patch.description !== undefined) row.description = patch.description.trim()
    if (patch.aircraftPartSuspected !== undefined) row.aircraft_part_suspected = patch.aircraftPartSuspected
    if (patch.atcNotified !== undefined) row.atc_notified = patch.atcNotified
    if (patch.status !== undefined) row.status = patch.status
    if (notes !== undefined) row.admin_notes = notes
    if (patch.removed !== undefined) {
      const { data: cur } = await supabase.from('fod_reports').select('removed').eq('id', id).maybeSingle()
      if (!cur) return { ok: false, error: 'Prijava nije pronađena' }
      if (cur.removed !== patch.removed) {
        row.removed = patch.removed
        row.removed_at = patch.removed ? now.toISOString() : null
        row.removed_by = patch.removed ? user.full_name : null
      }
    }
    const { error } = await supabase.from('fod_reports').update(row).eq('id', id)
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath('/dashboard')
  return { ok: true }
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
    removedAt: f.removed_at ? new Date(f.removed_at) : null, removedBy: f.removed_by ?? null, weather: f.weather ?? null,
    status: f.status ?? 'NEW', adminNotes: f.admin_notes ?? null, updatedBy: f.updated_by ?? null,
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
  speciesCode?: string
  count?: number
  location?: string
  zone?: string // RWY_1 | RWY_2 | RWY_3 | TWY | APRON | SURROUNDING
  mapX?: number // 0..1 (tačka dodirnuta na mapi); bez nje se koristi samo zona
  mapY?: number
  strike?: boolean
  weather?: string // SUNNY | CLOUDY | RAIN | WIND | FOG | SNOW | ICE | STORM
  actionTaken?: string
  damageDescription?: string
  reportedByCardId?: string
  reportedByName: string
}) {
  // Javna funkcija — radnici prijavljuju opažanje/sudar bez login-a, zato se SVE validira ovdje

  const zone = params.zone && (ZONE_IDS as string[]).includes(params.zone) ? params.zone : null
  const speciesCode = params.speciesCode && SPECIES_IDS.includes(params.speciesCode) ? params.speciesCode : null
  const species = (params.species ?? '').trim().slice(0, 80) || (speciesCode && speciesCode !== 'OTHER' ? speciesById(speciesCode).label : '')
  if (!species) throw new Error('Vrsta je obavezna')
  const location = (params.location ?? '').trim().slice(0, 120) || (zone ? zoneLabel(zone) : '')
  if (!location) throw new Error('Lokacija je obavezna')
  const name = (params.reportedByName ?? '').trim().slice(0, 100)
  if (!name) throw new Error('Ime je obavezno')
  const count = Math.min(Math.max(Math.trunc(params.count ?? 1) || 1, 1), 9999)
  const inUnit = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? Math.round(v * 10000) / 10000 : null)
  const mapX = zone ? inUnit(params.mapX) : null
  const mapY = zone ? inUnit(params.mapY) : null
  const hasPoint = mapX !== null && mapY !== null
  const weather = isWeatherId(params.weather) ? params.weather : null

  if (isDemoMode()) {
    const report = await db.wildlifeReport.create({
      data: {
        species, speciesCode, count, location, zone, weather,
        mapX: hasPoint ? mapX : null, mapY: hasPoint ? mapY : null,
        strike: params.strike ?? false, actionTaken: params.actionTaken ?? null,
        damageDescription: params.damageDescription ?? null,
        reportedByCardId: params.reportedByCardId ?? null, reportedByName: name,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, id: report.id }
  }

  const supabase = await createSupabaseClient()
  const id = crypto.randomUUID()
  const legacy = {
    id,
    species, count, location,
    strike: params.strike ?? false, action_taken: params.actionTaken ?? null,
    damage_description: params.damageDescription ?? null,
    reported_by_card_id: params.reportedByCardId ?? null, reported_by_name: name,
  }
  let { error } = await supabase.from('wildlife_reports').insert({
    ...legacy, species_code: speciesCode, zone, weather,
    map_x: hasPoint ? mapX : null, map_y: hasPoint ? mapY : null,
  })
  // Migracije 030/031 još nisu pokrenute: prijava se ipak snima (bez mape/uslova), radnik ne smije ostati bez mogućnosti prijave
  if (error && /species_code|map_x|map_y|zone|weather/i.test(error.message ?? '')) {
    ;({ error } = await supabase.from('wildlife_reports').insert(legacy))
  }

  if (error) throw error
  revalidatePath('/dashboard')
  return { ok: true, id }
}

// Tačke za heatmapu (engineer+). Prijave bez tačke dobijaju mjesto unutar svoje zone; bez zone se broje kao "nepozicionirane".
export interface WildlifeMapPoint { id: string; x: number; y: number; count: number; strike: boolean; speciesId: string; zone: string; approx: boolean; observedAt: string }
export async function getWildlifeMapPoints(params?: { days?: number | null }): Promise<{ points: WildlifeMapPoint[]; unplaced: number }> {
  await requireRole(['engineer', 'admin'])
  const days = params?.days ?? null
  const since = days ? new Date(Date.now() - days * 86400000) : null

  type Raw = { id: string; species: string; speciesCode: string | null; count: number | null; strike: boolean | null; zone: string | null; mapX: number | null; mapY: number | null; observedAt: Date }
  let rows: Raw[] = []
  if (isDemoMode()) {
    const r = await db.wildlifeReport.findMany({
      where: since ? { observedAt: { gte: since } } : undefined,
      orderBy: { observedAt: 'desc' }, take: 5000,
    })
    rows = r.map((w) => ({ id: w.id, species: w.species, speciesCode: w.speciesCode, count: w.count, strike: w.strike, zone: w.zone, mapX: w.mapX, mapY: w.mapY, observedAt: w.observedAt }))
  } else {
    const supabase = await createSupabaseClient()
    for (let from = 0; from < 5000; from += 1000) {
      let q = supabase.from('wildlife_reports').select('id,species,species_code,count,strike,zone,map_x,map_y,observed_at').order('observed_at', { ascending: false }).range(from, from + 999)
      if (since) q = q.gte('observed_at', since.toISOString())
      const { data, error } = await q
      if (error) throw new Error(error.message)
      for (const w of data ?? []) {
        rows.push({ id: w.id, species: w.species, speciesCode: w.species_code ?? null, count: w.count, strike: w.strike, zone: w.zone ?? null, mapX: w.map_x === null ? null : Number(w.map_x), mapY: w.map_y === null ? null : Number(w.map_y), observedAt: new Date(w.observed_at) })
      }
      if (!data || data.length < 1000) break
    }
  }

  const points: WildlifeMapPoint[] = []
  let unplaced = 0
  for (const w of rows) {
    const sp = speciesGroupOf(w.speciesCode, w.species)
    const base = { id: w.id, count: Math.max(1, w.count ?? 1), strike: !!w.strike, speciesId: sp.id, observedAt: w.observedAt.toISOString() }
    if (w.mapX !== null && w.mapY !== null) {
      const { x, y } = fromNorm(w.mapX, w.mapY)
      points.push({ ...base, x, y, zone: w.zone ?? zoneAt(x, y), approx: false })
    } else if (w.zone && zoneById(w.zone)) {
      const { x, y } = approxPoint(w.id, w.zone)
      points.push({ ...base, x, y, zone: w.zone, approx: true })
    } else {
      unplaced++
    }
  }
  return { points, unplaced }
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
    id: w.id, species: w.species, speciesCode: w.species_code ?? null, zone: w.zone ?? null, weather: w.weather ?? null, count: w.count, location: w.location, strike: w.strike,
    actionTaken: w.action_taken, damageDescription: w.damage_description,
    status: w.status ?? 'NEW', adminNotes: w.admin_notes ?? null, updatedBy: w.updated_by ?? null,
    reportedByCardId: w.reported_by_card_id, reportedByName: w.reported_by_name,
    observedAt: new Date(w.observed_at), createdAt: new Date(w.created_at),
  }))
}

const WILDLIFE_STATUSES = ['NEW', 'IN_REVIEW', 'CLOSED'] as const

/** Admin uređuje prijavu opažanja/sudara i određuje status obrade. */
export async function updateWildlifeReport(
  id: string,
  patch: {
    species?: string
    count?: number
    location?: string
    strike?: boolean
    actionTaken?: string | null
    damageDescription?: string | null
    status?: (typeof WILDLIFE_STATUSES)[number]
    adminNotes?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole(['admin'])
  if (patch.status && !WILDLIFE_STATUSES.includes(patch.status)) return { ok: false, error: 'Nepoznat status' }
  if (patch.species !== undefined && !patch.species.trim()) return { ok: false, error: 'Vrsta je obavezna' }
  if (patch.location !== undefined && !patch.location.trim()) return { ok: false, error: 'Lokacija je obavezna' }
  if (patch.count !== undefined && (!Number.isInteger(patch.count) || patch.count < 1)) return { ok: false, error: 'Broj jedinki mora biti 1 ili više' }

  const norm = (v: string | null | undefined) => (v === undefined ? undefined : v && v.trim() ? v.trim() : null)

  if (isDemoMode()) {
    await db.wildlifeReport.update({
      where: { id },
      data: {
        ...(patch.species !== undefined && { species: patch.species.trim() }),
        ...(patch.count !== undefined && { count: patch.count }),
        ...(patch.location !== undefined && { location: patch.location.trim() }),
        ...(patch.strike !== undefined && { strike: patch.strike }),
        ...(patch.actionTaken !== undefined && { actionTaken: norm(patch.actionTaken) }),
        ...(patch.damageDescription !== undefined && { damageDescription: norm(patch.damageDescription) }),
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.adminNotes !== undefined && { adminNotes: norm(patch.adminNotes) }),
        updatedBy: user.full_name,
      },
    })
  } else {
    const row: Record<string, unknown> = { updated_by: user.full_name, updated_at: new Date().toISOString() }
    if (patch.species !== undefined) row.species = patch.species.trim()
    if (patch.count !== undefined) row.count = patch.count
    if (patch.location !== undefined) row.location = patch.location.trim()
    if (patch.strike !== undefined) row.strike = patch.strike
    if (patch.actionTaken !== undefined) row.action_taken = norm(patch.actionTaken)
    if (patch.damageDescription !== undefined) row.damage_description = norm(patch.damageDescription)
    if (patch.status !== undefined) row.status = patch.status
    if (patch.adminNotes !== undefined) row.admin_notes = norm(patch.adminNotes)
    const supabase = await createSupabaseClient()
    const { error } = await supabase.from('wildlife_reports').update(row).eq('id', id)
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath('/dashboard')
  return { ok: true }
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
