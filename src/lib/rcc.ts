// src/lib/rcc.ts
// Indikativna Runway Condition Code (RCC) tabela — pojednostavljena verzija
// zasnovana na ICAO Global Reporting Format (GRF) / Runway Condition Assessment Matrix (RCAM).
//
// VAŽNA NAPOMENA: Ovo NIJE zamjena za formalnu RCAM procjenu koju sprovodi obučen
// procjenjivač (friction test, dubina i tip kontaminacije po dijelu piste "thirds").
// Služi samo kao indikativna referenca u dnevnom izvještaju. Za formalni Runway
// Condition Report (RCR) koristiti zvaničnu RCAM proceduru po ADR.OPS.A.065.

export type RCCResult = { code: number | null; label: string }

const RCC_MAP: Record<string, RCCResult> = {
  DRY: { code: 6, label: 'Dry' },
  WET: { code: 5, label: 'Wet, good braking action' },
  DAMP: { code: 5, label: 'Damp' },
  SLUSH: { code: 3, label: 'Slush, medium braking action' },
  STANDING_WATER: { code: 2, label: 'Standing water, medium-poor' },
  SNOW: { code: 3, label: 'Compacted snow, medium' },
  ICE: { code: 0, label: 'Ice, nil braking action — PRIORITY REPORT' },
}

export function getIndicativeRCC(condition: string): RCCResult {
  return RCC_MAP[condition] ?? { code: null, label: 'Nepoznato stanje' }
}