'use client'

import { useEffect, useState } from 'react'
import {
  Wrench, AlertTriangle, FileText, Calendar, Clock,
  CheckCircle2, XCircle, Loader2, Plus, Settings, Users,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  getComponents, getServiceBulletins, getAirworthinessDirectives, getShiftHandovers,
} from '@/lib/actions-easa'
import { toast } from 'sonner'

type Component = Awaited<ReturnType<typeof getComponents>>[number]
type Bulletin = Awaited<ReturnType<typeof getServiceBulletins>>[number]
type Directive = Awaited<ReturnType<typeof getAirworthinessDirectives>>[number]
type Handover = Awaited<ReturnType<typeof getShiftHandovers>>[number]

const COMPONENT_TYPE_LABELS: Record<string, string> = {
  TIRE: 'Gume', CABLE: 'Kabel', HYDRAULIC: 'Hidraulika', BRAKE: 'Kočnice',
  ENGINE: 'Motor', BATTERY: 'Baterija', OTHER: 'Ostalo',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-blue-100 text-blue-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
}

export function ComplianceView() {
  const [tab, setTab] = useState<'components' | 'bulletins' | 'directives' | 'handovers'>('components')
  const [components, setComponents] = useState<Component[]>([])
  const [bulletins, setBulletins] = useState<Bulletin[]>([])
  const [directives, setDirectives] = useState<Directive[]>([])
  const [handovers, setHandovers] = useState<Handover[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [c, b, d, h] = await Promise.all([
        getComponents(),
        getServiceBulletins(),
        getAirworthinessDirectives(),
        getShiftHandovers(),
      ])
      setComponents(c)
      setBulletins(b)
      setDirectives(d)
      setHandovers(h)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Stats
  const componentAlerts = components.filter((c) => {
    if (!c.lifeLimitHours) return false
    const pct = (c.currentHours / c.lifeLimitHours) * 100
    return pct >= 80 || c.status === 'INSPECT'
  }).length
  const openBulletins = bulletins.filter((b) => b.status === 'OPEN' || b.status === 'IN_PROGRESS').length
  const openDirectives = directives.filter((d) => d.status === 'OPEN').length

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings className="h-5 w-5" />
          EASA Compliance
        </h2>
        <p className="text-sm text-muted-foreground">
          Part-145 §50 (komponente), §71 (service bulletins), Part-M §39 (AD-ovi), AHM 340 (smjene)
        </p>
      </div>

      {/* Alert cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <AlertCard
          icon={Wrench}
          label="Komponente za zamjenu"
          value={componentAlerts}
          tone={componentAlerts > 0 ? 'red' : 'emerald'}
          onClick={() => setTab('components')}
        />
        <AlertCard
          icon={FileText}
          label="Otvoreni Service Bulletins"
          value={openBulletins}
          tone={openBulletins > 0 ? 'amber' : 'emerald'}
          onClick={() => setTab('bulletins')}
        />
        <AlertCard
          icon={AlertTriangle}
          label="Otvoreni EASA AD-ovi"
          value={openDirectives}
          tone={openDirectives > 0 ? 'red' : 'emerald'}
          onClick={() => setTab('directives')}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto">
        <TabButton active={tab === 'components'} onClick={() => setTab('components')} icon={Wrench} label="Komponente" count={components.length} />
        <TabButton active={tab === 'bulletins'} onClick={() => setTab('bulletins')} icon={FileText} label="Service Bulletins" count={bulletins.length} />
        <TabButton active={tab === 'directives'} onClick={() => setTab('directives')} icon={AlertTriangle} label="Airworthiness Directives" count={directives.length} />
        <TabButton active={tab === 'handovers'} onClick={() => setTab('handovers')} icon={Users} label="Predaja smjena" count={handovers.length} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tab === 'components' ? (
        <ComponentsList components={components} />
      ) : tab === 'bulletins' ? (
        <BulletinsList bulletins={bulletins} />
      ) : tab === 'directives' ? (
        <DirectivesList directives={directives} />
      ) : (
        <HandoversList handovers={handovers} />
      )}
    </div>
  )
}

function AlertCard({ icon: Icon, label, value, tone, onClick }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  tone: 'red' | 'amber' | 'emerald'
  onClick: () => void
}) {
  const toneClass = {
    red: 'bg-red-50 border-red-200 text-red-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  }[tone]
  const iconClass = {
    red: 'text-red-600',
    amber: 'text-amber-600',
    emerald: 'text-emerald-600',
  }[tone]

  return (
    <button onClick={onClick} className={`text-left p-4 rounded-lg border ${toneClass} hover:opacity-80 transition`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs mt-0.5">{label}</div>
        </div>
        <Icon className={`h-6 w-6 ${iconClass}`} />
      </div>
    </button>
  )
}

function TabButton({ active, onClick, icon: Icon, label, count }: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
        active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      {count > 0 && <Badge variant="secondary" className="text-xs ml-1">{count}</Badge>}
    </button>
  )
}

// =====================================================
// COMPONENTS LIST
// =====================================================

function ComponentsList({ components }: { components: Component[] }) {
  if (components.length === 0) {
    return <EmptyState icon={Wrench} text="Nema registrovanih komponenti sa ograničenim vijekom." />
  }

  return (
    <div className="space-y-2">
      {components.map((c) => {
        const lifePct = c.lifeLimitHours ? (c.currentHours / c.lifeLimitHours) * 100 : 0
        const isCritical = lifePct >= 90 || c.status === 'INSPECT'
        const isWarning = lifePct >= 80 && lifePct < 90

        return (
          <Card key={c.id} className={`p-4 ${isCritical ? 'border-red-300 bg-red-50' : isWarning ? 'border-amber-300 bg-amber-50' : ''}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant="outline" className="font-mono text-xs">{c.equipmentCode}</Badge>
                  <Badge variant="secondary" className="text-xs">{COMPONENT_TYPE_LABELS[c.componentType] ?? c.componentType}</Badge>
                  {c.status === 'INSPECT' && <Badge className="bg-red-100 text-red-800 text-xs">Za inspekciju</Badge>}
                  {c.status === 'REPLACED' && <Badge className="bg-gray-100 text-gray-800 text-xs">Zamijenjeno</Badge>}
                </div>
                <div className="text-sm font-medium">{c.componentName}</div>
                {c.manufacturer && <div className="text-xs text-muted-foreground mt-0.5">{c.manufacturer} {c.serialNumber ? `· S/N: ${c.serialNumber}` : ''}</div>}

                {c.lifeLimitHours && c.status === 'ACTIVE' && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Iskorišćenost vijeka:</span>
                      <span className={`font-medium ${isCritical ? 'text-red-700' : isWarning ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {c.currentHours.toLocaleString()}h / {c.lifeLimitHours.toLocaleString()}h ({Math.round(lifePct)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, lifePct)}%` }}
                      />
                    </div>
                    {isCritical && (
                      <div className="text-xs text-red-700 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Potrebna zamjena!
                      </div>
                    )}
                  </div>
                )}
                {c.notes && <div className="text-xs text-muted-foreground mt-1">{c.notes}</div>}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// =====================================================
// BULLETINS LIST
// =====================================================

function BulletinsList({ bulletins }: { bulletins: Bulletin[] }) {
  if (bulletins.length === 0) {
    return <EmptyState icon={FileText} text="Nema service bulletins." />
  }

  return (
    <div className="space-y-2">
      {bulletins.map((b) => (
        <Card key={b.id} className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs">{b.bulletinNumber}</Badge>
                <Badge className={`text-xs ${PRIORITY_COLORS[b.priority] ?? ''}`}>{b.priority}</Badge>
                <Badge variant="secondary" className="text-xs">{b.manufacturer}</Badge>
                <Badge className={`text-xs ${b.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : b.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                  {b.status === 'COMPLETED' ? 'Završeno' : b.status === 'IN_PROGRESS' ? 'U toku' : b.status === 'NOT_APPLICABLE' ? 'N/A' : 'Otvoreno'}
                </Badge>
              </div>
              <div className="text-sm font-medium">{b.title}</div>
              <div className="text-sm text-muted-foreground mt-1">{b.description}</div>
              <div className="text-xs text-muted-foreground mt-1.5">
                <strong>Potrebna akcija:</strong> {b.requiredAction}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Izdano: {new Date(b.issuedAt).toLocaleDateString('hr-HR')}</span>
                {b.complianceDeadline && (
                  <span className="flex items-center gap-1 text-red-600">
                    <Clock className="h-3 w-3" />
                    Rok: {new Date(b.complianceDeadline).toLocaleDateString('hr-HR')}
                  </span>
                )}
                {b.estimatedHours && <span>{b.estimatedHours}h rada</span>}
              </div>
              {b.completionNotes && (
                <div className="text-xs text-emerald-700 mt-1.5 p-1.5 bg-emerald-50 rounded">
                  <strong>Završeno:</strong> {b.completionNotes} ({b.completedBy})
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// =====================================================
// DIRECTIVES LIST
// =====================================================

function DirectivesList({ directives }: { directives: Directive[] }) {
  if (directives.length === 0) {
    return <EmptyState icon={AlertTriangle} text="Nema Airworthiness Directives." />
  }

  return (
    <div className="space-y-2">
      {directives.map((d) => (
        <Card key={d.id} className={`p-4 ${d.status === 'OPEN' && d.priority === 'CRITICAL' ? 'border-red-300 bg-red-50' : ''}`}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs">{d.adNumber}</Badge>
                <Badge className={`text-xs ${PRIORITY_COLORS[d.priority] ?? ''}`}>{d.priority}</Badge>
                <Badge className={`text-xs ${d.status === 'COMPLIED' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  {d.status === 'COMPLIED' ? 'Usklađeno' : d.status === 'NOT_APPLICABLE' ? 'N/A' : 'Otvoreno'}
                </Badge>
                {d.recurring && <Badge variant="secondary" className="text-xs">Ponavljajući</Badge>}
              </div>
              <div className="text-sm font-medium">{d.title}</div>
              <div className="text-sm text-muted-foreground mt-1">{d.description}</div>
              <div className="text-xs text-muted-foreground mt-1.5">
                <strong>Potrebna akcija:</strong> {d.requiredAction}
                {d.complianceMethod && ` (${d.complianceMethod})`}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Na snazi od: {new Date(d.effectiveDate).toLocaleDateString('hr-HR')}</span>
                {d.complianceDeadline && (
                  <span className="flex items-center gap-1 text-red-600">
                    <Clock className="h-3 w-3" />
                    Rok: {new Date(d.complianceDeadline).toLocaleDateString('hr-HR')}
                  </span>
                )}
                {d.recurring && d.recurringIntervalHours && <span>Svakih {d.recurringIntervalHours}h</span>}
              </div>
              {d.complianceNotes && (
                <div className="text-xs text-emerald-700 mt-1.5 p-1.5 bg-emerald-50 rounded">
                  <strong>Usklađeno:</strong> {d.complianceNotes} ({d.compliedBy})
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// =====================================================
// HANDOVERS LIST
// =====================================================

function HandoversList({ handovers }: { handovers: Handover[] }) {
  if (handovers.length === 0) {
    return <EmptyState icon={Users} text="Nema zabilježenih predaja smjena." />
  }

  const shiftLabels: Record<string, string> = {
    MORNING: 'Jutarnja', AFTERNOON: 'Poslijepodnevna', NIGHT: 'Noćna',
  }

  return (
    <div className="space-y-2">
      {handovers.map((h) => (
        <Card key={h.id} className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="secondary" className="text-xs">{shiftLabels[h.shiftType] ?? h.shiftType}</Badge>
                <span className="text-sm font-medium">{new Date(h.shiftDate).toLocaleDateString('hr-HR')}</span>
                <Badge className={`text-xs ${h.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {h.status === 'COMPLETED' ? 'Završena' : 'Na čekanju'}
                </Badge>
              </div>
              <div className="text-sm space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Predaje:</span>
                  <strong>{h.outgoingName}</strong>
                  <span className="text-xs text-muted-foreground font-mono">({h.outgoingCardId})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Preuzima:</span>
                  <strong>{h.incomingName}</strong>
                  <span className="text-xs text-muted-foreground font-mono">({h.incomingCardId})</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-3 flex-wrap">
                <span>Zaduženo sredstava: <strong>{h.assignedEquipmentCount}</strong></span>
                <span>Otvorena oštećenja: <strong className={h.openDamagesCount > 0 ? 'text-red-600' : ''}>{h.openDamagesCount}</strong></span>
                <span>{new Date(h.handoverAt).toLocaleString('hr-HR')}</span>
              </div>
              {h.notes && <div className="text-xs mt-1 p-1.5 bg-muted/30 rounded">{h.notes}</div>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function EmptyState({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>, text: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-muted-foreground">
        <Icon className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p>{text}</p>
      </CardContent>
    </Card>
  )
}
