// Stepen hitnosti prijave kvara za potrebe održavanja - 4 nivoa
// (LOW / MEDIUM / HIGH / CRITICAL), izveden iz postojeće težine
// oštećenja (severity: MINOR/MAJOR/CRITICAL) i trenutnog statusa
// sredstva. Ne zahtijeva izmjenu baze - čisto prikazni sloj iznad
// već postojećih podataka, da održavanje odmah vidi gdje prvo da ide.

export type DamageUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export const URGENCY_LABELS: Record<DamageUrgency, string> = {
  LOW: 'Nizak',
  MEDIUM: 'Srednji',
  HIGH: 'Visok',
  CRITICAL: 'Kritičan',
}

export const URGENCY_COLORS: Record<DamageUrgency, string> = {
  LOW: 'bg-slate-100 text-slate-700 border-slate-300',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-300',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
  CRITICAL: 'bg-red-100 text-red-800 border-red-400',
}

/**
 * Određuje hitnost za održavanje na osnovu:
 * - severity prijave (MINOR/MAJOR/CRITICAL)
 * - da li je sredstvo trenutno OUT_OF_SERVICE (ne radi uopšte -> eskalacija)
 * - koliko dugo je prijava otvorena, bez reakcije (ako je proslo > 24h
 *   za MINOR, ili > 4h za MAJOR, hitnost se penje jedan nivo)
 */
export function getDamageUrgency(params: {
  severity: string
  equipmentStatus?: string | null
  status?: string // OPEN / IN_REPAIR / RESOLVED
  createdAt?: string | Date
}): DamageUrgency {
  const { severity, equipmentStatus, status, createdAt } = params

  if (status === 'RESOLVED') return 'LOW'

  let base: DamageUrgency =
    severity === 'CRITICAL' ? 'CRITICAL' : severity === 'MAJOR' ? 'HIGH' : 'LOW'

  // Sredstvo potpuno van stroja - minimalno MEDIUM, jer stoji neiskorišćeno
  if (equipmentStatus === 'OUT_OF_SERVICE' && base === 'LOW') {
    base = 'MEDIUM'
  }

  // Dugo otvorena prijava bez rješenja - eskalacija jedan nivo
  if (createdAt) {
    const hoursOpen = (Date.now() - new Date(createdAt).getTime()) / 36e5
    const escalateThreshold = severity === 'CRITICAL' ? 1 : severity === 'MAJOR' ? 4 : 24
    if (hoursOpen > escalateThreshold) {
      const order: DamageUrgency[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
      const idx = order.indexOf(base)
      base = order[Math.min(idx + 1, order.length - 1)]
    }
  }

  return base
}
