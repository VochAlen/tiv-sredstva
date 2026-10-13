'use client'

import { useEffect, useRef, useState, useTransition, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { printQrLabels, svgOf } from '@/lib/qr-print'
import { RestrictionBadges } from '@/components/restriction-badges'
import { DamageRowCard } from '@/components/dashboard/damage-row-card'
import { DailyListView, DailyStatsView, EquipmentReportView, InspectionLogView } from '@/components/dashboard/daily-reports-view'
import { OverviewDetailTable, type OverviewKind } from '@/components/dashboard/overview-detail-table'
import { deleteEquipment } from '@/lib/actions-admin-edit'
import {
  Package,
  Search,
  Filter,
  Plus,
  Edit3,
  AlertOctagon,
  ShieldCheck,
  Award,
  Calendar,
  Car,
  Fuel,
  Wrench,
  CheckCircle2,
  Activity,
  TrendingUp,
  Clock,
  Printer,
  Trash2,
  RefreshCw,
  ChevronRight,
  Loader2,
  X,
  Hash,
  MapPin,
  User,
  Snowflake,
  Plane,
  Shield,
  ClipboardCheck,
  ClipboardList,
  CalendarDays,
  FileText,
  AlertTriangle,
  Bird,
  ListChecks,
  Bell,
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
} from '@/components/ui/tabs'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  EQUIPMENT_TYPE_LABELS,
  EQUIPMENT_DEPARTMENT_LABELS,
  EQUIPMENT_DEPARTMENT_ORDER,
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
import type { TranslationKey } from '@/lib/i18n'
import { getDamageUrgency, URGENCY_LABELS, URGENCY_COLORS } from '@/lib/damage-urgency'
import { getInspectionAlerts } from '@/lib/actions-advanced'
import { filterDueThisMonth, type InspectionAlertLike } from '@/lib/maintenance-due'
import { HelpButton } from '@/components/ui/help-button'
import { StatisticsView } from './statistics-view'
import { ReportsView } from './reports-view'
import { MaintenanceView } from './maintenance-view'
import { AdrView } from './adr-view'
import { AccessControlDialog } from './access-control'
import { CrsView } from './crs-view'
import { SchedulingView } from './scheduling-view'
import { IncidentsView } from './incidents-view'
import { DriverAuthView } from './driver-auth-view'
import { FuelParkingView } from './fuel-parking-view'
import { DeicingView } from './deicing-view'
import { AerodromeInspectionView } from './aerodrome-inspection-view'
import { SMSView } from './sms-view'
import { AuditView } from './audit-view'
import { DocumentControlView } from './document-control-view'
import { FodWildlifeView } from './fod-wildlife-view'
import { MyTasksView } from './my-tasks-view'
import { NotificationsView } from './notifications-view'
import { SkillsAdminView } from './skills-admin-view'
import { roleAtLeast, type TaskRole } from '@/lib/my-tasks'

// =====================================================
// NAVIGACIJA — grupisana lista za sidebar (zamjena za staru liniju od
// 20 tabova). Čisto UI podaci: sadržaj (Tabs/TabsContent) ostaje isti,
// mijenja se samo kako se do njega dolazi.
// =====================================================

type NavItem = { value: string; label: string; icon: React.ComponentType<{ className?: string }>; minRole?: TaskRole }
type NavGroup = { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Pregled',
    items: [
      { value: 'mytasks', label: 'Moj zadatak', icon: ListChecks },
      { value: 'overview', label: 'Pregled', icon: Activity },
      { value: 'daily-list', label: 'Dnevna lista pregleda', icon: ClipboardList },
      { value: 'inspection-log', label: 'Evidencija pregleda', icon: ClipboardCheck },
      { value: 'daily-stats', label: 'Pregledi po datumima', icon: CalendarDays },
      { value: 'equipment-report', label: 'Izvještaj po sredstvu', icon: FileText },
      { value: 'statistics', label: 'Statistika', icon: TrendingUp, minRole: 'engineer' },
      { value: 'activity', label: 'Aktivnost', icon: Clock, minRole: 'engineer' },
    ],
  },
  {
    label: 'Oprema',
    items: [
      { value: 'equipment', label: 'Sredstva', icon: Package },
      { value: 'damages', label: 'Oštećenja', icon: AlertOctagon },
      { value: 'maintenance', label: 'Održavanje', icon: Wrench, minRole: 'engineer' },
      { value: 'qr', label: 'QR kodovi', icon: Printer, minRole: 'engineer' },
    ],
  },
  {
    label: 'Sigurnost & regulativa',
    items: [
      { value: 'adr', label: 'ADR.OPS.C.007', icon: ShieldCheck, minRole: 'engineer' },
      { value: 'crs', label: 'CRS', icon: Award, minRole: 'engineer' },
      { value: 'incidents', label: 'Incidenti', icon: AlertOctagon, minRole: 'engineer' },
      { value: 'fod-wildlife', label: 'FOD & Wildlife', icon: AlertTriangle },
      { value: 'sms', label: 'SMS', icon: Shield, minRole: 'engineer' },
      { value: 'audit', label: 'Audit & Compliance', icon: ClipboardCheck, minRole: 'engineer' },
      { value: 'doc-control', label: 'Document Control', icon: FileText, minRole: 'engineer' },
    ],
  },
  {
    label: 'Operacije',
    items: [
      { value: 'scheduling', label: 'Servis & Dijelovi', icon: Calendar, minRole: 'engineer' },
      { value: 'driverauth', label: 'Driver Auth', icon: Car, minRole: 'engineer' },
      { value: 'fuelparking', label: 'Gorivo & Parking', icon: Fuel, minRole: 'engineer' },
      { value: 'deicing', label: 'De-icing', icon: Snowflake },
      { value: 'aero-inspection', label: 'Aerodrom Inspekcija', icon: Plane },
    ],
  },
  {
    label: 'Podešavanja',
    items: [
      { value: 'skills-admin', label: 'Kvalifikacije radionice', icon: Wrench, minRole: 'admin' },
      { value: 'notifications', label: 'Obavještenja', icon: Bell, minRole: 'admin' },
    ],
  },
  {
    label: 'Izvještaji',
    items: [
      { value: 'reports', label: 'Izvještaji', icon: Printer, minRole: 'engineer' },
    ],
  },
]

