'use client'

// Postavke provjere znanja (SAMO administrator): rok ponavljanja, broj pitanja, prag prolaza, banka pitanja.
// Kratak test svaki put nasumično bira izabrani broj pitanja iz banke za ulogu (ADR.OR.D.017, ADR.OPS.B.024).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Settings2, Plus, Trash2, Pencil, Loader2, ShieldAlert, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  getCompetenceSettings, saveCompetenceSettings, listCompetenceQuestions, createCompetenceQuestion,
  updateCompetenceQuestion, deleteCompetenceQuestion, setCompetenceQuestionActive,
  type AudienceSettings, type BankQuestion,
} from '@/lib/actions-competence'
import { getAiStatus, suggestQuestions, type AiStatus } from '@/lib/actions-ai'
import type { QuestionDraft } from '@/lib/ai-logic'
import { AUDIENCES, AUDIENCE_LABEL, INTERVAL_MAX, INTERVAL_MIN, INTERVAL_PRESETS, REGULATORY_MAX_MONTHS, intervalLabel, PASS_MAX, PASS_MIN, QUESTIONS_MAX, QUESTIONS_MIN, type Audience } from '@/lib/competence-logic'

const selectCls = 'h-11 w-full rounded-md border bg-background px-3 text-sm'

interface Draft { id?: string; audience: Audience; topic: string; question: string; options: string[]; correctIndex: number; critical: boolean; explanation: string }
const emptyDraft = (audience: Audience): Draft => ({ audience, topic: '', question: '', options: ['', '', ''], correctIndex: 0, critical: false, explanation: '' })

