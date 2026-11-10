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
import { AirportMap } from '@/components/airport-map'
import { useTx } from '@/lib/worker-en'
import { useLang } from '@/lib/lang-context'
import { WeatherPicker } from '@/components/weather-picker'
import { SPECIES, ZONES, toNorm, zoneById, type ZoneId } from '@/lib/airport-map'

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
  const tx = useTx()
  const { lang } = useLang()

  // FOD polja
  const [location, setLocation] = useState('')
  const [itemType, setItemType] = useState('OTHER')
  const [description, setDescription] = useState('')
  const [aircraftPartSuspected, setAircraftPartSuspected] = useState(false)
  // Nije "uklonjeno" dok radnik to ne potvrdi — prijava ne smije sama tvrditi da je predmet sklonjen
  const [removed, setRemoved] = useState(false)
  const [foundByName, setFoundByName] = useState('')

  // Wildlife polja
  const [species, setSpecies] = useState('') // slobodan tekst, samo za "Ostalo"
  const [speciesCode, setSpeciesCode] = useState('')
  const [zone, setZone] = useState<ZoneId | ''>('')
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const [weather, setWeather] = useState('')
  const [count, setCount] = useState('1')
  const [strike, setStrike] = useState(false)

  const reset = () => {
    setLocation(''); setItemType('OTHER'); setDescription(''); setAircraftPartSuspected(false); setRemoved(false); setFoundByName('')
    setSpecies(''); setSpeciesCode(''); setZone(''); setPoint(null); setWeather(''); setCount('1'); setStrike(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (type === 'FOD' && !location.trim()) {
      toast.error(tx('Popunite lokaciju'))
      return
    }
    if (!foundByName.trim()) {
      toast.error(tx('Unesite vaše ime'))
      return
    }
    if (type === 'FOD' && !description.trim()) {
      toast.error(tx('Opišite šta ste pronašli'))
      return
    }
    if (!weather) {
      toast.error(tx('Izaberite vremenske uslove'))
      return
    }
    if (type === 'WILDLIFE') {
      if (!speciesCode) { toast.error(tx('Izaberite vrstu životinje')); return }
      if (speciesCode === 'OTHER' && !species.trim()) { toast.error(tx('Upišite vrstu životinje')); return }
      if (!zone) { toast.error(tx('Označite lokaciju: dodirnite mapu ili izaberite zonu')); return }
    }

    startTransition(async () => {
      try {
        if (type === 'FOD') {
          await createFodReport({
            location, itemType, description, aircraftPartSuspected, removed,
            foundByName, weather,
          })
          toast.success(tx('FOD prijava poslana. Hvala!'))
        } else {
          await createWildlifeReport({
            species: speciesCode === 'OTHER' ? species : (SPECIES.find((x) => x.id === speciesCode)?.label ?? species),
            speciesCode, count: parseInt(count) || 1, zone: zone || undefined,
            ...(point ? toNorm(point.x, point.y) : {}),
            strike, weather, reportedByName: foundByName,
          })
          toast.success(tx('Prijava poslana. Hvala!'))
        }
        reset()
        onOpenChange(false)
      } catch {
        toast.error(tx('Greška pri slanju prijave'))
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className={type === 'WILDLIFE' ? 'max-w-xl max-h-[92vh] overflow-y-auto' : 'max-w-sm'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'FOD' ? <AlertTriangle className="h-5 w-5 text-amber-600" /> : <Bird className="h-5 w-5 text-emerald-600" />}
            {type === 'FOD' ? tx('Prijavi strani predmet (FOD)') : tx('Prijavi divlju životinju')}
          </DialogTitle>
          <DialogDescription>
            {type === 'FOD'
              ? tx('Kratka prijava — bez skeniranja opreme. Koristi se za sve strane predmete na manevarskim/apron površinama.')
              : tx('Izaberite vrstu i dodirnite mjesto na mapi. Gotovo za par sekundi.')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          {type === 'FOD' && (
            <div className="space-y-1.5">
              <Label>{tx('Lokacija *')}</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={tx('npr. Stand A1, Taxiway B')} required />
            </div>
          )}

          {type === 'FOD' ? (
            <>
              <div className="space-y-1.5">
                <Label>{tx('Tip predmeta')}</Label>
                <Select value={itemType} onValueChange={setItemType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FOD_ITEM_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{tx(v)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{tx('Opis *')}</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={tx('Šta ste pronašli...')} required />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer p-2 border rounded">
                <input type="checkbox" checked={aircraftPartSuspected} onChange={(e) => setAircraftPartSuspected(e.target.checked)} className="h-4 w-4" />
                {tx('Sumnja se da je dio vazduhoplova')}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer p-2 border rounded">
                <input type="checkbox" checked={removed} onChange={(e) => setRemoved(e.target.checked)} className="h-4 w-4" />
                {tx('Predmet sam već uklonio/la')}
              </label>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>{tx('1. Vrsta *')}</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {SPECIES.map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => setSpeciesCode(sp.id)}
                      className={`min-h-11 rounded-lg border-2 px-2 text-sm font-semibold text-left flex items-center gap-2 ${speciesCode === sp.id ? 'border-primary bg-primary/10' : 'border-border'}`}
                    >
                      <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: sp.color }} />
                      <span className="leading-tight">{tx(sp.short)}</span>
                    </button>
                  ))}
                </div>
                {speciesCode === 'OTHER' && (
                  <Input value={species} onChange={(e) => setSpecies(e.target.value)} placeholder={tx('Koja vrsta? (npr. kornjača, zmija)')} />
                )}
              </div>

              <div className="space-y-1.5">
                <Label>{lang === 'en' ? '2. Where? *' : '2. Gdje? *'} <span className="font-normal text-muted-foreground">{lang === 'en' ? 'tap the map or choose a zone' : 'dodirnite mapu ili izaberite zonu'}</span></Label>
                <AirportMap
                  mode="pick"
                  selectedZone={zone || null}
                  point={point}
                  onPick={({ x, y, zone: z }) => { setPoint({ x, y }); setZone(z) }}
                />
                <div className="grid grid-cols-3 gap-1.5">
                  {ZONES.map((z) => (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => { setZone(z.id); setPoint(null) }}
                      className={`min-h-11 rounded-lg border-2 px-2 text-sm font-semibold ${zone === z.id ? 'border-primary bg-primary/10' : 'border-border'}`}
                    >
                      {tx(z.short)}
                    </button>
                  ))}
                </div>
                {zone && <p className="text-xs text-muted-foreground">{lang === 'en' ? 'Selected' : 'Izabrano'}: <b>{tx(zoneById(zone)?.label ?? '')}</b>{point ? (lang === 'en' ? ' (point marked on the map)' : ' (tačka označena na mapi)') : ''}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2 items-end">
                <div className="space-y-1.5">
                  <Label>{tx('Broj jedinki')}</Label>
                  <Input type="number" min="1" value={count} onChange={(e) => setCount(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer p-2 border rounded min-h-10">
                  <input type="checkbox" checked={strike} onChange={(e) => setStrike(e.target.checked)} className="h-4 w-4" />
                  {tx('Sudar sa vazduhoplovom')}
                </label>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>{type === 'WILDLIFE' ? '3. ' : ''}{tx('Vremenski uslovi *')}</Label>
            <WeatherPicker value={weather} onChange={setWeather} />
          </div>

          <div className="space-y-1.5">
            <Label>{tx('Vaše ime *')}</Label>
            <Input value={foundByName} onChange={(e) => setFoundByName(e.target.value)} placeholder={tx('Ime i prezime')} required />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{tx('Odustani')}</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tx('Pošalji prijavu')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
