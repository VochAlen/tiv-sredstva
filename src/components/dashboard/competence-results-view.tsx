'use client'

// Pregled rezultata testova (provjera osposobljenosti): tabela svih pokušaja sa pretragom, filterima,
// sortiranjem i detaljima po pitanjima. Izvoz: CSV (lista) i PDF u formi mentorskog izvještaja (jedan pokušaj).

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Search, FileDown, FileText, Loader2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listCompetenceResults, getCompetenceResultDetail } from '@/lib/actions-competence'
import type { ResultFilters, ResultPage, ResultSort, AttemptDetail } from '@/lib/competence-results'

const KIND_LABEL: Record<string, string> = { INITIAL: 'Početna', RANDOM: 'Nasumična', PERIODIC: 'Periodična', RETEST: 'Ponovni test', SELF: 'Samostalno' }
const PAGE_SIZE = 25

const fmtDT = (iso: string) => new Intl.DateTimeFormat('sr-Latn-ME', { timeZone: 'Europe/Podgorica', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
const fmtD = (ymd: string) => new Intl.DateTimeFormat('sr-Latn-ME', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${ymd}T00:00:00Z`))

const COLS: { key: ResultSort | null; label: string; cls?: string }[] = [
  { key: 'taken_at', label: 'Datum i vrijeme' },
  { key: 'employee_name', label: 'Ime i prezime' },
  { key: 'employee_card_id', label: 'ID kartica' },
  { key: null, label: 'Služba', cls: 'hidden md:table-cell' },
  { key: 'kind', label: 'Vrsta', cls: 'hidden sm:table-cell' },
  { key: 'score_pct', label: 'Rezultat' },
  { key: 'passed', label: 'Ishod' },
]

export function CompetenceResultsView() {
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [outcome, setOutcome] = useState<'ALL' | 'PASSED' | 'FAILED'>('ALL')
  const [kind, setKind] = useState('')
  const [sort, setSort] = useState<ResultSort>('taken_at')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const [data, setData] = useState<ResultPage | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [detail, setDetail] = useState<AttemptDetail | null>(null)
  const [detailErr, setDetailErr] = useState('')
  const seq = useRef(0)

  const filters = useCallback((): ResultFilters => ({ q, department: dept, from: from || undefined, to: to || undefined, outcome, kind: kind || undefined, sort, dir }), [q, dept, from, to, outcome, kind, sort, dir])

  // Pretraga ima kratku odgodu (da se ne šalje upit na svako slovo); ostali filteri djeluju odmah.
  useEffect(() => {
    const my = ++seq.current
    const t = setTimeout(async () => {
      setLoading(true); setError('')
      try {
        const r = await listCompetenceResults({ ...filters(), page, pageSize: PAGE_SIZE })
        if (my === seq.current) setData(r)
      } catch (e) {
        if (my === seq.current) setError(e instanceof Error ? e.message : 'Greška pri učitavanju')
      } finally {
        if (my === seq.current) setLoading(false)
      }
    }, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [filters, page, q])

  const resetPage = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); setOpen(null) }
  const toggleSort = (k: ResultSort) => {
    if (sort === k) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(k); setDir(k === 'employee_name' || k === 'employee_card_id' ? 'asc' : 'desc') }
    setPage(1)
  }

  const showDetail = async (id: string) => {
    if (open === id) { setOpen(null); return }
    setOpen(id); setDetail(null); setDetailErr('')
    try { setDetail(await getCompetenceResultDetail(id)) } catch (e) { setDetailErr(e instanceof Error ? e.message : 'Greška') }
  }

  const qs = () => {
    const f = filters(); const p = new URLSearchParams()
    Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, String(v)) })
    return p.toString()
  }
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const hasFilters = !!(q || dept || from || to || outcome !== 'ALL' || kind)
  const clear = () => { setQ(''); setDept(''); setFrom(''); setTo(''); setOutcome('ALL'); setKind(''); setPage(1); setOpen(null) }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">Rezultati testova</h2>
          <p className="text-sm text-muted-foreground">Ko je radio provjeru znanja, kada, sa kojim rezultatom i na koja pitanja je pogrešno odgovorio.</p>
        </div>
        <Button variant="outline" className="h-11" disabled={!data || data.total === 0} onClick={() => window.open(`/api/reports/competence-results?${qs()}`, '_blank')}>
          <FileDown className="h-4 w-4 mr-2" />Izvezi CSV{data ? ` (${data.total})` : ''}
        </Button>
      </div>

      <div className="rounded-2xl border p-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="h-11 pl-9" placeholder="Pretraga po imenu i prezimenu ili broju ID kartice" value={q} onChange={(e) => resetPage(setQ)(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
          <select className="h-11 rounded-md border bg-background px-2 text-sm" value={dept} onChange={(e) => resetPage(setDept)(e.target.value)} aria-label="Služba">
            <option value="">Sve službe</option>
            {(data?.departments ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="h-11 rounded-md border bg-background px-2 text-sm" value={outcome} onChange={(e) => resetPage(setOutcome)(e.target.value as 'ALL' | 'PASSED' | 'FAILED')} aria-label="Ishod">
            <option value="ALL">Svi ishodi</option><option value="PASSED">Položili</option><option value="FAILED">Pali</option>
          </select>
          <select className="h-11 rounded-md border bg-background px-2 text-sm" value={kind} onChange={(e) => resetPage(setKind)(e.target.value)} aria-label="Vrsta provjere">
            <option value="">Sve vrste</option>
            {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <label className="text-xs text-muted-foreground flex items-center gap-1.5 col-span-1">Od<Input type="date" className="h-11" value={from} onChange={(e) => resetPage(setFrom)(e.target.value)} /></label>
          <label className="text-xs text-muted-foreground flex items-center gap-1.5 col-span-1">Do<Input type="date" className="h-11" value={to} onChange={(e) => resetPage(setTo)(e.target.value)} /></label>
          <Button variant="ghost" className="h-11" disabled={!hasFilters} onClick={clear}>Očisti filtere</Button>
        </div>
      </div>

      {error && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <div className="rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              {COLS.map((c) => (
                <th key={c.label} className={`px-3 py-2 font-medium whitespace-nowrap ${c.cls ?? ''}`}>
                  {c.key ? (
                    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(c.key as ResultSort)}>
                      {c.label}{sort === c.key && (dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </button>
                  ) : c.label}
                </th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {!data && loading && <tr><td colSpan={8} className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>}
            {data && data.rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nema rezultata za izabrane filtere.</td></tr>}
            {data?.rows.map((r) => (
              <Fragment key={r.id}>
                <tr className={`border-t cursor-pointer hover:bg-muted/40 ${open === r.id ? 'bg-muted/40' : ''}`} onClick={() => showDetail(r.id)}>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDT(r.takenAt)}</td>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.cardId}</td>
                  <td className="px-3 py-2 hidden md:table-cell">{r.department || '—'}</td>
                  <td className="px-3 py-2 hidden sm:table-cell">{KIND_LABEL[r.kind] ?? r.kind}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><b>{r.scorePct}%</b> <span className="text-xs text-muted-foreground">({r.right}/{r.total})</span></td>
                  <td className="px-3 py-2">
                    {r.passed
                      ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"><CheckCircle2 className="h-3 w-3" />Položio</span>
                      : <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-xs text-red-800"><XCircle className="h-3 w-3" />Pao{r.criticalFailed ? ' (sigurnosno)' : ''}</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">{open === r.id ? 'Sakrij' : 'Detalji'}</td>
                </tr>
                {open === r.id && (
                  <tr className="border-t bg-muted/20"><td colSpan={8} className="p-3 sm:p-4">
                    {detailErr ? <p className="text-sm text-red-700">{detailErr}</p> : !detail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Detail d={detail} />}
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">{(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} od {data.total}{loading && <Loader2 className="h-3.5 w-3.5 animate-spin inline ml-2" />}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-10" disabled={page <= 1} onClick={() => { setPage(page - 1); setOpen(null) }}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="px-2">{page} / {pages}</span>
            <Button variant="outline" size="sm" className="h-10" disabled={page >= pages} onClick={() => { setPage(page + 1); setOpen(null) }}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Detail({ d }: { d: AttemptDetail }) {
  const wrong = d.items.filter((i) => !i.ok).length
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="text-sm">
          <div><b>{d.name}</b> · {d.cardId}{d.department ? ` · ${d.department}` : ''}</div>
          <div className="text-xs text-muted-foreground">
            {fmtDT(d.takenAt)} · {KIND_LABEL[d.kind] ?? d.kind} · prag prolaza {d.passPct != null ? `${d.passPct}%` : 'nije snimljen'} · tačno {d.items.length - wrong}, pogrešno {wrong}
            {d.takenBy && d.takenBy !== 'SELF' ? ` · zadao: ${d.takenBy}` : ' · radnik sam (kartica)'}
          </div>
        </div>
        <Button className="h-11" onClick={() => window.open(`/api/reports/competence-attempt?id=${d.id}`, '_blank')}>
          <FileText className="h-4 w-4 mr-2" />PDF (mentorski izvještaj)
        </Button>
      </div>

      {!d.snapshot && <p className="text-xs rounded border border-amber-300 bg-amber-50 text-amber-900 p-2">Ovaj test je urađen prije snimanja pitanja. Tekst pitanja je pročitan iz banke pitanja i može se razlikovati ako je pitanje kasnije izmijenjeno.</p>}

      <ol className="space-y-2">
        {d.items.map((it) => (
          <li key={it.n} className={`rounded-lg border p-2.5 text-sm ${it.ok ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-300 bg-red-50/60'}`}>
            <div className="flex items-start gap-2">
              <span className="mt-0.5">{it.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{it.n}. {it.question || '(pitanje je obrisano)'}
                  {it.critical && <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700"><ShieldAlert className="h-3 w-3" />sigurnosno</span>}
                </div>
                {it.topic && <div className="text-xs text-muted-foreground">{it.topic}</div>}
                <ul className="mt-1 space-y-0.5 text-xs">
                  {it.options.map((o, i) => (
                    <li key={i} className={i === it.correct ? 'text-emerald-800 font-medium' : i === it.chosen ? 'text-red-700 font-medium' : 'text-muted-foreground'}>
                      {i === it.correct ? '✓ ' : i === it.chosen ? '✗ ' : '• '}{o}{i === it.chosen && ' ← odgovor radnika'}
                    </li>
                  ))}
                  {it.chosen < 0 && <li className="text-red-700 font-medium">Bez odgovora</li>}
                </ul>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {(!d.passed || d.kind === 'RETEST' || d.shifts.length > 0) && (
        <div className="rounded-lg border p-2.5 text-sm">
          <div className="font-medium">Nadzor mentora: {Math.min(d.shifts.length, d.supervisedRequired)}/{d.supervisedRequired} smjena</div>
          {d.shifts.length === 0 ? <p className="text-xs text-muted-foreground">Još nema upisanih nadziranih smjena.</p> : (
            <ul className="mt-1 text-xs space-y-0.5">{d.shifts.map((s, i) => <li key={i}>{fmtD(s.date)} · mentor {s.mentor}{s.equipment ? ` · ${s.equipment}` : ''}</li>)}</ul>
          )}
        </div>
      )}
    </div>
  )
}
