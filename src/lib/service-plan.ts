// Redovni servis sredstava: čista logika (bez baze, bez 'use server') - dijele je klijent, server i cron.
// Servis je dospio čim nastupi BILO KOJI od uslova: pređeni km, radni sati ili najviše 12 mjeseci od zadnjeg servisa.

export type ServiceStatus = 'OK' | 'SOON' | 'OVERDUE' | 'NO_BASELINE'
export type CriterionKind = 'DATE' | 'KM' | 'HOURS'

export interface ServiceInput {
  totalKm: number
  totalHours: number
  intervalKm: number | null
  intervalHours: number | null
  intervalMonths: number // 1..12 (godišnji servis je obavezan za sve)
  lastDate: string | null // YYYY-MM-DD
  lastKm: number | null
  lastHours: number | null
}

export interface Criterion {
  kind: CriterionKind
  status: 'OK' | 'SOON' | 'OVERDUE'
  remaining: number // dani / km / sati (negativno = prekoračeno)
  unit: string
  dueAt: number | string // datum (YYYY-MM-DD) ili vrijednost brojača
  text: string
  estDate: string | null // procjena datuma kada će uslov nastupiti
}

export interface ServiceResult {
  status: ServiceStatus
  criteria: Criterion[]
  dominant: Criterion | null
  plannedDate: string | null // najraniji (procijenjeni) datum sljedećeg servisa
  summary: string
}

export const SOON_DAYS = 30
export const SOON_FRACTION = 0.1
export const DEFAULT_MONTHS = 12

const MS_DAY = 86400000
const parse = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd) }
const fmt = (t: number) => new Date(t).toISOString().slice(0, 10)

