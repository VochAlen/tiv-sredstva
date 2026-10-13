'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Loader2, Wrench, Pencil, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { CHECKLIST_CATEGORY_ORDER, CHECKLIST_CATEGORY_LABELS, EQUIPMENT_TYPE_LABELS } from '@/lib/types'
import { getAllMaintenanceSkills } from '@/lib/actions-maintenance-skills'
import { getQualifications } from '@/lib/actions-advanced'
import { setWorkerQualifications } from '@/lib/actions-admin-edit'

// Tipovi sredstava za koje se dodjeljuje kvalifikacija (isti skup kao na serveru)
const ALL_TYPES: Array<[string, string]> = [
  ['GPU', 'GPU'], ['AIR_STARTER', 'Air Starter'], ['TOW_TRACTOR', 'Tow Tractor'], ['BELT_LOADER', 'Belt Loader'],
  ['CARGO_LOADER', 'Cargo Loader'], ['STAIRS', 'Putničke stepenice'], ['WATER', 'Water Service'], ['LAVATORY', 'Lavatory Service'],
  ['PUSHBACK', 'Pushback'], ['FORKLIFT', 'Viljuškar'], ['DOLLY', 'Dolly'], ['BUS', 'Putnički bus'],
  ['FIRE_TRUCK', 'Vatrogasno vozilo'], ['AMBULANCE', 'Ambulantno vozilo'], ['FOLLOW_ME', 'Follow Me'], ['SERVICE_CAR', 'Servisno vozilo'],
  ['OTHER', 'Ostalo'],
]
const typeLabel = (t: string) => (EQUIPMENT_TYPE_LABELS as Record<string, string>)[t] ?? ALL_TYPES.find(([k]) => k === t)?.[1] ?? t

// Prisma vraća camelCase, Supabase snake_case — čitamo oba
const f = (s: any, camel: string, snake: string) => s?.[camel] ?? s?.[snake]
const dstr = (v: any) => (v ? String(v instanceof Date ? v.toISOString() : v).slice(0, 10) : '')

interface Worker {
  cardId: string
  name: string
  types: string[]
  cats: string[]
  validUntil: string // najranije isticanje (prikaz)
  expired: boolean
}

