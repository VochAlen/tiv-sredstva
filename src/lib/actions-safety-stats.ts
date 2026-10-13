'use server'

// Statistika FOD & Wildlife prijava (SAMO admin): mjesec / 3 mjeseca / pola godine / godina,
// po vrsti prijave, vrsti životinje, vremenskim uslovima, zoni i mjesečnom trendu.
// Prozor je "klizni": zadnjih N mjeseci do danas (lokalno vrijeme aerodroma), uz poređenje s prethodnim istim periodom.

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { localDate } from '@/lib/local-day'
import { FOD_ITEM_TYPE_LABELS } from '@/lib/constants-export'
import { SPECIES, ZONES, speciesGroupOf, zoneAt, fromNorm } from '@/lib/airport-map'
import { WEATHER, UNKNOWN_WEATHER } from '@/lib/weather-conditions'
import { PERIOD_MONTHS, PERIOD_LABEL, isStatsPeriod, type StatsPeriod } from '@/lib/safety-stats-shared'


export interface CountRow { id: string; label: string; color: string; count: number }
export interface SafetyStats {
  period: StatsPeriod
  label: string
  from: string // YYYY-MM-DD (lokalno)
  to: string
  totals: { all: number; fod: number; wildlife: number; strikes: number; animals: number }
  previous: { all: number; fod: number; wildlife: number; strikes: number }
  byType: CountRow[] // FOD / Wildlife opažanja / Wildlife sudari
  fodItems: CountRow[] // FOD po vrsti predmeta
  species: Array<CountRow & { animals: number; strikes: number }> // wildlife po vrsti životinje
  weather: Array<{ id: string; label: string; color: string; fod: number; wildlife: number; strikes: number; total: number }>
  zones: CountRow[] // wildlife po zonama aerodroma
  trend: Array<{ month: string; fod: number; wildlife: number; strikes: number }>
}

async function requireAdmin(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  if (user.role !== 'admin') throw new Error('Nemate dozvolu. Potrebna rola: admin')
  return user
}

type FodRow = { at: Date; itemType: string; weather: string | null }
type WildRow = { at: Date; species: string; speciesCode: string | null; count: number; strike: boolean; zone: string | null; mapX: number | null; mapY: number | null; weather: string | null }

const shiftMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() - n); return x }
const monthKey = (d: Date) => localDate(d).slice(0, 7)

async function loadRows(since: Date): Promise<{ fod: FodRow[]; wild: WildRow[] }> {
  if (isDemoMode()) {
    const [f, w] = await Promise.all([
      db.fodReport.findMany({ where: { foundAt: { gte: since } }, take: 20000 }),
      db.wildlifeReport.findMany({ where: { observedAt: { gte: since } }, take: 20000 }),
    ])
    return {
      fod: f.map((r) => ({ at: r.foundAt, itemType: r.itemType, weather: r.weather })),
      wild: w.map((r) => ({ at: r.observedAt, species: r.species, speciesCode: r.speciesCode, count: r.count, strike: r.strike, zone: r.zone, mapX: r.mapX, mapY: r.mapY, weather: r.weather })),
    }
  }
  const supabase = await createSupabaseClient()
  const fod: FodRow[] = []
  const wild: WildRow[] = []
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabase.from('fod_reports').select('found_at,item_type,weather').gte('found_at', since.toISOString()).order('found_at').range(from, from + 999)
    if (error) {
      // 031 još nije pokrenuta: bez kolone weather
      if (/weather/i.test(error.message)) {
        const r = await supabase.from('fod_reports').select('found_at,item_type').gte('found_at', since.toISOString()).order('found_at').range(from, from + 999)
        if (r.error) throw new Error(r.error.message)
        for (const x of r.data ?? []) fod.push({ at: new Date(x.found_at), itemType: x.item_type, weather: null })
        if (!r.data || r.data.length < 1000) break
        continue
      }
      throw new Error(error.message)
    }
    for (const x of data ?? []) fod.push({ at: new Date(x.found_at), itemType: x.item_type, weather: x.weather ?? null })
    if (!data || data.length < 1000) break
  }
  const wideCols = 'observed_at,species,species_code,count,strike,zone,map_x,map_y,weather'
  for (let from = 0; from < 20000; from += 1000) {
    let { data, error } = await supabase.from('wildlife_reports').select(wideCols).gte('observed_at', since.toISOString()).order('observed_at').range(from, from + 999)
    let legacy = false
    if (error && /species_code|map_x|map_y|zone|weather/i.test(error.message)) {
      legacy = true
      ;({ data, error } = await supabase.from('wildlife_reports').select('observed_at,species,count,strike').gte('observed_at', since.toISOString()).order('observed_at').range(from, from + 999) as any)
    }
    if (error) throw new Error(error.message)
    for (const x of (data ?? []) as any[]) {
      wild.push({
        at: new Date(x.observed_at), species: x.species, speciesCode: legacy ? null : x.species_code ?? null, count: x.count ?? 1, strike: !!x.strike,
        zone: legacy ? null : x.zone ?? null, mapX: legacy || x.map_x == null ? null : Number(x.map_x), mapY: legacy || x.map_y == null ? null : Number(x.map_y), weather: legacy ? null : x.weather ?? null,
      })
    }
    if (!data || data.length < 1000) break
  }
  return { fod, wild }
}

