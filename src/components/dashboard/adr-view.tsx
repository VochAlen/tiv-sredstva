'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  ShieldCheck, AlertTriangle, Wrench, Calendar, Clock, CheckCircle2,
  Loader2, Plus, Car, FileCheck, Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import {
  getMaintenanceSchedule, generateMaintenanceScheduleForEquipment, completeMaintenanceTask,
  getDailyInspections, createDailyInspection,
} from '@/lib/actions-adr'
import { DAILY_INSPECTION_CHECKLIST } from '@/lib/constants-export'
import { getAllEquipment } from '@/lib/actions'
import { useLang } from '@/lib/lang-context'

type MaintenanceTask = Awaited<ReturnType<typeof getMaintenanceSchedule>>[number]
type DailyInspection = Awaited<ReturnType<typeof getDailyInspections>>[number]
type Equipment = Awaited<ReturnType<typeof getAllEquipment>>[number]

const FITNESS_CONFIG = {
  FIT: { label: 'FIT', labelEn: 'FIT', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle2 },
  CONDITIONAL: { label: 'USLOVNO', labelEn: 'CONDITIONAL', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: AlertTriangle },
  UNFIT: { label: 'NIJE FIT', labelEn: 'UNFIT', color: 'bg-red-100 text-red-800 border-red-300', icon: XCircle },
}

import { XCircle } from 'lucide-react'

