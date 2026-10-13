'use client'

// Stranice "Dnevna lista pregleda" i "Pregledi po datumima":
//  - lista svih sredstava za izabrani dan sa stanjem (kvačica / X) + PDF za štampu (A4, jedna strana)
//  - tabela po datumima: koliko je pregledano, ispravno, ispravno sa ograničenjem, neispravno

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, X, Square, FileDown, FileText, ChevronLeft, ChevronRight, ClipboardCheck, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { RestrictionBadges } from '@/components/restriction-badges'
import { DailyInspectionDialog } from '@/components/dashboard/daily-inspection-dialog'
import { getDailyListReport, getDailySummary, getInspectionLog, type InspectionLogRow, type DailyListReport, type DailyState, type DailySummaryRow } from '@/lib/actions-daily-report'
import { localDate } from '@/lib/local-day'

const PAGE = 20
const STATE_META: Record<DailyState, { label: string; cls: string }> = {
  OK: { label: 'Ispravno', cls: 'text-emerald-700' },
  LIMITED: { label: 'Ispravno sa ograničenjem', cls: 'text-amber-700' },
  FAULTY: { label: 'Neispravno', cls: 'text-red-700 font-semibold' },
  NOT_INSPECTED: { label: 'Nije pregledano', cls: 'text-muted-foreground' },
}

function StateIcon({ state }: { state: DailyState }) {
  if (state === 'OK') return <Check className="h-5 w-5 text-emerald-600" strokeWidth={3} aria-hidden />
  if (state === 'LIMITED') return <Check className="h-5 w-5 text-amber-500" strokeWidth={3} aria-hidden />
  if (state === 'FAULTY') return <X className="h-5 w-5 text-red-600" strokeWidth={3} aria-hidden />
  return <Square className="h-4 w-4 text-muted-foreground/60" aria-hidden />
}

