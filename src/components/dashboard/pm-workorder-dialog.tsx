'use client'

// PM radni nalog (IATA AHM 917 check sheet) - popunjavanje na tabletu: OK / NIJE OK / POPRAVLJENO / N/A po stavci.
// Tok: Servisni plan -> "PM radni nalog" (1) -> označi stavke -> "Zatvori nalog" (2-3).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Loader2, Save, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  openPmWorkOrder, getPmWorkOrder, listPmWorkOrders, savePmWorkOrder, completePmWorkOrder,
  type PmWorkOrderData,
} from '@/lib/actions-pm'
import { pmSectionsFor, requiredKeys, PM_KIND_LABEL, PM_ANSWER_LABEL, type PmAnswer, type PmItem, type PmKind } from '@/lib/pm-checklists'

type Hist = Awaited<ReturnType<typeof listPmWorkOrders>>
const ANS: PmAnswer[] = ['OK', 'NOT_OK', 'FIXED', 'NA']
const ANS_CLS: Record<PmAnswer, string> = {
  OK: 'bg-green-600 text-white border-green-600',
  NOT_OK: 'bg-red-600 text-white border-red-600',
  FIXED: 'bg-amber-500 text-white border-amber-500',
  NA: 'bg-slate-500 text-white border-slate-500',
}

