// Preventivno održavanje sredstava po IATA AHM 917 (BASIC MINIMUM PREVENTIVE MAINTENANCE PROGRAM/SCHEDULE):
// čista logika (bez baze, bez 'use server') - dijele je klijent, server i cron.
//
// Pravila iz AHM 917:
//  - Ako postoji OEM program (proizvođač), on ima prednost. Bez OEM podataka važe IATA preporučeni intervali:
//      IATA_4M: "minor + minor + major" u ciklusu od 12 mjeseci - provjere (minor) svakih 4 mj. / 500 h, major 12 mj. / 1500 h
//      IATA_6M: "minor + major"         u ciklusu od 12 mjeseci - provjere (minor) svakih 6 mj. / 750 h,  major 12 mj. / 1500 h
//  - Major servis (zamjena tečnosti i filtera) je najmanje jednom u 12 mjeseci / 1500 h.
//  - Manje stroga varijacija od OEM mora biti dogovorena s proizvođačem i dokumentovana (service_variation_note).
//  - Interval se računa u mjesecima ILI radnim satima (za OEM i km) - šta prije nastupi.

export type ServiceStatus = 'OK' | 'SOON' | 'OVERDUE' | 'NO_BASELINE'
export type CriterionKind = 'DATE' | 'KM' | 'HOURS'
export type ServiceProgram = 'IATA_4M' | 'IATA_6M' | 'OEM'
export type ServiceKind = 'MINOR' | 'MAJOR'

export interface Level { months: number | null; hours: number | null; km: number | null }
export interface Baseline { date: string | null; km: number | null; hours: number | null }

export interface ProgramConfig {
  program: ServiceProgram | null // null = nije izabran (vidi resolveProgram)
  minorKm: number | null
  minorHours: number | null
  minorMonths: number | null
  majorKm: number | null
  majorHours: number | null
  majorMonths: number | null
}

export const IATA_LEVELS: Record<'IATA_4M' | 'IATA_6M', { minor: Level; major: Level }> = {
  IATA_4M: { minor: { months: 4, hours: 500, km: null }, major: { months: 12, hours: 1500, km: null } },
  IATA_6M: { minor: { months: 6, hours: 750, km: null }, major: { months: 12, hours: 1500, km: null } },
}
export const PROGRAM_LABEL: Record<ServiceProgram, string> = {
  IATA_4M: 'IATA AHM 917 — minor + minor + major (provjere 4 mj. / 500 h)',
  IATA_6M: 'IATA AHM 917 — minor + major (provjere 6 mj. / 750 h)',
  OEM: 'Prema proizvođaču (OEM) — vlastiti intervali',
}
export const PROGRAM_SHORT: Record<ServiceProgram, string> = { IATA_4M: 'IATA 4M', IATA_6M: 'IATA 6M', OEM: 'OEM' }
export const KIND_LABEL: Record<ServiceKind, string> = { MINOR: 'Minor', MAJOR: 'Major' }
export const isProgram = (p: unknown): p is ServiceProgram => p === 'IATA_4M' || p === 'IATA_6M' || p === 'OEM'

/** Efektivni program i intervali: nije izabran -> OEM ako su ranije upisani km/sati, inače IATA 6M. */
export function resolveProgram(c: ProgramConfig): { program: ServiceProgram; minor: Level; major: Level } {
  const program: ServiceProgram = c.program ?? (c.minorKm || c.minorHours ? 'OEM' : 'IATA_6M')
  if (program !== 'OEM') return { program, ...IATA_LEVELS[program] }
  // OEM: godišnji (12 mj.) major je uvijek obavezan, osim ako su zadani kraći OEM rokovi
  return {
    program,
    minor: { months: c.minorMonths, hours: c.minorHours, km: c.minorKm },
    major: { months: c.majorMonths ?? 12, hours: c.majorHours, km: c.majorKm },
  }
}

export interface ServiceInput {
  totalKm: number
  totalHours: number
  minor: Level
  major: Level
  last: Baseline // zadnji servis (bilo koji)
  lastMajor: Baseline // zadnji major servis (ako nije upisan, računa se zadnji servis)
}

