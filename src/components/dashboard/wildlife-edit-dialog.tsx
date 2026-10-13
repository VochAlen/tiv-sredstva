'use client'

import { useState, useTransition } from 'react'
import { Pencil, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { updateWildlifeReport } from '@/lib/actions-safety-reports'

export const WILDLIFE_STATUS_LABELS: Record<string, string> = {
  NEW: 'Novo',
  IN_REVIEW: 'U obradi',
  CLOSED: 'Zatvoreno',
}

export function WildlifeEditDialog({ report, onSaved }: { report: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [species, setSpecies] = useState(report.species)
  const [count, setCount] = useState(String(report.count ?? 1))
  const [location, setLocation] = useState(report.location)
  const [strike, setStrike] = useState(!!report.strike)
  const [actionTaken, setActionTaken] = useState(report.actionTaken ?? '')
  const [damage, setDamage] = useState(report.damageDescription ?? '')
  const [status, setStatus] = useState<string>(report.status ?? 'NEW')
  const [notes, setNotes] = useState(report.adminNotes ?? '')
  const [pending, startTransition] = useTransition()

  const save = () => {
    startTransition(async () => {
      const r = await updateWildlifeReport(report.id, {
        species, count: parseInt(count, 10), location, strike,
        actionTaken, damageDescription: damage,
        status: status as 'NEW' | 'IN_REVIEW' | 'CLOSED', adminNotes: notes,
      })
      if (r.ok) { toast.success('Prijava sačuvana'); setOpen(false); onSaved() }
      else toast.error(r.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Pencil className="h-3.5 w-3.5 mr-1" />Uredi</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Wildlife prijava</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Status obrade</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(WILDLIFE_STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Vrsta</Label><Input value={species} onChange={(e) => setSpecies(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Broj jedinki</Label><Input type="number" min="1" value={count} onChange={(e) => setCount(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Lokacija</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm p-2 border rounded cursor-pointer">
            <input type="checkbox" checked={strike} onChange={(e) => setStrike(e.target.checked)} className="h-4 w-4" />
            Došlo je do sudara sa vazduhoplovom
          </label>
          <div className="space-y-1.5"><Label>Preduzeta mjera</Label><Textarea rows={2} value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} placeholder="npr. otjerano, prijavljeno nadležnom organu" /></div>
          <div className="space-y-1.5"><Label>Oštećenje (ako ima)</Label><Textarea rows={2} value={damage} onChange={(e) => setDamage(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Napomena admina</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Otkaži</Button>
          <Button onClick={save} disabled={pending}>{pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sačuvaj</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