function visibleGroups(role: string): NavGroup[] {
  return NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.minRole || roleAtLeast(role, i.minRole)) }))
    .filter((g) => g.items.length > 0)
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator', engineer: 'Inženjer', operator: 'Operator',
}

// Samo ovih 8 stavki je i prije redizajna bilo prevedeno preko t() (jezički
// toggle) - ostale su uvijek bile hardkodirane na hrvatskom/bosanskom, isto
// kao i sada. Nema regresije u odnosu na prethodno ponašanje.
const NAV_T_KEYS: Partial<Record<string, TranslationKey>> = {
  overview: 'dash.overview', equipment: 'dash.equipment', damages: 'dash.damages',
  statistics: 'dash.statistics', maintenance: 'dash.maintenance', reports: 'dash.reports',
  activity: 'dash.activity', qr: 'dash.qr',
}

type EquipmentRow = Awaited<ReturnType<typeof getAllEquipment>>[number]
type ActiveAssignment = Awaited<ReturnType<typeof getActiveAssignments>>[number]
type ActivityRow = Awaited<ReturnType<typeof getRecentActivity>>[number]
type DamageRow = Awaited<ReturnType<typeof getOpenDamages>>[number]

export function DashboardView({ currentUser }: { currentUser: AppUser }) {
  const { t } = useLang()
  const [tab, setTab] = useState('mytasks')
  const [equipment, setEquipment] = useState<EquipmentRow[]>([])
  const [active, setActive] = useState<ActiveAssignment[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [damages, setDamages] = useState<DamageRow[]>([])
  const [allDamages, setAllDamages] = useState<DamageRow[]>([])
  const [inspectionAlerts, setInspectionAlerts] = useState<InspectionAlertLike[]>([])
  const [loading, setLoading] = useState(true)
  const [dailyDate, setDailyDate] = useState<string | undefined>(undefined)
  const [detail, setDetail] = useState<OverviewKind | null>(null)
  const toggleDetail = (k: OverviewKind) => setDetail((d) => (d === k ? null : k))

  // filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')

  const load = async () => {
    setLoading(true)
    try {
      const [eq, ac, act, od, ad, ia] = await Promise.all([
        getAllEquipment(),
        getActiveAssignments(),
        getRecentActivity(100),
        getOpenDamages(),
        getAllDamages(),
        getInspectionAlerts(),
      ])
      setEquipment(eq)
      setActive(ac)
      setActivity(act)
      setDamages(od)
      setAllDamages(ad)
      setInspectionAlerts(ia)
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

  const dueThisMonth = useMemo(() => filterDueThisMonth(inspectionAlerts), [inspectionAlerts])

  const activeNavLabel = useMemo(() => {
    for (const g of NAV_GROUPS) {
      const found = g.items.find((i) => i.value === tab)
      if (found) return NAV_T_KEYS[found.value] ? t(NAV_T_KEYS[found.value]!) : found.label
    }
    return ''
  }, [tab, t])

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-1 py-1">
            <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
              <Plane className="h-4 w-4" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="text-sm font-semibold leading-tight truncate">GSE Control</div>
              <div className="text-[10px] text-muted-foreground leading-tight truncate">Aerodrom Tivat · LYTV</div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {visibleGroups(currentUser.role).map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.value}>
                      <SidebarMenuButton
                        isActive={tab === item.value}
                        onClick={() => setTab(item.value)}
                        tooltip={NAV_T_KEYS[item.value] ? t(NAV_T_KEYS[item.value]!) : item.label}
                      >
                        <item.icon />
                        <span>{NAV_T_KEYS[item.value] ? t(NAV_T_KEYS[item.value]!) : item.label}</span>
                      </SidebarMenuButton>
                      {item.value === 'damages' && stats.openDamages > 0 && (
                        <SidebarMenuBadge className="bg-red-500 text-white">{stats.openDamages}</SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          <div className="px-2 py-1.5 text-xs group-data-[collapsible=icon]:hidden">
            <div className="font-medium truncate">{currentUser.full_name}</div>
            <div className="text-muted-foreground truncate">{ROLE_LABELS[currentUser.role] ?? currentUser.role}</div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <div className="flex items-center justify-between gap-2 border-b bg-background px-4 py-2.5 sticky top-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <SidebarTrigger />
            <h1 className="text-base font-semibold truncate">{activeNavLabel}</h1>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{t('dash.refresh')}</span>
            </Button>
            {currentUser.role === 'admin' && <AddEquipmentDialog onCreated={load} />}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <HelpButton helpKey={tab} />
          <Tabs value={tab} onValueChange={setTab}>
        <TabsContent value="mytasks" className="space-y-4">
          <MyTasksView
            role={currentUser.role}
            fullName={currentUser.full_name}
            damages={damages}
            onOpenTab={setTab}
          />
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label={t('dash.total')} value={stats.total} icon={Package} tone="default" />
            <StatCard label={t('dash.available')} value={stats.available} icon={CheckCircle2} tone="emerald" />
            <StatCard label={t('dash.assigned')} value={stats.assigned} icon={TrendingUp} tone="amber" onClick={() => toggleDetail('assigned')} selected={detail === 'assigned'} />
            <StatCard label={t('dash.oos')} value={stats.oos} icon={AlertOctagon} tone="red" onClick={() => toggleDetail('oos')} selected={detail === 'oos'} />
            <StatCard label={t('dash.maintenance')} value={stats.maint} icon={Wrench} tone="purple" onClick={() => toggleDetail('maint')} selected={detail === 'maint'} />
            <StatCard label={t('dash.openDamages')} value={stats.openDamages} icon={AlertOctagon} tone="red" onClick={() => toggleDetail('damages')} selected={detail === 'damages'} />
          </div>

          {detail && (
            <OverviewDetailTable
              kind={detail}
              equipment={equipment as any}
              damages={damages as any}
              active={active as any}
              onClose={() => setDetail(null)}
              onOpenDamages={() => setTab('damages')}
            />
          )}

          {/* Dospijeva ovog mjeseca - preventivno planiranje umjesto reaktivnog */}
          {dueThisMonth.length > 0 && (
            <Card className="border-amber-300 bg-amber-50/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-amber-700" />
                  Dospijeva ovog mjeseca ({dueThisMonth.length})
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Periodične inspekcije (IATA AHM 1130) koje dospijevaju ovaj mjesec ili su već istekle - planiraj unaprijed
                </p>
              </CardHeader>
              <CardContent>
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
                  {dueThisMonth.length > 12 && (
                    <span className="text-xs text-muted-foreground self-center">+ {dueThisMonth.length - 12} više — vidi Statistika tab</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active assignments + Open damages */}
          <div className={`grid lg:grid-cols-2 gap-4 ${detail ? 'hidden' : ''}`}>
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
                      <DamageRowCard key={d.id} damage={d} onResolved={load} currentUser={currentUser} compact />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="daily-list" className="space-y-4">
          <DailyListView initialDate={dailyDate} />
        </TabsContent>

        <TabsContent value="inspection-log" className="space-y-4">
          <InspectionLogView />
        </TabsContent>

        <TabsContent value="daily-stats" className="space-y-4">
          <DailyStatsView onPickDate={(d) => { setDailyDate(d); setTab('daily-list') }} />
        </TabsContent>

        <TabsContent value="equipment-report" className="space-y-4">
          <EquipmentReportView equipment={equipment} />
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
                          <RestrictionBadges restrictions={(e as any).activeRestrictions} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" title="Karton sredstva (PDF)" aria-label={`Karton ${e.code}`} onClick={() => window.open(`/api/reports/gse-equipment-card?code=${encodeURIComponent(e.code)}`, '_blank')}>
                              <FileText className="h-4 w-4" />
                            </Button>
                            {currentUser.role === 'admin' && (
                              <AccessControlDialog equipmentId={e.id} equipmentCode={e.code} equipmentName={e.name} />
                            )}
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
                    <DamageRowCard key={d.id} damage={d} onResolved={load} currentUser={currentUser} />
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
          <MaintenanceView currentUser={currentUser} />
        </TabsContent>

        <TabsContent value="adr" className="space-y-4">
          <AdrView />
        </TabsContent>

        <TabsContent value="crs" className="space-y-4">
          <CrsView />
        </TabsContent>

        <TabsContent value="scheduling" className="space-y-4">
          <SchedulingView />
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          <IncidentsView />
        </TabsContent>

        <TabsContent value="driverauth" className="space-y-4">
          <DriverAuthView />
        </TabsContent>

        <TabsContent value="fuelparking" className="space-y-4">
          <FuelParkingView />
        </TabsContent>

        <TabsContent value="deicing" className="space-y-4">
          <DeicingView />
        </TabsContent>

        <TabsContent value="aero-inspection" className="space-y-4">
          <AerodromeInspectionView />
        </TabsContent>

        <TabsContent value="sms" className="space-y-4">
          <SMSView />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditView />
        </TabsContent>

        <TabsContent value="doc-control" className="space-y-4">
          <DocumentControlView />
        </TabsContent>

        <TabsContent value="fod-wildlife" className="space-y-4">
          <FodWildlifeView isAdmin={currentUser.role === 'admin'} />
        </TabsContent>

        <TabsContent value="skills-admin" className="space-y-4">
          {currentUser.role === 'admin' && <SkillsAdminView />}
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          {currentUser.role === 'admin' && <NotificationsView />}
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
          <QrPrintView equipment={equipment} isAdmin={currentUser.role === 'admin'} onChanged={load} />
        </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
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
  onClick,
  selected = false,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'emerald' | 'amber' | 'red' | 'purple'
  onClick?: () => void
  selected?: boolean
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
    <Card
      className={`${toneClasses} border ${onClick ? 'cursor-pointer hover:shadow-md transition' : ''} ${selected ? 'ring-2 ring-primary' : ''}`}
      {...(onClick ? { role: 'button', tabIndex: 0, 'aria-pressed': selected, onClick, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } } : {})}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}{onClick ? ' ▾' : ''}</div>
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
  const [department, setDepartment] = useState<string>('TEHNICKA_SLUZBA')
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
        department,
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
          <div className="space-y-1.5">
            <Label>Služba</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EQUIPMENT_DEPARTMENT_ORDER.map((d) => (
                  <SelectItem key={d} value={d}>{EQUIPMENT_DEPARTMENT_LABELS[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
  const [department, setDepartment] = useState<string>(equipment.department ?? 'TEHNICKA_SLUZBA')
  const [isPending, startTransition] = useTransition()
  const qrBoxRef = useRef<HTMLDivElement>(null)
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])

  useEffect(() => {
    if (open) {
      setName(equipment.name)
      setType(equipment.type)
      setLocation(equipment.location)
      setSerialNumber(equipment.serialNumber ?? '')
      setNotes(equipment.notes ?? '')
      setDepartment(equipment.department ?? 'TEHNICKA_SLUZBA')
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
        department,
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
                  {!(type in EQUIPMENT_TYPE_LABELS) && <SelectItem value={type}>{type}</SelectItem>}
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
            <Label>Služba</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EQUIPMENT_DEPARTMENT_ORDER.map((d) => (
                  <SelectItem key={d} value={d}>{EQUIPMENT_DEPARTMENT_LABELS[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Napomene</Label>
            <Textarea id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <div ref={qrBoxRef} className="shrink-0 bg-white p-1.5 rounded">
              <QRCodeSVG value={`${origin}/?scan=${equipment.code}`} size={96} level="M" />
            </div>
            <div className="min-w-0 space-y-1.5 text-sm">
              <div className="font-medium">QR kod: <span className="font-mono">{equipment.code}</span></div>
              <p className="text-xs text-muted-foreground">Šifra se ne mijenja jer je odštampani QR vezan za nju.</p>
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => printQrLabels([{ svg: svgOf(qrBoxRef.current), code: equipment.code, name: equipment.name, location: equipment.location }])}
              >
                <Printer className="h-4 w-4 mr-1.5" />Štampaj QR
              </Button>
              <Button
                type="button" variant="outline" size="sm" className="ml-1.5"
                onClick={() => window.open(`/api/reports/gse-equipment-card?code=${encodeURIComponent(equipment.code)}`, '_blank')}
              >
                <FileText className="h-4 w-4 mr-1.5" />Karton (PDF)
              </Button>
            </div>
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
// QR PRINT VIEW
// =====================================================

function QrPrintView({ equipment, isAdmin, onChanged }: { equipment: EquipmentRow[]; isAdmin: boolean; onChanged: () => void }) {
  const [origin, setOrigin] = useState('')
  const [search, setSearch] = useState('')
  const gridRef = useRef<HTMLDivElement>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin)
  }, [])

  const qrUrl = (code: string) => (origin ? `${origin}/?scan=${code}` : `?scan=${code}`)

  const shown = equipment.filter((e) => {
    const q = search.trim().toLowerCase()
    return !q || `${e.code} ${e.name} ${e.location}`.toLowerCase().includes(q)
  })

  const labelFor = (e: EquipmentRow) => ({
    svg: svgOf(gridRef.current?.querySelector<HTMLElement>(`[data-qr="${CSS.escape(e.code)}"]`) ?? null),
    code: e.code,
    name: e.name,
    location: e.location,
  })

  const printOne = (e: EquipmentRow) => printQrLabels([labelFor(e)])
  const printAll = () => printQrLabels(shown.map(labelFor))

  const remove = (e: EquipmentRow) => {
    if (!window.confirm(`Obrisati sredstvo ${e.code} (${e.name})?\nOvo se ne može poništiti. Sredstva sa historijom se ne brišu.`)) return
    startTransition(async () => {
      try {
        const r = await deleteEquipment(e.id)
        if (!r.ok) { toast.error(r.error ?? 'Brisanje nije uspjelo'); return }
        toast.success(`Sredstvo ${e.code} obrisano`)
        onChanged()
      } catch (err: any) { toast.error(err?.message ?? 'Greška') }
    })
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
        <div className="flex flex-wrap gap-2 mb-4">
          <Input className="max-w-xs" placeholder="Traži šifru, naziv, lokaciju…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button onClick={printAll} disabled={shown.length === 0}>
            <Printer className="h-4 w-4 mr-2" />
            Štampaj {search.trim() ? `prikazane (${shown.length})` : 'sve'}
          </Button>
        </div>

        <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {shown.map((e) => (
            <div
              key={e.id}
              className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-3 text-center"
            >
              <div data-qr={e.code} className="flex justify-center mb-2 bg-white p-1.5 rounded w-fit mx-auto">
                <QRCodeSVG value={qrUrl(e.code)} size={140} level="M" includeMargin={false} />
              </div>
              <div className="font-mono text-xs font-bold">{e.code}</div>
              <div className="text-[10px] text-muted-foreground line-clamp-2 mt-1">{e.name}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{e.location}</div>
              <div className="flex justify-center gap-1 mt-2">
                <Button size="sm" variant="outline" aria-label={`Štampaj ${e.code}`} onClick={() => printOne(e)}>
                  <Printer className="h-4 w-4" />
                </Button>
                {isAdmin && <EditEquipmentDialog equipment={e} onUpdated={onChanged} />}
                {isAdmin && (
                  <Button size="sm" variant="ghost" aria-label={`Obriši ${e.code}`} onClick={() => remove(e)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
