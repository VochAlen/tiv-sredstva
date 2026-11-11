'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, X, Loader2, Sparkles } from 'lucide-react'
import { getAiStatus, suggestDamage } from '@/lib/actions-ai'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { compressImage } from '@/lib/image-compress'
import { CHECKLIST_CATEGORY_ORDER, CHECKLIST_CATEGORY_LABELS } from '@/lib/types'
import { useTx } from '@/lib/worker-en'

export const MAX_DAMAGE_PHOTOS = 2

// Stanje AI-ja se čita jednom po otvaranju stranice. Bez ključa ili kad je isključen, ništa se ne prikazuje.
let aiStatusPromise: Promise<{ enabled: boolean; model: string | null }> | null = null
const loadAiStatus = () => (aiStatusPromise ??= getAiStatus().then((s) => ({ enabled: s.enabled, model: s.model })).catch(() => ({ enabled: false, model: null })))

// Foto-prvo prijavljivanje: slika → jedna kategorija (velika dugmad) → opciono jedna rečenica.
export function DamageQuickFields({
  category, onCategory, photos, onPhotos, description, onDescription,
}: {
  category: string
  onCategory: (c: string) => void
  photos: string[]
  onPhotos: (p: string[]) => void
  description: string
  onDescription: (d: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const tx = useTx()
  const [ai, setAi] = useState<{ enabled: boolean; model: string | null }>({ enabled: false, model: null })
  const [aiBusy, setAiBusy] = useState(false)
  const [sugg, setSugg] = useState<{ category: string | null; text: string | null } | null>(null)
  useEffect(() => { void loadAiStatus().then(setAi) }, [])

  const askAi = async () => {
    setAiBusy(true)
    const r = await suggestDamage({ text: description })
    setAiBusy(false)
    if (r.ok) setSugg({ category: r.category ?? null, text: r.text ?? null })
    else toast.error(tx(r.error ?? 'AI nije dostupan'))
  }
  const applySugg = () => {
    if (sugg?.category) onCategory(sugg.category)
    if (sugg?.text) onDescription(sugg.text)
    setSugg(null)
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const data = await compressImage(file)
      onPhotos([...photos, data].slice(0, MAX_DAMAGE_PHOTOS))
    } catch {
      toast.error(tx('Slika nije učitana, pokušajte ponovo'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="text-sm font-medium">{tx('1. Slikajte kvar')}</div>
        <div className="flex gap-2 flex-wrap">
          {photos.map((p, i) => (
            <div key={i} className="relative h-20 w-20 rounded-md overflow-hidden border">
              <img src={p} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={tx('Ukloni sliku')}
                onClick={() => onPhotos(photos.filter((_, j) => j !== i))}
                className="absolute top-0.5 right-0.5 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {photos.length < MAX_DAMAGE_PHOTOS && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="h-20 w-20 rounded-md border-2 border-dashed flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground active:bg-muted"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-6 w-6" />}
              {busy ? '' : tx('Slika')}
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      </div>

      <div className="space-y-1.5">
        <div className="text-sm font-medium">{tx('2. Šta nije u redu?')}</div>
        <div className="grid grid-cols-2 gap-2">
          {CHECKLIST_CATEGORY_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onCategory(category === c ? '' : c)}
              className={`min-h-14 rounded-lg border-2 text-sm font-semibold px-2 ${category === c ? 'border-primary bg-primary/10' : 'border-border'}`}
            >
              {tx(CHECKLIST_CATEGORY_LABELS[c])}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-sm font-medium">{tx('3. Jedna rečenica (nije obavezno)')}</div>
        <Textarea
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          placeholder={tx('npr. curi ulje pri dnu')}
          rows={2}
        />
        {ai.enabled && description.trim().length >= 6 && !sugg && (
          <button type="button" onClick={askAi} disabled={aiBusy} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline min-h-9">
            {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{tx('Predloži kategoriju i opis (AI)')}
          </button>
        )}
        {sugg && (
          <div className="rounded-lg border bg-muted/40 p-2.5 space-y-1.5 text-sm">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Sparkles className="h-3 w-3" />{tx('AI prijedlog, provjerite prije slanja')} · <span className="font-mono">{ai.model}</span></div>
            {sugg.category && <div><span className="text-muted-foreground">{tx('Kategorija')}: </span><b>{tx(CHECKLIST_CATEGORY_LABELS[sugg.category as keyof typeof CHECKLIST_CATEGORY_LABELS])}</b></div>}
            {sugg.text && <div>{sugg.text}</div>}
            <div className="flex gap-2 pt-0.5">
              <button type="button" onClick={applySugg} className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold">{tx('Primijeni')}</button>
              <button type="button" onClick={() => setSugg(null)} className="h-10 px-4 rounded-md border text-sm">{tx('Odbaci')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Opis koji ide u bazu kad radnik nije ništa ukucao
export function fallbackDamageDescription(category: string, photoCount: number): string {
  const cat = CHECKLIST_CATEGORY_LABELS[category as keyof typeof CHECKLIST_CATEGORY_LABELS]
  const parts = [cat ? `Kategorija: ${cat}` : 'Kvar prijavljen bez opisa']
  if (photoCount > 0) parts.push(`foto: ${photoCount}`)
  return parts.join(' — ')
}
