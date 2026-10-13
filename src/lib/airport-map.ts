// Shematska mapa aerodroma Tivat (LYTV) - zajednička geometrija i šifarnik vrsta.
// Koristi se i na klijentu (prijava, heatmapa) i na serveru (validacija) - bez 'use server'.
//
// Pista je u razmjeri: 2500 m x 45 m. Horizontalna razmjera: 0.36 jedinica / m
// (pista = 900 jedinica od x=50 do x=950, širina 45 m = 16.2 jedinica).
// Mapa nije satelitski snimak nego shema (nema licenci, radi bez interneta).
//
// NAPOMENA: smjer označavanja trećina (1/3 = lijeva strana mape) i oznake pragova
// podešavaju se konstantama THRESHOLD_LEFT / THRESHOLD_RIGHT ispod.

export const MAP_W = 1000
export const MAP_H = 320

export const RUNWAY = { x0: 50, x1: 950, y0: 258, y1: 258 + 16.2, lengthM: 2500, widthM: 45 }
export const THRESHOLD_LEFT = '14'
export const THRESHOLD_RIGHT = '32'
export const THIRD_BOUNDS = [350, 650] // granice 1/3 | 2/3 | 3/3 po x

type Rect = { x0: number; y0: number; x1: number; y1: number }

// Površine (u jedinicama mape)
export const APRON_RECTS: Rect[] = [
  { x0: 120, y0: 70, x1: 540, y1: 168 }, // glavni apron
  { x0: 600, y0: 70, x1: 700, y1: 150 }, // desni apron
]
export const TERMINAL_RECT: Rect = { x0: 150, y0: 36, x1: 330, y1: 68 } // zgrada terminala (dekoracija, računa se kao apron)
export const TWY_RECTS: Rect[] = [
  { x0: 70, y0: 150, x1: 120, y1: 258 }, // lijeva veza
  { x0: 70, y0: 226, x1: 600, y1: 246 }, // paralelna rulna staza
  { x0: 540, y0: 150, x1: 600, y1: 258 }, // desna veza
]
export const INFIELD_RECT: Rect = { x0: 120, y0: 168, x1: 540, y1: 226 } // trava unutar rulnih staza
const RWY_STRIP: Rect = { x0: 50, y0: 246, x1: 950, y1: 288 } // zona dodira (pista + bankine)

export type ZoneId = 'RWY_1' | 'RWY_2' | 'RWY_3' | 'TWY' | 'APRON' | 'SURROUNDING'

export interface ZoneDef {
  id: ZoneId
  label: string // za korisnika
  short: string // za dugmad / tabelu
  cx: number
  cy: number
  box: Rect // za nasumični raspored kad nema tačne tačke
}

export const ZONES: ZoneDef[] = [
  { id: 'RWY_1', label: 'Pista 1/3', short: '1/3 piste', cx: 200, cy: 266, box: { x0: 60, y0: 259, x1: 340, y1: 273 } },
  { id: 'RWY_2', label: 'Pista 2/3', short: '2/3 piste', cx: 500, cy: 266, box: { x0: 360, y0: 259, x1: 640, y1: 273 } },
  { id: 'RWY_3', label: 'Pista 3/3', short: '3/3 piste', cx: 800, cy: 266, box: { x0: 660, y0: 259, x1: 940, y1: 273 } },
  { id: 'TWY', label: 'Rulna staza (TWY)', short: 'Rulna staza', cx: 330, cy: 236, box: { x0: 75, y0: 228, x1: 595, y1: 244 } },
  { id: 'APRON', label: 'Apron', short: 'Apron', cx: 330, cy: 120, box: { x0: 130, y0: 80, x1: 530, y1: 160 } },
  { id: 'SURROUNDING', label: 'Okolina aerodroma', short: 'Okolina', cx: 500, cy: 303, box: { x0: 20, y0: 292, x1: 980, y1: 312 } },
]

export const ZONE_IDS = ZONES.map((z) => z.id) as ZoneId[]
export const zoneById = (id: string | null | undefined): ZoneDef | undefined => ZONES.find((z) => z.id === id)
export const zoneLabel = (id: string | null | undefined) => zoneById(id)?.label ?? '—'

const inRect = (x: number, y: number, r: Rect) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1

/** Zona za tačku na mapi (koordinate u jedinicama mape 0..1000 x 0..320). */
export function zoneAt(x: number, y: number): ZoneId {
  if (inRect(x, y, RWY_STRIP)) return x < THIRD_BOUNDS[0] ? 'RWY_1' : x < THIRD_BOUNDS[1] ? 'RWY_2' : 'RWY_3'
  if (APRON_RECTS.some((r) => inRect(x, y, r)) || inRect(x, y, TERMINAL_RECT)) return 'APRON'
  if (TWY_RECTS.some((r) => inRect(x, y, r))) return 'TWY'
  return 'SURROUNDING'
}

