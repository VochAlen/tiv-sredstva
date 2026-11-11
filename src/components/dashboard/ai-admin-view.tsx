'use client'

// AI postavke (SAMO administrator): prekidač ON/OFF, model u upotrebi, provjera veze.
// AI daje prijedloge koje čovjek potvrđuje. Ne odlučuje o blokadi, ovlaštenju ni prolazu testa.

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Sparkles, Loader2, CheckCircle2, XCircle, Plug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { getAiStatus, setAiEnabled, testAiConnection, type AiStatus } from '@/lib/actions-ai'

export function AiAdminView() {
  const [st, setSt] = useState<AiStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => { try { setSt(await getAiStatus()) } catch { toast.error('Stanje AI nije učitano') } }, [])
  useEffect(() => { void load() }, [load])

  const toggle = async (on: boolean) => {
    setBusy(true)
    const r = await setAiEnabled(on)
    setBusy(false)
    if (r.ok) { toast.success(on ? 'AI je uključen' : 'AI je isključen'); void load() } else toast.error(r.error ?? 'Greška')
  }
  const runTest = async () => {
    setBusy(true); setTest(null)
    const r = await testAiConnection()
    setBusy(false)
    setTest(r.ok ? { ok: true, text: `Veza radi (${r.ms} ms), model: ${r.model}` } : { ok: false, text: r.error ?? 'Greška' })
  }

  if (!st) return <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Učitavanje…</div>

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><Sparkles className="h-5 w-5" />AI postavke</h2>
        <p className="text-sm text-muted-foreground">Opciona pomoć u dva mjesta. Uvijek je samo prijedlog, a odluku donosi čovjek.</p>
      </div>

      <div className="rounded-2xl border p-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold">AI pomoć je {st.enabled ? 'UKLJUČENA' : 'ISKLJUČENA'}</div>
            <div className="text-xs text-muted-foreground">Prekidač djeluje odmah, bez promjene koda. Isključen AI se nigdje ne prikazuje.</div>
          </div>
          <Switch checked={st.switchedOn} disabled={busy || (!st.configured && !st.switchedOn)} onCheckedChange={toggle} aria-label="AI uključen" />
        </div>

        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">Model u upotrebi</dt>
            <dd className="font-mono font-medium break-all">{st.model ?? 'nije podešen'}</dd>
          </div>
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">Podešavanje u okruženju</dt>
            <dd className="font-medium flex items-center gap-1.5">
              {st.configured ? <><CheckCircle2 className="h-4 w-4 text-emerald-600" />Ključ i model su podešeni</> : <><XCircle className="h-4 w-4 text-red-600" />{st.masterOff ? 'Isključeno sa AI_ENABLED=false' : 'Nedostaje KILO_API_KEY ili KILO_MODEL'}</>}
            </dd>
          </div>
        </dl>

        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" className="h-11" onClick={runTest} disabled={busy || !st.configured}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}Provjeri vezu
          </Button>
          {test && <span className={`text-sm ${test.ok ? 'text-emerald-700' : 'text-red-700'}`}>{test.text}</span>}
        </div>
      </div>

      <div className="rounded-2xl border p-4 space-y-2 text-sm">
        <div className="font-semibold">Gdje se AI koristi</div>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li><b className="text-foreground">Prijava kvara (radnik):</b> predlaže kategoriju i jednu urednu rečenicu iz onoga što je radnik napisao. Težinu kvara ne predlaže, jer ona odlučuje o blokadi sredstva. Radnik potvrđuje ili odbacuje.</li>
          <li><b className="text-foreground">Banka pitanja (administrator):</b> predlaže pitanja iz teksta procedure koji zalijepite. Ništa se ne snima dok ih ne pregledate i dodate.</li>
          <li><b className="text-foreground">Ne koristi se</b> za ovlaštenja, zaduživanje, CRS ni ocjenu testa znanja.</li>
        </ul>
        <div className="font-semibold pt-2">Podaci</div>
        <p className="text-muted-foreground">Šalje se samo tekst opisa kvara ili procedure. Brojevi kartica, email adrese i telefoni se uklanjaju prije slanja. Slike se ne šalju. Imena radnika se ne šalju.</p>
        <div className="font-semibold pt-2">Podešavanje (jednom, u Vercel okruženju)</div>
        <p className="text-muted-foreground font-mono text-xs leading-relaxed">KILO_API_KEY — ključ sa app.kilo.ai<br />KILO_MODEL — tačan naziv modela iz Kilo liste<br />KILO_BASE_URL — opciono, podrazumijevano https://ai-gateway.kilo.ai/api/v1<br />AI_ENABLED=false — glavni prekidač, gasi AI bez obzira na ovu stranicu<br />AI_DAILY_LIMIT — opciono, najviše poziva dnevno (podrazumijevano 300)</p>
        <p className="text-xs text-muted-foreground">Promjena okruženja traži novo puštanje (redeploy) u Vercel-u. Ovaj prekidač djeluje odmah.</p>
      </div>
    </div>
  )
}
