'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { loadEmployees, peekEmployees, lastPicked, rememberPicked, type EmployeeLite } from '@/lib/employee-cache'

// Izbor osobe iz evidencije radnika (umjesto kucanja imena).
// - pretraga po imenu ili broju kartice, lista se otvara tek kad se kuca
// - zadnja 3 izbora za to polje nude se kao dugmad (1 klik)
// - multi: više osoba, vrijednost je "Ime1, Ime2"
// - ako lista ne može da se učita, polje se vraća na slobodan unos (ne blokira rad)
export function PersonPicker({
  value, onChange, storageKey, placeholder = 'Počnite kucati ime ili broj kartice', multi = false, autoFocus = false,
}: {
  value: string
  onChange: (v: string) => void
  storageKey: string
  placeholder?: string
  multi?: boolean
  autoFocus?: boolean
}) {
  const [list, setList] = useState<EmployeeLite[] | null>(() => peekEmployees())
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState('')
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    setRecent(lastPicked(storageKey))
    if (!list) loadEmployees().then(setList).catch(() => setFailed(true))
  }, [storageKey])

  const selected = useMemo(() => value.split(',').map((s) => s.trim()).filter(Boolean), [value])

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s || !list) return []
    return list
      .filter((e) => !selected.includes(e.name) && (e.name.toLowerCase().includes(s) || e.cardId.toLowerCase().includes(s)))
      .slice(0, 6)
  }, [q, list, selected])

  const pick = (name: string) => {
    rememberPicked(storageKey, name)
    setRecent(lastPicked(storageKey))
    setQ('')
    onChange(multi ? [...selected, name].join(', ') : name)
  }
  const remove = (name: string) => onChange(selected.filter((n) => n !== name).join(', '))

  // Rezerva: lista nedostupna -> slobodan unos
  if (failed || (list && list.length === 0)) {
    return <Input autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Ime i prezime" />
  }

  const showInput = multi || selected.length === 0
  const quick = recent.filter((n) => !selected.includes(n))

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((n) => (
            <span key={n} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/30 pl-3 pr-1 py-1 text-sm font-medium">
              {n}
              <button type="button" aria-label={`Ukloni ${n}`} onClick={() => remove(n)} className="h-6 w-6 rounded-full hover:bg-primary/20 flex items-center justify-center">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      {showInput && (
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus={autoFocus}
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={list ? placeholder : 'Učitavam listu radnika…'}
            />
          </div>
          {matches.length > 0 && (
            <div className="rounded-md border divide-y overflow-hidden">
              {matches.map((e) => (
                <button key={e.id} type="button" onClick={() => pick(e.name)} className="w-full flex items-center justify-between gap-2 px-3 py-3 text-left hover:bg-muted active:bg-muted">
                  <span className="font-medium">{e.name}</span>
                  <span className="text-xs text-muted-foreground">{e.cardId}</span>
                </button>
              ))}
            </div>
          )}
          {q.trim() && list && matches.length === 0 && (
            <p className="text-xs text-muted-foreground">Nema u evidenciji radnika. Dodajte ga u Access Control / evidenciju.</p>
          )}
          {!q && quick.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quick.map((n) => (
                <Button key={n} type="button" variant="outline" size="sm" className="h-9" onClick={() => pick(n)}>{n}</Button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
