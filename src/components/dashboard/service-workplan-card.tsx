'use client'

// Plan rada servisa na stranici "Moj zadatak": tabela + PDF za izabrani period (mjesec / 3 mjeseca / 12 mjeseci).

import { useEffect, useState } from 'react'
import { CalendarClock, FileDown, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getServiceWorkPlan, type WorkPlan } from '@/lib/actions-service-plan'
import { fmtDateBHS, HORIZON_LABEL, type WorkPlanHorizon } from '@/lib/service-plan'

const HORIZONS: WorkPlanHorizon[] = ['THIS_MONTH', 'NEXT_MONTH', 'QUARTER', 'YEAR']
const REASON: Record<string, string> = { DATE: 'Rok (12 mj.)', KM: 'Kilometri', HOURS: 'Radni sati' }
const MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar']
const monthName = (k: string) => `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`

export function ServiceWorkPlanCard() {
  const [h, setH] = useState<WorkPlanHorizon>('NEXT_MONTH')
  const [plan, setPlan] = useState<WorkPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getServiceWorkPlan(h)
      .then((p) => { if (!cancelled) { setPlan(p); setError(null) } })
      .catch((e) => { if (!cancelled) setError(e?.message ?? 'Plan rada nije učitan') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [h])

  // grupisanje po mjesecima (dospjela posebno, na vrhu)
  const groups: Array<{ title: string; items: WorkPlan['items'] }> = []
  if (plan) {
    const over = plan.items.filter((i) => i.overdue)
    if (over.length) groups.push({ title: 'Dospjelo — odmah', items: over })
    for (const m of plan.byMonth) groups.push({ title: monthName(m.month), items: plan.items.filter((i) => !i.overdue && i.date.startsWith(m.month)) })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2"><CalendarClock className="h-4 w-4" />Plan rada — servisi sredstava</span>
          <Button size="sm" variant="outline" asChild>
            <a href={`/api/reports/service-workplan?h=${h}`} target="_blank" rel="noopener noreferrer"><FileDown className="h-4 w-4 mr-1" />PDF</a>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {HORIZONS.map((x) => (
            <Button key={x} size="sm" variant={h === x ? 'default' : 'outline'} onClick={() => setH(x)}>{HORIZON_LABEL[x]}</Button>
          ))}
        </div>

        {loading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Računam plan…</div>}
        {error && <p className="text-red-700">{error}</p>}

        {plan && !loading && (
          <>
            <p className="text-muted-foreground">
              {fmtDateBHS(plan.from)} – {fmtDateBHS(plan.to)} · ukupno <b>{plan.totals.all}</b> servisa na <b>{plan.totals.equipment}</b> sredstava
              {' '}(eksterni serviser: {plan.totals.external}, interno: {plan.totals.internal}{plan.totals.overdue ? `, dospjelo: ${plan.totals.overdue}` : ''}).
              Datumi su procjena na osnovu dosadašnje potrošnje km/sati; plan se sam ažurira kad se evidentira servis.
            </p>
            {plan.items.length === 0 && <p>Nema planiranih servisa u ovom periodu.</p>}
            {groups.map((g) => (
              <div key={g.title}>
                <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${g.title.startsWith('Dospjelo') ? 'text-red-700' : 'text-muted-foreground'}`}>{g.title} ({g.items.length})</div>
                <div className="overflow-x-auto rounded border">
                  <table className="w-full text-left">
                    <thead className="bg-muted/50 text-xs">
                      <tr><th className="p-2">Datum</th><th className="p-2">Sredstvo</th><th className="p-2">Osnov</th><th className="p-2">Ko servisira</th></tr>
                    </thead>
                    <tbody>
                      {g.items.map((i, idx) => (
                        <tr key={`${i.code}-${i.date}-${idx}`} className="border-t">
                          <td className="p-2 whitespace-nowrap">{i.overdue ? 'odmah' : fmtDateBHS(i.date)}</td>
                          <td className="p-2"><b>{i.code}</b> <span className="text-muted-foreground">{i.name}</span></td>
                          <td className="p-2 whitespace-nowrap">{REASON[i.reason]}</td>
                          <td className="p-2">{i.external ? <span className="text-blue-800">{i.provider ?? 'Eksterni'}{i.phone ? ` · ${i.phone}` : ''}</span> : 'Interno'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {plan.noBaseline.length > 0 && (
              <p className="text-xs text-muted-foreground">Nisu u planu jer nemaju upisan zadnji servis ({plan.noBaseline.length}): {plan.noBaseline.slice(0, 8).map((n) => n.code).join(', ')}{plan.noBaseline.length > 8 ? '…' : ''}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
