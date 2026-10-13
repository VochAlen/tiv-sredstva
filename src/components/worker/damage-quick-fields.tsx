'use client'

import { useRef, useState } from 'react'
import { Camera, X, Loader2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { compressImage } from '@/lib/image-compress'
import { CHECKLIST_CATEGORY_ORDER, CHECKLIST_CATEGORY_LABELS } from '@/lib/types'

export const MAX_DAMAGE_PHOTOS = 2

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

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const data = await compressImage(file)
      onPhotos([...photos, data].slice(0, MAX_DAMAGE_PHOTOS))
    } catch {
      toast.error('Slika nije učitana, pokušajte ponovo')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="text-sm font-medium">1. Slikajte kvar</div>
        <div className="flex gap-2 flex-wrap">
          {photos.map((p, i) => (
            <div key={i} className="relative h-20 w-20 rounded-md overflow-hidden border">
              <img src={p} alt={`Fotografija ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Ukloni sliku"
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
              {busy ? '' : 'Slika'}
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      </div>

      <div className="space-y-1.5">
        <div className="text-sm font-medium">2. Šta nije u redu?</div>
        <div className="grid grid-cols-2 gap-2">
          {CHECKLIST_CATEGORY_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onCategory(category === c ? '' : c)}
              className={`min-h-14 rounded-lg border-2 text-sm font-semibold px-2 ${category === c ? 'border-primary bg-primary/10' : 'border-border'}`}
            >
              {CHECKLIST_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-sm font-medium">3. Jedna rečenica (nije obavezno)</div>
        <Textarea
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          placeholder="npr. curi ulje pri dnu"
          rows={2}
        />
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
