'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  Calendar, Wrench, Package, ShoppingCart, TrendingDown, Plus, Loader2,
  AlertTriangle, CheckCircle2, Clock, Zap, Trash2, DollarSign, FileText, Download, Search,
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
  autoGenerateSchedules, getSpareParts, addSparePart, updateSparePartStock, deleteSparePart,
  getPartPurchases, addPartPurchase, getPartConsumption, consumePart, getCostSummary,
} from '@/lib/actions-scheduling'
import { getMaintenanceSchedule, completeMaintenanceTask } from '@/lib/actions-adr'

const CATEGORY_LABELS: Record<string, string> = {
  TIRE: 'Gume', BRAKE: 'Kočnice', HYDRAULIC: 'Hidraulika', ELECTRICAL: 'Elektrika',
  FILTER: 'Filteri', ENGINE: 'Motor', OTHER: 'Ostalo',
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800', DUE: 'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800', COMPLETED: 'bg-emerald-100 text-emerald-800',
  OVERDUE: 'bg-red-100 text-red-800',
}

export function SchedulingView() {
  const [tab, setTab] = useState<'schedule' | 'parts' | 'purchases' | 'consumption' | 'costs'>('schedule')
  const [schedule, setSchedule] = useState<any[]>([])
  const [parts, setParts] = useState<any[]>([])
  const [purchases, setPurchases] = useState<any[]>([])
  const [consumption, setConsumption] = useState<any[]>([])
  const [costs, setCosts] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const load = async () => {
    setLoading(true)
    try {
      const [sch, pts, pur, con, cst] = await Promise.all([
        getMaintenanceSchedule(), getSpareParts(), getPartPurchases(), getPartConsumption(), getCostSummary(),
      ])
      setSchedule(sch); setParts(pts); setPurchases(pur); setConsumption(con); setCosts(cst)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleAutoGen = () => {
    startTransition(async () => {
      const res = await autoGenerateSchedules()
      toast.success('Generisano ' + res.generated + ' servisa')
      load()
    })
  }

  const lowStock = parts.filter((p) => p.quantity <= p.minQuantity).length
  const dueTasks = schedule.filter((s) => s.status === 'DUE' || s.status === 'OVERDUE').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Calendar className="h-5 w-5" />Servisni planer & Rezervni dijelovi</h2>
          <p className="text-sm text-muted-foreground">Auto-zakazivanje po km/h/mjesecima · Magacin rezervnih dijelova · Troškovnik</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/maintenance-schedule', '_blank')}><Download className="h-4 w-4 mr-1.5" />Servisni plan PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/spare-parts', '_blank')}><Download className="h-4 w-4 mr-1.5" />Dijelovi PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/purchases', '_blank')}><Download className="h-4 w-4 mr-1.5" />Nabavke PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/consumption', '_blank')}><Download className="h-4 w-4 mr-1.5" />Utrošak PDF</Button>
          <Button onClick={handleAutoGen} disabled={isPending}>
            <Zap className="h-4 w-4 mr-1.5" />Auto-generiši servise
          </Button>
        </div>
      </div>

      {/* Alert cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AlertCard icon={AlertTriangle} label="Servisi na naplatu" value={dueTasks} tone="amber" onClick={() => setTab('schedule')} />
        <AlertCard icon={Package} label="Niska zaliha" value={lowStock} tone="red" onClick={() => setTab('parts')} />
        <AlertCard icon={ShoppingCart} label="Nabavke" value={purchases.length} tone="blue" onClick={() => setTab('purchases')} />
        <AlertCard icon={DollarSign} label="Ukupni troškovi" value={(costs?.grandTotal ?? 0).toFixed(0) + ' EUR'} tone="purple" onClick={() => setTab('costs')} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto">
        <TabBtn active={tab === 'schedule'} onClick={() => setTab('schedule')} icon={Calendar} label="Servisni plan" />
        <TabBtn active={tab === 'parts'} onClick={() => setTab('parts')} icon={Package} label="Rezervni dijelovi" />
        <TabBtn active={tab === 'purchases'} onClick={() => setTab('purchases')} icon={ShoppingCart} label="Nabavke" />
        <TabBtn active={tab === 'consumption'} onClick={() => setTab('consumption')} icon={TrendingDown} label="Utrošak" />
        <TabBtn active={tab === 'costs'} onClick={() => setTab('costs')} icon={DollarSign} label="Troškovnik" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : tab === 'schedule' ? (
        <ScheduleList schedule={schedule} onUpdated={load} />
      ) : tab === 'parts' ? (
        <PartsList parts={parts} onUpdated={load} />
      ) : tab === 'purchases' ? (
        <PurchasesList purchases={purchases} parts={parts} onUpdated={load} />
      ) : tab === 'consumption' ? (
        <ConsumptionList consumption={consumption} parts={parts} onUpdated={load} />
      ) : (
        <CostsView costs={costs} purchases={purchases} consumption={consumption} />
      )}
    </div>
  )
}

function AlertCard({ icon: Icon, label, value, tone, onClick }: any) {
  const colors: any = {
    amber: 'bg-amber-50 border-amber-200 text-amber-900', red: 'bg-red-50 border-red-200 text-red-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900', purple: 'bg-purple-50 border-purple-200 text-purple-900',
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

const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Zakazano', DUE: 'Na naplatu', IN_PROGRESS: 'U toku', COMPLETED: 'Završeno', OVERDUE: 'Prekoračeno',
}

function ScheduleList({ schedule, onUpdated }: any) {
  const [completeId, setCompleteId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')

  const filtered = schedule.filter((s: any) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [s.equipmentCode, s.title, s.description, s.maintenanceType, s.completionNotes].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false
    if (typeFilter !== 'ALL' && s.maintenanceType !== typeFilter) return false
    return true
  })

  const handleComplete = () => {
    if (!completeId) return
    startTransition(async () => {
      await completeMaintenanceTask(completeId, notes)
      toast.success('Servis završen')
      setCompleteId(null); setNotes(''); onUpdated()
    })
  }

  if (schedule.length === 0) {
    // Show search bar even when empty, so users know the feature exists
    return (
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pretraga po kodu, nazivu, opisu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Svi statusi</SelectItem>
              {Object.entries(SCHEDULE_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Tip" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Svi tipovi</SelectItem>
              <SelectItem value="PREVENTIVE">Preventivno</SelectItem>
              <SelectItem value="CORRECTIVE">Korektivno</SelectItem>
              <SelectItem value="INSPECTION">Inspekcija</SelectItem>
              <SelectItem value="OVERHAUL">Generalni</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {schedule.length}</div>
        </div>
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Nema zakazanih servisa. Kliknite "Auto-generiši servise" u gornjem desnom uglu.</p></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po kodu, nazivu, opisu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            {Object.entries(SCHEDULE_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Tip" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi tipovi</SelectItem>
            <SelectItem value="PREVENTIVE">Preventivno</SelectItem>
            <SelectItem value="CORRECTIVE">Korektivno</SelectItem>
            <SelectItem value="INSPECTION">Inspekcija</SelectItem>
            <SelectItem value="OVERHAUL">Generalni</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {schedule.length}</div>
      </div>
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Nema rezultata pretrage.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
      {filtered.map((s: any) => (
        <Card key={s.id} className={'p-4 border-l-4 ' + (s.status === 'OVERDUE' ? 'border-l-red-500' : s.status === 'DUE' ? 'border-l-amber-500' : 'border-l-blue-500')}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs">{s.equipmentCode}</Badge>
                <Badge className={'text-xs ' + (STATUS_COLORS[s.status] || '')}>{s.status}</Badge>
                <Badge variant="secondary" className="text-xs">{s.maintenanceType}</Badge>
                {s.autoGenerated && <Badge variant="outline" className="text-xs"><Zap className="h-3 w-3 mr-0.5" />Auto</Badge>}
              </div>
              <div className="text-sm font-medium">{s.title}</div>
              {s.description && <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>}
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                {s.triggerHours && <span>Na: {s.triggerHours}h</span>}
                {s.triggerKm && <span>Na: {s.triggerKm}km</span>}
                {s.triggerDate && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(s.triggerDate).toLocaleDateString('hr-HR')}</span>}
                {s.triggerInterval && <span>Svakih {s.triggerInterval}h</span>}
                {s.triggerIntervalKm && <span>Svakih {s.triggerIntervalKm}km</span>}
                {s.triggerIntervalMonths && <span>Svakih {s.triggerIntervalMonths}mj</span>}
              </div>
              {s.completionNotes && <div className="text-xs text-emerald-700 mt-1 p-1.5 bg-emerald-50 rounded"><strong>Završeno:</strong> {s.completionNotes}</div>}
            </div>
            {s.status !== 'COMPLETED' && (
              <Button size="sm" variant="outline" onClick={() => setCompleteId(s.id)}><CheckCircle2 className="h-4 w-4 mr-1" />Završi</Button>
            )}
          </div>
        </Card>
      ))}
        </div>
      )}

      <Dialog open={!!completeId} onOpenChange={(v) => !v && setCompleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Završi servis</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Bilješke</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Šta je urađeno..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteId(null)}>Odustani</Button>
            <Button onClick={handleComplete} disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Potvrdi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PartsList({ parts, onUpdated }: any) {
  const [showAdd, setShowAdd] = useState(false)
  const [editPart, setEditPart] = useState<any>(null)
  const [newQty, setNewQty] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [partSearch, setPartSearch] = useState('')
  const [partCatFilter, setPartCatFilter] = useState('ALL')

  const filteredParts = parts.filter((p: any) => {
    if (partSearch) {
      const s = partSearch.toLowerCase()
      if (!p.partNumber?.toLowerCase().includes(s) && !p.name?.toLowerCase().includes(s) && !p.manufacturer?.toLowerCase().includes(s)) return false
    }
    if (partCatFilter !== 'ALL' && p.category !== partCatFilter) return false
    return true
  })

  const handleSaveQty = () => {
    if (!editPart) return
    startTransition(async () => {
      await updateSparePartStock(editPart.id, newQty)
      toast.success('Stanje ažurirano')
      setEditPart(null); onUpdated()
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm('Obrisati "' + name + '"?')) return
    startTransition(async () => {
      await deleteSparePart(id); toast.success('Obrisano'); onUpdated()
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga dijelova..." value={partSearch} onChange={(e) => setPartSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={partCatFilter} onValueChange={setPartCatFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Kategorija" /></SelectTrigger>
          <SelectContent><SelectItem value="ALL">Sve kategorije</SelectItem>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Dodaj dio</Button>
      </div>
      {filteredParts.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Package className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Nema rezervnih dijelova u magacinu.</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredParts.map((p: any) => (
            <Card key={p.id} className={'p-4 ' + (p.quantity <= p.minQuantity ? 'border-red-300 bg-red-50' : '')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="font-mono text-xs">{p.partNumber}</Badge>
                    <Badge variant="secondary" className="text-xs">{CATEGORY_LABELS[p.category] || p.category}</Badge>
                  </div>
                  <div className="text-sm font-medium">{p.name}</div>
                  {p.manufacturer && <div className="text-xs text-muted-foreground">{p.manufacturer}</div>}
                  <div className="text-sm mt-2 flex items-center gap-3">
                    <span className={'font-bold ' + (p.quantity <= p.minQuantity ? 'text-red-600' : 'text-emerald-600')}>{p.quantity} {p.unit}</span>
                    <span className="text-xs text-muted-foreground">min: {p.minQuantity}</span>
                  </div>
                  {p.unitPrice != null && <div className="text-xs text-muted-foreground mt-1">{p.unitPrice.toFixed(2)}€ + PDV {p.vatRate}%</div>}
                  {p.location && <div className="text-xs text-muted-foreground">📍 {p.location}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditPart(p); setNewQty(p.quantity) }}>Izmjeni</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id, p.name)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit quantity dialog */}
      <Dialog open={!!editPart} onOpenChange={(v) => !v && setEditPart(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ažuriraj stanje: {editPart?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Trenutno stanje: {editPart?.quantity} {editPart?.unit}</Label><Input type="number" value={newQty} onChange={(e) => setNewQty(parseInt(e.target.value) || 0)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditPart(null)}>Odustani</Button><Button onClick={handleSaveQty} disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Spremi</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add part dialog */}
      <AddPartDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} />
    </div>
  )
}

