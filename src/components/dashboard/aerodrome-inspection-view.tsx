'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  Plane, Plus, Loader2, Calendar, Trash2, Search, Download, AlertTriangle,
  MapPin, Camera, FileText, BarChart3, TrendingUp, MapPinned, ShieldAlert,
  CheckCircle2, Clock, XCircle, AlertCircle, ClipboardCheck, Radio,
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
  getAerodromeInspections, createAerodromeInspection, deleteAerodromeInspection,
  getFindings, updateFindingStatus, deleteFinding,
  getNotams, createNotam, cancelNotam, deleteNotam,
  getInspectionStats, getSurfaceInspectionDueStatus, getDefectHistory, type SurfaceInspectionDueRow,
} from '@/lib/actions-inspection'
import {
  PAVEMENT_DEFECT_CATEGORIES, FENCE_DEFECT_CATEGORIES, getDefectCategoryDef,
  LOCATION_CODES, CONDITION_RATINGS,
} from '@/lib/inspection-codes'

type Inspection = Awaited<ReturnType<typeof getAerodromeInspections>>[number]
type Finding = Awaited<ReturnType<typeof getFindings>>[number]
type Notam = Awaited<ReturnType<typeof getNotams>>[number]
type Stats = Awaited<ReturnType<typeof getInspectionStats>>

const INSPECTION_TYPE_LABELS: Record<string, string> = {
  RUNWAY: 'Runway inspekcija (PSS)',
  TAXIWAY: 'Taxiway inspekcija (RS)',
  APRON: 'Apron inspekcija (parking)',
  MOVEMENT_AREA_JOINT: 'Movement Area Joint',
  RUNWAY_STRIP: 'Osnovna staza PSS-a',
  TAXIWAY_STRIP: 'Osnovna staza RS-a',
  DRAINAGE: 'Sistem za odvodnjavanje',
  FENCE: 'Žičana ograda',
  BUILDING: 'Građevinski objekti',
  WATER_SEWAGE: 'Vodovod i kanalizacija',
  GREEN_AREA: 'Zelene površine',
}

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Završeno',
  WITH_FINDINGS: 'Sa nalazima',
  CRITICAL: 'KRITIČNO',
  ABORTED: 'Prekinuto',
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  WITH_FINDINGS: 'bg-amber-100 text-amber-800',
  CRITICAL: 'bg-red-100 text-red-800',
  ABORTED: 'bg-gray-100 text-gray-800',
}

const CHECK_LABELS: Record<string, string> = {
  OK: 'OK',
  NOT_OK: 'Nije OK',
  N_A: 'N/A',
}

const CATEGORY_LABELS: Record<string, string> = {
  FOD: 'FOD (strani objekti)',
  PAVEMENT_DAMAGE: 'Oštećenje kolovoza',
  MARKINGS: 'Oznake',
  LIGHTING: 'Osvjetljenje',
  WILDLIFE: 'Divljač',
  DRAINAGE: 'Drenaža',
  GSE_PARKING: 'GSE parking',
  SIGNAGE: 'Znakovi',
  OTHER: 'Ostalo',
}

const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Nisko',
  MEDIUM: 'Srednje',
  HIGH: 'Visoko',
  CRITICAL: 'Kritično',
}

const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'bg-blue-100 text-blue-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
}

const FINDING_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Otvoreno',
  IN_PROGRESS: 'U toku',
  RESOLVED: 'Riješeno',
  DEFERRED: 'Odgloženo',
}

const RUNWAY_CONDITIONS = ['DRY', 'WET', 'DAMP', 'SNOW', 'ICE', 'SLUSH', 'STANDING_WATER']

// Reusable check select (defined outside component to avoid ESLint react-hooks/static-components error)
function CheckSelect({ label, value, onChange }: any) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="OK">✓ OK</SelectItem>
          <SelectItem value="NOT_OK">✗ Nije OK</SelectItem>
          <SelectItem value="N_A">— N/A</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

export function AerodromeInspectionView() {
  const [tab, setTab] = useState<'inspections' | 'findings' | 'notam' | 'due' | 'stats' | 'trends'>('inspections')
  const [insp, setInsp] = useState<Inspection[]>([])
  const [findings, setFindings] = useState<Finding[]>([])
  const [notams, setNotams] = useState<Notam[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [dueStatus, setDueStatus] = useState<SurfaceInspectionDueRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [i, f, n, s, d] = await Promise.all([
        getAerodromeInspections(), getFindings(), getNotams(), getInspectionStats(), getSurfaceInspectionDueStatus(),
      ])
      setInsp(i); setFindings(f); setNotams(n); setStats(s); setDueStatus(d)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const criticalCount = insp.filter(i => i.status === 'CRITICAL').length
  const openFindings = findings.filter(f => f.status === 'OPEN' || f.status === 'IN_PROGRESS').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Plane className="h-5 w-5" />Aerodrome Daily Inspection</h2>
          <p className="text-sm text-muted-foreground">ADR.OPS.B.005 · ICAO Annex 14 · NOTAM (ICAO Annex 15)</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/daily-inspection', '_blank')}><Download className="h-4 w-4 mr-1.5" />Dnevni PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/inspection-findings', '_blank')}><Download className="h-4 w-4 mr-1.5" />Nalazi PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/inspection-monthly-stats', '_blank')}><Download className="h-4 w-4 mr-1.5" />Mjesečni PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/inspection-annual-stats', '_blank')}><Download className="h-4 w-4 mr-1.5" />Godišnji PDF</Button>
        </div>
      </div>

      {/* Alert cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AlertCard icon={ClipboardCheck} label="Inspekcije" value={insp.length} tone="blue" onClick={() => setTab('inspections')} />
        <AlertCard icon={AlertTriangle} label="Otvoreni nalazi" value={openFindings} tone="amber" onClick={() => setTab('findings')} />
        <AlertCard icon={ShieldAlert} label="Kritični" value={criticalCount} tone="red" onClick={() => setTab('inspections')} />
        <AlertCard icon={Radio} label="Aktivni NOTAM-i" value={notams.filter(n => n.status === 'ACTIVE').length} tone="purple" onClick={() => setTab('notam')} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto">
        <TabBtn active={tab === 'inspections'} onClick={() => setTab('inspections')} icon={ClipboardCheck} label="Inspekcije" />
        <TabBtn active={tab === 'findings'} onClick={() => setTab('findings')} icon={AlertTriangle} label="Nalazi" />
        <TabBtn active={tab === 'notam'} onClick={() => setTab('notam')} icon={Radio} label="NOTAM" />
        <TabBtn active={tab === 'due'} onClick={() => setTab('due')} icon={Calendar} label="Dospjelost pregleda" />
        <TabBtn active={tab === 'stats'} onClick={() => setTab('stats')} icon={BarChart3} label="Statistika" />
        <TabBtn active={tab === 'trends'} onClick={() => setTab('trends')} icon={TrendingUp} label="Trendovi" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : tab === 'inspections' ? (
        <InspectionsList inspections={insp} onUpdated={load} />
      ) : tab === 'findings' ? (
        <FindingsList findings={findings} onUpdated={load} />
      ) : tab === 'notam' ? (
        <NotamList notams={notams} findings={findings} onUpdated={load} />
      ) : tab === 'due' ? (
        <DueStatusList rows={dueStatus} />
      ) : tab === 'stats' ? (
        <StatsView stats={stats} />
      ) : (
        <TrendsView stats={stats} />
      )}
    </div>
  )
}

// ============================================================================
// INSPECTIONS LIST
// ============================================================================

function InspectionsList({ inspections, onUpdated }: { inspections: Inspection[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)

  const filtered = inspections.filter((i) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [i.performedBy, i.performedByCardId, i.runwayCode, i.taxiwayCode, i.apronArea, i.weatherConditions, i.notes].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (typeFilter !== 'ALL' && i.inspectionType !== typeFilter) return false
    if (statusFilter !== 'ALL' && i.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-3">
      {/* Search — ALWAYS visible */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po inspektoru, lokaciji, RWY/TWY..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Tip" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi tipovi</SelectItem>
            {Object.entries(INSPECTION_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Nova inspekcija</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {inspections.length}</div>
      </div>

      {inspections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nema zabilježenih inspekcija.</p>
            <p className="text-xs mt-1">Kliknite "Nova inspekcija" da započnete.</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nema rezultata pretrage.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((i) => <InspectionCard key={i.id} inspection={i} onDeleted={onUpdated} />)}
        </div>
      )}

      <AddInspectionDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} />
    </div>
  )
}

