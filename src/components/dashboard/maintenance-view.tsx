'use client'

import { useEffect, useState, useTransition } from 'react'
import { Wrench, Plus, Loader2, Calendar, Award, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  getMaintenanceLogs, createMaintenanceLog,
  getQualifications, createQualification,
} from '@/lib/actions-advanced'
import {
  MAINTENANCE_TYPE_LABELS, MAINTENANCE_STATUS_LABELS, MAINTENANCE_STATUS_COLORS,
  QUALIFICATION_LEVEL_LABELS,
} from '@/lib/types-advanced'
import { EQUIPMENT_TYPE_LABELS } from '@/lib/types'

type MaintenanceLog = Awaited<ReturnType<typeof getMaintenanceLogs>>[number]
type Qualification = Awaited<ReturnType<typeof getQualifications>>[number]

export function MaintenanceView() {
  const [tab, setTab] = useState<'logs' | 'qualifications'>('logs')
  const [logs, setLogs] = useState<MaintenanceLog[]>([])
  const [qualifications, setQualifications] = useState<Qualification[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const load = async () => {
    setLoading(true)
    try {
      const [l, q] = await Promise.all([
        getMaintenanceLogs(),
        getQualifications(),
      ])
      setLogs(l)
      setQualifications(q)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Održavanje i kvalifikacije
          </h2>
          <p className="text-sm text-muted-foreground">
            EASA Part-145 compliance · IATA AHM 1110 operator qualifications
          </p>
        </div>
        <div className="flex gap-2">
          {tab === 'logs' ? <AddMaintenanceDialog onCreated={load} /> : <AddQualificationDialog onCreated={load} />}
        </div>
      </div>

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab('logs')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === 'logs' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Wrench className="h-4 w-4 inline mr-1.5" />
          Maintenance Log ({logs.length})
        </button>
        <button
          onClick={() => setTab('qualifications')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === 'qualifications' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Award className="h-4 w-4 inline mr-1.5" />
          Kvalifikacije ({qualifications.length})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tab === 'logs' ? (
        <MaintenanceLogsList logs={logs} />
      ) : (
        <QualificationsList qualifications={qualifications} />
      )}
    </div>
  )
}

function MaintenanceLogsList({ logs }: { logs: MaintenanceLog[] }) {
  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Wrench className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema zabilježenih aktivnosti održavanja.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <Card key={log.id} className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs">
                  {log.equipmentCode}
                </Badge>
                <Badge className="text-xs">
                  {MAINTENANCE_TYPE_LABELS[log.maintenanceType as keyof typeof MAINTENANCE_TYPE_LABELS] ?? log.maintenanceType}
                </Badge>
                <Badge className={`text-xs ${MAINTENANCE_STATUS_COLORS[log.status as keyof typeof MAINTENANCE_STATUS_COLORS] ?? ''}`}>
                  {MAINTENANCE_STATUS_LABELS[log.status as keyof typeof MAINTENANCE_STATUS_LABELS] ?? log.status}
                </Badge>
              </div>
              <div className="text-sm font-medium">{log.equipmentName}</div>
              <div className="text-sm text-muted-foreground mt-1">{log.description}</div>

              <div className="text-xs text-muted-foreground mt-2 flex items-center gap-3 flex-wrap">
                {log.performedBy && <span>Izveo: {log.performedBy}</span>}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(log.performedAt).toLocaleDateString('hr-HR')}
                </span>
                {log.certificateNumber && <span>Certifikat: {log.certificateNumber}</span>}
                {log.cost != null && <span>Trošak: {log.cost}€</span>}
                {log.durationHours != null && <span>Trajanje: {log.durationHours}h</span>}
              </div>

              {log.partsReplaced && (
                <div className="text-xs mt-1 p-2 bg-muted/30 rounded">
                  <strong>Zamijenjeni dijelovi:</strong> {log.partsReplaced}
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function QualificationsList({ qualifications }: { qualifications: Qualification[] }) {
  if (qualifications.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Award className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema zabilježenih kvalifikacija.</p>
          <p className="text-xs mt-1">Dodajte kvalifikacije da biste kontrolisali ko može upravljati kojom opremom.</p>
        </CardContent>
      </Card>
    )
  }

  const today = new Date()

  return (
    <div className="space-y-2">
      {qualifications.map((q) => {
        const isExpired = q.validUntil && new Date(q.validUntil) < today
        const isExpiringSoon = q.validUntil && !isExpired &&
          Math.floor((new Date(q.validUntil).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) <= 30

        return (
          <Card key={q.id} className={`p-4 ${isExpired ? 'border-red-300 bg-red-50' : isExpiringSoon ? 'border-amber-300 bg-amber-50' : ''}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant="outline" className="font-mono text-xs">{q.employeeCardId}</Badge>
                  <span className="font-medium">{q.employeeName}</span>
                  <Badge variant="secondary" className="text-xs">
                    {EQUIPMENT_TYPE_LABELS[q.equipmentType as keyof typeof EQUIPMENT_TYPE_LABELS] ?? q.equipmentType}
                  </Badge>
                  <Badge className="text-xs bg-purple-100 text-purple-800">
                    {QUALIFICATION_LEVEL_LABELS[q.qualificationLevel as keyof typeof QUALIFICATION_LEVEL_LABELS] ?? q.qualificationLevel}
                  </Badge>
                </div>

                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                  {q.trainedAt && <span>Obučen: {new Date(q.trainedAt).toLocaleDateString('hr-HR')}</span>}
                  {q.validUntil && (
                    <span className={isExpired ? 'text-red-700 font-medium' : isExpiringSoon ? 'text-amber-700 font-medium' : ''}>
                      Važi do: {new Date(q.validUntil).toLocaleDateString('hr-HR')}
                      {isExpired && ' (ISTEKLA)'}
                      {isExpiringSoon && ' (USKORO ISTIČE)'}
                    </span>
                  )}
                  {q.certifiedBy && <span>Certifikovao: {q.certifiedBy}</span>}
                  {q.certificateNumber && <span>Certifikat: {q.certificateNumber}</span>}
                </div>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function AddMaintenanceDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [equipmentCode, setEquipmentCode] = useState('')
  const [maintenanceType, setMaintenanceType] = useState<'PREVENTIVE' | 'CORRECTIVE' | 'INSPECTION' | 'OVERHAUL'>('PREVENTIVE')
  const [description, setDescription] = useState('')
  const [performedBy, setPerformedBy] = useState('')
  const [certificateNumber, setCertificateNumber] = useState('')
  const [partsReplaced, setPartsReplaced] = useState('')
  const [cost, setCost] = useState('')
  const [durationHours, setDurationHours] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        // Find equipment ID from code
        const { getEquipmentByCode } = await import('@/lib/actions')
        const eq = await getEquipmentByCode(equipmentCode.toUpperCase())
        if (!eq) {
          toast.error('Oprema nije pronađena')
          return
        }
        const res = await createMaintenanceLog({
          equipmentId: eq.id,
          maintenanceType,
          description,
          performedBy: performedBy || undefined,
          certificateNumber: certificateNumber || undefined,
          partsReplaced: partsReplaced || undefined,
          cost: cost ? parseFloat(cost) : undefined,
          durationHours: durationHours ? parseFloat(durationHours) : undefined,
        })
        if (res.ok) {
          toast.success('Aktivnost održavanja zabilježena')
          setOpen(false)
          setEquipmentCode('')
          setDescription('')
          setPerformedBy('')
          setCertificateNumber('')
          setPartsReplaced('')
          setCost('')
          setDurationHours('')
          onCreated()
        } else {
          toast.error(res.error ?? 'Greška')
        }
      } catch (e: any) {
        toast.error(`Greška: ${e?.message ?? e}`)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Novi log
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Zabilježi aktivnost održavanja</DialogTitle>
          <DialogDescription>EASA Part-145 compliance log</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="space-y-1.5">
            <Label htmlFor="eq-code">Kod opreme *</Label>
            <Input
              id="eq-code"
              value={equipmentCode}
              onChange={(e) => setEquipmentCode(e.target.value.toUpperCase())}
              placeholder="GSE-TOW-001"
              className="font-mono"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tip održavanja</Label>
            <Select value={maintenanceType} onValueChange={(v) => setMaintenanceType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(MAINTENANCE_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-desc">Opis *</Label>
            <Textarea
              id="m-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="npr. Godišnji pregled - zamjena ulja, filtera i provjera kočionog sistema"
              rows={3}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="m-by">Izveo</Label>
              <Input id="m-by" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} placeholder="Ana Novak" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-cert">Broj certifikata</Label>
              <Input id="m-cert" value={certificateNumber} onChange={(e) => setCertificateNumber(e.target.value)} placeholder="MAINT-2026-001" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="m-cost">Trošak (€)</Label>
              <Input id="m-cost" type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-dur">Trajanje (sati)</Label>
              <Input id="m-dur" type="number" step="0.1" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-parts">Zamijenjeni dijelovi</Label>
            <Textarea
              id="m-parts"
              value={partsReplaced}
              onChange={(e) => setPartsReplaced(e.target.value)}
              placeholder="npr. Ulje Motul 5W-40 (10L), filter ulja OEM-12345, kočione pločice"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sačuvaj
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddQualificationDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [employeeCardId, setEmployeeCardId] = useState('')
  const [employeeName, setEmployeeName] = useState('')
  const [equipmentType, setEquipmentType] = useState('TOW_TRACTOR')
  const [qualificationLevel, setQualificationLevel] = useState<'OPERATOR' | 'SENIOR' | 'INSTRUCTOR'>('OPERATOR')
  const [trainedAt, setTrainedAt] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [certifiedBy, setCertifiedBy] = useState('')
  const [certificateNumber, setCertificateNumber] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        const res = await createQualification({
          employeeCardId: employeeCardId.toUpperCase(),
          employeeName,
          equipmentType,
          qualificationLevel,
          trainedAt: trainedAt || undefined,
          validUntil: validUntil || undefined,
          certifiedBy: certifiedBy || undefined,
          certificateNumber: certificateNumber || undefined,
        })
        if (res.ok) {
          toast.success('Kvalifikacija dodana')
          setOpen(false)
          setEmployeeCardId('')
          setEmployeeName('')
          setTrainedAt('')
          setValidUntil('')
          setCertifiedBy('')
          setCertificateNumber('')
          onCreated()
        } else {
          toast.error('Greška pri dodavanju kvalifikacije')
        }
      } catch (e: any) {
        toast.error(`Greška: ${e?.message ?? e}`)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Nova kvalifikacija
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dodaj kvalifikaciju</DialogTitle>
          <DialogDescription>IATA AHM 1110 - samo obučeno osoblje može upravljati opremom</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="q-card">Broj ID kartice *</Label>
              <Input id="q-card" value={employeeCardId} onChange={(e) => setEmployeeCardId(e.target.value.toUpperCase())} placeholder="EMP-1001" className="font-mono" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-name">Ime i prezime *</Label>
              <Input id="q-name" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} placeholder="Vukan Vojvodić" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Tip opreme</Label>
              <Select value={equipmentType} onValueChange={setEquipmentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EQUIPMENT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nivo</Label>
              <Select value={qualificationLevel} onValueChange={(v) => setQualificationLevel(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(QUALIFICATION_LEVEL_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="q-trained">Obuka završena</Label>
              <Input id="q-trained" type="date" value={trainedAt} onChange={(e) => setTrainedAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-valid">Važi do</Label>
              <Input id="q-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="q-by">Certifikovao</Label>
              <Input id="q-by" value={certifiedBy} onChange={(e) => setCertifiedBy(e.target.value)} placeholder="Training Center" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-cert">Broj certifikata</Label>
              <Input id="q-cert" value={certificateNumber} onChange={(e) => setCertificateNumber(e.target.value)} placeholder="CERT-2026-001" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sačuvaj
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