const shiftDate = (date: string, delta: number) => localDate(new Date(Date.parse(`${date}T12:00:00Z`) + delta * 86400000))
const pretty = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`
const weekday = (date: string) => ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota'][new Date(`${date}T12:00:00Z`).getUTCDay()]

// =====================================================
// Dnevna lista
// =====================================================

export function DailyListView({ initialDate }: { initialDate?: string }) {
  const [date, setDate] = useState(initialDate ?? localDate(new Date()))
  const [report, setReport] = useState<DailyListReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | DailyState>('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [inspectOpen, setInspectOpen] = useState(false)

  useEffect(() => { if (initialDate) setDate(initialDate) }, [initialDate])

  const load = useCallback(() => {
    setLoading(true)
    getDailyListReport(date).then(setReport).catch(() => toast.error('Lista nije učitana')).finally(() => setLoading(false))
  }, [date])
  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [filter, search, date])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (report?.rows ?? [])
      .filter((r) => filter === 'ALL' || r.state === filter)
      .filter((r) => !q || `${r.code} ${r.name}`.toLowerCase().includes(q))
      // neispravni prvi, pa nepregledani, pa ostali
      .sort((a, b) => ['FAULTY', 'NOT_INSPECTED', 'LIMITED', 'OK'].indexOf(a.state) - ['FAULTY', 'NOT_INSPECTED', 'LIMITED', 'OK'].indexOf(b.state) || a.code.localeCompare(b.code))
  }, [report, filter, search])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const cur = Math.min(page, pages - 1)
  const c = report?.counts

  const chips: Array<{ key: 'ALL' | DailyState; label: string; n: number | undefined; cls: string }> = [
    { key: 'ALL', label: 'Sva', n: c?.total, cls: '' },
    { key: 'OK', label: 'Ispravno', n: c?.ok, cls: 'text-emerald-700' },
    { key: 'LIMITED', label: 'Sa ograničenjem', n: c?.limited, cls: 'text-amber-700' },
    { key: 'FAULTY', label: 'Neispravno', n: c?.faulty, cls: 'text-red-700' },
    { key: 'NOT_INSPECTED', label: 'Nije pregledano', n: c?.notInspected, cls: 'text-muted-foreground' },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            <ClipboardCheck className="h-4 w-4" />
            Dnevna lista pregleda — {pretty(date)} <span className="text-sm font-normal text-muted-foreground">({weekday(date)})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" aria-label="Prethodni dan" onClick={() => setDate(shiftDate(date, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Input type="date" className="w-40" value={date} max={localDate(new Date())} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <Button size="sm" variant="outline" aria-label="Sljedeći dan" disabled={date >= localDate(new Date())} onClick={() => setDate(shiftDate(date, 1))}><ChevronRight className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setDate(localDate(new Date()))}>Danas</Button>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setInspectOpen(true)}><ClipboardCheck className="h-4 w-4 mr-1" />Novi pregled</Button>
              <Button size="sm" onClick={() => window.open(`/api/reports/gse-daily-list?date=${date}`, '_blank')}><FileDown className="h-4 w-4 mr-1" />PDF za štampu (A4)</Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {chips.map((ch) => (
              <button
                key={ch.key} type="button" onClick={() => setFilter(ch.key)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${filter === ch.key ? 'border-primary bg-primary/10 font-semibold' : 'border-border'} ${ch.cls}`}
              >
                {ch.label} <span className="font-bold">{ch.n ?? '–'}</span>
              </button>
            ))}
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Šifra ili naziv…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {loading && !report ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6"><Loader2 className="h-4 w-4 animate-spin" />Učitavanje…</div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nema sredstava za ovaj filter.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Šifra</TableHead>
                      <TableHead>Sredstvo</TableHead>
                      <TableHead>Stanje</TableHead>
                      <TableHead>Pregledao/la</TableHead>
                      <TableHead>Vrijeme</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(cur * PAGE, cur * PAGE + PAGE).map((r) => (
                      <TableRow key={r.id} className={r.state === 'FAULTY' ? 'bg-red-50/60' : ''}>
                        <TableCell><StateIcon state={r.state} /></TableCell>
                        <TableCell><Badge variant="outline" className="font-mono text-xs">{r.code}</Badge></TableCell>
                        <TableCell className="text-sm">{r.name}</TableCell>
                        <TableCell>
                          <div className={`text-sm ${STATE_META[r.state].cls}`}>{STATE_META[r.state].label}</div>
                          <RestrictionBadges restrictions={r.restrictions} />
                        </TableCell>
                        <TableCell className="text-sm">{r.inspectorName ?? '—'}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {r.inspectedAt ? new Date(r.inspectedAt).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Podgorica' }) : '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.inspectedAt && (
                            <Button size="sm" variant="ghost" aria-label={`Pregled ${r.code} ${date}`} title="Izvještaj pregleda za ovaj dan (PDF)" onClick={() => window.open(`/api/reports/gse-inspection-report?code=${encodeURIComponent(r.code)}&date=${date}`, '_blank')}>
                              <ClipboardCheck className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" aria-label={`Karton ${r.code}`} title="Karton sredstva (PDF)" onClick={() => window.open(`/api/reports/gse-equipment-card?code=${encodeURIComponent(r.code)}`, '_blank')}>
                            <FileText className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pager cur={cur} pages={pages} total={rows.length} size={PAGE} onPage={setPage} />
            </>
          )}
        </CardContent>
      </Card>
      <DailyInspectionDialog open={inspectOpen} onOpenChange={setInspectOpen} onDone={load} />
    </div>
  )
}

// =====================================================
// Tabela po datumima
// =====================================================

export function DailyStatsView({ onPickDate }: { onPickDate: (date: string) => void }) {
  const [days, setDays] = useState(30)
  const [rows, setRows] = useState<DailySummaryRow[] | null>(null)
  const [page, setPage] = useState(0)
  const SIZE = 15

  useEffect(() => {
    setRows(null)
    getDailySummary(days).then((r) => { setRows(r); setPage(0) }).catch(() => toast.error('Pregled po datumima nije učitan'))
  }, [days])

  const pages = Math.max(1, Math.ceil((rows?.length ?? 0) / SIZE))
  const cur = Math.min(page, pages - 1)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pregledi po datumima</CardTitle>
        <p className="text-xs text-muted-foreground">
          Za svako sredstvo računa se zadnji pregled tog dana. „Ukupno“ je trenutni broj sredstava u evidenciji. Klik na red otvara listu tog dana.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          {[7, 14, 30, 90].map((n) => (
            <Button key={n} size="sm" variant={days === n ? 'default' : 'outline'} onClick={() => setDays(n)}>{n} dana</Button>
          ))}
        </div>
        {!rows ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6"><Loader2 className="h-4 w-4 animate-spin" />Učitavanje…</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Ukupno</TableHead>
                    <TableHead className="text-right">Pregledano</TableHead>
                    <TableHead className="text-right text-emerald-700">Ispravno</TableHead>
                    <TableHead className="text-right text-amber-700">Sa ograničenjem</TableHead>
                    <TableHead className="text-right text-red-700">Neispravno</TableHead>
                    <TableHead className="text-right">Nije pregledano</TableHead>
                    <TableHead className="min-w-[110px]">% pregledano</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(cur * SIZE, cur * SIZE + SIZE).map((r) => {
                    const pct = r.total ? Math.round((r.inspected / r.total) * 100) : 0
                    return (
                      <TableRow key={r.date} className="cursor-pointer hover:bg-muted/50" onClick={() => onPickDate(r.date)}>
                        <TableCell className="whitespace-nowrap font-medium">{pretty(r.date)} <span className="text-xs text-muted-foreground">{weekday(r.date).slice(0, 3)}</span></TableCell>
                        <TableCell className="text-right">{r.total}</TableCell>
                        <TableCell className="text-right font-semibold">{r.inspected}</TableCell>
                        <TableCell className="text-right text-emerald-700">{r.ok}</TableCell>
                        <TableCell className="text-right text-amber-700">{r.limited}</TableCell>
                        <TableCell className={`text-right ${r.faulty ? 'text-red-700 font-bold' : ''}`}>{r.faulty}</TableCell>
                        <TableCell className="text-right">{r.notInspected}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded bg-muted overflow-hidden"><div className={`h-full ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} /></div>
                            <span className="text-xs w-9 text-right">{pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" aria-label={`PDF ${r.date}`} onClick={(e) => { e.stopPropagation(); window.open(`/api/reports/gse-daily-list?date=${r.date}`, '_blank') }}>
                            <FileDown className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <Pager cur={cur} pages={pages} total={rows.length} size={SIZE} onPage={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Pager({ cur, pages, total, size, onPage }: { cur: number; pages: number; total: number; size: number; onPage: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between pt-1 text-sm">
      <span className="text-xs text-muted-foreground">{cur * size + 1}–{Math.min(total, (cur + 1) * size)} od {total}</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={cur === 0} onClick={() => onPage(cur - 1)} aria-label="Prethodna strana"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-xs">Strana {cur + 1} / {pages}</span>
        <Button size="sm" variant="outline" disabled={cur >= pages - 1} onClick={() => onPage(cur + 1)} aria-label="Sljedeća strana"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  )
}

// =====================================================
// Izvještaj po sredstvu (karton) - izbor sredstva i PDF
// =====================================================

interface EqLite { id: string; code: string; name: string; type: string; status: string }
const STATUS_TXT: Record<string, { t: string; cls: string }> = {
  AVAILABLE: { t: 'Dostupno', cls: 'text-emerald-700' },
  ASSIGNED: { t: 'Zaduženo', cls: 'text-amber-700' },
  OUT_OF_SERVICE: { t: 'Neispravno', cls: 'text-red-700 font-semibold' },
  MAINTENANCE: { t: 'Na održavanju', cls: 'text-purple-700' },
}

export function EquipmentReportView({ equipment }: { equipment: EqLite[] }) {
  const [search, setSearch] = useState('')
  const [days, setDays] = useState(30)
  const [day, setDay] = useState(localDate(new Date()))
  const [page, setPage] = useState(0)
  const SIZE = 15
  useEffect(() => { setPage(0) }, [search])
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return equipment.filter((e) => !q || `${e.code} ${e.name}`.toLowerCase().includes(q)).sort((a, b) => a.code.localeCompare(b.code))
  }, [equipment, search])
  const pages = Math.max(1, Math.ceil(rows.length / SIZE))
  const cur = Math.min(page, pages - 1)
  const open = (code: string) => window.open(`/api/reports/gse-equipment-card?code=${encodeURIComponent(code)}&days=${days}`, '_blank')
  const openDay = (code: string) => window.open(`/api/reports/gse-inspection-report?code=${encodeURIComponent(code)}&date=${day}`, '_blank')

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Izvještaj po sredstvu (karton ispravnosti)</CardTitle>
        <p className="text-xs text-muted-foreground">
          „Karton” = A4 sa stanjem, istorijom pregleda, kvarovima i održavanjem. „Pregled za dan” = sve stavke checkliste za izabrani datum, ko je pregledao i kada, sa poljem za zapažanja.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Šifra ili naziv…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <span className="text-sm text-muted-foreground">Period:</span>
          {[30, 60].map((n) => <Button key={n} size="sm" variant={days === n ? 'default' : 'outline'} onClick={() => setDays(n)}>{n} dana</Button>)}
          <span className="text-sm text-muted-foreground ml-2">Datum pregleda:</span>
          <Input type="date" className="w-40" value={day} max={localDate(new Date())} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Šifra</TableHead><TableHead>Sredstvo</TableHead><TableHead>Status</TableHead><TableHead className="w-56" /></TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(cur * SIZE, cur * SIZE + SIZE).map((e) => (
                <TableRow key={e.id}>
                  <TableCell><Badge variant="outline" className="font-mono text-xs">{e.code}</Badge></TableCell>
                  <TableCell className="text-sm">{e.name}</TableCell>
                  <TableCell className={`text-sm ${STATUS_TXT[e.status]?.cls ?? ''}`}>{STATUS_TXT[e.status]?.t ?? e.status}</TableCell>
                  <TableCell className="whitespace-nowrap space-x-1">
                    <Button size="sm" onClick={() => openDay(e.code)}><ClipboardCheck className="h-4 w-4 mr-1" />Pregled za dan</Button>
                    <Button size="sm" variant="outline" onClick={() => open(e.code)}><FileDown className="h-4 w-4 mr-1" />Karton</Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">Nema rezultata.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
        {rows.length > 0 && <Pager cur={cur} pages={pages} total={rows.length} size={SIZE} onPage={setPage} />}
      </CardContent>
    </Card>
  )
}

// =====================================================
// Evidencija SVIH dnevnih pregleda (tabela + PDF po pregledu)
// =====================================================

const RES_META: Record<string, { label: string; cls: string }> = {
  FIT: { label: 'Ispravno', cls: 'text-emerald-700' },
  CONDITIONAL: { label: 'Ispravno sa ograničenjem', cls: 'text-amber-700' },
  UNFIT: { label: 'Neispravno', cls: 'text-red-700 font-semibold' },
}
const SHIFT_TXT: Record<string, string> = { MORNING: 'Jutarnja', AFTERNOON: 'Popodnevna', NIGHT: 'Nocna' }

export function InspectionLogView() {
  const today = localDate(new Date())
  const [from, setFrom] = useState(shiftDate(today, -6))
  const [to, setTo] = useState(today)
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [result, setResult] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{ rows: InspectionLogRow[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const SIZE = 15

  useEffect(() => { const t = setTimeout(() => { setQ(search.trim()); setPage(0) }, 350); return () => clearTimeout(t) }, [search])
  useEffect(() => { setPage(0) }, [from, to, result])

  useEffect(() => {
    let alive = true
    setLoading(true)
    getInspectionLog({ from, to, search: q, result: result || undefined, page, pageSize: SIZE })
      .then((r) => { if (alive) setData(r) })
      .catch(() => toast.error('Evidencija nije učitana'))
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [from, to, q, result, page])

  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / SIZE))

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><ClipboardCheck className="h-4 w-4" />Evidencija dnevnih pregleda</CardTitle>
        <p className="text-xs text-muted-foreground">Svi pregledi (najnoviji prvi). Ikona PDF u redu otvara A4 izvještaj tog pregleda: sve stavke, ko je pregledao, datum i vrijeme, polje za zapažanja.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1"><div className="text-xs text-muted-foreground">Od</div><Input type="date" className="w-40" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></div>
          <div className="space-y-1"><div className="text-xs text-muted-foreground">Do</div><Input type="date" className="w-40" value={to} min={from} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} /></div>
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Sredstvo ili pregledao…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {([['', 'Svi'], ['FIT', 'Ispravno'], ['CONDITIONAL', 'Sa ogr.'], ['UNFIT', 'Neispravno']] as const).map(([k, l]) => (
            <Button key={k} size="sm" variant={result === k ? 'default' : 'outline'} onClick={() => setResult(k)}>{l}</Button>
          ))}
        </div>
        {loading && !data ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Učitavanje…</p>
        ) : (
          <>
            <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum i vrijeme</TableHead><TableHead>Sredstvo</TableHead><TableHead>Rezultat</TableHead>
                    <TableHead>Pregledao</TableHead><TableHead>Smjena</TableHead><TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.rows ?? []).map((r) => (
                    <TableRow key={r.id} className={r.result === 'UNFIT' ? 'bg-red-50/60' : ''}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {pretty(localDate(new Date(r.at)))} {new Date(r.at).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Podgorica' })}
                      </TableCell>
                      <TableCell className="text-sm"><Badge variant="outline" className="font-mono text-xs mr-1">{r.code}</Badge>{r.name}</TableCell>
                      <TableCell>
                        <div className={`text-sm ${RES_META[r.result]?.cls ?? ''}`}>{RES_META[r.result]?.label ?? r.result}</div>
                        {r.failed.length > 0 && <div className="text-xs text-muted-foreground">{r.failed.slice(0, 3).join(', ')}{r.failed.length > 3 ? ` +${r.failed.length - 3}` : ''}</div>}
                      </TableCell>
                      <TableCell className="text-sm">{r.inspector}</TableCell>
                      <TableCell className="text-xs">{r.shift ? SHIFT_TXT[r.shift] ?? r.shift : '—'}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" aria-label={`PDF pregleda ${r.code}`} title="PDF izvještaj pregleda" onClick={() => window.open(`/api/reports/gse-inspection-report?id=${encodeURIComponent(r.id)}`, '_blank')}>
                          <FileDown className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(data?.rows.length ?? 0) === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Nema pregleda za izabrani period.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            {total > 0 && <Pager cur={Math.min(page, pages - 1)} pages={pages} total={total} size={SIZE} onPage={setPage} />}
          </>
        )}
      </CardContent>
    </Card>
  )
}
