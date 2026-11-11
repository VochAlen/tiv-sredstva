'use client'

// Pregled usklađenosti sa EASA 139/2014 za održavanje opreme i sredstava (spisak iz src/lib/easa-compliance.ts).

import { useState } from 'react'
import { FileDown, CheckCircle2, CircleDot, XCircle, ClipboardList, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { COMPLIANCE, STATUS_META, ASSESSED_ON, BASIS, countStatuses, type CStatus } from '@/lib/easa-compliance'

const STYLE: Record<CStatus, { pill: string; bar: string; icon: React.ReactNode }> = {
  DONE: { pill: 'bg-emerald-100 text-emerald-800 border-emerald-300', bar: 'bg-emerald-500', icon: <CheckCircle2 className="h-4 w-4" /> },
  PARTIAL: { pill: 'bg-amber-100 text-amber-900 border-amber-300', bar: 'bg-amber-500', icon: <CircleDot className="h-4 w-4" /> },
  MISSING: { pill: 'bg-red-100 text-red-800 border-red-300', bar: 'bg-red-500', icon: <XCircle className="h-4 w-4" /> },
  ORG: { pill: 'bg-slate-100 text-slate-700 border-slate-300', bar: 'bg-slate-400', icon: <ClipboardList className="h-4 w-4" /> },
}
const ORDER: CStatus[] = ['DONE', 'PARTIAL', 'MISSING', 'ORG']

export function ComplianceView() {
  const [filter, setFilter] = useState<CStatus | 'ALL'>('ALL')
  const c = countStatuses()
  const pct = (n: number) => `${(n / c.total) * 100}%`

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">Usklađenost sa EASA propisima</h2>
          <p className="text-sm text-muted-foreground">Održavanje opreme, vozila i sredstava. Šta je urađeno u aplikaciji, a šta nije.</p>
        </div>
        <Button className="h-11" onClick={() => window.open('/api/reports/easa-compliance', '_blank')}>
          <FileDown className="h-4 w-4 mr-2" />Štampaj pregled (PDF)
        </Button>
      </div>

      <div className="rounded-2xl border p-4 space-y-3">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {ORDER.map((s) => <div key={s} className={STYLE[s].bar} style={{ width: pct(c[s]) }} />)}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ORDER.map((s) => (
            <button key={s} onClick={() => setFilter(filter === s ? 'ALL' : s)}
              className={`rounded-xl border p-3 text-left transition ${STYLE[s].pill} ${filter === s ? 'ring-2 ring-offset-1 ring-foreground/40' : ''}`}>
              <div className="text-2xl font-extrabold leading-none">{c[s]}</div>
              <div className="text-xs mt-1">{STATUS_META[s].label}</div>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Osnova: {BASIS}. Procjena od {new Date(ASSESSED_ON).toLocaleDateString('hr-HR')}. Ovo je tehnička procjena stanja u aplikaciji, ne pravni zaključak; crnogorski pravilnici nisu uključeni.
          {filter !== 'ALL' && <> Prikazano: <strong>{STATUS_META[filter].short}</strong>. <button className="underline" onClick={() => setFilter('ALL')}>Prikaži sve</button></>}
        </p>
      </div>

      {COMPLIANCE.map((g) => {
        const items = g.items.filter((i) => filter === 'ALL' || i.status === filter)
        if (items.length === 0) return null
        return (
          <section key={g.rule} className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{g.rule}</span>{g.title}
            </h3>
            <div className="space-y-2">
              {items.map((i) => (
                <div key={i.ref} className="rounded-xl border p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-muted-foreground">{i.ref}</div>
                      <div className="text-sm font-medium leading-snug">{i.req}</div>
                      {i.ai && (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800" title="Pitanja za test se mogu pisati uz AI pomoć">
                          <Sparkles className="h-3 w-3" />AI pomoć pri kreiranju pitanja
                        </span>
                      )}
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${STYLE[i.status].pill}`}>
                      {STYLE[i.status].icon}{STATUS_META[i.status].short}
                    </span>
                  </div>
                  <div className="mt-2 text-sm"><span className="text-muted-foreground">U aplikaciji: </span>{i.where}</div>
                  {i.note && <div className="mt-1 text-sm text-muted-foreground">{i.note}</div>}
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
