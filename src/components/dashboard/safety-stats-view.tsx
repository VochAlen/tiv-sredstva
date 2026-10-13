'use client'

// Statistika FOD & Wildlife (admin): mjesečna / tromjesečna / polugodišnja / godišnja,
// po vrsti prijave, vrsti životinje, vremenskim uslovima, zonama aerodroma + trend. PDF za štampu.

import { useCallback, useEffect, useState } from 'react'
import { BarChart3, FileDown, Loader2, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getSafetyStats, type SafetyStats, type CountRow } from '@/lib/actions-safety-stats'
import { PERIOD_SHORT, type StatsPeriod } from '@/lib/safety-stats-shared'
import { WeatherIcon } from '@/components/weather-picker'

const pretty = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`
const monthLabel = (k: string) => `${k.slice(5, 7)}/${k.slice(2, 4)}`

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (cur === prev) return <span className="text-xs text-muted-foreground">isto kao prije</span>
  const up = cur > prev
  const Icon = up ? TrendingUp : TrendingDown
  const pct = prev > 0 ? ` (${up ? '+' : ''}${Math.round(((cur - prev) / prev) * 100)}%)` : ''
  return <span className={`text-xs inline-flex items-center gap-1 ${up ? 'text-red-700' : 'text-emerald-700'}`}><Icon className="h-3 w-3" />{up ? '+' : ''}{cur - prev}{pct} vs. prethodni period</span>
}

function BarList({ rows, empty = 'Nema podataka za izabrani period.' }: { rows: Array<CountRow & { extra?: string }>; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">{empty}</p>
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: r.color }} />
          <span className="w-40 sm:w-48 truncate">{r.label}</span>
          <div className="flex-1 h-3 bg-muted rounded"><div className="h-3 rounded" style={{ width: `${(r.count / max) * 100}%`, background: r.color }} /></div>
          <span className="w-10 text-right font-semibold tabular-nums">{r.count}</span>
          {r.extra && <span className="hidden sm:inline text-xs text-muted-foreground w-24">{r.extra}</span>}
        </div>
      ))}
    </div>
  )
}

export function SafetyStatsView() {
  const [period, setPeriod] = useState<StatsPeriod>('3m')
  const [stats, setStats] = useState<SafetyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getSafetyStats(period)
      .then((s) => { setStats(s); setError(null) })
      .catch((e) => { setError(e?.message ?? 'Statistika nije učitana'); toast.error('Statistika nije učitana') })
      .finally(() => setLoading(false))
  }, [period])
  useEffect(() => { load() }, [load])

  const maxTrend = Math.max(1, ...(stats?.trend ?? []).map((t) => t.fod + t.wildlife))
  const maxWx = Math.max(1, ...(stats?.weather ?? []).map((w) => w.total))

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />Statistika FOD & Wildlife</CardTitle>
              {stats && <p className="text-xs text-muted-foreground mt-1">{stats.label} statistika: {pretty(stats.from)} – {pretty(stats.to)} (poređenje s istim prethodnim periodom)</p>}
            </div>
            <Button size="sm" onClick={() => window.open(`/api/reports/safety-stats?period=${period}`, '_blank')}>
              <FileDown className="h-4 w-4 mr-1" />PDF izvještaj
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(PERIOD_SHORT) as StatsPeriod[]).map((p) => (
              <Button key={p} size="sm" variant={period === p ? 'default' : 'outline'} onClick={() => setPeriod(p)}>{PERIOD_SHORT[p]}</Button>
            ))}
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </CardContent>
      </Card>

      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              ['Ukupno prijava', stats.totals.all, stats.previous.all, 'text-blue-700'],
              ['FOD', stats.totals.fod, stats.previous.fod, 'text-amber-700'],
              ['Wildlife', stats.totals.wildlife, stats.previous.wildlife, 'text-emerald-700'],
              ['Sudari sa životinjama', stats.totals.strikes, stats.previous.strikes, 'text-red-700'],
            ] as const).map(([label, cur, prev, cls]) => (
              <div key={label} className="p-4 rounded-lg border bg-muted/20">
                <div className="text-xs font-medium text-muted-foreground">{label}</div>
                <div className={`text-2xl font-bold ${cls}`}>{cur}</div>
                <Delta cur={cur} prev={prev} />
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Po vrsti prijave</CardTitle></CardHeader>
              <CardContent><BarList rows={stats.byType} /></CardContent></Card>

            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Po vrsti životinje <span className="font-normal text-muted-foreground">(prijava / jedinki / sudara)</span></CardTitle></CardHeader>
              <CardContent><BarList rows={stats.species.map((s) => ({ ...s, extra: `${s.animals} jed.${s.strikes ? ` · ${s.strikes} sud.` : ''}` }))} /></CardContent></Card>

            <Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-sm">Po vremenskim uslovima <span className="font-normal text-muted-foreground">(FOD + wildlife)</span></CardTitle></CardHeader>
              <CardContent>
                {stats.weather.length === 0 ? <p className="text-xs text-muted-foreground">Nema podataka za izabrani period.</p> : (
                  <div className="space-y-1.5">
                    {stats.weather.map((w) => (
                      <div key={w.id} className="flex items-center gap-2 text-sm">
                        <WeatherIcon id={w.id} className="h-4 w-4 flex-shrink-0" />
                        <span className="w-28 truncate">{w.label}</span>
                        <div className="flex-1 h-3 bg-muted rounded flex overflow-hidden">
                          <div className="h-3 bg-amber-500" style={{ width: `${(w.fod / maxWx) * 100}%` }} title={`FOD ${w.fod}`} />
                          <div className="h-3 bg-emerald-500" style={{ width: `${(w.wildlife / maxWx) * 100}%` }} title={`Wildlife ${w.wildlife}`} />
                        </div>
                        <span className="w-10 text-right font-semibold tabular-nums">{w.total}</span>
                        <span className="hidden sm:inline text-xs text-muted-foreground w-44">FOD {w.fod} · Wildlife {w.wildlife}{w.strikes ? ` · sudara ${w.strikes}` : ''}</span>
                      </div>
                    ))}
                    <div className="flex gap-4 pt-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />FOD</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Wildlife</span>
                      <span>„Nije upisano“ = starije prijave bez vremenskih uslova</span>
                    </div>
                  </div>
                )}
              </CardContent></Card>

            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">FOD po vrsti predmeta</CardTitle></CardHeader>
              <CardContent><BarList rows={stats.fodItems} /></CardContent></Card>

            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Wildlife po zoni aerodroma</CardTitle></CardHeader>
              <CardContent><BarList rows={stats.zones} /></CardContent></Card>

            <Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-sm">Trend po mjesecima</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 h-36">
                  {stats.trend.map((t) => (
                    <div key={t.month} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
                      <span className="text-[11px] font-semibold tabular-nums">{t.fod + t.wildlife}</span>
                      <div className="w-full max-w-10 flex flex-col-reverse rounded-t overflow-hidden" style={{ height: `${((t.fod + t.wildlife) / maxTrend) * 100}%`, minHeight: t.fod + t.wildlife ? 3 : 0 }}>
                        <div className="bg-amber-500" style={{ flex: t.fod }} title={`FOD ${t.fod}`} />
                        <div className="bg-emerald-500" style={{ flex: t.wildlife }} title={`Wildlife ${t.wildlife}`} />
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1">{monthLabel(t.month)}</span>
                    </div>
                  ))}
                </div>
              </CardContent></Card>
          </div>
        </>
      )}
    </div>
  )
}
