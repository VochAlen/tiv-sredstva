'use client'

// ADR.OPS.B.026 - Ovlaštenje vozila. Dijalog na sredstvu: zone, pozivni znak, radio/transponder, označavanje i svjetla,
// suspenzija / opoziv sa razlogom i istorija promjena.

import { useEffect, useState, useTransition } from 'react'
import { BadgeCheck, Loader2, FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { getVehicleAuthorisation, saveVehicleAuthorisation, setVehicleAuthStatus, type VehicleAuth } from '@/lib/actions-vehicle-auth'

const ACTION_LABEL: Record<string, string> = { ISSUED: 'Izdato', UPDATED: 'Izmijenjeno', SUSPENDED: 'Suspendovano', REVOKED: 'Opozvano', REINSTATED: 'Ponovo aktivno' }

function Check({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer min-h-[44px]">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 mt-0.5 flex-shrink-0" />
      <span className="text-sm"><span className="font-medium">{label}</span>{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span>
    </label>
  )
}

export function VehicleAuthDialog({ equipmentId, equipmentCode, equipmentName }: { equipmentId: string; equipmentCode: string; equipmentName: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [auth, setAuth] = useState<VehicleAuth | null>(null)
  const [f, setF] = useState({ areaApron: false, areaOther: false, areaManoeuvring: false, callSign: '', radioEquipped: false, transponderEquipped: false, markingOk: false, lightingOk: false, notes: '' })
  const [reason, setReason] = useState('')
  const [pending, start] = useTransition()

  const load = async () => {
    setLoading(true)
    try {
      const a = await getVehicleAuthorisation(equipmentId)
      setAuth(a)
      if (a) setF({ areaApron: a.areaApron, areaOther: a.areaOther, areaManoeuvring: a.areaManoeuvring, callSign: a.callSign, radioEquipped: a.radioEquipped, transponderEquipped: a.transponderEquipped, markingOk: a.markingOk, lightingOk: a.lightingOk, notes: a.notes })
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Greška pri učitavanju') }
    finally { setLoading(false) }
  }
  useEffect(() => { if (open) { setReason(''); load() } }, [open])

  const save = () => start(async () => {
    const r = await saveVehicleAuthorisation({ equipmentId, ...f })
    if (r.ok) { toast.success(auth ? 'Ovlaštenje izmijenjeno' : 'Ovlaštenje izdato'); load() } else toast.error(r.error ?? 'Greška')
  })
  const setStatus = (s: 'ACTIVE' | 'SUSPENDED' | 'REVOKED') => start(async () => {
    const r = await setVehicleAuthStatus(equipmentId, s, reason)
    if (r.ok) { toast.success(s === 'ACTIVE' ? 'Ovlaštenje ponovo aktivno' : s === 'SUSPENDED' ? 'Ovlaštenje suspendovano' : 'Ovlaštenje opozvano'); setReason(''); load() } else toast.error(r.error ?? 'Greška')
  })

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const status = auth?.status

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Ovlaštenje vozila (ADR.OPS.B.026)" aria-label={`Ovlaštenje vozila ${equipmentCode}`}>
          <BadgeCheck className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Ovlaštenje vozila — {equipmentCode}
            {status && <Badge className={status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>{status === 'ACTIVE' ? 'Važi' : status === 'SUSPENDED' ? 'Suspendovano' : 'Opozvano'}</Badge>}
          </DialogTitle>
          <DialogDescription>{equipmentName}. Vozilo smije voziti samo tamo gdje je ovlašteno (ADR.OPS.B.026).</DialogDescription>
        </DialogHeader>

        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
          <div className="space-y-4">
            {!auth && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Ovlaštenje još nije izdato. Popunite i pritisnite „Izdaj ovlaštenje“.</div>}
            {auth && status !== 'ACTIVE' && auth.reason && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">Razlog: {auth.reason}</div>}

            <div className="space-y-2">
              <Label className="text-base">Gdje smije voziti</Label>
              <Check id="va-apron" checked={f.areaApron} onChange={(v) => set('areaApron', v)} label="Stajanka" hint="Platforma i ostale operativne površine" />
              <Check id="va-other" checked={f.areaOther} onChange={(v) => set('areaOther', v)} label="Servisne i perimetarske ceste" hint="Parking opreme, ceste između terminala i stajanke" />
              <Check id="va-man" checked={f.areaManoeuvring} onChange={(v) => set('areaManoeuvring', v)} label="Manevarska površina" hint="Rulnice i PSS. Traži radio-vezu." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="va-call" className="text-base">Pozivni znak</Label>
              <Input id="va-call" className="h-12 text-lg" value={f.callSign} onChange={(e) => set('callSign', e.target.value)} placeholder="npr. TIVAT 3" />
            </div>

            <div className="space-y-2">
              <Label className="text-base">Oprema i oznake</Label>
              <Check id="va-radio" checked={f.radioEquipped} onChange={(v) => set('radioEquipped', v)} label="Ima radio-vezu" hint="Dvosmjerna veza sa ATS i ostalim jedinicama" />
              <Check id="va-trans" checked={f.transponderEquipped} onChange={(v) => set('transponderEquipped', v)} label="Ima transponder" hint="Ako je potreban za manevarsku površinu" />
              <Check id="va-mark" checked={f.markingOk} onChange={(v) => set('markingOk', v)} label="Označavanje u redu" hint="Uočljive boje ili zastavice (B.080)" />
              <Check id="va-light" checked={f.lightingOk} onChange={(v) => set('lightingOk', v)} label="Svjetla u redu" hint="Treba noću i pri slaboj vidljivosti. Samo stajanka može biti izuzeta." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="va-notes">Napomena (nije obavezno)</Label>
              <Input id="va-notes" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>

            <Button className="w-full h-12 text-base" disabled={pending} onClick={save}>
              {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}{auth ? 'Sačuvaj izmjene' : 'Izdaj ovlaštenje'}
            </Button>

            {auth && (
              <div className="rounded-lg border p-3 space-y-2">
                <Label htmlFor="va-reason">Suspenzija / opoziv (upišite razlog)</Label>
                <Input id="va-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="npr. neispravna svjetla" />
                <div className="flex gap-2 flex-wrap">
                  {status === 'ACTIVE' ? (
                    <>
                      <Button variant="outline" className="flex-1 h-11" disabled={pending} onClick={() => setStatus('SUSPENDED')}>Suspenduj</Button>
                      <Button variant="outline" className="flex-1 h-11 border-red-300 text-red-700" disabled={pending} onClick={() => setStatus('REVOKED')}>Opozovi</Button>
                    </>
                  ) : (
                    <Button className="flex-1 h-11" disabled={pending} onClick={() => setStatus('ACTIVE')}>Ponovo aktiviraj</Button>
                  )}
                </div>
              </div>
            )}

            {auth && auth.logs.length > 0 && (
              <div className="text-xs space-y-1">
                <div className="font-medium">Istorija</div>
                {auth.logs.map((l, i) => (
                  <div key={i} className="text-muted-foreground">{new Date(l.at).toLocaleString('hr-HR')} · {ACTION_LABEL[l.action] ?? l.action}{l.reason ? ` (${l.reason})` : ''}{l.byName ? ` · ${l.byName}` : ''}</div>
                ))}
              </div>
            )}

            <Button variant="outline" className="w-full h-11" onClick={() => window.open('/api/reports/vehicle-authorisations', '_blank')}>
              <FileDown className="h-4 w-4 mr-2" />Registar ovlaštenja vozila (PDF)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