export async function getSafetyStats(period: StatsPeriod): Promise<SafetyStats> {
  await requireAdmin()
  if (!isStatsPeriod(period)) throw new Error('Nepoznat period')
  const months = PERIOD_MONTHS[period]
  const now = new Date()
  const start = shiftMonths(now, months)
  const prevStart = shiftMonths(start, months)
  const { fod: fodAll, wild: wildAll } = await loadRows(prevStart)

  const inCur = (d: Date) => d >= start && d <= now
  const fod = fodAll.filter((r) => inCur(r.at))
  const wild = wildAll.filter((r) => inCur(r.at))
  const prevFod = fodAll.filter((r) => r.at >= prevStart && r.at < start)
  const prevWild = wildAll.filter((r) => r.at >= prevStart && r.at < start)

  const strikes = wild.filter((w) => w.strike).length
  const totals = { all: fod.length + wild.length, fod: fod.length, wildlife: wild.length, strikes, animals: wild.reduce((a, w) => a + w.count, 0) }
  const previous = { all: prevFod.length + prevWild.length, fod: prevFod.length, wildlife: prevWild.length, strikes: prevWild.filter((w) => w.strike).length }

  const byType: CountRow[] = [
    { id: 'FOD', label: 'FOD (strani predmeti)', color: '#d97706', count: fod.length },
    { id: 'WILDLIFE', label: 'Wildlife - opažanja', color: '#059669', count: wild.length - strikes },
    { id: 'STRIKE', label: 'Wildlife - sudari', color: '#dc2626', count: strikes },
  ]

  const fodMap = new Map<string, number>()
  for (const r of fod) fodMap.set(r.itemType, (fodMap.get(r.itemType) ?? 0) + 1)
  const fodItems: CountRow[] = [...fodMap.entries()]
    .map(([id, count]) => ({ id, label: FOD_ITEM_TYPE_LABELS[id] ?? id, color: '#d97706', count }))
    .sort((a, b) => b.count - a.count)

  const spMap = new Map<string, { reports: number; animals: number; strikes: number }>()
  for (const w of wild) {
    const g = speciesGroupOf(w.speciesCode, w.species)
    const c = spMap.get(g.id) ?? { reports: 0, animals: 0, strikes: 0 }
    c.reports++; c.animals += w.count; if (w.strike) c.strikes++
    spMap.set(g.id, c)
  }
  const species = SPECIES.filter((s) => spMap.has(s.id))
    .map((s) => ({ id: s.id, label: s.short, color: s.color, count: spMap.get(s.id)!.reports, animals: spMap.get(s.id)!.animals, strikes: spMap.get(s.id)!.strikes }))
    .sort((a, b) => b.count - a.count)

  const wxMap = new Map<string, { fod: number; wildlife: number; strikes: number }>()
  const wx = (id: string | null) => { const k = id && WEATHER.some((w) => w.id === id) ? id : UNKNOWN_WEATHER.id; const c = wxMap.get(k) ?? { fod: 0, wildlife: 0, strikes: 0 }; wxMap.set(k, c); return c }
  for (const r of fod) wx(r.weather).fod++
  for (const w of wild) { const c = wx(w.weather); c.wildlife++; if (w.strike) c.strikes++ }
  const weather = [...WEATHER, UNKNOWN_WEATHER]
    .filter((w) => wxMap.has(w.id))
    .map((w) => { const c = wxMap.get(w.id)!; return { id: w.id, label: w.label, color: w.color, ...c, total: c.fod + c.wildlife } })
    .sort((a, b) => (a.id === UNKNOWN_WEATHER.id ? 1 : b.id === UNKNOWN_WEATHER.id ? -1 : b.total - a.total))

  const zMap = new Map<string, number>()
  for (const w of wild) {
    const z = w.zone ?? (w.mapX != null && w.mapY != null ? zoneAt(fromNorm(w.mapX, w.mapY).x, fromNorm(w.mapX, w.mapY).y) : null)
    if (z) zMap.set(z, (zMap.get(z) ?? 0) + 1)
  }
  const zones: CountRow[] = ZONES.map((z) => ({ id: z.id, label: z.short, color: '#2563eb', count: zMap.get(z.id) ?? 0 }))

  // mjesečni trend (svi mjeseci u prozoru, uključujući prazne)
  const keys: string[] = []
  for (let i = months - 1; i >= 0; i--) keys.push(monthKey(shiftMonths(now, i)))
  const first = monthKey(start)
  const trendKeys = [...new Set(months === 1 ? [first, monthKey(now)] : keys)]
  const trend = trendKeys.map((k) => ({
    month: k,
    fod: fod.filter((r) => monthKey(r.at) === k).length,
    wildlife: wild.filter((r) => monthKey(r.at) === k).length,
    strikes: wild.filter((r) => r.strike && monthKey(r.at) === k).length,
  }))

  return { period, label: PERIOD_LABEL[period], from: localDate(start), to: localDate(now), totals, previous, byType, fodItems, species, weather, zones, trend }
}
