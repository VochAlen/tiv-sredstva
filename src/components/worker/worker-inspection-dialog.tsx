'use client'

import { useEffect, useState, useTransition } from 'react'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { DAILY_INSPECTION_CHECKLIST } from '@/lib/constants-export'
import { workerDailyInspection } from '@/lib/actions-worker-inspection'
import { useTx } from '@/lib/worker-en'

type Answer = boolean | null

/**
 * Dnevni pregled sredstva iz radničkog toka. Radnik je već identifikovan ID karticom
 * (ista kartica kao pri zaduživanju); server ponovo provjerava ovlaštenje.
 */
export function WorkerInspectionDialog({
  open, onOpenChange, equipmentCode, equipmentName, cardId, onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  equipmentCode: string
  equipmentName: string
  cardId: string
  /** result: FIT | CONDITIONAL | UNFIT */
  onDone: (result: string) => void
}) {
  const tx = useTx()
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (open) { setAnswers({}); setNotes(''); setError(null) }
  }, [open, equipmentCode])

  const unanswered = DAILY_INSPECTION_CHECKLIST.filter((c) => answers[c.id] == null).length
  const failed = DAILY_INSPECTION_CHECKLIST.filter((c) => answers[c.id] === false).length
  const setAll = () => setAnswers(Object.fromEntries(DAILY_INSPECTION_CHECKLIST.map((c) => [c.id, true])))

  const submit = () => {
    setError(null)
    if (unanswered > 0) { toast.error(tx('Odgovorite na sve stavke ({n} preostalo)', { n: unanswered })); return }
    if (failed > 0 && !notes.trim()) { toast.error(tx('Upišite kratku napomenu šta nije u redu')); return }
    startTransition(async () => {
      try {
        const r = await workerDailyInspection({
          equipmentCode,
          cardId,
          checklist: DAILY_INSPECTION_CHECKLIST.map((c) => ({ id: c.id, label: c.label, passed: answers[c.id] === true })),
          notes: notes.trim() || undefined,
        })
        if (!r.ok) { setError(r.error ?? tx('Pregled nije snimljen')); return }
        if (r.result === 'UNFIT') toast.error(tx('Sredstvo je NEISPRAVNO i van upotrebe. Prijava kvara je poslata radionici.'))
        else if (r.result === 'CONDITIONAL') toast.warning(tx('Pregled snimljen — sredstvo se može zadužiti, nedostaci su prijavljeni radionici.'))
        else toast.success(tx('Pregled snimljen — sredstvo je ispravno'))
        onOpenChange(false)
        onDone(r.result ?? 'FIT')
      } catch {
        setError(tx('Nema veze sa serverom. Pregled nije snimljen — pokušajte ponovo kad se veza vrati.'))
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tx('Dnevni pregled sredstva')}</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{equipmentCode}</span> — {equipmentName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{tx('Za svaku stavku izaberite ispravno ili neispravno.')}</p>
            <Button type="button" variant="outline" size="sm" className="h-10 flex-shrink-0" onClick={setAll}>
              <CheckCircle2 className="h-4 w-4 mr-1" />{tx('Sve ispravno')}
            </Button>
          </div>

          <div className="space-y-1.5">
            {DAILY_INSPECTION_CHECKLIST.map((c) => (
              <div
                key={c.id}
                className={`rounded-lg border p-2.5 ${answers[c.id] === false ? (c.severity === 'BLOCKING' ? 'border-red-300 bg-red-50' : c.severity === 'RESTRICTIVE' ? 'border-amber-300 bg-amber-50' : 'border-yellow-200 bg-yellow-50') : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-foreground">{tx(c.label)}</span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      aria-label={tx('Označi ispravno')}
                      onClick={() => setAnswers((a) => ({ ...a, [c.id]: true }))}
                      className={`h-11 w-11 rounded-md border-2 flex items-center justify-center ${answers[c.id] === true ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-border text-muted-foreground'}`}
                    >
                      <CheckCircle2 className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      aria-label={tx('Označi neispravno')}
                      onClick={() => setAnswers((a) => ({ ...a, [c.id]: false }))}
                      className={`h-11 w-11 rounded-md border-2 flex items-center justify-center ${answers[c.id] === false ? 'border-red-600 bg-red-50 text-red-700' : 'border-border text-muted-foreground'}`}
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                {answers[c.id] === false && (
                  <p className={`mt-1.5 text-xs font-medium ${c.severity === 'BLOCKING' ? 'text-red-700' : c.severity === 'RESTRICTIVE' ? 'text-amber-800' : 'text-yellow-800'}`}>
                    {c.severity === 'BLOCKING' && tx('Sredstvo će biti označeno kao NEISPRAVNO (van upotrebe), a prijava kvara ide radionici.')}
                    {c.severity === 'RESTRICTIVE' && tx('Sredstvo ostaje ispravno SA OGRANIČENJEM. Prijava kvara ide radionici.')}
                    {c.severity === 'MINOR' && tx('Manji nedostatak — prijava ide radionici, sredstvo ostaje u upotrebi.')}
                  </p>
                )}
              </div>
            ))}
          </div>

          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={tx('Napomena (obavezna ako nešto nije u redu)')}
          />

          {error && (
            <div role="alert" className="rounded-lg border-2 border-red-500 bg-red-50 p-3 text-sm text-red-900">{error}</div>
          )}

          <Button className="w-full h-12 text-base" size="lg" onClick={submit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {tx('Snimi pregled')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
