'use client'

// Servisni plan: redovni servis (km / radni sati / najviše 12 mjeseci), eksterni serviseri, evidencija servisa,
// podešavanje email adrese šefa tehničke službe (admin).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, CalendarClock, CheckCircle2, Loader2, Mail, Phone, Settings2, Wrench, AlertTriangle, History, Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  getServicePlan, getServiceHistory, saveServicePlanConfig, recordService, saveChiefEmails, sendTestEmail,
  type ServicePlanData, type ServiceRecordRow,
} from '@/lib/actions-service-plan'
import type { PlanRow } from '@/lib/service-plan-data'
import { PmWorkOrderDialog } from '@/components/dashboard/pm-workorder-dialog'
import { hasPmChecklist } from '@/lib/pm-checklists'
import { fmtDateBHS, STATUS_LABEL, PROGRAM_LABEL, PROGRAM_SHORT, KIND_LABEL, type ServiceStatus, type ServiceProgram, type ServiceKind } from '@/lib/service-plan'

const PAGE = 15
const STATUS_STYLE: Record<ServiceStatus, string> = {
  OVERDUE: 'bg-red-100 text-red-800 border-red-300',
  SOON: 'bg-amber-100 text-amber-800 border-amber-300',
  OK: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  NO_BASELINE: 'bg-slate-100 text-slate-700 border-slate-300',
}
const fmtNum = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString('hr-HR'))
const rank: Record<ServiceStatus, number> = { OVERDUE: 0, SOON: 1, NO_BASELINE: 2, OK: 3 }

