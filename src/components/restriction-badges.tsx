'use client'

// Jasna oznaka ograničenja upotrebe sredstva ("ispravno, ali ..."), vidljiva jednim pogledom.
// Koristi se u tabeli opreme, kartici kvara, ekranu radnika i dnevnom pregledu.

import { Sun, CloudRain, AlertTriangle } from 'lucide-react'
import { parseRestrictions } from '@/lib/checklist-evaluation'
import type { RestrictionFlag } from '@/lib/types'

const SHORT: Record<string, { text: string; icon: 'sun' | 'rain' }> = {
  DAYTIME_ONLY: { text: 'SAMO PO DANU', icon: 'sun' },
  FAIR_WEATHER_ONLY: { text: 'SAMO LIJEPO VRIJEME', icon: 'rain' },
}

export function toRestrictions(v: unknown): RestrictionFlag[] {
  if (Array.isArray(v)) return v as RestrictionFlag[]
  return parseRestrictions(typeof v === 'string' ? v : null)
}

export function RestrictionBadges({ restrictions, showLabel = false }: { restrictions: unknown; showLabel?: boolean }) {
  const list = toRestrictions(restrictions)
  if (list.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1">
      {list.map((r, i) => {
        const s = SHORT[r.code]
        const Icon = s?.icon === 'sun' ? Sun : s?.icon === 'rain' ? CloudRain : AlertTriangle
        return (
          <span
            key={`${r.code}-${i}`}
            title={r.label}
            className="inline-flex items-center gap-1 rounded-md border border-amber-500 bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-900"
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {s?.text ?? r.label}
            {showLabel && s && <span className="font-normal">— {r.label}</span>}
          </span>
        )
      })}
    </div>
  )
}
