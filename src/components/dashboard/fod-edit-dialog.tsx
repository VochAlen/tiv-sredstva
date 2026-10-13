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
import { updateFodReport } from '@/lib/actions-safety-reports'
import { FOD_ITEM_TYPE_LABELS } from '@/lib/constants-export'
import { WILDLIFE_STATUS_LABELS } from './wildlife-edit-dialog'

export function FodEditDialog({ report, onSaved }: { report: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [location, setLocation] = useState(report.location)
  const [itemType, setItemType] = useState<string>(report.itemType ?? 'OTHER')
  const [description, setDescription] = useState(report.description)
  const [part, setPart] = useState(!!report.aircraftPartSuspected)
  const [atc, setAtc] = useState(!!report.atcNotified)
  const [removed, setRemoved] = useState(!!report.removed)
  const [status, setStatus] = useState<string>(report.status ?? 'NEW')
  const [notes, setNotes] = useState(report.adminNotes ?? '')
  const [pending, startTransition] = useTransition()

  const save = () => {
    startTransition(async () => {
      const r = await updateFodReport(report.id, {
        location, itemType, description, aircraftPartSuspected: part, atcNotified: atc, removed,
        status: status as 'NEW' | 'IN_REVIEW' | 'CLOSED', adminNotes: notes,
      })
      if (r.ok) { toast.success('Prijava sačuvana'); setOpen(false); onSaved() }
      else toast.error(r.error ?? 'Greška')
    })
  }

  const check = (label: string, value: boolean, set: (v: boolean) => void) => (
    <label className="flex items-center gap-2 text-sm p-2 border rounded cursor-pointer">
      <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Pencil className="h-3.5 w-3.5 mr-1" />Uredi</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>FOD prijava</DialogTitle></DialogHeader>
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
          <div className="space-y-1.5"><Label>Lokacija</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Vrsta predmeta</Label>
            <Select value={itemType} onValueChange={setItemType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(FOD_ITEM_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Opis</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          {check('Sumnja se da je dio vazduhoplova', part, setPart)}
          {check('ATC je obaviješten', atc, setAtc)}
          {check('Predmet je uklonjen', removed, setRemoved)}
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
