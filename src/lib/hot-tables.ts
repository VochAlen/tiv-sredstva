// HOT (Holdover Time) tabele — bazirano na ISO 11076 / AEA Recommendations / SAE AMS 1428
// Izvor: Transport Canada TP 14052 "Guidelines for Aircraft Ground Icing Operations"
// + FAA AC 120-60B + AEA "Holdover Time Tables"
//
// Napomena: Ove tabele su indikativne. Stvarne HOT tabele se godišnje ažuriraju
// od strane Transport Canada / FAA / EASA. Korisnik je odgovoran da koristi
// važeću verziju.

export type FluidType = 'TYPE_I' | 'TYPE_II' | 'TYPE_III' | 'TYPE_IV'
export type Concentration = '50/50' | '75/25' | '100/0'
export type PrecipitationType =
  | 'SNOW'
  | 'LIGHT_FREEZING_RAIN'
  | 'FREEZING_DRIZZLE'
  | 'RAIN_COLD_SOAK'
  | 'FREEZING_FOG'
  | 'COLD_SOAK'
  | 'NONE'
export type Intensity = 'LIGHT' | 'MODERATE' | 'HEAVY'

export interface HOTCell {
  lower: number // minuta
  upper: number // minuta
}

// Type I HOT (svi proizvođači)
// Izvor: Transport Canada HOT Tables 2024-2025
export const HOT_TYPE_I: Record<string, HOTCell> = {
  // OAT > -3°C
  'SNOW_LIGHT_-3+': { lower: 9, upper: 20 },
  'SNOW_MODERATE_-3+': { lower: 6, upper: 15 },
  'SNOW_HEAVY_-3+': { lower: 3, upper: 8 },
  'FREEZING_DRIZZLE_-3+': { lower: 9, upper: 20 },
  'LIGHT_FREEZING_RAIN_-3+': { lower: 6, upper: 15 },
  'RAIN_COLD_SOAK_-3+': { lower: 9, upper: 20 },
  'FREEZING_FOG_-3+': { lower: 14, upper: 30 },
  // OAT -3 do -6°C
  'SNOW_LIGHT_-3-6': { lower: 6, upper: 15 },
  'SNOW_MODERATE_-3-6': { lower: 4, upper: 10 },
  'SNOW_HEAVY_-3-6': { lower: 2, upper: 6 },
  'FREEZING_DRIZZLE_-3-6': { lower: 5, upper: 15 },
  'LIGHT_FREEZING_RAIN_-3-6': { lower: 4, upper: 10 },
  'FREEZING_FOG_-3-6': { lower: 10, upper: 30 },
  // OAT -6 do -10°C
  'SNOW_LIGHT_-6-10': { lower: 5, upper: 12 },
  'SNOW_MODERATE_-6-10': { lower: 3, upper: 8 },
  'SNOW_HEAVY_-6-10': { lower: 2, upper: 5 },
  'FREEZING_FOG_-6-10': { lower: 8, upper: 25 },
  // OAT < -10°C
  'SNOW_LIGHT_-10-': { lower: 4, upper: 10 },
  'SNOW_MODERATE_-10-': { lower: 2, upper: 6 },
  'SNOW_HEAVY_-10-': { lower: 1, upper: 4 },
  'FREEZING_FOG_-10-': { lower: 8, upper: 25 },
}

// Type II/IV HOT (zajednička tabela — razlika je u proizvođaču)
// Izvor: Transport Canada HOT Tables 2024-2025
// Format: `${PRECIP}_${INTENSITY}_${CONC}_${TEMP_RANGE}`

