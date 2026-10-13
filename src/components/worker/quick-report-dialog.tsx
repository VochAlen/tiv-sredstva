'use client'

// =====================================================
// Brza prijava FOD-a ili divlje životinje — dostupno direktno sa
// radničke stranice, bez login-a, bez skeniranja opreme (ADR.OPS.B.016,
// ADR.OPS.B.020). Namjerno kratak obrazac — svega par polja, 2 klika.
// =====================================================

import { useState } from 'react'
import { useTransition } from 'react'
import { AlertTriangle, Bird, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { createFodReport, createWildlifeReport } from '@/lib/actions-safety-reports'
import { FOD_ITEM_TYPE_LABELS } from '@/lib/constants-export'

export function QuickReportDialog({
  open,
  onOpenChange,
  type,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'FOD' | 'WILDLIFE'
}) {
  const [isPending, startTransition] = useTransition()

  // FOD polja
  const [location, setLocation] = useState('')
  const [itemType, setItemType] = useState('OTHER')
  const [description, setDescription] = useState('')
  const [aircraftPartSuspected, setAircraftPartSuspected] = useState(false)
  const [foundByName, setFoundByName] = useState('')

  // Wildlife polja
  const [species, setSpecies] = useState('')
  const [count, setCount] = useState('1')
  const [strike, setStrike] = useState(false)

  const reset = () => {
    setLocation(''); setItemType('OTHER'); setDescription(''); setAircraftPartSuspected(false); setFoundByName('')
    setSpecies(''); setCount('1'); setStrike(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!location.trim() || !foundByName.trim()) {
      toast.error('Popunite lokaciju i ime')
      return
    }
    if (type === 'FOD' && !description.trim()) {
      toast.error('Opišite šta ste pronašli')
      return
    }
    if (type === 'WILDLIFE' && !species.trim()) {
      toast.error('Unesite vrstu životinje')
      return
    }

    startTransition(async () => {
      try {
        if (type === 'FOD') {
          await createFodReport({
            location, itemType, description, aircraftPartSuspected,
            foundByName,
          })
          toast.success('FOD prijava poslana. Hvala!')
        } else {
          await createWildlifeReport({
            species, count: parseInt(count) || 1, location, strike,
            reportedByName: foundByName,
          })
          toast.success('Prijava poslana. Hvala!')
        }
        reset()
        onOpenChange(false)
      } catch {
        toast.error('Greška pri slanju prijave')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'FOD' ? <AlertTriangle className="h-5 w-5 text-amber-600" /> : <Bird className="h-5 w-5 text-emerald-600" />}
            {type === 'FOD' ? 'Prijavi strani predmet (FOD)' : 'Prijavi divlju životinju'}
          </DialogTitle>
          <DialogDescription>
            {type === 'FOD'
              ? 'Kratka prijava — bez skeniranja opreme. Koristi se za sve strane predmete na manevarskim/apron površinama.'
              : 'Kratka prijava opažanja ili sudara sa divljom životinjom.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Lokacija *</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="npr. Stand A1, Taxiway B" required />
          </div>

          {type === 'FOD' ? (
            <>
              <div className="space-y-1.5">
                <Label>Tip predmeta</Label>
                <Select value={itemType} onValueChange={setItemType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FOD_ITEM_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Opis *</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Šta ste pronašli..." required />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer p-2 border rounded">
                <input type="checkbox" checked={aircraftPartSuspected} onChange={(e) => setAircraftPartSuspected(e.target.checked)} className="h-4 w-4" />
                Sumnja se da je dio vazduhoplova
              </label>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Vrsta *</Label>
                  <Input value={species} onChange={(e) => setSpecies(e.target.value)} placeholder="npr. galeb, lisica" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Broj jedinki</Label>
                  <Input type="number" min="1" value={count} onChange={(e) => setCount(e.target.value)} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer p-2 border rounded">
                <input type="checkbox" checked={strike} onChange={(e) => setStrike(e.target.checked)} className="h-4 w-4" />
                Došlo je do sudara sa vazduhoplovom
              </label>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Vaše ime *</Label>
            <Input value={foundByName} onChange={(e) => setFoundByName(e.target.value)} placeholder="Ime i prezime" required />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Pošalji prijavu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
