// Normalizuje ono što je skenirano (URL sa ?scan=XXX, /eq/KOD ili goli kod) u kod opreme
export function normalizeScan(raw: string): string {
  const v = raw.trim().toUpperCase()
  const urlMatch = v.match(/[?&]SCAN=([^&\s]+)/i)
  if (urlMatch) return decodeURIComponent(urlMatch[1]).toUpperCase()
  const pathMatch = v.match(/\/EQ\/([A-Z0-9-]+)/)
  if (pathMatch) return pathMatch[1]
  return v
}