export function PmWorkOrderDialog({ equipmentId, code, name, suggestedKind, onClose, onDone }: {
  equipmentId: string; code: string; name: string; suggestedKind: PmKind; onClose: () => void; onDone: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [hist, setHist] = useState<Hist>([])
  const [wo, setWo] = useState<PmWorkOrderData | null>(null)
  const [kind, setKind] = useState<PmKind>(suggestedKind)
  const [items, setItems] = useState<Record<string, PmItem>>({})
  const [excluded, setExcluded] = useState<string[]>([])
  const [f, setF] = useState({ lead: '', add: '', hours: '', km: '', work: '', parts: '', tire: '', comment: '' })
  const [rectified, setRectified] = useState<boolean | null>(null)
  const [serviceable, setServiceable] = useState<boolean | null>(null)

  const hydrate = useCallback((w: PmWorkOrderData) => {
    setWo(w)
    setKind(w.kind)
    setItems(Object.fromEntries(w.items.map((i) => [i.k, i])))
    setExcluded(w.excludedSections)
    setF({
      lead: w.leadMechanic ?? '', add: w.additionalMechanic ?? '', hours: w.meterHours != null ? String(w.meterHours) : '', km: w.meterKm != null ? String(w.meterKm) : '',
      work: w.hoursWorked != null ? String(w.hoursWorked) : '', parts: w.partsCost != null ? String(w.partsCost) : '', tire: w.tireCost != null ? String(w.tireCost) : '', comment: w.comment ?? '',
    })
    setRectified(w.defectsRectified)
    setServiceable(w.serviceable)
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const h = await listPmWorkOrders(equipmentId)
        if (!alive) return
        setHist(h)
        const open = h.find((x) => x.status === 'OPEN')
        if (open) { const w = await getPmWorkOrder(open.id); if (alive && w) hydrate(w) }
      } catch (e) { toast.error(e instanceof Error ? e.message : 'Greška pri učitavanju') }
      finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [equipmentId, hydrate])

  const sections = useMemo(() => (wo ? pmSectionsFor(wo.checklistType, kind) : []), [wo, kind])
  const need = useMemo(() => (wo ? requiredKeys(wo.checklistType, kind, excluded) : []), [wo, kind, excluded])
  const answered = need.filter((k) => items[k]).length
  const notOk = Object.values(items).filter((i) => i.s === 'NOT_OK').length
  const done = wo?.status === 'DONE'

  const open = async () => {
    setBusy(true)
    const r = await openPmWorkOrder(equipmentId, kind)
    setBusy(false)
    if (!r.ok || !r.wo) return toast.error(r.error ?? 'Nalog nije otvoren')
    hydrate(r.wo)
  }
  const payload = () => ({
    id: wo!.id, kind, items: Object.values(items), excludedSections: excluded,
    meterHours: f.hours, meterKm: f.km, leadMechanic: f.lead, additionalMechanic: f.add,
    hoursWorked: f.work, partsCost: f.parts, tireCost: f.tire, comment: f.comment,
    defectsRectified: rectified, serviceable,
  })
  const save = async () => {
    setBusy(true)
    const r = await savePmWorkOrder(payload())
    setBusy(false)
    if (r.ok) toast.success('Nacrt sačuvan'); else toast.error(r.error ?? 'Greška')
  }
  const complete = async () => {
    setBusy(true)
    const r = await completePmWorkOrder(payload())
    setBusy(false)
    if (!r.ok) return toast.error(r.error ?? 'Nalog nije zatvoren')
    toast.success('Nalog zatvoren, servis evidentiran')
    onDone()
  }
  const setAns = (k: string, s: PmAnswer) => setItems((p) => (p[k]?.s === s ? Object.fromEntries(Object.entries(p).filter(([x]) => x !== k)) : { ...p, [k]: { ...p[k], k, s } }))
  const allOk = (secId: string) => {
    const sec = sections.find((s) => s.id === secId)
    if (!sec) return
    setItems((p) => { const n = { ...p }; for (const t of sec.tasks) if (!n[t.key]) n[t.key] = { k: t.key, s: 'OK' }; return n })
  }
  const toggleSec = (id: string) => setExcluded((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const num = (k: keyof typeof f, label: string, ph = '') => (
    <div><Label className="text-xs">{label}</Label><Input inputMode="decimal" value={f[k]} placeholder={ph} disabled={done} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  )

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>PM radni nalog — {code}</DialogTitle>
          <DialogDescription>{name} · IATA AHM 917{wo ? ` · ${wo.no}` : ''}</DialogDescription>
        </DialogHeader>

        {loading ? <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div> : !wo ? (
          <div className="space-y-3">
            <p className="text-sm">Nema otvorenog naloga. Izaberite vrstu servisa:</p>
            <div className="grid grid-cols-2 gap-2">
              {(['MINOR', 'MAJOR'] as PmKind[]).map((k) => (
                <Button key={k} variant={kind === k ? 'default' : 'outline'} className="h-14" onClick={() => setKind(k)}>{PM_KIND_LABEL[k]}{k === suggestedKind ? ' ★' : ''}</Button>
              ))}
            </div>
            <Button className="w-full h-12" disabled={busy} onClick={open}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Otvori nalog</Button>
            {hist.length > 0 && (
              <div className="pt-2 space-y-1">
                <div className="text-xs text-muted-foreground">Raniji nalozi</div>
                {hist.map((h) => (
                  <a key={h.id} href={`/api/reports/pm-workorder?id=${h.id}`} target="_blank" rel="noreferrer" className="flex items-center justify-between text-sm border rounded px-2 py-1.5">
                    <span>{h.no} · {h.kind === 'MAJOR' ? 'Major' : 'Minor'} · {h.status === 'DONE' ? 'zatvoren' : 'otvoren'}</span><FileText className="h-4 w-4" />
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{PM_KIND_LABEL[kind]}</span>
              <span className={answered === need.length ? 'text-green-600' : 'text-muted-foreground'}>Popunjeno {answered}/{need.length}</span>
              {notOk > 0 && <span className="text-red-600">NIJE OK: {notOk}</span>}
              <Button size="sm" variant="outline" className="ml-auto" asChild><a href={`/api/reports/pm-workorder?id=${wo.id}`} target="_blank" rel="noreferrer"><FileText className="h-4 w-4 mr-1" />PDF</a></Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Glavni mehaničar *</Label><Input value={f.lead} disabled={done} onChange={(e) => setF({ ...f, lead: e.target.value })} /></div>
              <div><Label className="text-xs">Dodatni mehaničar</Label><Input value={f.add} disabled={done} onChange={(e) => setF({ ...f, add: e.target.value })} /></div>
              {num('hours', 'Brojač (sati)')}
              {num('km', 'Brojač (km)')}
            </div>

            {sections.map((sec) => {
              const ex = excluded.includes(sec.id)
              return (
                <div key={sec.id} className="border rounded-lg">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-t-lg">
                    <div className="font-medium text-sm flex-1">{sec.title}</div>
                    {!done && !ex && <Button size="sm" variant="ghost" onClick={() => allOk(sec.id)}>Sve OK</Button>}
                    {!done && <Button size="sm" variant={ex ? 'default' : 'ghost'} onClick={() => toggleSec(sec.id)}>{ex ? 'Ne važi ✓' : 'Ne važi'}</Button>}
                  </div>
                  {!ex && (
                    <div className="divide-y">
                      {sec.caution && <div className="px-3 py-1.5 text-xs font-medium text-red-600">{sec.caution}</div>}
                      {sec.tasks.map((t) => {
                        const it = items[t.key]
                        return (
                          <div key={t.key} className="px-3 py-2 space-y-1.5">
                            <div className="text-sm"><span className="text-muted-foreground mr-1">{t.no}.</span>{t.text}</div>
                            {t.note && <div className="text-xs text-muted-foreground">{t.note}</div>}
                            <div className="grid grid-cols-4 gap-1.5">
                              {ANS.map((a) => (
                                <Button key={a} type="button" size="sm" disabled={done} variant="outline" className={`h-10 text-xs ${it?.s === a ? ANS_CLS[a] : ''}`} onClick={() => setAns(t.key, a)}>{PM_ANSWER_LABEL[a]}</Button>
                              ))}
                            </div>
                            {it && (it.s === 'NOT_OK' || it.s === 'FIXED' || it.c) && (
                              <Input placeholder="Komentar" value={it.c ?? ''} disabled={done} maxLength={300} onChange={(e) => setItems((p) => ({ ...p, [t.key]: { ...p[t.key], c: e.target.value } }))} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            <div className="grid grid-cols-3 gap-2">
              {num('work', 'Ukupno sati rada')}
              {num('parts', 'Dijelovi (bez guma)')}
              {num('tire', 'Gume')}
            </div>
            <div><Label className="text-xs">Napomena</Label><Textarea rows={2} value={f.comment} disabled={done} maxLength={1000} onChange={(e) => setF({ ...f, comment: e.target.value })} /></div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Neočekivani kvarovi su:</div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" disabled={done} variant={rectified === true ? 'default' : 'outline'} onClick={() => setRectified(true)}>Otklonjeni</Button>
                <Button type="button" disabled={done} variant={rectified === false ? 'destructive' : 'outline'} onClick={() => setRectified(false)}>Nisu otklonjeni</Button>
              </div>
              <div className="text-sm font-medium">Po mom mišljenju sredstvo je:</div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" disabled={done} variant={serviceable === true ? 'default' : 'outline'} onClick={() => setServiceable(true)}>Ispravno</Button>
                <Button type="button" disabled={done} variant={serviceable === false ? 'destructive' : 'outline'} onClick={() => setServiceable(false)}>Neispravno</Button>
              </div>
            </div>
          </div>
        )}

        {wo && !done && (
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" disabled={busy} onClick={save}><Save className="h-4 w-4 mr-1" />Sačuvaj nacrt</Button>
            <Button disabled={busy} onClick={complete}>{busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}Zatvori nalog</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
