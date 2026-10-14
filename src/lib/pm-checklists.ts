// PM (AHM 917) radni nalozi - zajednička logika (klijent + server). Trenutno samo PUTNIČKE STEPENICE (STAIRS);
// ostali tipovi koriste servisni plan bez PM check-sheet-a dok se ne dodaju njihovi IATA predlošci.

import { PM_STAIRS_SECTIONS, type PmSection } from '@/lib/pm-stairs-data'
export type { PmSection, PmTask } from '@/lib/pm-stairs-data'

export type PmKind = 'MINOR' | 'MAJOR'
export type PmAnswer = 'OK' | 'NOT_OK' | 'FIXED' | 'NA'
export interface PmItem { k: string; s: PmAnswer; c?: string }

export const PM_KIND_LABEL: Record<PmKind, string> = { MINOR: 'Minor (provjere)', MAJOR: 'Major (provjere + zamjene)' }
export const PM_ANSWER_LABEL: Record<PmAnswer, string> = { OK: 'OK', NOT_OK: 'NIJE OK', FIXED: 'POPRAVLJENO', NA: 'N/A' }

export const PM_CHECKLISTS: Record<string, { title: string; edition: string; sections: PmSection[] }> = {
  STAIRS: { title: 'Passenger stairs (PBS) - self-propelled and towable', edition: 'IATA AHM 917', sections: PM_STAIRS_SECTIONS },
}

export const hasPmChecklist = (type: string | null | undefined): boolean => !!type && type in PM_CHECKLISTS

/** Sekcije za izabranu vrstu servisa (minor: samo stavke koje se rade uvijek; major: sve). Prazne sekcije otpadaju. */
export function pmSectionsFor(type: string, kind: PmKind): PmSection[] {
  const cl = PM_CHECKLISTS[type]
  if (!cl) return []
  return cl.sections
    .map((s) => ({ ...s, tasks: s.tasks.filter((t) => kind === 'MAJOR' || t.scope === 'ALL') }))
    .filter((s) => s.tasks.length > 0)
}

export const parseExcluded = (raw: string | null | undefined): string[] => (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean)

/** Stavke koje se moraju popuniti: sve u sekcijama koje nisu isključene (N/A za cijelu sekciju). */
export function requiredKeys(type: string, kind: PmKind, excluded: string[]): string[] {
  return pmSectionsFor(type, kind).filter((s) => !excluded.includes(s.id)).flatMap((s) => s.tasks.map((t) => t.key))
}
