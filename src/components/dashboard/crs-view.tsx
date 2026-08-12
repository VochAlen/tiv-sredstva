'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  Award, Plus, Loader2, CheckCircle2, XCircle, FileText, Clock, User,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { getAllCRS, createCRS, revokeCRS, type CRSData } from '@/lib/actions-crs'
import { getAllEquipment, getOpenDamages } from '@/lib/actions'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export function CrsView() {
  const [crsList, setCrsList] = useState<CRSData[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getAllCRS()
      setCrsList(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const validCount = crsList.filter((c) => c.status === 'VALID').length
  const revokedCount = crsList.filter((c) => c.status === 'REVOKED').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Award className="h-5 w-5" />
            Certificate of Release to Service
          </h2>
          <p className="text-sm text-muted-foreground">
            EASA Part-145.A.50 — Oprema ne može biti vraćena u upotrebu bez važećeg CRS
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Izdaj CRS
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-lg border bg-emerald-50 border-emerald-200">
          <div className="flex items-center justify-between">
            <div><div className="text-2xl font-bold text-emerald-700">{validCount}</div><div className="text-xs text-emerald-600">Važeći CRS</div></div>
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
        </div>
        <div className="p-4 rounded-lg border bg-red-50 border-red-200">
          <div className="flex items-center justify-between">
            <div><div className="text-2xl font-bold text-red-700">{revokedCount}</div><div className="text-xs text-red-600">Povučeni</div></div>
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
        </div>
        <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div><div className="text-2xl font-bold text-blue-700">{crsList.length}</div><div className="text-xs text-blue-600">Ukupno izdatih</div></div>
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
        </div>
      </div>

      {/* CRS List */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : crsList.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Award className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema izdatih CRS sertifikata.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {crsList.map((crs) => (
            <Card key={crs.id} className={'p-4 border-l-4 ' + (crs.status === 'VALID' ? 'border-l-emerald-500' : 'border-l-red-500')}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className="font-mono text-xs font-bold">{crs.crsNumber}</Badge>
                    <Badge variant="outline" className="font-mono text-xs">{crs.equipmentCode}</Badge>
                    <Badge className={'text-xs ' + (crs.status === 'VALID' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800')}>
                      {crs.status === 'VALID' ? '✓ VAŽEĆI' : '✗ POVUČEN'}
                    </Badge>
                  </div>
                  <div className="text-sm font-medium">{crs.equipmentName}</div>
                  <div className="text-sm text-muted-foreground mt-1">{crs.workDescription}</div>
                  {crs.workOrderNumber && <div className="text-xs text-muted-foreground mt-0.5">Radni nalog: {crs.workOrderNumber}</div>}
                  <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><User className="h-3 w-3" />{crs.certifierName} ({crs.certifierCardId})</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(crs.releaseDate).toLocaleDateString('hr-HR')}</span>
                    {crs.validUntil && (
                      <span className="flex items-center gap-1 text-amber-600"><Clock className="h-3 w-3" />Važi do: {new Date(crs.validUntil).toLocaleDateString('hr-HR')}</span>
                    )}
                  </div>
                  {crs.notes && <div className="text-xs mt-1 p-1.5 bg-muted/30 rounded">{crs.notes}</div>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create CRS Dialog */}
      <CreateCRSDialog open={showCreate} onOpenChange={setShowCreate} onCreated={load} />
    </div>
  )
}

function CreateCRSDialog({ open, onOpenChange, onCreated }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [equipmentId, setEquipmentId] = useState('')
  const [equipmentCode, setEquipmentCode] = useState('')
  const [equipmentName, setEquipmentName] = useState('')
  const [damageReportId, setDamageReportId] = useState('')
  const [workDescription, setWorkDescription] = useState('')
  const [workOrderNumber, setWorkOrderNumber] = useState('')
  const [certifierCardId, setCertifierCardId] = useState('')
  const [certifierName, setCertifierName] = useState('')
  const [notes, setNotes] = useState('')
  const [equipmentList, setEquipmentList] = useState<Array<{ id: string; code: string; name: string; status: string }>>([])
  const [damages, setDamages] = useState<Array<{ id: string; equipmentCode: string; description: string }>>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      Promise.all([getAllEquipment(), getOpenDamages()]).then(([eq, dm]) => {
        setEquipmentList(eq.map((e: any) => ({ id: e.id, code: e.code, name: e.name, status: e.status })))
        setDamages(dm.map((d: any) => ({ id: d.id, equipmentCode: d.equipmentCode, description: d.description })))
      })
    }
  }, [open])

  const handleSelectEquipment = (id: string) => {
    const eq = equipmentList.find((e) => e.id === id)
    if (eq) {
      setEquipmentId(eq.id)
      setEquipmentCode(eq.code)
      setEquipmentName(eq.name)
    }
  }

  const handleSelectDamage = (id: string) => {
    setDamageReportId(id)
    // Auto-fill work description iz damage report-a
    const dm = damages.find((d) => d.id === id)
    if (dm && !workDescription) {
      setWorkDescription(`Popravka oštećenja: ${dm.description.slice(0, 100)}`)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!equipmentId || !workDescription || !certifierCardId || !certifierName) {
      toast.error('Popunite sva obavezna polja')
      return
    }

    startTransition(async () => {
      try {
        const res = await createCRS({
          equipmentId,
          equipmentCode,
          equipmentName,
          damageReportId: damageReportId || undefined,
          workDescription,
          workOrderNumber: workOrderNumber || undefined,
          certifierCardId,
          certifierName,
          certifierRole: 'ENGINEER',
          notes: notes || undefined,
        })
        if (res.ok) {
          toast.success(`CRS ${res.crsNumber} izdat — oprema vraćena u upotrebu`)
          onOpenChange(false)
          setEquipmentId('')
          setEquipmentCode('')
          setEquipmentName('')
          setDamageReportId('')
          setWorkDescription('')
          setWorkOrderNumber('')
          setCertifierCardId('')
          setCertifierName('')
          setNotes('')
          onCreated()
        } else {
          toast.error('Greška pri izdavanju CRS')
        }
      } catch (e: any) {
        toast.error(`Greška: ${e?.message ?? e}`)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Award className="h-5 w-5" />Izdaj Certificate of Release to Service</DialogTitle>
          <DialogDescription>EASA Part-145.A.50 — Oprema će biti vraćena u AVAILABLE status</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Equipment */}
          <div className="space-y-1.5">
            <Label>Sredstvo *</Label>
            <Select value={equipmentId} onValueChange={handleSelectEquipment}>
              <SelectTrigger><SelectValue placeholder="Izaberite sredstvo..." /></SelectTrigger>
              <SelectContent>
                {equipmentList.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.code} — {e.name} ({e.status})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Poveži sa damage report-om (opciono) */}
          {damages.length > 0 && (
            <div className="space-y-1.5">
              <Label>Poveži sa prijavom oštećenja (opciono)</Label>
              <Select value={damageReportId} onValueChange={handleSelectDamage}>
                <SelectTrigger><SelectValue placeholder="Bez povezanja..." /></SelectTrigger>
                <SelectContent>
                  {damages.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.equipmentCode}: {d.description.slice(0, 50)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Work description */}
          <div className="space-y-1.5">
            <Label htmlFor="work-desc">Opis urađenog posla *</Label>
            <Textarea
              id="work-desc"
              value={workDescription}
              onChange={(e) => setWorkDescription(e.target.value)}
              rows={3}
              placeholder="npr. Zamijenjen kabel za napajanje, testirano pod opterećenjem, sve OK"
              required
            />
          </div>

          {/* Work order number */}
          <div className="space-y-1.5">
            <Label htmlFor="wo-num">Broj radnog naloga</Label>
            <Input id="wo-num" value={workOrderNumber} onChange={(e) => setWorkOrderNumber(e.target.value)} placeholder="WO-2026-001" />
          </div>

          {/* Certifier */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="cert-card">Broj kartice ovlaštene osobe *</Label>
              <Input id="cert-card" value={certifierCardId} onChange={(e) => setCertifierCardId(e.target.value.toUpperCase())} placeholder="EMP-1004" className="font-mono" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cert-name">Ime ovlaštene osobe *</Label>
              <Input id="cert-name" value={certifierName} onChange={(e) => setCertifierName(e.target.value)} placeholder="Milica Medenica" required />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="crs-notes">Napomene</Label>
            <Textarea id="crs-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Opciono..." />
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            ⚠️ Izdavanjem CRS-a, sredstvo će automatski biti vraćeno u status "Dostupno".
            {damageReportId && ' Prijavljenje oštećenje će biti označeno kao riješeno.'}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Izdaj CRS
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
