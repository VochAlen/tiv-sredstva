'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  Shield, Plus, Loader2, Calendar, Trash2, Search, Download, AlertTriangle,
  Target, TrendingUp, CheckSquare, Activity, ShieldCheck, AlertCircle,
  Clock, XCircle, ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  getHazards, createHazard, updateHazardMitigation, deleteHazard,
  getSPIs, createSPI, updateSPIValue, deleteSPI,
  getSPTs, createSPT, updateSPTProgress, deleteSPT,
  getSafetyActions, createSafetyAction, updateSafetyActionStatus, deleteSafetyAction,
  getSMSSummary,
} from '@/lib/actions-sms'
import { calculateRiskLevel } from '@/lib/risk-matrix'

type Hazard = Awaited<ReturnType<typeof getHazards>>[number]
type SPI = Awaited<ReturnType<typeof getSPIs>>[number]
type SPT = Awaited<ReturnType<typeof getSPTs>>[number]
type Action = Awaited<ReturnType<typeof getSafetyActions>>[number]
type Summary = Awaited<ReturnType<typeof getSMSSummary>>

const HAZARD_CATEGORY_LABELS: Record<string, string> = {
  OPERATIONAL: 'Operativni',
  TECHNICAL: 'Tehnički',
  ENVIRONMENTAL: 'Ekološki',
  HUMAN: 'Ljudski faktor',
  ORGANIZATIONAL: 'Organizacioni',
  EXTERNAL: 'Spoljni',
}

const SOURCE_LABELS: Record<string, string> = {
  INSPECTION: 'Inspekcija',
  INCIDENT: 'Incident',
  AUDIT: 'Audit',
  EMPLOYEE: 'Prijavio radnik',
  SAFETY_CULTURE_SURVEY: 'Anketa sigurnosne kulture',
  OTHER: 'Ostalo',
}

const RISK_LEVEL_COLORS: Record<string, string> = {
  LOW: 'bg-blue-100 text-blue-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
}

const RISK_LEVEL_LABELS: Record<string, string> = {
  LOW: 'Nizak', MEDIUM: 'Srednji', HIGH: 'Visok', CRITICAL: 'Kritičan',
}

const SPI_CATEGORY_LABELS: Record<string, string> = {
  OUTPUT: 'Izlazni (Output)',
  PROCESS: 'Procesni',
  LEADING: 'Vodeći (Leading)',
  LAGGING: 'Prateći (Lagging)',
}

const SPI_STATUS_COLORS: Record<string, string> = {
  GREEN: 'bg-emerald-100 text-emerald-800',
  AMBER: 'bg-amber-100 text-amber-800',
  RED: 'bg-red-100 text-red-800',
}

const SPT_STATUS_LABELS: Record<string, string> = {
  ON_TRACK: 'Na putu',
  AT_RISK: 'U riziku',
  OFF_TRACK: 'Van puta',
  ACHIEVED: 'Postignuto',
  MISSED: 'Propušteno',
}

const SPT_STATUS_COLORS: Record<string, string> = {
  ON_TRACK: 'bg-emerald-100 text-emerald-800',
  AT_RISK: 'bg-amber-100 text-amber-800',
  OFF_TRACK: 'bg-red-100 text-red-800',
  ACHIEVED: 'bg-emerald-100 text-emerald-800',
  MISSED: 'bg-red-100 text-red-800',
}

const ACTION_CATEGORY_LABELS: Record<string, string> = {
  CORRECTIVE: 'Korektivna',
  PREVENTIVE: 'Preventivna',
  MITIGATION: 'Mitigacija',
  IMPROVEMENT: 'Unapređenje',
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Nizak', MEDIUM: 'Srednji', HIGH: 'Visok', CRITICAL: 'Kritičan',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-blue-100 text-blue-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
}

const ACTION_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Otvorena', IN_PROGRESS: 'U toku', COMPLETED: 'Završena', OVERDUE: 'Prekoračena', CANCELLED: 'Otkazana',
}

