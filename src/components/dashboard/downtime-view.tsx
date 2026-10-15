'use client'

// Statistika zastoja za mjesec: prosječno vrijeme popravke, raspoloživost po sredstvu, kvarovi po tipu, najčešći uzroci.
// Podaci dolaze iz postojećih prijava kvarova (bez dodatnog unosa).

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, FileDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { getDowntimeStats } from '@/lib/actions-workshop-extras'
import type { DowntimeStats } from '@/lib/downtime'
import { EQUIPMENT_TYPE_LABELS } from '@/lib/types'

const MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar']
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}.`
const shift = (m: string, n: number) => {
  const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}
const nowMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Podgorica', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7)
const hoursText = (h: number | null) => (h == null ? '—' : h >= 48 ? `${Math.round((h / 24) * 10) / 10} dana` : `${h} h`)

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

function Simple({ title, rows, mapLabel }: { title: string; rows: Array<{ label: string; count: number }>; mapLabel?: (l: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1.5">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Nema podataka za ovaj mjesec.</p>}
        {rows.map((r) => (
          <div key={r.label} className="text-sm">
            <div className="flex justify-between gap-2"><span className="truncate">{mapLabel ? mapLabel(r.label) : r.label}</span><span className="font-semibold tabular-nums">{r.count}</span></div>
            <div className="h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${(r.count / max) * 100}%` }} /></div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function DowntimeView() {
  const [month, setMonth] = useState(nowMonth())
  const [data, setData] = useState<DowntimeStats | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    setLoading(true)
    getDowntimeStats(month)
      .then((r) => { if (alive) setData(r) })
      .catch((e) => { toast.error(`Statistika nije učitana: ${e?.message ?? e}`); if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [month])

  const isCurrent = month >= nowMonth()
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" className="h-10 w-10" aria-label="Prethodni mjesec" onClick={() => setMonth(shift(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="min-w-[10rem] text-center text-base font-semibold">{monthLabel(month)}</div>
        <Button variant="outline" size="icon" className="h-10 w-10" aria-label="Sljedeći mjesec" disabled={isCurrent} onClick={() => setMonth(shift(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="outline" className="ml-auto h-10" onClick={() => window.open(`/api/reports/zastoji?month=${month}`, '_blank')}>
          <FileDown className="mr-1.5 h-4 w-4" />PDF izvještaj
        </Button>
      </div>

      {loading && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {!loading && !data && <p className="py-6 text-center text-sm text-muted-foreground">Podaci nisu dostupni.</p>}
      {!loading && data && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Kpi label="Prijavljeno kvarova" value={String(data.reported)} hint={`riješeno ${data.resolved}, još otvoreno ${data.stillOpen}`} />
            <Kpi label="Prosječno vrijeme popravke" value={hoursText(data.mttrHours)} hint="od preuzimanja prijave do povratka u rad" />
            <Kpi label="Prosječna reakcija" value={hoursText(data.reactionHours)} hint="od prijave do preuzimanja" />
            <Kpi label="Raspoloživost flote" value={data.fleetAvailabilityPct == null ? '—' : `${data.fleetAvailabilityPct}%`} hint={`${data.fleetSize} sredstava`} />
          </div>
          <p className="text-xs text-muted-foreground">Zastoj se računa dok je otvorena prijava težine MAJOR ili CRITICAL (takva sredstva su blokirana). Manji kvarovi i sredstva s ograničenjem ne ulaze u zastoj. Vrijeme u radionici (doveženo → riješeno): {hoursText(data.workshopHours)}.</p>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Raspoloživost po sredstvu</CardTitle></CardHeader>
            <CardContent>
              {data.byEquipment.length === 0 ? <p className="text-sm text-muted-foreground">Nema kvarova ni zastoja u ovom mjesecu.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-1 pr-2">Sredstvo</th><th className="px-2 text-right">Kvarova</th><th className="px-2 text-right">Zastoj (h)</th><th className="pl-2 text-right">Raspoloživost</th></tr></thead>
                    <tbody>
                      {data.byEquipment.slice(0, 15).map((r) => (
                        <tr key={r.code} className="border-b last:border-0">
                          <td className="py-1.5 pr-2"><span className="font-mono font-semibold">{r.code}</span> <span className="text-muted-foreground">{r.name}</span></td>
                          <td className="px-2 text-right tabular-nums">{r.faults}</td>
                          <td className="px-2 text-right tabular-nums">{r.downtimeHours}</td>
                          <td className={`pl-2 text-right font-semibold tabular-nums ${r.availabilityPct < 90 ? 'text-red-700' : r.availabilityPct < 98 ? 'text-amber-700' : 'text-emerald-700'}`}>{r.availabilityPct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-3">
            <Simple title="Kvarovi po tipu sredstva" rows={data.byType} mapLabel={(l) => (EQUIPMENT_TYPE_LABELS as Record<string, string>)[l] ?? l} />
            <Simple title="Kvarovi po kategoriji" rows={data.byCategory} />
            <Simple title="Najčešći uzroci" rows={data.topCauses} />
          </div>
        </>
      )}
    </div>
  )
}
