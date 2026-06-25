'use client'

import { useState, useRef, useTransition } from 'react'
import { Camera, X, Loader2, Upload, Image as ImageIcon, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { addPhotoToDamage } from '@/lib/actions-advanced'

interface PhotoUploadProps {
  damageReportId?: string | null
  equipmentId: string
  takenByCardId?: string
  takenByName?: string
  onUploaded?: () => void
  // Ako nije proslijeđen damageReportId, slike se čuvaju lokalno i šalju nakon što se dobije ID
  pendingPhotos?: PendingPhoto[]
  onPendingPhotosChange?: (photos: PendingPhoto[]) => void
}

export interface PendingPhoto {
  id: string
  dataUrl: string  // base64
  caption?: string
}

export function PhotoUpload({
  damageReportId,
  equipmentId,
  takenByCardId,
  takenByName,
  onUploaded,
  pendingPhotos = [],
  onPendingPhotosChange,
}: PhotoUploadProps) {
  const [photos, setPhotos] = useState<PendingPhoto[]>(pendingPhotos)
  const [uploading, setUploading] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const updatePhotos = (newPhotos: PendingPhoto[]) => {
    setPhotos(newPhotos)
    onPendingPhotosChange?.(newPhotos)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} nije slika`)
        return
      }

      // Maksimalna veličina 2MB (zbog base64 u bazi)
      if (file.size > 2 * 1024 * 1024) {
        toast.error(`${file.name} je prevelika (max 2MB). Smanjite rezoluciju.`)
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string
        const newPhoto: PendingPhoto = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          dataUrl,
        }
        const currentPhotos = photos
        updatePhotos([...currentPhotos, newPhoto])

        // Ako već imamo damageReportId, odmah šaljemo na server
        if (damageReportId) {
          setUploading(newPhoto.id)
          startTransition(async () => {
            try {
              const res = await addPhotoToDamage({
                damageReportId,
                equipmentId,
                photoData: dataUrl,
                photoType: file.type,
                takenByCardId,
                takenByName,
              })
              if (res.ok) {
                toast.success('Slika dodana')
                onUploaded?.()
              } else {
                toast.error('Greška pri uploadu slike')
                updatePhotos(photos.filter((p) => p.id !== newPhoto.id))
              }
            } catch (e: any) {
              toast.error(`Greška: ${e?.message ?? e}`)
              updatePhotos(photos.filter((p) => p.id !== newPhoto.id))
            } finally {
              setUploading(null)
            }
          })
        }
      }
      reader.readAsDataURL(file)
    })

    // Reset input da se može ponovo odabrati ista datoteka
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const handleRemove = (id: string) => {
    updatePhotos(photos.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isPending}
        >
          <Camera className="h-4 w-4 mr-1.5" />
          Slikaj
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending}
        >
          <Upload className="h-4 w-4 mr-1.5" />
          Izaberi sliku
        </Button>
        {photos.length > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {photos.length} {photos.length === 1 ? 'slika' : 'slika'}
          </span>
        )}
      </div>

      {/* Skriveni inputi - kamera sa capture="environment" za mobilne */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Preview slika */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group">
              <img
                src={photo.dataUrl}
                alt="Dokaz oštećenja"
                className="w-full h-24 object-cover rounded-lg border"
              />
              {uploading === photo.id ? (
                <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                </div>
              ) : damageReportId ? (
                <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5">
                  <CheckCircle2 className="h-3 w-3" />
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => handleRemove(photo.id)}
                className="absolute top-1 left-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                disabled={isPending}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <ImageIcon className="h-3 w-3" />
          Opciono: dodajte fotografiju oštećenja kao dokaz
        </div>
      )}

      {!damageReportId && photos.length > 0 && (
        <p className="text-xs text-amber-600">
          ⚠ Slike će biti poslate nakon što prijavite oštećenje
        </p>
      )}
    </div>
  )
}

// Pomoćna funkcija za slanje pending slika nakon dobijanja damageReportId
export async function uploadPendingPhotos(
  photos: PendingPhoto[],
  damageReportId: string,
  equipmentId: string,
  takenByCardId?: string,
  takenByName?: string
): Promise<{ uploaded: number; failed: number }> {
  let uploaded = 0
  let failed = 0

  for (const photo of photos) {
    try {
      const res = await addPhotoToDamage({
        damageReportId,
        equipmentId,
        photoData: photo.dataUrl,
        takenByCardId,
        takenByName,
      })
      if (res.ok) uploaded++
      else failed++
    } catch {
      failed++
    }
  }

  return { uploaded, failed }
}
