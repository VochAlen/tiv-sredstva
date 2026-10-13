'use client'

// Heatmapa wildlife opažanja na mapi aerodroma: jedna boja po vrsti, filteri perioda i vrsta,
// tabela po zonama (1/3, 2/3, 3/3 piste, rulna staza, apron, okolina). X na mapi = sudar sa vazduhoplovom.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { AirportMap, type HeatPoint } from '@/components/airport-map'
import { SPECIES, ZONES } from '@/lib/airport-map'
import { getWildlifeMapPoints, type WildlifeMapPoint } from '@/lib/actions-safety-reports'

const PERIODS: Array<[number | null, string]> = [[30, '30 dana'], [90, '90 dana'], [365, '12 mjeseci'], [null, 'Sve']]

export function WildlifeHeatmap({ refreshKey = 0 }: { refreshKey?: number }) {
  const [days, setDays] = useState<number | null>(90)
  const [data, setData] = useState<{ points: WildlifeMapPoint[]; unplaced: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [strikesOnly, setStrikesOnly] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getWildlifeMapPoints({ days })
      .then((d) => { setData(d); setError(null) })
      .catch((e) => { setError(e?.message ?? 'Heatmapa nije učitana'); toast.error('Heatmapa nije učitana') })
      .finally(() => setLoading(false))
  }, [days])
  useEffect(() => { load() }, [load, refreshKey])

  const base = useMemo(() => (data?.points ?? []).filter((p) => !strikesOnly || p.strike), [data, strikesOnly])
  const active = useMemo(() => new Set(SPECIES.map((s) => s.id).filter((id) => !hidden.has(id))), [hidden])
  const heatPoints: HeatPoint[] = useMemo(() => base.map((p) => ({ id: p.id, x: p.x, y: p.y, count: p.count, strike: p.strike, speciesId: p.speciesId })), [base])

  const perSpecies = useMemo(() => {
    const m = new Map<string, { reports: number; animals: number }>()
    for (const p of base) {
      const c = m.get(p.speciesId) ?? { reports: 0, animals: 0 }
      c.reports += 1; c.animals += p.count
      m.set(p.speciesId, c)
    }
    return m
  }, [base])

  const perZone = useMemo(() => {
    const visible = base.filter((p) => active.has(p.speciesId))
    return ZONES.map((z) => {
      const pts = visible.filter((p) => p.zone === z.id)
      const bySp = new Map<string, number>()
      for (const p of pts) bySp.set(p.speciesId, (bySp.get(p.speciesId) ?? 0) + 1)
      return { zone: z, total: pts.length, strikes: pts.filter((p) => p.strike).length, bySp: [...bySp.entries()].sort((a, b) => b[1] - a[1]) }
    })
  }, [base, active])
  const maxZone = Math.max(1, ...perZone.map((z) => z.total))

  const toggle = (id: string) => setHidden((h) => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" />Mapa i heatmapa opažanja</CardTitle>
        <p className="text-xs text-muted-foreground">Svaka boja je jedna vrsta; što je boja jača, to je više prijava na tom mjestu. Znak ⊗ je sudar sa vazduhoplovom.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map(([v, l]) => (
            <Button key={l} size="sm" variant={days === v ? 'default' : 'outline'} onClick={() => setDays(v)}>{l}</Button>
          ))}
          <span className="w-px h-6 bg-border mx-1" />
          <Button size="sm" variant={strikesOnly ? 'default' : 'outline'} onClick={() => setStrikesOnly((v) => !v)}>Samo sudari</Button>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {error && <p className="text-sm text-red-600">{error}. Ako je tek postavljena nova verzija, pokrenite migraciju 030_wildlife_map.sql.</p>}

        <AirportMap mode="heat" points={heatPoints} activeSpecies={active} />

        <div className="flex flex-wrap items-center gap-1.5">
          {SPECIES.map((sp) => {
            const c = perSpecies.get(sp.id)
            const off = hidden.has(sp.id)
            return (
              <button
                key={sp.id}
                type="button"
                onClick={() => toggle(sp.id)}
                disabled={!c}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${off ? 'opacity-40' : ''} ${!c ? 'opacity-30' : ''}`}
                title={c ? `${c.reports} prijava, ${c.animals} jedinki` : 'Nema prijava'}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: sp.color }} />
                {sp.short}{c ? ` (${c.reports})` : ''}
              </button>
            )
          })}
          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setHidden(new Set())}>Sve</Button>
          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setHidden(new Set(SPECIES.map((s) => s.id)))}>Nijedna</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-1.5 pr-3 font-medium">Zona</th>
                <th className="py-1.5 pr-3 font-medium w-40">Prijava</th>
                <th className="py-1.5 pr-3 font-medium">Sudari</th>
                <th className="py-1.5 font-medium">Vrste</th>
              </tr>
            </thead>
            <tbody>
              {perZone.map(({ zone, total, strikes, bySp }) => (
                <tr key={zone.id} className="border-b last:border-0 align-top">
                  <td className="py-1.5 pr-3 font-medium whitespace-nowrap">{zone.label}</td>
                  <td className="py-1.5 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 bg-muted rounded"><div className="h-2 rounded bg-primary" style={{ width: `${(total / maxZone) * 100}%` }} /></div>
                      <span className="font-semibold tabular-nums">{total}</span>
                    </div>
                  </td>
                  <td className={`py-1.5 pr-3 tabular-nums ${strikes ? 'text-red-700 font-semibold' : 'text-muted-foreground'}`}>{strikes}</td>
                  <td className="py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {bySp.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      {bySp.map(([id, n]) => {
                        const sp = SPECIES.find((s) => s.id === id)!
                        return (
                          <span key={id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                            <span className="h-2 w-2 rounded-full" style={{ background: sp.color }} />{sp.short} {n}
                          </span>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && data.unplaced > 0 && (
          <p className="text-xs text-muted-foreground">
            {data.unplaced} starijih prijava (prije uvođenja mape) nema označenu lokaciju pa nisu prikazane na mapi; i dalje su u listi ispod.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
