'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, Loader2 } from 'lucide-react'
import { formatExpiryLine, type ExpiryItem } from '@/lib/expiry'
import { Card, CardContent } from '@/components/ui/card'
import { getInspectableEquipment } from '@/lib/actions-daily-inspection'
import { DailyInspectionDialog } from './daily-inspection-dialog'
import { Button } from '@/components/ui/button'
import { ServiceWorkPlanCard } from './service-workplan-card'
import { ClipboardCheck } from 'lucide-react'
import { getExpiringSoon } from '@/lib/actions-expiry'
import { getFodReports, getWildlifeReports } from '@/lib/actions-safety-reports'
import { roleAtLeast, computeMyTasks, type TaskDamage, type MyTask } from '@/lib/my-tasks'

const TONE: Record<MyTask['tone'], string> = {
  red: 'border-l-red-500 bg-red-500/5',
  amber: 'border-l-amber-500 bg-amber-500/5',
  blue: 'border-l-blue-500 bg-blue-500/5',
}

export function MyTasksView({
  role,
  fullName,
  damages,
  onOpenTab,
}: {
  role: string
  fullName: string
  damages: TaskDamage[]
  onOpenTab: (tab: string) => void
}) {
  const [inspections, setInspections] = useState<Awaited<ReturnType<typeof getInspectableEquipment>> | null>(null)
  const [inspectOpen, setInspectOpen] = useState(false)
  const [reload, setReload] = useState(0)

  const [openFod, setOpenFod] = useState(0)
  const [newWildlife, setNewWildlife] = useState(0)
  const [expiring, setExpiring] = useState<(ExpiryItem & { days: number })[]>([])
  useEffect(() => {
    if (!roleAtLeast(role, 'engineer')) return
    getExpiringSoon().then(setExpiring).catch(() => setExpiring([]))
    if (role === 'admin') getWildlifeReports({ limit: 200 }).then((r) => setNewWildlife(r.filter((w: any) => (w.status ?? 'NEW') === 'NEW').length)).catch(() => setNewWildlife(0))
    getFodReports({ limit: 200 }).then((r) => setOpenFod(r.filter((f: any) => !f.removed).length)).catch(() => setOpenFod(0))
  }, [role])

  useEffect(() => {
    let cancelled = false
    getInspectableEquipment()
      .then((r) => { if (!cancelled) setInspections(r) })
      .catch(() => { if (!cancelled) setInspections([]) })
    return () => { cancelled = true }
  }, [reload])

  const tasks = useMemo(
    () => computeMyTasks(role, damages, inspections ?? [], openFod, newWildlife),
    [role, damages, inspections, openFod, newWildlife],
  )

  return (
    <div className="space-y-3 max-w-2xl">
      <p className="text-sm text-muted-foreground">Zdravo, {fullName.split(' ')[0]}. Ovo čeka vas:</p>

      <Button size="lg" className="w-full" onClick={() => setInspectOpen(true)}>
        <ClipboardCheck className="h-5 w-5 mr-2" />Pokreni dnevni pregled vozila
      </Button>
      <DailyInspectionDialog
        open={inspectOpen}
        onOpenChange={setInspectOpen}
        onDone={() => { setInspections(null); setReload((n) => n + 1) }}
      />

      {inspections === null && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Učitavam…
        </div>
      )}

      {inspections !== null && tasks.length === 0 && expiring.length === 0 && (
        <Card>
          <CardContent className="py-8 flex flex-col items-center gap-2 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <div className="font-medium">Sve je u redu</div>
            <div className="text-sm text-muted-foreground">Trenutno nema ničega što čeka na vas.</div>
          </CardContent>
        </Card>
      )}

      {expiring.length > 0 && (
        <div className="rounded-lg border border-l-4 border-l-amber-500 bg-amber-500/5 p-4 space-y-1">
          <div className="font-medium">Rokovi koji ističu u 30 dana ({expiring.length})</div>
          {expiring.slice(0, 6).map((e, i) => (
            <div key={i} className="text-xs text-muted-foreground">{formatExpiryLine(e)}</div>
          ))}
          {expiring.length > 6 && <div className="text-xs text-muted-foreground">… i još {expiring.length - 6}</div>}
        </div>
      )}

      {roleAtLeast(role, 'engineer') && <ServiceWorkPlanCard />}

      {tasks.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => (t.action === 'inspect' ? setInspectOpen(true) : onOpenTab(t.tab))}
          className={`w-full text-left rounded-lg border border-l-4 p-4 flex items-center gap-4 min-h-16 active:scale-[0.99] transition ${TONE[t.tone]}`}
        >
          <div className="text-3xl font-bold tabular-nums w-12 text-center">{t.count}</div>
          <div className="flex-1 min-w-0">
            <div className="font-medium">{t.title}</div>
            <div className="text-xs text-muted-foreground truncate">{t.detail}</div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </button>
      ))}
    </div>
  )
}
