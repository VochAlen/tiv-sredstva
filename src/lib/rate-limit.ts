// Jednostavno ograničenje pokušaja po IP adresi (u memoriji instance).
// Cilj: otežati pogađanje ID kartica / PIN-ova na javnoj stranici. Brojе se samo NEUSPJEŠNI pokušaji.
// Ograničenje: na serverless platformi svaka instanca ima svoju memoriju, pa ovo je usporavanje, ne apsolutna zaštita.
// Aerodromska mreža može imati jednu javnu IP adresu za sve tablete, zato su granice velikodušne.

import { headers } from 'next/headers'

type Bucket = { fails: number[]; blockedUntil: number }
const buckets = new Map<string, Bucket>()

export const RATE_MSG = 'Previše pogrešnih pokušaja. Pričekajte nekoliko minuta ili pozovite šefa.'

async function clientKey(scope: string): Promise<string> {
  try {
    const h = await headers()
    const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown'
    return `${scope}:${ip}`
  } catch {
    return `${scope}:unknown`
  }
}

/** true = pokušaj je dozvoljen */
export async function rateAllowed(scope: string): Promise<boolean> {
  const b = buckets.get(await clientKey(scope))
  return !(b && b.blockedUntil > Date.now())
}

/** Zabilježi neuspjeh; nakon `max` neuspjeha u `windowMs` blokira se `blockMs`. */
export async function rateFail(scope: string, max: number, windowMs = 5 * 60_000, blockMs = 5 * 60_000): Promise<void> {
  const k = await clientKey(scope)
  const now = Date.now()
  const b = buckets.get(k) ?? { fails: [], blockedUntil: 0 }
  b.fails = b.fails.filter((t) => now - t < windowMs)
  b.fails.push(now)
  if (b.fails.length >= max) { b.blockedUntil = now + blockMs; b.fails = [] }
  buckets.set(k, b)
  if (buckets.size > 2000) for (const [key, v] of buckets) if (v.blockedUntil < now && v.fails.length === 0) buckets.delete(key)
}
