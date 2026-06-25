'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, AlertTriangle, CheckCircle2, Activity, Clock,
  Wrench, Download, Calendar, Award, AlertOctagon, FileText, BarChart3,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  EQUIPMENT_TYPE_LABELS,
} from '@/lib/types'
import {
  getStats, getActivityByDay, getEquipmentUtilization, getInspectionAlerts,
  exportEquipmentCSV, exportActivityCSV, exportDamagesCSV,
} from '@/lib/actions-advanced'
import type { Stats, ActivityByDay, EquipmentUtilization } from '@/lib/types-advanced'
import { toast } from 'sonner'

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#a855f7', '#3b82f6', '#ec4899']

export function StatisticsView() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activity, setActivity] = useState<ActivityByDay[]>([])
  const [utilization, setUtilization] = useState<EquipmentUtilization[]>([])
  const [inspectionAlerts, setInspectionAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [s, a, u, i] = await Promise.all([
        getStats(),
        getActivityByDay(30),
        getEquipmentUtilization(),
        getInspectionAlerts(),
      ])
      setStats(s)
      setActivity(a)
      setUtilization(u)
      setInspectionAlerts(i)
    } catch (e) {
      console.error('Stats load error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleExport = async (type: 'equipment' | 'activity' | 'damages') => {
    try {
      let csv = ''
      let filename = ''
      if (type === 'equipment') {
        csv = await exportEquipmentCSV()
        filename = `oprema-${new Date().toISOString().slice(0, 10)}.csv`
      } else if (type === 'activity') {
        csv = await exportActivityCSV()
        filename = `aktivnost-${new Date().toISOString().slice(0, 10)}.csv`
      } else {
        csv = await exportDamagesCSV()
        filename = `ostecenja-${new Date().toISOString().slice(0, 10)}.csv`
      }

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      toast.success('CSV exportovan')
    } catch (e: any) {
      toast.error(`Greška: ${e?.message ?? e}`)
    }
  }

  // Pie chart data - status distribution
  const statusData = useMemo(() => {
    if (!stats) return []
    return [
      { name: 'Dostupno', value: stats.available, color: '#10b981' },
      { name: 'Zaduženo', value: stats.assigned, color: '#f59e0b' },
      { name: 'Neispravno', value: stats.outOfService, color: '#ef4444' },
      { name: 'Održavanje', value: stats.maintenance, color: '#a855f7' },
    ].filter((d) => d.value > 0)
  }, [stats])

  // Activity by day chart data
  const activityData = useMemo(() => {
    return activity.map((a) => ({
      date: a.date.slice(5),  // MM-DD
      'Zaduživanja': a.checkouts,
      'Razduživanja': a.checkins,
      'Oštećenja': a.damages,
    }))
  }, [activity])

  // Top 5 problematic equipment
  const topProblematic = useMemo(() => {
    return utilization
      .filter((u) => u.damages > 0)
      .sort((a, b) => b.damages - a.damages)
      .slice(0, 5)
  }, [utilization])

  // Top 5 most utilized
  const topUtilized = useMemo(() => {
    return utilization
      .sort((a, b) => b.checkouts - a.checkouts)
      .slice(0, 5)
  }, [utilization])

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Statistika i analitika
          </h2>
          <p className="text-sm text-muted-foreground">
            IATA AHM 340 + EASA Part-145 compliance metriku
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => handleExport('equipment')}>
            <Download className="h-4 w-4 mr-1.5" />
            Oprema CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('activity')}>
            <Download className="h-4 w-4 mr-1.5" />
            Aktivnost CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('damages')}>
            <Download className="h-4 w-4 mr-1.5" />
            Oštećenja CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Compliance Rate"
          value={`${stats.complianceRate}%`}
          subtitle="Check-out-a bez oštećenja"
          icon={CheckCircle2}
          tone={stats.complianceRate >= 95 ? 'emerald' : stats.complianceRate >= 80 ? 'amber' : 'red'}
        />
        <KpiCard
          label="Utilization Rate"
          value={`${stats.utilizationRate}%`}
          subtitle="Opreme u upotrebi sad"
          icon={TrendingUp}
          tone="blue"
        />
        <KpiCard
          label="MTBF"
          value={`${stats.mtbfHours}h`}
          subtitle="Mean Time Between Failures"
          icon={Clock}
          tone="purple"
        />
        <KpiCard
          label="MTTR"
          value={`${stats.mttrHours}h`}
          subtitle="Mean Time To Repair"
          icon={Wrench}
          tone="orange"
        />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <MiniStat label="Ukupno opreme" value={stats.total} />
        <MiniStat label="Zaduživanja (30d)" value={stats.totalCheckouts} />
        <MiniStat label="Razduživanja (30d)" value={stats.totalCheckins} />
        <MiniStat label="Otvorena oštećenja" value={stats.openDamages} tone="red" />
        <MiniStat label="Inspekcije istekle" value={stats.inspectionOverdue} tone="red" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Status distribution pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribucija statusa opreme</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name}: ${value} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Activity trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aktivnost u zadnjih 30 dana</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="Zaduživanja" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Razduživanja" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Oštećenja" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top equipment charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top utilized */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Najkorišćenija oprema (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topUtilized.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nema podataka</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topUtilized.map((u) => ({
                  name: u.code,
                  'Broj zaduženja': u.checkouts,
                }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" fontSize={11} width={100} />
                  <Tooltip />
                  <Bar dataKey="Broj zaduženja" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top problematic */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Najproblematičnija oprema (broj oštećenja)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topProblematic.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                Nema prijavljenih oštećenja! 🎉
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topProblematic.map((u) => ({
                  name: u.code,
                  'Broj oštećenja': u.damages,
                }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" fontSize={11} width={100} />
                  <Tooltip />
                  <Bar dataKey="Broj oštećenja" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inspection alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Inspekcijski alerti (IATA AHM 1130)
            {stats.inspectionOverdue > 0 && (
              <Badge variant="destructive" className="ml-2">{stats.inspectionOverdue} isteklo</Badge>
            )}
            {stats.inspectionDueSoon > 0 && (
              <Badge variant="secondary" className="ml-2">{stats.inspectionDueSoon} uskoro</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {inspectionAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nema inspekcija u sistemu</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {inspectionAlerts.slice(0, 15).map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg ${
                    alert.status === 'OVERDUE' ? 'bg-red-50 border border-red-200' :
                    alert.status === 'DUE_SOON' ? 'bg-amber-50 border border-amber-200' :
                    'bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Badge variant="outline" className="font-mono text-xs">{alert.code}</Badge>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{alert.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Slijedeća inspekcija: {alert.nextInspectionDate?.slice(0, 10)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.status === 'OVERDUE' && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertOctagon className="h-3 w-3 mr-1" />
                        Istekla {Math.abs(alert.daysUntilDue)}d
                      </Badge>
                    )}
                    {alert.status === 'DUE_SOON' && (
                      <Badge className="bg-amber-100 text-amber-800 text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        Za {alert.daysUntilDue}d
                      </Badge>
                    )}
                    {alert.status === 'OK' && (
                      <Badge variant="outline" className="text-emerald-700 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {alert.daysUntilDue}d
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  tone: 'emerald' | 'amber' | 'red' | 'blue' | 'purple' | 'orange'
}) {
  const toneClasses = {
    emerald: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    amber: 'bg-amber-50 text-amber-900 border-amber-200',
    red: 'bg-red-50 text-red-900 border-red-200',
    blue: 'bg-blue-50 text-blue-900 border-blue-200',
    purple: 'bg-purple-50 text-purple-900 border-purple-200',
    orange: 'bg-orange-50 text-orange-900 border-orange-200',
  }[tone]
  const iconColor = {
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
  }[tone]
  return (
    <Card className={`${toneClasses} border`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</div>
          </div>
          <Icon className={`h-5 w-5 ${iconColor} flex-shrink-0`} />
        </div>
      </CardContent>
    </Card>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: 'red' }) {
  return (
    <div className={`p-3 rounded-lg border ${tone === 'red' && value > 0 ? 'bg-red-50 border-red-200' : 'bg-card'}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  )
}