export const HOT_TYPE_II_IV: Record<string, HOTCell> = {
  // ========================================================================
  // 50/50 concentration
  // ========================================================================
  // OAT > -3°C
  'SNOW_LIGHT_50/50_-3+': { lower: 14, upper: 30 },
  'SNOW_MODERATE_50/50_-3+': { lower: 10, upper: 22 },
  'SNOW_HEAVY_50/50_-3+': { lower: 6, upper: 13 },
  'FREEZING_DRIZZLE_50/50_-3+': { lower: 8, upper: 22 },
  'LIGHT_FREEZING_RAIN_50/50_-3+': { lower: 6, upper: 16 },
  'RAIN_COLD_SOAK_50/50_-3+': { lower: 9, upper: 25 },
  'FREEZING_FOG_50/50_-3+': { lower: 14, upper: 30 },
  // OAT -3 do -14°C (Type II/IV radi do -14 za 50/50)
  'SNOW_LIGHT_50/50_-3-14': { lower: 10, upper: 22 },
  'SNOW_MODERATE_50/50_-3-14': { lower: 7, upper: 15 },
  'SNOW_HEAVY_50/50_-3-14': { lower: 4, upper: 9 },
  'FREEZING_DRIZZLE_50/50_-3-14': { lower: 6, upper: 16 },
  'FREEZING_FOG_50/50_-3-14': { lower: 11, upper: 28 },

  // ========================================================================
  // 75/25 concentration
  // ========================================================================
  // OAT > -3°C
  'SNOW_LIGHT_75/25_-3+': { lower: 25, upper: 50 },
  'SNOW_MODERATE_75/25_-3+': { lower: 16, upper: 35 },
  'SNOW_HEAVY_75/25_-3+': { lower: 9, upper: 20 },
  'FREEZING_DRIZZLE_75/25_-3+': { lower: 14, upper: 35 },
  'LIGHT_FREEZING_RAIN_75/25_-3+': { lower: 9, upper: 25 },
  'RAIN_COLD_SOAK_75/25_-3+': { lower: 15, upper: 40 },
  'FREEZING_FOG_75/25_-3+': { lower: 22, upper: 50 },
  // OAT -3 do -25°C
  'SNOW_LIGHT_75/25_-3-25': { lower: 19, upper: 40 },
  'SNOW_MODERATE_75/25_-3-25': { lower: 12, upper: 26 },
  'SNOW_HEAVY_75/25_-3-25': { lower: 6, upper: 14 },
  'FREEZING_DRIZZLE_75/25_-3-25': { lower: 10, upper: 26 },
  'FREEZING_FOG_75/25_-3-25': { lower: 17, upper: 40 },

  // ========================================================================
  // 100/0 concentration
  // ========================================================================
  // OAT > -3°C
  'SNOW_LIGHT_100/0_-3+': { lower: 38, upper: 75 },
  'SNOW_MODERATE_100/0_-3+': { lower: 23, upper: 50 },
  'SNOW_HEAVY_100/0_-3+': { lower: 12, upper: 27 },
  'FREEZING_DRIZZLE_100/0_-3+': { lower: 19, upper: 50 },
  'LIGHT_FREEZING_RAIN_100/0_-3+': { lower: 11, upper: 30 },
  'RAIN_COLD_SOAK_100/0_-3+': { lower: 18, upper: 50 },
  'FREEZING_FOG_100/0_-3+': { lower: 30, upper: 70 },
  // OAT -3 do -14°C
  'SNOW_LIGHT_100/0_-3-14': { lower: 30, upper: 60 },
  'SNOW_MODERATE_100/0_-3-14': { lower: 16, upper: 35 },
  'SNOW_HEAVY_100/0_-3-14': { lower: 8, upper: 18 },
  'FREEZING_DRIZZLE_100/0_-3-14': { lower: 13, upper: 35 },
  'FREEZING_FOG_100/0_-3-14': { lower: 25, upper: 60 },
  // OAT -14 do -25°C
  'SNOW_LIGHT_100/0_-14-25': { lower: 23, upper: 50 },
  'SNOW_MODERATE_100/0_-14-25': { lower: 12, upper: 27 },
  'SNOW_HEAVY_100/0_-14-25': { lower: 6, upper: 14 },
  'FREEZING_FOG_100/0_-14-25': { lower: 20, upper: 50 },

  // ========================================================================
  // COLD SOAK DRY (not applicable for HOT, but include)
  // ========================================================================
  'COLD_SOAK_50/50_-3+': { lower: 9, upper: 25 },
  'COLD_SOAK_75/25_-3+': { lower: 15, upper: 40 },
  'COLD_SOAK_100/0_-3+': { lower: 18, upper: 50 },
}