function InspectionCard({ inspection: i, onDeleted }: { inspection: Inspection; onDeleted: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [showDetails, setShowDetails] = useState(false)

  const handleDelete = () => {
    if (!confirm('Obrisati ovu inspekciju?')) return
    startTransition(async () => {
      const res = await deleteAerodromeInspection(i.id)
      if (res.ok) { toast.success('Obrisano'); onDeleted() }
      else toast.error(res.error ?? 'Greška')
    })
  }

  const checks = [
    ['Runway površina', i.runwaySurface],
    ['Runway oznake', i.runwayMarkings],
    ['Runway svjetla', i.runwayLights],
    ['PAPI svjetla', i.papiLights],
    ['Wind indicator', i.windDirectionIndicators],
    ['Taxiway površina', i.taxiwaySurface],
    ['Taxiway znakovi', i.taxiwaySigns],
    ['Taxiway svjetla', i.taxiwayLights],
    ['GSE parking', i.gseParking],
    ['FOD check', i.fodCheck],
    ['Oznake', i.markings],
    ['Fueling area', i.fuelingArea],
    ['Drenaža', i.drainageSystem],
    ['Perimeter ograđa', i.perimeterFence],
    ['Divljač', i.wildlifeActivity],
  ].filter(([, v]) => v) as Array<[string, string]>

  return (
    <Card className={`p-4 border-l-4 ${i.status === 'CRITICAL' ? 'border-l-red-500' : i.status === 'WITH_FINDINGS' ? 'border-l-amber-500' : 'border-l-emerald-500'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="text-xs">{INSPECTION_TYPE_LABELS[i.inspectionType] ?? i.inspectionType}</Badge>
            <Badge className={`text-xs ${STATUS_COLORS[i.status] ?? ''}`}>{STATUS_LABELS[i.status] ?? i.status}</Badge>
            {i.runwayCode && <Badge variant="secondary" className="font-mono text-xs">RWY {i.runwayCode}</Badge>}
            {i.taxiwayCode && <Badge variant="secondary" className="font-mono text-xs">TWY {i.taxiwayCode}</Badge>}
            {i.apronArea && <Badge variant="secondary" className="text-xs">{i.apronArea}</Badge>}
            {i.findingsCount > 0 && <Badge variant="outline" className="text-xs">{i.findingsCount} nalaza</Badge>}
            {i.criticalCount > 0 && <Badge className="text-xs bg-red-100 text-red-800">{i.criticalCount} kritično</Badge>}
          </div>
          <div className="text-sm font-medium">{i.performedBy}{i.shift && ` · ${i.shift}`}</div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(i.inspectionDate).toLocaleString('hr-HR').slice(0, 16)}</span>
            {i.weatherConditions && <span>{i.weatherConditions}</span>}
            {i.runwayCondition && <Badge variant="outline" className="text-xs">{i.runwayCondition}</Badge>}
          </div>
          {i.notes && <div className="text-xs mt-1 text-muted-foreground italic">{i.notes}</div>}

          {showDetails && checks.length > 0 && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
              {checks.map(([label, val]) => (
                <div key={label} className="text-xs flex items-center gap-1.5">
                  {val === 'OK' ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : val === 'NOT_OK' ? <XCircle className="h-3 w-3 text-red-600" /> : <AlertCircle className="h-3 w-3 text-gray-400" />}
                  <span>{label}: <strong>{CHECK_LABELS[val as string] ?? val}</strong></span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          {checks.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setShowDetails(!showDetails)}>
              {showDetails ? 'Sakrij' : 'Prikaži'} detalje
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function AddInspectionDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const [inspectionType, setInspectionType] = useState('RUNWAY')
  const [inspectionDate, setInspectionDate] = useState('')
  const [performedBy, setPerformedBy] = useState('')
  const [performedByCardId, setPerformedByCardId] = useState('')
  const [shift, setShift] = useState('Morning')
  const [runwayCode, setRunwayCode] = useState('14/32')
  const [taxiwayCode, setTaxiwayCode] = useState('')
  const [apronArea, setApronArea] = useState('')
  const [weatherConditions, setWeatherConditions] = useState('')
  const [visibility, setVisibility] = useState('')
  const [runwayCondition, setRunwayCondition] = useState('DRY')
  const [runwaySurface, setRunwaySurface] = useState('OK')
  const [runwayMarkings, setRunwayMarkings] = useState('OK')
  const [runwayLights, setRunwayLights] = useState('OK')
  const [papiLights, setPapiLights] = useState('OK')
  const [windDirectionIndicators, setWindDirectionIndicators] = useState('OK')
  const [taxiwaySurface, setTaxiwaySurface] = useState('OK')
  const [taxiwaySigns, setTaxiwaySigns] = useState('OK')
  const [taxiwayLights, setTaxiwayLights] = useState('OK')
  const [gseParking, setGseParking] = useState('OK')
  const [fodCheck, setFodCheck] = useState('OK')
  const [markings, setMarkings] = useState('OK')
  const [fuelingArea, setFuelingArea] = useState('OK')
  const [drainageSystem, setDrainageSystem] = useState('OK')
  const [perimeterFence, setPerimeterFence] = useState('OK')
  const [wildlifeActivity, setWildlifeActivity] = useState('OK')
  const [notes, setNotes] = useState('')
  const [findings, setFindings] = useState<Array<any>>([])
  const [showFindingForm, setShowFindingForm] = useState(false)
  const [isPending, startTransition] = useTransition()

  // New finding form
  const [fCat, setFCat] = useState('FOD')
  const [fSev, setFSev] = useState('LOW')
  const [fDesc, setFDesc] = useState('')
  const [fLoc, setFLoc] = useState('')
  const [fLat, setFLat] = useState('')
  const [fLng, setFLng] = useState('')
  const [fAction, setFAction] = useState('')
  // PRG.03.02 K-kod strukturirana polja (samo za nove tipove pregleda)
  const [fLengthM, setFLengthM] = useState('')
  const [fMaxWidthCm, setFMaxWidthCm] = useState('')
  const [fMaxDepthCm, setFMaxDepthCm] = useState('')
  const [fLocationCode, setFLocationCode] = useState('')
  const [fFenceFrom, setFFenceFrom] = useState('')
  const [fFenceTo, setFFenceTo] = useState('')
  const [fIsMarked, setFIsMarked] = useState(false)
  const [fConditionRating, setFConditionRating] = useState('')
  const [fTrackingGroupId, setFTrackingGroupId] = useState('')

  // K-kod tipovi pregleda koriste PRG.03.02 kodovnik umjesto generičkih
  // ADR.OPS kategorija (FOD/PAVEMENT_DAMAGE/...)
  const K_CODE_TYPES = ['RUNWAY_STRIP', 'TAXIWAY_STRIP', 'DRAINAGE', 'BUILDING', 'WATER_SEWAGE', 'GREEN_AREA']
  const isFenceType = inspectionType === 'FENCE'
  const usesKCodes = isFenceType || K_CODE_TYPES.includes(inspectionType)
  const kCodeOptions = isFenceType ? FENCE_DEFECT_CATEGORIES : PAVEMENT_DEFECT_CATEGORIES
  const selectedKDef = usesKCodes ? getDefectCategoryDef(fCat) : undefined

  const addFinding = () => {
    if (!fDesc) { toast.error('Opis nalaza je obavezan'); return }
    setFindings([...findings, {
      category: fCat, severity: fSev, description: fDesc,
      location: fLoc || undefined,
      latitude: fLat ? parseFloat(fLat) : undefined,
      longitude: fLng ? parseFloat(fLng) : undefined,
      actionRequired: fAction || undefined,
      lengthM: fLengthM ? parseFloat(fLengthM) : undefined,
      maxWidthCm: fMaxWidthCm ? parseFloat(fMaxWidthCm) : undefined,
      maxDepthCm: fMaxDepthCm ? parseFloat(fMaxDepthCm) : undefined,
      locationCode: fLocationCode || undefined,
      fenceStubFrom: fFenceFrom ? parseInt(fFenceFrom, 10) : undefined,
      fenceStubTo: fFenceTo ? parseInt(fFenceTo, 10) : (fFenceFrom ? parseInt(fFenceFrom, 10) : undefined),
      isMarked: fIsMarked || undefined,
      conditionRating: fConditionRating || undefined,
      trackingGroupId: fTrackingGroupId.trim() || undefined,
    }])
    setFCat('FOD'); setFSev('LOW'); setFDesc(''); setFLoc(''); setFLat(''); setFLng(''); setFAction('')
    setFLengthM(''); setFMaxWidthCm(''); setFMaxDepthCm(''); setFLocationCode('')
    setFFenceFrom(''); setFFenceTo(''); setFIsMarked(false); setFConditionRating(''); setFTrackingGroupId('')
    setShowFindingForm(false)
  }

  // Kad se promijeni tip pregleda, resetuj kategoriju na prvu ispravnu
  // opciju za taj tip (K-kod lista vs generičke ADR.OPS kategorije)
  useEffect(() => {
    setFCat(usesKCodes ? kCodeOptions[0]?.category ?? 'OTHER' : 'FOD')
    setFConditionRating('')
  }, [inspectionType])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await createAerodromeInspection({
        inspectionType,
        inspectionDate: inspectionDate ? new Date(inspectionDate).toISOString() : new Date().toISOString(),
        performedBy,
        performedByCardId: performedByCardId || undefined,
        shift,
        runwayCode: runwayCode || undefined,
        taxiwayCode: taxiwayCode || undefined,
        apronArea: apronArea || undefined,
        weatherConditions: weatherConditions || undefined,
        visibility: visibility ? parseFloat(visibility) : undefined,
        runwayCondition,
        runwaySurface, runwayMarkings, runwayLights, papiLights, windDirectionIndicators,
        taxiwaySurface, taxiwaySigns, taxiwayLights,
        gseParking, fodCheck, markings, fuelingArea,
        drainageSystem, perimeterFence, wildlifeActivity,
        notes: notes || undefined,
        findings,
      })
      if (res.ok) {
        toast.success(`Inspekcija zabilježena${res.findingsCount ? ` · ${res.findingsCount} nalaza` : ''}${res.criticalCount ? ` · ${res.criticalCount} kritično` : ''}`)
        onOpenChange(false); onAdded()
        setPerformedBy(''); setPerformedByCardId(''); setRunwayCode('14/32'); setTaxiwayCode('')
        setApronArea(''); setWeatherConditions(''); setVisibility(''); setNotes('')
        setFindings([])
      } else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova aerodromska inspekcija</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Osnovno */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="space-y-1.5">
              <Label>Tip inspekcije *</Label>
              <Select value={inspectionType} onValueChange={setInspectionType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(INSPECTION_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Datum/vrijeme</Label><Input type="datetime-local" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Inspektor *</Label><Input value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} required /></div>
            <div className="space-y-1.5">
              <Label>Smjena</Label>
              <Select value={shift} onValueChange={setShift}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Morning">Jutro</SelectItem>
                  <SelectItem value="Evening">Veče</SelectItem>
                  <SelectItem value="Night">Noć</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lokacija */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="space-y-1.5"><Label>Runway</Label><Input value={runwayCode} onChange={(e) => setRunwayCode(e.target.value)} placeholder="14/32" /></div>
            <div className="space-y-1.5"><Label>Taxiway</Label><Input value={taxiwayCode} onChange={(e) => setTaxiwayCode(e.target.value)} placeholder="A" /></div>
            <div className="space-y-1.5"><Label>Apron</Label><Input value={apronArea} onChange={(e) => setApronArea(e.target.value)} placeholder="Apron 1" /></div>
            <div className="space-y-1.5">
              <Label>Runway stanje</Label>
              <Select value={runwayCondition} onValueChange={setRunwayCondition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RUNWAY_CONDITIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Vremenski uslovi */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Vremenski uslovi</Label><Input value={weatherConditions} onChange={(e) => setWeatherConditions(e.target.value)} placeholder="Clear, OAT 5°C, wind 280/5kt" /></div>
            <div className="space-y-1.5"><Label>Vidljivost (m)</Label><Input type="number" value={visibility} onChange={(e) => setVisibility(e.target.value)} placeholder="10000" /></div>
          </div>

          {/* Checklist */}
          {inspectionType === 'RUNWAY' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm font-medium mb-2">Runway provjere</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <CheckSelect label="Površina" value={runwaySurface} onChange={setRunwaySurface} />
                <CheckSelect label="Oznake" value={runwayMarkings} onChange={setRunwayMarkings} />
                <CheckSelect label="Svjetla" value={runwayLights} onChange={setRunwayLights} />
                <CheckSelect label="PAPI" value={papiLights} onChange={setPapiLights} />
                <CheckSelect label="Wind indicator" value={windDirectionIndicators} onChange={setWindDirectionIndicators} />
              </div>
            </div>
          )}

          {inspectionType === 'TAXIWAY' && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="text-sm font-medium mb-2">Taxiway provjere</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <CheckSelect label="Površina" value={taxiwaySurface} onChange={setTaxiwaySurface} />
                <CheckSelect label="Znakovi" value={taxiwaySigns} onChange={setTaxiwaySigns} />
                <CheckSelect label="Svjetla" value={taxiwayLights} onChange={setTaxiwayLights} />
              </div>
            </div>
          )}

          {inspectionType === 'APRON' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="text-sm font-medium mb-2">Apron provjere</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <CheckSelect label="GSE parking" value={gseParking} onChange={setGseParking} />
                <CheckSelect label="FOD check" value={fodCheck} onChange={setFodCheck} />
                <CheckSelect label="Oznake" value={markings} onChange={setMarkings} />
                <CheckSelect label="Fueling area" value={fuelingArea} onChange={setFuelingArea} />
              </div>
            </div>
          )}

          {inspectionType === 'MOVEMENT_AREA_JOINT' && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="text-sm font-medium mb-2">Movement Area Joint provjere</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <CheckSelect label="Drenaža" value={drainageSystem} onChange={setDrainageSystem} />
                <CheckSelect label="Perimeter ograda" value={perimeterFence} onChange={setPerimeterFence} />
                <CheckSelect label="Divljač" value={wildlifeActivity} onChange={setWildlifeActivity} />
              </div>
            </div>
          )}

          {/* Findings */}
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Nalazi (findings)</div>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowFindingForm(!showFindingForm)}>
                <Plus className="h-3 w-3 mr-1" />Dodaj nalaz
              </Button>
            </div>
            {showFindingForm && (
              <div className="space-y-2 mb-2 p-2 border rounded bg-white">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{usesKCodes ? 'Vrsta nedostatka (K-kod)' : 'Kategorija'}</Label>
                    <Select value={fCat} onValueChange={setFCat}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {usesKCodes
                          ? kCodeOptions.map((c) => <SelectItem key={c.category} value={c.category}>{c.code} - {c.label}</SelectItem>)
                          : Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {!usesKCodes && (
                    <div className="space-y-1">
                      <Label className="text-xs">Težina</Label>
                      <Select value={fSev} onValueChange={setFSev}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(SEVERITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  {usesKCodes && (
                    <div className="space-y-1">
                      <Label className="text-xs">Ocjena (Tabela 7)</Label>
                      <Select value={fConditionRating} onValueChange={(v) => { setFConditionRating(v); setFSev(v === 'NA' ? 'CRITICAL' : v === 'A' ? 'HIGH' : 'LOW') }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Odaberite..." /></SelectTrigger>
                        <SelectContent>{CONDITION_RATINGS.map((r) => <SelectItem key={r.code} value={r.code}>{r.code} - {r.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  {!usesKCodes && (
                    <>
                      <div className="space-y-1"><Label className="text-xs">Lokacija</Label><Input className="h-8 text-xs" value={fLoc} onChange={(e) => setFLoc(e.target.value)} placeholder="RWY 14, 200m" /></div>
                      <div className="space-y-1"><Label className="text-xs">Koordinate</Label><div className="flex gap-1"><Input className="h-8 text-xs" type="number" step="0.0001" value={fLat} onChange={(e) => setFLat(e.target.value)} placeholder="lat" /><Input className="h-8 text-xs" type="number" step="0.0001" value={fLng} onChange={(e) => setFLng(e.target.value)} placeholder="lng" /></div></div>
                    </>
                  )}
                </div>

                {/* PRG.03.02 K-kod strukturirana polja - samo za nove tipove pregleda */}
                {usesKCodes && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-2 bg-blue-50/50 rounded border border-blue-100">
                    {selectedKDef?.measurements.map((m) => (
                      <div key={m.field} className="space-y-1">
                        <Label className="text-xs">{m.label}</Label>
                        <Input
                          className="h-8 text-xs" type="number" step="0.01"
                          value={m.field === 'lengthM' ? fLengthM : m.field === 'maxWidthCm' ? fMaxWidthCm : fMaxDepthCm}
                          onChange={(e) => {
                            if (m.field === 'lengthM') setFLengthM(e.target.value)
                            else if (m.field === 'maxWidthCm') setFMaxWidthCm(e.target.value)
                            else setFMaxDepthCm(e.target.value)
                          }}
                        />
                      </div>
                    ))}
                    {selectedKDef?.needsLocationCode && (
                      <div className="space-y-1">
                        <Label className="text-xs">Lokacija (Tabela 6)</Label>
                        <Select value={fLocationCode} onValueChange={setFLocationCode}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="L/C/R..." /></SelectTrigger>
                          <SelectContent>{LOCATION_CODES.map((l) => <SelectItem key={l.code} value={l.code}>{l.code} - {l.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    {selectedKDef?.needsFenceStub && (
                      <>
                        <div className="space-y-1"><Label className="text-xs">Stub (od)</Label><Input className="h-8 text-xs" type="number" value={fFenceFrom} onChange={(e) => setFFenceFrom(e.target.value)} /></div>
                        <div className="space-y-1"><Label className="text-xs">Stub (do)</Label><Input className="h-8 text-xs" type="number" value={fFenceTo} onChange={(e) => setFFenceTo(e.target.value)} placeholder="opciono" /></div>
                      </>
                    )}
                    {selectedKDef?.markable && (
                      <label className="flex items-center gap-1.5 text-xs mt-4">
                        <input type="checkbox" checked={fIsMarked} onChange={(e) => setFIsMarked(e.target.checked)} className="h-3.5 w-3.5" />
                        Markirano crvenom bojom
                      </label>
                    )}
                    {selectedKDef && selectedKDef.measurements.length > 0 && (
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs">ID praćenja (opciono - isti ID kod sljedećeg pregleda = ista pukotina)</Label>
                        <Input className="h-8 text-xs" value={fTrackingGroupId} onChange={(e) => setFTrackingGroupId(e.target.value)} placeholder="npr. PSS-14-K1-01" />
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1"><Label className="text-xs">Opis *</Label><Textarea className="text-xs" value={fDesc} onChange={(e) => setFDesc(e.target.value)} rows={2} placeholder="Detaljan opis nalaza..." /></div>
                {!usesKCodes && (
                  <div className="space-y-1"><Label className="text-xs">Potrebna akcija</Label><Input className="h-8 text-xs" value={fAction} onChange={(e) => setFAction(e.target.value)} placeholder="npr. Ukloniti FOD, popraviti oznake..." /></div>
                )}
                <Button type="button" size="sm" onClick={addFinding}>Dodaj u listu</Button>
              </div>
            )}
            {findings.length > 0 && (
              <div className="space-y-1">
                {findings.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-2 bg-white rounded border">
                    <div>
                      <Badge className={`mr-1 text-xs ${SEVERITY_COLORS[f.severity]}`}>{SEVERITY_LABELS[f.severity]}</Badge>
                      <Badge variant="outline" className="mr-1 text-xs">{CATEGORY_LABELS[f.category] ?? f.category}</Badge>
                      <span>{f.description.slice(0, 60)}{f.description.length > 60 ? '...' : ''}</span>
                      {f.location && <span className="text-muted-foreground ml-1">· {f.location}</span>}
                    </div>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setFindings(findings.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-3 w-3 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {findings.length === 0 && !showFindingForm && <p className="text-xs text-muted-foreground">Nema nalaza — inspekcija je čista.</p>}
          </div>

          <div className="space-y-1.5"><Label>Napomene</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sačuvaj inspekciju</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// FINDINGS LIST
// ============================================================================

function FindingsList({ findings, onUpdated }: { findings: Finding[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('ALL')
  const [sevFilter, setSevFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const filtered = findings.filter((f) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [f.description, f.location, f.actionRequired, f.actionTaken, f.notamNumber].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (catFilter !== 'ALL' && f.category !== catFilter) return false
    if (sevFilter !== 'ALL' && f.severity !== sevFilter) return false
    if (statusFilter !== 'ALL' && f.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po opisu, lokaciji, NOTAM-u..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Kategorija" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Sve kategorije</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sevFilter} onValueChange={setSevFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Težina" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Sve težine</SelectItem>
            {Object.entries(SEVERITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            {Object.entries(FINDING_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {findings.length}</div>
      </div>

      {findings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nema zabilježenih nalaza.</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nema rezultata pretrage.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => <FindingCard key={f.id} finding={f} onUpdated={onUpdated} />)}
        </div>
      )}
    </div>
  )
}

function FindingCard({ finding: f, onUpdated }: { finding: Finding; onUpdated: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [showActions, setShowActions] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getDefectHistory>> | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [actionTaken, setActionTaken] = useState(f.actionTaken || '')
  const [newStatus, setNewStatus] = useState(f.status)

  const kBits: string[] = []
  if ((f as any).lengthM != null) kBits.push(`dužina/pov.: ${(f as any).lengthM}m`)
  if ((f as any).maxWidthCm != null) kBits.push(`širina: ${(f as any).maxWidthCm}cm`)
  if ((f as any).maxDepthCm != null) kBits.push(`dubina/visina: ${(f as any).maxDepthCm}cm`)
  if ((f as any).locationCode) kBits.push(`lokacija: ${(f as any).locationCode}`)
  if ((f as any).fenceStubFrom != null) kBits.push(`stub: ${(f as any).fenceStubFrom}${(f as any).fenceStubTo && (f as any).fenceStubTo !== (f as any).fenceStubFrom ? `-${(f as any).fenceStubTo}` : ''}`)
  if ((f as any).isMarked) kBits.push('markirano')
  if ((f as any).conditionRating) kBits.push(`ocjena: ${(f as any).conditionRating}`)

  const toggleHistory = async () => {
    if (showHistory) { setShowHistory(false); return }
    setShowHistory(true)
    if (!history && (f as any).trackingGroupId) {
      setHistoryLoading(true)
      try {
        const h = await getDefectHistory((f as any).trackingGroupId)
        setHistory(h)
      } finally {
        setHistoryLoading(false)
      }
    }
  }

  const handleStatusUpdate = () => {
    startTransition(async () => {
      const res = await updateFindingStatus(f.id, newStatus, actionTaken, 'Admin')
      if (res.ok) { toast.success('Status ažuriran'); setShowActions(false); onUpdated() }
      else toast.error(res.error ?? 'Greška')
    })
  }

  const handleDelete = () => {
    if (!confirm('Obrisati ovaj nalaz?')) return
    startTransition(async () => {
      const res = await deleteFinding(f.id)
      if (res.ok) { toast.success('Obrisano'); onUpdated() }
      else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Card className={`p-4 border-l-4 ${f.severity === 'CRITICAL' ? 'border-l-red-500' : f.severity === 'HIGH' ? 'border-l-orange-500' : f.severity === 'MEDIUM' ? 'border-l-amber-500' : 'border-l-blue-500'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge className={`text-xs ${SEVERITY_COLORS[f.severity]}`}>{SEVERITY_LABELS[f.severity]}</Badge>
            <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[f.category] ?? f.category}</Badge>
            <Badge variant="secondary" className="text-xs">{FINDING_STATUS_LABELS[f.status] ?? f.status}</Badge>
            {f.notamGenerated && <Badge className="text-xs bg-purple-100 text-purple-800">NOTAM: {f.notamNumber}</Badge>}
          </div>
          <div className="text-sm font-medium">{f.description}</div>
          {f.location && <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="h-3 w-3" />{f.location}</div>}
          {f.latitude != null && f.longitude != null && (
            <div className="text-xs text-muted-foreground">Koordinate: {f.latitude.toFixed(4)}, {f.longitude.toFixed(4)}</div>
          )}
          {f.photoUrl && <div className="mt-1"><img src={f.photoUrl} alt="Foto dokaz" className="max-h-32 rounded border" /></div>}
          {f.actionRequired && <div className="text-xs mt-1 p-1.5 bg-amber-50 rounded">Potrebna akcija: {f.actionRequired}</div>}
          {f.actionTaken && <div className="text-xs mt-1 p-1.5 bg-emerald-50 rounded">Poduzeto: {f.actionTaken}</div>}
          {kBits.length > 0 && (
            <div className={`text-xs mt-1 p-1.5 rounded ${(f as any).conditionRating === 'NA' ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>
              PRG.03.02: {kBits.join(' · ')}
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span>{new Date(f.createdAt).toLocaleString('hr-HR').slice(0, 16)}</span>
            {f.inspection && (
              <span>· {INSPECTION_TYPE_LABELS[f.inspection.inspectionType] ?? f.inspection.inspectionType}
                {f.inspection.runwayCode && ` RWY ${f.inspection.runwayCode}`}
                {f.inspection.taxiwayCode && ` TWY ${f.inspection.taxiwayCode}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {(f as any).trackingGroupId && (
            <Button size="sm" variant="ghost" onClick={toggleHistory}>Istorija</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setShowActions(!showActions)}>Ažuriraj</Button>
          <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
          </Button>
        </div>
      </div>

      {showHistory && (
        <div className="mt-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
          <div className="text-xs font-medium mb-2">
            Istorija mjerenja (ID praćenja: {(f as any).trackingGroupId}) - poređenje umjesto ručnog vizuelnog upoređivanja papira
          </div>
          {historyLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : !history || history.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nema ranijih mjerenja za ovaj ID.</p>
          ) : (
            <div className="space-y-1">
              {history.map((h, idx) => {
                const prev = idx > 0 ? history[idx - 1] : null
                const lengthDelta = prev && h.lengthM != null && prev.lengthM != null ? h.lengthM - prev.lengthM : null
                return (
                  <div key={h.id} className="text-xs flex items-center gap-3 p-1.5 bg-white rounded border">
                    <span className="text-muted-foreground w-24 flex-shrink-0">{h.date ? new Date(h.date).toLocaleDateString('hr-HR') : '-'}</span>
                    <span>dužina/pov.: {h.lengthM ?? '-'}m</span>
                    <span>širina: {h.maxWidthCm ?? '-'}cm</span>
                    <span>ocjena: {h.conditionRating ?? '-'}</span>
                    {lengthDelta != null && (
                      <span className={lengthDelta > 0 ? 'text-red-700 font-medium' : lengthDelta < 0 ? 'text-emerald-700' : 'text-muted-foreground'}>
                        {lengthDelta > 0 ? `+${lengthDelta.toFixed(2)}m raste` : lengthDelta < 0 ? `${lengthDelta.toFixed(2)}m opada` : 'bez promjene'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {showActions && (
        <div className="mt-3 p-3 bg-muted/30 rounded-lg space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Novi status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(FINDING_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Poduzeta akcija</Label><Input className="h-8 text-xs" value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} /></div>
          </div>
          <Button size="sm" onClick={handleStatusUpdate} disabled={isPending}>
            {isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Sačuvaj
          </Button>
        </div>
      )}
    </Card>
  )
}

// ============================================================================
// NOTAM LIST
// ============================================================================

function DueStatusList({ rows }: { rows: SurfaceInspectionDueRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nema podataka</p>
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Digitalna zamjena za ručno prelistavanje papirnih izvještaja pri izradi godišnjeg Plana
        održavanja (PRG.03.02, tačka 3.3). Rok je gruba procjena (365 / broj pregleda godišnje) -
        stvarno pravilo prije/poslije sezone (1.maj - 31.okt) ostaje na procjeni MING-a.
      </p>
      {rows.map((r) => (
        <div
          key={r.type}
          className={`flex items-center justify-between p-3 rounded-lg border ${r.isDue ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50/50'}`}
        >
          <div>
            <div className="text-sm font-medium">{r.label}</div>
            <div className="text-xs text-muted-foreground">
              {r.obrazac} · {r.timesPerYear}x godišnje
              {r.lastInspectionDate
                ? ` · poslednji pregled ${new Date(r.lastInspectionDate).toLocaleDateString('hr-HR')} (prije ${r.daysSinceLastInspection} dana)`
                : ' · nikad pregledano'}
            </div>
          </div>
          <Badge className={r.isDue ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}>
            {r.isDue ? 'Dospjelo' : 'U roku'}
          </Badge>
        </div>
      ))}
    </div>
  )
}

function NotamList({ notams, findings, onUpdated }: { notams: Notam[]; findings: Finding[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showCreate, setShowCreate] = useState(false)
  const [createFromFinding, setCreateFromFinding] = useState<string>('')

  const filtered = notams.filter((n) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [n.notamNumber, n.aerodrome, n.subject, n.condition, n.text].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (statusFilter !== 'ALL' && n.status !== statusFilter) return false
    return true
  })

  const openFindings = findings.filter(f => f.status === 'OPEN' || f.status === 'IN_PROGRESS')

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po broju, aerodromu, tekstu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            <SelectItem value="ACTIVE">Aktivan</SelectItem>
            <SelectItem value="CANCELLED">Otkazan</SelectItem>
            <SelectItem value="EXPIRED">Istekao</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1.5" />Novi NOTAM</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {notams.length}</div>
      </div>

      {openFindings.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg">
          <div className="text-sm font-medium text-amber-900">{openFindings.length} otvorenih nalaza — kreirajte NOTAM po potrebi</div>
          <div className="mt-2">
            <Select value={createFromFinding} onValueChange={(v) => { setCreateFromFinding(v); setShowCreate(true) }}>
              <SelectTrigger><SelectValue placeholder="Izaberite nalaz za NOTAM..." /></SelectTrigger>
              <SelectContent>
                {openFindings.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {SEVERITY_LABELS[f.severity]} · {CATEGORY_LABELS[f.category]} · {f.description.slice(0, 40)}...
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {notams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Radio className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nema kreiranih NOTAM-a.</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Radio className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nema rezultata pretrage.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => <NotamCard key={n.id} notam={n} onUpdated={onUpdated} />)}
        </div>
      )}

      <CreateNotamDialog open={showCreate} onOpenChange={setShowCreate} onAdded={onUpdated} findingId={createFromFinding} findings={findings} />
    </div>
  )
}

function NotamCard({ notam: n, onUpdated }: { notam: Notam; onUpdated: () => void }) {
  const [isPending, startTransition] = useTransition()

  const handleCancel = () => {
    if (!confirm('Otkazati ovaj NOTAM?')) return
    startTransition(async () => {
      const res = await cancelNotam(n.id)
      if (res.ok) { toast.success('NOTAM otkazan'); onUpdated() }
      else toast.error(res.error ?? 'Greška')
    })
  }

  const handleDelete = () => {
    if (!confirm('Trajno obrisati NOTAM?')) return
    startTransition(async () => {
      const res = await deleteNotam(n.id)
      if (res.ok) { toast.success('Obrisano'); onUpdated() }
      else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Card className={`p-4 border-l-4 ${n.status === 'ACTIVE' ? 'border-l-purple-500' : 'border-l-gray-400'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">{n.notamNumber}</Badge>
            <Badge className="text-xs">{n.qualifier}</Badge>
            <Badge variant="secondary" className="text-xs">{n.aerodrome}</Badge>
            <Badge variant="outline" className="text-xs">{n.scope}/{n.traffic}</Badge>
            <Badge className={`text-xs ${n.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}>{n.status}</Badge>
          </div>
          <div className="text-sm font-medium">{n.subject}: {n.condition}</div>
          <div className="text-xs text-muted-foreground mt-1 p-2 bg-muted/30 rounded font-mono">{n.text}</div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Kreiran: {new Date(n.createdAt).toLocaleString('hr-HR').slice(0, 16)}</span>
            <span>Važi do: <strong>{new Date(n.validTo).toLocaleString('hr-HR').slice(0, 16)}</strong></span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {n.status === 'ACTIVE' && <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isPending}>Otkaži</Button>}
          <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function CreateNotamDialog({ open, onOpenChange, onAdded, findingId, findings }: any) {
  const [series, setSeries] = useState('A')
  const [aerodrome, setAerodrome] = useState('LYTV')
  const [subject, setSubject] = useState('RWY')
  const [condition, setCondition] = useState('CLOSED')
  const [text, setText] = useState('')
  const [validTo, setValidTo] = useState('')
  const [isPending, startTransition] = useTransition()

  // Auto-fill from finding
  useEffect(() => {
    if (findingId) {
      const f = findings.find((x: any) => x.id === findingId)
      if (f) {
        const text = `RWY 14/32 ${f.location ? `AT ${f.location} ` : ''}${f.description.toUpperCase()}`
        setText(text)
        setCondition(f.category === 'FOD' ? 'FOD' : f.category === 'PAVEMENT_DAMAGE' ? 'POOR SURFACE' : 'CLOSED')
      }
    }
  }, [findingId, findings])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await createNotam({
        series, aerodrome, subject, condition, text,
        validTo: validTo ? new Date(validTo).toISOString() : new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        findingId: findingId || undefined,
        createdBy: 'Admin',
      })
      if (res.ok) {
        toast.success(`NOTAM kreiran: ${res.notamNumber}`)
        onOpenChange(false); onAdded()
        setText(''); setValidTo('')
      } else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Kreiraj NOTAM</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>Series</Label>
              <Select value={series} onValueChange={setSeries}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'S', 'T'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Aerodrom</Label><Input value={aerodrome} onChange={(e) => setAerodrome(e.target.value.toUpperCase())} className="font-mono" /></div>
            <div className="space-y-1.5"><Label>Važi do</Label><Input type="datetime-local" value={validTo} onChange={(e) => setValidTo(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Subjekt</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['RWY', 'TWY', 'APRON', 'AD', 'NAV', 'OBST', 'COM', 'RVR', 'PAPI', 'LIGHTS'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Condition</Label><Input value={condition} onChange={(e) => setCondition(e.target.value.toUpperCase())} /></div>
          </div>
          <div className="space-y-1.5"><Label>Tekst NOTAM-a (Item E) *</Label><Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} required className="font-mono text-sm" placeholder="RWY 14/32 CLOSED DUE TO FOD..." /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Kreiraj NOTAM</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// STATS VIEW
// ============================================================================

function StatsView({ stats }: { stats: Stats | null }) {
  if (!stats) return null
  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Ukupno inspekcija" value={stats.totalInspections} icon={ClipboardCheck} tone="blue" />
        <StatCard label="Ukupno nalaza" value={stats.totalFindings} icon={AlertTriangle} tone="amber" />
        <StatCard label="Otvoreni" value={stats.openFindings} icon={Clock} tone="orange" />
        <StatCard label="Kritični" value={stats.criticalFindings} icon={ShieldAlert} tone="red" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By type */}
        <Card>
          <CardHeader><CardTitle className="text-base">Inspekcije po tipu</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(stats.byType).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nema podataka</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(stats.byType).map(([type, count]) => {
                  const max = Math.max(...Object.values(stats.byType) as number[])
                  const pct = (count as number / max) * 100
                  return (
                    <div key={type} className="flex items-center gap-2">
                      <div className="w-40 text-xs">{INSPECTION_TYPE_LABELS[type] ?? type}</div>
                      <div className="flex-1 h-6 bg-muted/30 rounded relative overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-blue-500" style={{ width: `${pct}%` }} />
                        <div className="absolute inset-0 flex items-center px-2 text-xs font-medium">{count as number}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By status */}
        <Card>
          <CardHeader><CardTitle className="text-base">Status inspekcija</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(stats.byStatus).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nema podataka</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(stats.byStatus).map(([status, count]) => {
                  const max = Math.max(...Object.values(stats.byStatus) as number[])
                  const pct = (count as number / max) * 100
                  const color = status === 'CRITICAL' ? 'bg-red-500' : status === 'WITH_FINDINGS' ? 'bg-amber-500' : 'bg-emerald-500'
                  return (
                    <div key={status} className="flex items-center gap-2">
                      <div className="w-40 text-xs">{STATUS_LABELS[status] ?? status}</div>
                      <div className="flex-1 h-6 bg-muted/30 rounded relative overflow-hidden">
                        <div className={`absolute inset-y-0 left-0 ${color}`} style={{ width: `${pct}%` }} />
                        <div className="absolute inset-0 flex items-center px-2 text-xs font-medium">{count as number}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Findings by category */}
        <Card>
          <CardHeader><CardTitle className="text-base">Nalazi po kategoriji</CardTitle></CardHeader>
          <CardContent>
            {stats.topProblemCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nema nalaza</p>
            ) : (
              <div className="space-y-2">
                {stats.topProblemCategories.map(({ category, count }) => {
                  const max = stats.topProblemCategories[0].count
                  const pct = (count / max) * 100
                  return (
                    <div key={category} className="flex items-center gap-2">
                      <div className="w-40 text-xs">{CATEGORY_LABELS[category] ?? category}</div>
                      <div className="flex-1 h-6 bg-muted/30 rounded relative overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-purple-500" style={{ width: `${pct}%` }} />
                        <div className="absolute inset-0 flex items-center px-2 text-xs font-medium">{count}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Findings by severity */}
        <Card>
          <CardHeader><CardTitle className="text-base">Nalazi po težini</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.findingsBySeverity).map(([sev, count]) => {
                const max = Math.max(...Object.values(stats.findingsBySeverity) as number[], 1)
                const pct = (count as number / max) * 100
                const color = sev === 'CRITICAL' ? 'bg-red-500' : sev === 'HIGH' ? 'bg-orange-500' : sev === 'MEDIUM' ? 'bg-amber-500' : 'bg-blue-500'
                return (
                  <div key={sev} className="flex items-center gap-2">
                    <div className="w-40 text-xs">{SEVERITY_LABELS[sev] ?? sev}</div>
                    <div className="flex-1 h-6 bg-muted/30 rounded relative overflow-hidden">
                      <div className={`absolute inset-y-0 left-0 ${color}`} style={{ width: `${pct}%` }} />
                      <div className="absolute inset-0 flex items-center px-2 text-xs font-medium">{count as number}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top problem locations */}
      {stats.topProblemLocations.length > 0 && (
        <Card className="border-red-300">
          <CardHeader><CardTitle className="text-base flex items-center gap-2 text-red-800"><MapPinned className="h-4 w-4" />Top 10 problematičnih lokacija</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {stats.topProblemLocations.map((loc, i) => (
                <div key={loc.location} className="flex items-center justify-between text-sm p-2 bg-red-50 rounded">
                  <span><strong>#{i + 1}</strong> · {loc.location}</span>
                  <Badge className="bg-red-100 text-red-800">{loc.count} nalaza</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================================================
// TRENDS VIEW
// ============================================================================

function TrendsView({ stats }: { stats: Stats | null }) {
  if (!stats) return null

  const months = Object.keys(stats.byMonth)
  const maxInspections = Math.max(...Object.values(stats.byMonth) as number[], 1)
  const maxCritical = Math.max(...Object.values(stats.criticalByMonth) as number[], 1)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />Trend inspekcija po mjesecu</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-48">
            {months.map((m) => {
              const count = stats.byMonth[m] as number
              const height = (count / maxInspections) * 100
              return (
                <div key={m} className="flex-1 flex flex-col items-center justify-end">
                  <div className="text-xs font-medium mb-1">{count}</div>
                  <div className="w-full bg-blue-500 rounded-t" style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }} />
                  <div className="text-xs text-muted-foreground mt-1">{m}</div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="h-4 w-4" />Trend kritičnih inspekcija po mjesecu</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-48">
            {months.map((m) => {
              const count = stats.criticalByMonth[m] as number
              const height = (count / maxCritical) * 100
              return (
                <div key={m} className="flex-1 flex flex-col items-center justify-end">
                  <div className="text-xs font-medium mb-1">{count}</div>
                  <div className="w-full bg-red-500 rounded-t" style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }} />
                  <div className="text-xs text-muted-foreground mt-1">{m}</div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Inspector performance */}
      <Card>
        <CardHeader><CardTitle className="text-base">Performanse inspektora</CardTitle></CardHeader>
        <CardContent>
          {Object.keys(stats.byInspector).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nema podataka</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.byInspector)
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <span className="font-medium text-sm">{name}</span>
                    <Badge variant="secondary">{count as number} inspekcija</Badge>
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
// Shared components
// ============================================================================

function AlertCard({ icon: Icon, label, value, tone, onClick }: any) {
  const colors: any = {
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
  }
  const iconColors: any = { amber: 'text-amber-600', red: 'text-red-600', blue: 'text-blue-600', purple: 'text-purple-600' }
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
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
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
