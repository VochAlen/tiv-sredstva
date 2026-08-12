'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  AlertOctagon, Plus, Loader2, Search, Filter, AlertTriangle, CheckCircle2,
  Clock, MapPin, User, Cloud, Eye, FileText, ShieldAlert, Download,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  createIncident, getIncidents, getIncidentStats, updateIncident,
} from '@/lib/actions-incidents'

const TYPE_LABELS: Record<string, string> = {
  GSE_AIRCRAFT: 'GSE → Avion', GSE_PERSON: 'GSE → Osoba', GSE_INFRASTRUCTURE: 'GSE → Infrastruktura',
  GSE_GSE: 'GSE → GSE', FOD: 'Strano tijelo (FOD)', SPILL: 'Izlivanje', OTHER: 'Ostalo',
}
const SEVERITY_COLORS: Record<string, string> = {
  MINOR: 'bg-blue-100 text-blue-800', MAJOR: 'bg-amber-100 text-amber-800',
  SERIOUS: 'bg-orange-100 text-orange-800', ACCIDENT: 'bg-red-100 text-red-800',
}
const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-800', INVESTIGATING: 'bg-amber-100 text-amber-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800', CLOSED: 'bg-gray-100 text-gray-800',
}

export function IncidentsView() {
  const [tab, setTab] = useState<'list' | 'create'>('list')
  const [incidents, setIncidents] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [inc, st] = await Promise.all([
        getIncidents({ search, typeFilter, severityFilter, statusFilter }),
        getIncidentStats(),
      ])
      setIncidents(inc); setStats(st)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search, typeFilter, severityFilter, statusFilter])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><AlertOctagon className="h-5 w-5" />Incident/Accident Reporting</h2>
          <p className="text-sm text-muted-foreground">ADR.OPS.B.005 — Safety Management System (SMS)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/incidents-summary?year=' + new Date().getFullYear() + (new Date().getMonth() + 1 ? '&month=' + (new Date().getMonth() + 1) : ''), '_blank')}><Download className="h-4 w-4 mr-1.5" />Mjesečni PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/incidents-summary?year=' + new Date().getFullYear(), '_blank')}><Download className="h-4 w-4 mr-1.5" />Godišnji PDF</Button>
          <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1.5" />Prijavi incident</Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Ukupno" value={stats.total} tone="blue" />
          <StatCard label="Otvoreni" value={stats.open} tone="red" />
          <StatCard label="SMOR" value={stats.smorRequired} tone="orange" />
          <StatCard label="Sa ozljedama" value={stats.withInjuries} tone="red" />
          <StatCard label="Šteta (€)" value={stats.totalDamageEstimate?.toFixed(0) ?? 0} tone="purple" />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><Filter className="h-4 w-4 mr-1.5" /><SelectValue placeholder="Tip" /></SelectTrigger>
          <SelectContent><SelectItem value="ALL">Svi tipovi</SelectItem>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Težina" /></SelectTrigger>
          <SelectContent><SelectItem value="ALL">Sve težine</SelectItem><SelectItem value="MINOR">Manji</SelectItem><SelectItem value="MAJOR">Veći</SelectItem><SelectItem value="SERIOUS">Ozbiljan</SelectItem><SelectItem value="ACCIDENT">Nesreća</SelectItem></SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="ALL">Svi statusi</SelectItem><SelectItem value="OPEN">Otvoren</SelectItem><SelectItem value="INVESTIGATING">Istraga</SelectItem><SelectItem value="RESOLVED">Riješen</SelectItem><SelectItem value="CLOSED">Zatvoren</SelectItem></SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : incidents.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><AlertOctagon className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Nema prijavljenih incidenata.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {incidents.map((inc: any) => (
            <Card key={inc.id} className={'p-4 border-l-4 ' + (inc.severity === 'ACCIDENT' ? 'border-l-red-500' : inc.severity === 'SERIOUS' ? 'border-l-orange-500' : inc.severity === 'MAJOR' ? 'border-l-amber-500' : 'border-l-blue-500')}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className="font-mono text-xs font-bold">{inc.incidentNumber}</Badge>
                    <Badge className={'text-xs ' + (SEVERITY_COLORS[inc.severity] || '')}>{inc.severity}</Badge>
                    <Badge className={'text-xs ' + (STATUS_COLORS[inc.status] || '')}>{inc.status}</Badge>
                    <Badge variant="secondary" className="text-xs">{TYPE_LABELS[inc.incidentType] || inc.incidentType}</Badge>
                    {inc.smorRequired && <Badge className="bg-red-100 text-red-800 text-xs"><ShieldAlert className="h-3 w-3 mr-0.5" />SMOR</Badge>}
                    {inc.injuriesReported && <Badge className="bg-red-100 text-red-800 text-xs">⚠ Ozljede</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{inc.description}</div>
                  <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{inc.location}{inc.zone ? ` (${inc.zone})` : ''}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(inc.occurredAt).toLocaleString('hr-HR')}</span>
                    {inc.equipmentCode && <span className="font-mono">{inc.equipmentCode}</span>}
                    {inc.operatorName && <span className="flex items-center gap-1"><User className="h-3 w-3" />{inc.operatorName}</span>}
                    {inc.weather && <span className="flex items-center gap-1"><Cloud className="h-3 w-3" />{inc.weather}</span>}
                    {inc.damageEstimate && <span>Šteta: {inc.damageEstimate.toFixed(0)}€</span>}
                  </div>
                  {inc.rootCause && <div className="text-xs mt-1 p-1.5 bg-muted/30 rounded"><strong>Root cause:</strong> {inc.rootCause}</div>}
                  {inc.correctiveActions && <div className="text-xs text-emerald-700 mt-0.5"><strong>Korektivne akcije:</strong> {inc.correctiveActions}</div>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => window.open(`/api/reports/incident?id=${inc.id}`, '_blank')}><FileText className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setSelected(inc)}>Detalji</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateIncidentDialog open={showCreate} onOpenChange={setShowCreate} onCreated={load} />
      <IncidentDetailDialog incident={selected} onClose={() => setSelected(null)} onUpdated={load} />
    </div>
  )
}

