'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  BarChart3, Users, TrendingUp, AlertTriangle, CheckCircle2,
  Activity, Clock, Loader2, Download, ShieldCheck,
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getStats, getActivityByDay, getEquipmentUtilization } from '@/lib/actions-advanced'
import type { Stats, ActivityByDay, EquipmentUtilization } from '@/lib/types-advanced'

export function AnalyticsView() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activity, setActivity] = useState<ActivityByDay[]>([])
  const [utilization, setUtilization] = useState<EquipmentUtilization[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [s, a, u] = await Promise.all([
        getStats(),
        getActivityByDay(30),
        getEquipmentUtilization(),
      ])
      setStats(s)
      setActivity(a)
      setUtilization(u)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Operator performance - based on activity data
  const operatorPerformance = useMemo(() => {
    // This would normally come from server, but we can derive from utilization
    return utilization
      .sort((a, b) => b.checkouts - a.checkouts)
      .slice(0, 10)
      .map((u) => ({
        name: u.code,
        'Zaduživanja': u.checkouts,
        'Oštećenja': u.damages,
        'Compliance': u.damages > 0 ? Math.round(((u.checkouts - u.damages) / u.checkouts) * 100) : 100,
      }))
  }, [utilization])

  // Predictive maintenance - based on MTBF and utilization
  const predictiveAlerts = useMemo(() => {
    if (!stats) return []
    const alerts: Array<{ equipment: string; risk: 'HIGH' | 'MEDIUM' | 'LOW'; reason: string }> = []

    utilization.forEach((u) => {
      if (u.damages >= 3) {
        alerts.push({
          equipment: `${u.code} - ${u.name}`,
          risk: 'HIGH',
          reason: `${u.damages} prijavljena oštećenja - visok rizik od ponovnog kvara`,
        })
      } else if (u.damages >= 1 && u.checkouts > 10) {
        alerts.push({
          equipment: `${u.code} - ${u.name}`,
          risk: 'MEDIUM',
          reason: `${u.damages} oštećenja na ${u.checkouts} zaduženja - praćenje preporučeno`,
        })
      }
    })

    // MTBF-based prediction
    if (stats.mtbfHours > 0 && stats.mtbfHours < 200) {
      alerts.push({
        equipment: 'Sistemski (MTBF)',
        risk: 'HIGH',
        reason: `MTBF od ${stats.mtbfHours}h je ispod 200h - sistemski problem moguć`,
      })
    }

    return alerts.sort((a, b) => {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 }
      return order[a.risk] - order[b.risk]
    })
  }, [stats, utilization])

  // Compliance score (EASA)
  const complianceScore = useMemo(() => {
    if (!stats) return 0
    let score = 100
    // Smanji za svako otvoreno oštećenje
    score -= stats.openDamages * 2
    // Smanji za istekle inspekcije
    score -= stats.inspectionOverdue * 5
    // Smanji ako je compliance rate nizak
    if (stats.complianceRate < 95) score -= (95 - stats.complianceRate) * 2
    return Math.max(0, Math.min(100, score))
  }, [stats])

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Audit & Analytics
        </h2>
        <p className="text-sm text-muted-foreground">
          Napredna analitika, operator performance, predictive maintenance i EASA compliance score
        </p>
      </div>

      {/* Compliance Score Banner */}
      <Card className={`${complianceScore >= 90 ? 'border-emerald-300 bg-emerald-50' : complianceScore >= 70 ? 'border-amber-300 bg-amber-50' : 'border-red-300 bg-red-50'}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-sm text-muted-foreground uppercase tracking-wide">EASA Compliance Score</div>
              <div className={`text-4xl font-bold ${complianceScore >= 90 ? 'text-emerald-600' : complianceScore >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                {complianceScore}/100
              </div>
              <div className="text-sm mt-1">
                {complianceScore >= 90 ? '✓ Odličan nivo usklađenosti' : complianceScore >= 70 ? '⚠ Potrebno poboljšanje' : '✗ Kritično - hitne akcije potrebne'}
              </div>
            </div>
            <ShieldCheck className={`h-16 w-16 ${complianceScore >= 90 ? 'text-emerald-500' : complianceScore >= 70 ? 'text-amber-500' : 'text-red-500'}`} />
          </div>
        </CardContent>
      </Card>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Compliance Rate" value={`${stats.complianceRate}%`} icon={CheckCircle2} tone={stats.complianceRate >= 95 ? 'emerald' : 'amber'} />
        <KpiCard label="MTBF" value={`${stats.mtbfHours}h`} icon={Clock} tone="blue" />
        <KpiCard label="MTTR" value={`${stats.mttrHours}h`} icon={Activity} tone="purple" />
        <KpiCard label="Utilization" value={`${stats.utilizationRate}%`} icon={TrendingUp} tone="orange" />
      </div>

      {/* Operator Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Operator Performance (po opremi)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {operatorPerformance.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nema dovoljno podataka</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={operatorPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={10} angle={-45} textAnchor="end" height={80} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Zaduživanja" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Oštećenja" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Predictive Maintenance Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Predictive Maintenance Alerti
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Na osnovu istorije kvarova i MTBF-a - predviđanje potencijalnih problema
          </p>
        </CardHeader>
        <CardContent>
          {predictiveAlerts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500" />
              <p className="text-sm text-muted-foreground">Nema predviđenih problema - sve u redu!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {predictiveAlerts.map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    alert.risk === 'HIGH' ? 'bg-red-50 border-red-200' :
                    alert.risk === 'MEDIUM' ? 'bg-amber-50 border-amber-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
                  <AlertTriangle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                    alert.risk === 'HIGH' ? 'text-red-600' :
                    alert.risk === 'MEDIUM' ? 'text-amber-600' : 'text-blue-600'
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm">{alert.equipment}</span>
                      <Badge className={`text-xs ${
                        alert.risk === 'HIGH' ? 'bg-red-100 text-red-800' :
                        alert.risk === 'MEDIUM' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {alert.risk === 'HIGH' ? 'Visok rizik' : alert.risk === 'MEDIUM' ? 'Srednji rizik' : 'Nizak rizik'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{alert.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Trend aktivnosti (30 dana)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={activity.map((a) => ({
              date: a.date.slice(5),
              'Zaduživanja': a.checkouts,
              'Razduživanja': a.checkins,
              'Oštećenja': a.damages,
            }))}>
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
  )
}

function KpiCard({
  label, value, icon: Icon, tone,
}: {
  label: string
  value: string
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
    emerald: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600',
    blue: 'text-blue-600', purple: 'text-purple-600', orange: 'text-orange-600',
  }[tone]
  return (
    <Card className={`${toneClasses} border`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
          </div>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </CardContent>
    </Card>
  )
}
