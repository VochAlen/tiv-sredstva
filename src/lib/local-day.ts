// Datumi po lokalnom vremenu aerodroma (Europe/Podgorica), ne po UTC-u koji koristi server (Vercel).
const TZ = 'Europe/Podgorica'

export const localDate = (d: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

function offsetMinutes(at: Date): number {
  const v = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' })
    .formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(v)
  if (!m) return 0
  return (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3] ?? '0', 10))
}

/** Početak i kraj lokalnog dana (YYYY-MM-DD) kao UTC trenuci. */
export function dayBounds(date: string): { start: Date; end: Date } {
  const off = offsetMinutes(new Date(`${date}T12:00:00Z`))
  const start = new Date(Date.parse(`${date}T00:00:00Z`) - off * 60000)
  return { start, end: new Date(start.getTime() + 86400000 - 1) }
}

export const isValidDate = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))