function StatCard({ label, value, tone }: any) {
  const colors: any = { blue: 'bg-blue-50 border-blue-200 text-blue-900', red: 'bg-red-50 border-red-200 text-red-900', orange: 'bg-orange-50 border-orange-200 text-orange-900', purple: 'bg-purple-50 border-purple-200 text-purple-900' }
  return <div className={'p-4 rounded-lg border ' + colors[tone]}><div className="text-2xl font-bold">{value}</div><div className="text-xs mt-0.5">{label}</div></div>
}

function CreateIncidentDialog({ open, onOpenChange, onCreated }: any) {
  const [incidentType, setIncidentType] = useState('GSE_AIRCRAFT')
  const [severity, setSeverity] = useState('MINOR')
  const [smorRequired, setSmorRequired] = useState(false)
  const [location, setLocation] = useState('')
  const [zone, setZone] = useState('APRON')
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 16))
  const [weather, setWeather] = useState('SUNNY')
  const [visibility, setVisibility] = useState('GOOD')
  const [equipmentCode, setEquipmentCode] = useState('')
  const [operatorName, setOperatorName] = useState('')
  const [description, setDescription] = useState('')
  const [immediateAction, setImmediateAction] = useState('')
  const [injuriesReported, setInjuriesReported] = useState(false)
  const [damageEstimate, setDamageEstimate] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!location || !description) { toast.error('Popunite obavezna polja'); return }
    startTransition(async () => {
      try {
        const res = await createIncident({
          incidentType, severity, smorRequired, location, zone, occurredAt,
          weather, visibility, equipmentCode: equipmentCode || undefined,
          operatorName: operatorName || undefined, description, immediateAction: immediateAction || undefined,
          injuriesReported, damageEstimate: damageEstimate ? parseFloat(damageEstimate) : undefined,
          reportedBy: operatorName || 'Sistem',
        })
        if (res.ok) {
          toast.success(`Incident ${res.incidentNumber} prijavljen`)
          onOpenChange(false); onCreated()
          setLocation(''); setDescription(''); setImmediateAction(''); setEquipmentCode(''); setOperatorName(''); setDamageEstimate('')
        } else { toast.error('Greška') }
      } catch (e: any) { toast.error(e?.message ?? 'Greška') }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertOctagon className="h-5 w-5" />Prijavi incident</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Tip incidenta</Label><Select value={incidentType} onValueChange={setIncidentType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Težina</Label><Select value={severity} onValueChange={setSeverity}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MINOR">Manji</SelectItem><SelectItem value="MAJOR">Veći</SelectItem><SelectItem value="SERIOUS">Ozbiljan</SelectItem><SelectItem value="ACCIDENT">Nesreća</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Lokacija *</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Stand A1" required /></div>
            <div className="space-y-1.5"><Label>Zona</Label><Select value={zone} onValueChange={setZone}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="APRON">Apron</SelectItem><SelectItem value="TAXIWAY">Taxiway</SelectItem><SelectItem value="RUNWAY">Runway</SelectItem><SelectItem value="SERVICE_ROAD">Service road</SelectItem><SelectItem value="TERMINAL">Terminal</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Vrijeme događaja</Label><Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Vremenski uslovi</Label><Select value={weather} onValueChange={setWeather}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SUNNY">Sunčano</SelectItem><SelectItem value="CLOUDY">Oblačno</SelectItem><SelectItem value="RAIN">Kiša</SelectItem><SelectItem value="FOG">Magla</SelectItem><SelectItem value="SNOW">Snijeg</SelectItem><SelectItem value="STORM">Oluja</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>GSE kod</Label><Input value={equipmentCode} onChange={(e) => setEquipmentCode(e.target.value.toUpperCase())} placeholder="GSE-TOW-001" className="font-mono" /></div>
            <div className="space-y-1.5"><Label>Operater</Label><Input value={operatorName} onChange={(e) => setOperatorName(e.target.value)} placeholder="Ime radnika" /></div>
          </div>
          <div className="space-y-1.5"><Label>Opis događaja *</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Detaljno opišite šta se desilo..." required /></div>
          <div className="space-y-1.5"><Label>Hitne mjere</Label><Textarea value={immediateAction} onChange={(e) => setImmediateAction(e.target.value)} rows={2} placeholder="Šta je odmah urađeno..." /></div>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer p-2 border rounded"><input type="checkbox" checked={smorRequired} onChange={(e) => setSmorRequired(e.target.checked)} className="h-4 w-4" />SMOR</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer p-2 border rounded"><input type="checkbox" checked={injuriesReported} onChange={(e) => setInjuriesReported(e.target.checked)} className="h-4 w-4" />Ozljede</label>
            <div className="space-y-1.5"><Label>Šteta (€)</Label><Input type="number" value={damageEstimate} onChange={(e) => setDamageEstimate(e.target.value)} placeholder="0" /></div>
          </div>
          {smorRequired && <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700"><ShieldAlert className="h-3.5 w-3.5 inline mr-1" />SMOR obavezan — incident mora biti prijavljen EASA/CAA u roku od 72h.</div>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button><Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Prijavi</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function IncidentDetailDialog({ incident, onClose, onUpdated }: any) {
  const [rootCause, setRootCause] = useState('')
  const [correctiveActions, setCorrectiveActions] = useState('')
  const [preventiveActions, setPreventiveActions] = useState('')
  const [status, setStatus] = useState('OPEN')
  const [authorityNotified, setAuthorityNotified] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (incident) {
      setRootCause(incident.rootCause || '')
      setCorrectiveActions(incident.correctiveActions || '')
      setPreventiveActions(incident.preventiveActions || '')
      setStatus(incident.status || 'OPEN')
      setAuthorityNotified(incident.authorityNotified || '')
    }
  }, [incident])

  if (!incident) return null

  const handleUpdate = () => {
    startTransition(async () => {
      await updateIncident({
        incidentId: incident.id, status, rootCause, correctiveActions, preventiveActions,
        authorityNotified: authorityNotified || undefined,
      })
      toast.success('Incident ažuriran')
      onClose(); onUpdated()
    })
  }

  return (
    <Dialog open={!!incident} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertOctagon className="h-5 w-5" />{incident.incidentNumber}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {/* Incident details */}
          <div className="p-3 bg-muted/30 rounded-lg space-y-1 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={SEVERITY_COLORS[incident.severity] || ''}>{incident.severity}</Badge>
              <Badge variant="secondary">{TYPE_LABELS[incident.incidentType] || incident.incidentType}</Badge>
              {incident.smorRequired && <Badge className="bg-red-100 text-red-800">SMOR</Badge>}
            </div>
            <div><strong>Lokacija:</strong> {incident.location} ({incident.zone})</div>
            <div><strong>Vrijeme:</strong> {new Date(incident.occurredAt).toLocaleString('hr-HR')}</div>
            <div><strong>Opis:</strong> {incident.description}</div>
            {incident.equipmentCode && <div><strong>GSE:</strong> {incident.equipmentCode} — {incident.equipmentName}</div>}
            {incident.operatorName && <div><strong>Operater:</strong> {incident.operatorName}</div>}
            {incident.immediateAction && <div><strong>Hitne mjere:</strong> {incident.immediateAction}</div>}
            {incident.damageEstimate && <div><strong>Procijenjena šteta:</strong> {incident.damageEstimate.toFixed(2)}€</div>}
          </div>

          {/* Investigation */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Istraga i korektivne akcije</Label>
            <div className="space-y-1.5"><Label className="text-xs">Root cause</Label><Textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={2} placeholder="Uzrok incidenta..." /></div>
            <div className="space-y-1.5"><Label className="text-xs">Korektivne akcije</Label><Textarea value={correctiveActions} onChange={(e) => setCorrectiveActions(e.target.value)} rows={2} placeholder="Šta je urađeno..." /></div>
            <div className="space-y-1.5"><Label className="text-xs">Preventivne akcije</Label><Textarea value={preventiveActions} onChange={(e) => setPreventiveActions(e.target.value)} rows={2} placeholder="Šta će se uraditi ubuduće..." /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OPEN">Otvoren</SelectItem><SelectItem value="INVESTIGATING">Istraga</SelectItem><SelectItem value="RESOLVED">Riješen</SelectItem><SelectItem value="CLOSED">Zatvoren</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Autoritet obaviješten</Label><Input value={authorityNotified} onChange={(e) => setAuthorityNotified(e.target.value)} placeholder="CAA, policija..." /></div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Zatvori</Button><Button onClick={handleUpdate} disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sačuvaj</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
