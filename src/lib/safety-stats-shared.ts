// Zajedničke konstante za statistiku FOD & Wildlife (klijent + server).
export type StatsPeriod = '1m' | '3m' | '6m' | '12m'
export const PERIOD_MONTHS: Record<StatsPeriod, number> = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 }
export const PERIOD_LABEL: Record<StatsPeriod, string> = { '1m': 'Mjesečna', '3m': 'Tromjesečna', '6m': 'Polugodišnja', '12m': 'Godišnja' }
export const PERIOD_SHORT: Record<StatsPeriod, string> = { '1m': 'Mjesec', '3m': '3 mjeseca', '6m': 'Pola godine', '12m': 'Godina' }
export const isStatsPeriod = (v: unknown): v is StatsPeriod => typeof v === 'string' && v in PERIOD_MONTHS