// Type III (newer type, less common)
export const HOT_TYPE_III: Record<string, HOTCell> = {
  'SNOW_LIGHT_100/0_-3+': { lower: 30, upper: 55 },
  'SNOW_MODERATE_100/0_-3+': { lower: 18, upper: 35 },
  'SNOW_HEAVY_100/0_-3+': { lower: 10, upper: 22 },
  'FREEZING_DRIZZLE_100/0_-3+': { lower: 15, upper: 35 },
  'LIGHT_FREEZING_RAIN_100/0_-3+': { lower: 9, upper: 22 },
  'FREEZING_FOG_100/0_-3+': { lower: 22, upper: 50 },
  'SNOW_LIGHT_100/0_-3-14': { lower: 22, upper: 42 },
  'SNOW_MODERATE_100/0_-3-14': { lower: 13, upper: 27 },
  'SNOW_HEAVY_100/0_-3-14': { lower: 7, upper: 15 },
  'FREEZING_FOG_100/0_-3-14': { lower: 18, upper: 42 },
  'SNOW_LIGHT_100/0_-14-25': { lower: 17, upper: 35 },
  'SNOW_MODERATE_100/0_-14-25': { lower: 10, upper: 22 },
  'SNOW_HEAVY_100/0_-14-25': { lower: 5, upper: 12 },
}

// Helper: get temperature range key — universal (used for Type I)
export function getTempRangeKey(oat: number): string {
  if (oat >= -3) return '-3+'
  if (oat >= -6) return '-3-6'
  if (oat >= -10) return '-6-10'
  if (oat >= -14) return '-3-14'
  if (oat >= -25) return '-14-25'
  return '-10-' // ispod -25 (Type I limit) / ispod -10 za Type I
}

// Helper: get temperature range key for Type II/IV (different ranges than Type I)
// Type II/IV radi do -25°C za 100/0, do -14°C za 50/50 i 75/25
// Napomena: Tabela koristi "-3-25" range za 75/25 (ne dvije odvojene -3-14 i -14-25)
export function getTempRangeKeyTypeIIIV(oat: number, concentration: Concentration): string {
  if (oat >= -3) return '-3+'
  // 50/50 radi do -14°C
  if (concentration === '50/50') {
    if (oat >= -14) return '-3-14'
    return '-10-' // ispod limita
  }
  // 75/25 ima samo "-3-25" range (od -3 do -25)
  if (concentration === '75/25') {
    if (oat >= -25) return '-3-25'
    return '-10-'
  }
  // 100/0 radi do -25°C sa dvije podjele: -3-14 i -14-25
  if (oat >= -14) return '-3-14'
  if (oat >= -25) return '-14-25'
  return '-10-'
}

// Helper: get HOT key
export function getHOTKey(
  fluidType: FluidType,
  concentration: Concentration,
  precipitation: PrecipitationType,
  intensity: Intensity | undefined,
  oat: number
): string {
  // Type I ne koristi concentration u ključu
  if (fluidType === 'TYPE_I') {
    const tempRange = getTempRangeKey(oat)
    if (precipitation === 'FREEZING_FOG') {
      return `${precipitation}_${tempRange}`
    }
    return `${precipitation}_${intensity || 'LIGHT'}_${tempRange}`
  }
  if (fluidType === 'TYPE_III') {
    const tempRange = getTempRangeKey(oat)
    if (precipitation === 'FREEZING_FOG') {
      return `${precipitation}_${tempRange}`
    }
    return `${precipitation}_${intensity || 'LIGHT'}_${tempRange}`
  }
  // Type II/IV
  const conc = concentration || '100/0'
  const tempRange = getTempRangeKeyTypeIIIV(oat, conc as Concentration)
  if (precipitation === 'COLD_SOAK' || precipitation === 'RAIN_COLD_SOAK') {
    return `${precipitation}_${conc}_-3+`
  }
  // FREEZING_FOG ne koristi intenzitet u HOT tabelama
  if (precipitation === 'FREEZING_FOG') {
    return `${precipitation}_${conc}_${tempRange}`
  }
  return `${precipitation}_${intensity || 'LIGHT'}_${conc}_${tempRange}`
}

