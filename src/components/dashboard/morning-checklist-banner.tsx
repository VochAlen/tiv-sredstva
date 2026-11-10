'use client'

// Jutarnja ček lista za Operativni centar: OBR1 (Služba zemaljskog opsluživanja) i OBR2 (Tehnička služba).
// Upadljiva kartica na "Moj zadatak": dok lista nije odštampana, crvena je. Sačuvaj PDF = preuzimanje na računar.
// "Odštampano" se pamti u pregledaču (po datumu i obrascu) - to je podsjetnik, ne evidencija.

import { useEffect, useState } from 'react'
import { Printer, FileDown, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getDailyInspectionStatus } from '@/lib/actions-adr'
import { localDate } from '@/lib/local-day'

const FORMS = [
  { dept: 'SLUZBA_PO', code: 'OBR.1', label: 'Služba zemaljskog opsluživanja' },
  { dept: 'TEHNICKA_SLUZBA', code: 'OBR.2', label: 'Tehnička služba' },
]

const key = (date: string, dept: string) => `gse.printed.${date}.${dept}`
const readPrinted = (date: string, dept: string): string | null => { try { return localStorage.getItem(key(date, dept)) } catch { return null } }

export function MorningChecklistBanner() {
  const date = localDate(new Date())
  const [printed, setPrinted] = useState<Record<string, string | null>>({})
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    setPrinted(Object.fromEntries(FORMS.map((f) => [f.dept, readPrinted(date, f.dept)])))
    getDailyInspectionStatus(date)
      .then((rows) => {
        const r = rows.filter((x) => x.type !== 'DOLLY')
        setProgress({ done: r.filter((x) => x.inspection).length, total: r.length })
      })
      .catch(() => setProgress(null))
  }, [date])

  const mark = (dept: string) => {
    const t = new Date().toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })
    try { localStorage.setItem(key(date, dept), t) } catch { /* ignore */ }
    setPrinted((p) => ({ ...p, [dept]: t }))
  }
  const open = (dept: string, inline: boolean) => {
    window.open(`/api/reports/gse-daily-checklist?department=${dept}&date=${date}${inline ? '&inline=1' : ''}`, '_blank')
    mark(dept)
  }

  const allDone = FORMS.every((f) => printed[f.dept])
  const pending = progress ? progress.total - progress.done : 0

  return (
    <div className={`rounded-2xl border-2 p-4 space-y-3 ${allDone ? 'border-emerald-400 bg-emerald-50' : 'border-red-500 bg-red-50'}`}>
      <div className="flex items-start gap-3">
        {allDone ? <CheckCircle2 className="h-7 w-7 text-emerald-600 flex-shrink-0" /> : <AlertTriangle className="h-7 w-7 text-red-600 flex-shrink-0" />}
        <div className="min-w-0">
          <div className={`text-lg font-extrabold leading-tight ${allDone ? 'text-emerald-900' : 'text-red-900'}`}>
            {allDone ? 'Ček liste su odštampane' : 'ODŠTAMPAJ ČEK LISTE I ODNESI U OPERATIVNI CENTAR'}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            Svako jutro, kad se završi pregled sredstava. Sačuvaj i PDF na računaru.
            {progress && pending > 0 && <> Još nije pregledano: <strong>{pending}</strong>. Zaokružuje se samo ono što je pregledano, ostalo upišite rukom.</>}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {FORMS.map((f) => {
          const done = printed[f.dept]
          return (
            <div key={f.dept} className={`rounded-xl border bg-white p-3 space-y-2 ${done ? 'border-emerald-300' : 'border-red-300'}`}>
              <div>
                <div className="font-semibold text-sm">{f.label}</div>
                <div className="text-xs text-muted-foreground">PRO.03.04. {f.code}</div>
              </div>
              {done && <div className="text-xs font-medium text-emerald-700">✓ Otvoreno za štampu u {done}</div>}
              <div className="flex gap-2">
                <Button className="flex-1 h-12 text-base" variant={done ? 'outline' : 'default'} onClick={() => open(f.dept, true)}>
                  <Printer className="h-5 w-5 mr-2" />Štampaj
                </Button>
                <Button className="h-12" variant="outline" onClick={() => open(f.dept, false)}>
                  <FileDown className="h-5 w-5 mr-2" />Sačuvaj PDF
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
