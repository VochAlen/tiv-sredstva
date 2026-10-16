'use client'

// Koraci radionice na kartici prijave kvara - namjerno veliki, jasni i sa što manje unosa (tablet).
//  1 Preuzmi kvar  ->  2 Sredstvo doveženo  ->  3 Popravka završena  ->  4 Pregled šefa službe  ->  5 Preuzimanje iz radionice
// Status popravke se upisuje u bilo kom trenutku; svaka 3 dana bez promjene prikazuje se upozorenje i unos je obavezan.

import { PersonPicker } from './person-picker'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, PackageCheck, ShieldAlert, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { approveRepair } from '@/lib/actions'
import {
  markArrivedInWorkshop, addWorkshopStatus, recordChiefFailed, recordHandover, getPendingHandovers, getWorkshopLog,
  type PendingHandover, type WorkshopLogRow,
} from '@/lib/actions-workshop'
import {
  sendToExternalService, markExternalReturned, getReplacementOptions, type ReplacementOption,
} from '@/lib/actions-workshop-extras'
import { STATUS_PRESETS, fmtDT } from '@/lib/workshop'

/** Lokalno "YYYY-MM-DDTHH:mm" za <input type="datetime-local">. */
const localNow = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function StaleBanner({ days, onAct }: { days: number; onAct: () => void }) {
  return (
    <div role="alert" className="mt-2 flex items-center gap-2 rounded-md border-2 border-red-500 bg-red-100 p-2 text-sm font-semibold text-red-900">
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <span className="flex-1">Sredstvo je {days} dana bez popravke / promjene statusa. Obavezno upišite status.</span>
      <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={onAct}>Upiši status</Button>
    </div>
  )
}

