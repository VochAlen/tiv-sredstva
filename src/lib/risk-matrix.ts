// Risk Matrix calculation utility — shared between server and client
// ICAO Annex 19 · 5x5 Risk Matrix (Probability × Severity)

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

// Returns risk level based on score (1-25)
export function calculateRiskLevel(probability: number, severity: number): RiskLevel {
  const score = probability * severity
  if (score >= 15) return 'CRITICAL'
  if (score >= 10) return 'HIGH'
  if (score >= 5) return 'MEDIUM'
  return 'LOW'
}

// Returns risk score (1-25)
export function getRiskScore(probability: number, severity: number): number {
  return probability * severity
}

// Returns color for risk level
export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL': return 'bg-red-500'
    case 'HIGH': return 'bg-orange-500'
    case 'MEDIUM': return 'bg-amber-500'
    case 'LOW': return 'bg-blue-500'
  }
}

// Returns text color for risk level (Tailwind class)
export function getRiskTextColor(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL': return 'text-red-700'
    case 'HIGH': return 'text-orange-700'
    case 'MEDIUM': return 'text-amber-700'
    case 'LOW': return 'text-blue-700'
  }
}

// Returns badge color for risk level
export function getRiskBadgeColor(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL': return 'bg-red-100 text-red-800'
    case 'HIGH': return 'bg-orange-100 text-orange-800'
    case 'MEDIUM': return 'bg-amber-100 text-amber-800'
    case 'LOW': return 'bg-blue-100 text-blue-800'
  }
}

// Probability labels (1-5)
export const PROBABILITY_LABELS: Record<number, string> = {
  1: 'Vrlo malo vjerovatno',
  2: 'Malo vjerovatno',
  3: 'Moguće',
  4: 'Vjerovatno',
  5: 'Često',
}

// Severity labels (1-5)
export const SEVERITY_LABELS: Record<number, string> = {
  1: 'Zanemarljiva',
  2: 'Manja',
  3: 'Umjerena',
  4: 'Ozbiljna',
  5: 'Katastrofalna',
}

// Risk level labels
export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  LOW: 'Nizak',
  MEDIUM: 'Srednji',
  HIGH: 'Visok',
  CRITICAL: 'Kritičan',
}