// Glavna funkcija — vraća HOT u minutama
export function calculateHOT(
  fluidType: FluidType,
  concentration: Concentration | undefined,
  precipitation: PrecipitationType,
  intensity: Intensity | undefined,
  oat: number
): { hotMinutes: number | null; tableRef: string; note?: string } {
  if (precipitation === 'NONE') {
    return { hotMinutes: null, tableRef: '', note: 'Nema padavina — HOT nije primjenjiv' }
  }

  let table: Record<string, HOTCell>
  let conc: Concentration

  if (fluidType === 'TYPE_I') {
    table = HOT_TYPE_I
    conc = '100/0' // Type I je uvijek 100/0 (ili heated)
  } else if (fluidType === 'TYPE_III') {
    table = HOT_TYPE_III
    conc = '100/0'
  } else {
    // Type II/IV
    table = HOT_TYPE_II_IV
    conc = concentration || '100/0'
  }

  const key = getHOTKey(fluidType, conc, precipitation, intensity, oat)
  const cell = table[key]

  if (!cell) {
    return {
      hotMinutes: null,
      tableRef: `${fluidType} ${conc} - ${precipitation} ${intensity || ''} @ ${oat}°C`,
      note: 'Nije pronađeno u tabeli — provjerite uslove',
    }
  }

  // Uzimamo donju granicu kao sigurnosnu (preporuka ICAO)
  return {
    hotMinutes: cell.lower,
    tableRef: `${fluidType} ${conc} - ${precipitation} ${intensity || ''} @ ${oat}°C`,
    note: `Range: ${cell.lower}-${cell.upper} min (korištena donja granica)`,
  }
}

// Labele
export const FLUID_TYPE_LABELS: Record<FluidType, string> = {
  TYPE_I: 'Type I (Newtonian)',
  TYPE_II: 'Type II (Non-Newtonian)',
  TYPE_III: 'Type III (Non-Newtonian)',
  TYPE_IV: 'Type IV (Non-Newtonian)',
}

export const CONCENTRATION_LABELS: Record<Concentration, string> = {
  '50/50': '50/50 (Fluid/Water)',
  '75/25': '75/25 (Fluid/Water)',
  '100/0': '100/0 (Neat Fluid)',
}

export const PRECIPITATION_LABELS: Record<PrecipitationType, string> = {
  SNOW: 'Snijeg',
  LIGHT_FREEZING_RAIN: 'Lagani ledeni pljusak',
  FREEZING_DRIZZLE: 'Ledeni rominjanje',
  RAIN_COLD_SOAK: 'Kiša na hladnom krilu',
  FREEZING_FOG: 'Ledena magla',
  COLD_SOAK: 'Hladno krilo',
  NONE: 'Bez padavina',
}

export const INTENSITY_LABELS: Record<Intensity, string> = {
  LIGHT: 'Lagano',
  MODERATE: 'Umjereno',
  HEAVY: 'Jake',
}

export const OPERATION_TYPE_LABELS: Record<string, string> = {
  DEICING: 'De-icing (uklanjanje leda)',
  ANTI_ICING: 'Anti-icing (prevencija)',
  BOTH: 'De-icing + Anti-icing (oboje)',
}

export const DISPOSAL_METHOD_LABELS: Record<string, string> = {
  RECYCLED: 'Reciklaža',
  INCINERATED: 'Incinacija',
  TREATMENT_PLANT: 'Tretman (postrojenje)',
  COLLECTED_BY_VENDOR: 'Preuzimanje od strane vendora',
}
