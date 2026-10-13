// Čista logika rokova — bez I/O (testira se odvojeno).

export type ExpiryKind = 'DRIVER_LICENCE' | 'DRIVER_TRAINING' | 'EQUIPMENT_QUALIFICATION' | 'WORKSHOP_SKILL' | 'DOCUMENT_REVIEW'

export interface ExpiryItem {
  kind: ExpiryKind
  who: string        // osoba ili dokument
  detail?: string
  date: string       // ISO
}

export const EXPIRY_KIND_LABELS: Record<ExpiryKind, string> = {
  DRIVER_LICENCE: 'Airside dozvola',
  DRIVER_TRAINING: 'Obuka vozača',
  EQUIPMENT_QUALIFICATION: 'Kvalifikacija za opremu',
  WORKSHOP_SKILL: 'Kvalifikacija radionice',
  DOCUMENT_REVIEW: 'Pregled dokumenta',
}

export function daysUntil(iso: string, now: Date = new Date()): number {
  const d = new Date(iso)
  const a = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((a - b) / 86_400_000)
}

/** Stavke koje su isteknule ili ističu u narednih `days` dana, sortirane po datumu. */
export function selectExpiring(items: ExpiryItem[], days: number, now: Date = new Date()) {
  return items
    .map((i) => ({ ...i, days: daysUntil(i.date, now) }))
    .filter((i) => Number.isFinite(i.days) && i.days <= days)
    .sort((a, b) => a.days - b.days)
}

export function formatExpiryLine(i: ExpiryItem & { days: number }): string {
  const when = i.days < 0 ? `ISTEKLO prije ${-i.days} d` : i.days === 0 ? 'ističe DANAS' : `za ${i.days} d`
  return `• ${EXPIRY_KIND_LABELS[i.kind]}: ${i.who}${i.detail ? ` (${i.detail})` : ''} — ${when}`
}

export function formatExpiryDigest(rows: (ExpiryItem & { days: number })[], max = 25): string {
  if (rows.length === 0) return ''
  const head = `GSE Control — rokovi koji ističu (${rows.length}):`
  const lines = rows.slice(0, max).map(formatExpiryLine)
  if (rows.length > max) lines.push(`… i još ${rows.length - max}`)
  return [head, ...lines].join('\n')
}
