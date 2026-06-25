'use client'

import { useEffect, useState, useTransition, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Package,
  Search,
  Filter,
  Plus,
  Edit3,
  AlertOctagon,
  Wrench,
  CheckCircle2,
  Activity,
  TrendingUp,
  Clock,
  Printer,
  RefreshCw,
  ChevronRight,
  Loader2,
  X,
  Hash,
  MapPin,
  User,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  EQUIPMENT_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  INSPECTION_RESULT_LABELS,
  type EquipmentStatus,
  type EquipmentType,
} from '@/lib/types'
import {
  getAllEquipment,
  getActiveAssignments,
  getRecentActivity,
  getOpenDamages,
  getAllDamages,
  updateEquipmentStatus,
  updateEquipment,
  createEquipment,
  resolveDamageReport,
  updateDamageStatus,
} from '@/lib/actions'
import type { AppUser } from '@/lib/auth-server'
import { useLang } from '@/lib/lang-context'
import { StatisticsView } from './statistics-view'
import { ReportsView } from './reports-view'
import { MaintenanceView } from './maintenance-view'

type EquipmentRow = Awaited<ReturnType<typeof getAllEquipment>>[number]
type ActiveAssignment = Awaited<ReturnType<typeof getActiveAssignments>>[number]
type ActivityRow = Awaited<ReturnType<typeof getRecentActivity>>[number]
type DamageRow = Awaited<ReturnType<typeof getOpenDamages>>[number]