export function CompetenceAdminView() {
  const [settings, setSettings] = useState<AudienceSettings[] | null>(null)
  const [bank, setBank] = useState<BankQuestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Audience>('DRIVER')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  // AI prijedlozi pitanja (opciono; vidi stranicu „AI postavke“)
  const [ai, setAi] = useState<AiStatus | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiText, setAiText] = useState('')
  const [aiCount, setAiCount] = useState(5)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiDrafts, setAiDrafts] = useState<QuestionDraft[]>([])
  useEffect(() => { getAiStatus().then(setAi).catch(() => setAi(null)) }, [])

  const load = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([getCompetenceSettings(), listCompetenceQuestions()])
      setSettings(s); setBank(b); setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Greška pri čitanju') }
  }, [])
  useEffect(() => { void load() }, [load])

  const cur = settings?.find((s) => s.audience === tab) ?? null
  const [form, setForm] = useState<{ intervalMonths: number; questionsPerTest: number; passPct: number }>({ intervalMonths: 12, questionsPerTest: 10, passPct: 80 })
  const [applyAll, setApplyAll] = useState(false)
  useEffect(() => {
    if (cur) { setForm({ intervalMonths: cur.intervalMonths, questionsPerTest: cur.questionsPerTest, passPct: cur.passPct }); setApplyAll(false) }
  }, [cur?.audience, cur?.intervalMonths, cur?.questionsPerTest, cur?.passPct])

  const list = useMemo(() => (bank ?? []).filter((q) => q.audience === tab), [bank, tab])
  const needed = Math.min(form.questionsPerTest, QUESTIONS_MAX)
  const active = cur?.activeQuestions ?? 0
  const tooFew = active < QUESTIONS_MIN
  const fewerThanAsked = !tooFew && active < needed
  const oneWrongPct = Math.round((1 / Math.max(1, Math.min(needed, active || needed))) * 100)

  const ivOk = Number.isInteger(form.intervalMonths) && form.intervalMonths >= INTERVAL_MIN && form.intervalMonths <= INTERVAL_MAX
  const overReg = ivOk && form.intervalMonths > REGULATORY_MAX_MONTHS

  const saveSettings = async () => {
    if (!ivOk) { toast.error(`Upišite rok u mjesecima, od ${INTERVAL_MIN} do ${INTERVAL_MAX}`); return }
    setBusy(true)
    const r = await saveCompetenceSettings({ audience: tab, ...form, applyToExisting: applyAll })
    setBusy(false)
    if (r.ok) { toast.success(applyAll ? `Sačuvano. Datumi pomjereni za ${r.rescheduled ?? 0} radnika.` : 'Sačuvano. Važi za sljedeće testove.'); void load() } else toast.error(r.error ?? 'Greška')
  }

  const askAi = async () => {
    setAiBusy(true)
    const r = await suggestQuestions({ audience: tab, sourceText: aiText, count: aiCount })
    setAiBusy(false)
    if (r.ok && r.drafts) { setAiDrafts(r.drafts); toast.success(`AI je predložio ${r.drafts.length} pitanja${r.dropped ? `, ${r.dropped} odbačeno (nevaljana)` : ''}. Pregledajte ih prije dodavanja.`) }
    else toast.error(r.error ?? 'Greška')
  }
  const addDraft = async (d: QuestionDraft, i: number) => {
    const r = await createCompetenceQuestion({ audience: tab, topic: d.topic, question: d.question, options: d.options, correctIndex: d.correctIndex, critical: d.critical, explanation: d.explanation })
    if (r.ok) { setAiDrafts((x) => x.filter((_, j) => j !== i)); toast.success('Pitanje dodato u banku'); void load() } else toast.error(r.error ?? 'Greška')
  }

  const saveQuestion = async () => {
    if (!draft) return
    setBusy(true)
    const payload = { audience: draft.audience, topic: draft.topic, question: draft.question, options: draft.options, correctIndex: draft.correctIndex, critical: draft.critical, explanation: draft.explanation }
    const r = draft.id ? await updateCompetenceQuestion({ id: draft.id, ...payload }) : await createCompetenceQuestion(payload)
    setBusy(false)
    if (r.ok) { toast.success(draft.id ? 'Pitanje izmijenjeno' : 'Pitanje dodato'); setDraft(null); void load() } else toast.error(r.error ?? 'Greška')
  }
  const remove = async (q: BankQuestion) => {
    if (!window.confirm('Obrisati pitanje? Ako ga samo ne želite u testu, radije ga isključite.')) return
    const r = await deleteCompetenceQuestion(q.id)
    if (r.ok) { toast.success('Pitanje obrisano'); void load() } else toast.error(r.error ?? 'Greška')
  }
  const toggle = async (q: BankQuestion) => {
    const r = await setCompetenceQuestionActive({ id: q.id, active: !q.active })
    if (r.ok) void load(); else toast.error(r.error ?? 'Greška')
  }

  if (error) return <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>
  if (!settings || !bank) return <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Učitavanje…</div>

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><Settings2 className="h-5 w-5" />Postavke provjere znanja</h2>
        <p className="text-sm text-muted-foreground">
          Vi birate koliko često se radniku pojavljuje kratak test, koliko pitanja ima i šta je prolaz. Pitanja svaki put nasumično bira sistem iz banke koju pišete ovdje.
          Vidljivo samo administratoru, jer su ovdje i tačni odgovori. (ADR.OR.D.017, ADR.OPS.B.024)
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {AUDIENCES.map((a) => (
          <button key={a} type="button" onClick={() => { setTab(a); setDraft(null) }}
            className={`h-11 px-4 rounded-lg border text-sm ${tab === a ? 'bg-foreground text-background border-foreground' : ''}`}>
            {AUDIENCE_LABEL[a]}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border p-4 space-y-4">
        <div className="font-semibold">Kratak test: {AUDIENCE_LABEL[tab]}</div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1 text-sm">
            <label htmlFor="iv" className="font-medium block">Test se pojavljuje svakih (mjeseci)</label>
            <Input id="iv" type="number" inputMode="numeric" min={INTERVAL_MIN} max={INTERVAL_MAX} className="h-11"
              value={Number.isFinite(form.intervalMonths) ? form.intervalMonths : ''}
              onChange={(e) => setForm({ ...form, intervalMonths: e.target.value === '' ? NaN : Math.trunc(Number(e.target.value)) })} />
            <div className="flex flex-wrap gap-1 pt-1">
              {INTERVAL_PRESETS.map((m) => (
                <button key={m} type="button" onClick={() => setForm({ ...form, intervalMonths: m })}
                  className={`h-9 px-3 rounded-md border text-xs ${form.intervalMonths === m ? 'bg-foreground text-background border-foreground' : ''}`}>{intervalLabel(m)}</button>
              ))}
            </div>
          </div>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Broj pitanja u testu</span>
            <select className={selectCls} value={form.questionsPerTest} onChange={(e) => setForm({ ...form, questionsPerTest: Number(e.target.value) })}>
              {Array.from({ length: QUESTIONS_MAX - QUESTIONS_MIN + 1 }, (_, i) => QUESTIONS_MIN + i).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Prolaz od (%)</span>
            <select className={selectCls} value={form.passPct} onChange={(e) => setForm({ ...form, passPct: Number(e.target.value) })}>
              {Array.from({ length: (PASS_MAX - PASS_MIN) / 5 + 1 }, (_, i) => PASS_MIN + i * 5).map((n) => <option key={n} value={n}>{n}%</option>)}
            </select>
          </label>
        </div>

        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
          <li>Test se radniku pojavi nasumično između 25% i 90% izabranog roka (npr. za 12 mjeseci: između 3. i 11. mjeseca), da svi ne dođu na red istog dana. Krajnji rok je cijeli izabrani period. Rok upisujete sami, pa ga možete promijeniti ako regulator (CAA ili EASA) promijeni propis.</li>
          <li>Pitanja označena kao „sigurnosno“ imaju prednost u izboru, a jedan pogrešan odgovor na njih znači pad bez obzira na procenat.</li>
          <li>Pri 3 pitanja i prolazu od 80% treba tačnih 3 od 3 (jedna greška = {oneWrongPct}% manje).</li>
        </ul>

        {overReg && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Izabrali ste {intervalLabel(form.intervalMonths)}. Važeći propis (ADR.OPS.B.024(c), ADR.OR.D.017) trenutno traži provjeru najmanje svakih {REGULATORY_MAX_MONTHS} mjeseca. Sačuvajte ovako samo ako je propis promijenjen ili imate odobrenje regulatora.</div>}
        {tooFew && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 flex gap-2"><ShieldAlert className="h-4 w-4 mt-0.5 flex-shrink-0" />Aktivnih pitanja za ovu ulogu: {active}. Potrebno je najmanje {QUESTIONS_MIN}, inače test ne može da se pokrene.</div>}
        {fewerThanAsked && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">U banci je {active} aktivnih pitanja, a test traži {needed}. Test će imati {active} pitanja. Dodajte još pitanja da bi izbor bio zaista nasumičan (preporuka: bar dvostruko više od broja pitanja u testu).</div>}

        <label className="flex items-start gap-3 text-sm min-h-11">
          <input type="checkbox" className="h-5 w-5 mt-0.5" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
          <span>Primijeni novi rok i na radnike koji su već položili ({cur?.employees ?? 0} u evidenciji). Datum sljedećeg testa se računa od dana kad su položili; ako je već prošao, test im se pojavi u narednih 14 dana.</span>
        </label>
        <Button className="h-11" onClick={saveSettings} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sačuvaj postavke'}</Button>
      </div>

      <div className="rounded-2xl border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="font-semibold">Banka pitanja: {AUDIENCE_LABEL[tab]}</div>
            <div className="text-xs text-muted-foreground">{list.filter((q) => q.active).length} aktivnih od {list.length}. Isključeno pitanje ostaje sačuvano, ali se ne pojavljuje u testu.</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {ai?.enabled && <Button variant="outline" className="h-11" onClick={() => setAiOpen((v) => !v)}><Sparkles className="h-4 w-4 mr-1" />Predloži pomoću AI</Button>}
            <Button className="h-11" onClick={() => setDraft(emptyDraft(tab))}><Plus className="h-4 w-4 mr-1" />Novo pitanje</Button>
          </div>
        </div>

        {ai?.enabled && aiOpen && (
          <div className="rounded-xl border-2 border-dashed p-3 space-y-3">
            <div className="text-sm font-medium flex items-center gap-1.5"><Sparkles className="h-4 w-4" />AI prijedlog pitanja za: {AUDIENCE_LABEL[tab]}</div>
            <Textarea rows={6} value={aiText} onChange={(e) => setAiText(e.target.value)} maxLength={6000} placeholder="Zalijepite dio procedure ili uputstva. Pitanja će biti napisana samo iz tog teksta." />
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-sm flex items-center gap-2">Broj pitanja
                <select className="h-11 rounded-md border bg-background px-2 text-sm" value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))}>
                  {[3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <Button className="h-11" onClick={askAi} disabled={aiBusy || aiText.trim().length < 200}>{aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Predloži'}</Button>
              <span className="text-xs text-muted-foreground">Model: <span className="font-mono">{ai.model}</span>. Tekst se šalje vanjskom AI servisu, bez ličnih podataka. Potrebno bar 200 znakova.</span>
            </div>
            {aiDrafts.map((d, i) => (
              <div key={i} className="rounded-lg border p-3 text-sm bg-muted/30">
                <div className="text-xs text-muted-foreground">AI prijedlog · {d.topic}{d.critical && <span className="ml-1 text-red-700 font-semibold">· sigurnosno</span>}</div>
                <div className="font-medium">{d.question}</div>
                <ul className="mt-1 text-xs space-y-0.5">{d.options.map((o, k) => <li key={k} className={k === d.correctIndex ? 'text-emerald-700 font-medium' : 'text-muted-foreground'}>{k === d.correctIndex ? '✓ ' : '• '}{o}</li>)}</ul>
                {d.explanation && <div className="text-xs mt-1 text-muted-foreground">{d.explanation}</div>}
                <div className="flex gap-2 mt-2">
                  <Button size="sm" className="h-9" onClick={() => addDraft(d, i)}>Dodaj u banku</Button>
                  <Button size="sm" variant="outline" className="h-9" onClick={() => setAiDrafts((x) => x.filter((_, j) => j !== i))}>Odbaci</Button>
                </div>
              </div>
            ))}
            {aiDrafts.length > 0 && <p className="text-xs text-amber-800">Provjerite svaki odgovor prema proceduri prije dodavanja. AI može pogriješiti.</p>}
          </div>
        )}

        {draft && (
          <div className="rounded-xl border-2 border-foreground/20 p-3 space-y-3">
            <div className="font-medium text-sm">{draft.id ? 'Izmjena pitanja' : 'Novo pitanje'}</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="space-y-1 text-sm">
                <span>Za koga je pitanje</span>
                <select className={selectCls} value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value as Audience })}>
                  {AUDIENCES.map((a) => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Tema (npr. Zaduživanje, Pregled, Kvar)</span>
                <Input className="h-11" value={draft.topic} onChange={(e) => setDraft({ ...draft, topic: e.target.value })} maxLength={60} />
              </label>
            </div>
            <label className="space-y-1 text-sm block">
              <span>Pitanje</span>
              <Textarea rows={2} value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} maxLength={500} />
            </label>
            <div className="space-y-2">
              <div className="text-sm">Odgovori (označite tačan)</div>
              {draft.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="correct" className="h-5 w-5 flex-shrink-0" checked={draft.correctIndex === i} onChange={() => setDraft({ ...draft, correctIndex: i })} aria-label={`Odgovor ${i + 1} je tačan`} />
                  <Input className="h-11" value={o} placeholder={`Odgovor ${i + 1}`} maxLength={300}
                    onChange={(e) => setDraft({ ...draft, options: draft.options.map((x, j) => (j === i ? e.target.value : x)) })} />
                  {draft.options.length > 2 && (
                    <Button type="button" variant="outline" size="icon" className="h-11 w-11 flex-shrink-0" aria-label="Ukloni odgovor"
                      onClick={() => {
                        const options = draft.options.filter((_, j) => j !== i)
                        const ci = draft.correctIndex === i ? 0 : draft.correctIndex > i ? draft.correctIndex - 1 : draft.correctIndex
                        setDraft({ ...draft, options, correctIndex: ci })
                      }}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
              ))}
              {draft.options.length < 6 && <Button type="button" variant="outline" className="h-10" onClick={() => setDraft({ ...draft, options: [...draft.options, ''] })}><Plus className="h-4 w-4 mr-1" />Dodaj odgovor</Button>}
            </div>
            <label className="space-y-1 text-sm block">
              <span>Objašnjenje (prikazuje se radniku ako pogriješi)</span>
              <Textarea rows={2} value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} maxLength={600} />
            </label>
            <label className="flex items-start gap-3 text-sm min-h-11">
              <input type="checkbox" className="h-5 w-5 mt-0.5" checked={draft.critical} onChange={(e) => setDraft({ ...draft, critical: e.target.checked })} />
              <span>Sigurnosno pitanje: jedan pogrešan odgovor znači pad, i uvijek ima prednost pri izboru.</span>
            </label>
            <div className="flex gap-2">
              <Button className="h-11" onClick={saveQuestion} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sačuvaj pitanje'}</Button>
              <Button variant="outline" className="h-11" onClick={() => setDraft(null)}>Otkaži</Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {list.map((q) => (
            <div key={q.id} className={`rounded-lg border p-3 text-sm ${q.active ? '' : 'opacity-50'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{q.topic}{q.critical && <span className="ml-1 text-red-700 font-semibold">· sigurnosno</span>}{!q.active && <span className="ml-1">· isključeno</span>}</div>
                  <div className="font-medium">{q.question}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="sm" variant="outline" className="h-9" onClick={() => toggle(q)}>{q.active ? 'Isključi' : 'Uključi'}</Button>
                  <Button size="icon" variant="outline" className="h-9 w-9" aria-label="Izmijeni" onClick={() => setDraft({ id: q.id, audience: q.audience, topic: q.topic, question: q.question, options: [...q.options], correctIndex: q.correctIndex, critical: q.critical, explanation: q.explanation })}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="outline" className="h-9 w-9" aria-label="Obriši" onClick={() => remove(q)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <ul className="mt-1 text-xs space-y-0.5">
                {q.options.map((o, i) => <li key={i} className={i === q.correctIndex ? 'text-emerald-700 font-medium' : 'text-muted-foreground'}>{i === q.correctIndex ? '✓ ' : '• '}{o}</li>)}
              </ul>
            </div>
          ))}
          {list.length === 0 && <div className="text-sm text-muted-foreground">Nema pitanja za ovu ulogu. Dodajte prvo pitanje.</div>}
        </div>
        <p className="text-xs text-muted-foreground">Pitanja koja su ovdje ponuđena na početku su nacrt iz uputstva za korištenje. Pregledajte ih i izmijenite prije prve službene provjere.</p>
      </div>
    </div>
  )
}