export function AdrView() {
  const [tab, setTab] = useState<'fitness' | 'schedule' | 'inspections'>('fitness')
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [schedule, setSchedule] = useState<MaintenanceTask[]>([])
  const [inspections, setInspections] = useState<DailyInspection[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useLang()

  const load = async () => {
    setLoading(true)
    try {
      const [eq, sch, insp] = await Promise.all([
        getAllEquipment(),
        getMaintenanceSchedule(),
        getDailyInspections(),
      ])
      setEquipment(eq)
      setSchedule(sch)
      setInspections(insp)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const fitCount = equipment.filter((e) => (e as any).fitnessStatus === 'FIT').length
  const conditionalCount = equipment.filter((e) => (e as any).fitnessStatus === 'CONDITIONAL').length
  const unfitCount = equipment.filter((e) => (e as any).fitnessStatus === 'UNFIT' || (e as any).fitnessStatus === null && e.status === 'OUT_OF_SERVICE').length
  const dueTasks = schedule.filter((s) => s.status === 'DUE' || s.status === 'OVERDUE').length

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          ADR.OPS.C.007 — Vehicle Fitness & Maintenance
        </h2>
        <p className="text-sm text-muted-foreground">
          Vehicle Fitness Certificate + Maintenance Schedule + Daily Inspection
        </p>
      </div>

      {/* Alert cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <FitnessCard icon={CheckCircle2} label="FIT" value={fitCount} tone="emerald" onClick={() => setTab('fitness')} />
        <FitnessCard icon={AlertTriangle} label="CONDITIONAL" value={conditionalCount} tone="amber" onClick={() => setTab('fitness')} />
        <FitnessCard icon={XCircle} label="UNFIT" value={unfitCount} tone="red" onClick={() => setTab('fitness')} />
        <FitnessCard icon={Wrench} label="Maintenance Due" value={dueTasks} tone="orange" onClick={() => setTab('schedule')} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto">
        <TabButton active={tab === 'fitness'} onClick={() => setTab('fitness')} icon={Car} label="Vehicle Fitness" />
        <TabButton active={tab === 'schedule'} onClick={() => setTab('schedule')} icon={Calendar} label="Maintenance Schedule" />
        <TabButton active={tab === 'inspections'} onClick={() => setTab('inspections')} icon={FileCheck} label="Daily Inspections" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : tab === 'fitness' ? (
        <FitnessList equipment={equipment} />
      ) : tab === 'schedule' ? (
        <ScheduleList schedule={schedule} onUpdated={load} />
      ) : (
        <InspectionsList inspections={inspections} />
      )}
    </div>
  )
}

function FitnessCard({ icon: Icon, label, value, tone, onClick }: any) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
  }
  const iconColors: Record<string, string> = {
    emerald: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600', orange: 'text-orange-600',
  }
  return (
    <button onClick={onClick} className={'text-left p-4 rounded-lg border ' + colors[tone] + ' hover:opacity-80 transition'}>
      <div className="flex items-center justify-between">
        <div><div className="text-2xl font-bold">{value}</div><div className="text-xs mt-0.5">{label}</div></div>
        <Icon className={'h-6 w-6 ' + iconColors[tone]} />
      </div>
    </button>
  )
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button onClick={onClick} className={'px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ' + (active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
      <Icon className="h-4 w-4" />{label}
    </button>
  )
}

function FitnessList({ equipment }: { equipment: Equipment[] }) {
  return (
    <div className="space-y-2">
      {equipment.map((e: any) => {
        const fitness = e.fitnessStatus || (e.status === 'OUT_OF_SERVICE' ? 'UNFIT' : e.status === 'MAINTENANCE' ? 'UNFIT' : 'FIT')
        const config = FITNESS_CONFIG[fitness as keyof typeof FITNESS_CONFIG] || FITNESS_CONFIG.FIT
        const FitnessIcon = config.icon
        return (
          <Card key={e.id} className={'p-4 border-l-4 ' + (fitness === 'UNFIT' ? 'border-l-red-500' : fitness === 'CONDITIONAL' ? 'border-l-amber-500' : 'border-l-emerald-500')}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant="outline" className="font-mono text-xs">{e.code}</Badge>
                  <Badge variant="secondary" className="text-xs">{e.type}</Badge>
                </div>
                <div className="text-sm font-medium">{e.name}</div>
                {e.fitnessReason && <div className="text-xs text-muted-foreground mt-1">{e.fitnessReason}</div>}
                {e.fitnessCalculatedAt && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Izračunato: {new Date(e.fitnessCalculatedAt).toLocaleString('hr-HR')}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge className={'text-xs ' + config.color}><FitnessIcon className="h-3 w-3 mr-1" />{config.label}</Badge>
                <Badge variant="outline" className="text-xs">{e.status}</Badge>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function ScheduleList({ schedule, onUpdated }: { schedule: MaintenanceTask[]; onUpdated: () => void }) {
  const [completeDialog, setCompleteDialog] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleComplete = () => {
    if (!completeDialog) return
    startTransition(async () => {
      await completeMaintenanceTask(completeDialog, notes)
      toast.success('Održavanje završeno')
      setCompleteDialog(null)
      setNotes('')
      onUpdated()
    })
  }

  if (schedule.length === 0) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground"><Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Nema zakazanih održavanja.</p></CardContent></Card>
  }

  const statusColors: Record<string, string> = {
    SCHEDULED: 'bg-blue-100 text-blue-800', DUE: 'bg-amber-100 text-amber-800',
    IN_PROGRESS: 'bg-purple-100 text-purple-800', COMPLETED: 'bg-emerald-100 text-emerald-800', OVERDUE: 'bg-red-100 text-red-800',
  }
  const priorityColors: Record<string, string> = {
    LOW: 'bg-blue-100 text-blue-800', MEDIUM: 'bg-amber-100 text-amber-800',
    HIGH: 'bg-orange-100 text-orange-800', CRITICAL: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-2">
      {schedule.map((task) => (
        <Card key={task.id} className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs">{task.equipmentCode}</Badge>
                <Badge className={'text-xs ' + (statusColors[task.status] || '')}>{task.status}</Badge>
                <Badge className={'text-xs ' + (priorityColors[task.priority] || '')}>{task.priority}</Badge>
                {task.autoGenerated && <Badge variant="secondary" className="text-xs"><Zap className="h-3 w-3 mr-0.5" />Auto</Badge>}
              </div>
              <div className="text-sm font-medium">{task.title}</div>
              {task.description && <div className="text-xs text-muted-foreground mt-0.5">{task.description}</div>}
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                {task.triggerHours && <span>Na: {task.triggerHours}h</span>}
                {task.triggerDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(task.triggerDate).toLocaleDateString('hr-HR')}</span>}
                {task.triggerInterval && <span>Svakih {task.triggerInterval}h</span>}
              </div>
              {task.completionNotes && <div className="text-xs text-emerald-700 mt-1 p-1.5 bg-emerald-50 rounded"><strong>Završeno:</strong> {task.completionNotes} ({task.completedBy})</div>}
            </div>
            {task.status !== 'COMPLETED' && (
              <Button size="sm" variant="outline" onClick={() => setCompleteDialog(task.id)}>
                <CheckCircle2 className="h-4 w-4 mr-1" />Završi
              </Button>
            )}
          </div>
        </Card>
      ))}

      <Dialog open={!!completeDialog} onOpenChange={(v) => !v && setCompleteDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Završi održavanje</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Bilješke o popravku</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Šta je urađeno..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialog(null)}>Odustani</Button>
            <Button onClick={handleComplete} disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Potvrdi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InspectionsList({ inspections }: { inspections: DailyInspection[] }) {
  if (inspections.length === 0) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground"><FileCheck className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Nema zabilježenih dnevnih inspekcija.</p></CardContent></Card>
  }

  const resultColors: Record<string, string> = {
    FIT: 'bg-emerald-100 text-emerald-800', CONDITIONAL: 'bg-amber-100 text-amber-800', UNFIT: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-2">
      {inspections.map((insp) => (
        <Card key={insp.id} className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs">{insp.equipmentCode}</Badge>
                <Badge className={'text-xs ' + (resultColors[insp.result] || '')}>{insp.result}</Badge>
                <Badge variant="secondary" className="text-xs">{insp.shift}</Badge>
              </div>
              <div className="text-sm font-medium">{insp.equipmentName}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                <span>Inspektor: {insp.inspectorName} ({insp.inspectorCardId})</span>
                <span>{new Date(insp.inspectionDate).toLocaleString('hr-HR')}</span>
                {insp.issuesFound > 0 && <span className="text-red-600">Pronađeno problema: {insp.issuesFound}</span>}
              </div>
              {insp.notes && <div className="text-xs mt-1 p-1.5 bg-muted/30 rounded">{insp.notes}</div>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
