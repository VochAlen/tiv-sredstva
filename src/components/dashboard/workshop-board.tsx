'use client'

// Tab "U radionici": sva sredstva čija je prijava PREUZETA (u popravci ili čekaju pregled šefa) na jednom mjestu.
// Svaki red odmah pokazuje: gdje je sredstvo u toku (čeka dolazak / u popravci / vanjski servis / čeka pregled šefa),
// koliko dana je u radu, ko ga je preuzeo i zadnji status. Klik na red otvara punu karticu sa velikim dugmetom sljedećeg koraka.

import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Truck, UserCheck, Wrench, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { DamageRowCard, type DamageRow } from '@/components/dashboard/damage-row-card'
import { PendingHandoverList } from '@/components/dashboard/workshop-actions'
import { staleInfo, fmtDT } from '@/lib/workshop'
import type { RepeatGroup } from '@/lib/repeat-defects'
import type { AppUser } from '@/lib/auth-server'

type Stage = 'WAIT_ARRIVAL' | 'IN_REPAIR' | 'EXTERNAL' | 'WAIT_CHIEF'
type Filter = 'ALL' | Stage | 'STALE'

const STAGE_LABEL: Record<Stage, string> = {
  WAIT_ARRIVAL: 'Čeka dolazak u radionicu',
  IN_REPAIR: 'U popravci',
  EXTERNAL: 'Kod vanjskog servisa',
  WAIT_CHIEF: 'Čeka pregled šefa službe',
}
const STAGE_CLS: Record<Stage, string> = {
  WAIT_ARRIVAL: 'bg-slate-100 text-slate-800 border-slate-300',
  IN_REPAIR: 'bg-amber-100 text-amber-900 border-amber-300',
  EXTERNAL: 'bg-sky-100 text-sky-900 border-sky-300',
  WAIT_CHIEF: 'bg-purple-100 text-purple-900 border-purple-300',
}
const STAGE_ICON: Record<Stage, typeof Wrench> = { WAIT_ARRIVAL: Truck, IN_REPAIR: Wrench, EXTERNAL: Send, WAIT_CHIEF: UserCheck }

function stageOf(d: any): Stage {
  if (d.status === 'AWAITING_APPROVAL') return 'WAIT_CHIEF'
  if (d.externalSentAt && !d.externalReturnedAt) return 'EXTERNAL'
  if (!d.workshopArrivedAt) return 'WAIT_ARRIVAL'
  return 'IN_REPAIR'
}

const daysSince = (v: unknown): number | null => {
  if (!v) return null
  const t = new Date(v as string).getTime()
  return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 86_400_000)) : null
}

export function WorkshopBoard({ damages, onChanged, currentUser, repeats }: { damages: DamageRow[]; onChanged: () => void; currentUser: AppUser; repeats: RepeatGroup[] }) {
  const [filter, setFilter] = useState<Filter>('ALL')
  const [openId, setOpenId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const list = damages
      .filter((d) => d.status === 'IN_REPAIR' || d.status === 'AWAITING_APPROVAL')
      .map((d) => ({ d, stage: stageOf(d), stale: staleInfo(d as any) }))
    // Prvo upozorenja (3+ dana bez statusa), zatim čekaju pregled šefa, pa najduže u radu
    return list.sort((a, b) =>
      Number(b.stale.due) - Number(a.stale.due)
      || Number(b.stage === 'WAIT_CHIEF') - Number(a.stage === 'WAIT_CHIEF')
      || new Date((a.d as any).acknowledgedAt ?? a.d.createdAt).getTime() - new Date((b.d as any).acknowledgedAt ?? b.d.createdAt).getTime())
  }, [damages])

  const count = (f: Filter) => (f === 'ALL' ? rows.length : f === 'STALE' ? rows.filter((r) => r.stale.due).length : rows.filter((r) => r.stage === f).length)
  const shown = rows.filter((r) => (filter === 'ALL' ? true : filter === 'STALE' ? r.stale.due : r.stage === filter))
  const chips: Array<[Filter, string]> = [['ALL', 'Sva'], ['STALE', 'Upozorenje'], ['WAIT_ARRIVAL', 'Čeka dolazak'], ['IN_REPAIR', 'U popravci'], ['EXTERNAL', 'Vanjski servis'], ['WAIT_CHIEF', 'Čeka šefa']]

  return (
    <div className="space-y-3">
      <PendingHandoverList onChanged={onChanged} />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter">
        {chips.filter(([f]) => f === 'ALL' || count(f) > 0).map(([f, label]) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`h-10 rounded-full border px-4 text-sm font-medium transition ${filter === f ? 'border-primary bg-primary text-primary-foreground' : f === 'STALE' ? 'border-red-400 bg-red-50 text-red-800' : 'bg-background hover:bg-muted'}`}
          >
            {label} <span className="ml-1 font-bold tabular-nums">{count(f)}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? 'Trenutno nema preuzetih sredstava u radionici.' : 'Nema sredstava u ovom filteru.'}
          </CardContent>
        </Card>
      )}

      {shown.map(({ d, stage, stale }) => {
        const x: any = d
        const open = openId === d.id
        const Icon = STAGE_ICON[stage]
        const inWorkshopDays = daysSince(x.workshopArrivedAt)
        const sinceTaken = daysSince(x.acknowledgedAt)
        return (
          <div key={d.id} className={`rounded-lg border-2 ${stale.due ? 'border-red-500' : stage === 'WAIT_CHIEF' ? 'border-purple-300' : 'border-border'}`}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : d.id)}
              aria-expanded={open}
              className="flex w-full items-start gap-3 rounded-lg p-3 text-left hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-base font-bold">{d.equipmentCode}</span>
                  <span className="truncate text-sm">{d.equipmentName}</span>
                  <Badge variant="outline" className="text-xs">{d.severity}</Badge>
                  {repeats.some((g) => g.damageIds.includes(d.id)) && <Badge className="bg-orange-500 text-xs text-white">ponavlja se</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STAGE_CLS[stage]}`}>
                    <Icon className="h-3.5 w-3.5" />{STAGE_LABEL[stage]}
                  </span>
                  {stage === 'EXTERNAL' && x.externalProvider && <span className="text-xs text-muted-foreground">{x.externalProvider}</span>}
                  {stale.due && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700"><AlertTriangle className="h-3.5 w-3.5" />{stale.days} dana bez statusa</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Preuzeo/la: <strong className="text-foreground">{x.acknowledgedBy ?? '-'}</strong>
                  {sinceTaken != null && ` · prije ${sinceTaken === 0 ? 'manje od dan' : `${sinceTaken} d`}`}
                  {x.workshopArrivedAt && ` · u radionici od ${fmtDT(x.workshopArrivedAt)}${inWorkshopDays ? ` (${inWorkshopDays} d)` : ''}`}
                </div>
                <div className="truncate text-sm">{x.lastStatusText ? <>Status: {x.lastStatusText} <span className="text-xs text-muted-foreground">({x.lastStatusBy}, {fmtDT(x.lastStatusAt)})</span></> : <span className="text-muted-foreground">{d.description}</span>}</div>
              </div>
              {open ? <ChevronUp className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" /> : <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />}
            </button>
            {open && (
              <div className="border-t p-2">
                <DamageRowCard damage={d} onResolved={onChanged} currentUser={currentUser} repeats={repeats} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
