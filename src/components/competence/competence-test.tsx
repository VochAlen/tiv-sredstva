'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, XCircle, Loader2, GraduationCap, ShieldAlert, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getCompetenceForCard, startCompetenceTest, submitCompetenceTest,
  type CardCompetence, type StartedTest, type SubmittedTest,
} from '@/lib/actions-competence'

// Javna stranica /provjera: radnik unese ID karticu, vidi svoj status, polaže test (jedno pitanje po ekranu,
// velika dugmad za tablet) i odmah dobija rezultat sa objašnjenjem pogrešnih odgovora.
// Pitanja su na bosanskom (sadržaj dolazi iz baze).

const SHIFT_KEY = 'gse.worker.shift' // isti ključ kao radnički tok: kartica se pamti

type Step = 'card' | 'status' | 'quiz' | 'result'

const STATE_TEXT: Record<string, { title: string; tone: string }> = {
  NONE: { title: 'Još niste prošli provjeru znanja', tone: 'border-slate-300 bg-slate-50 text-slate-900' },
  VALID: { title: 'Provjera znanja važi', tone: 'border-emerald-300 bg-emerald-50 text-emerald-900' },
  DUE: { title: 'Provjeri znanja je istekao rok', tone: 'border-amber-300 bg-amber-50 text-amber-900' },
  TRAINING: { title: 'Rad uz nadzor mentora', tone: 'border-red-300 bg-red-50 text-red-900' },
}

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('sr-Latn-ME', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')

export function CompetenceTest() {
  const [step, setStep] = useState<Step>('card')
  const [cardId, setCardId] = useState('')
  const [info, setInfo] = useState<CardCompetence | null>(null)
  const [test, setTest] = useState<StartedTest | null>(null)
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [result, setResult] = useState<SubmittedTest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SHIFT_KEY) ?? sessionStorage.getItem(SHIFT_KEY)
      if (raw) { const s = JSON.parse(raw); if (s?.cardId) setCardId(String(s.cardId)) }
    } catch { /* ignore */ }
  }, [])

  const lookup = () => {
    setError(null)
    startTransition(async () => {
      try {
        const r = await getCompetenceForCard(cardId)
        if (!r.ok) { setError(r.error ?? 'Greška'); return }
        setInfo(r); setStep('status')
      } catch { setError('Nema veze sa serverom. Pokušajte ponovo.') }
    })
  }

  const begin = () => {
    setError(null)
    startTransition(async () => {
      try {
        const r = await startCompetenceTest({ cardId })
        if (!r.ok || !r.questions?.length) { setError(r.error ?? 'Test nije moguće pokrenuti'); return }
        setTest(r); setAnswers({}); setIdx(0); setStep('quiz')
      } catch { setError('Nema veze sa serverom. Pokušajte ponovo.') }
    })
  }

  const submit = () => {
    if (!test?.token || !test.questions) return
    setError(null)
    startTransition(async () => {
      try {
        const r = await submitCompetenceTest({ token: test.token!, answers: test.questions!.map((q) => ({ id: q.id, chosen: answers[q.id] ?? -1 })) })
        if (!r.ok) { setError(r.error ?? 'Rezultat nije snimljen'); return }
        setResult(r); setStep('result')
      } catch { setError('Nema veze sa serverom. Test nije predat. Pokušajte ponovo.') }
    })
  }

  const q = test?.questions?.[idx]
  const total = test?.questions?.length ?? 0
  const answered = test?.questions?.filter((x) => answers[x.id] !== undefined).length ?? 0

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto max-w-xl px-4 h-14 flex items-center gap-3">
          <Link href="/" aria-label="Nazad" className="h-10 w-10 -ml-2 flex items-center justify-center rounded-md active:bg-white/10"><ArrowLeft className="h-5 w-5" /></Link>
          <GraduationCap className="h-5 w-5 text-amber-400" aria-hidden />
          <span className="font-semibold">Provjera znanja</span>
        </div>
        <div className="h-0.5 bg-amber-500" />
      </header>

      <div className="mx-auto max-w-xl p-4 space-y-4">
        {error && <div role="alert" className="rounded-xl border-2 border-red-500 bg-red-50 p-3 text-sm text-red-900">{error}</div>}

        {step === 'card' && (
          <section className="rounded-2xl bg-white border p-5 space-y-4">
            <div>
              <h1 className="text-lg font-bold">Unesite ID karticu</h1>
              <p className="text-sm text-slate-600 mt-1">Kratka provjera znanja o radu u aplikaciji i bezbjednosti. Ne traje duže od nekoliko minuta. Služi za obuku, a ne za kažnjavanje.</p>
            </div>
            <Input value={cardId} onChange={(e) => setCardId(e.target.value)} placeholder="ID kartica" className="h-14 text-lg" autoCapitalize="characters" autoComplete="off"
              onKeyDown={(e) => { if (e.key === 'Enter' && cardId.trim().length >= 3) lookup() }} />
            <Button className="w-full h-14 text-base" disabled={cardId.trim().length < 3 || pending} onClick={lookup}>
              {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Dalje
            </Button>
          </section>
        )}

        {step === 'status' && info && (
          <section className="space-y-3">
            <div className={`rounded-2xl border-2 p-4 ${STATE_TEXT[info.state ?? 'NONE'].tone}`}>
              <p className="text-sm opacity-80">{info.name}</p>
              <p className="text-lg font-bold">{STATE_TEXT[info.state ?? 'NONE'].title}</p>
              {info.state === 'VALID' && info.validUntil && <p className="text-sm mt-1">Važi do {fmt(info.validUntil)}.</p>}
              {info.pendingKind && <p className="text-sm mt-1 font-medium">Zadana je provjera{info.pendingDue ? ` do ${fmt(info.pendingDue)}` : ''}.</p>}
              {info.state === 'TRAINING' && (
                <p className="text-sm mt-2">Zaduživanje je moguće uz mentora. Nadzirane smjene: <b>{info.supervisedDone}/{info.supervisedRequired}</b>. Poslije toga polažete test ponovo.</p>
              )}
            </div>
            <Button className="w-full h-14 text-base" disabled={pending} onClick={begin}>
              {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Počni test
            </Button>
            <Button variant="outline" className="w-full h-12" onClick={() => { setStep('card'); setInfo(null) }}>Druga kartica</Button>
          </section>
        )}

        {step === 'quiz' && q && (
          <section className="space-y-3">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Pitanje {idx + 1} / {total}</span>
              <span>{q.topic}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-amber-500 transition-all" style={{ width: `${(answered / total) * 100}%` }} /></div>
            <div className="rounded-2xl bg-white border p-4">
              <p className="text-base font-semibold leading-snug">{q.question}</p>
            </div>
            <div className="space-y-2">
              {q.options.map((o, i) => (
                <button key={i} type="button" onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                  className={`w-full text-left rounded-xl border-2 p-4 text-base min-h-14 ${answers[q.id] === i ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white active:bg-slate-50'}`}>
                  {o}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="h-12" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>Nazad</Button>
              {idx < total - 1 ? (
                <Button className="h-12 flex-1" disabled={answers[q.id] === undefined} onClick={() => setIdx((i) => i + 1)}>Dalje<ChevronRight className="h-4 w-4 ml-1" /></Button>
              ) : (
                <Button className="h-12 flex-1" disabled={answered < total || pending} onClick={submit}>
                  {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Predaj test
                </Button>
              )}
            </div>
            {idx === total - 1 && answered < total && <p className="text-xs text-slate-500 text-center">Odgovorite na sva pitanja ({total - answered} preostalo).</p>}
          </section>
        )}

        {step === 'result' && result && (
          <section className="space-y-3">
            <div className={`rounded-2xl border-2 p-5 text-center ${result.passed ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-red-400 bg-red-50 text-red-900'}`}>
              {result.passed ? <CheckCircle2 className="h-10 w-10 mx-auto" /> : <ShieldAlert className="h-10 w-10 mx-auto" />}
              <p className="text-3xl font-bold mt-2">{result.scorePct}%</p>
              <p className="font-semibold">{result.passed ? 'Položili ste' : 'Niste položili'}</p>
              {result.criticalFailed && <p className="text-sm mt-1">Pogrešan odgovor na bezbjednosno pitanje znači pad bez obzira na ukupan rezultat.</p>}
              <p className="text-sm mt-2">{result.note}</p>
              {result.passed && result.state === 'VALID' && result.validUntil && <p className="text-sm">Važi do {fmt(result.validUntil)}.</p>}
            </div>

            {!result.passed && (
              <div className="rounded-2xl border bg-white p-4 text-sm space-y-1">
                <p className="font-semibold">Šta dalje</p>
                <p>1. Pročitajte uputstvo i objašnjenja ispod.</p>
                <p>2. Radite uz mentora: pri zaduživanju mentor unosi svoju karticu.</p>
                <p>3. Poslije nadziranih smjena ponovo polažete test.</p>
              </div>
            )}

            {!!result.review?.length && (
              <div className="rounded-2xl border bg-white p-4 space-y-3">
                <p className="font-semibold text-sm">Pitanja na kojima ste pogriješili</p>
                {result.review.map((r, i) => (
                  <div key={i} className="rounded-lg border p-3 text-sm space-y-1">
                    <p className="font-medium">{r.critical && <span className="text-red-700">[bezbjednosno] </span>}{r.question}</p>
                    <p className="text-red-800 flex gap-1"><XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />{r.yourAnswer}</p>
                    <p className="text-emerald-800 flex gap-1"><CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />{r.correctAnswer}</p>
                    {r.explanation && <p className="text-slate-600">{r.explanation}</p>}
                  </div>
                ))}
              </div>
            )}
            <Link href="/" className="block"><Button className="w-full h-12">Nazad na aplikaciju</Button></Link>
          </section>
        )}
      </div>
    </main>
  )
}