export function SMSView() {
  const [tab, setTab] = useState<'hazards' | 'risks' | 'spi' | 'spt' | 'actions' | 'summary'>('summary')
  const [hazards, setHazards] = useState<Hazard[]>([])
  const [spis, setSpis] = useState<SPI[]>([])
  const [spts, setSpts] = useState<SPT[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [h, s, st, a, sm] = await Promise.all([
        getHazards(), getSPIs(), getSPTs(), getSafetyActions(), getSMSSummary(),
      ])
      setHazards(h); setSpis(s); setSpts(st); setActions(a); setSummary(sm)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openHazards = hazards.filter(h => h.status === 'OPEN' || h.status === 'ASSESSED').length
  const redSPIs = spis.filter(s => s.status === 'RED').length
  const overdueActions = actions.filter(a => a.dueDate && new Date(a.dueDate) < new Date() && a.status !== 'COMPLETED').length
  const criticalActions = actions.filter(a => a.priority === 'CRITICAL' && a.status !== 'COMPLETED').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Shield className="h-5 w-5" />Safety Management System (SMS)</h2>
          <p className="text-sm text-muted-foreground">ICAO Annex 19 · EASA M.GEN.205 · ALARP Principle</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/sms-hazards', '_blank')}><Download className="h-4 w-4 mr-1.5" />Hazardi PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/sms-risk-register', '_blank')}><Download className="h-4 w-4 mr-1.5" />Risk Register PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/sms-spi-spt', '_blank')}><Download className="h-4 w-4 mr-1.5" />SPI/SPT PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/sms-action-plan', '_blank')}><Download className="h-4 w-4 mr-1.5" />Action Plan PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/sms-summary', '_blank')}><Download className="h-4 w-4 mr-1.5" />SMS Sažetak PDF</Button>
        </div>
      </div>

      {/* Alert cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AlertCard icon={AlertTriangle} label="Otvoreni hazardi" value={openHazards} tone="amber" onClick={() => setTab('hazards')} />
        <AlertCard icon={Activity} label="SPI u crvenom" value={redSPIs} tone="red" onClick={() => setTab('spi')} />
        <AlertCard icon={Clock} label="Prekoračene akcije" value={overdueActions} tone="red" onClick={() => setTab('actions')} />
        <AlertCard icon={ShieldCheck} label="Završene akcije" value={actions.filter(a => a.status === 'COMPLETED').length} tone="emerald" onClick={() => setTab('actions')} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto">
        <TabBtn active={tab === 'summary'} onClick={() => setTab('summary')} icon={Activity} label="Sažetak" />
        <TabBtn active={tab === 'hazards'} onClick={() => setTab('hazards')} icon={AlertTriangle} label="Hazardi" />
        <TabBtn active={tab === 'risks'} onClick={() => setTab('risks')} icon={AlertTriangle} label="Risk Matrix" />
        <TabBtn active={tab === 'spi'} onClick={() => setTab('spi')} icon={TrendingUp} label="SPI" />
        <TabBtn active={tab === 'spt'} onClick={() => setTab('spt')} icon={Target} label="SPT" />
        <TabBtn active={tab === 'actions'} onClick={() => setTab('actions')} icon={CheckSquare} label="Action Plan" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : tab === 'summary' ? (
        <SummaryView summary={summary} />
      ) : tab === 'hazards' ? (
        <HazardsList hazards={hazards} onUpdated={load} />
      ) : tab === 'risks' ? (
        <RiskMatrixView hazards={hazards} onUpdated={load} />
      ) : tab === 'spi' ? (
        <SPIList spis={spis} onUpdated={load} />
      ) : tab === 'spt' ? (
        <SPTList spts={spts} onUpdated={load} />
      ) : (
        <ActionsList actions={actions} onUpdated={load} />
      )}
    </div>
  )
}

// ============================================================================
// SUMMARY VIEW
// ============================================================================

function SummaryView({ summary }: { summary: Summary | null }) {
  if (!summary) return null
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Ukupno hazarda" value={summary.hazards.total} icon={AlertTriangle} tone="blue" />
        <StatCard label="Otvoreni" value={summary.hazards.open} icon={Clock} tone="amber" />
        <StatCard label="Kritični rizici" value={summary.hazards.critical} icon={ShieldAlert} tone="red" />
        <StatCard label="Prekoračene akcije" value={summary.actions.overdue} icon={XCircle} tone="red" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Risk Distribution */}
        <Card>
          <CardHeader><CardTitle className="text-base">Distribucija rizika</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(level => {
                const count = summary.hazards.byRiskLevel[level] || 0
                const max = Math.max(...Object.values(summary.hazards.byRiskLevel) as number[], 1)
                const pct = (count / max) * 100
                const color = level === 'CRITICAL' ? 'bg-red-500' : level === 'HIGH' ? 'bg-orange-500' : level === 'MEDIUM' ? 'bg-amber-500' : 'bg-blue-500'
                return (
                  <div key={level} className="flex items-center gap-2">
                    <div className="w-24 text-xs">{RISK_LEVEL_LABELS[level]}</div>
                    <div className="flex-1 h-6 bg-muted/30 rounded relative overflow-hidden">
                      <div className={`absolute inset-y-0 left-0 ${color}`} style={{ width: `${pct}%` }} />
                      <div className="absolute inset-0 flex items-center px-2 text-xs font-medium">{count}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* SPI Status */}
        <Card>
          <CardHeader><CardTitle className="text-base">SPI status</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-emerald-50 rounded">
                <span className="text-sm">Zeleni (unutar cilja)</span>
                <Badge className="bg-emerald-100 text-emerald-800">{summary.spis.green}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-amber-50 rounded">
                <span className="text-sm">Žuti (alert nivo)</span>
                <Badge className="bg-amber-100 text-amber-800">{summary.spis.amber}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                <span className="text-sm">Crveni (preko limita)</span>
                <Badge className="bg-red-100 text-red-800">{summary.spis.red}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SPT Progress */}
        <Card>
          <CardHeader><CardTitle className="text-base">SPT napredak</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-emerald-50 rounded">
                <span className="text-sm">Postignuto</span>
                <Badge className="bg-emerald-100 text-emerald-800">{summary.spts.achieved}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-emerald-50 rounded">
                <span className="text-sm">Na putu</span>
                <Badge className="bg-emerald-100 text-emerald-800">{summary.spts.onTrack}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-amber-50 rounded">
                <span className="text-sm">U riziku</span>
                <Badge className="bg-amber-100 text-amber-800">{summary.spts.atRisk}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                <span className="text-sm">Van puta</span>
                <Badge className="bg-red-100 text-red-800">{summary.spts.offTrack}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions Summary */}
        <Card>
          <CardHeader><CardTitle className="text-base">Safety Action Plan</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="text-sm">Ukupno akcija</span>
                <Badge variant="secondary">{summary.actions.total}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-amber-50 rounded">
                <span className="text-sm">Otvorene</span>
                <Badge className="bg-amber-100 text-amber-800">{summary.actions.open}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-emerald-50 rounded">
                <span className="text-sm">Završene</span>
                <Badge className="bg-emerald-100 text-emerald-800">{summary.actions.completed}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                <span className="text-sm">Prekoračene</span>
                <Badge className="bg-red-100 text-red-800">{summary.actions.overdue}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hazards by Category */}
      <Card>
        <CardHeader><CardTitle className="text-base">Hazardi po kategoriji</CardTitle></CardHeader>
        <CardContent>
          {Object.keys(summary.hazards.byCategory).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nema podataka</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(summary.hazards.byCategory).map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <span className="text-sm">{HAZARD_CATEGORY_LABELS[cat] ?? cat}</span>
                  <Badge variant="secondary">{count as number}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// HAZARDS LIST
// ============================================================================

function HazardsList({ hazards, onUpdated }: { hazards: Hazard[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('ALL')
  const [riskFilter, setRiskFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)
  const [mitigateHazard, setMitigateHazard] = useState<Hazard | null>(null)

  const filtered = hazards.filter((h) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [h.hazardId, h.title, h.description, h.location, h.reportedBy, h.mitigation, h.alarpJustification].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (catFilter !== 'ALL' && h.category !== catFilter) return false
    if (riskFilter !== 'ALL' && h.initialRiskLevel !== riskFilter) return false
    if (statusFilter !== 'ALL' && h.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po ID, naslovu, opisu, lokaciji..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Kategorija" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Sve kategorije</SelectItem>
            {Object.entries(HAZARD_CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Rizik" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi rizici</SelectItem>
            {Object.entries(RISK_LEVEL_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            <SelectItem value="OPEN">Otvoren</SelectItem>
            <SelectItem value="ASSESSED">Procijenjen</SelectItem>
            <SelectItem value="MITIGATED">Mitigiran</SelectItem>
            <SelectItem value="CLOSED">Zatvoren</SelectItem>
            <SelectItem value="MONITORED">Praćen</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Novi hazard</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {hazards.length}</div>
      </div>

      {hazards.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema identifikovanih hazarda.</p>
          <p className="text-xs mt-1">Kliknite "Novi hazard" da prijavite opasnost.</p>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema rezultata pretrage.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((h) => <HazardCard key={h.id} hazard={h} onUpdated={onUpdated} onMitigate={() => setMitigateHazard(h)} />)}
        </div>
      )}

      <AddHazardDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} />
      <MitigateDialog hazard={mitigateHazard} onOpenChange={(v) => !v && setMitigateHazard(null)} onUpdated={onUpdated} />
    </div>
  )
}

function HazardCard({ hazard: h, onUpdated, onMitigate }: { hazard: Hazard; onUpdated: () => void; onMitigate: () => void }) {
  const [isPending, startTransition] = useTransition()
  const handleDelete = () => {
    if (!confirm('Obrisati hazard?')) return
    startTransition(async () => {
      const res = await deleteHazard(h.id)
      if (res.ok) { toast.success('Obrisano'); onUpdated() }
      else toast.error(res.error ?? 'Greška')
    })
  }
  return (
    <Card className={`p-4 border-l-4 ${h.initialRiskLevel === 'CRITICAL' ? 'border-l-red-500' : h.initialRiskLevel === 'HIGH' ? 'border-l-orange-500' : h.initialRiskLevel === 'MEDIUM' ? 'border-l-amber-500' : 'border-l-blue-500'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">{h.hazardId}</Badge>
            <Badge className={`text-xs ${RISK_LEVEL_COLORS[h.initialRiskLevel]}`}>{RISK_LEVEL_LABELS[h.initialRiskLevel]} ({h.initialProbability}×{h.initialSeverity})</Badge>
            <Badge variant="secondary" className="text-xs">{HAZARD_CATEGORY_LABELS[h.category] ?? h.category}</Badge>
            <Badge variant="outline" className="text-xs">{SOURCE_LABELS[h.source] ?? h.source}</Badge>
            <Badge className="text-xs">{h.status}</Badge>
          </div>
          <div className="text-sm font-medium">{h.title}</div>
          <div className="text-xs text-muted-foreground mt-1">{h.description}</div>
          {h.location && <div className="text-xs text-muted-foreground mt-1">📍 {h.location}</div>}

          {h.mitigation && (
            <div className="text-xs mt-2 p-2 bg-emerald-50 rounded">
              <strong>Mitigacija:</strong> {h.mitigation}
              {h.residualRiskLevel && (
                <Badge className={`ml-2 text-xs ${RISK_LEVEL_COLORS[h.residualRiskLevel]}`}>
                  Rezidualni: {RISK_LEVEL_LABELS[h.residualRiskLevel]} ({h.residualProbability}×{h.residualSeverity})
                </Badge>
              )}
            </div>
          )}
          {h.alarpJustification && (
            <div className="text-xs mt-1 p-2 bg-blue-50 rounded border border-blue-200">
              <strong>ALARP:</strong> {h.alarpJustification}
              {h.alarpReviewedBy && <span className="text-muted-foreground"> · Pregledao: {h.alarpReviewedBy}</span>}
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span>Prijavio: {h.reportedBy}</span>
            <span>{new Date(h.reportedAt).toLocaleDateString('hr-HR')}</span>
            {h.assignedTo && <span>Zadužen: {h.assignedTo}</span>}
            {h.dueDate && <span className={new Date(h.dueDate) < new Date() && h.status !== 'CLOSED' ? 'text-red-600 font-medium' : ''}>Rok: {new Date(h.dueDate).toLocaleDateString('hr-HR')}</span>}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {h.status !== 'CLOSED' && <Button size="sm" variant="ghost" onClick={onMitigate}>Mitigiraj</Button>}
          <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function AddHazardDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('OPERATIONAL')
  const [source, setSource] = useState('INSPECTION')
  const [location, setLocation] = useState('')
  const [reportedBy, setReportedBy] = useState('')
  const [probability, setProbability] = useState('3')
  const [severity, setSeverity] = useState('3')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const riskLevel = calculateRiskLevel(parseInt(probability), parseInt(severity))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await createHazard({
        title, description, category, source,
        location: location || undefined,
        reportedBy,
        initialProbability: parseInt(probability),
        initialSeverity: parseInt(severity),
        assignedTo: assignedTo || undefined,
        dueDate: dueDate || undefined,
        notes: notes || undefined,
      })
      if (res.ok) {
        toast.success(`Hazard kreiran: ${res.hazardId} · Rizik: ${RISK_LEVEL_LABELS[riskLevel]}`)
        onOpenChange(false); onAdded()
        setTitle(''); setDescription(''); setLocation(''); setReportedBy(''); setNotes(''); setDueDate('')
      } else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novi hazard (Hazard Identification)</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5"><Label>Naslov *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="npr. FOD na RWY 14/32" required /></div>
          <div className="space-y-1.5"><Label>Opis *</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Kategorija</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(HAZARD_CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Izvor</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Lokacija</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="RWY 14/32, Apron 1..." /></div>
            <div className="space-y-1.5"><Label>Prijavio *</Label><Input value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} required /></div>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="text-sm font-medium mb-2">Početna procjena rizika (5×5 matrix)</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Vjerovatnoća (1-5)</Label>
                <Select value={probability} onValueChange={setProbability}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Vrlo malo vjerovatno</SelectItem>
                    <SelectItem value="2">2 - Malo vjerovatno</SelectItem>
                    <SelectItem value="3">3 - Moguće</SelectItem>
                    <SelectItem value="4">4 - Vjerovatno</SelectItem>
                    <SelectItem value="5">5 - Često</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Posljedica (1-5)</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Zanemarljiva</SelectItem>
                    <SelectItem value="2">2 - Manja</SelectItem>
                    <SelectItem value="3">3 - Umjerena</SelectItem>
                    <SelectItem value="4">4 - Ozbiljna</SelectItem>
                    <SelectItem value="5">5 - Katastrofalna</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-2 p-2 bg-white rounded text-center">
              <span className="text-xs text-muted-foreground">Nivo rizika: </span>
              <Badge className={`ml-1 ${RISK_LEVEL_COLORS[riskLevel]}`}>{RISK_LEVEL_LABELS[riskLevel]} ({parseInt(probability) * parseInt(severity)})</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Zadužen</Label><Input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Rok</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Napomene</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sačuvaj</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MitigateDialog({ hazard, onOpenChange, onUpdated }: { hazard: Hazard | null; onOpenChange: (v: boolean) => void; onUpdated: () => void }) {
  const [mitigation, setMitigation] = useState('')
  const [resProb, setResProb] = useState('2')
  const [resSev, setResSev] = useState('2')
  const [alarp, setAlarp] = useState('')
  const [reviewedBy, setReviewedBy] = useState('')
  const [status, setStatus] = useState('MITIGATED')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (hazard) {
      setMitigation(hazard.mitigation || '')
      setResProb(hazard.residualProbability?.toString() || '2')
      setResSev(hazard.residualSeverity?.toString() || '2')
      setAlarp(hazard.alarpJustification || '')
      setReviewedBy(hazard.alarpReviewedBy || '')
      setStatus(hazard.status === 'CLOSED' ? 'CLOSED' : 'MITIGATED')
    }
  }, [hazard])

  const residualRisk = calculateRiskLevel(parseInt(resProb), parseInt(resSev))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!hazard) return
    startTransition(async () => {
      const res = await updateHazardMitigation(hazard.id, {
        mitigation,
        residualProbability: parseInt(resProb),
        residualSeverity: parseInt(resSev),
        alarpJustification: alarp || undefined,
        alarpReviewedBy: reviewedBy || undefined,
        status,
      })
      if (res.ok) {
        toast.success(`Mitigacija sačuvana · Rezidualni rizik: ${RISK_LEVEL_LABELS[res.residualRiskLevel || 'LOW']}`)
        onOpenChange(false); onUpdated()
      } else toast.error(res.error ?? 'Greška')
    })
  }

  if (!hazard) return null

  return (
    <Dialog open={!!hazard} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mitigacija: {hazard.hazardId}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="p-2 bg-muted/30 rounded text-sm">
            <div className="font-medium">{hazard.title}</div>
            <div className="text-xs text-muted-foreground mt-1">Početni rizik: <Badge className={RISK_LEVEL_COLORS[hazard.initialRiskLevel]}>{RISK_LEVEL_LABELS[hazard.initialRiskLevel]}</Badge> ({hazard.initialProbability}×{hazard.initialSeverity})</div>
          </div>
          <div className="space-y-1.5"><Label>Opis mitigejšna *</Label><Textarea value={mitigation} onChange={(e) => setMitigation(e.target.value)} rows={3} required /></div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="text-sm font-medium mb-2">Rezidualni rizik (nakon mitigejšna)</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Vjerovatnoća (1-5)</Label>
                <Select value={resProb} onValueChange={setResProb}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Posljedica (1-5)</Label>
                <Select value={resSev} onValueChange={setResSev}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-2 p-2 bg-white rounded text-center">
              <span className="text-xs text-muted-foreground">Rezidualni nivo: </span>
              <Badge className={`ml-1 ${RISK_LEVEL_COLORS[residualRisk]}`}>{RISK_LEVEL_LABELS[residualRisk]} ({parseInt(resProb) * parseInt(resSev)})</Badge>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>ALARP opravdanje</Label>
            <Textarea value={alarp} onChange={(e) => setAlarp(e.target.value)} rows={2} placeholder="Zašto je preostali rizik ALARP (As Low As Reasonably Practicable)?" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Pregledao</Label><Input value={reviewedBy} onChange={(e) => setReviewedBy(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MITIGATED">Mitigiran</SelectItem>
                  <SelectItem value="MONITORED">Praćen</SelectItem>
                  <SelectItem value="CLOSED">Zatvoren</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sačuvaj</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// RISK MATRIX VIEW (5x5 grid)
// ============================================================================

function RiskMatrixView({ hazards, onUpdated }: { hazards: Hazard[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')

  const filtered = hazards.filter((h) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [h.hazardId, h.title, h.description, h.location].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  // Build 5x5 matrix (Severity × Probability)
  const matrix: Hazard[][][] = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => []))
  for (const h of filtered) {
    const p = h.initialProbability - 1
    const s = h.initialSeverity - 1
    if (p >= 0 && p < 5 && s >= 0 && s < 5) {
      matrix[s][p].push(h)
    }
  }

  const getCellColor = (p: number, s: number) => {
    const score = (p + 1) * (s + 1)
    if (score >= 15) return 'bg-red-200 hover:bg-red-300'
    if (score >= 10) return 'bg-orange-200 hover:bg-orange-300'
    if (score >= 5) return 'bg-amber-200 hover:bg-amber-300'
    return 'bg-emerald-200 hover:bg-emerald-300'
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga hazarda u matrici..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {hazards.length} hazarda</div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Risk Matrix 5×5 (Severity × Probability)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="inline-block">
              {/* Header */}
              <div className="flex">
                <div className="w-20" />
                <div className="text-xs text-center font-medium flex-1">VJEROVATNOĆA →</div>
              </div>
              <div className="flex">
                <div className="w-20 p-1 text-xs text-center">Posljedica ↓</div>
                {[1, 2, 3, 4, 5].map(p => (
                  <div key={p} className="w-24 p-1 text-xs text-center font-medium">{p}</div>
                ))}
              </div>
              {/* Matrix */}
              {[5, 4, 3, 2, 1].map(sIdx => (
                <div key={sIdx} className="flex">
                  <div className="w-20 p-1 text-xs text-center font-medium self-center">{sIdx} - {['Katastrofalna', 'Ozbiljna', 'Umjerena', 'Manja', 'Zanemarljiva'][5 - sIdx]}</div>
                  {[1, 2, 3, 4, 5].map(pIdx => {
                    const cellHazards = matrix[sIdx - 1][pIdx - 1]
                    return (
                      <div key={pIdx} className={`w-24 h-20 m-0.5 rounded ${getCellColor(pIdx, sIdx)} p-1 overflow-hidden`}>
                        {cellHazards.length > 0 ? (
                          <div>
                            <div className="text-xs font-bold">{cellHazards.length}</div>
                            <div className="text-[10px] truncate">{cellHazards[0].hazardId}</div>
                            {cellHazards.length > 1 && <div className="text-[10px]">+{cellHazards.length - 1} više</div>}
                          </div>
                        ) : (
                          <div className="text-xs text-center text-muted-foreground/40">—</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-1"><div className="w-4 h-4 bg-emerald-200 rounded" /> Nizak (1-4)</div>
            <div className="flex items-center gap-1"><div className="w-4 h-4 bg-amber-200 rounded" /> Srednji (5-9)</div>
            <div className="flex items-center gap-1"><div className="w-4 h-4 bg-orange-200 rounded" /> Visok (10-14)</div>
            <div className="flex items-center gap-1"><div className="w-4 h-4 bg-red-200 rounded" /> Kritičan (15-25)</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// SPI LIST
// ============================================================================

function SPIList({ spis, onUpdated }: { spis: SPI[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)
  const [updateSPI, setUpdateSPI] = useState<SPI | null>(null)

  const filtered = spis.filter((s) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [s.spiId, s.name, s.description].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (catFilter !== 'ALL' && s.category !== catFilter) return false
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga SPI po ID, nazivu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Kategorija" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Sve kategorije</SelectItem>
            {Object.entries(SPI_CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            <SelectItem value="GREEN">Zeleni</SelectItem>
            <SelectItem value="AMBER">Žuti</SelectItem>
            <SelectItem value="RED">Crveni</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Novi SPI</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {spis.length}</div>
      </div>

      {spis.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema definisanih SPI-ova.</p>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema rezultata pretrage.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => <SPICard key={s.id} spi={s} onUpdated={onUpdated} onUpdate={() => setUpdateSPI(s)} />)}
        </div>
      )}

      <AddSPIDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} />
      <UpdateSPIDialog spi={updateSPI} onOpenChange={(v) => !v && setUpdateSPI(null)} onUpdated={onUpdated} />
    </div>
  )
}

function SPICard({ spi: s, onUpdated, onUpdate }: { spi: SPI; onUpdated: () => void; onUpdate: () => void }) {
  const [isPending, startTransition] = useTransition()
  const handleDelete = () => {
    if (!confirm('Obrisati SPI?')) return
    startTransition(async () => {
      const res = await deleteSPI(s.id)
      if (res.ok) { toast.success('Obrisano'); onUpdated() }
      else toast.error(res.error ?? 'Greška')
    })
  }
  const pct = s.currentValue != null && s.tolerableLimit > 0 ? Math.min(100, (s.currentValue / s.tolerableLimit) * 100) : 0
  return (
    <Card className={`p-4 border-l-4 ${s.status === 'RED' ? 'border-l-red-500' : s.status === 'AMBER' ? 'border-l-amber-500' : 'border-l-emerald-500'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">{s.spiId}</Badge>
            <Badge className={`text-xs ${SPI_STATUS_COLORS[s.status]}`}>{s.status}</Badge>
            <Badge variant="secondary" className="text-xs">{SPI_CATEGORY_LABELS[s.category] ?? s.category}</Badge>
            <Badge variant="outline" className="text-xs">{s.frequency}</Badge>
            {s.trend && <Badge variant="outline" className="text-xs">{s.trend}</Badge>}
          </div>
          <div className="text-sm font-medium">{s.name}</div>
          {s.description && <div className="text-xs text-muted-foreground mt-1">{s.description}</div>}
          <div className="text-xs mt-2 flex items-center gap-3 flex-wrap">
            <span>Trenutno: <strong>{s.currentValue ?? '—'} {s.unit}</strong></span>
            <span>Cilj: {s.targetValue} {s.unit}</span>
            <span>Alert: {s.alertLevel} {s.unit}</span>
            <span className="text-red-600">Limit: {s.tolerableLimit} {s.unit}</span>
            {s.currentPeriod && <span>Period: {s.currentPeriod}</span>}
          </div>
          {s.currentValue != null && (
            <div className="mt-2 h-2 bg-muted rounded relative overflow-hidden">
              <div className={`absolute inset-y-0 left-0 ${s.status === 'RED' ? 'bg-red-500' : s.status === 'AMBER' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
              {/* Alert marker */}
              <div className="absolute inset-y-0 bg-amber-700" style={{ left: `${(s.alertLevel / s.tolerableLimit) * 100}%`, width: '2px' }} />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="ghost" onClick={onUpdate}>Ažuriraj</Button>
          <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function AddSPIDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('OUTPUT')
  const [unit, setUnit] = useState('incidents')
  const [frequency, setFrequency] = useState('MONTHLY')
  const [targetValue, setTargetValue] = useState('0.5')
  const [alertLevel, setAlertLevel] = useState('1.0')
  const [tolerableLimit, setTolerableLimit] = useState('2.0')
  const [currentValue, setCurrentValue] = useState('')
  const [currentPeriod, setCurrentPeriod] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await createSPI({
        name, description: description || undefined, category, unit, frequency,
        targetValue: parseFloat(targetValue), alertLevel: parseFloat(alertLevel),
        tolerableLimit: parseFloat(tolerableLimit),
        currentValue: currentValue ? parseFloat(currentValue) : undefined,
        currentPeriod: currentPeriod || undefined,
      })
      if (res.ok) {
        toast.success(`SPI kreiran: ${res.spiId}`)
        onOpenChange(false); onAdded()
        setName(''); setDescription(''); setCurrentValue(''); setCurrentPeriod('')
      } else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novi SPI (Safety Performance Indicator)</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5"><Label>Naziv *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="npr. Broj GSE incidenata po 10.000 pokreta" required /></div>
          <div className="space-y-1.5"><Label>Opis</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>Kategorija</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(SPI_CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Jedinica</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Učestalost</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Mjesečno</SelectItem>
                  <SelectItem value="QUARTERLY">Kvartalno</SelectItem>
                  <SelectItem value="ANNUALLY">Godišnje</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5"><Label>Ciljana vrijednost</Label><Input type="number" step="0.01" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Alert nivo</Label><Input type="number" step="0.01" value={alertLevel} onChange={(e) => setAlertLevel(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Tolerantni limit</Label><Input type="number" step="0.01" value={tolerableLimit} onChange={(e) => setTolerableLimit(e.target.value)} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Trenutna vrijednost</Label><Input type="number" step="0.01" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Trenutni period</Label><Input value={currentPeriod} onChange={(e) => setCurrentPeriod(e.target.value)} placeholder="2026-08" /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sačuvaj</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function UpdateSPIDialog({ spi, onOpenChange, onUpdated }: { spi: SPI | null; onOpenChange: (v: boolean) => void; onUpdated: () => void }) {
  const [value, setValue] = useState('')
  const [period, setPeriod] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (spi) { setValue(spi.currentValue?.toString() || ''); setPeriod(spi.currentPeriod || new Date().toISOString().slice(0, 7)) }
  }, [spi])

  if (!spi) return null
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await updateSPIValue(spi.id, parseFloat(value), period)
      if (res.ok) {
        toast.success(`SPI ažuriran · Status: ${res.status} · Trend: ${res.trend}`)
        onOpenChange(false); onUpdated()
      } else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={!!spi} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Ažuriraj SPI: {spi.spiId}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="p-2 bg-muted/30 rounded text-sm">{spi.name}</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Trenutna vrijednost *</Label><Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Period *</Label><Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-08" required /></div>
          </div>
          <div className="text-xs text-muted-foreground">Limiti: cilj {spi.targetValue}, alert {spi.alertLevel}, max {spi.tolerableLimit} {spi.unit}</div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sačuvaj</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// SPT LIST
// ============================================================================

function SPTList({ spts, onUpdated }: { spts: SPT[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)
  const [updateSPT, setUpdateSPT] = useState<SPT | null>(null)

  const filtered = spts.filter((s) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [s.sptId, s.name, s.description, s.notes].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga SPT po ID, nazivu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            {Object.entries(SPT_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Novi SPT</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {spts.length}</div>
      </div>

      {spts.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Target className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema definisanih SPT-ova.</p>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Target className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema rezultata pretrage.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => <SPTCard key={s.id} spt={s} onUpdated={onUpdated} onUpdate={() => setUpdateSPT(s)} />)}
        </div>
      )}

      <AddSPTDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} />
      <UpdateSPTDialog spt={updateSPT} onOpenChange={(v) => !v && setUpdateSPT(null)} onUpdated={onUpdated} />
    </div>
  )
}

function SPTCard({ spt: s, onUpdated, onUpdate }: { spt: SPT; onUpdated: () => void; onUpdate: () => void }) {
  const [isPending, startTransition] = useTransition()
  const handleDelete = () => {
    if (!confirm('Obrisati SPT?')) return
    startTransition(async () => {
      const res = await deleteSPT(s.id)
      if (res.ok) { toast.success('Obrisano'); onUpdated() }
      else toast.error(res.error ?? 'Greška')
    })
  }
  const daysLeft = Math.floor((s.targetDate.getTime() - Date.now()) / 86400000)
  return (
    <Card className={`p-4 border-l-4 ${s.status === 'OFF_TRACK' || s.status === 'MISSED' ? 'border-l-red-500' : s.status === 'AT_RISK' ? 'border-l-amber-500' : 'border-l-emerald-500'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">{s.sptId}</Badge>
            <Badge className={`text-xs ${SPT_STATUS_COLORS[s.status]}`}>{SPT_STATUS_LABELS[s.status] ?? s.status}</Badge>
            <Badge variant="secondary" className="text-xs">{s.category}</Badge>
          </div>
          <div className="text-sm font-medium">{s.name}</div>
          {s.description && <div className="text-xs text-muted-foreground mt-1">{s.description}</div>}
          <div className="text-xs mt-2 flex items-center gap-3 flex-wrap">
            <span>Baseline: <strong>{s.baselineValue} {s.unit}</strong></span>
            <span>Cilj: <strong>{s.targetValue} {s.unit}</strong></span>
            <span>Trenutno: <strong>{s.currentValue ?? '—'} {s.unit}</strong></span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-3 bg-muted rounded relative overflow-hidden">
            <div className={`absolute inset-y-0 left-0 ${s.status === 'OFF_TRACK' || s.status === 'MISSED' ? 'bg-red-500' : s.status === 'AT_RISK' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${s.progressPercent}%` }} />
            <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">{s.progressPercent.toFixed(0)}%</div>
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span>Početak: {new Date(s.startDate).toLocaleDateString('hr-HR')}</span>
            <span>Rok: <strong className={daysLeft < 30 ? 'text-red-600' : ''}>{new Date(s.targetDate).toLocaleDateString('hr-HR')}</strong> ({daysLeft > 0 ? `${daysLeft} dana` : 'prekoračeno'})</span>
          </div>
          {s.notes && <div className="text-xs mt-1 text-muted-foreground italic">{s.notes}</div>}
        </div>
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="ghost" onClick={onUpdate}>Ažuriraj</Button>
          <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function AddSPTDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('SAFETY')
  const [baseline, setBaseline] = useState('10')
  const [target, setTarget] = useState('8')
  const [unit, setUnit] = useState('incidents')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [targetDate, setTargetDate] = useState(new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await createSPT({
        name, description: description || undefined, category,
        baselineValue: parseFloat(baseline), targetValue: parseFloat(target), unit,
        startDate, targetDate, notes: notes || undefined,
      })
      if (res.ok) {
        toast.success(`SPT kreiran: ${res.sptId}`)
        onOpenChange(false); onAdded()
        setName(''); setDescription(''); setNotes('')
      } else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novi SPT (Safety Performance Target)</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5"><Label>Naziv *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="npr. Smanjiti GSE incidente za 20% YoY" required /></div>
          <div className="space-y-1.5"><Label>Opis</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>Kategorija</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAFETY">Sigurnost</SelectItem>
                  <SelectItem value="OPERATIONAL">Operativno</SelectItem>
                  <SelectItem value="COMPLIANCE">Sukladnost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Baseline</Label><Input type="number" step="0.01" value={baseline} onChange={(e) => setBaseline(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Cilj</Label><Input type="number" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} required /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5"><Label>Jedinica</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Početak</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Ciljani rok</Label><Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Napomene</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sačuvaj</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function UpdateSPTDialog({ spt, onOpenChange, onUpdated }: { spt: SPT | null; onOpenChange: (v: boolean) => void; onUpdated: () => void }) {
  const [value, setValue] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => { if (spt) setValue(spt.currentValue?.toString() || '') }, [spt])
  if (!spt) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await updateSPTProgress(spt.id, parseFloat(value))
      if (res.ok) {
        toast.success(`SPT ažuriran · Status: ${res.status} · Napredak: ${res.progressPercent?.toFixed(0)}%`)
        onOpenChange(false); onUpdated()
      } else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={!!spt} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Ažuriraj SPT: {spt.sptId}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="p-2 bg-muted/30 rounded text-sm">{spt.name}</div>
          <div className="text-xs">Baseline: {spt.baselineValue} · Cilj: {spt.targetValue} {spt.unit}</div>
          <div className="space-y-1.5"><Label>Trenutna vrijednost *</Label><Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} required /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sačuvaj</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// ACTIONS LIST
// ============================================================================

function ActionsList({ actions, onUpdated }: { actions: Action[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('ALL')
  const [prioFilter, setPrioFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)
  const [updateAction, setUpdateAction] = useState<Action | null>(null)

  const filtered = actions.filter((a) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [a.actionId, a.title, a.description, a.assignedTo, a.progressNotes, a.verificationResult].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (catFilter !== 'ALL' && a.category !== catFilter) return false
    if (prioFilter !== 'ALL' && a.priority !== prioFilter) return false
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po ID, naslovu, zaduženom..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Kategorija" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Sve kategorije</SelectItem>
            {Object.entries(ACTION_CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={prioFilter} onValueChange={setPrioFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Prioritet" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi prioriteti</SelectItem>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            {Object.entries(ACTION_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Nova akcija</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {actions.length}</div>
      </div>

      {actions.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <CheckSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema definisanih akcija.</p>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <CheckSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema rezultata pretrage.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => <ActionCard key={a.id} action={a} onUpdated={onUpdated} onUpdate={() => setUpdateAction(a)} />)}
        </div>
      )}

      <AddActionDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} />
      <UpdateActionDialog action={updateAction} onOpenChange={(v) => !v && setUpdateAction(null)} onUpdated={onUpdated} />
    </div>
  )
}

function ActionCard({ action: a, onUpdated, onUpdate }: { action: Action; onUpdated: () => void; onUpdate: () => void }) {
  const [isPending, startTransition] = useTransition()
  const handleDelete = () => {
    if (!confirm('Obrisati akciju?')) return
    startTransition(async () => {
      const res = await deleteSafetyAction(a.id)
      if (res.ok) { toast.success('Obrisano'); onUpdated() }
      else toast.error(res.error ?? 'Greška')
    })
  }
  const isOverdue = a.dueDate && new Date(a.dueDate) < new Date() && a.status !== 'COMPLETED'
  return (
    <Card className={`p-4 border-l-4 ${a.priority === 'CRITICAL' ? 'border-l-red-500' : a.priority === 'HIGH' ? 'border-l-orange-500' : a.priority === 'MEDIUM' ? 'border-l-amber-500' : 'border-l-blue-500'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">{a.actionId}</Badge>
            <Badge className={`text-xs ${PRIORITY_COLORS[a.priority]}`}>{PRIORITY_LABELS[a.priority]}</Badge>
            <Badge variant="secondary" className="text-xs">{ACTION_CATEGORY_LABELS[a.category] ?? a.category}</Badge>
            <Badge className="text-xs">{ACTION_STATUS_LABELS[a.status] ?? a.status}</Badge>
            {isOverdue && <Badge className="text-xs bg-red-100 text-red-800 animate-pulse">PREKORAČENO</Badge>}
          </div>
          <div className="text-sm font-medium">{a.title}</div>
          <div className="text-xs text-muted-foreground mt-1">{a.description}</div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span>Zadužen: <strong>{a.assignedTo}</strong></span>
            <span className={isOverdue ? 'text-red-600 font-medium' : ''}>Rok: {new Date(a.dueDate).toLocaleDateString('hr-HR')}</span>
            {a.completedAt && <span>Završeno: {new Date(a.completedAt).toLocaleDateString('hr-HR')}</span>}
            {a.estimatedCost != null && <span>Procjena: {a.estimatedCost}€</span>}
            {a.actualCost != null && <span>Stvarno: {a.actualCost}€</span>}
          </div>
          {a.progressNotes && <div className="text-xs mt-1 p-1.5 bg-muted/30 rounded">{a.progressNotes}</div>}
          {a.verificationResult && <div className="text-xs mt-1 p-1.5 bg-emerald-50 rounded"><strong>Verifikacija:</strong> {a.verificationResult}</div>}
          <div className="text-xs text-muted-foreground mt-1 flex gap-2">
            {a.hazardId && <Badge variant="outline" className="text-xs">{a.hazardId}</Badge>}
            {a.spiId && <Badge variant="outline" className="text-xs">{a.spiId}</Badge>}
            {a.sptId && <Badge variant="outline" className="text-xs">{a.sptId}</Badge>}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="ghost" onClick={onUpdate}>Ažuriraj</Button>
          <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function AddActionDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('CORRECTIVE')
  const [priority, setPriority] = useState('HIGH')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await createSafetyAction({
        title, description, category, priority,
        assignedTo, dueDate: dueDate || new Date(Date.now() + 7 * 86400000).toISOString(),
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
        notes: notes || undefined,
      })
      if (res.ok) {
        toast.success(`Akcija kreirana: ${res.actionId}`)
        onOpenChange(false); onAdded()
        setTitle(''); setDescription(''); setAssignedTo(''); setEstimatedCost(''); setNotes(''); setDueDate('')
      } else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova sigurnosna akcija (Safety Action)</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5"><Label>Naslov *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label>Opis *</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Kategorija</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ACTION_CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioritet</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Zadužen *</Label><Input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Rok</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Procijenjeni trošak (€)</Label><Input type="number" step="0.01" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Napomene</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sačuvaj</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function UpdateActionDialog({ action, onOpenChange, onUpdated }: { action: Action | null; onOpenChange: (v: boolean) => void; onUpdated: () => void }) {
  const [status, setStatus] = useState('OPEN')
  const [progressNotes, setProgressNotes] = useState('')
  const [verificationResult, setVerificationResult] = useState('')
  const [actualCost, setActualCost] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (action) {
      setStatus(action.status); setProgressNotes(action.progressNotes || '')
      setVerificationResult(action.verificationResult || '')
      setActualCost(action.actualCost?.toString() || '')
    }
  }, [action])

  if (!action) return null
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await updateSafetyActionStatus(action.id, status, progressNotes || undefined, verificationResult || undefined, actualCost ? parseFloat(actualCost) : undefined)
      if (res.ok) { toast.success('Akcija ažurirana'); onOpenChange(false); onUpdated() }
      else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={!!action} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Ažuriraj akciju: {action.actionId}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="p-2 bg-muted/30 rounded text-sm">{action.title}</div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(ACTION_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Bilješke o napretku</Label><Textarea value={progressNotes} onChange={(e) => setProgressNotes(e.target.value)} rows={2} /></div>
          <div className="space-y-1.5"><Label>Rezultat verifikacije</Label><Textarea value={verificationResult} onChange={(e) => setVerificationResult(e.target.value)} rows={2} placeholder="Kako je verifikovano da je akcija efikasna?" /></div>
          <div className="space-y-1.5"><Label>Stvarni trošak (€)</Label><Input type="number" step="0.01" value={actualCost} onChange={(e) => setActualCost(e.target.value)} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sačuvaj</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Shared components
// ============================================================================

function AlertCard({ icon: Icon, label, value, tone, onClick }: any) {
  const colors: any = {
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  }
  const iconColors: any = { amber: 'text-amber-600', red: 'text-red-600', blue: 'text-blue-600', emerald: 'text-emerald-600' }
  return (
    <button onClick={onClick} className={'text-left p-4 rounded-lg border ' + colors[tone] + ' hover:opacity-80 transition'}>
      <div className="flex items-center justify-between">
        <div><div className="text-2xl font-bold">{value}</div><div className="text-xs mt-0.5">{label}</div></div>
        <Icon className={'h-6 w-6 ' + iconColors[tone]} />
      </div>
    </button>
  )
}

function TabBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button onClick={onClick} className={'px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ' + (active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
      <Icon className="h-4 w-4" />{label}
    </button>
  )
}

function StatCard({ label, value, icon: Icon, tone }: any) {
  const colors: any = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  }
  return (
    <div className={'p-4 rounded-lg border ' + colors[tone]}>
      <div className="flex items-center justify-between">
        <div><div className="text-2xl font-bold">{value}</div><div className="text-xs mt-0.5">{label}</div></div>
        <Icon className="h-6 w-6 opacity-60" />
      </div>
    </div>
  )
}

function ShieldAlert(props: any) {
  return <AlertCircle {...props} />
}