export function ArrivedDialog({ damageId, code, open, onOpenChange, onDone }: { damageId: string; code: string; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [who, setWho] = useState('')
  const [pending, start] = useTransition()
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    start(async () => {
      const r = await markArrivedInWorkshop({ damageId, broughtBy: who })
      if (r.ok) { toast.success('Upisano: sredstvo je u radionici. Sljedeće: popravka, pa dugme „POPRAVKA ZAVRŠENA“.'); onOpenChange(false); setWho(''); onDone() } else toast.error(r.error ?? 'Greška')
    })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sredstvo doveženo u radionicu — {code}</DialogTitle>
          <DialogDescription>Datum i vrijeme dolaska upisuju se automatski.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Ko je dovezao sredstvo *</Label>
            <PersonPicker autoFocus storageKey="arrived" value={who} onChange={setWho} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Upiši dolazak</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function StatusDialog({ damageId, code, staleDays, open, onOpenChange, onDone }: { damageId: string; code: string; staleDays: number | null; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [text, setText] = useState('')
  const [seen, setSeen] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [until, setUntil] = useState('')
  const [pending, start] = useTransition()
  const warned = staleDays != null
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (warned && !seen) return toast.error('Potvrdite da ste vidjeli upozorenje')
    if (waiting && !until) return toast.error('Upišite očekivani datum dolaska dijela')
    start(async () => {
      const r = await addWorkshopStatus({ damageId, text, warned, waitingPartUntil: waiting ? until : null })
      if (r.ok) {
        toast.success(waiting ? `Čeka se dio. Upozorenje se ne pali do ${until.split('-').reverse().join('.')}.` : 'Status upisan. Sljedeće: nastavite popravku.')
        onOpenChange(false); setText(''); setSeen(false); setWaiting(false); setUntil(''); onDone()
      } else toast.error(r.error ?? 'Greška')
    })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Status popravke — {code}</DialogTitle>
          <DialogDescription>Upisuje se ko je i kada promijenio status.</DialogDescription>
        </DialogHeader>
        {warned && (
          <div className="rounded-md border-2 border-red-500 bg-red-50 p-2 text-sm text-red-900">
            <strong>UPOZORENJE:</strong> sredstvo je {staleDays} dana u radionici bez promjene statusa.
            <label className="mt-2 flex items-center gap-2 font-medium">
              <input type="checkbox" className="h-5 w-5" checked={seen} onChange={(e) => setSeen(e.target.checked)} />
              Vidio/la sam upozorenje
            </label>
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" variant={waiting ? 'default' : 'outline'} className={`h-11 text-sm font-semibold ${waiting ? 'bg-sky-600 hover:bg-sky-700 text-white' : 'border-sky-400 text-sky-800'}`}
              onClick={() => { const on = !waiting; setWaiting(on); if (on && !text.trim()) setText('Čeka se rezervni dio') }}>
              <Clock className="h-4 w-4 mr-1.5" />Čeka dio
            </Button>
            {STATUS_PRESETS.map((p) => (
              <Button key={p} type="button" variant={text === p ? 'default' : 'outline'} className="h-11 text-sm" onClick={() => setText(p)}>{p}</Button>
            ))}
          </div>
          {waiting && (
            <div className="space-y-1.5 rounded-md border border-sky-300 bg-sky-50 p-3">
              <Label>Očekivani dolazak dijela *</Label>
              <Input type="date" className="h-11" value={until} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setUntil(e.target.value)} />
              <p className="text-sm text-sky-900">Do tog datuma se ne pali crveno upozorenje „3 dana bez statusa“.</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Status *</Label>
            <Input value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder="Izaberite gore ili upišite svoj status" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Snimi status</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ChiefDialog({ damage, open, onOpenChange, onDone }: {
  damage: { id: string; equipmentCode: string; department?: string | null; workCost?: number | null; workHours?: number | null; partsText?: string; severity?: string }
  open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void
}) {
  const [chief, setChief] = useState('')
  const [at, setAt] = useState(localNow())
  const [result, setResult] = useState<'OK' | 'FAILED' | null>(null)
  const [note, setNote] = useState('')
  const [cost, setCost] = useState('')
  const [hours, setHours] = useState('')
  const [parts, setParts] = useState('')
  const [testOk, setTestOk] = useState(false)
  const [testNote, setTestNote] = useState('')
  const [pending, start] = useTransition()
  useEffect(() => {
    if (!open) return
    setAt(localNow()); setResult(null); setNote(''); setTestOk(false); setTestNote('')
    setCost(damage.workCost != null ? String(damage.workCost) : ''); setHours(damage.workHours != null ? String(damage.workHours) : ''); setParts(damage.partsText ?? '')
  }, [open, damage.workCost, damage.workHours, damage.partsText])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!result) return toast.error('Izaberite rezultat pregleda: prošao / nije prošao')
    if (result === 'OK' && !testOk) return toast.error('Potvrdite da je probni rad / funkcionalni test urađen')
    const iso = new Date(at).toISOString()
    start(async () => {
      if (result === 'OK') {
        const r = await approveRepair({
          damageId: damage.id, chiefName: chief, inspectedAt: iso,
          testDone: testOk, testNote: testNote.trim() || undefined,
          cost: cost.trim() ? Number(cost.replace(',', '.')) : undefined,
          durationHours: hours.trim() ? Number(hours.replace(',', '.')) : undefined,
          partsReplaced: parts.trim() || undefined,
        })
        if (r.ok) { toast.success('Pregled upisan. Sljedeće: upišite ko preuzima sredstvo iz radionice.'); onOpenChange(false); onDone() } else toast.error(r.error ?? 'Greška')
      } else {
        const r = await recordChiefFailed({ damageId: damage.id, chiefName: chief, inspectedAt: iso, note })
        if (r.ok) { toast.warning('Pregled nije prošao. Kvar je vraćen u popravku — nastavite sa popravkom.'); onOpenChange(false); onDone() } else toast.error(r.error ?? 'Greška')
      }
    })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pregled šefa službe — {damage.equipmentCode}</DialogTitle>
          <DialogDescription>
            Nazovite šefa službe{damage.department ? ` (${damage.department})` : ''} kojoj sredstvo pripada. Kad on pregleda vozilo, upišite njegovo ime i vrijeme pregleda.
            {(damage.severity === 'MAJOR' || damage.severity === 'CRITICAL') && ' Za ovu težinu kvara automatski se izdaje i Certificate of Release (EASA Part-145.A.50).'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Šef službe koji je pregledao vozilo *</Label>
            <PersonPicker storageKey="chief" value={chief} onChange={setChief} />
          </div>
          <div className="space-y-1.5">
            <Label>Datum i vrijeme pregleda *</Label>
            <Input type="datetime-local" value={at} max={localNow()} onChange={(e) => setAt(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" className={`h-14 text-base ${result === 'OK' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`} variant={result === 'OK' ? 'default' : 'outline'} onClick={() => setResult('OK')}>Pregled PROŠAO</Button>
            <Button type="button" className={`h-14 text-base ${result === 'FAILED' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`} variant={result === 'FAILED' ? 'default' : 'outline'} onClick={() => setResult('FAILED')}>NIJE prošao</Button>
          </div>
          {result === 'FAILED' && (
            <div className="space-y-1.5">
              <Label>Šta šef nije prihvatio *</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="npr. i dalje curi ulje" />
            </div>
          )}
          {result === 'OK' && (
            <div className="space-y-2 rounded-md border-2 border-green-500 bg-green-50 p-2">
              <label className="flex items-start gap-2 text-sm font-medium">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={testOk} onChange={(e) => setTestOk(e.target.checked)} />
                <span>Probni rad / funkcionalni test nakon popravke je urađen i zadovoljava *</span>
              </label>
              <Input value={testNote} maxLength={300} onChange={(e) => setTestNote(e.target.value)} placeholder="Šta je testirano (npr. probna vožnja 10 min, kočnice, svjetla)" />
            </div>
          )}
          {result === 'OK' && (
            <details className="rounded-md border p-2 text-sm">
              <summary className="cursor-pointer font-medium">Dodatno (trošak, sati, dijelovi) — nije obavezno</summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="space-y-1.5"><Label>Trošak (€)</Label><Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Trajanje (h)</Label><Input inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
              </div>
              <div className="mt-2 space-y-1.5"><Label>Zamijenjeni dijelovi</Label><Input value={parts} onChange={(e) => setParts(e.target.value)} /></div>
            </details>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={pending || !result || (result === 'OK' && !testOk)}>{pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Upiši pregled</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function WorkshopHistory({ damageId }: { damageId: string }) {
  const [rows, setRows] = useState<WorkshopLogRow[] | null>(null)
  useEffect(() => {
    let alive = true
    getWorkshopLog(damageId)
      .then((r) => { if (alive) setRows(r) })
      .catch(() => { toast.error('Istorija nije učitana'); if (alive) setRows([]) })
    return () => { alive = false }
  }, [damageId])
  if (rows === null) return <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Učitavam istoriju…</div>
  return (
    <div className="rounded-lg border bg-background p-2">
      <div className="mb-1 text-sm font-semibold">Istorija popravke (najnovije prvo)</div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Još nema upisa.</p>}
      <ol className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={r.id} className={`grid grid-cols-[7.5rem_1fr] gap-x-2 rounded-md px-2 py-1.5 text-sm ${i === 0 ? 'bg-blue-50' : ''}`}>
            <span className="font-semibold tabular-nums text-muted-foreground">{fmtDT(r.at)}</span>
            <span>
              {r.text ?? r.kind}
              <span className="block text-sm text-muted-foreground">{r.byName}{r.warned ? ' · nakon upozorenja' : ''}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Odobreno i spremno za predaju: upiši ko je preuzeo sredstvo iz radionice (vrijeme automatski). */
export function PendingHandoverList({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<PendingHandover[]>([])
  const [who, setWho] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const load = useCallback(async () => { try { setRows(await getPendingHandovers()) } catch { /* nema pristupa / migracija */ } }, [])
  useEffect(() => { load() }, [load])
  if (rows.length === 0) return null
  const save = async (id: string) => {
    setBusy(id)
    const r = await recordHandover({ damageId: id, takenBy: who[id] ?? '' })
    setBusy(null)
    if (r.ok) { toast.success('Preuzimanje upisano. Sredstvo je spremno za rad.'); await load(); onChanged?.() } else toast.error(r.error ?? 'Greška')
  }
  return (
    <div className="space-y-2 rounded-lg border-2 border-green-500 bg-green-50 p-3">
      <div className="flex items-center gap-2 font-semibold text-green-900"><PackageCheck className="h-5 w-5" />Popravljeno — čeka preuzimanje iz radionice ({rows.length})</div>
      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md bg-white p-2 text-sm">
          <div className="min-w-[10rem] flex-1">
            <div className="font-medium">{r.equipmentCode} — {r.equipmentName}</div>
            <div className="text-sm text-muted-foreground">Pregled šefa: {r.chiefName ?? '-'} {fmtDT(r.chiefInspectedAt)}</div>
          </div>
          <div className="w-full sm:w-64"><PersonPicker storageKey="handover" placeholder="Ko preuzima sredstvo" value={who[r.id] ?? ''} onChange={(v) => setWho({ ...who, [r.id]: v })} /></div>
          <Button size="sm" className="h-10 bg-green-600 hover:bg-green-700" disabled={busy === r.id} onClick={() => save(r.id)}>
            {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upiši preuzimanje'}
          </Button>
        </div>
      ))}
    </div>
  )
}


/** Pregled koraka na kartici: 1 prijavljeno, 2 preuzeto, 3 u radionici, 4 popravljeno, 5 pregled šefa, 6 preuzeto iz radionice. */
export function WorkshopStepper({ d }: { d: { createdAt?: unknown; acknowledgedAt?: unknown; workshopArrivedAt?: unknown; repairedAt?: unknown; chiefResult?: string | null; chiefInspectedAt?: unknown; handoverAt?: unknown; status?: string } }) {
  const chiefOk = d.chiefResult === 'OK' && !!d.chiefInspectedAt
  const steps: Array<[string, boolean]> = [
    ['Kvar prijavljen', !!d.createdAt],
    ['Preuzeto', !!d.acknowledgedAt],
    ['U radionici', !!d.workshopArrivedAt],
    ['Popravljeno', !!d.repairedAt && d.status !== 'IN_REPAIR'],
    ['Pregled šefa', chiefOk],
    ['Vraćeno', !!d.handoverAt],
  ]
  const next = steps.findIndex(([, done]) => !done)
  return (
    <ol className="mt-1.5 flex flex-wrap gap-1 text-[11px]" aria-label="Koraci popravke">
      {steps.map(([label, done], i) => (
        <li key={label} className={`rounded-full border px-2 py-0.5 ${done ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : i === next ? 'border-blue-500 bg-blue-50 font-semibold text-blue-800' : 'border-border text-muted-foreground'}`}>
          {done ? '✓ ' : `${i + 1}. `}{label}
        </li>
      ))}
    </ol>
  )
}


/** Sredstvo se šalje vanjskom servisu / izvođaču (garancija, specijalistički posao). Upisuje se u istoriju popravke. */
export function ExternalSendDialog({ damageId, code, defaultProvider, open, onOpenChange, onDone }: {
  damageId: string; code: string; defaultProvider?: string | null; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void
}) {
  const [provider, setProvider] = useState('')
  const [ref, setRef] = useState('')
  const [expected, setExpected] = useState('')
  const [pending, start] = useTransition()
  useEffect(() => { if (open) { setProvider(defaultProvider ?? ''); setRef(''); setExpected('') } }, [open, defaultProvider])
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    start(async () => {
      const r = await sendToExternalService({ damageId, provider, ref, expectedAt: expected || undefined })
      if (r.ok) { toast.success('Upisano: sredstvo je kod vanjskog servisa'); onOpenChange(false); onDone() } else toast.error(r.error ?? 'Greška')
    })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Poslano vanjskom servisu — {code}</DialogTitle>
          <DialogDescription>Datum slanja i ko je upisao bilježe se automatski. Ovo se računa kao novi status popravke.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Vanjski servis / izvođač *</Label>
            <Input autoFocus value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Naziv firme" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Broj naloga / ponude</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Očekivani povrat</Label><Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Upiši slanje</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ExternalReturnDialog({ damageId, code, provider, open, onOpenChange, onDone }: {
  damageId: string; code: string; provider?: string | null; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void
}) {
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()
  useEffect(() => { if (open) setNote('') }, [open])
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    start(async () => {
      const r = await markExternalReturned({ damageId, note })
      if (r.ok) { toast.success('Upisan povrat iz vanjskog servisa'); onOpenChange(false); onDone() } else toast.error(r.error ?? 'Greška')
    })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vraćeno iz vanjskog servisa — {code}</DialogTitle>
          <DialogDescription>{provider ? `Servis: ${provider}. ` : ''}Nakon povrata nastavlja se redovan tok: dolazak u radionicu, popravka završena, pregled šefa službe.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Broj računa / napomena</Label>
            <Input autoFocus value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="npr. račun 123/2026, zamijenjen kompresor" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Upiši povrat</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Garancija: ako je sredstvo pod garancijom, prije popravke treba kontaktirati servis / proizvođača da se garancija ne izgubi. */
export function WarrantyBanner({ expiry, provider, phone }: { expiry: Date | string | null | undefined; provider?: string | null; phone?: string | null }) {
  if (!expiry) return null
  const t = new Date(expiry)
  if (!Number.isFinite(t.getTime()) || t.getTime() < Date.now() - 86_400_000) return null
  return (
    <div role="note" className="mt-2 flex items-start gap-2 rounded-md border-2 border-sky-500 bg-sky-50 p-2 text-sm text-sky-900">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
      <span>
        <strong>Sredstvo je pod garancijom do {t.toLocaleDateString('hr-HR')}.</strong> Prije popravke u vlastitoj radionici kontaktirajte ovlašteni servis / proizvođača{provider ? ` (${provider}${phone ? `, ${phone}` : ''})` : ''} da se garancija ne izgubi.
      </span>
    </div>
  )
}

/** Dostupna sredstva istog tipa kao zamjena dok je ovo u radionici. Učitava se tek na klik (provjerava dnevni pregled svakog kandidata). */
export function ReplacementPanel({ equipmentId, equipmentCode }: { equipmentId: string; equipmentCode: string }) {
  const [data, setData] = useState<{ type: string; options: ReplacementOption[] } | null>(null)
  useEffect(() => {
    let alive = true
    getReplacementOptions(equipmentId)
      .then((r) => { if (alive) setData(r) })
      .catch(() => { toast.error('Zamjena nije učitana'); if (alive) setData({ type: '', options: [] }) })
    return () => { alive = false }
  }, [equipmentId])
  if (data === null) return <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Tražim zamjensko sredstvo…</div>
  return (
    <div className="rounded-lg border bg-background p-2">
      <div className="mb-1 text-sm font-semibold">Zamjena za {equipmentCode} (isti tip, trenutno dostupno)</div>
      {data.options.length === 0 && <p className="text-sm text-amber-800">Nema dostupnog sredstva istog tipa. Obavijestite operativu.</p>}
      <ul className="space-y-1">
        {data.options.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md px-2 py-1.5 text-sm odd:bg-muted/40">
            <span className="font-mono font-semibold">{o.code}</span>
            <span className="min-w-0 flex-1 truncate">{o.name}</span>
            <span className="text-sm text-muted-foreground">{o.location}</span>
            {o.inspectedToday
              ? <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />pregledano danas</span>
              : <span className="text-sm font-medium text-amber-700">nije pregledano danas</span>}
            {o.restrictions > 0 && <span className="text-sm text-orange-700">ima ograničenja ({o.restrictions})</span>}
            {o.restrictedAccess && <span className="text-sm text-muted-foreground">ograničen pristup</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}


/** Brzi izbori za "Šta je urađeno": dodir na dugme dopisuje rečenicu u polje (radnik ne mora kucati). */
export const QUICK_WORK = ['Zamijenjen dio', 'Podešeno', 'Očišćeno', 'Dopunjena tečnost', 'Zategnuto', 'Zamijenjena sijalica/osigurač', 'Testirano — radi ispravno'] as const

export function QuickWorkChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const add = (t: string) => {
    if (value.includes(t)) return
    onChange(value.trim() ? `${value.trim().replace(/[.,;]$/, '')}. ${t}` : t)
  }
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Brzi izbori">
      {QUICK_WORK.map((t) => (
        <Button key={t} type="button" variant={value.includes(t) ? 'default' : 'outline'} className="h-11 text-sm" onClick={() => add(t)}>{t}</Button>
      ))}
    </div>
  )
}