// Koordinate se u bazi čuvaju normalizovane (0..1) da ne zavise od dimenzija crteža.
export const toNorm = (x: number, y: number) => ({ mapX: +(x / MAP_W).toFixed(4), mapY: +(y / MAP_H).toFixed(4) })
export const fromNorm = (mapX: number, mapY: number) => ({ x: mapX * MAP_W, y: mapY * MAP_H })

// =====================================================
// Vrste (grupe) - boje za heatmapu
// =====================================================

export interface SpeciesDef {
  id: string
  label: string // upisuje se u wildlife_reports.species
  short: string
  color: string
  keywords: string[] // za prepoznavanje starih prijava upisanih slobodnim tekstom
}

export const SPECIES: SpeciesDef[] = [
  { id: 'GALEB', label: 'Galeb', short: 'Galeb', color: '#2563eb', keywords: ['galeb', 'gull'] },
  { id: 'GOLUB', label: 'Golub', short: 'Golub', color: '#7c3aed', keywords: ['golub', 'pigeon', 'grlic', 'grlica'] },
  { id: 'GAVRAN', label: 'Vrana / čavka / svraka', short: 'Vrana / čavka', color: '#0e7490', keywords: ['vran', 'cavk', 'čavk', 'svrak', 'gavran', 'gavr', 'crow'] },
  { id: 'GRABLJIVICA', label: 'Ptica grabljivica', short: 'Grabljivica', color: '#dc2626', keywords: ['grablj', 'soko', 'sokol', 'jastreb', 'orao', 'orl', 'kanja', 'sova', 'kobac', 'hawk', 'eagle'] },
  { id: 'VODENA', label: 'Vodena ptica (patka, čaplja)', short: 'Vodena ptica', color: '#db2777', keywords: ['patk', 'caplj', 'čaplj', 'labud', 'gus', 'liska', 'liska', 'vodena', 'ronac', 'kormoran', 'duck', 'heron'] },
  { id: 'SITNE', label: 'Sitne ptice (jato)', short: 'Sitne ptice', color: '#ca8a04', keywords: ['cvorak', 'čvorak', 'lasta', 'vrabac', 'vrabc', 'sitn', 'jato', 'pjevic', 'ševa', 'seva', 'starling', 'swallow'] },
  { id: 'ZEC', label: 'Zec', short: 'Zec', color: '#a16207', keywords: ['zec', 'zeca', 'hare', 'rabbit'] },
  { id: 'LISICA', label: 'Lisica / šakal / jazavac', short: 'Lisica / šakal', color: '#ea580c', keywords: ['lisic', 'sakal', 'šakal', 'jazavac', 'vuk', 'fox', 'jackal'] },
  { id: 'PAS_MACKA', label: 'Pas / mačka', short: 'Pas / mačka', color: '#475569', keywords: ['pas', 'psi', 'psa', 'macka', 'mačka', 'macak', 'dog', 'cat'] },
  { id: 'PAPKAR', label: 'Srna / divlja svinja', short: 'Srna / svinja', color: '#15803d', keywords: ['srn', 'jelen', 'svinj', 'divlja svinja', 'deer', 'boar'] },
  { id: 'OTHER', label: 'Ostalo', short: 'Ostalo', color: '#6b7280', keywords: [] },
]

export const SPECIES_IDS = SPECIES.map((s) => s.id)
export const speciesById = (id: string | null | undefined): SpeciesDef => SPECIES.find((s) => s.id === id) ?? SPECIES[SPECIES.length - 1]

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'dj')

/** Grupa za prijavu: prvo šifra vrste (nove prijave), inače po ključnim riječima iz slobodnog teksta (stare prijave). */
export function speciesGroupOf(code: string | null | undefined, text: string | null | undefined): SpeciesDef {
  if (code && SPECIES.some((s) => s.id === code)) return speciesById(code)
  const t = norm(text ?? '')
  if (!t) return speciesById('OTHER')
  for (const s of SPECIES) {
    if (s.id !== 'OTHER' && s.keywords.some((k) => t.includes(norm(k)))) return s
  }
  return speciesById('OTHER')
}

/** Deterministički "nasumični" raspored za prijave bez tačne tačke (samo zona). */
export function approxPoint(seed: string, zone: ZoneId | string | null | undefined): { x: number; y: number } {
  const z = zoneById(zone) ?? ZONES[ZONES.length - 1]
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  const r1 = ((h >>> 0) % 1000) / 1000
  const r2 = (((h >>> 10) ^ (h << 7)) >>> 0) % 1000 / 1000
  return { x: z.box.x0 + r1 * (z.box.x1 - z.box.x0), y: z.box.y0 + r2 * (z.box.y1 - z.box.y0) }
}