export function addMonthsISO(d: string, n: number): string {
  const [y, m, dd] = d.split('-').map(Number)
  const total = (m - 1) + n
  const ny = y + Math.floor(total / 12)
  const nm = ((total % 12) + 12) % 12
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  return fmt(Date.UTC(ny, nm, Math.min(dd, last)))
}
export const addDaysISO = (d: string, n: number) => fmt(parse(d) + n * MS_DAY)
export const daysBetween = (a: string, b: string) => Math.round((parse(b) - parse(a)) / MS_DAY)
export const fmtDateBHS = (d: string | null | undefined) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}.` : '—')
const num = (n: number) => Math.round(n).toLocaleString('hr-HR')

export function computeServiceStatus(i: ServiceInput, today: string): ServiceResult {
  if (!i.lastDate) {
    return { status: 'NO_BASELINE', criteria: [], dominant: null, plannedDate: null, summary: 'Nije upisan zadnji servis' }
  }
  const months = Math.min(12, Math.max(1, Math.round(i.intervalMonths || DEFAULT_MONTHS)))
  const sinceDays = Math.max(0, daysBetween(i.lastDate, today))
  const criteria: Criterion[] = []

  // 1) datum - uvijek (najviše 12 mjeseci)
  const dueDate = addMonthsISO(i.lastDate, months)
  const remDays = daysBetween(today, dueDate)
  criteria.push({
    kind: 'DATE', unit: 'dana', remaining: remDays, dueAt: dueDate, estDate: dueDate,
    status: remDays < 0 ? 'OVERDUE' : remDays <= SOON_DAYS ? 'SOON' : 'OK',
    text: remDays < 0 ? `datum prekoračen ${-remDays} dana (rok ${fmtDateBHS(dueDate)})` : `rok ${fmtDateBHS(dueDate)} (još ${remDays} dana)`,
  })

  // 2) kilometri i 3) radni sati - samo ako su zadani i ima početno stanje brojača
  const counter = (kind: 'KM' | 'HOURS', interval: number | null, last: number | null, total: number, unit: string) => {
    if (!interval || interval <= 0 || last == null) return
    const due = last + interval
    const rem = due - total
    const used = Math.max(0, total - last)
    const rate = sinceDays >= 14 && used > 0 ? used / sinceDays : 0 // po danu
    let est: string | null = null
    if (rem <= 0) est = today
    else if (rate > 0) est = addDaysISO(today, Math.min(3650, Math.ceil(rem / rate)))
    criteria.push({
      kind, unit, remaining: rem, dueAt: due, estDate: est,
      status: rem <= 0 ? 'OVERDUE' : rem <= interval * SOON_FRACTION ? 'SOON' : 'OK',
      text: rem <= 0 ? `${kind === 'KM' ? 'km' : 'sati'} prekoračeni za ${num(-rem)} ${unit} (na ${num(due)})` : `na ${num(due)} ${unit} (još ${num(rem)})`,
    })
  }
  counter('KM', i.intervalKm, i.lastKm, i.totalKm, 'km')
  counter('HOURS', i.intervalHours, i.lastHours, i.totalHours, 'h')

  const rank = { OVERDUE: 2, SOON: 1, OK: 0 } as const
  const sorted = [...criteria].sort((a, b) => rank[b.status] - rank[a.status])
  const dominant = sorted[0]
  const planned = criteria.map((c) => c.estDate).filter((x): x is string => !!x).sort()[0] ?? null
  const status: ServiceStatus = dominant.status
  const label = { DATE: 'Rok (godišnji)', KM: 'Kilometri', HOURS: 'Radni sati' }[dominant.kind]
  return { status, criteria, dominant, plannedDate: planned, summary: `${label}: ${dominant.text}` }
}

export const STATUS_LABEL: Record<ServiceStatus, string> = {
  OVERDUE: 'Dospio', SOON: 'Uskoro', OK: 'U redu', NO_BASELINE: 'Bez početnog stanja',
}

// =====================================================
// PLAN RADA: projekcija budućih servisa (mjesec / 3 mjeseca / 12 mjeseci)
// =====================================================

export type WorkPlanHorizon = 'THIS_MONTH' | 'NEXT_MONTH' | 'QUARTER' | 'YEAR'
export const HORIZON_LABEL: Record<WorkPlanHorizon, string> = {
  THIS_MONTH: 'Ovaj mjesec', NEXT_MONTH: 'Sljedeći mjesec', QUARTER: 'Naredna 3 mjeseca', YEAR: 'Naredna 12 mjeseci',
}
export const isHorizon = (h: unknown): h is WorkPlanHorizon => h === 'THIS_MONTH' || h === 'NEXT_MONTH' || h === 'QUARTER' || h === 'YEAR'

export function horizonRange(h: WorkPlanHorizon, today: string): { from: string; to: string } {
  const monthStart = `${today.slice(0, 7)}-01`
  const monthEnd = (ms: string) => addDaysISO(addMonthsISO(ms, 1), -1)
  switch (h) {
    case 'THIS_MONTH': return { from: today, to: monthEnd(monthStart) }
    case 'NEXT_MONTH': { const ns = addMonthsISO(monthStart, 1); return { from: ns, to: monthEnd(ns) } }
    case 'QUARTER': return { from: today, to: addDaysISO(addMonthsISO(today, 3), -1) }
    case 'YEAR': return { from: today, to: addDaysISO(addMonthsISO(today, 12), -1) }
  }
}

export interface ProjectedService {
  date: string // YYYY-MM-DD
  reason: CriterionKind
  overdue: boolean // već dospjelo danas (datum = danas)
}

/**
 * Projektuje sve servise do `end`. Prosječna potrošnja km/h po danu se uzima iz perioda od zadnjeg servisa
 * (najmanje 14 dana podataka); bez nje se projektuje samo godišnji/mjesečni rok. Nakon svakog projektovanog
 * servisa brojači kreću ispočetka, pa se u dužem periodu može pojaviti više servisa istog sredstva.
 */
export function projectServices(i: ServiceInput, today: string, end: string): ProjectedService[] {
  if (!i.lastDate) return []
  const months = Math.min(12, Math.max(1, Math.round(i.intervalMonths || DEFAULT_MONTHS)))
  const sinceDays = Math.max(0, daysBetween(i.lastDate, today))
  const rate = (total: number, last: number | null) => (last != null && sinceDays >= 14 && total > last ? (total - last) / sinceDays : 0)
  const rKm = rate(i.totalKm, i.lastKm)
  const rH = rate(i.totalHours, i.lastHours)
  const at = (total: number, r: number, d: string) => total + r * Math.max(0, daysBetween(today, d))

  let baseDate = i.lastDate
  let baseKm = i.lastKm
  let baseH = i.lastHours
  let from = today // od kada se računaju procjene po brojačima
  const out: ProjectedService[] = []

  for (let n = 0; n < 15; n++) {
    const cands: Array<{ date: string; reason: CriterionKind }> = [{ date: addMonthsISO(baseDate, months), reason: 'DATE' }]
    const byCounter = (reason: 'KM' | 'HOURS', interval: number | null, base: number | null, total: number, r: number) => {
      if (!interval || interval <= 0 || base == null) return
      const rem = base + interval - at(total, r, from)
      if (rem <= 0) cands.push({ date: from, reason })
      else if (r > 0) cands.push({ date: addDaysISO(from, Math.max(1, Math.ceil(rem / r))), reason })
    }
    byCounter('KM', i.intervalKm, baseKm, i.totalKm, rKm)
    byCounter('HOURS', i.intervalHours, baseH, i.totalHours, rH)
    cands.sort((a, b) => a.date.localeCompare(b.date))
    let { date, reason } = cands[0]
    const overdue = n === 0 && date <= today
    if (date < today) date = today
    if (n > 0 && date <= out[n - 1].date) date = addDaysISO(out[n - 1].date, 1)
    if (date > end) break
    out.push({ date, reason, overdue })
    baseDate = date
    baseKm = i.intervalKm && baseKm != null ? at(i.totalKm, rKm, date) : baseKm
    baseH = i.intervalHours && baseH != null ? at(i.totalHours, rH, date) : baseH
    from = date
  }
  return out
}
