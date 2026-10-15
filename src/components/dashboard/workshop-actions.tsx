'use client'

// Koraci radionice na kartici prijave kvara - namjerno veliki, jasni i sa što manje unosa (tablet).
//  1 Preuzmi prijavu  ->  2 Sredstvo doveženo  ->  3 Popravka završena  ->  4 Pregled šefa službe  ->  5 Preuzimanje iz radionice
// Status popravke se upisuje u bilo kom trenutku; svaka 3 dana bez promjene prikazuje se upozorenje i unos je obavezan.

import { useCallback, useEffect, useState, useTransition } from 'react'
import { AlertTriangle, Loader2, PackageCheck } from 'lucide-react'
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
      if (r.ok) { toast.success('Upisano: sredstvo je u radionici'); onOpenChange(false); setWho(''); onDone() } else toast.error(r.error ?? 'Greška')
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
            <Input autoFocus value={who} onChange={(e) => setWho(e.target.value)} placeholder="Ime i prezime" />
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
  const [pending, start] = useTransition()
  const warned = staleDays != null
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (warned && !seen) return toast.error('Potvrdite da ste vidjeli upozorenje')
    start(async () => {
      const r = await addWorkshopStatus({ damageId, text, warned })
      if (r.ok) { toast.success('Status upisan'); onOpenChange(false); setText(''); setSeen(false); onDone() } else toast.error(r.error ?? 'Greška')
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
            {STATUS_PRESETS.map((p) => (
              <Button key={p} type="button" size="sm" variant={text === p ? 'default' : 'outline'} className="h-9 text-xs" onClick={() => setText(p)}>{p}</Button>
            ))}
          </div>
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
  const [pending, start] = useTransition()
  useEffect(() => {
    if (!open) return
    setAt(localNow()); setResult(null); setNote('')
    setCost(damage.workCost != null ? String(damage.workCost) : ''); setHours(damage.workHours != null ? String(damage.workHours) : ''); setParts(damage.partsText ?? '')
  }, [open, damage.workCost, damage.workHours, damage.partsText])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!result) return toast.error('Izaberite rezultat pregleda: prošao / nije prošao')
    const iso = new Date(at).toISOString()
    start(async () => {
      if (result === 'OK') {
        const r = await approveRepair({
          damageId: damage.id, chiefName: chief, inspectedAt: iso,
          cost: cost.trim() ? Number(cost.replace(',', '.')) : undefined,
          durationHours: hours.trim() ? Number(hours.replace(',', '.')) : undefined,
          partsReplaced: parts.trim() || undefined,
        })
        if (r.ok) { toast.success('Pregled šefa upisan — sredstvo vraćeno u upotrebu'); onOpenChange(false); onDone() } else toast.error(r.error ?? 'Greška')
      } else {
        const r = await recordChiefFailed({ damageId: damage.id, chiefName: chief, inspectedAt: iso, note })
        if (r.ok) { toast.warning('Pregled nije prošao — prijava vraćena u popravku'); onOpenChange(false); onDone() } else toast.error(r.error ?? 'Greška')
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
            <Input value={chief} onChange={(e) => setChief(e.target.value)} placeholder="Ime i prezime" />
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
            <Button type="submit" disabled={pending || !result}>{pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Upiši pregled</Button>
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
              <span className="block text-xs text-muted-foreground">{r.byName}{r.warned ? ' · nakon upozorenja' : ''}</span>
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
    if (r.ok) { toast.success('Preuzimanje upisano'); await load(); onChanged?.() } else toast.error(r.error ?? 'Greška')
  }
  return (
    <div className="space-y-2 rounded-lg border-2 border-green-500 bg-green-50 p-3">
      <div className="flex items-center gap-2 font-semibold text-green-900"><PackageCheck className="h-5 w-5" />Popravljeno — čeka preuzimanje iz radionice ({rows.length})</div>
      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md bg-white p-2 text-sm">
          <div className="min-w-[10rem] flex-1">
            <div className="font-medium">{r.equipmentCode} — {r.equipmentName}</div>
            <div className="text-xs text-muted-foreground">Pregled šefa: {r.chiefName ?? '-'} {fmtDT(r.chiefInspectedAt)}</div>
          </div>
          <Input className="w-48" placeholder="Ko preuzima sredstvo" value={who[r.id] ?? ''} onChange={(e) => setWho({ ...who, [r.id]: e.target.value })} />
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
    ['Prijavljeno', !!d.createdAt],
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
