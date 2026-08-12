'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  Snowflake, Plus, Loader2, Calendar, Trash2, Search, Download, AlertTriangle,
  Droplet, FlaskConical, Trash, BarChart3, Calculator, Clock, Thermometer,
  Wind, Eye, Plane, Truck,
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
  getDeicingFluids, addDeicingFluid, deleteDeicingFluid, updateDeicingFluidQuantity,
  getDeicingRecords, createDeicingRecord, deleteDeicingRecord,
  getDeicingDisposals, createDeicingDisposal, deleteDeicingDisposal,
  getDeicingStats,
} from '@/lib/actions-deicing'
import {
  calculateHOT,
  FLUID_TYPE_LABELS, CONCENTRATION_LABELS, PRECIPITATION_LABELS, INTENSITY_LABELS,
  OPERATION_TYPE_LABELS, DISPOSAL_METHOD_LABELS,
  type FluidType, type Concentration, type PrecipitationType, type Intensity,
} from '@/lib/hot-tables'

type Fluid = Awaited<ReturnType<typeof getDeicingFluids>>[number]
type Record_ = Awaited<ReturnType<typeof getDeicingRecords>>[number]
type Disposal = Awaited<ReturnType<typeof getDeicingDisposals>>[number]
type Stats = Awaited<ReturnType<typeof getDeicingStats>>