function AddPartDialog({ open, onOpenChange, onAdded }: any) {
  const [partNumber, setPartNumber] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('TIRE')
  const [manufacturer, setManufacturer] = useState('')
  const [quantity, setQuantity] = useState(0)
  const [minQuantity, setMinQuantity] = useState(1)
  const [unit, setUnit] = useState('kom')
  const [location, setLocation] = useState('')
  const [unitPrice, setUnitPrice] = useState(0)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        await addSparePart({ partNumber, name, category, manufacturer: manufacturer || undefined, quantity, minQuantity, unit, location: location || undefined, unitPrice: unitPrice || undefined })
        toast.success('Dio dodan u magacin')
        onOpenChange(false); onAdded()
        setPartNumber(''); setName(''); setManufacturer(''); setQuantity(0); setMinQuantity(1); setLocation(''); setUnitPrice(0)
      } catch (e: any) { toast.error(e?.message ?? 'Greška') }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Dodaj rezervni dio</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Broj dijela *</Label><Input value={partNumber} onChange={(e) => setPartNumber(e.target.value.toUpperCase())} placeholder="OEM-12345" className="font-mono" required /></div>
            <div className="space-y-1.5"><Label>Kategorija</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-1.5"><Label>Naziv *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prednja guma 11x22.5" required /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Proizvođač</Label><Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="Michelin" /></div>
            <div className="space-y-1.5"><Label>Lokacija</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Polica A-1" /></div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1.5"><Label>Količina</Label><Input type="number" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 0)} /></div>
            <div className="space-y-1.5"><Label>Min</Label><Input type="number" value={minQuantity} onChange={(e) => setMinQuantity(parseInt(e.target.value) || 1)} /></div>
            <div className="space-y-1.5"><Label>Jedinica</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Cijena (€)</Label><Input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)} /></div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button><Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Dodaj</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PurchasesList({ purchases, parts, onUpdated }: any) {
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [paidFilter, setPaidFilter] = useState('ALL')

  const filtered = purchases.filter((p: any) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [p.partNumber, p.partName, p.supplier, p.invoiceNumber, p.orderNumber].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (paidFilter === 'PAID' && !p.paid) return false
    if (paidFilter === 'UNPAID' && p.paid) return false
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po dijelu, dobavljaču, računu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={paidFilter} onValueChange={setPaidFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Plaćanje" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Sve nabavke</SelectItem>
            <SelectItem value="PAID">Plaćeno</SelectItem>
            <SelectItem value="UNPAID">Nije plaćeno</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Nova nabavka</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {purchases.length}</div>
      </div>
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Nema rezultata pretrage.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p: any) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className="font-mono text-xs">{p.partNumber}</Badge>
                    {p.invoiceNumber && <Badge variant="secondary" className="text-xs">{p.invoiceNumber}</Badge>}
                    {p.paid ? <Badge className="bg-emerald-100 text-emerald-800 text-xs">Plaćeno</Badge> : <Badge className="bg-red-100 text-red-800 text-xs">Nije plaćeno</Badge>}
                  </div>
                  <div className="text-sm font-medium">{p.partName}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{p.supplier} · {p.quantity} kom × {p.unitPriceNet.toFixed(2)}€</div>
                  <div className="text-xs mt-1 flex items-center gap-3 flex-wrap">
                    <span>Bez PDV: <strong>{p.totalNet.toFixed(2)}€</strong></span>
                    <span>PDV ({p.vatRate}%): <strong>{p.vatAmount.toFixed(2)}€</strong></span>
                    <span className="text-emerald-700">Ukupno: <strong>{p.totalGross.toFixed(2)}€</strong></span>
                    {p.invoiceDate && <span>· {new Date(p.invoiceDate).toLocaleDateString('hr-HR')}</span>}
                  </div>
                  {p.orderNumber && <div className="text-xs text-muted-foreground mt-0.5">Porudžba: {p.orderNumber}</div>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <AddPurchaseDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} parts={parts} />
    </div>
  )
}

