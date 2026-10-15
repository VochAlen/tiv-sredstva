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
}

const ts = (v: Date | string | null | undefined): number | null => {
  if (!v) return null
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? t : null
}

/** Upozorenje važi dok je popravka u toku ili čeka pregled šefa; sat se broji od zadnje promjene (preuzimanje, dovoženje ili status). */
export function staleInfo(d: StaleInput, now: Date = new Date()): { due: boolean; days: number; since: Date | null } {
  if (d.status !== 'IN_REPAIR' && d.status !== 'AWAITING_APPROVAL') return { due: false, days: 0, since: null }
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
