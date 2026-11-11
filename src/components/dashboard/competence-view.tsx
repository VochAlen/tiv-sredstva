'use client'

// Osposobljenost osoblja: ko je prošao provjeru znanja, kome je rok istekao, ko radi uz mentora.
// Šef/inženjer zadaje provjere i vidi rezultate; admin imenuje mentore. Rok, broj pitanja i banka pitanja su na posebnoj stranici „Postavke provjere“ (samo administrator).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { GraduationCap, ExternalLink, UserCheck, ClipboardCheck, History, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getCompetenceOverview, assignCompetenceTest, setCompetenceMentor, getCompetenceAttempts,
  type CompetenceOverview, type OverviewRow, type AttemptRow, type CompetenceState,
} from '@/lib/actions-competence'
import { COMPETENCE_RULES } from '@/lib/competence-logic'

type Filter = 'ALL' | CompetenceState | 'PENDING'

const STATE_META: Record<CompetenceState, { label: string; pill: string }> = {
  VALID: { label: 'Važi', pill: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  DUE: { label: 'Rok istekao', pill: 'bg-amber-100 text-amber-900 border-amber-300' },
  TRAINING: { label: 'Uz mentora', pill: 'bg-red-100 text-red-800 border-red-300' },
  NONE: { label: 'Nije testiran', pill: 'bg-slate-100 text-slate-700 border-slate-300' },
}
const KIND_LABEL: Record<string, string> = { INITIAL: 'Početna', RANDOM: 'Nasumična', PERIODIC: 'Periodična', RETEST: 'Ponovni test', SELF: 'Samostalno' }

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('sr-Latn-ME', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')

export function CompetenceView({ isAdmin }: { isAdmin: boolean }) {
  const [data, setData] = useState<CompetenceOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null)

  const load = useCallback(async () => {
    try { setData(await getCompetenceOverview()); setError(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'Greška pri čitanju') }
  }, [])
  useEffect(() => { void load() }, [load])

  const rows = useMemo(() => {
    const r = data?.rows ?? []
    if (filter === 'ALL') return r
    if (filter === 'PENDING') return r.filter((x) => x.pendingKind)
    return r.filter((x) => x.state === filter)
  }, [data, filter])

  const assign = async (row: OverviewRow) => {
    setBusy(row.cardId)
    const r = await assignCompetenceTest({ cardId: row.cardId })
    setBusy(null)
    if (r.ok) { toast.success(`Provjera zadana: ${row.name}. Rok ${COMPETENCE_RULES.pendingDueDays} dana.`); void load() } else toast.error(r.error ?? 'Greška')
  }
  const toggleMentor = async (row: OverviewRow) => {
    setBusy(row.cardId)
    const r = await setCompetenceMentor({ cardId: row.cardId, active: !row.isMentor })
    setBusy(null)
    if (r.ok) { toast.success(row.isMentor ? 'Mentor uklonjen' : `${row.name} je imenovan za mentora`); void load() } else toast.error(r.error ?? 'Greška')
  }
  const showHistory = async (row: OverviewRow) => {
    if (open === row.cardId) { setOpen(null); return }
    setOpen(row.cardId); setAttempts(null)
    try { setAttempts(await getCompetenceAttempts(row.cardId)) } catch (e) { toast.error(e instanceof Error ? e.message : 'Greška'); setOpen(null) }
  }
  if (error) return <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</div>
  if (!data) return <div className="p-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Učitavanje…</div>

  const c = data.counts
  const tiles: Array<{ key: Filter; label: string; n: number; tone: string }> = [
    { key: 'ALL', label: 'Svi radnici', n: c.total, tone: '' },
    { key: 'VALID', label: 'Važi', n: c.valid, tone: 'text-emerald-700' },
    { key: 'DUE', label: 'Rok istekao', n: c.due, tone: 'text-amber-700' },
    { key: 'TRAINING', label: 'Uz mentora', n: c.training, tone: 'text-red-700' },
    { key: 'NONE', label: 'Nije testiran', n: c.none, tone: 'text-slate-700' },
    { key: 'PENDING', label: 'Zadana provjera', n: c.pending, tone: 'text-blue-700' },
  ]

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><GraduationCap className="h-5 w-5" />Osposobljenost osoblja</h2>
          <p className="text-sm text-muted-foreground">Provjera znanja, rad uz mentora i periodične provjere (ADR.OR.D.017, ADR.OPS.B.024).</p>
        </div>
        <Button variant="outline" className="h-11" onClick={() => window.open('/provjera', '_blank')}>
          <ExternalLink className="h-4 w-4 mr-2" />Stranica za test
        </Button>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        <b>Pitanja su nacrt.</b> Napisana su iz uputstva za korištenje i moraju ih pregledati i odobriti odgovorni za obuku prije prve službene provjere.
        Rok, broj pitanja i prag prolaza podešava administrator. Jedan pogrešan odgovor na sigurnosno pitanje znači pad. Poslije pada radnik radi uz mentora {COMPETENCE_RULES.supervisedShiftsRequired} smjene, pa ponovo polaže.
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {tiles.map((t) => (
          <button key={t.key} type="button" onClick={() => setFilter(t.key)}
            className={`rounded-xl border p-3 text-left min-h-16 ${filter === t.key ? 'border-foreground ring-1 ring-foreground' : ''}`}>
            <div className={`text-2xl font-bold ${t.tone}`}>{t.n}</div>
            <div className="text-xs text-muted-foreground">{t.label}</div>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border divide-y">
        {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nema radnika u ovom pregledu.</p>}
        {rows.map((r) => (
          <div key={r.cardId} className="p-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{r.name}{r.isMentor && <span className="ml-2 text-xs rounded border border-blue-300 bg-blue-50 text-blue-800 px-1.5 py-0.5">mentor</span>}</div>
                <div className="text-xs text-muted-foreground">{r.cardId}{r.department ? ` · ${r.department}` : ''}</div>
              </div>
              <span className={`text-xs rounded-full border px-2 py-1 ${STATE_META[r.state].pill}`}>{STATE_META[r.state].label}</span>
              <div className="text-xs text-muted-foreground w-40">
                {r.lastPct != null ? <>Posljednji: <b className="text-foreground">{r.lastPct}%</b> {fmt(r.lastAt)}</> : 'Bez rezultata'}
                {r.state === 'VALID' && <div>Važi do {fmt(r.validUntil)}</div>}
                {r.state === 'TRAINING' && <div>Nadzirane smjene: {r.supervisedDone}/{r.supervisedRequired}</div>}
                {r.pendingKind && <div className="text-blue-700">Zadano: {KIND_LABEL[r.pendingKind] ?? r.pendingKind}{r.pendingDue ? `, do ${fmt(r.pendingDue)}` : ''}</div>}
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="h-10" disabled={busy === r.cardId || r.state === 'TRAINING' || !!r.pendingKind} onClick={() => assign(r)} title="Zadaj provjeru">
                  <ClipboardCheck className="h-4 w-4" /><span className="ml-1 hidden sm:inline">Zadaj</span>
                </Button>
                {isAdmin && (
                  <Button size="sm" variant={r.isMentor ? 'default' : 'outline'} className="h-10" disabled={busy === r.cardId} onClick={() => toggleMentor(r)} title="Mentor">
                    <UserCheck className="h-4 w-4" /><span className="ml-1 hidden sm:inline">Mentor</span>
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-10" onClick={() => showHistory(r)} title="Istorija"><History className="h-4 w-4" /></Button>
              </div>
            </div>
            {open === r.cardId && (
              <div className="mt-2 rounded-lg bg-muted/50 p-2 text-sm">
                {!attempts ? <Loader2 className="h-4 w-4 animate-spin" /> : attempts.length === 0 ? 'Nema pokušaja.' : (
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-muted-foreground"><th className="py-1">Datum</th><th>Vrsta</th><th>Rezultat</th><th>Ishod</th></tr></thead>
                    <tbody>{attempts.map((a, i) => (
                      <tr key={i} className="border-t"><td className="py-1">{fmt(a.takenAt)}</td><td>{KIND_LABEL[a.kind] ?? a.kind}</td><td>{a.scorePct}%</td>
                        <td>{a.passed ? 'Položio' : a.criticalFailed ? 'Pad (sigurnosno pitanje)' : 'Pad'}</td></tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="rounded-2xl border p-4 space-y-2">
          <h3 className="font-semibold">Mentori ({data.mentors.filter((m) => m.active).length})</h3>
          <p className="text-xs text-muted-foreground">Mentor potvrđuje smjene radnika koji je pao na provjeri (unosi svoju karticu pri zaduživanju). Imenuje se dugmetom „Mentor“ u listi gore.</p>
          <div className="flex flex-wrap gap-2">
            {data.mentors.filter((m) => m.active).map((m) => <span key={m.cardId} className="text-sm rounded-lg border bg-blue-50 border-blue-200 px-2 py-1">{m.name}</span>)}
            {data.mentors.filter((m) => m.active).length === 0 && <span className="text-sm text-red-700">Nema imenovanih mentora. Bez mentora radnik koji padne ne može zadužiti ništa.</span>}
          </div>
        </div>
      )}
    </div>
  )
}
