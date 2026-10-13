// Evaluacija popunjene pre-use checkliste -> semafor rezultat
//
// ZELENO  (OK)        - sve stavke ispravne, sredstvo se zadužuje bez ograničenja
// NARANDŽASTO (RESTRICTED) - jedna ili više RESTRICTIVE stavki neispravno,
//                        sredstvo se MOŽE zadužiti ali sa eksplicitnim ograničenjima upotrebe
// CRVENO  (BLOCKED)   - jedna ili više BLOCKING stavki neispravno,
//                        zaduživanje se odbija, sredstvo ide OUT_OF_SERVICE

import type { ChecklistItem, RestrictionFlag } from '@/lib/types'

export type ChecklistSemaforResult = 'OK' | 'RESTRICTED' | 'BLOCKED'

export interface ChecklistEvaluation {
  result: ChecklistSemaforResult
  blockingFailures: ChecklistItem[]
  restrictiveFailures: ChecklistItem[]
  restrictions: RestrictionFlag[]
  allAnswered: boolean
}

export function evaluateChecklist(checklist: ChecklistItem[]): ChecklistEvaluation {
  const allAnswered = checklist.every((i) => i.passed !== null)
  const failed = checklist.filter((i) => i.passed === false)
  const blockingFailures = failed.filter((i) => i.severity === 'BLOCKING')
  const restrictiveFailures = failed.filter((i) => i.severity === 'RESTRICTIVE')

  const now = new Date().toISOString()
  const restrictions: RestrictionFlag[] = restrictiveFailures.map((i) => ({
    code: i.restrictionCode ?? i.id.toUpperCase(),
    label: i.restrictionLabel ?? `Ograničenje: ${i.label}`,
    source: i.id,
    since: now,
  }))

  let result: ChecklistSemaforResult = 'OK'
  if (blockingFailures.length > 0) result = 'BLOCKED'
  else if (restrictiveFailures.length > 0) result = 'RESTRICTED'

  return { result, blockingFailures, restrictiveFailures, restrictions, allAnswered }
}

// Serijalizacija/deserijalizacija Equipment.activeRestrictions (JSON string u bazi)
export function parseRestrictions(json: string | null | undefined): RestrictionFlag[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function serializeRestrictions(restrictions: RestrictionFlag[]): string | null {
  return restrictions.length > 0 ? JSON.stringify(restrictions) : null
}

// Iz evaluacije checkliste izvodi kategoriju kvara koju treba da popravi
// radionica (MEHANIKA/ELEKTRIKA/HIDRAULIKA/BEZBJEDNOST/OPSTE). Prioritet:
// prva BLOCKING neispravna stavka, pa prva RESTRICTIVE. Vraća null ako je
// sve prošlo (nema kvara) - poziva se samo kad se kreira DamageReport.
export function deriveDamageCategory(evaluation: ChecklistEvaluation): string | null {
  if (evaluation.blockingFailures.length > 0) return evaluation.blockingFailures[0].category
  if (evaluation.restrictiveFailures.length > 0) return evaluation.restrictiveFailures[0].category
  return null
}