function StatusBadge({ s }: { s: ServiceStatus }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[s]}`}>{STATUS_LABEL[s]}</span>
}

export function ServicePlanView() {
  const [data, setData] = useState<ServicePlanData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'ALL' | ServiceStatus | 'EXTERNAL'>('ALL')
  const [page, setPage] = useState(0)
  const [recordFor, setRecordFor] = useState<PlanRow | null>(null)
  const [pmFor, setPmFor] = useState<PlanRow | null>(null)
  const [planFor, setPlanFor] = useState<PlanRow | null>(null)
  const [history, setHistory] = useState<ServiceRecordRow[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getServicePlan()
      .then((d) => { setData(d); setError(null) })
      .catch((e) => setError(e?.message ?? 'Servisni plan nije učitan'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const loadHistory = () => {
    setHistoryLoading(true)
    getServiceHistory().then(setHistory).catch((e) => toast.error(e?.message ?? 'Istorija nije učitana')).finally(() => setHistoryLoading(false))
  }

  const rows = data?.rows ?? []
  const counts = useMemo(() => ({
    overdue: rows.filter((r) => r.result.status === 'OVERDUE').length,
    soon: rows.filter((r) => r.result.status === 'SOON').length,
    nobase: rows.filter((r) => r.result.status === 'NO_BASELINE').length,
    external: rows.filter((r) => r.external).length,
  }), [rows])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return rows
      .filter((r) => (filter === 'ALL' ? true : filter === 'EXTERNAL' ? r.external : r.result.status === filter))
      .filter((r) => !t || `${r.code} ${r.name} ${r.provider ?? ''}`.toLowerCase().includes(t))
      .sort((a, b) => rank[a.result.status] - rank[b.result.status] || (a.result.plannedDate ?? '9999').localeCompare(b.result.plannedDate ?? '9999') || a.code.localeCompare(b.code))
  }, [rows, q, filter])
  useEffect(() => { setPage(0) }, [q, filter])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const view = filtered.slice(page * PAGE, page * PAGE + PAGE)

  if (loading && !data) return <div className="flex items-center gap-2 text-sm text-muted-foreground p-6"><Loader2 className="h-4 w-4 animate-spin" />Učitavanje servisnog plana…</div>
  if (error) return <Card><CardContent className="p-6 text-sm text-red-700">{error}</CardContent></Card>
  if (!data) return null

  const kpi = (label: string, value: number, f: typeof filter, tone: string) => (
    <button key={label} onClick={() => setFilter(filter === f ? 'ALL' : f)} className={`rounded-lg border p-3 text-left transition ${filter === f ? 'ring-2 ring-primary' : ''}`}>
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </button>
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><CalendarClock className="h-5 w-5" />Servisni plan</h2>
        <p className="text-sm text-muted-foreground">Servis dospijeva čim nastupi bilo šta od: pređeni km, radni sati ili najviše 12 mjeseci od zadnjeg servisa. Plan se računa automatski.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpi('Dospjelo', counts.overdue, 'OVERDUE', 'text-red-700')}
        {kpi('Uskoro', counts.soon, 'SOON', 'text-amber-700')}
        {kpi('Bez početnog stanja', counts.nobase, 'NO_BASELINE', 'text-slate-700')}
        {kpi('Eksterni serviser', counts.external, 'EXTERNAL', 'text-blue-700')}
      </div>

      {counts.nobase > 0 && (
        <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm flex gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-slate-600 flex-shrink-0" />
          <span>{counts.nobase} sredstava nema upisan datum zadnjeg servisa pa im se rok ne može računati. {data.isAdmin ? 'Otvorite „Plan“ i upišite zadnji servis.' : 'Obratite se administratoru.'}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Traži sredstvo ili servisera…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        {filter !== 'ALL' && <Button variant="outline" size="sm" onClick={() => setFilter('ALL')}>Prikaži sve</Button>}
      </div>

      <div className="space-y-2">
        {view.length === 0 && <p className="text-sm text-muted-foreground p-4">Nema sredstava za izabrani filter.</p>}
        {view.map((r) => {
          const urgent = r.result.status === 'OVERDUE' || r.result.status === 'SOON'
          return (
            <Card key={r.id} className={r.result.status === 'OVERDUE' ? 'border-red-300' : ''}>
              <CardContent className="p-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{r.code} <span className="font-normal text-muted-foreground">— {r.name}</span></div>
                    <div className="text-xs mt-0.5">
                      {r.external
                        ? <span className="inline-flex items-center rounded bg-blue-100 text-blue-800 px-1.5 py-0.5 font-medium">Eksterni serviser: {r.provider ?? 'nije upisan'}</span>
                        : <span className="text-muted-foreground">Interno održavanje</span>}
                      <span className="ml-2 rounded bg-slate-100 text-slate-700 px-1.5 py-0.5">{PROGRAM_SHORT[r.program]}</span>
                    </div>
                  </div>
                  <StatusBadge s={r.result.status} />
                </div>

                <div className="grid sm:grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Zadnji servis</div>
                    {r.lastDate ? <div>{fmtDateBHS(r.lastDate)}<span className="text-xs text-muted-foreground"> · {fmtNum(r.lastKm)} km · {fmtNum(r.lastHours)} h</span></div> : <div className="text-muted-foreground">nije upisan</div>}
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs text-muted-foreground">Sljedeći servis{r.result.kind ? ` (${KIND_LABEL[r.result.kind].toLowerCase()})` : ''}{r.result.plannedDate ? ` — planirano oko ${fmtDateBHS(r.result.plannedDate)}` : ''}</div>
                    {r.result.criteria.length === 0 ? <div className="text-muted-foreground">—</div> : (
                      <ul className="space-y-0.5">
                        {r.result.criteria.map((c) => (
                          <li key={c.kind} className={c.status === 'OVERDUE' ? 'text-red-700 font-medium' : c.status === 'SOON' ? 'text-amber-700' : ''}>
                            {c.kind === 'DATE' ? 'Rok' : c.kind === 'KM' ? 'Km' : 'Sati'}: {c.text}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5">Trenutno: {fmtNum(r.totalKm)} km · {fmtNum(r.totalHours)} h</div>
                  </div>
                </div>

                {!r.external && hasPmChecklist(r.type) && (
                  <Button className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md ring-2 ring-blue-300" onClick={() => setPmFor(r)}>
                    <ClipboardCheck className="h-5 w-5 mr-2" />RADNI NALOG (PM check sheet) — {r.result.kind === 'MAJOR' ? 'Major' : 'Minor'}
                  </Button>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setRecordFor(r)}><Wrench className="h-4 w-4 mr-1" />Evidentiraj servis</Button>
                  {data.isAdmin && <Button size="sm" variant="outline" onClick={() => setPlanFor(r)}><Settings2 className="h-4 w-4 mr-1" />Plan</Button>}
                  {r.external && urgent && r.phone && <Button size="sm" variant="outline" asChild><a href={`tel:${r.phone}`}><Phone className="h-4 w-4 mr-1" />Pozovi</a></Button>}
                  {r.external && urgent && r.email && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={`mailto:${r.email}?subject=${encodeURIComponent(`Servis ${r.code} — ${r.name}`)}&body=${encodeURIComponent(`Poštovanje,\n\nzahtijevamo redovni servis sredstva ${r.code} (${r.name}).\n${r.result.summary}\n\nMolimo termin.`)}`}><Mail className="h-4 w-4 mr-1" />Email serviseru</a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Prethodna</Button>
          <span>{page + 1} / {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Sljedeća</Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2"><History className="h-4 w-4" />Istorija servisa</span>
            <Button size="sm" variant="outline" onClick={loadHistory} disabled={historyLoading}>{historyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : history ? 'Osvježi' : 'Prikaži'}</Button>
          </CardTitle>
        </CardHeader>
        {history && (
          <CardContent className="space-y-1 text-sm">
            {history.length === 0 && <p className="text-muted-foreground">Još nema evidentiranih servisa.</p>}
            {history.map((h) => (
              <div key={h.id} className="border-b last:border-0 py-1.5">
                <span className="font-medium">{h.equipmentCode}</span> · {fmtDateBHS(h.performedAt)} · {h.kind ? KIND_LABEL[h.kind] + ' · ' : ''}{h.performedBy === 'EXTERNAL' ? `eksterno${h.provider ? ` (${h.provider})` : ''}` : 'interno'}
                <span className="text-muted-foreground"> · {fmtNum(h.km)} km · {fmtNum(h.hours)} h{h.invoiceNo ? ` · račun ${h.invoiceNo}` : ''}{h.cost != null ? ` · ${h.cost} €` : ''}</span>
                {h.notes && <div className="text-xs text-muted-foreground">{h.notes}</div>}
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {data.isAdmin && <NotificationCard data={data} onSaved={load} />}

      {pmFor && <PmWorkOrderDialog equipmentId={pmFor.id} code={pmFor.code} name={pmFor.name} suggestedKind={pmFor.result.kind === 'MAJOR' ? 'MAJOR' : 'MINOR'} onClose={() => setPmFor(null)} onDone={() => { setPmFor(null); load(); if (history) loadHistory() }} />}
      {recordFor && <RecordDialog row={recordFor} today={data.today} onClose={() => setRecordFor(null)} onDone={() => { setRecordFor(null); load(); if (history) loadHistory() }} />}
      {planFor && <PlanDialog row={planFor} onClose={() => setPlanFor(null)} onDone={() => { setPlanFor(null); load() }} />}
    </div>
  )
}

function NotificationCard({ data, onSaved }: { data: ServicePlanData; onSaved: () => void }) {
  const [emails, setEmails] = useState(data.chiefEmails)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    const r = await saveChiefEmails(emails)
    setBusy(false)
    if (!r.ok) return toast.error(r.error ?? 'Nije snimljeno')
    setEmails(r.saved ?? '')
    toast.success('Email adrese snimljene')
    onSaved()
  }
  const test = async () => {
    setBusy(true)
    const r = await sendTestEmail()
    setBusy(false)
    if (r.ok) toast.success(`Probna poruka poslana: ${r.to?.join(', ')}`)
    else toast.error(r.error ?? 'Slanje nije uspjelo')
  }
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4" />Obavještenja šefu tehničke službe</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">Za sredstva na eksternom održavanju šalje se email čim je prijavljen kvar ili dnevni pregled označi sredstvo neispravnim/uslovnim. Svako jutro stiže i pregled servisa koji dospijevaju.</p>
        <div className="space-y-1">
          <Label htmlFor="chief-emails">Email adresa(e) šefa tehničke službe (više adresa razdvojite zarezom)</Label>
          <Input id="chief-emails" type="text" inputMode="email" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="sef.tehnicke@aerodrom.me" />
          {data.envChief && <p className="text-xs text-muted-foreground">Dodatno je postavljena adresa u TECH_CHIEF_EMAIL.</p>}
        </div>
        {!data.mail && (
          <div className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900 text-xs">
            Slanje emaila još nije podešeno na serveru. U Vercel postavite SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS i MAIL_FROM (ili RESEND_API_KEY i MAIL_FROM), pa redeploy.
          </div>
        )}
        {data.mail && <p className="text-xs text-emerald-700">Slanje emaila je podešeno ({data.mail === 'smtp' ? 'SMTP' : 'Resend'}).</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Snimi'}</Button>
          <Button size="sm" variant="outline" onClick={test} disabled={busy}><Send className="h-4 w-4 mr-1" />Pošalji probnu poruku</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function RecordDialog({ row, today, onClose, onDone }: { row: PlanRow; today: string; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(today)
  const [kind, setKind] = useState<ServiceKind>(row.result.kind ?? 'MINOR')
  const [km, setKm] = useState(String(Math.round(row.totalKm)))
  const [hours, setHours] = useState(String(Math.round(row.totalHours)))
  const [by, setBy] = useState<'INTERNAL' | 'EXTERNAL'>(row.external ? 'EXTERNAL' : 'INTERNAL')
  const [provider, setProvider] = useState(row.provider ?? '')
  const [invoice, setInvoice] = useState('')
  const [cost, setCost] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    const r = await recordService({ equipmentId: row.id, performedAt: date, kind, km, hours, performedBy: by, provider, invoiceNo: invoice, cost, notes })
    setBusy(false)
    if (!r.ok) return toast.error(r.error ?? 'Nije snimljeno')
    toast.success(`Servis evidentiran: ${row.code}`)
    onDone()
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Evidentiraj servis — {row.code}</DialogTitle>
          <DialogDescription>Nakon snimanja brojači plana kreću iz stanja upisanog ovdje. Major servis resetuje i minor i major interval.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={kind === 'MINOR' ? 'default' : 'outline'} onClick={() => setKind('MINOR')}>Minor (provjere)</Button>
            <Button type="button" size="sm" variant={kind === 'MAJOR' ? 'default' : 'outline'} onClick={() => setKind('MAJOR')}>Major (provjere + zamjene)</Button>
          </div>
          <div className="space-y-1"><Label>Datum servisa</Label><Input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Kilometri na servisu</Label><Input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} /></div>
            <div className="space-y-1"><Label>Radni sati na servisu</Label><Input inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={by === 'INTERNAL' ? 'default' : 'outline'} onClick={() => setBy('INTERNAL')}>Interni servis</Button>
            <Button type="button" size="sm" variant={by === 'EXTERNAL' ? 'default' : 'outline'} onClick={() => setBy('EXTERNAL')}>Eksterni serviser</Button>
          </div>
          {by === 'EXTERNAL' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Serviser</Label><Input value={provider} onChange={(e) => setProvider(e.target.value)} /></div>
              <div className="space-y-1"><Label>Broj računa</Label><Input value={invoice} onChange={(e) => setInvoice(e.target.value)} /></div>
            </div>
          )}
          <div className="space-y-1"><Label>Trošak (€, opciono)</Label><Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
          <div className="space-y-1"><Label>Napomena (šta je urađeno)</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Otkaži</Button>
          <Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-1" />Snimi servis</>}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const str = (v: number | null | undefined) => (v != null ? String(v) : '')

function PlanDialog({ row, onClose, onDone }: { row: PlanRow; onClose: () => void; onDone: () => void }) {
  const [ext, setExt] = useState(row.external)
  const [provider, setProvider] = useState(row.provider ?? '')
  const [phone, setPhone] = useState(row.phone ?? '')
  const [email, setEmail] = useState(row.email ?? '')
  const [program, setProgram] = useState<ServiceProgram>(row.program)
  const [ikm, setIkm] = useState(str(row.intervalKm))
  const [ih, setIh] = useState(str(row.intervalHours))
  const [im, setIm] = useState(row.programRaw === 'OEM' || row.intervalKm || row.intervalHours ? String(row.intervalMonths) : '')
  const [mm, setMm] = useState(str(row.majorMonths))
  const [mh, setMh] = useState(str(row.majorHours))
  const [mkm, setMkm] = useState(str(row.majorKm))
  const [note, setNote] = useState(row.variationNote ?? '')
  const [lastDate, setLastDate] = useState(row.lastDate ?? '')
  const [lkm, setLkm] = useState(str(row.lastKm))
  const [lh, setLh] = useState(str(row.lastHours))
  const [lmDate, setLmDate] = useState(row.lastMajorDate ?? '')
  const [lmkm, setLmkm] = useState(str(row.lastMajorKm))
  const [lmh, setLmh] = useState(str(row.lastMajorHours))
  const [applyType, setApplyType] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    const r = await saveServicePlanConfig({
      equipmentId: row.id, externallyMaintained: ext, provider, phone, email, program,
      intervalKm: ikm, intervalHours: ih, intervalMonths: im, majorMonths: mm, majorHours: mh, majorKm: mkm, variationNote: note,
      lastDate: lastDate || null, lastKm: lkm, lastHours: lh, lastMajorDate: lmDate || null, lastMajorKm: lmkm, lastMajorHours: lmh,
      applyProgramToType: applyType,
    })
    setBusy(false)
    if (!r.ok) return toast.error(r.error ?? 'Nije snimljeno')
    toast.success(r.applied ? `Plan snimljen (program primijenjen i na još ${r.applied} sredstava istog tipa)` : 'Plan snimljen')
    onDone()
  }
  const opt = (p: ServiceProgram, help: string) => (
    <button type="button" onClick={() => setProgram(p)} className={`w-full text-left rounded border p-2 ${program === p ? 'border-primary ring-1 ring-primary bg-primary/5' : ''}`}>
      <div className="text-sm font-medium">{PROGRAM_LABEL[p]}</div>
      <div className="text-xs text-muted-foreground">{help}</div>
    </button>
  )
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plan servisa — {row.code}</DialogTitle>
          <DialogDescription>{row.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded border p-2">
            <Label htmlFor="ext">Održava isključivo eksterni serviser</Label>
            <Switch id="ext" checked={ext} onCheckedChange={setExt} />
          </div>
          {ext && (
            <div className="space-y-2">
              <div className="space-y-1"><Label>Naziv servisera</Label><Input value={provider} onChange={(e) => setProvider(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label>Telefon</Label><Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                <div className="space-y-1"><Label>Email</Label><Input inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              </div>
            </div>
          )}

          <div className="border-t pt-3 space-y-2">
            <div className="text-sm font-medium">Program preventivnog održavanja (IATA AHM 917)</div>
            <p className="text-xs text-muted-foreground">Ako postoji program proizvođača (OEM), on ima prednost. Bez OEM podataka važe IATA preporučeni intervali. Servis dospijeva šta prije nastupi: mjeseci ili radni sati.</p>
            {opt('IATA_6M', 'Minor svakih 6 mj. / 750 h, major svakih 12 mj. / 1500 h (zamjena tečnosti i filtera).')}
            {opt('IATA_4M', 'Minor svakih 4 mj. / 500 h (dva puta), major svakih 12 mj. / 1500 h. Češće provjere.')}
            {opt('OEM', 'Unesite intervale iz uputstva proizvođača. Major je najmanje jednom godišnje.')}
          </div>

          {program === 'OEM' && (
            <div className="rounded border p-2 space-y-2">
              <div className="text-xs font-medium">Minor servis (provjere) — šta prije nastupi</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><Label>Mjeseci</Label><Input inputMode="numeric" placeholder="npr. 6" value={im} onChange={(e) => setIm(e.target.value)} /></div>
                <div className="space-y-1"><Label>Radni sati</Label><Input inputMode="decimal" placeholder="npr. 750" value={ih} onChange={(e) => setIh(e.target.value)} /></div>
                <div className="space-y-1"><Label>Kilometri</Label><Input inputMode="decimal" placeholder="npr. 10000" value={ikm} onChange={(e) => setIkm(e.target.value)} /></div>
              </div>
              <div className="text-xs font-medium">Major servis (zamjene) — prazno mjeseci = 12</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><Label>Mjeseci</Label><Input inputMode="numeric" placeholder="12" value={mm} onChange={(e) => setMm(e.target.value)} /></div>
                <div className="space-y-1"><Label>Radni sati</Label><Input inputMode="decimal" placeholder="npr. 1500" value={mh} onChange={(e) => setMh(e.target.value)} /></div>
                <div className="space-y-1"><Label>Kilometri</Label><Input inputMode="decimal" value={mkm} onChange={(e) => setMkm(e.target.value)} /></div>
              </div>
              <div className="space-y-1">
                <Label>Dogovorena varijacija od OEM (manje stroga, odobrena od proizvođača)</Label>
                <Textarea rows={2} placeholder="Opis i oznaka dokumenta u kojem je odobreno" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
          )}

          <div className="border-t pt-3 space-y-2">
            <div className="text-sm font-medium">Stanje pri zadnjem servisu (bilo kojem)</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1"><Label>Datum</Label><Input type="date" value={lastDate} onChange={(e) => setLastDate(e.target.value)} /></div>
              <div className="space-y-1"><Label>Km</Label><Input inputMode="decimal" value={lkm} onChange={(e) => setLkm(e.target.value)} /></div>
              <div className="space-y-1"><Label>Sati</Label><Input inputMode="decimal" value={lh} onChange={(e) => setLh(e.target.value)} /></div>
            </div>
            <div className="text-sm font-medium">Stanje pri zadnjem MAJOR servisu <span className="font-normal text-muted-foreground">(prazno = isto kao zadnji servis)</span></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1"><Label>Datum</Label><Input type="date" value={lmDate} onChange={(e) => setLmDate(e.target.value)} /></div>
              <div className="space-y-1"><Label>Km</Label><Input inputMode="decimal" value={lmkm} onChange={(e) => setLmkm(e.target.value)} /></div>
              <div className="space-y-1"><Label>Sati</Label><Input inputMode="decimal" value={lmh} onChange={(e) => setLmh(e.target.value)} /></div>
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={applyType} onChange={(e) => setApplyType(e.target.checked)} />
            <span>Primijeni izabrani program i intervale na <b>sva sredstva istog tipa</b> ({row.type}). Datumi servisa, serviser i varijacija se ne mijenjaju.</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Otkaži</Button>
          <Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Snimi plan'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