function AddPurchaseDialog({ open, onOpenChange, onAdded, parts }: any) {
  const [partId, setPartId] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [partName, setPartName] = useState('')
  const [supplier, setSupplier] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPriceNet, setUnitPriceNet] = useState(0)
  const [vatRate, setVatRate] = useState(21)
  const [isPending, startTransition] = useTransition()

  const totalNet = quantity * unitPriceNet
  const vatAmount = totalNet * (vatRate / 100)
  const totalGross = totalNet + vatAmount

  const handlePartSelect = (id: string) => {
    const p = parts.find((x: any) => x.id === id)
    if (p) { setPartId(p.id); setPartNumber(p.partNumber); setPartName(p.name); setUnitPriceNet(p.unitPrice ?? 0) }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        await addPartPurchase({ partId: partId || undefined, partNumber, partName, supplier, orderNumber: orderNumber || undefined, invoiceNumber: invoiceNumber || undefined, invoiceDate: invoiceDate || undefined, quantity, unitPriceNet, vatRate })
        toast.success('Nabavka zabilježena — stanje u magacinu ažurirano')
        onOpenChange(false); onAdded()
        setPartId(''); setPartNumber(''); setPartName(''); setSupplier(''); setOrderNumber(''); setInvoiceNumber(''); setInvoiceDate(''); setQuantity(1); setUnitPriceNet(0)
      } catch (e: any) { toast.error(e?.message ?? 'Greška') }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova nabavka rezervnog dijela</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5"><Label>Rezervni dio</Label><Select value={partId} onValueChange={handlePartSelect}><SelectTrigger><SelectValue placeholder="Izaberite dio..." /></SelectTrigger><SelectContent>{parts.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.partNumber} — {p.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Dobavljač *</Label><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Michelin CG" required /></div>
            <div className="space-y-1.5"><Label>Broj porudžbe</Label><Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="PO-2026-001" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Broj računa</Label><Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-2026-001" /></div>
            <div className="space-y-1.5"><Label>Datum računa</Label><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5"><Label>Količina *</Label><Input type="number" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} required /></div>
            <div className="space-y-1.5"><Label>Cijena/kom (€) *</Label><Input type="number" step="0.01" value={unitPriceNet} onChange={(e) => setUnitPriceNet(parseFloat(e.target.value) || 0)} required /></div>
            <div className="space-y-1.5"><Label>PDV (%)</Label><Input type="number" value={vatRate} onChange={(e) => setVatRate(parseFloat(e.target.value) || 21)} /></div>
          </div>
          {/* Auto-calculated totals */}
          <div className="p-3 bg-muted/30 rounded-lg space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Ukupno bez PDV:</span><strong>{totalNet.toFixed(2)}€</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">PDV ({vatRate}%):</span><strong>{vatAmount.toFixed(2)}€</strong></div>
            <div className="flex justify-between text-emerald-700"><span>Ukupno sa PDV:</span><strong>{totalGross.toFixed(2)}€</strong></div>
          </div>
          <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">ℹ️ Stanje u magacinu će biti automatski povećano za {quantity} kom.</div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button><Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Zabilježi nabavku</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ConsumptionList({ consumption, parts, onUpdated }: any) {
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = consumption.filter((c: any) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [c.partNumber, c.partName, c.equipmentCode, c.consumedBy, c.notes].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po dijelu, vozilu, potrošaču..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Zabilježi utrošak</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {consumption.length}</div>
      </div>
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><TrendingDown className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Nema rezultata pretrage.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c: any) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="font-mono text-xs">{c.partNumber}</Badge>
                    {c.equipmentCode && <Badge variant="secondary" className="text-xs">{c.equipmentCode}</Badge>}
                  </div>
                  <div className="text-sm font-medium">{c.partName}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                    <span>{c.quantity} kom</span>
                    {c.totalCost && <span>Trošak: {c.totalCost.toFixed(2)}€</span>}
                    {c.consumedBy && <span>Od: {c.consumedBy}</span>}
                    <span>{new Date(c.consumedAt).toLocaleDateString('hr-HR')}</span>
                  </div>
                  {c.notes && <div className="text-xs mt-1 text-muted-foreground">{c.notes}</div>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <AddConsumptionDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} parts={parts} />
    </div>
  )
}

