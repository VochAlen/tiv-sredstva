'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { CheckCircle2, XCircle, Loader2, Search, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { DAILY_INSPECTION_CHECKLIST } from '@/lib/constants-export'
import { getInspectableEquipment, startDailyInspection, type InspectableEquipment } from '@/lib/actions-daily-inspection'

type Answer = boolean | null

export function DailyInspectionDialog({
  open, onOpenChange, onDone, initialCode,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone: () => void
  initialCode?: string
}) {
  const [list, setList] = useState<InspectableEquipment[] | null>(null)
  const [selected, setSelected] = useState<InspectableEquipment | null>(null)
  const [search, setSearch] = useState('')
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setSelected(null); setSearch(''); setAnswers({}); setNotes('')
    setList(null)
    getInspectableEquipment()
      .then((l) => {
        setList(l)
        if (initialCode) setSelected(l.find((e) => e.code === initialCode) ?? null)
      })
      .catch(() => { setList([]); toast.error('Lista vozila nije učitana') })
  }, [open, initialCode])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (list ?? [])
      .filter((e) => !q || e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q))
      // neobavljeni pregledi prvi
      .sort((a, b) => Number(!!a.inspection) - Number(!!b.inspection))
  }, [list, search])

  const unanswered = DAILY_INSPECTION_CHECKLIST.filter((c) => answers[c.id] == null).length
  const setAll = (v: boolean) => setAnswers(Object.fromEntries(DAILY_INSPECTION_CHECKLIST.map((c) => [c.id, v])))

  const submit = () => {
    if (!selected) return
    if (unanswered > 0) { toast.error(`Odgovorite na sve stavke (${unanswered} preostalo)`); return }
    const failed = DAILY_INSPECTION_CHECKLIST.filter((c) => answers[c.id] === false).length
    if (failed > 0 && !notes.trim()) { toast.error('Upišite kratku napomenu šta nije u redu'); return }
    startTransition(async () => {
      const r = await startDailyInspection({
        equipmentCode: selected.code,
        checklist: DAILY_INSPECTION_CHECKLIST.map((c) => ({ id: c.id, label: c.label, passed: answers[c.id] === true })),
        notes: notes.trim() || undefined,
      })
      if (r.ok) {
        const extra = r.damageReports ? ` Prijava kvara poslata radionici (${r.damageReports}).` : ''
        if (r.result === 'UNFIT') toast.error(`Vozilo je NEISPRAVNO i van upotrebe.${extra}`)
        else if (r.result === 'CONDITIONAL' && r.restrictive) toast.warning(`Vozilo je ispravno SA OGRANIČENJEM — vidi oznaku na vozilu.${extra}`)
        else if (r.result === 'CONDITIONAL') toast.warning(`Pregled snimljen — manji nedostaci prijavljeni radionici.${extra}`)
        else toast.success('Pregled snimljen — vozilo ispravno')
        onOpenChange(false)
        onDone()
      } else toast.error(r.error ?? 'Greška pri snimanju')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dnevni pregled vozila</DialogTitle>
          <DialogDescription>
            {selected ? <span className="font-mono">{selected.code} — {selected.name}</span> : 'Izaberite vozilo'}
          </DialogDescription>
        </DialogHeader>

        {list === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6"><Loader2 className="h-4 w-4 animate-spin" />Učitavam…</div>
        ) : !selected ? (
          <div className="space-y-2">
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                Nemate autorizaciju ni za jedno vozilo (potrebna je važeća airside dozvola i kvalifikacija za tip opreme). Obratite se šefu službe.
              </p>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Šifra ili naziv…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                  {filtered.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setSelected(e)}
                      className="w-full text-left rounded-lg border p-3 min-h-14 flex items-center justify-between gap-2 active:bg-muted"
                    >
                      <span className="min-w-0">
                        <span className="font-mono text-xs font-semibold">{e.code}</span>
                        <span className="block text-sm truncate">{e.name}</span>
                      </span>
                      {e.status === 'OUT_OF_SERVICE' ? (
                        <span className="text-xs font-bold text-red-700 flex-shrink-0">NEISPRAVNO</span>
                      ) : e.inspection ? (
                        <span className="text-xs text-emerald-700 flex items-center gap-1 flex-shrink-0"><CheckCircle2 className="h-3.5 w-3.5" />danas</span>
                      ) : (
                        <span className="text-xs text-amber-700 flex-shrink-0">nije pregledano</span>
                      )}
                    </button>
                  ))}
                  {filtered.length === 0 && <p className="text-sm text-muted-foreground py-2">Nema rezultata.</p>}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}><ArrowLeft className="h-4 w-4 mr-1" />Druga vozila</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setAll(true)}><CheckCircle2 className="h-4 w-4 mr-1" />Sve ispravno</Button>
            </div>
            {selected.inspection && (
              <p className="text-xs text-amber-700">Ovo vozilo je danas već pregledano ({selected.inspection.inspectorName}). Novi pregled se dodaje uz postojeći.</p>
            )}
            <div className="space-y-1.5">
              {DAILY_INSPECTION_CHECKLIST.map((c) => (
                <div key={c.id} className={`rounded-lg border p-2.5 ${answers[c.id] === false ? (c.severity === 'BLOCKING' ? 'border-red-300 bg-red-50' : c.severity === 'RESTRICTIVE' ? 'border-amber-300 bg-amber-50' : 'border-yellow-200 bg-yellow-50') : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">{c.label}</span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button type="button" aria-label="Ispravno" onClick={() => setAnswers((a) => ({ ...a, [c.id]: true }))}
                      className={`h-10 w-10 rounded-md border-2 flex items-center justify-center ${answers[c.id] === true ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-border text-muted-foreground'}`}>
                      <CheckCircle2 className="h-5 w-5" />
                    </button>
                    <button type="button" aria-label="Neispravno" onClick={() => setAnswers((a) => ({ ...a, [c.id]: false }))}
                      className={`h-10 w-10 rounded-md border-2 flex items-center justify-center ${answers[c.id] === false ? 'border-red-600 bg-red-50 text-red-700' : 'border-border text-muted-foreground'}`}>
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                  </div>
                  {answers[c.id] === false && (
                    <p className={`mt-1.5 text-xs font-medium ${c.severity === 'BLOCKING' ? 'text-red-700' : c.severity === 'RESTRICTIVE' ? 'text-amber-800' : 'text-yellow-800'}`}>
                      {c.severity === 'BLOCKING' && 'Vozilo će biti označeno kao NEISPRAVNO (van upotrebe) i prijava kvara ide radionici.'}
                      {c.severity === 'RESTRICTIVE' && `Vozilo ostaje ispravno SA OGRANIČENJEM: ${c.restrictionLabel}. Prijava kvara ide radionici.`}
                      {c.severity === 'MINOR' && 'Manji nedostatak — prijava ide radionici, vozilo ostaje u upotrebi.'}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Napomena (obavezna ako nešto nije u redu)" />
            <Button className="w-full" size="lg" onClick={submit} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Snimi pregled
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
