// Zajednički keš liste radnika za klijent (Access Control + izbor imena u Radionici).
// Lista se učitava jednom po sesiji (5 min) - svaki sljedeći izbor imena je trenutan.
import { getAllEmployees } from '@/lib/actions-access'

export type EmployeeLite = { id: string; cardId: string; name: string }

const TTL_MS = 5 * 60_000
let cache: { at: number; list: EmployeeLite[] } | null = null
let inflight: Promise<EmployeeLite[]> | null = null

export function peekEmployees(): EmployeeLite[] | null {
  return cache && Date.now() - cache.at < TTL_MS ? cache.list : null
}

export function setEmployeeCache(list: EmployeeLite[]) {
  cache = { at: Date.now(), list }
}

export async function loadEmployees(): Promise<EmployeeLite[]> {
  const hit = peekEmployees()
  if (hit) return hit
  if (!inflight) {
    inflight = getAllEmployees()
      .then((l) => { setEmployeeCache(l); return l })
      .finally(() => { inflight = null })
  }
  return inflight
}

// Zadnji izbor po polju (npr. "arrived", "chief") - pamti se samo ime, na uređaju
export function lastPicked(key: string): string[] {
  try {
    const raw = localStorage.getItem(`gse.pick.${key}`)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string').slice(0, 3) : []
  } catch { return [] }
}

export function rememberPicked(key: string, name: string) {
  try {
    const cur = lastPicked(key).filter((n) => n !== name)
    localStorage.setItem(`gse.pick.${key}`, JSON.stringify([name, ...cur].slice(0, 3)))
  } catch { /* privatni prozor - nije bitno */ }
}
