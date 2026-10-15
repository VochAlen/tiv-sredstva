'use client'

import { useEffect, useState, useTransition } from 'react'
import { ScanLine, Wrench, Repeat, BarChart3, Plus, Loader2, Calendar, Award, FileText, Search, Download, AlertOctagon, User, Pencil, Trash2 } from 'lucide-react'
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
import { getOpenDamages, updateDamageStatus } from '@/lib/actions'
import { getInspectionAlerts } from '@/lib/actions-advanced'
import { filterDueThisMonth, type InspectionAlertLike } from '@/lib/maintenance-due'
import {
  MAINTENANCE_TYPE_LABELS, MAINTENANCE_STATUS_LABELS, MAINTENANCE_STATUS_COLORS,
  QUALIFICATION_LEVEL_LABELS,
} from '@/lib/types-advanced'
import { EQUIPMENT_TYPE_LABELS } from '@/lib/types'
import { DamageRowCard } from '@/components/dashboard/damage-row-card'
import { QrScanner } from '@/components/worker/qr-scanner'
import { EquipmentRecordDialog } from '@/components/dashboard/equipment-record-dialog'
import { normalizeScan } from '@/lib/scan'
import { DowntimeView } from '@/components/dashboard/downtime-view'
import { WorkshopBoard } from '@/components/dashboard/workshop-board'
import { getRepeatDefects } from '@/lib/actions-workshop-extras'
import { REPEAT_ADVICE, REPEAT_WINDOW_DAYS, type RepeatGroup } from '@/lib/repeat-defects'
import { staleInfo } from '@/lib/workshop'
import { updateMaintenanceLog, updateQualification, deleteQualification, updateDamageReport } from '@/lib/actions-admin-edit'
import type { AppUser } from '@/lib/auth-server'
import { CHECKLIST_CATEGORY_ORDER, CHECKLIST_CATEGORY_LABELS } from '@/lib/types'
import { getDamageUrgency, URGENCY_LABELS, URGENCY_COLORS, type DamageUrgency } from '@/lib/damage-urgency'

type MaintenanceLog = Awaited<ReturnType<typeof getMaintenanceLogs>>[number]
type Qualification = Awaited<ReturnType<typeof getQualifications>>[number]
type OpenDamage = Awaited<ReturnType<typeof getOpenDamages>>[number]

