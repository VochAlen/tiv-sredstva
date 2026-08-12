'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  Fuel, Battery, Plus, Loader2, Search, AlertTriangle, CheckCircle2,
  XCircle, Clock, User, MapPin, Car, Download, Zap,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  getFuelLogs, addFuelLog, getFuelStats,
  getParkingConfirmations, addParkingConfirmation, getParkingStats,
} from '@/lib/actions-fuel-parking'
import { getAllEquipment } from '@/lib/actions'

const FUEL_TYPE_LABELS: Record<string, string> = {
  DIESEL: 'Dizel', PETROL: 'Benzin', ELECTRIC: 'Električni', HYBRID: 'Hibrid', LPG: 'LPG',
}

export function FuelParkingView() {
  const [tab, setTab] = useState<'fuel' | 'parking'>('fuel')
  const [fuelLogs, setFuelLogs] = useState<any[]>([])
  const [fuelStats, setFuelStats] = useState<any>(null)
  const [parkingList, setParkingList] = useState<any[]>([])
  const [parkingStats, setParkingStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [showFuel, setShowFuel] = useState(false)
  const [showParking, setShowParking] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [fl, fs, pl, ps] = await Promise.all([
        getFuelLogs({ search, typeFilter }), getFuelStats(),
        getParkingConfirmations({ search }), getParkingStats(),
      ])
      setFuelLogs(fl); setFuelStats(fs); setParkingList(pl); setParkingStats(ps)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search, typeFilter])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Fuel className="h-5 w-5" />Gorivo & Parking</h2>
          <p className="text-sm text-muted-foreground">Refueling/Charging + GSE Parking Management (AHM 1115)</p>
        </div>
        <div className="flex gap-2">
          {tab === 'fuel' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/fuel', '_blank')}><Download className="h-4 w-4 mr-1.5" />PDF</Button>
              <Button onClick={() => setShowFuel(true)}><Plus className="h-4 w-4 mr-1.5" />Zabilježi točenje</Button>
            </div>
          )}
          {tab === 'parking' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/parking', '_blank')}><Download className="h-4 w-4 mr-1.5" />PDF</Button>
              <Button onClick={() => setShowParking(true)}><Plus className="h-4 w-4 mr-1.5" />Potvrdi parking</Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b">
        <button onClick={() => setTab('fuel')} className={'px-4 py-2 text-sm font-medium border-b-2 transition flex items-center gap-1.5 ' + (tab === 'fuel' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}><Fuel className="h-4 w-4" />Gorivo/Punjenje</button>
        <button onClick={() => setTab('parking')} className={'px-4 py-2 text-sm font-medium border-b-2 transition flex items-center gap-1.5 ' + (tab === 'parking' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}><Car className="h-4 w-4" />Parking (AHM 1115)</button>
      </div>

      {/* Fuel stats */}
      {tab === 'fuel' && fuelStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Točenja" value={fuelStats.totalEntries} tone="blue" />
          <StatCard label="Dizel (L)" value={fuelStats.dieselLiters.toFixed(0)} tone="orange" />
          <StatCard label="Struja (kWh)" value={fuelStats.electricKwh.toFixed(0)} tone="emerald" />
          <StatCard label="Ukupno trošak" value={`${fuelStats.totalCost.toFixed(2)}€`} tone="purple" />
        </div>
      )}

      {/* Parking stats */}
      {tab === 'parking' && parkingStats && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Potvrde" value={parkingStats.total} tone="blue" />
          <StatCard label="Sve potvrđeno" value={parkingStats.allConfirmed} tone="emerald" />
          <StatCard label="Sa problemima" value={parkingStats.withIssues} tone="red" />
        </div>
      )}

      {fuelStats?.lowFuelVehicles > 0 && tab === 'fuel' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {fuelStats.lowFuelVehicles} vozila ima nizak nivo goriva/baterije (ispod 20%)
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {tab === 'fuel' && (
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tip" /></SelectTrigger>
            <SelectContent><SelectItem value="ALL">Svi tipovi</SelectItem>{Object.entries(FUEL_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : tab === 'fuel' ? (
        <FuelList logs={fuelLogs} />
      ) : (
        <ParkingList list={parkingList} />
      )}

      <FuelDialog open={showFuel} onOpenChange={setShowFuel} onAdded={load} />
      <ParkingDialog open={showParking} onOpenChange={setShowParking} onAdded={load} />
    </div>
  )
}

function StatCard({ label, value, tone }: any) {
  const colors: any = { blue: 'bg-blue-50 border-blue-200 text-blue-900', orange: 'bg-orange-50 border-orange-200 text-orange-900', emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900', purple: 'bg-purple-50 border-purple-200 text-purple-900', red: 'bg-red-50 border-red-200 text-red-900' }
  return <div className={'p-4 rounded-lg border ' + colors[tone]}><div className="text-2xl font-bold">{value}</div><div className="text-xs mt-0.5">{label}</div></div>
}

function FuelList({ logs }: any) {
  if (logs.length === 0) return <Card><CardContent className="py-12 text-center text-muted-foreground"><Fuel className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Nema zabilježenih točenja.</p></CardContent></Card>
  return (
    <div className="space-y-2">
      {logs.map((f: any) => (
        <Card key={f.id} className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs">{f.equipmentCode}</Badge>
                <Badge variant="secondary" className="text-xs">{FUEL_TYPE_LABELS[f.fuelType] || f.fuelType}</Badge>
                {f.fuelType === 'ELECTRIC' ? <Battery className="h-3.5 w-3.5 text-emerald-600" /> : <Fuel className="h-3.5 w-3.5 text-orange-600" />}
              </div>
              <div className="text-sm font-medium">{f.equipmentName}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                <span>{f.amount} {f.unit}</span>
                {f.levelBefore != null && f.levelAfter != null && <span>{f.levelBefore}% → {f.levelAfter}%</span>}
                {f.pumpStation && <span>📍 {f.pumpStation}</span>}
                <span className="flex items-center gap-1"><User className="h-3 w-3" />{f.operatorName}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(f.fueledAt).toLocaleString('hr-HR')}</span>
              </div>
              {f.totalCost && <div className="text-xs text-emerald-700 mt-0.5">Trošak: {f.totalCost.toFixed(2)}€ ({f.costPerUnit?.toFixed(2)}€/{f.unit})</div>}
              {f.notes && <div className="text-xs text-muted-foreground mt-0.5">{f.notes}</div>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function ParkingList({ list }: any) {
  if (list.length === 0) return <Card><CardContent className="py-12 text-center text-muted-foreground"><Car className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Nema parking potvrda.</p></CardContent></Card>
  return (
    <div className="space-y-2">
      {list.map((p: any) => (
        <Card key={p.id} className={'p-4 border-l-4 ' + (p.allConfirmed ? 'border-l-emerald-500' : 'border-l-red-500')}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs">{p.equipmentCode}</Badge>
                {p.allConfirmed ? <Badge className="bg-emerald-100 text-emerald-800 text-xs"><CheckCircle2 className="h-3 w-3 mr-0.5" />Sve potvrđeno</Badge> : <Badge className="bg-red-100 text-red-800 text-xs"><XCircle className="h-3 w-3 mr-0.5" />Problemi</Badge>}
              </div>
              <div className="text-sm font-medium">{p.equipmentName}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1"><User className="h-3 w-3" />{p.operatorName}</span>
                {p.parkingLocation && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.parkingLocation}</span>}
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(p.confirmedAt).toLocaleString('hr-HR')}</span>
              </div>
              {/* Checklist items */}
              <div className="flex items-center gap-3 mt-2 flex-wrap text-xs">
                <span className={p.parkedAtDesignatedSpot ? 'text-emerald-600' : 'text-red-600'}>{p.parkedAtDesignatedSpot ? '✓' : '✗'} Parkirano na mjestu</span>
                <span className={p.handbrakeEngaged ? 'text-emerald-600' : 'text-red-600'}>{p.handbrakeEngaged ? '✓' : '✗'} Ručna kočnica</span>
                <span className={p.ignitionOff ? 'text-emerald-600' : 'text-red-600'}>{p.ignitionOff ? '✓' : '✗'} Kontakt isključen</span>
                <span className={p.lightsOff ? 'text-emerald-600' : 'text-red-600'}>{p.lightsOff ? '✓' : '✗'} Svjetla ugašena</span>
                <span className={p.keyRemoved ? 'text-emerald-600' : 'text-red-600'}>{p.keyRemoved ? '✓' : '✗'} Ključ izvađen</span>
                {p.chocksPlaced && <span className="text-emerald-600">✓ Klinovi postavljeni</span>}
              </div>
              {p.issuesReported && <div className="text-xs text-red-600 mt-1">⚠ {p.issuesReported}</div>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function FuelDialog({ open, onOpenChange, onAdded }: any) {
  const [equipmentId, setEquipmentId] = useState('')
  const [equipmentCode, setEquipmentCode] = useState('')
  const [equipmentName, setEquipmentName] = useState('')
  const [fuelType, setFuelType] = useState('DIESEL')
  const [amount, setAmount] = useState(0)
  const [levelBefore, setLevelBefore] = useState(0)
  const [levelAfter, setLevelAfter] = useState(0)
  const [pumpStation, setPumpStation] = useState('')
  const [costPerUnit, setCostPerUnit] = useState(0)
  const [operatorCardId, setOperatorCardId] = useState('')
  const [operatorName, setOperatorName] = useState('')
  const [notes, setNotes] = useState('')
  const [equipmentList, setEquipmentList] = useState<any[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) { getAllEquipment().then((eq: any) => setEquipmentList(eq)) }
  }, [open])

  const totalCost = amount * costPerUnit

  const handleSelect = (id: string) => {
    const eq = equipmentList.find((e: any) => e.id === id)
    if (eq) {
      setEquipmentId(eq.id); setEquipmentCode(eq.code); setEquipmentName(eq.name)
      setFuelType((eq as any).fuelType || 'DIESEL')
      setLevelBefore((eq as any).fuelLevel || 0)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!equipmentId || !amount || !operatorCardId || !operatorName) { toast.error('Popunite obavezna polja'); return }
    startTransition(async () => {
      try {
        await addFuelLog({
          equipmentId, equipmentCode, equipmentName, fuelType, amount,
          levelBefore: levelBefore || undefined, levelAfter: levelAfter || undefined,
          pumpStation: pumpStation || undefined, costPerUnit: costPerUnit || undefined,
          totalCost: totalCost || undefined, operatorCardId, operatorName, notes: notes || undefined,
        })
        toast.success('Točenje zabilježeno')
        onOpenChange(false); onAdded()
        setEquipmentId(''); setAmount(0); setPumpStation(''); setCostPerUnit(0); setOperatorCardId(''); setOperatorName(''); setNotes('')
      } catch (e: any) { toast.error(e?.message ?? 'Greška') }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Fuel className="h-5 w-5" />Zabilježi točenje/punjenje</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5"><Label>Sredstvo</Label><Select value={equipmentId} onValueChange={handleSelect}><SelectTrigger><SelectValue placeholder="Izaberite..." /></SelectTrigger><SelectContent>{equipmentList.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.code} — {e.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5"><Label>Tip</Label><Select value={fuelType} onValueChange={setFuelType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(FUEL_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Količina *</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} required /></div>
            <div className="space-y-1.5"><Label>Pumpa/charger</Label><Input value={pumpStation} onChange={(e) => setPumpStation(e.target.value)} placeholder="Pump 1" /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5"><Label>Stanje pre (%)</Label><Input type="number" value={levelBefore} onChange={(e) => setLevelBefore(parseFloat(e.target.value) || 0)} /></div>
            <div className="space-y-1.5"><Label>Stanje posle (%)</Label><Input type="number" value={levelAfter} onChange={(e) => setLevelAfter(parseFloat(e.target.value) || 0)} /></div>
            <div className="space-y-1.5"><Label>Cijena/jedinica</Label><Input type="number" step="0.01" value={costPerUnit} onChange={(e) => setCostPerUnit(parseFloat(e.target.value) || 0)} /></div>
          </div>
          {totalCost > 0 && <div className="p-2 bg-muted/30 rounded text-sm">Ukupni trošak: <strong>{totalCost.toFixed(2)}€</strong></div>}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Broj kartice *</Label><Input value={operatorCardId} onChange={(e) => setOperatorCardId(e.target.value.toUpperCase())} placeholder="EMP-1001" className="font-mono" required /></div>
            <div className="space-y-1.5"><Label>Ime *</Label><Input value={operatorName} onChange={(e) => setOperatorName(e.target.value)} required /></div>
          </div>
          <div className="space-y-1.5"><Label>Napomene</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button><Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Zabilježi</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ParkingDialog({ open, onOpenChange, onAdded }: any) {
  const [equipmentId, setEquipmentId] = useState('')
  const [equipmentCode, setEquipmentCode] = useState('')
  const [equipmentName, setEquipmentName] = useState('')
  const [parkedAtDesignatedSpot, setParkedAtDesignatedSpot] = useState(false)
  const [handbrakeEngaged, setHandbrakeEngaged] = useState(false)
  const [ignitionOff, setIgnitionOff] = useState(false)
  const [lightsOff, setLightsOff] = useState(false)
  const [keyRemoved, setKeyRemoved] = useState(false)
  const [chocksPlaced, setChocksPlaced] = useState(false)
  const [parkingLocation, setParkingLocation] = useState('')
  const [operatorCardId, setOperatorCardId] = useState('')
  const [operatorName, setOperatorName] = useState('')
  const [issuesReported, setIssuesReported] = useState('')
  const [equipmentList, setEquipmentList] = useState<any[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) { getAllEquipment().then((eq: any) => setEquipmentList(eq)) }
  }, [open])

  const handleSelect = (id: string) => {
    const eq = equipmentList.find((e: any) => e.id === id)
    if (eq) { setEquipmentId(eq.id); setEquipmentCode(eq.code); setEquipmentName(eq.name) }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!equipmentId || !operatorCardId || !operatorName) { toast.error('Popunite obavezna polja'); return }
    startTransition(async () => {
      try {
        await addParkingConfirmation({
          equipmentId, equipmentCode, equipmentName, operatorCardId, operatorName,
          parkedAtDesignatedSpot, handbrakeEngaged, ignitionOff, lightsOff, keyRemoved, chocksPlaced,
          parkingLocation: parkingLocation || undefined, issuesReported: issuesReported || undefined,
        })
        const allOk = parkedAtDesignatedSpot && handbrakeEngaged && ignitionOff && lightsOff && keyRemoved
        toast.success(allOk ? 'Parking potvrđen — sve u redu' : 'Parking zabilježen sa problemima')
        onOpenChange(false); onAdded()
        setEquipmentId(''); setParkedAtDesignatedSpot(false); setHandbrakeEngaged(false); setIgnitionOff(false); setLightsOff(false); setKeyRemoved(false); setChocksPlaced(false); setParkingLocation(''); setOperatorCardId(''); setOperatorName(''); setIssuesReported('')
      } catch (e: any) { toast.error(e?.message ?? 'Greška') }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Car className="h-5 w-5" />Parking potvrda (AHM 1115)</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5"><Label>Sredstvo</Label><Select value={equipmentId} onValueChange={handleSelect}><SelectTrigger><SelectValue placeholder="Izaberite..." /></SelectTrigger><SelectContent>{equipmentList.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.code} — {e.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Broj kartice *</Label><Input value={operatorCardId} onChange={(e) => setOperatorCardId(e.target.value.toUpperCase())} placeholder="EMP-1001" className="font-mono" required /></div>
            <div className="space-y-1.5"><Label>Ime *</Label><Input value={operatorName} onChange={(e) => setOperatorName(e.target.value)} required /></div>
          </div>
          <div className="space-y-1.5"><Label>Lokacija parkinga</Label><Input value={parkingLocation} onChange={(e) => setParkingLocation(e.target.value)} placeholder="Stand A1 - Position 3" /></div>
          {/* AHM 1115 checklist */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">AHM 1115 — Parking checklist</Label>
            <label className="flex items-center gap-2 p-2 border rounded cursor-pointer"><Checkbox checked={parkedAtDesignatedSpot} onCheckedChange={(v) => setParkedAtDesignatedSpot(!!v)} /><span className="text-sm">Vozilo parkirano na predviđenom mjestu</span></label>
            <label className="flex items-center gap-2 p-2 border rounded cursor-pointer"><Checkbox checked={handbrakeEngaged} onCheckedChange={(v) => setHandbrakeEngaged(!!v)} /><span className="text-sm">Ručna kočnica aktivirana</span></label>
            <label className="flex items-center gap-2 p-2 border rounded cursor-pointer"><Checkbox checked={ignitionOff} onCheckedChange={(v) => setIgnitionOff(!!v)} /><span className="text-sm">Kontakt/ignicija isključena</span></label>
            <label className="flex items-center gap-2 p-2 border rounded cursor-pointer"><Checkbox checked={lightsOff} onCheckedChange={(v) => setLightsOff(!!v)} /><span className="text-sm">Svjetla ugašena</span></label>
            <label className="flex items-center gap-2 p-2 border rounded cursor-pointer"><Checkbox checked={keyRemoved} onCheckedChange={(v) => setKeyRemoved(!!v)} /><span className="text-sm">Ključ izvađen / predat</span></label>
            <label className="flex items-center gap-2 p-2 border rounded cursor-pointer"><Checkbox checked={chocksPlaced} onCheckedChange={(v) => setChocksPlaced(!!v)} /><span className="text-sm">Klinovi postavljeni (ako je primjenjivo)</span></label>
          </div>
          <div className="space-y-1.5"><Label>Ako nešto nije potvrđeno — opišite</Label><Textarea value={issuesReported} onChange={(e) => setIssuesReported(e.target.value)} rows={2} placeholder="npr. Vozilo nije na pravom mjestu — parkiran na Stand A2 umjesto A1" /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button><Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Potvrdi</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