export interface Criterion {
  kind: CriterionKind
  level: ServiceKind
  status: 'OK' | 'SOON' | 'OVERDUE'
  remaining: number // dani / km / sati (negativno = prekoračeno)
  unit: string
  dueAt: number | string // datum (YYYY-MM-DD) ili vrijednost brojača
  text: string
  estDate: string | null // procjena datuma kada će uslov nastupiti
}

export interface ServiceResult {
  status: ServiceStatus
  kind: ServiceKind | null // vrsta SLJEDEĆEG servisa
  criteria: Criterion[] // uslovi nivoa koji određuje sljedeći servis
  dominant: Criterion | null
  plannedDate: string | null // najraniji (procijenjeni) datum sljedećeg servisa
  summary: string
}

export const SOON_DAYS = 30
export const SOON_FRACTION = 0.1

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

const hasLevel = (l: Level) => !!(l.months || l.hours || l.km)
const rank = { OVERDUE: 2, SOON: 1, OK: 0 } as const

/** Brzina potrošnje po danu (km, sati) od zadnjeg servisa; 0 ako nema dovoljno podataka (< 14 dana). */
function usageRates(i: ServiceInput, today: string): { km: number; hours: number } {
  const since = i.last.date ? Math.max(0, daysBetween(i.last.date, today)) : 0
  const rate = (total: number, last: number | null) => (last != null && since >= 14 && total > last ? (total - last) / since : 0)
  return { km: rate(i.totalKm, i.last.km), hours: rate(i.totalHours, i.last.hours) }
}

function levelCriteria(level: ServiceKind, l: Level, base: Baseline, i: ServiceInput, today: string, rates: { km: number; hours: number }): Criterion[] {
  const out: Criterion[] = []
  if (l.months && base.date) {
    const due = addMonthsISO(base.date, l.months)
    const rem = daysBetween(today, due)
    out.push({
      kind: 'DATE', level, unit: 'dana', remaining: rem, dueAt: due, estDate: due,
      status: rem < 0 ? 'OVERDUE' : rem <= SOON_DAYS ? 'SOON' : 'OK',
      text: rem < 0 ? `rok prekoračen ${-rem} dana (${fmtDateBHS(due)})` : `rok ${fmtDateBHS(due)} (još ${rem} dana)`,
    })
  }
  const counter = (kind: 'KM' | 'HOURS', interval: number | null, last: number | null, total: number, rate: number, unit: string) => {
    if (!interval || interval <= 0 || last == null) return
    const due = last + interval
    const rem = due - total
    let est: string | null = null
    if (rem <= 0) est = today
    else if (rate > 0) est = addDaysISO(today, Math.min(3650, Math.ceil(rem / rate)))
    out.push({
      kind, level, unit, remaining: rem, dueAt: due, estDate: est,
      status: rem <= 0 ? 'OVERDUE' : rem <= interval * SOON_FRACTION ? 'SOON' : 'OK',
      text: rem <= 0 ? `${unit} prekoračeni za ${num(-rem)} (na ${num(due)})` : `na ${num(due)} ${unit} (još ${num(rem)})`,
    })
  }
  counter('KM', l.km, base.km, i.totalKm, rates.km, 'km')
  counter('HOURS', l.hours, base.hours, i.totalHours, rates.hours, 'h')
  return out
}

