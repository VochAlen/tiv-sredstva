// Tok radionice - čista logika (bez servera): upozorenje "predugo u radionici bez promjene statusa".

export const STALE_DAYS = 3

export const STATUS_PRESETS = [
  'Čekaju se rezervni dijelovi',
  'Problem u nabavci rezervnog dijela',
  'Čeka se vanjski serviser / izvođač',
  'Čeka se dijagnostika',
  'Popravka u toku',
] as const

export interface StaleInput {
  status: string
  acknowledgedAt?: Date | string | null
  workshopArrivedAt?: Date | string | null
  lastStatusAt?: Date | string | null
  /** "Čeka dio": do ovog datuma (uključivo) upozorenje se ne pali */
  waitingPartUntil?: Date | string | null
}

const ts = (v: Date | string | null | undefined): number | null => {
  if (!v) return null
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? t : null
}

/** Upozorenje važi dok je popravka u toku ili čeka pregled šefa; sat se broji od zadnje promjene (preuzimanje, dovoženje ili status). */
export function staleInfo(d: StaleInput, now: Date = new Date()): { due: boolean; days: number; since: Date | null } {
  if (d.status !== 'IN_REPAIR' && d.status !== 'AWAITING_APPROVAL') return { due: false, days: 0, since: null }
  const wu = ts(d.waitingPartUntil)
  if (wu != null && now.getTime() < wu + 86_400_000) return { due: false, days: 0, since: null }
  const times = [ts(d.acknowledgedAt), ts(d.workshopArrivedAt), ts(d.lastStatusAt)].filter((x): x is number => x != null)
  if (!times.length) return { due: false, days: 0, since: null }
  const since = Math.max(...times)
  const days = Math.max(0, Math.floor((now.getTime() - since) / 86_400_000))
  return { due: days >= STALE_DAYS, days, since: new Date(since) }
}

export const fmtDT = (v: Date | string | null | undefined): string => {
  const t = ts(v)
  return t == null ? '' : new Date(t).toLocaleString('hr-HR', { timeZone: 'Europe/Podgorica', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Datum (bez vremena) u formatu dd.mm.gggg. */
export const fmtD = (v: Date | string | null | undefined): string => {
  const t = ts(v)
  return t == null ? '' : new Date(t).toLocaleDateString('hr-HR', { timeZone: 'Europe/Podgorica' })
}

/** Množina za "kvar": 1 novi kvar čeka, 2-4 nova kvara čekaju, 5+ novih kvarova čeka. */
export function pluralKvar(n: number): { text: string; verb: string } {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return { text: `${n} novi kvar`, verb: 'čeka' }
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return { text: `${n} nova kvara`, verb: 'čekaju' }
  return { text: `${n} novih kvarova`, verb: 'čeka' }
}