export function DeicingView() {
  const [tab, setTab] = useState<'records' | 'fluids' | 'disposal' | 'hot' | 'stats'>('records')
  const [records, setRecords] = useState<Record_[]>([])
  const [fluids, setFluids] = useState<Fluid[]>([])
  const [disposals, setDisposals] = useState<Disposal[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const load = async () => {
    setLoading(true)
    try {
      const [r, f, d, s] = await Promise.all([
        getDeicingRecords(), getDeicingFluids(), getDeicingDisposals(), getDeicingStats(),
      ])
      setRecords(r); setFluids(f); setDisposals(d); setStats(s)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const expiredCount = fluids.filter((f) => f.expiryDate && new Date(f.expiryDate) < new Date()).length
  const lowStockCount = fluids.filter((f) => f.quantityLiters <= 100).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Snowflake className="h-5 w-5" />De-icing / Anti-icing</h2>
          <p className="text-sm text-muted-foreground">ICAO Annex 3 · AEA Recommendations · ISO 11076 HOT Tables</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/deicing-records', '_blank')}><Download className="h-4 w-4 mr-1.5" />Operacije PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/deicing-fluids', '_blank')}><Download className="h-4 w-4 mr-1.5" />Tečnosti PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/deicing-disposal', '_blank')}><Download className="h-4 w-4 mr-1.5" />Disposal PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/deicing-stats', '_blank')}><Download className="h-4 w-4 mr-1.5" />Statistika PDF</Button>
        </div>
      </div>

      {/* Alert cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AlertCard icon={Snowflake} label="Operacije" value={records.length} tone="blue" onClick={() => setTab('records')} />
        <AlertCard icon={FlaskConical} label="Tečnosti u stock" value={fluids.length} tone="purple" onClick={() => setTab('fluids')} />
        <AlertCard icon={AlertTriangle} label="Isteklo/Uskoro" value={expiredCount} tone="red" onClick={() => setTab('fluids')} />
        <AlertCard icon={Trash} label="Disposal records" value={disposals.length} tone="amber" onClick={() => setTab('disposal')} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto">
        <TabBtn active={tab === 'records'} onClick={() => setTab('records')} icon={Snowflake} label="Operacije" />
        <TabBtn active={tab === 'fluids'} onClick={() => setTab('fluids')} icon={FlaskConical} label="Tečnosti" />
        <TabBtn active={tab === 'disposal'} onClick={() => setTab('disposal')} icon={Trash} label="Disposal" />
        <TabBtn active={tab === 'hot'} onClick={() => setTab('hot')} icon={Calculator} label="HOT Kalkulator" />
        <TabBtn active={tab === 'stats'} onClick={() => setTab('stats')} icon={BarChart3} label="Statistika" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : tab === 'records' ? (
        <RecordsList records={records} onUpdated={load} />
      ) : tab === 'fluids' ? (
        <FluidsList fluids={fluids} onUpdated={load} />
      ) : tab === 'disposal' ? (
        <DisposalList disposals={disposals} onUpdated={load} />
      ) : tab === 'hot' ? (
        <HotCalculator />
      ) : (
        <StatsView stats={stats} />
      )}
    </div>
  )
}

// ============================================================================
// RECORDS LIST
// ============================================================================

function RecordsList({ records, onUpdated }: { records: Record_[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')
  const [fluidFilter, setFluidFilter] = useState('ALL')
  const [opFilter, setOpFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)

  const filtered = records.filter((r) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [
        r.flightNumber, r.aircraftReg, r.aircraftType, r.standPosition,
        r.equipmentCode, r.operatorName, r.operatorCardId, r.fluidBatchNumber,
        r.notes,
      ].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (fluidFilter !== 'ALL' && r.fluidType !== fluidFilter) return false
    if (opFilter !== 'ALL' && r.operationType !== opFilter) return false
    return true
  })

  return (
    <div className="space-y-3">
      {/* Search — ALWAYS visible */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po letu, avionu, vozilu, operatoru..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={fluidFilter} onValueChange={setFluidFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tip tečnosti" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Sve tečnosti</SelectItem>
            {Object.entries(FLUID_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={opFilter} onValueChange={setOpFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Tip operacije" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Sve operacije</SelectItem>
            {Object.entries(OPERATION_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.slice(0, 30)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Nova operacija</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {records.length}</div>
      </div>

      {records.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Snowflake className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nema zabilježenih de-icing operacija.</p>
            <p className="text-xs mt-1">Kliknite "Nova operacija" da zabilježite prvu de-icing operaciju.</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Snowflake className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nema rezultata pretrage.</p>
            <p className="text-xs mt-1">Pokušajte sa drugim kriterijumima.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => <RecordCard key={r.id} record={r} onDeleted={onUpdated} />)}
        </div>
      )}

      <AddRecordDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} />
    </div>
  )
}

function RecordCard({ record: r, onDeleted }: { record: Record_; onDeleted: () => void }) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (!confirm('Obrisati ovu de-icing operaciju?')) return
    startTransition(async () => {
      const res = await deleteDeicingRecord(r.id)
      if (res.ok) { toast.success('Obrisano'); onDeleted() }
      else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Card className="p-4 border-l-4 border-l-blue-500">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {r.flightNumber && <Badge variant="outline" className="font-mono text-xs">{r.flightNumber}</Badge>}
            {r.aircraftReg && <Badge className="text-xs bg-blue-100 text-blue-800 font-mono">{r.aircraftReg}</Badge>}
            <Badge variant="secondary" className="text-xs">{FLUID_TYPE_LABELS[r.fluidType as FluidType] ?? r.fluidType}</Badge>
            {r.concentration && <Badge variant="outline" className="text-xs">{r.concentration}</Badge>}
            <Badge className="text-xs bg-purple-100 text-purple-800">{OPERATION_TYPE_LABELS[r.operationType]?.split(' ')[0] ?? r.operationType}</Badge>
          </div>
          {r.aircraftType && <div className="text-sm font-medium">{r.aircraftType}{r.standPosition && ` · Stand ${r.standPosition}`}</div>}
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1"><Thermometer className="h-3 w-3" />OAT: {r.oat}°C</span>
            {r.precipitation && r.precipitation !== 'NONE' && (
              <span className="flex items-center gap-1">
                <Snowflake className="h-3 w-3" />
                {PRECIPITATION_LABELS[r.precipitation as PrecipitationType] ?? r.precipitation}
                {r.precipitationIntensity && ` (${INTENSITY_LABELS[r.precipitationIntensity as Intensity] ?? r.precipitationIntensity})`}
              </span>
            )}
            <span className="flex items-center gap-1"><Droplet className="h-3 w-3" />{r.fluidUsedLiters} L</span>
            {r.durationMinutes != null && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{r.durationMinutes} min</span>}
          </div>

          {r.holdoverTimeMinutes != null && (
            <div className="text-xs mt-1 p-1.5 bg-amber-50 rounded border border-amber-200 text-amber-900">
              <strong>HOT: {r.holdoverTimeMinutes} min</strong> <span className="text-amber-700">({r.hotTableRef})</span>
            </div>
          )}

          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            {r.equipmentCode && <span className="flex items-center gap-1"><Truck className="h-3 w-3" />{r.equipmentCode}</span>}
            {r.operatorName && <span>Operater: {r.operatorName}</span>}
            {r.shift && <span>Smjena: {r.shift}</span>}
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(r.applicationStart).toLocaleString('hr-HR').slice(0, 16)}</span>
          </div>

          {r.fluidBatchNumber && <div className="text-xs text-muted-foreground mt-0.5">Batch: {r.fluidBatchNumber}</div>}
          {r.inspectionResult && (
            <div className="text-xs mt-1">
              <Badge className={r.inspectionResult === 'CLEAN' ? 'bg-emerald-100 text-emerald-800 text-xs' : 'bg-red-100 text-red-800 text-xs'}>
                Post-check: {r.inspectionResult === 'CLEAN' ? 'Čisto' : r.inspectionResult === 'CONTAMINATED' ? 'Kontaminirano' : 'Djelimično'}
              </Badge>
            </div>
          )}
          {r.notes && <div className="text-xs mt-1 text-muted-foreground italic">{r.notes}</div>}
        </div>
        <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
        </Button>
      </div>
    </Card>
  )
}

function AddRecordDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const [flightNumber, setFlightNumber] = useState('')
  const [aircraftReg, setAircraftReg] = useState('')
  const [aircraftType, setAircraftType] = useState('')
  const [standPosition, setStandPosition] = useState('')
  const [operationType, setOperationType] = useState('DEICING')
  const [fluidType, setFluidType] = useState('TYPE_I')
  const [concentration, setConcentration] = useState('100/0')
  const [fluidBatchNumber, setFluidBatchNumber] = useState('')
  const [fluidUsedLiters, setFluidUsedLiters] = useState('0')
  const [applicationStart, setApplicationStart] = useState('')
  const [applicationEnd, setApplicationEnd] = useState('')
  const [oat, setOat] = useState('0')
  const [precipitation, setPrecipitation] = useState('SNOW')
  const [precipitationIntensity, setPrecipitationIntensity] = useState('LIGHT')
  const [windSpeed, setWindSpeed] = useState('')
  const [windDirection, setWindDirection] = useState('')
  const [equipmentCode, setEquipmentCode] = useState('GSE-DEI-001')
  const [operatorName, setOperatorName] = useState('')
  const [operatorCardId, setOperatorCardId] = useState('')
  const [shift, setShift] = useState('Morning')
  const [inspectionResult, setInspectionResult] = useState('CLEAN')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  // Live HOT preview
  const hotPreview = (() => {
    if (!precipitation || precipitation === 'NONE') return null
    return calculateHOT(
      fluidType as FluidType,
      concentration as Concentration,
      precipitation as PrecipitationType,
      precipitationIntensity as Intensity,
      parseFloat(oat) || 0
    )
  })()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await createDeicingRecord({
        flightNumber: flightNumber || undefined,
        aircraftReg: aircraftReg || undefined,
        aircraftType: aircraftType || undefined,
        standPosition: standPosition || undefined,
        operationType,
        fluidType,
        concentration: fluidType === 'TYPE_I' || fluidType === 'TYPE_III' ? undefined : concentration,
        fluidBatchNumber: fluidBatchNumber || undefined,
        fluidUsedLiters: parseFloat(fluidUsedLiters) || 0,
        applicationStart: applicationStart ? new Date(applicationStart).toISOString() : new Date().toISOString(),
        applicationEnd: applicationEnd ? new Date(applicationEnd).toISOString() : undefined,
        oat: parseFloat(oat) || 0,
        precipitation,
        precipitationIntensity: precipitation !== 'NONE' ? precipitationIntensity : undefined,
        windSpeed: windSpeed ? parseFloat(windSpeed) : undefined,
        windDirection: windDirection ? parseInt(windDirection) : undefined,
        equipmentCode: equipmentCode || undefined,
        operatorName: operatorName || undefined,
        operatorCardId: operatorCardId || undefined,
        shift,
        inspectionResult,
        notes: notes || undefined,
      })
      if (res.ok) {
        toast.success('Operacija zabilježena' + (res.holdoverTimeMinutes ? ` · HOT: ${res.holdoverTimeMinutes} min` : ''))
        onOpenChange(false); onAdded()
        setFlightNumber(''); setAircraftReg(''); setAircraftType(''); setStandPosition('')
        setFluidBatchNumber(''); setFluidUsedLiters('0'); setApplicationStart(''); setApplicationEnd('')
        setWindSpeed(''); setWindDirection(''); setOperatorName(''); setOperatorCardId(''); setNotes('')
      } else {
        toast.error(res.error ?? 'Greška')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novi de-icing / anti-icing zapis</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Let info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="space-y-1.5"><Label>Let</Label><Input value={flightNumber} onChange={(e) => setFlightNumber(e.target.value.toUpperCase())} placeholder="AY1234" /></div>
            <div className="space-y-1.5"><Label>Reg. aviona</Label><Input value={aircraftReg} onChange={(e) => setAircraftReg(e.target.value.toUpperCase())} placeholder="OH-LXA" className="font-mono" /></div>
            <div className="space-y-1.5"><Label>Tip aviona</Label><Input value={aircraftType} onChange={(e) => setAircraftType(e.target.value.toUpperCase())} placeholder="A320" /></div>
            <div className="space-y-1.5"><Label>Stand</Label><Input value={standPosition} onChange={(e) => setStandPosition(e.target.value)} placeholder="5" /></div>
          </div>

          {/* Operacija */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="space-y-1.5">
              <Label>Operacija</Label>
              <Select value={operationType} onValueChange={setOperationType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(OPERATION_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tip tečnosti</Label>
              <Select value={fluidType} onValueChange={setFluidType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(FLUID_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {(fluidType === 'TYPE_II' || fluidType === 'TYPE_IV') && (
              <div className="space-y-1.5">
                <Label>Koncentracija</Label>
                <Select value={concentration} onValueChange={setConcentration}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CONCENTRATION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5"><Label>Potrošeno (L)</Label><Input type="number" step="0.1" value={fluidUsedLiters} onChange={(e) => setFluidUsedLiters(e.target.value)} required /></div>
          </div>

          {/* Vrijeme */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Početak aplikacije</Label><Input type="datetime-local" value={applicationStart} onChange={(e) => setApplicationStart(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Kraj aplikacije</Label><Input type="datetime-local" value={applicationEnd} onChange={(e) => setApplicationEnd(e.target.value)} /></div>
          </div>

          <div className="space-y-1.5"><Label>Batch tečnosti</Label><Input value={fluidBatchNumber} onChange={(e) => setFluidBatchNumber(e.target.value.toUpperCase())} placeholder="KIL-2025-A001" className="font-mono" /></div>

          {/* Vremenski uslovi */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
            <div className="text-sm font-medium text-blue-900 flex items-center gap-2"><Thermometer className="h-4 w-4" />Vremenski uslovi (ICAO Annex 3)</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="space-y-1.5"><Label>OAT (°C)</Label><Input type="number" step="0.1" value={oat} onChange={(e) => setOat(e.target.value)} required /></div>
              <div className="space-y-1.5">
                <Label>Padavine</Label>
                <Select value={precipitation} onValueChange={setPrecipitation}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRECIPITATION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {precipitation !== 'NONE' && (
                <div className="space-y-1.5">
                  <Label>Intenzitet</Label>
                  <Select value={precipitationIntensity} onValueChange={setPrecipitationIntensity}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(INTENSITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5"><Label>Brzina vjetra (m/s)</Label><Input type="number" step="0.1" value={windSpeed} onChange={(e) => setWindSpeed(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Smjer vjetra (°)</Label><Input type="number" value={windDirection} onChange={(e) => setWindDirection(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Vidljivost (m)</Label><Input type="number" value={windDirection} onChange={(e) => setWindDirection(e.target.value)} placeholder="5000" /></div>
            </div>
          </div>

          {/* HOT Preview */}
          {hotPreview && hotPreview.hotMinutes != null && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg">
              <div className="text-sm font-medium text-amber-900 flex items-center gap-2"><Clock className="h-4 w-4" />Holdover Time (auto-izračunato)</div>
              <div className="text-2xl font-bold text-amber-700 mt-1">{hotPreview.hotMinutes} minuta</div>
              <div className="text-xs text-amber-700 mt-0.5">{hotPreview.tableRef}</div>
              {hotPreview.note && <div className="text-xs text-amber-600 mt-0.5">{hotPreview.note}</div>}
            </div>
          )}

          {/* Vozilo i osoblje */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="space-y-1.5"><Label>Vozilo</Label><Input value={equipmentCode} onChange={(e) => setEquipmentCode(e.target.value.toUpperCase())} placeholder="GSE-DEI-001" className="font-mono" /></div>
            <div className="space-y-1.5"><Label>Operater</Label><Input value={operatorName} onChange={(e) => setOperatorName(e.target.value)} placeholder="Ime" /></div>
            <div className="space-y-1.5"><Label>Kartica</Label><Input value={operatorCardId} onChange={(e) => setOperatorCardId(e.target.value.toUpperCase())} placeholder="EMP-1001" className="font-mono" /></div>
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

          <div className="space-y-1.5">
            <Label>Rezultat inspekcije</Label>
            <Select value={inspectionResult} onValueChange={setInspectionResult}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CLEAN">Čisto</SelectItem>
                <SelectItem value="CONTAMINATED">Kontaminirano</SelectItem>
                <SelectItem value="PARTIAL">Djelimično</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5"><Label>Napomene</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Dodatne napomene..." /></div>

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
// FLUIDS LIST
// ============================================================================

function FluidsList({ fluids, onUpdated }: { fluids: Fluid[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)
  const [editFluid, setEditFluid] = useState<Fluid | null>(null)
  const [newQty, setNewQty] = useState(0)
  const [isPending, startTransition] = useTransition()

  const today = new Date()
  const getFluidStatus = (f: Fluid): 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'NO_EXPIRY' => {
    if (!f.expiryDate) return 'NO_EXPIRY'
    const d = new Date(f.expiryDate)
    if (d < today) return 'EXPIRED'
    const days = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (days <= 30) return 'EXPIRING_SOON'
    return 'VALID'
  }

  const filtered = fluids.filter((f) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [f.brandName, f.manufacturer, f.batchNumber, f.storageLocation, f.notes].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (typeFilter !== 'ALL' && f.fluidType !== typeFilter) return false
    if (statusFilter !== 'ALL') {
      const st = getFluidStatus(f)
      if (st !== statusFilter) return false
    }
    return true
  })

  const handleSaveQty = () => {
    if (!editFluid) return
    startTransition(async () => {
      await updateDeicingFluidQuantity(editFluid.id, newQty)
      toast.success('Stanje ažurirano')
      setEditFluid(null); onUpdated()
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm('Obrisati "' + name + '"?')) return
    startTransition(async () => {
      await deleteDeicingFluid(id); toast.success('Obrisano'); onUpdated()
    })
  }

  return (
    <div className="space-y-3">
      {/* Search — ALWAYS visible */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po nazivu, batch-u, proizvođaču..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Tip" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi tipovi</SelectItem>
            {Object.entries(FLUID_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            <SelectItem value="VALID">Važeće</SelectItem>
            <SelectItem value="EXPIRING_SOON">Ističe u 30 dana</SelectItem>
            <SelectItem value="EXPIRED">Isteklo</SelectItem>
            <SelectItem value="NO_EXPIRY">Bez roka</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Dodaj tečnost</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {fluids.length}</div>
      </div>

      {fluids.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FlaskConical className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nema tečnosti u inventaru.</p>
            <p className="text-xs mt-1">Kliknite "Dodaj tečnost" da unesete prvi fluid.</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FlaskConical className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nema rezultata pretrage.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((f) => {
            const st = getFluidStatus(f)
            return (
              <Card key={f.id} className={`p-4 ${st === 'EXPIRED' ? 'border-red-300 bg-red-50' : st === 'EXPIRING_SOON' ? 'border-amber-300 bg-amber-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className="font-mono text-xs">{f.batchNumber}</Badge>
                      <Badge variant="secondary" className="text-xs">{FLUID_TYPE_LABELS[f.fluidType as FluidType] ?? f.fluidType}</Badge>
                      {f.concentration && <Badge variant="outline" className="text-xs">{f.concentration}</Badge>}
                    </div>
                    <div className="text-sm font-medium">{f.brandName}</div>
                    {f.manufacturer && <div className="text-xs text-muted-foreground">{f.manufacturer}</div>}
                    <div className="text-sm mt-2 flex items-center gap-3">
                      <span className={`font-bold ${f.quantityLiters <= 100 ? 'text-red-600' : 'text-emerald-600'}`}>{f.quantityLiters} L</span>
                      {f.unitPrice != null && <span className="text-xs text-muted-foreground">{f.unitPrice.toFixed(2)}€/L</span>}
                    </div>
                    {f.expiryDate && (
                      <div className={`text-xs mt-1 ${st === 'EXPIRED' ? 'text-red-700 font-medium' : st === 'EXPIRING_SOON' ? 'text-amber-700 font-medium' : 'text-muted-foreground'}`}>
                        Rok: {new Date(f.expiryDate).toLocaleDateString('hr-HR')}
                        {st === 'EXPIRED' && ' (ISTEKLO)'}
                        {st === 'EXPIRING_SOON' && ' (USKORO)'}
                      </div>
                    )}
                    {f.storageLocation && <div className="text-xs text-muted-foreground mt-1">📍 {f.storageLocation}</div>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditFluid(f); setNewQty(f.quantityLiters) }}>Izmjeni</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(f.id, f.brandName)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Edit qty dialog */}
      <Dialog open={!!editFluid} onOpenChange={(v) => !v && setEditFluid(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ažuriraj stanje: {editFluid?.brandName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Trenutno: {editFluid?.quantityLiters} L</Label>
              <Input type="number" step="0.1" value={newQty} onChange={(e) => setNewQty(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFluid(null)}>Odustani</Button>
            <Button onClick={handleSaveQty} disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Spremi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddFluidDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} />
    </div>
  )
}

function AddFluidDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const [fluidType, setFluidType] = useState('TYPE_I')
  const [brandName, setBrandName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [quantityLiters, setQuantityLiters] = useState(0)
  const [unitPrice, setUnitPrice] = useState(0)
  const [concentration, setConcentration] = useState('100/0')
  const [expiryDate, setExpiryDate] = useState('')
  const [storageLocation, setStorageLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await addDeicingFluid({
        fluidType, brandName, manufacturer: manufacturer || undefined, batchNumber,
        quantityLiters, unitPrice: unitPrice || undefined,
        concentration: (fluidType === 'TYPE_II' || fluidType === 'TYPE_IV') ? concentration : undefined,
        expiryDate: expiryDate || undefined, storageLocation: storageLocation || undefined,
        notes: notes || undefined,
      })
      if (res.ok) {
        toast.success('Tečnost dodana u inventar')
        onOpenChange(false); onAdded()
        setBrandName(''); setManufacturer(''); setBatchNumber(''); setQuantityLiters(0)
        setUnitPrice(0); setExpiryDate(''); setStorageLocation(''); setNotes('')
      } else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Dodaj tečnost za zaleđivanje</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Tip tečnosti *</Label>
              <Select value={fluidType} onValueChange={setFluidType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(FLUID_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Batch broj *</Label><Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value.toUpperCase())} placeholder="KIL-2025-A001" className="font-mono" required /></div>
          </div>
          <div className="space-y-1.5"><Label>Naziv (brand) *</Label><Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Kilfrost ABC-I" required /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Proizvođač</Label><Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="Kilfrost" /></div>
            <div className="space-y-1.5"><Label>Lokacija</Label><Input value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} placeholder="Skladište B-1" /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5"><Label>Količina (L)</Label><Input type="number" step="0.1" value={quantityLiters} onChange={(e) => setQuantityLiters(parseFloat(e.target.value) || 0)} required /></div>
            <div className="space-y-1.5"><Label>Cijena (€/L)</Label><Input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)} /></div>
            <div className="space-y-1.5"><Label>Rok upotrebe</Label><Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></div>
          </div>
          {(fluidType === 'TYPE_II' || fluidType === 'TYPE_IV') && (
            <div className="space-y-1.5">
              <Label>Koncentracija</Label>
              <Select value={concentration} onValueChange={setConcentration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CONCENTRATION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5"><Label>Napomene</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Dodaj</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// DISPOSAL LIST
// ============================================================================

function DisposalList({ disposals, onUpdated }: { disposals: Disposal[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)

  const filtered = disposals.filter((d) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [d.batchNumber, d.vendorName, d.vendorLicense, d.manifestNumber, d.location, d.notes].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (methodFilter !== 'ALL' && d.disposalMethod !== methodFilter) return false
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po batch-u, vendoru, manifestu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Metoda" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Sve metode</SelectItem>
            {Object.entries(DISPOSAL_METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Novi disposal</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {disposals.length}</div>
      </div>

      {disposals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Trash className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nema zabilježenih disposal records.</p>
            <p className="text-xs mt-1">Kliknite "Novi disposal" da zabilježite odlaganje tečnosti.</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Trash className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nema rezultata pretrage.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => <DisposalCard key={d.id} disposal={d} onDeleted={onUpdated} />)}
        </div>
      )}

      <AddDisposalDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} />
    </div>
  )
}

function DisposalCard({ disposal: d, onDeleted }: { disposal: Disposal; onDeleted: () => void }) {
  const [isPending, startTransition] = useTransition()
  const handleDelete = () => {
    if (!confirm('Obrisati ovaj disposal record?')) return
    startTransition(async () => {
      const res = await deleteDeicingDisposal(d.id)
      if (res.ok) { toast.success('Obrisano'); onDeleted() }
      else toast.error(res.error ?? 'Greška')
    })
  }
  return (
    <Card className="p-4 border-l-4 border-l-amber-500">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="secondary" className="text-xs">{FLUID_TYPE_LABELS[d.fluidType as FluidType] ?? d.fluidType}</Badge>
            <Badge className="text-xs bg-amber-100 text-amber-800">{DISPOSAL_METHOD_LABELS[d.disposalMethod] ?? d.disposalMethod}</Badge>
            {d.batchNumber && <Badge variant="outline" className="font-mono text-xs">{d.batchNumber}</Badge>}
          </div>
          <div className="text-sm font-medium">{d.quantityLiters} L odbačeno</div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(d.disposalDate).toLocaleDateString('hr-HR')}</span>
            {d.vendorName && <span>Vendor: {d.vendorName}</span>}
            {d.manifestNumber && <span>Manifest: {d.manifestNumber}</span>}
            {d.disposalCost != null && <span>Trošak: {d.disposalCost.toFixed(2)}€</span>}
            {d.location && <span>📍 {d.location}</span>}
          </div>
          {d.vendorLicense && <div className="text-xs text-muted-foreground mt-0.5">Licenca vendora: {d.vendorLicense}</div>}
          {d.notes && <div className="text-xs mt-1 text-muted-foreground italic">{d.notes}</div>}
        </div>
        <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
        </Button>
      </div>
    </Card>
  )
}

function AddDisposalDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const [fluidType, setFluidType] = useState('TYPE_I')
  const [batchNumber, setBatchNumber] = useState('')
  const [quantityLiters, setQuantityLiters] = useState(0)
  const [disposalMethod, setDisposalMethod] = useState('COLLECTED_BY_VENDOR')
  const [vendorName, setVendorName] = useState('')
  const [vendorLicense, setVendorLicense] = useState('')
  const [manifestNumber, setManifestNumber] = useState('')
  const [disposalCost, setDisposalCost] = useState(0)
  const [disposalDate, setDisposalDate] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await createDeicingDisposal({
        fluidType, batchNumber: batchNumber || undefined, quantityLiters,
        disposalMethod, vendorName: vendorName || undefined, vendorLicense: vendorLicense || undefined,
        manifestNumber: manifestNumber || undefined, disposalCost: disposalCost || undefined,
        disposalDate: disposalDate || undefined, location: location || undefined, notes: notes || undefined,
      })
      if (res.ok) {
        toast.success('Disposal zabilježen')
        onOpenChange(false); onAdded()
        setBatchNumber(''); setQuantityLiters(0); setVendorName(''); setVendorLicense('')
        setManifestNumber(''); setDisposalCost(0); setDisposalDate(''); setLocation(''); setNotes('')
      } else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novi disposal record</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Tip tečnosti *</Label>
              <Select value={fluidType} onValueChange={setFluidType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(FLUID_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Batch broj</Label><Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value.toUpperCase())} placeholder="KIL-2025-A001" className="font-mono" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Količina (L) *</Label><Input type="number" step="0.1" value={quantityLiters} onChange={(e) => setQuantityLiters(parseFloat(e.target.value) || 0)} required /></div>
            <div className="space-y-1.5">
              <Label>Metoda *</Label>
              <Select value={disposalMethod} onValueChange={setDisposalMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DISPOSAL_METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Vendor</Label><Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="EcoDispose d.o.o." /></div>
            <div className="space-y-1.5"><Label>Licenca vendora</Label><Input value={vendorLicense} onChange={(e) => setVendorLicense(e.target.value)} placeholder="LP-2025-001" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Broj manifest-a</Label><Input value={manifestNumber} onChange={(e) => setManifestNumber(e.target.value)} placeholder="MAN-2025-001" /></div>
            <div className="space-y-1.5"><Label>Trošak (€)</Label><Input type="number" step="0.01" value={disposalCost} onChange={(e) => setDisposalCost(parseFloat(e.target.value) || 0)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Datum</Label><Input type="date" value={disposalDate} onChange={(e) => setDisposalDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Lokacija</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Skladište B" /></div>
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

// ============================================================================
// HOT CALCULATOR
// ============================================================================

function HotCalculator() {
  const [fluidType, setFluidType] = useState<FluidType>('TYPE_II')
  const [concentration, setConcentration] = useState<Concentration>('100/0')
  const [precipitation, setPrecipitation] = useState<PrecipitationType>('SNOW')
  const [intensity, setIntensity] = useState<Intensity>('MODERATE')
  const [oat, setOat] = useState('-3')

  const result = calculateHOT(
    fluidType,
    concentration,
    precipitation,
    precipitation !== 'NONE' ? intensity : undefined,
    parseFloat(oat) || 0
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Calculator className="h-5 w-5" />HOT Kalkulator (ISO 11076)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label>Tip tečnosti</Label>
              <Select value={fluidType} onValueChange={(v) => setFluidType(v as FluidType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(FLUID_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {(fluidType === 'TYPE_II' || fluidType === 'TYPE_IV') && (
              <div className="space-y-1.5">
                <Label>Koncentracija</Label>
                <Select value={concentration} onValueChange={(v) => setConcentration(v as Concentration)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CONCENTRATION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Padavine</Label>
              <Select value={precipitation} onValueChange={(v) => setPrecipitation(v as PrecipitationType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRECIPITATION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {precipitation !== 'NONE' && (
              <div className="space-y-1.5">
                <Label>Intenzitet</Label>
                <Select value={intensity} onValueChange={(v) => setIntensity(v as Intensity)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(INTENSITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>OAT (°C)</Label>
              <Input type="number" step="0.1" value={oat} onChange={(e) => setOat(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      <Card className={result.hotMinutes != null ? 'border-amber-300 bg-amber-50' : ''}>
        <CardContent className="py-6 text-center">
          {result.hotMinutes != null ? (
            <>
              <div className="text-sm text-amber-700 uppercase tracking-wide">Holdover Time</div>
              <div className="text-5xl font-bold text-amber-900 my-3">{result.hotMinutes}</div>
              <div className="text-lg text-amber-700">minuta</div>
              <div className="text-sm text-amber-600 mt-3">{result.tableRef}</div>
              {result.note && <div className="text-xs text-amber-500 mt-1">{result.note}</div>}
              <div className="mt-4 p-2 bg-white/60 rounded text-xs text-amber-800">
                ⚠️ HOT je indikativno. Stvarni HOT zavisi od specifičnih uslova. Konsultujte važeću Transport Canada / FAA / AEA tabelu.
              </div>
            </>
          ) : (
            <>
              <Snowflake className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-30" />
              <div className="text-sm text-muted-foreground">{result.note || 'Unesite uslove da izračunate HOT'}</div>
              {result.tableRef && <div className="text-xs text-muted-foreground mt-2">{result.tableRef}</div>}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// STATS VIEW
// ============================================================================

function StatsView({ stats }: { stats: Stats | null }) {
  if (!stats) return null
  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Ukupno tečnosti" value={`${stats.totalStockLiters.toFixed(0)} L`} sub={`${stats.fluidCount} stavki`} icon={FlaskConical} tone="blue" />
        <StatCard label="Vrijednost stock" value={`${stats.stockValue.toFixed(2)} €`} sub="tekuća vrijednost" icon={Droplet} tone="emerald" />
        <StatCard label="Potrošeno" value={`${stats.totalUsedLiters.toFixed(0)} L`} sub={`${stats.recordsCount} operacija`} icon={Snowflake} tone="purple" />
        <StatCard label="Odbačeno" value={`${stats.totalDisposedLiters.toFixed(0)} L`} sub={`${stats.totalDisposalCost.toFixed(2)}€ trošak`} icon={Trash} tone="amber" />
      </div>

      {/* By type */}
      <Card>
        <CardHeader><CardTitle className="text-base">Po tipu tečnosti</CardTitle></CardHeader>
        <CardContent>
          {Object.keys(stats.byType).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nema podataka</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.byType).map(([type, data]: [string, any]) => (
                <div key={type} className="flex items-center justify-between p-3 bg-muted/30 rounded">
                  <div className="font-medium text-sm">{FLUID_TYPE_LABELS[type as FluidType] ?? type}</div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-blue-600">Stock: <strong>{data.stock.toFixed(0)} L</strong></span>
                    <span className="text-purple-600">Potrošeno: <strong>{data.used.toFixed(0)} L</strong></span>
                    <span className="text-amber-600">Odbačeno: <strong>{data.disposed.toFixed(0)} L</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* By vehicle */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4" />Po vozilu (iskorištenost deicer-a)</CardTitle></CardHeader>
        <CardContent>
          {Object.keys(stats.byVehicle).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nema podataka</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.byVehicle).map(([code, data]: [string, any]) => (
                <div key={code} className="flex items-center justify-between p-3 bg-muted/30 rounded">
                  <div className="font-mono text-sm">{code}</div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-blue-600">Operacija: <strong>{data.operations}</strong></span>
                    <span className="text-purple-600">Potrošeno: <strong>{data.litersUsed.toFixed(0)} L</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* By month */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" />Operacije po mjesecu (posljednjih 12)</CardTitle></CardHeader>
        <CardContent>
          {Object.entries(stats.byMonth).every(([, v]: [string, any]) => v.operations === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nema zabilježenih operacija u posljednjih 12 mjeseci</p>
          ) : (
            <div className="space-y-1">
              {Object.entries(stats.byMonth).map(([month, data]: [string, any]) => {
                const maxOps = Math.max(...Object.values(stats.byMonth).map((d: any) => d.operations), 1)
                const pct = (data.operations / maxOps) * 100
                return (
                  <div key={month} className="flex items-center gap-2">
                    <div className="w-16 text-xs text-muted-foreground font-mono">{month}</div>
                    <div className="flex-1 h-6 bg-muted/30 rounded relative overflow-hidden">
                      <div className="absolute inset-y-0 left-0 bg-blue-500" style={{ width: `${pct}%` }} />
                      <div className="absolute inset-0 flex items-center px-2 text-xs">
                        {data.operations > 0 && <span className="font-medium">{data.operations} ops · {data.litersUsed.toFixed(0)} L</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expired fluids alert */}
      {stats.expiredFluids.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardHeader><CardTitle className="text-base flex items-center gap-2 text-red-800"><AlertTriangle className="h-4 w-4" />Istekle tečnosti ({stats.expiredFluids.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {stats.expiredFluids.map((f) => (
                <div key={f.id} className="text-sm text-red-700">
                  <strong>{f.brandName}</strong> ({f.batchNumber}) — rok: {f.expiryDate ? new Date(f.expiryDate).toLocaleDateString('hr-HR') : 'N/A'}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expiring soon */}
      {stats.expiringSoon.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader><CardTitle className="text-base flex items-center gap-2 text-amber-800"><Clock className="h-4 w-4" />Ističe uskoro (30 dana) — {stats.expiringSoon.length}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {stats.expiringSoon.map((f) => (
                <div key={f.id} className="text-sm text-amber-700">
                  <strong>{f.brandName}</strong> ({f.batchNumber}) — rok: {f.expiryDate ? new Date(f.expiryDate).toLocaleDateString('hr-HR') : 'N/A'}
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

function StatCard({ label, value, sub, icon: Icon, tone }: any) {
  const colors: any = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
  }
  return (
    <div className={'p-4 rounded-lg border ' + colors[tone]}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs mt-0.5">{label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
        </div>
        <Icon className="h-6 w-6 opacity-60" />
      </div>
    </div>
  )
}
