'use client'

import { Cloud, CloudFog, CloudLightning, CloudRain, Snowflake, Sun, ThermometerSnowflake, Wind } from 'lucide-react'
import { WEATHER } from '@/lib/weather-conditions'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  SUNNY: Sun, CLOUDY: Cloud, RAIN: CloudRain, WIND: Wind, FOG: CloudFog, SNOW: Snowflake, ICE: ThermometerSnowflake, STORM: CloudLightning,
}

export function WeatherIcon({ id, className }: { id: string; className?: string }) {
  const Icon = ICONS[id] ?? Cloud
  return <Icon className={className} />
}

/** Izbor glavnog vremenskog uslova (jedan dodir). */
export function WeatherPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {WEATHER.map((w) => (
        <button
          key={w.id}
          type="button"
          onClick={() => onChange(w.id)}
          aria-pressed={value === w.id}
          className={`min-h-14 rounded-lg border-2 px-1 py-1.5 text-[11px] font-semibold flex flex-col items-center justify-center gap-0.5 leading-tight ${value === w.id ? 'border-primary bg-primary/10' : 'border-border'}`}
        >
          <WeatherIcon id={w.id} className="h-5 w-5" />
          <span className="text-center">{w.label}</span>
        </button>
      ))}
    </div>
  )
}
