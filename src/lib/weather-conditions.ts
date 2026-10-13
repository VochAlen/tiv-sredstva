// Vremenski uslovi u trenutku prijave (FOD i wildlife). Jedan glavni uslov po prijavi.
// Zajednički modul (klijent + server), bez 'use server'.

export interface WeatherDef {
  id: string
  label: string
  color: string
}

export const WEATHER: WeatherDef[] = [
  { id: 'SUNNY', label: 'Sunčano', color: '#f59e0b' },
  { id: 'CLOUDY', label: 'Oblačno', color: '#64748b' },
  { id: 'RAIN', label: 'Kiša', color: '#2563eb' },
  { id: 'WIND', label: 'Vjetar', color: '#0d9488' },
  { id: 'FOG', label: 'Magla', color: '#94a3b8' },
  { id: 'SNOW', label: 'Snijeg', color: '#0ea5e9' },
  { id: 'ICE', label: 'Led / poledica', color: '#6366f1' },
  { id: 'STORM', label: 'Grmljavina', color: '#7c3aed' },
]

export const WEATHER_IDS = WEATHER.map((w) => w.id)
export const UNKNOWN_WEATHER: WeatherDef = { id: 'UNKNOWN', label: 'Nije upisano', color: '#cbd5e1' }
export const weatherById = (id: string | null | undefined): WeatherDef => WEATHER.find((w) => w.id === id) ?? UNKNOWN_WEATHER
export const isWeatherId = (v: unknown): v is string => typeof v === 'string' && WEATHER_IDS.includes(v)