export function DashboardView({ currentUser }: { currentUser: AppUser }) {
  const { t } = useLang()
  const [tab, setTab] = useState('overview')
  const [equipment, setEquipment] = useState<EquipmentRow[]>([])
  const [active, setActive] = useState<ActiveAssignment[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [damages, setDamages] = useState<DamageRow[]>([])
  const [allDamages, setAllDamages] = useState<DamageRow[]>([])
  const [loading, setLoading] = useState(true)

  // filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')

  const load = async () => {
    setLoading(true)
    try {
      const [eq, ac, act, od, ad] = await Promise.all([
        getAllEquipment(),
        getActiveAssignments(),
        getRecentActivity(100),
        getOpenDamages(),
        getAllDamages(),
      ])
      setEquipment(eq)
      setActive(ac)
      setActivity(act)
      setDamages(od)
      setAllDamages(ad)
    } catch (e) {
      toast.error('Greška pri učitavanju podataka')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    return equipment.filter((e) => {
      if (statusFilter !== 'ALL' && e.status !== statusFilter) return false
      if (typeFilter !== 'ALL' && e.type !== typeFilter) return false
      if (search) {
        const s = search.toLowerCase()
        return (
          e.code.toLowerCase().includes(s) ||
          e.name.toLowerCase().includes(s) ||
          (e.serialNumber?.toLowerCase().includes(s) ?? false) ||
          e.location.toLowerCase().includes(s)
        )
      }
      return true
    })
  }, [equipment, statusFilter, typeFilter, search])

  const stats = useMemo(() => {
    const total = equipment.length
    const available = equipment.filter((e) => e.status === 'AVAILABLE').length
    const assigned = equipment.filter((e) => e.status === 'ASSIGNED').length
    const oos = equipment.filter((e) => e.status === 'OUT_OF_SERVICE').length
    const maint = equipment.filter((e) => e.status === 'MAINTENANCE').length
    const openDamages = damages.length
    return { total, available, assigned, oos, maint, openDamages }
  }, [equipment, damages])

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview">
              <Activity className="h-4 w-4 mr-1.5" />
              {t('dash.overview')}
            </TabsTrigger>
            <TabsTrigger value="equipment">
              <Package className="h-4 w-4 mr-1.5" />
              {t('dash.equipment')}
            </TabsTrigger>
            <TabsTrigger value="damages">
              <AlertOctagon className="h-4 w-4 mr-1.5" />
              {t('dash.damages')}
              {stats.openDamages > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-5 px-1.5 text-xs">
                  {stats.openDamages}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="statistics">
              <TrendingUp className="h-4 w-4 mr-1.5" />
              {t('dash.statistics')}
            </TabsTrigger>
            <TabsTrigger value="maintenance">
              <Wrench className="h-4 w-4 mr-1.5" />
              {t('dash.maintenance')}
            </TabsTrigger>
            <TabsTrigger value="reports">
              <Printer className="h-4 w-4 mr-1.5" />
              {t('dash.reports')}
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Clock className="h-4 w-4 mr-1.5" />
              {t('dash.activity')}
            </TabsTrigger>
            <TabsTrigger value="qr">
              <Printer className="h-4 w-4 mr-1.5" />
              {t('dash.qr')}
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              {t('dash.refresh')}
            </Button>
            {currentUser.role === 'admin' && <AddEquipmentDialog onCreated={load} />}
          </div>
        </div>

        <TabsContent value="overview" className="space-y-4">
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label={t('dash.total')} value={stats.total} icon={Package} tone="default" />
            <StatCard label={t('dash.available')} value={stats.available} icon={CheckCircle2} tone="emerald" />
            <StatCard label={t('dash.assigned')} value={stats.assigned} icon={TrendingUp} tone="amber" />
            <StatCard label={t('dash.oos')} value={stats.oos} icon={AlertOctagon} tone="red" />
            <StatCard label={t('dash.maintenance')} value={stats.maint} icon={Wrench} tone="purple" />
            <StatCard label={t('dash.openDamages')} value={stats.openDamages} icon={AlertOctagon} tone="red" />
          </div>

          {/* Active assignments + Open damages */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Trenutno zadužena sredstva ({active.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {active.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Trenutno nema zaduženih sredstava
                  </p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {active.map((a) => (
                      <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge variant="outline" className="font-mono text-xs">{a.equipmentCode}</Badge>
                            <span className="text-sm font-medium truncate">{a.equipmentName}</span>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <User className="h-3 w-3" />
                            {a.employeeName} ({a.employeeCardId})
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground ml-2">
                          {new Date(a.timestamp).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertOctagon className="h-4 w-4" />
                  Otvorena oštećenja ({damages.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {damages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nema otvorenih oštećenja
                  </p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {damages.map((d) => (
                      <DamageRowCard key={d.id} damage={d} onResolved={load} compact />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="equipment" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pretraga po kodu, nazivu, S/N, lokaciji..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <Filter className="h-4 w-4 mr-1.5" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Svi statusi</SelectItem>
                    <SelectItem value="AVAILABLE">Dostupno</SelectItem>
                    <SelectItem value="ASSIGNED">Zaduženo</SelectItem>
                    <SelectItem value="OUT_OF_SERVICE">Neispravno</SelectItem>
                    <SelectItem value="MAINTENANCE">{t('status.maintenance')}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Tip" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Svi tipovi</SelectItem>
                    {Object.entries(EQUIPMENT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kod</TableHead>
                    <TableHead>Naziv</TableHead>
                    <TableHead className="hidden md:table-cell">Tip</TableHead>
                    <TableHead className="hidden lg:table-cell">Lokacija</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcije</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nema rezultata
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-xs">{e.code}</TableCell>
                        <TableCell>
                          <div className="font-medium">{e.name}</div>
                          {e.serialNumber && (
                            <div className="text-xs text-muted-foreground">S/N: {e.serialNumber}</div>
                          )}
                          {e.notes && (
                            <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{e.notes}</div>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="secondary" className="text-xs">
                            {EQUIPMENT_TYPE_LABELS[e.type as EquipmentType] ?? e.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {e.location}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${STATUS_COLORS[e.status as EquipmentStatus] ?? ''}`}>
                            {STATUS_LABELS[e.status as EquipmentStatus] ?? e.status}
                          </Badge>
                          {e._count?.damages > 0 && (
                            <Badge variant="destructive" className="ml-1 text-xs">
                              {e._count.damages} prijava
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {currentUser.role === 'admin' && (
                              <EditEquipmentDialog equipment={e} onUpdated={load} />
                            )}
                            {(currentUser.role === 'admin' || currentUser.role === 'engineer') && (
                              <ChangeStatusDialog equipmentId={e.id} currentStatus={e.status as EquipmentStatus} onUpdated={load} />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="damages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertOctagon className="h-4 w-4" />
                Sva oštećenja ({allDamages.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allDamages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nema prijavljenih oštećenja
                </p>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {allDamages.map((d) => (
                    <DamageRowCard key={d.id} damage={d} onResolved={load} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          <StatisticsView />
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <MaintenanceView />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <ReportsView />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Zadnje aktivnosti (zaduživanja i razduživanja)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nema zabilježenih aktivnosti
                </p>
              ) : (
                <div className="space-y-1 max-h-[600px] overflow-y-auto">
                  {activity.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/40">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${a.action === 'CHECK_OUT' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {a.action === 'CHECK_OUT' ? <TrendingUp className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">
                          <span className="font-medium">{a.employeeName}</span>
                          <span className="text-muted-foreground">
                            {' '}({a.employeeCardId}){' '}
                            {a.action === 'CHECK_OUT' ? 'zadužio/la' : 'razdužio/la'}
                          </span>
                          <span className="font-mono text-xs ml-1">{a.equipmentCode}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {a.equipmentName} · {INSPECTION_RESULT_LABELS[a.inspectionResult as keyof typeof INSPECTION_RESULT_LABELS] ?? a.inspectionResult}
                          {a.inspectionNotes && ` · ${a.inspectionNotes}`}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground flex-shrink-0">
                        {new Date(a.timestamp).toLocaleString('hr-HR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qr" className="space-y-4">
          <QrPrintView equipment={equipment} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// =====================================================
// STAT CARD
// =====================================================

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'emerald' | 'amber' | 'red' | 'purple'
}) {
  const toneClasses = {
    default: 'bg-card text-foreground',
    emerald: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    amber: 'bg-amber-50 text-amber-900 border-amber-200',
    red: 'bg-red-50 text-red-900 border-red-200',
    purple: 'bg-purple-50 text-purple-900 border-purple-200',
  }[tone]
  const iconColor = {
    default: 'text-muted-foreground',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    purple: 'text-purple-600',
  }[tone]
  return (
    <Card className={`${toneClasses} border`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </div>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </CardContent>
    </Card>
  )
}

// =====================================================
// ADD EQUIPMENT DIALOG
// =====================================================

function AddEquipmentDialog({ onCreated }: { onCreated: () => void }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<EquipmentType>('TOW_TRACTOR')
  const [serialNumber, setSerialNumber] = useState('')
  const [location, setLocation] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code || !name || !location) {
      toast.error('Kod, naziv i lokacija su obavezni')
      return
    }
    startTransition(async () => {
      const res = await createEquipment({
        code: code.toUpperCase(),
        name,
        type,
        serialNumber: serialNumber || undefined,
        location,
      })
      if (res.ok) {
        toast.success('Sredstvo kreirano')
        setOpen(false)
        setCode('')
        setName('')
        setSerialNumber('')
        setLocation('')
        onCreated()
      } else {
        toast.error(res.error ?? 'Greška')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          {t('dash.newEquipment')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dodaj novo GSE sredstvo</DialogTitle>
          <DialogDescription>Unesite podatke o novom vozilu ili opremi.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="add-code">Kod (jedinstven) *</Label>
            <Input id="add-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="GSE-XXX-001" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-name">Naziv *</Label>
            <Input id="add-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="npr. Tow Tractor Goldhofer AST-2" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Tip</Label>
              <Select value={type} onValueChange={(v) => setType(v as EquipmentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EQUIPMENT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-loc">Lokacija *</Label>
              <Input id="add-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Stand A1" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-sn">Serijski broj</Label>
            <Input id="add-sn" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Kreiraj
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================
// EDIT EQUIPMENT DIALOG
// =====================================================

function EditEquipmentDialog({
  equipment,
  onUpdated,
}: {
  equipment: EquipmentRow
  onUpdated: () => void
}) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(equipment.name)
  const [type, setType] = useState(equipment.type)
  const [location, setLocation] = useState(equipment.location)
  const [serialNumber, setSerialNumber] = useState(equipment.serialNumber ?? '')
  const [notes, setNotes] = useState(equipment.notes ?? '')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      setName(equipment.name)
      setType(equipment.type)
      setLocation(equipment.location)
      setSerialNumber(equipment.serialNumber ?? '')
      setNotes(equipment.notes ?? '')
    }
  }, [open, equipment])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      await updateEquipment({
        equipmentId: equipment.id,
        name,
        type,
        location,
        serialNumber: serialNumber || undefined,
        notes: notes || undefined,
      })
      toast.success('Ažurirano')
      setOpen(false)
      onUpdated()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit3 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Uredi sredstvo</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{equipment.code}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Naziv</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Tip</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EQUIPMENT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-loc">Lokacija</Label>
              <Input id="edit-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-sn">Serijski broj</Label>
            <Input id="edit-sn" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Napomene</Label>
            <Textarea id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Spremi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================
// CHANGE STATUS DIALOG
// =====================================================

function ChangeStatusDialog({
  equipmentId,
  currentStatus,
  onUpdated,
}: {
  equipmentId: string
  currentStatus: EquipmentStatus
  onUpdated: () => void
}) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<EquipmentStatus>(currentStatus)
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      setStatus(currentStatus)
      setNotes('')
    }
  }, [open, currentStatus])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      await updateEquipmentStatus({ equipmentId, status, notes: notes || undefined })
      toast.success('Status ažuriran')
      setOpen(false)
      onUpdated()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Promijeni status">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promijeni status sredstva</DialogTitle>
          <DialogDescription>
            Koristite kada je sredstvo popravljeno ili prebačeno na održavanje.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Novi status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as EquipmentStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AVAILABLE">Dostupno</SelectItem>
                <SelectItem value="ASSIGNED">Zaduženo</SelectItem>
                <SelectItem value="OUT_OF_SERVICE">Neispravno</SelectItem>
                <SelectItem value="MAINTENANCE">{t('status.maintenance')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status-notes">Napomene</Label>
            <Textarea id="status-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="npr. Popravljeno - zamijenjen kabel" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Spremi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================
// DAMAGE ROW CARD
// =====================================================

function DamageRowCard({
  damage,
  onResolved,
  compact = false,
}: {
  damage: DamageRow
  onResolved: () => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [resolution, setResolution] = useState('')
  const [setAvailable, setSetAvailable] = useState(true)
  const [isPending, startTransition] = useTransition()

  const severityBadge = {
    MINOR: 'bg-amber-100 text-amber-800',
    MAJOR: 'bg-orange-100 text-orange-800',
    CRITICAL: 'bg-red-100 text-red-800',
  }[damage.severity] ?? 'bg-gray-100'

  const statusBadge = {
    OPEN: 'bg-red-100 text-red-800',
    IN_REPAIR: 'bg-amber-100 text-amber-800',
    RESOLVED: 'bg-emerald-100 text-emerald-800',
  }[damage.status] ?? 'bg-gray-100'

  const handleResolve = (e: React.FormEvent) => {
    e.preventDefault()
    if (!resolution.trim()) {
      toast.error('Unesite opis popravke')
      return
    }
    startTransition(async () => {
      await resolveDamageReport({
        damageId: damage.id,
        resolution: resolution.trim(),
        setEquipmentAvailable: setAvailable,
      })
      toast.success('Prijava riješena')
      setOpen(false)
      setResolution('')
      onResolved()
    })
  }

  const handleStatusChange = async (newStatus: 'OPEN' | 'IN_REPAIR' | 'RESOLVED') => {
    startTransition(async () => {
      await updateDamageStatus({ damageId: damage.id, status: newStatus })
      toast.success('Status ažuriran')
      onResolved()
    })
  }

  return (
    <div className={`p-3 rounded-lg border ${damage.status === 'OPEN' ? 'border-red-200 bg-red-50/50' : damage.status === 'IN_REPAIR' ? 'border-amber-200 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">{damage.equipmentCode}</Badge>
            <Badge className={`text-xs ${severityBadge}`}>{damage.severity}</Badge>
            <Badge className={`text-xs ${statusBadge}`}>{damage.status}</Badge>
          </div>
          <div className="text-sm font-medium truncate">{damage.equipmentName}</div>
          <div className="text-sm text-muted-foreground mt-1">{damage.description}</div>
          {!compact && (
            <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1"><User className="h-3 w-3" />{damage.reportedByName}</span>
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(damage.createdAt).toLocaleString('hr-HR')}</span>
              {damage.resolvedAt && (
                <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3 w-3" />Riješeno {new Date(damage.resolvedAt).toLocaleDateString('hr-HR')}</span>
              )}
            </div>
          )}
          {damage.resolution && (
            <div className="text-xs text-emerald-700 mt-1.5 p-1.5 bg-emerald-50 rounded">
              <strong>Rješenje:</strong> {damage.resolution}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          {damage.status !== 'RESOLVED' && (
            <>
              <Select
                value={damage.status}
                onValueChange={(v) => handleStatusChange(v as 'OPEN' | 'IN_REPAIR' | 'RESOLVED')}
                disabled={isPending}
              >
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Otvoreno</SelectItem>
                  <SelectItem value="IN_REPAIR">U popravku</SelectItem>
                  <SelectItem value="RESOLVED">Riješeno</SelectItem>
                </SelectContent>
              </Select>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Riješi
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Riješi prijavu oštećenja</DialogTitle>
                    <DialogDescription>
                      Opišite šta je urađeno i odlučite da li da sredstvo bude vraćeno u dostupne.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleResolve} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="resol">Opis popravke / rješenja</Label>
                      <Textarea id="resol" value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3} placeholder="npr. Zamijenjen kabel, testirano OK" />
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={setAvailable}
                        onChange={(e) => setSetAvailable(e.target.checked)}
                        className="h-4 w-4"
                      />
                      Vrati sredstvo u status "Dostupno"
                    </label>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setOpen(false)}>Odustani</Button>
                      <Button type="submit" disabled={isPending}>
                        {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Potvrdi
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// =====================================================
// QR PRINT VIEW
// =====================================================

function QrPrintView({ equipment }: { equipment: EquipmentRow[] }) {
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin)
  }, [])

  const qrUrl = (code: string) => {
    if (!origin) return `?scan=${code}`
    return `${origin}/?scan=${code}`
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Printer className="h-4 w-4" />
          QR kodovi za štampu
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Štampajte QR kodove i nalijepite ih na vozila/opremu. Skeniranje bilo kojim QR čitačem (uključujući kameru telefona) otvara aplikaciju sa pred-popunjenim sredstvom.
        </p>
      </CardHeader>
      <CardContent>
        <Button onClick={handlePrint} className="mb-4">
          <Printer className="h-4 w-4 mr-2" />
          Štampaj sve
        </Button>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 print:grid-cols-3 print:gap-2">
          {equipment.map((e) => (
            <div
              key={e.id}
              className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-3 text-center print:break-inside-avoid"
            >
              <div className="flex justify-center mb-2">
                <QRCodeSVG
                  value={qrUrl(e.code)}
                  size={140}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <div className="font-mono text-xs font-bold">{e.code}</div>
              <div className="text-[10px] text-muted-foreground line-clamp-2 mt-1">{e.name}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{e.location}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