export function MaintenanceView({ currentUser }: { currentUser: AppUser }) {
  const isAdmin = currentUser.role === 'admin'
  const [tab, setTab] = useState<'faults' | 'workshop' | 'logs' | 'qualifications' | 'downtime'>('faults')
  const [tabChosen, setTabChosen] = useState(false)
  const [damages, setDamages] = useState<OpenDamage[]>([])
  const [logs, setLogs] = useState<MaintenanceLog[]>([])
  const [qualifications, setQualifications] = useState<Qualification[]>([])
  const [inspectionAlerts, setInspectionAlerts] = useState<InspectionAlertLike[]>([])
  const [repeats, setRepeats] = useState<RepeatGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [scanOpen, setScanOpen] = useState(false)
  const [scanCode, setScanCode] = useState<string | null>(null)
  const [recordCode, setRecordCode] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [d, l, q, ia, rp] = await Promise.all([
        getOpenDamages(),
        getMaintenanceLogs(),
        getQualifications(),
        getInspectionAlerts(),
        getRepeatDefects().catch(() => [] as RepeatGroup[]),
      ])
      setRepeats(rp)
      // Prvi put: ako nema novih prijava, a ima sredstava u radionici, odmah prikaži radionicu
      if (!tabChosen && !d.some((x) => x.status === 'OPEN') && d.some((x) => x.status === 'IN_REPAIR' || x.status === 'AWAITING_APPROVAL')) setTab('workshop')
      setDamages(d)
      setLogs(l)
      setQualifications(q)
      setInspectionAlerts(ia)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const dueThisMonth = filterDueThisMonth(inspectionAlerts)

  useEffect(() => { load() }, [])

  // QR na vozilu -> odmah kartica kvara sa velikim dugmetom sljedećeg koraka;
  // ako sredstvo nema otvoren kvar, otvara se njegov karton.
  const scanMatches = scanCode ? damages.filter((d) => d.equipmentCode.toUpperCase() === scanCode) : []
  // Vodič se crta u pregledniku (lazy import) - bez servera i bez troška na Vercelu
  const openGuide = async () => {
    try {
      const { buildWorkshopGuidePdf } = await import('@/lib/pdf-workshop-guide')
      const bytes = await buildWorkshopGuidePdf(`${window.location.origin}/dashboard`)
      window.open(URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' })), '_blank')
    } catch (e) { console.error(e); toast.error('Vodič nije generisan') }
  }
  const onScanned = (raw: string) => {
    const code = normalizeScan(raw)
    if (!code) return
    setScanOpen(false)
    if (damages.some((d) => d.equipmentCode.toUpperCase() === code)) setScanCode(code)
    else setRecordCode(code)
  }

  return (
    <div className="space-y-4">
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skeniraj QR na vozilu</DialogTitle>
            <DialogDescription>Otvorit će se kartica kvara tog sredstva.</DialogDescription>
          </DialogHeader>
          {scanOpen && <QrScanner onScan={onScanned} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!scanCode} onOpenChange={(o) => { if (!o) setScanCode(null) }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{scanCode}</DialogTitle>
            <DialogDescription>Kartica kvara — sljedeći korak je veliko dugme ispod.</DialogDescription>
          </DialogHeader>
          {scanMatches.map((d) => (
            <DamageRowCard key={d.id} damage={d as any} onResolved={() => { load() }} currentUser={currentUser} repeats={repeats} />
          ))}
          <Button variant="outline" onClick={() => { const c = scanCode; setScanCode(null); setRecordCode(c) }}>Otvori karton sredstva</Button>
        </DialogContent>
      </Dialog>
      <EquipmentRecordDialog code={recordCode} onClose={() => setRecordCode(null)} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Radionica
          </h2>
          <p className="text-sm text-muted-foreground">
            Novi kvarovi, sredstva u radionici i povratak u rad
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="h-11" onClick={() => setScanOpen(true)}><ScanLine className="h-4 w-4 mr-2" />Skeniraj QR</Button>
          <Button variant="outline" className="h-11" onClick={openGuide}><FileText className="h-4 w-4 mr-2" />Vodič (PDF)</Button>
          {tab === 'logs' ? <AddMaintenanceDialog onCreated={load} /> : tab === 'qualifications' ? <AddQualificationDialog onCreated={load} /> : null}
        </div>
      </div>

      {dueThisMonth.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-700" />
              Dospijeva ovog mjeseca ({dueThisMonth.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {dueThisMonth.slice(0, 12).map((a) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs border ${a.status === 'OVERDUE' ? 'bg-red-100 border-red-300 text-red-800' : 'bg-amber-100 border-amber-300 text-amber-800'}`}
                >
                  <span className="font-mono font-semibold">{a.code}</span>
                  <span>{a.status === 'OVERDUE' ? `isteklo ${Math.abs(a.daysUntilDue ?? 0)}d` : `za ${a.daysUntilDue}d`}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 border-b">
        <button
          onClick={() => { setTab('faults'); setTabChosen(true) }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === 'faults' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <AlertOctagon className="h-4 w-4 inline mr-1.5" />
          Novi kvarovi ({damages.filter((x) => x.status === 'OPEN').length})
        </button>
        <button
          onClick={() => { setTab('workshop'); setTabChosen(true) }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === 'workshop' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Wrench className="h-4 w-4 inline mr-1.5" />
          U radionici ({damages.filter((x) => x.status === 'IN_REPAIR' || x.status === 'AWAITING_APPROVAL').length})
        </button>
        <button
          onClick={() => setTab('downtime')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === 'downtime' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <BarChart3 className="h-4 w-4 inline mr-1.5" />
          Zastoji
        </button>
        <button
          onClick={() => setTab('logs')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === 'logs' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Wrench className="h-4 w-4 inline mr-1.5" />
          Evidencija održavanja ({logs.length})
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
      ) : tab === 'faults' ? (
        <>
          <RepeatSummary groups={repeats} />
          <OpenFaultsList damages={damages.filter((x) => x.status === 'OPEN')} onChanged={load} currentUser={currentUser} repeats={repeats} />
        </>
      ) : tab === 'workshop' ? (
        <WorkshopBoard damages={damages as any} onChanged={load} currentUser={currentUser} repeats={repeats} />
      ) : tab === 'downtime' ? (
        <DowntimeView />
      ) : tab === 'logs' ? (
        <MaintenanceLogsList logs={logs} isAdmin={isAdmin} onChanged={load} />
      ) : (
        <QualificationsList qualifications={qualifications} isAdmin={isAdmin} onChanged={load} />
      )}
    </div>
  )
}

const URGENCY_ORDER: Record<DamageUrgency, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

// Prijave kvarova koje je osoblje unijelo prilikom jutarnjeg pregleda
// (zaduživanje/razduživanje GSE) - automatski se pojavljuju ovdje, bez
// dodatnog koraka, sortirane po hitnosti (najhitnije prvo), da
// održavanje odmah vidi koje sredstvo i koji dio je u kvaru.
function RepeatSummary({ groups }: { groups: RepeatGroup[] }) {
  if (groups.length === 0) return null
  return (
    <Card className="border-2 border-orange-400 bg-orange-50/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-orange-950">
          <Repeat className="h-4 w-4" />
          Ponavljajući kvarovi — isti kvar 3+ puta u {REPEAT_WINDOW_DAYS} dana ({groups.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 pt-0 text-sm">
        {groups.map((g) => (
          <div key={g.kind + g.equipmentId + g.key} className="flex flex-wrap items-center gap-x-2 rounded-md bg-white px-2 py-1.5">
            <span className="font-mono font-semibold">{g.equipmentCode}</span>
            <span className="min-w-0 flex-1">{g.label} — <strong>{g.count}×</strong>{g.hasOpen ? ' (ima otvorenih)' : ''}</span>
            <span className="text-xs text-muted-foreground">{new Date(g.firstAt).toLocaleDateString('hr-HR')} – {new Date(g.lastAt).toLocaleDateString('hr-HR')}</span>
          </div>
        ))}
        <p className="text-xs text-orange-950">{REPEAT_ADVICE}</p>
      </CardContent>
    </Card>
  )
}

function OpenFaultsList({ damages, onChanged, currentUser, repeats }: { damages: OpenDamage[]; onChanged: () => void; currentUser: AppUser; repeats: RepeatGroup[] }) {
  const isAdmin = currentUser.role === 'admin'
  const [editing, setEditing] = useState<OpenDamage | null>(null)

  const sorted = [...damages].sort((a, b) => {
    const ua = getDamageUrgency({ severity: a.severity, equipmentStatus: a.equipment?.status, status: a.status, createdAt: a.createdAt })
    const ub = getDamageUrgency({ severity: b.severity, equipmentStatus: b.equipment?.status, status: b.status, createdAt: b.createdAt })
    if (URGENCY_ORDER[ua] !== URGENCY_ORDER[ub]) return URGENCY_ORDER[ua] - URGENCY_ORDER[ub]
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  if (sorted.length === 0) {
    return (
      <div className="space-y-2">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nema novih kvarova koji čekaju preuzimanje.
          </CardContent>
        </Card>
      </div>
    )
  }

  // Grupe po tome ŠTA treba uraditi (najhitnije prvo): upozorenje > čeka preuzimanje > u popravci > čeka pregled šefa
  const groups = (() => {
    const def = [
      { key: 'stale', title: 'UPOZORENJE — bez statusa 3+ dana, upišite status', cls: 'bg-red-600 text-white', pick: (d: OpenDamage) => staleInfo(d as any).due },
      { key: 'new', title: 'Čeka preuzimanje — pritisnite PREUZMI PRIJAVU', cls: 'bg-red-100 text-red-900', pick: (d: OpenDamage) => d.status === 'OPEN' },
      { key: 'repair', title: 'U popravci', cls: 'bg-amber-100 text-amber-900', pick: (d: OpenDamage) => d.status === 'IN_REPAIR' },
      { key: 'chief', title: 'Popravljeno — čeka pregled šefa službe', cls: 'bg-purple-100 text-purple-900', pick: (d: OpenDamage) => d.status === 'AWAITING_APPROVAL' },
    ]
    const left = new Set(sorted.map((d) => d.id))
    return def.map((g) => {
      const items = sorted.filter((d) => left.has(d.id) && g.pick(d))
      items.forEach((d) => left.delete(d.id))
      return { ...g, items }
    }).filter((g) => g.items.length > 0)
  })()

  // Ista kartica kao u "Neispravna sredstva": preuzmi → označi popravljeno → odobri (admin može i direktno riješiti)
  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <section key={g.key} className="space-y-2">
          <h3 className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold ${g.cls}`}>
            {g.title} <span className="rounded-full bg-white/70 px-2 text-xs">{g.items.length}</span>
          </h3>
          {g.items.map((d) => {
            const urgency = getDamageUrgency({ severity: d.severity, equipmentStatus: d.equipment?.status, status: d.status, createdAt: d.createdAt })
            return (
              <div key={d.id} className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-xs font-semibold ${URGENCY_COLORS[urgency]}`}>Hitnost: {URGENCY_LABELS[urgency]}</Badge>
                  {isAdmin && (
                    <Button size="sm" variant="outline" className="h-7 ml-auto" onClick={() => setEditing(d)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />Uredi kvar
                    </Button>
                  )}
                </div>
                <DamageRowCard damage={d as any} onResolved={onChanged} currentUser={currentUser} repeats={repeats} />
              </div>
            )
          })}
        </section>
      ))}
      {editing && <EditDamageDialog damage={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged() }} />}
    </div>
  )
}

function EditDamageDialog({ damage, onClose, onSaved }: { damage: OpenDamage; onClose: () => void; onSaved: () => void }) {
  const [description, setDescription] = useState(damage.description ?? '')
  const [severity, setSeverity] = useState<string>(damage.severity)
  const [category, setCategory] = useState<string>((damage as any).category ?? 'NONE')
  const [pending, startTransition] = useTransition()
  const save = () => startTransition(async () => {
    const r = await updateDamageReport(damage.id, {
      description, severity: severity as any, category: category === 'NONE' ? null : category,
    })
    if (!r.ok) { toast.error(r.error ?? 'Greška'); return }
    toast.success('Kvar izmijenjen')
    onSaved()
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Uredi kvar — {damage.equipmentCode}</DialogTitle>
          <DialogDescription>Izmjena se bilježi u audit trag.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Opis</Label><Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Težina</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MINOR">Manje</SelectItem>
                  <SelectItem value="MAJOR">Veće</SelectItem>
                  <SelectItem value="CRITICAL">Kritično</SelectItem>
                </SelectContent>
              </Select></div>
            <div className="space-y-1"><Label>Kategorija</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">—</SelectItem>
                  {CHECKLIST_CATEGORY_ORDER.map((c) => <SelectItem key={c} value={c}>{CHECKLIST_CATEGORY_LABELS[c]}</SelectItem>)}
                </SelectContent>
              </Select></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Otkaži</Button>
          <Button onClick={save} disabled={pending}>{pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Snimi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MaintenanceLogsList({ logs, isAdmin, onChanged }: { logs: MaintenanceLog[]; isAdmin: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState<MaintenanceLog | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const filtered = logs.filter((log) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [log.equipmentCode, log.equipmentName, log.description, log.performedBy, log.certificateNumber, log.partsReplaced].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (typeFilter !== 'ALL' && log.maintenanceType !== typeFilter) return false
    if (statusFilter !== 'ALL' && log.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-3">
      {/* Search & filters — always visible */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po izvođaču, opremi, opisu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Tip" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi tipovi</SelectItem>
            {Object.entries(MAINTENANCE_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            {Object.entries(MAINTENANCE_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/maintenance-log', '_blank')}>
          <Download className="h-4 w-4 mr-1.5" />PDF
        </Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {logs.length}</div>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Wrench className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nema zabilježenih aktivnosti održavanja.</p>
            <p className="text-xs mt-1">Kliknite "Novi log" da zabilježite prvu aktivnost.</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Wrench className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nema rezultata pretrage.</p>
            <p className="text-xs mt-1">Pokušajte sa drugim kriterijumima.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
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
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => setEditing(log)}>
                    <Pencil className="h-4 w-4 mr-1" />Uredi
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <EditLogDialog log={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged() }} />}
    </div>
  )
}


function EditLogDialog({ log, onClose, onSaved }: { log: MaintenanceLog; onClose: () => void; onSaved: () => void }) {
  const d10 = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : '')
  const [maintenanceType, setMaintenanceType] = useState<string>(log.maintenanceType)
  const [status, setStatus] = useState<string>(log.status)
  const [description, setDescription] = useState(log.description ?? '')
  const [performedBy, setPerformedBy] = useState(log.performedBy ?? '')
  const [certificateNumber, setCertificateNumber] = useState(log.certificateNumber ?? '')
  const [partsReplaced, setPartsReplaced] = useState(log.partsReplaced ?? '')
  const [cost, setCost] = useState(log.cost != null ? String(log.cost) : '')
  const [durationHours, setDurationHours] = useState(log.durationHours != null ? String(log.durationHours) : '')
  const [nextDueDate, setNextDueDate] = useState(d10(log.nextDueDate))
  const [pending, startTransition] = useTransition()
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))
  const save = () => {
    const c = num(cost), h = num(durationHours)
    if ((c !== null && !Number.isFinite(c)) || (h !== null && !Number.isFinite(h))) { toast.error('Trošak i trajanje moraju biti brojevi'); return }
    startTransition(async () => {
      const r = await updateMaintenanceLog(log.id, {
        maintenanceType: maintenanceType as any, status: status as any, description, performedBy,
        certificateNumber, partsReplaced, cost: c, durationHours: h, nextDueDate: nextDueDate || null,
      })
      if (!r.ok) { toast.error(r.error ?? 'Greška'); return }
      toast.success('Zapis izmijenjen')
      onSaved()
    })
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Uredi zapis — {log.equipmentCode}</DialogTitle>
          <DialogDescription>Zapisi se ne brišu: za poništenje postavite status „Otkazano“. Izmjena ide u audit trag.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Tip</Label>
              <Select value={maintenanceType} onValueChange={setMaintenanceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(MAINTENANCE_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1"><Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(MAINTENANCE_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          <div className="space-y-1"><Label>Opis</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Izvršio</Label><Input value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} /></div>
            <div className="space-y-1"><Label>Broj certifikata</Label><Input value={certificateNumber} onChange={(e) => setCertificateNumber(e.target.value)} /></div>
            <div className="space-y-1"><Label>Trošak (€)</Label><Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
            <div className="space-y-1"><Label>Trajanje (h)</Label><Input inputMode="decimal" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} /></div>
            <div className="space-y-1 col-span-2"><Label>Sljedeći rok</Label><Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Zamijenjeni dijelovi</Label><Input value={partsReplaced} onChange={(e) => setPartsReplaced(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Otkaži</Button>
          <Button onClick={save} disabled={pending}>{pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Snimi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function QualificationsList({ qualifications, isAdmin, onChanged }: { qualifications: Qualification[]; isAdmin: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState<Qualification | null>(null)
  const [, startDel] = useTransition()
  const remove = (q: Qualification) => {
    if (!window.confirm(`Obrisati kvalifikaciju ${q.employeeName} (${EQUIPMENT_TYPE_LABELS[q.equipmentType as keyof typeof EQUIPMENT_TYPE_LABELS] ?? q.equipmentType})?`)) return
    startDel(async () => {
      const r = await deleteQualification(q.id)
      if (!r.ok) { toast.error(r.error ?? 'Greška'); return }
      toast.success('Kvalifikacija obrisana')
      onChanged()
    })
  }
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const today = new Date()

  const getQualStatus = (q: Qualification): 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'NO_EXPIRY' => {
    if (!q.validUntil) return 'NO_EXPIRY'
    const d = new Date(q.validUntil)
    if (d < today) return 'EXPIRED'
    const days = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (days <= 30) return 'EXPIRING_SOON'
    return 'VALID'
  }

  const filtered = qualifications.filter((q) => {
    if (search) {
      const s = search.toLowerCase()
      const hay = [q.employeeName, q.employeeCardId, q.certificateNumber, q.certifiedBy].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(s)) return false
    }
    if (typeFilter !== 'ALL' && q.equipmentType !== typeFilter) return false
    if (statusFilter !== 'ALL') {
      const st = getQualStatus(q)
      if (st !== statusFilter) return false
    }
    return true
  })

  if (qualifications.length === 0) {
    // Even if no qualifications, show search bar so the user knows the feature exists
    return (
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pretraga po imenu, kartici, certifikatu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tip opreme" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Svi tipovi opreme</SelectItem>
              {Object.entries(EQUIPMENT_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Svi statusi</SelectItem>
              <SelectItem value="VALID">Važeće</SelectItem>
              <SelectItem value="EXPIRING_SOON">Ističe u 30 dana</SelectItem>
              <SelectItem value="EXPIRED">Istekle</SelectItem>
              <SelectItem value="NO_EXPIRY">Bez roka</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/qualifications', '_blank')}>
            <Download className="h-4 w-4 mr-1.5" />PDF
          </Button>
          <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {qualifications.length}</div>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Award className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nema zabilježenih kvalifikacija.</p>
            <p className="text-xs mt-1">Dodajte kvalifikacije da biste kontrolisali ko može upravljati kojom opremom.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po imenu, kartici, certifikatu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tip opreme" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi tipovi opreme</SelectItem>
            {Object.entries(EQUIPMENT_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            <SelectItem value="VALID">Važeće</SelectItem>
            <SelectItem value="EXPIRING_SOON">Ističe u 30 dana</SelectItem>
            <SelectItem value="EXPIRED">Istekle</SelectItem>
            <SelectItem value="NO_EXPIRY">Bez roka</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/qualifications', '_blank')}>
          <Download className="h-4 w-4 mr-1.5" />PDF
        </Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {qualifications.length}</div>
      </div>
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Award className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nema rezultata pretrage.</p>
            <p className="text-xs mt-1">Pokušajte sa drugim kriterijumima.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => {
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
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setEditing(q)}><Pencil className="h-4 w-4 mr-1" />Uredi</Button>
                      <Button size="sm" variant="outline" aria-label="Obriši" onClick={() => remove(q)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
      {editing && <EditQualificationDialog q={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged() }} />}
    </div>
  )
}

function EditQualificationDialog({ q, onClose, onSaved }: { q: Qualification; onClose: () => void; onSaved: () => void }) {
  const d10 = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : '')
  const [level, setLevel] = useState<string>(q.qualificationLevel)
  const [trainedAt, setTrainedAt] = useState(d10(q.trainedAt))
  const [validUntil, setValidUntil] = useState(d10(q.validUntil))
  const [certifiedBy, setCertifiedBy] = useState(q.certifiedBy ?? '')
  const [certificateNumber, setCertificateNumber] = useState(q.certificateNumber ?? '')
  const [pending, startTransition] = useTransition()
  const save = () => startTransition(async () => {
    const r = await updateQualification(q.id, {
      qualificationLevel: level as any, trainedAt: trainedAt || null, validUntil: validUntil || null,
      certifiedBy, certificateNumber,
    })
    if (!r.ok) { toast.error(r.error ?? 'Greška'); return }
    toast.success('Kvalifikacija izmijenjena')
    onSaved()
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Uredi kvalifikaciju — {q.employeeName}</DialogTitle>
          <DialogDescription>{EQUIPMENT_TYPE_LABELS[q.equipmentType as keyof typeof EQUIPMENT_TYPE_LABELS] ?? q.equipmentType} · {q.employeeCardId}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1 col-span-2"><Label>Nivo</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(QUALIFICATION_LEVEL_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1"><Label>Obučen</Label><Input type="date" value={trainedAt} onChange={(e) => setTrainedAt(e.target.value)} /></div>
          <div className="space-y-1"><Label>Važi do</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
          <div className="space-y-1"><Label>Certifikovao</Label><Input value={certifiedBy} onChange={(e) => setCertifiedBy(e.target.value)} /></div>
          <div className="space-y-1"><Label>Broj certifikata</Label><Input value={certificateNumber} onChange={(e) => setCertificateNumber(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Otkaži</Button>
          <Button onClick={save} disabled={pending}>{pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Snimi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
