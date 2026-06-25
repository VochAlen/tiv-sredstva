'use client'

import { useEffect, useState, useMemo } from 'react'
import { Plane, Activity, AlertTriangle, Wrench, CheckCircle2, TrendingUp, RefreshCw, Clock, MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  EQUIPMENT_TYPE_LABELS,
  STATUS_LABELS,
  type EquipmentStatus,
  type EquipmentType,
} from '@/lib/types'
import { fetchFidsData, type FidsEquipment } from '@/lib/fids-actions'

export default function FidsPage() {
  const [equipment, setEquipment] = useState<FidsEquipment[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
const [clock, setClock] = useState<Date | null>(null)

  // Auto-refresh svakih 30 sekundi
  const load = async () => {
    try {
      const data = await fetchFidsData()
      setEquipment(data)
      setLastUpdate(new Date())
    } catch (e) {
      console.error('FIDS load error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000) // 30s auto-refresh
    return () => clearInterval(interval)
  }, [])

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Statistika
  const stats = useMemo(() => {
    const total = equipment.length
    const inUse = equipment.filter((e) => e.status === 'ASSIGNED').length
    const available = equipment.filter((e) => e.status === 'AVAILABLE').length
    const outOfService = equipment.filter((e) => e.status === 'OUT_OF_SERVICE').length
    const maintenance = equipment.filter((e) => e.status === 'MAINTENANCE').length
    return { total, inUse, available, outOfService, maintenance }
  }, [equipment])

  // Grupisanje po tipu
  const byType = useMemo(() => {
    const groups: Record<string, FidsEquipment[]> = {}
    for (const e of equipment) {
      if (!groups[e.type]) groups[e.type] = []
      groups[e.type].push(e)
    }
    return groups
  }, [equipment])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* FIDS Header */}
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-400 text-slate-900 flex items-center justify-center">
              <Plane className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                AERODROMSKI GSE FIDS
              </h1>
              <p className="text-xs text-slate-400">
                Ground Support Equipment — Real-time Status Display
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
             <div className="text-2xl font-mono font-bold text-amber-400 tabular-nums">
  {clock ? clock.toLocaleTimeString('de-DE', { hour12: false }) : '—:—:—'}
</div>
<div className="text-xs text-slate-400 uppercase tracking-wide">
  {clock
    ? `Lokalno vrijeme · UTC${clock.getTimezoneOffset() <= 0 ? '+' : '-'}${Math.abs(clock.getTimezoneOffset() / 60)}`
    : 'Lokalno vrijeme'}
</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={load}
              disabled={loading}
              className="text-slate-300 hover:text-white hover:bg-slate-800"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Osvježi
            </Button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="bg-slate-900/60 border-t border-slate-800 px-6 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <FidsStat label="UKUPNO" value={stats.total} color="text-slate-100" />
            <FidsStat label="U UPOTREBI" value={stats.inUse} color="text-amber-400" icon={<TrendingUp className="h-4 w-4" />} />
            <FidsStat label="DOSTUPNO" value={stats.available} color="text-emerald-400" icon={<CheckCircle2 className="h-4 w-4" />} />
            <FidsStat label="NEISPRAVNO" value={stats.outOfService} color="text-red-400" icon={<AlertTriangle className="h-4 w-4" />} />
            <FidsStat label="ODRŽAVANJE" value={stats.maintenance} color="text-purple-400" icon={<Wrench className="h-4 w-4" />} />
          </div>
        </div>
      </header>

      {/* Main content - scrolling FIDS board */}
      <main className="flex-1 overflow-y-auto p-6">
        {loading && equipment.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-8 w-8 animate-spin text-amber-400" />
            <span className="ml-3 text-slate-400">Učitavanje...</span>
          </div>
        ) : equipment.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
            <span className="ml-3 text-slate-400">Nema dostupnih podataka</span>
          </div>
        ) : (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Status board - sve sredstvo u tabeli */}
            <FidsBoard equipment={equipment} />

            {/* Po tipu - mali cards */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Pregled po tipu opreme
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(byType).map(([type, items]) => (
                  <FidsTypeCard key={type} type={type as EquipmentType} items={items} />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900 px-6 py-3">
        <div className="flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>
              Zadnje ažuriranje: {lastUpdate ? lastUpdate.toLocaleTimeString('de-DE', { hour12: false }) : '—'}
            </span>
            <span className="ml-2">· Auto-refresh: 30s</span>
          </div>
          <div>
            GSE Control · Public FIDS Display · IATA AHM 340 compliant
          </div>
        </div>
      </footer>
    </div>
  )
}

function FidsStat({ label, value, color, icon }: { label: string; value: number; color: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  )
}

function FidsBoard({ equipment }: { equipment: FidsEquipment[] }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-2">
          <Plane className="h-4 w-4" />
          Status Board — Svih {equipment.length} sredstava
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
              <th className="text-left px-4 py-2 font-medium">Kod</th>
              <th className="text-left px-4 py-2 font-medium">Naziv</th>
              <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Tip</th>
              <th className="text-left px-4 py-2 font-medium hidden lg:table-cell">Lokacija</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {equipment.map((e, idx) => (
              <tr
                key={e.id}
                className={`border-b border-slate-800/50 ${idx % 2 === 0 ? 'bg-slate-900/30' : ''} hover:bg-slate-800/30 transition`}
              >
                <td className="px-4 py-2.5 text-amber-300 font-semibold">{e.code}</td>
                <td className="px-4 py-2.5 text-slate-200">{e.name}</td>
                <td className="px-4 py-2.5 text-slate-400 hidden md:table-cell">
                  {EQUIPMENT_TYPE_LABELS[e.type as EquipmentType] ?? e.type}
                </td>
                <td className="px-4 py-2.5 text-slate-400 hidden lg:table-cell">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {e.location}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <FidsStatusBadge status={e.status as EquipmentStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FidsStatusBadge({ status }: { status: EquipmentStatus }) {
  const config: Record<EquipmentStatus, { label: string; bg: string; text: string; pulse?: boolean }> = {
    ASSIGNED: { label: '● U UPOTREBI', bg: 'bg-amber-500/20', text: 'text-amber-300', pulse: true },
    AVAILABLE: { label: '✓ DOSTUPNO', bg: 'bg-emerald-500/20', text: 'text-emerald-300' },
    OUT_OF_SERVICE: { label: '✗ NEISPRAVNO', bg: 'bg-red-500/20', text: 'text-red-300', pulse: true },
    MAINTENANCE: { label: '⚙ ODRŽAVANJE', bg: 'bg-purple-500/20', text: 'text-purple-300' },
  }
  const c = config[status] ?? config.AVAILABLE
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${c.bg} ${c.text} ${c.pulse ? 'animate-pulse' : ''}`}>
      {c.label}
    </span>
  )
}

function FidsTypeCard({ type, items }: { type: EquipmentType; items: FidsEquipment[] }) {
  const inUse = items.filter((i) => i.status === 'ASSIGNED').length
  const available = items.filter((i) => i.status === 'AVAILABLE').length
  const oos = items.filter((i) => i.status === 'OUT_OF_SERVICE').length
  const maint = items.filter((i) => i.status === 'MAINTENANCE').length

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200">
            {EQUIPMENT_TYPE_LABELS[type] ?? type}
          </h3>
          <Badge variant="outline" className="border-slate-700 text-slate-400">
            {items.length} ukupno
          </Badge>
        </div>
        <div className="grid grid-cols-4 gap-1 text-center text-xs">
          <div className="bg-amber-500/10 rounded p-1.5">
            <div className="text-amber-400 font-bold text-base">{inUse}</div>
            <div className="text-slate-500 uppercase">Upotreba</div>
          </div>
          <div className="bg-emerald-500/10 rounded p-1.5">
            <div className="text-emerald-400 font-bold text-base">{available}</div>
            <div className="text-slate-500 uppercase">Slobodno</div>
          </div>
          <div className="bg-red-500/10 rounded p-1.5">
            <div className="text-red-400 font-bold text-base">{oos}</div>
            <div className="text-slate-500 uppercase">Neispravno</div>
          </div>
          <div className="bg-purple-500/10 rounded p-1.5">
            <div className="text-purple-400 font-bold text-base">{maint}</div>
            <div className="text-slate-500 uppercase">Održav.</div>
          </div>
        </div>
        <div className="mt-3 space-y-0.5 text-xs">
          {items.slice(0, 4).map((i) => (
            <div key={i.id} className="flex items-center justify-between text-slate-400">
              <span className="font-mono text-amber-300/70">{i.code}</span>
              <FidsStatusBadge status={i.status as EquipmentStatus} />
            </div>
          ))}
          {items.length > 4 && (
            <div className="text-xs text-slate-500 italic pt-1">
              +{items.length - 4} više...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
