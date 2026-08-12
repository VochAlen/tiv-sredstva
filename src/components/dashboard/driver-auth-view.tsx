'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  ShieldCheck, Plus, Loader2, Lock, Unlock, AlertTriangle, CheckCircle2,
  Clock, User, Download, Car, Award,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  getDriverAuthorizations, addDriverAuthorization, updateDriverAuthorization, getDriverAuthStats,
} from '@/lib/actions-driver-auth'

export function DriverAuthView() {
  const [auths, setAuths] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editAuth, setEditAuth] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [a, s] = await Promise.all([getDriverAuthorizations(), getDriverAuthStats()])
      setAuths(a); setStats(s)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Car className="h-5 w-5" />Driver Authorization</h2>
          <p className="text-sm text-muted-foreground">ADR.OPS.C.005 — Dozvole za Movement Area</p>
        </div>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Dodaj dozvolu</Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Ukupno" value={stats.total} tone="blue" />
          <StatCard label="Aktivne" value={stats.active} tone="emerald" />
          <StatCard label="Istekle" value={stats.expired} tone="red" />
          <StatCard label="Uskoro ističu" value={stats.expiringSoon} tone="amber" />
          <StatCard label="Suspendovane" value={stats.suspended} tone="red" />
        </div>
      )}

      {/* Category summary */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg border bg-blue-50 border-blue-200 text-center">
            <div className="text-xl font-bold text-blue-700">{stats.cat1}</div>
            <div className="text-xs text-blue-600">Cat.1 — Airside</div>
          </div>
          <div className="p-3 rounded-lg border bg-amber-50 border-amber-200 text-center">
            <div className="text-xl font-bold text-amber-700">{stats.cat2}</div>
            <div className="text-xs text-amber-600">Cat.2 — Maneuvering</div>
          </div>
          <div className="p-3 rounded-lg border bg-red-50 border-red-200 text-center">
            <div className="text-xl font-bold text-red-700">{stats.cat3}</div>
            <div className="text-xs text-red-600">Cat.3 — Runway</div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : auths.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Car className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Nema izdatih dozvola.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {auths.map((auth: any) => {
            const today = new Date()
            const isExpired = auth.validUntil && new Date(auth.validUntil) < today
            const isExpiring = auth.validUntil && !isExpired && new Date(auth.validUntil) <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
            const trainingExpired = auth.trainingExpiry && new Date(auth.trainingExpiry) < today

            return (
              <Card key={auth.id} className={'p-4 ' + (!auth.active ? 'opacity-60' : '') + (isExpired ? ' border-red-300 bg-red-50' : isExpiring ? ' border-amber-300 bg-amber-50' : '')}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className="font-mono text-xs">{auth.employeeCardId}</Badge>
                      <span className="font-medium text-sm">{auth.employeeName}</span>
                      {auth.active ? <Badge className="bg-emerald-100 text-emerald-800 text-xs"><Unlock className="h-3 w-3 mr-0.5" />Aktivan</Badge> : <Badge className="bg-red-100 text-red-800 text-xs"><Lock className="h-3 w-3 mr-0.5" />Suspendovan</Badge>}
                    </div>
                    {/* Categories */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge className={auth.category1 ? 'bg-blue-100 text-blue-800 text-xs' : 'bg-gray-100 text-gray-400 text-xs'}>Cat.1 Airside</Badge>
                      <Badge className={auth.category2 ? 'bg-amber-100 text-amber-800 text-xs' : 'bg-gray-100 text-gray-400 text-xs'}>Cat.2 Maneuvering</Badge>
                      <Badge className={auth.category3 ? 'bg-red-100 text-red-800 text-xs' : 'bg-gray-100 text-gray-400 text-xs'}>Cat.3 Runway</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-3 flex-wrap">
                      {auth.licenseNumber && <span>Licenca: {auth.licenseNumber}</span>}
                      {auth.validUntil && <span className={'flex items-center gap-1 ' + (isExpired ? 'text-red-600 font-medium' : isExpiring ? 'text-amber-600 font-medium' : '')}>
                        <Clock className="h-3 w-3" />Važi do: {new Date(auth.validUntil).toLocaleDateString('hr-HR')}
                        {isExpired && ' (ISTEKLA)'}{isExpiring && ' (USKORO)'}
                      </span>}
                      {auth.trainingExpiry && <span className={trainingExpired ? 'text-red-600' : ''}>Obuka do: {new Date(auth.trainingExpiry).toLocaleDateString('hr-HR')}{trainingExpired && ' (ISTEKLA)'}</span>}
                    </div>
                    {auth.suspendReason && <div className="text-xs text-red-600 mt-1">Razlog suspenzije: {auth.suspendReason}</div>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setEditAuth(auth)}>Uredi</Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <AddAuthDialog open={showAdd} onOpenChange={setShowAdd} onAdded={load} />
      <EditAuthDialog auth={editAuth} onClose={() => setEditAuth(null)} onUpdated={load} />
    </div>
  )
}

function StatCard({ label, value, tone }: any) {
  const colors: any = { blue: 'bg-blue-50 border-blue-200 text-blue-900', red: 'bg-red-50 border-red-200 text-red-900', amber: 'bg-amber-50 border-amber-200 text-amber-900', emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900' }
  return <div className={'p-4 rounded-lg border ' + colors[tone]}><div className="text-2xl font-bold">{value}</div><div className="text-xs mt-0.5">{label}</div></div>
}

function AddAuthDialog({ open, onOpenChange, onAdded }: any) {
  const [cardId, setCardId] = useState('')
  const [name, setName] = useState('')
  const [cat1, setCat1] = useState(true)
  const [cat2, setCat2] = useState(false)
  const [cat3, setCat3] = useState(false)
  const [licenseNumber, setLicenseNumber] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [trainingExpiry, setTrainingExpiry] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        const res = await addDriverAuthorization({
          employeeCardId: cardId, employeeName: name, category1: cat1, category2: cat2, category3: cat3,
          licenseNumber: licenseNumber || undefined, validUntil: validUntil || undefined,
          trainingDate: trainingExpiry || undefined, trainingExpiry: trainingExpiry || undefined,
          issuedBy: 'Airport Authority',
        })
        if (res.ok) { toast.success('Dozvola izdata'); onOpenChange(false); onAdded(); setCardId(''); setName(''); setLicenseNumber(''); setValidUntil(''); setTrainingExpiry('') }
        else { toast.error(res.error ?? 'Greška') }
      } catch (e: any) { toast.error(e?.message ?? 'Greška') }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Car className="h-5 w-5" />Izdaj Driver Authorization</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Broj kartice *</Label><Input value={cardId} onChange={(e) => setCardId(e.target.value.toUpperCase())} placeholder="EMP-1001" className="font-mono" required /></div>
            <div className="space-y-1.5"><Label>Ime i prezime *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vukan Vojvodić" required /></div>
          </div>
          <div className="space-y-2">
            <Label>Kategorije dozvole</Label>
            <label className="flex items-center justify-between p-2 border rounded"><div><span className="text-sm font-medium">Cat.1 — Airside (apron, service roads)</span></div><Switch checked={cat1} onCheckedChange={setCat1} /></label>
            <label className="flex items-center justify-between p-2 border rounded"><div><span className="text-sm font-medium">Cat.2 — Maneuvering (taxiway)</span></div><Switch checked={cat2} onCheckedChange={setCat2} /></label>
            <label className="flex items-center justify-between p-2 border rounded"><div><span className="text-sm font-medium">Cat.3 — Runway (samo specijalno)</span></div><Switch checked={cat3} onCheckedChange={setCat3} /></label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Broj licence (ADP)</Label><Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="ADP-1001" /></div>
            <div className="space-y-1.5"><Label>Važi do</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Obuka ističe</Label><Input type="date" value={trainingExpiry} onChange={(e) => setTrainingExpiry(e.target.value)} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button><Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Izdaj</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditAuthDialog({ auth, onClose, onUpdated }: any) {
  const [cat1, setCat1] = useState(false)
  const [cat2, setCat2] = useState(false)
  const [cat3, setCat3] = useState(false)
  const [active, setActive] = useState(true)
  const [validUntil, setValidUntil] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (auth) { setCat1(auth.category1); setCat2(auth.category2); setCat3(auth.category3); setActive(auth.active); setValidUntil(auth.validUntil ? new Date(auth.validUntil).toISOString().slice(0, 10) : '') }
  }, [auth])

  if (!auth) return null

  const handleSave = () => {
    startTransition(async () => {
      await updateDriverAuthorization({ id: auth.id, category1: cat1, category2: cat2, category3: cat3, active, validUntil })
      toast.success('Dozvola ažurirana'); onClose(); onUpdated()
    })
  }

  return (
    <Dialog open={!!auth} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Uredi dozvolu — {auth.employeeName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Kategorije</Label>
            <label className="flex items-center justify-between p-2 border rounded"><span className="text-sm">Cat.1 — Airside</span><Switch checked={cat1} onCheckedChange={setCat1} /></label>
            <label className="flex items-center justify-between p-2 border rounded"><span className="text-sm">Cat.2 — Maneuvering</span><Switch checked={cat2} onCheckedChange={setCat2} /></label>
            <label className="flex items-center justify-between p-2 border rounded"><span className="text-sm">Cat.3 — Runway</span><Switch checked={cat3} onCheckedChange={setCat3} /></label>
          </div>
          <div className="space-y-1.5"><Label>Važi do</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
          <label className="flex items-center justify-between p-2 border rounded"><span className="text-sm">Aktivan</span><Switch checked={active} onCheckedChange={setActive} /></label>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Zatvori</Button><Button onClick={handleSave} disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sačuvaj</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