export function computeServiceStatus(i: ServiceInput, today: string): ServiceResult {
  if (!i.last.date) {
    return { status: 'NO_BASELINE', kind: null, criteria: [], dominant: null, plannedDate: null, summary: 'Nije upisan zadnji servis' }
  }
  const rates = usageRates(i, today)
  const majorBase: Baseline = i.lastMajor.date ? i.lastMajor : i.last
  const levels = ([['MINOR', i.minor, i.last], ['MAJOR', i.major, majorBase]] as const)
    .filter(([, l]) => hasLevel(l))
    .map(([kind, l, base]) => {
      const criteria = levelCriteria(kind, l, base, i, today, rates)
      const status = criteria.reduce<'OK' | 'SOON' | 'OVERDUE'>((w, c) => (rank[c.status] > rank[w] ? c.status : w), 'OK')
      const date = criteria.map((c) => c.estDate).filter((x): x is string => !!x).sort()[0] ?? null
      return { kind: kind as ServiceKind, criteria, status, date }
    })
    .filter((l) => l.criteria.length > 0)
  if (levels.length === 0) {
    return { status: 'NO_BASELINE', kind: null, criteria: [], dominant: null, plannedDate: null, summary: 'Nisu zadani intervali održavanja' }
  }
  // Governing nivo: teži status, pa raniji datum; kod izjednačenja major (obuhvata sve provjere minor servisa)
  levels.sort((a, b) =>
    rank[b.status] - rank[a.status]
    || (a.date ?? '9999').localeCompare(b.date ?? '9999')
    || (a.kind === 'MAJOR' ? -1 : 1))
  const gov = levels[0]
  const dominant = [...gov.criteria].sort((a, b) => rank[b.status] - rank[a.status])[0]
  const label = { DATE: 'Rok', KM: 'Kilometri', HOURS: 'Radni sati' }[dominant.kind]
  return {
    status: gov.status, kind: gov.kind, criteria: gov.criteria, dominant, plannedDate: gov.date,
    summary: `${KIND_LABEL[gov.kind]} — ${label}: ${dominant.text}`,
  }
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
  kind: ServiceKind
  reason: CriterionKind
  overdue: boolean // već dospjelo danas (datum = danas)
}

/**
 * Projektuje sve servise do `end` (minor i major po AHM 917 ciklusu). Potrošnja km/h po danu se uzima iz perioda od
 * zadnjeg servisa (najmanje 14 dana); bez nje se projektuju samo rokovi u mjesecima. Nakon svakog projektovanog
 * servisa brojači kreću ispočetka (major resetuje i minor i major), pa se u dužem periodu isto sredstvo može pojaviti više puta.
 */
export function projectServices(i: ServiceInput, today: string, end: string): ProjectedService[] {
  if (!i.last.date || (!hasLevel(i.minor) && !hasLevel(i.major))) return []
  const rates = usageRates(i, today)
  const at = (total: number, r: number, d: string) => total + r * Math.max(0, daysBetween(today, d))

  let last: Baseline = { ...i.last }
  let lastMajor: Baseline = i.lastMajor.date ? { ...i.lastMajor } : { ...i.last }
  let from = today
  const out: ProjectedService[] = []

  for (let n = 0; n < 24; n++) {
    const cands: Array<{ date: string; kind: ServiceKind; reason: CriterionKind }> = []
    const addCands = (kind: ServiceKind, l: Level, base: Baseline) => {
      if (l.months && base.date) cands.push({ date: addMonthsISO(base.date, l.months), kind, reason: 'DATE' })
      const byCounter = (reason: 'KM' | 'HOURS', interval: number | null, b: number | null, total: number, r: number) => {
        if (!interval || interval <= 0 || b == null) return
        const rem = b + interval - at(total, r, from)
        if (rem <= 0) cands.push({ date: from, kind, reason })
        else if (r > 0) cands.push({ date: addDaysISO(from, Math.max(1, Math.ceil(rem / r))), kind, reason })
      }
      byCounter('KM', l.km, base.km, i.totalKm, rates.km)
      byCounter('HOURS', l.hours, base.hours, i.totalHours, rates.hours)
    }
    if (hasLevel(i.minor)) addCands('MINOR', i.minor, last)
    if (hasLevel(i.major)) addCands('MAJOR', i.major, lastMajor)
    if (cands.length === 0) break
    cands.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'MAJOR' ? -1 : 1))
    const c = cands[0]
    const overdue = n === 0 && c.date <= today
    let date = c.date < today ? today : c.date
    if (n > 0 && date <= out[n - 1].date) date = addDaysISO(out[n - 1].date, 1)
    if (date > end) break
    out.push({ date, kind: c.kind, reason: c.reason, overdue })
    const here: Baseline = {
      date,
      km: i.minor.km || i.major.km ? at(i.totalKm, rates.km, date) : last.km,
      hours: i.minor.hours || i.major.hours ? at(i.totalHours, rates.hours, date) : last.hours,
    }
    last = here
    if (c.kind === 'MAJOR') lastMajor = { ...here }
    from = date
  }
  return out
}