function AddConsumptionDialog({ open, onOpenChange, onAdded, parts }: any) {
  const [partId, setPartId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [equipmentCode, setEquipmentCode] = useState('')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const p = parts.find((x: any) => x.id === partId)
    if (!p) { toast.error('Izaberite dio'); return }
    startTransition(async () => {
      try {
        await consumePart({ partId: p.id, partNumber: p.partNumber, partName: p.name, equipmentCode: equipmentCode || undefined, quantity, unitPriceNet: p.unitPrice ?? 0, notes: notes || undefined })
        toast.success('Utrošeno ' + quantity + ' kom — stanje smanjeno')
        onOpenChange(false); onAdded()
        setPartId(''); setQuantity(1); setEquipmentCode(''); setNotes('')
      } catch (e: any) { toast.error(e?.message ?? 'Greška') }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Zabilježi utrošak rezervnog dijela</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5"><Label>Rezervni dio *</Label><Select value={partId} onValueChange={setPartId}><SelectTrigger><SelectValue placeholder="Izaberite dio..." /></SelectTrigger><SelectContent>{parts.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.partNumber} — {p.name} ({p.quantity} {p.unit})</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Količina</Label><Input type="number" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} /></div>
            <div className="space-y-1.5"><Label>Vozilo (kod)</Label><Input value={equipmentCode} onChange={(e) => setEquipmentCode(e.target.value.toUpperCase())} placeholder="GSE-TOW-001" /></div>
          </div>
          <div className="space-y-1.5"><Label>Napomene</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">⚠️ Stanje u magacinu će biti smanjeno za {quantity} kom.</div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button><Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Zabilježi</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CostsView({ costs, purchases, consumption }: any) {
  if (!costs) return null
  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
          <div className="text-xs text-blue-600 uppercase">Nabavke</div>
          <div className="text-2xl font-bold text-blue-700">{costs.totalPurchases.toFixed(2)}€</div>
          <div className="text-xs text-blue-500">{costs.purchaseCount} transakcija</div>
        </div>
        <div className="p-4 rounded-lg border bg-orange-50 border-orange-200">
          <div className="text-xs text-orange-600 uppercase">Utrošak dijelova</div>
          <div className="text-2xl font-bold text-orange-700">{costs.totalConsumption.toFixed(2)}€</div>
          <div className="text-xs text-orange-500">{costs.consumptionCount} stavki</div>
        </div>
        <div className="p-4 rounded-lg border bg-purple-50 border-purple-200">
          <div className="text-xs text-purple-600 uppercase">Održavanje</div>
          <div className="text-2xl font-bold text-purple-700">{costs.totalMaintenance.toFixed(2)}€</div>
          <div className="text-xs text-purple-500">{costs.maintenanceCount} servisa</div>
        </div>
        <div className="p-4 rounded-lg border bg-emerald-50 border-emerald-200">
          <div className="text-xs text-emerald-600 uppercase">UKUPNO</div>
          <div className="text-2xl font-bold text-emerald-700">{costs.grandTotal.toFixed(2)}€</div>
          <div className="text-xs text-emerald-500">svi troškovi</div>
        </div>
      </div>

      {/* Recent purchases */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" />Zadnje nabavke</CardTitle></CardHeader>
        <CardContent>
          {purchases.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nema nabavki</p> : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {purchases.slice(0, 10).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded border text-sm">
                  <div><div className="font-medium">{p.partName}</div><div className="text-xs text-muted-foreground">{p.supplier} · {p.quantity} kom</div></div>
                  <div className="text-right"><div className="font-bold">{p.totalGross.toFixed(2)}€</div><div className="text-xs text-muted-foreground">sa PDV</div></div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent consumption */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="h-4 w-4" />Zadnji utrošak</CardTitle></CardHeader>
        <CardContent>
          {consumption.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nema utroška</p> : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {consumption.slice(0, 10).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded border text-sm">
                  <div><div className="font-medium">{c.partName}</div><div className="text-xs text-muted-foreground">{c.equipmentCode || '—'} · {c.quantity} kom · {new Date(c.consumedAt).toLocaleDateString('hr-HR')}</div></div>
                  <div className="font-bold">{(c.totalCost ?? 0).toFixed(2)}€</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