function buildWorkers(skills: any[], quals: any[]): Worker[] {
  const map = new Map<string, Worker>()
  const today = new Date().toISOString().slice(0, 10)
  const get = (card: string, name: string) => {
    let w = map.get(card)
    if (!w) { w = { cardId: card, name, types: [], cats: [], validUntil: '', expired: false }; map.set(card, w) }
    if (!w.name && name) w.name = name
    return w
  }
  const touch = (w: Worker, until: string) => {
    if (!until) return
    if (!w.validUntil || until < w.validUntil) w.validUntil = until
    if (until < today) w.expired = true
  }
  for (const s of skills) {
    const card = String(f(s, 'employeeCardId', 'employee_card_id') ?? '').toUpperCase()
    if (!card) continue
    const w = get(card, f(s, 'employeeName', 'employee_name') ?? '')
    w.cats.push(s.category)
    touch(w, dstr(f(s, 'validUntil', 'valid_until')))
  }
  for (const q of quals) {
    const card = String(f(q, 'employeeCardId', 'employee_card_id') ?? '').toUpperCase()
    if (!card) continue
    const w = get(card, f(q, 'employeeName', 'employee_name') ?? '')
    w.types.push(f(q, 'equipmentType', 'equipment_type'))
    touch(w, dstr(f(q, 'validUntil', 'valid_until')))
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function SkillsAdminView() {
  const [skills, setSkills] = useState<any[]>([])
  const [quals, setQuals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Worker | 'new' | null>(null)

  const load = () =>
    Promise.all([getAllMaintenanceSkills(), getQualifications()])
      .then(([s, q]) => { setSkills(s as any[]); setQuals(q as any[]) })
      .catch(() => toast.error('Kvalifikacije nisu učitane'))
      .finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const workers = useMemo(() => buildWorkers(skills, quals), [skills, quals])
  const shown = workers.filter((w) => !search.trim() || `${w.name} ${w.cardId}`.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4" />Kvalifikacije radionice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Za svakog radnika određujete (1) za koje tipove sredstava je kvalifikovan i (2) koje kategorije kvarova smije popravljati.
            Kliknite „Uredi“ pa označite tipove i kategorije.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Traži radnika ili karticu…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button onClick={() => setEditing('new')}><Plus className="h-4 w-4 mr-1" />Dodaj radnika</Button>
          </div>
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-muted-foreground">Učitavanje…</p>}
      {!loading && shown.length === 0 && (
        <p className="text-sm text-muted-foreground">Nema upisanih kvalifikacija — dok se ne upišu, niko ne može označiti popravku završenom.</p>
      )}

      {shown.map((w) => (
        <Card key={w.cardId}>
          <CardContent className="py-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{w.name || '—'} <span className="font-mono text-xs text-muted-foreground">{w.cardId}</span></div>
                {w.validUntil && (
                  <div className={`text-xs ${w.expired ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                    {w.expired ? 'Istekla kvalifikacija: ' : 'Najranije ističe: '}{w.validUntil}
                  </div>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditing(w)}><Pencil className="h-4 w-4 mr-1" />Uredi</Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {w.types.length === 0 && <span className="text-xs text-muted-foreground">Nema kvalifikacija za sredstva</span>}
              {w.types.map((t) => <Badge key={t} variant="secondary" className="text-xs">{typeLabel(t)}</Badge>)}
            </div>
            <div className="flex flex-wrap gap-1">
              {w.cats.length === 0 && <span className="text-xs text-muted-foreground">Ne smije potvrđivati popravke</span>}
              {w.cats.map((c) => (
                <Badge key={c} variant="outline" className="text-xs">
                  <Wrench className="h-3 w-3 mr-1" />{CHECKLIST_CATEGORY_LABELS[c as keyof typeof CHECKLIST_CATEGORY_LABELS] ?? c}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {editing && (
        <WorkerDialog
          worker={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function WorkerDialog({ worker, onClose, onSaved }: { worker: Worker | null; onClose: () => void; onSaved: () => void }) {
  const [cardId, setCardId] = useState(worker?.cardId ?? '')
  const [name, setName] = useState(worker?.name ?? '')
  const [types, setTypes] = useState<string[]>(worker?.types ?? [])
  const [cats, setCats] = useState<string[]>(worker?.cats ?? [])
  const [validUntil, setValidUntil] = useState(worker?.validUntil ?? '')
  const [pending, startTransition] = useTransition()
  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>, v: string) =>
    set((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))

  const save = () => {
    if (!cardId.trim() || !name.trim()) { toast.error('Unesite broj kartice i ime'); return }
    startTransition(async () => {
      try {
        const r = await setWorkerQualifications({
          employeeCardId: cardId, employeeName: name, equipmentTypes: types, categories: cats,
          // prazno polje kod postojećeg radnika = ukloni rok; kod novog = ne postavljaj
          validUntil: validUntil ? validUntil : worker ? null : undefined,
        })
        if (!r.ok) { toast.error(r.error ?? 'Greška pri snimanju'); return }
        toast.success('Kvalifikacije snimljene')
        onSaved()
      } catch (e: any) { toast.error(e?.message ?? 'Greška') }
    })
  }

  const chip = (on: boolean) =>
    `min-h-11 rounded-lg border-2 px-2 text-sm font-semibold text-left ${on ? 'border-primary bg-primary/10' : 'border-border'}`

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{worker ? `Uredi: ${worker.name}` : 'Dodaj radnika'}</DialogTitle>
          <DialogDescription>Označite sve što radnik smije. Skinuta oznaka briše tu kvalifikaciju.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1"><Label>Broj ID kartice</Label>
            <Input value={cardId} disabled={!!worker} onChange={(e) => setCardId(e.target.value.toUpperCase())} className="font-mono" /></div>
          <div className="space-y-1"><Label>Ime i prezime</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label>Važi do (opciono)</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
        </div>
        <div className="space-y-1">
          <Label>Smije rukovati sredstvima tipa</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ALL_TYPES.map(([k, l]) => (
              <button key={k} type="button" onClick={() => toggle(setTypes, k)} className={chip(types.includes(k))}>
                {types.includes(k) ? '✓ ' : ''}{l}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label>Smije popravljati kvarove kategorije</Label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {CHECKLIST_CATEGORY_ORDER.map((c) => (
              <button key={c} type="button" onClick={() => toggle(setCats, c)} className={chip(cats.includes(c))}>
                {cats.includes(c) ? '✓ ' : ''}{CHECKLIST_CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Otkaži</Button>
          <Button onClick={save} disabled={pending}>{pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Snimi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
