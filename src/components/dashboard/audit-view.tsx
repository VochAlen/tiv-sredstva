'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  ClipboardCheck, Plus, Loader2, Calendar, Trash2, Search, Download, AlertTriangle,
  FileText, ShieldCheck, CheckCircle2, Clock, XCircle, AlertCircle, ListChecks,
  ChevronRight, Target,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  getAuditPrograms, createAuditProgram, deleteAuditProgram,
  getAudits, createAudit, updateAuditStatus, deleteAudit,
  getFindings, createFinding, updateFinding, deleteFinding,
  getCAPAs, createCAPA, updateCAPA, deleteCAPA,
  getComplianceItems, createComplianceItem, deleteComplianceItem,
  getAuditSummary,
} from '@/lib/actions-audit'

type Program = Awaited<ReturnType<typeof getAuditPrograms>>[number]
type Audit = Awaited<ReturnType<typeof getAudits>>[number]
type Finding = Awaited<ReturnType<typeof getFindings>>[number]
type CAPA = Awaited<ReturnType<typeof getCAPAs>>[number]
type Item = Awaited<ReturnType<typeof getComplianceItems>>[number]
type Summary = Awaited<ReturnType<typeof getAuditSummary>>

const AUDIT_TYPE_LABELS: Record<string, string> = {
  INTERNAL: 'Interni', EXTERNAL: 'Eksterni', REGULATORY: 'Regulatorni',
  SUPPLIER: 'Dobavljač', PROCESS: 'Procesni', SYSTEM: 'Sistemski',
}

const PROGRAM_STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planiran', SCHEDULED: 'Zakazan', IN_PROGRESS: 'U toku',
  COMPLETED: 'Završen', CANCELLED: 'Otkazan', OVERDUE: 'Prekoračen',
}

const AUDIT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Zakazan', IN_PROGRESS: 'U toku', COMPLETED: 'Završen', CANCELLED: 'Otkazan',
}

const RESULT_LABELS: Record<string, string> = {
  CONFORMANT: 'Sukladan', NON_CONFORMANT: 'Nesukladan', CONDITIONAL: 'Uslovno',
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  MAJOR: 'Major', MINOR: 'Minor', OBSERVATION: 'Opservacija', POSITIVE: 'Pozitivno',
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  MAJOR: 'bg-red-100 text-red-800',
  MINOR: 'bg-amber-100 text-amber-800',
  OBSERVATION: 'bg-blue-100 text-blue-800',
  POSITIVE: 'bg-emerald-100 text-emerald-800',
}

const FINDING_CATEGORY_LABELS: Record<string, string> = {
  DOCUMENTATION: 'Dokumentacija', PROCESS: 'Proces', TRAINING: 'Obuka',
  EQUIPMENT: 'Oprema', SAFETY: 'Sigurnost', COMPLIANCE: 'Sukladnost',
  RECORDS: 'Evidencije', OTHER: 'Ostalo',
}

const FINDING_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Otvoren', IN_PROGRESS: 'U toku', CORRECTED: 'Korigovan',
  VERIFIED: 'Verifikovan', CLOSED: 'Zatvoren', DEFERRED: 'Odgložen',
}

const CAPA_TYPE_LABELS: Record<string, string> = {
  CORRECTIVE: 'Korektivna', PREVENTIVE: 'Preventivna', CORRECTIVE_AND_PREVENTIVE: 'Korektivna + Preventivna',
}

const CAPA_SOURCE_LABELS: Record<string, string> = {
  AUDIT_FINDING: 'Nalaz audita', INCIDENT: 'Incident', HAZARD: 'Hazard',
  SMS: 'SMS', MANAGEMENT_REVIEW: 'Menadžment revizija',
  EXTERNAL_AUDIT: 'Eksterni audit', CUSTOMER_COMPLAINT: 'Žalba klijenta', OTHER: 'Ostalo',
}

const CAPA_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Otvorena', IN_PROGRESS: 'U toku', IMPLEMENTED: 'Implementirana',
  VERIFIED: 'Verifikovana', CLOSED: 'Zatvorena', OVERDUE: 'Prekoračena',
}

const COMPLIANCE_STATUS_LABELS: Record<string, string> = {
  COMPLIANT: 'Sukladno', NON_COMPLIANT: 'Nesukladno', PARTIAL: 'Djelimično',
  NOT_APPLICABLE: 'Nije primjenjivo', PENDING_REVIEW: 'Čeka pregled',
}

const COMPLIANCE_STATUS_COLORS: Record<string, string> = {
  COMPLIANT: 'bg-emerald-100 text-emerald-800',
  NON_COMPLIANT: 'bg-red-100 text-red-800',
  PARTIAL: 'bg-amber-100 text-amber-800',
  NOT_APPLICABLE: 'bg-gray-100 text-gray-800',
  PENDING_REVIEW: 'bg-blue-100 text-blue-800',
}

const COMPLIANCE_CATEGORY_LABELS: Record<string, string> = {
  PERSONNEL: 'Osoblje', FACILITIES: 'Objekti', EQUIPMENT: 'Oprema',
  DOCUMENTATION: 'Dokumentacija', MAINTENANCE: 'Održavanje', SMS: 'SMS', OTHER: 'Ostalo',
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Nizak', MEDIUM: 'Srednji', HIGH: 'Visok', CRITICAL: 'Kritičan',
}

export function AuditView() {
  const [tab, setTab] = useState<'summary' | 'programs' | 'audits' | 'findings' | 'capa' | 'compliance'>('summary')
  const [programs, setPrograms] = useState<Program[]>([])
  const [audits, setAudits] = useState<Audit[]>([])
  const [findings, setFindings] = useState<Finding[]>([])
  const [capas, setCapas] = useState<CAPA[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [p, a, f, c, i, s] = await Promise.all([
        getAuditPrograms(), getAudits(), getFindings(), getCAPAs(), getComplianceItems(), getAuditSummary(),
      ])
      setPrograms(p); setAudits(a); setFindings(f); setCapas(c); setItems(i); setSummary(s)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openFindings = findings.filter(f => f.status === 'OPEN' || f.status === 'IN_PROGRESS').length
  const overdueFindings = findings.filter(f => f.dueDate && new Date(f.dueDate) < new Date() && f.status !== 'CLOSED' && f.status !== 'VERIFIED').length
  const openCAPAs = capas.filter(c => c.status === 'OPEN' || c.status === 'IN_PROGRESS').length
  const nonCompliant = items.filter(i => i.status === 'NON_COMPLIANT' || i.status === 'PARTIAL').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><ClipboardCheck className="h-5 w-5" />Audit & Compliance Monitoring</h2>
          <p className="text-sm text-muted-foreground">ADR.OPS.D.005 · EASA Part-145.A.65 · CAPA · Compliance Matrix</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/audit-export', '_blank')}><Download className="h-4 w-4 mr-1.5" />Trag izmjena CSV (admin)</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/audit-program', '_blank')}><Download className="h-4 w-4 mr-1.5" />Program PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/audit-audits', '_blank')}><Download className="h-4 w-4 mr-1.5" />Auditi PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/audit-findings', '_blank')}><Download className="h-4 w-4 mr-1.5" />Nalazi PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/audit-capa', '_blank')}><Download className="h-4 w-4 mr-1.5" />CAPA PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/audit-compliance-matrix', '_blank')}><Download className="h-4 w-4 mr-1.5" />Compliance Matrix PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/audit-summary', '_blank')}><Download className="h-4 w-4 mr-1.5" />Sažetak PDF</Button>
        </div>
      </div>

      {/* Alert cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AlertCard icon={ClipboardCheck} label="Otvoreni nalazi" value={openFindings} tone="amber" onClick={() => setTab('findings')} />
        <AlertCard icon={AlertTriangle} label="Prekoračeni" value={overdueFindings} tone="red" onClick={() => setTab('findings')} />
        <AlertCard icon={ListChecks} label="Otvorene CAPA" value={openCAPAs} tone="purple" onClick={() => setTab('capa')} />
        <AlertCard icon={AlertCircle} label="Nesukladnosti" value={nonCompliant} tone="red" onClick={() => setTab('compliance')} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto">
        <TabBtn active={tab === 'summary'} onClick={() => setTab('summary')} icon={ClipboardCheck} label="Sažetak" />
        <TabBtn active={tab === 'programs'} onClick={() => setTab('programs')} icon={Calendar} label="Audit Program" />
        <TabBtn active={tab === 'audits'} onClick={() => setTab('audits')} icon={FileText} label="Auditi" />
        <TabBtn active={tab === 'findings'} onClick={() => setTab('findings')} icon={AlertTriangle} label="Nalazi" />
        <TabBtn active={tab === 'capa'} onClick={() => setTab('capa')} icon={ListChecks} label="CAPA" />
        <TabBtn active={tab === 'compliance'} onClick={() => setTab('compliance')} icon={ShieldCheck} label="Compliance Matrix" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : tab === 'summary' ? (
        <SummaryView summary={summary} />
      ) : tab === 'programs' ? (
        <ProgramsList programs={programs} onUpdated={load} />
      ) : tab === 'audits' ? (
        <AuditsList audits={audits} onUpdated={load} />
      ) : tab === 'findings' ? (
        <FindingsList findings={findings} audits={audits} onUpdated={load} />
      ) : tab === 'capa' ? (
        <CAPAList capas={capas} findings={findings} onUpdated={load} />
      ) : (
        <ComplianceList items={items} onUpdated={load} />
      )}
    </div>
  )
}

// ============================================================================
// SUMMARY VIEW
// ============================================================================

function SummaryView({ summary }: { summary: Summary | null }) {
  if (!summary) return null
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Ukupno programa" value={summary.programs.total} sub={`${summary.programs.completed} završeno`} icon={Calendar} tone="blue" />
        <StatCard label="Otvoreni nalazi" value={summary.findings.open} sub={`${summary.findings.overdue} prekoračeno`} icon={AlertTriangle} tone="amber" />
        <StatCard label="Otvorene CAPA" value={summary.capas.open} sub={`${summary.capas.overdue} prekoračeno`} icon={ListChecks} tone="purple" />
        <StatCard label="Compliance rate" value={`${summary.compliance.rate.toFixed(0)}%`} sub={`${summary.compliance.compliant}/${summary.compliance.total} sukladno`} icon={ShieldCheck} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Findings by classification */}
        <Card>
          <CardHeader><CardTitle className="text-base">Nalazi po klasifikaciji</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {['MAJOR', 'MINOR', 'OBSERVATION', 'POSITIVE'].map(cls => {
                const count = summary.findings.byClass[cls] || 0
                const max = Math.max(...Object.values(summary.findings.byClass) as number[], 1)
                const pct = (count / max) * 100
                const color = cls === 'MAJOR' ? 'bg-red-500' : cls === 'MINOR' ? 'bg-amber-500' : cls === 'OBSERVATION' ? 'bg-blue-500' : 'bg-emerald-500'
                return (
                  <div key={cls} className="flex items-center gap-2">
                    <div className="w-24 text-xs">{CLASSIFICATION_LABELS[cls]}</div>
                    <div className="flex-1 h-6 bg-muted/30 rounded relative overflow-hidden">
                      <div className={`absolute inset-y-0 left-0 ${color}`} style={{ width: `${pct}%` }} />
                      <div className="absolute inset-0 flex items-center px-2 text-xs font-medium">{count}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Findings by category */}
        <Card>
          <CardHeader><CardTitle className="text-base">Nalazi po kategoriji</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(summary.findings.byCategory).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nema podataka</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(summary.findings.byCategory).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs">
                    <span>{FINDING_CATEGORY_LABELS[cat] ?? cat}</span>
                    <Badge variant="secondary">{count as number}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compliance by category */}
        <Card>
          <CardHeader><CardTitle className="text-base">Sukladnost po kategoriji</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(summary.compliance.byCategory).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nema podataka</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(summary.compliance.byCategory).map(([cat, data]) => {
                  const rate = data.total > 0 ? (data.compliant / data.total) * 100 : 0
                  const color = rate === 100 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <div className="w-32 text-xs">{COMPLIANCE_CATEGORY_LABELS[cat] ?? cat}</div>
                      <div className="flex-1 h-6 bg-muted/30 rounded relative overflow-hidden">
                        <div className={`absolute inset-y-0 left-0 ${color}`} style={{ width: `${rate}%` }} />
                        <div className="absolute inset-0 flex items-center px-2 text-xs font-medium">{data.compliant}/{data.total} ({rate.toFixed(0)}%)</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Programs summary */}
        <Card>
          <CardHeader><CardTitle className="text-base">Audit Program status</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="text-sm">Planirano/Zakazano</span>
                <Badge className="bg-blue-100 text-blue-800">{summary.programs.planned}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-emerald-50 rounded">
                <span className="text-sm">Završeno</span>
                <Badge className="bg-emerald-100 text-emerald-800">{summary.programs.completed}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                <span className="text-sm">Prekoračeno</span>
                <Badge className="bg-red-100 text-red-800">{summary.programs.overdue}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="text-sm">Ukupno audita</span>
                <Badge variant="secondary">{summary.audits.total}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ============================================================================
// PROGRAMS LIST
// ============================================================================

function ProgramsList({ programs, onUpdated }: { programs: Program[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)

  const filtered = programs.filter((p) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [p.programId, p.title, p.auditScope, p.leadAuditor, p.auditees, p.auditStandard].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (typeFilter !== 'ALL' && p.auditType !== typeFilter) return false
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po ID, naslovu, opsegu, auditoru..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tip" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi tipovi</SelectItem>
            {Object.entries(AUDIT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            {Object.entries(PROGRAM_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Novi program</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {programs.length}</div>
      </div>

      {programs.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema auditiranih programa.</p>
          <p className="text-xs mt-1">Kliknite "Novi program" da kreirate godišnji plan audita.</p>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema rezultata pretrage.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => <ProgramCard key={p.id} program={p} onDeleted={onUpdated} />)}
        </div>
      )}

      <AddProgramDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} />
    </div>
  )
}

function ProgramCard({ program: p, onDeleted }: { program: Program; onDeleted: () => void }) {
  const [isPending, startTransition] = useTransition()
  const handleDelete = () => {
    if (!confirm('Obrisati program audita?')) return
    startTransition(async () => {
      const res = await deleteAuditProgram(p.id)
      if (res.ok) { toast.success('Obrisano'); onDeleted() }
      else toast.error(res.error ?? 'Greška')
    })
  }
  return (
    <Card className="p-4 border-l-4 border-l-blue-500">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">{p.programId}</Badge>
            <Badge variant="secondary" className="text-xs">{AUDIT_TYPE_LABELS[p.auditType] ?? p.auditType}</Badge>
            <Badge className="text-xs">{PROGRAM_STATUS_LABELS[p.status] ?? p.status}</Badge>
            <Badge variant="outline" className="text-xs">{PRIORITY_LABELS[p.priority] ?? p.priority}</Badge>
          </div>
          <div className="text-sm font-medium">{p.title}</div>
          <div className="text-xs text-muted-foreground mt-1">{p.auditScope}</div>
          {p.auditStandard && <div className="text-xs text-muted-foreground mt-0.5">Standard: {p.auditStandard}</div>}
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span>Auditor: {p.leadAuditor}</span>
            <span>Godina: {p.plannedYear}{p.plannedQuarter ? ` Q${p.plannedQuarter}` : ''}</span>
            {p.plannedDate && <span className={p.status !== 'COMPLETED' && new Date(p.plannedDate) < new Date() ? 'text-red-600 font-medium' : ''}>Planirano: {new Date(p.plannedDate).toLocaleDateString('hr-HR')}</span>}
            {p.auditees && <span>Auditees: {p.auditees}</span>}
          </div>
          {(p.findingsCount > 0 || p.majorFindings > 0) && (
            <div className="text-xs mt-1 flex items-center gap-2">
              <span>Ukupno nalaza: <strong>{p.findingsCount}</strong></span>
              {p.majorFindings > 0 && <Badge className="bg-red-100 text-red-800 text-xs">Major: {p.majorFindings}</Badge>}
              {p.minorFindings > 0 && <Badge className="bg-amber-100 text-amber-800 text-xs">Minor: {p.minorFindings}</Badge>}
              {p.observations > 0 && <Badge className="bg-blue-100 text-blue-800 text-xs">Ops: {p.observations}</Badge>}
            </div>
          )}
          {p.overallResult && <Badge className={`mt-1 text-xs ${p.overallResult === 'CONFORMANT' ? 'bg-emerald-100 text-emerald-800' : p.overallResult === 'NON_CONFORMANT' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>Rezultat: {RESULT_LABELS[p.overallResult]}</Badge>}
          {p.notes && <div className="text-xs mt-1 text-muted-foreground italic">{p.notes}</div>}
        </div>
        <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
        </Button>
      </div>
    </Card>
  )
}

function AddProgramDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [auditType, setAuditType] = useState('INTERNAL')
  const [auditScope, setAuditScope] = useState('')
  const [auditStandard, setAuditStandard] = useState('EASA Part-145')
  const [plannedYear, setPlannedYear] = useState(new Date().getFullYear())
  const [plannedQuarter, setPlannedQuarter] = useState('1')
  const [plannedDate, setPlannedDate] = useState('')
  const [leadAuditor, setLeadAuditor] = useState('')
  const [auditees, setAuditees] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await createAuditProgram({
        title, auditType, auditScope, auditStandard: auditStandard || undefined,
        plannedYear, plannedQuarter: parseInt(plannedQuarter),
        plannedDate: plannedDate || undefined, leadAuditor,
        auditees: auditees || undefined, priority, notes: notes || undefined,
      })
      if (res.ok) {
        toast.success(`Program kreiran: ${res.programId}`)
        onOpenChange(false); onAdded()
        setTitle(''); setAuditScope(''); setLeadAuditor(''); setAuditees(''); setNotes(''); setPlannedDate('')
      } else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novi audit program</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5"><Label>Naslov *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="npr. Internal Audit GSE Operations Q1 2026" required /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Tip audita</Label>
              <Select value={auditType} onValueChange={setAuditType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(AUDIT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioritet</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Opseg audita *</Label><Textarea value={auditScope} onChange={(e) => setAuditScope(e.target.value)} rows={2} placeholder="npr. GSE maintenance, QR check-out, fuel operations" required /></div>
          <div className="space-y-1.5"><Label>Standard</Label><Input value={auditStandard} onChange={(e) => setAuditStandard(e.target.value)} placeholder="EASA Part-145, ADR.OPS.D.005, ISO 9001" /></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5"><Label>Godina</Label><Input type="number" value={plannedYear} onChange={(e) => setPlannedYear(parseInt(e.target.value))} required /></div>
            <div className="space-y-1.5">
              <Label>Kvartal</Label>
              <Select value={plannedQuarter} onValueChange={setPlannedQuarter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4].map(q => <SelectItem key={q} value={q.toString()}>Q{q}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Planirani datum</Label><Input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Glavni auditor *</Label><Input value={leadAuditor} onChange={(e) => setLeadAuditor(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Auditees</Label><Input value={auditees} onChange={(e) => setAuditees(e.target.value)} placeholder="Maintenance Dept, Ramp Ops" /></div>
          </div>
          <div className="space-y-1.5"><Label>Napomene</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sačuvaj</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// AUDITS LIST
// ============================================================================

function AuditsList({ audits, onUpdated }: { audits: Audit[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)

  const filtered = audits.filter((a) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [a.auditId, a.title, a.auditScope, a.leadAuditor, a.auditTeam, a.auditeeOrganization, a.summary, a.recommendations].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (typeFilter !== 'ALL' && a.auditType !== typeFilter) return false
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po ID, naslovu, opsegu, auditoru..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tip" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi tipovi</SelectItem>
            {Object.entries(AUDIT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            {Object.entries(AUDIT_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Novi audit</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {audits.length}</div>
      </div>

      {audits.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema zabilježenih audita.</p>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema rezultata pretrage.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => <AuditCard key={a.id} audit={a} onDeleted={onUpdated} />)}
        </div>
      )}

      <AddAuditDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} />
    </div>
  )
}

function AuditCard({ audit: a, onDeleted }: { audit: Audit; onDeleted: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [showActions, setShowActions] = useState(false)
  const [status, setStatus] = useState(a.status)
  const [result, setResult] = useState(a.overallResult || 'CONFORMANT')
  const [summary, setSummary] = useState(a.summary || '')

  const handleUpdate = () => {
    startTransition(async () => {
      const res = await updateAuditStatus(a.id, status, result, summary)
      if (res.ok) { toast.success('Audit ažuriran'); setShowActions(false); onDeleted() }
      else toast.error(res.error ?? 'Greška')
    })
  }
  const handleDelete = () => {
    if (!confirm('Obrisati audit?')) return
    startTransition(async () => {
      const res = await deleteAudit(a.id)
      if (res.ok) { toast.success('Obrisano'); onDeleted() }
      else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Card className={`p-4 border-l-4 ${a.status === 'COMPLETED' ? 'border-l-emerald-500' : a.status === 'IN_PROGRESS' ? 'border-l-amber-500' : 'border-l-blue-500'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">{a.auditId}</Badge>
            <Badge variant="secondary" className="text-xs">{AUDIT_TYPE_LABELS[a.auditType] ?? a.auditType}</Badge>
            <Badge className="text-xs">{AUDIT_STATUS_LABELS[a.status] ?? a.status}</Badge>
            {a.overallResult && <Badge className={`text-xs ${a.overallResult === 'CONFORMANT' ? 'bg-emerald-100 text-emerald-800' : a.overallResult === 'NON_CONFORMANT' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{RESULT_LABELS[a.overallResult]}</Badge>}
            {a.findings && a.findings.length > 0 && <Badge variant="outline" className="text-xs">{a.findings.length} nalaza</Badge>}
          </div>
          <div className="text-sm font-medium">{a.title}</div>
          <div className="text-xs text-muted-foreground mt-1">{a.auditScope}</div>
          {a.auditStandard && <div className="text-xs text-muted-foreground mt-0.5">Standard: {a.auditStandard}</div>}
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span>Auditor: {a.leadAuditor}</span>
            {a.auditTeam && <span>Tim: {a.auditTeam}</span>}
            {a.auditeeOrganization && <span>Audirano: {a.auditeeOrganization}</span>}
            <span className={a.status === 'SCHEDULED' && new Date(a.scheduledDate) < new Date() ? 'text-red-600 font-medium' : ''}>Zakazano: {new Date(a.scheduledDate).toLocaleDateString('hr-HR')}</span>
          </div>
          {a.summary && <div className="text-xs mt-1 p-2 bg-muted/30 rounded">{a.summary}</div>}
          {a.recommendations && <div className="text-xs mt-1 p-2 bg-blue-50 rounded"><strong>Preporuke:</strong> {a.recommendations}</div>}
        </div>
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="ghost" onClick={() => setShowActions(!showActions)}>Ažuriraj</Button>
          <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
          </Button>
        </div>
      </div>

      {showActions && (
        <div className="mt-3 p-3 bg-muted/30 rounded-lg space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(AUDIT_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rezultat</Label>
              <Select value={result} onValueChange={setResult}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(RESULT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Sažeti izvještaj</Label><Textarea className="text-xs" value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} /></div>
          <Button size="sm" onClick={handleUpdate} disabled={isPending}>{isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Sačuvaj</Button>
        </div>
      )}
    </Card>
  )
}

function AddAuditDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [auditType, setAuditType] = useState('INTERNAL')
  const [auditScope, setAuditScope] = useState('')
  const [auditStandard, setAuditStandard] = useState('EASA Part-145')
  const [scheduledDate, setScheduledDate] = useState('')
  const [leadAuditor, setLeadAuditor] = useState('')
  const [auditTeam, setAuditTeam] = useState('')
  const [auditeeOrganization, setAuditeeOrganization] = useState('')
  const [auditeeAreas, setAuditeeAreas] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await createAudit({
        title, auditType, auditScope, auditStandard: auditStandard || undefined,
        scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : new Date().toISOString(),
        leadAuditor, auditTeam: auditTeam || undefined,
        auditeeOrganization: auditeeOrganization || undefined, auditeeAreas: auditeeAreas || undefined,
      })
      if (res.ok) {
        toast.success(`Audit kreiran: ${res.auditId}`)
        onOpenChange(false); onAdded()
        setTitle(''); setAuditScope(''); setLeadAuditor(''); setAuditTeam(''); setAuditeeOrganization(''); setAuditeeAreas(''); setScheduledDate('')
      } else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novi audit</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5"><Label>Naslov *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Tip audita</Label>
              <Select value={auditType} onValueChange={setAuditType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(AUDIT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Standard</Label><Input value={auditStandard} onChange={(e) => setAuditStandard(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Opseg audita *</Label><Textarea value={auditScope} onChange={(e) => setAuditScope(e.target.value)} rows={2} required /></div>
          <div className="space-y-1.5"><Label>Datum zakazivanja *</Label><Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Glavni auditor *</Label><Input value={leadAuditor} onChange={(e) => setLeadAuditor(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Audit tim</Label><Input value={auditTeam} onChange={(e) => setAuditTeam(e.target.value)} placeholder="Ana, Marko" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Audirana organizacija</Label><Input value={auditeeOrganization} onChange={(e) => setAuditeeOrganization(e.target.value)} placeholder="Maintenance Dept" /></div>
            <div className="space-y-1.5"><Label>Audirane oblasti</Label><Input value={auditeeAreas} onChange={(e) => setAuditeeAreas(e.target.value)} placeholder="Workshop, Ramp" /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sačuvaj</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// FINDINGS LIST
// ============================================================================

function FindingsList({ findings, audits, onUpdated }: { findings: Finding[]; audits: Audit[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('ALL')
  const [catFilter, setCatFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)
  const [editFinding, setEditFinding] = useState<Finding | null>(null)

  const filtered = findings.filter((f) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [f.findingId, f.title, f.description, f.criteria, f.evidence, f.area, f.process, f.rootCause, f.correctiveAction, f.preventiveAction].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (classFilter !== 'ALL' && f.classification !== classFilter) return false
    if (catFilter !== 'ALL' && f.category !== catFilter) return false
    if (statusFilter !== 'ALL' && f.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po ID, naslovu, opisu, kriterijumu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Klasifikacija" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Sve klasifikacije</SelectItem>
            {Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Kategorija" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Sve kategorije</SelectItem>
            {Object.entries(FINDING_CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            {Object.entries(FINDING_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Novi nalaz</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {findings.length}</div>
      </div>

      {findings.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema zabilježenih nalaza audita.</p>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema rezultata pretrage.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => <FindingCard key={f.id} finding={f} onUpdated={onUpdated} onEdit={() => setEditFinding(f)} />)}
        </div>
      )}

      <AddFindingDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} audits={audits} />
      <EditFindingDialog finding={editFinding} onOpenChange={(v) => !v && setEditFinding(null)} onUpdated={onUpdated} />
    </div>
  )
}

function FindingCard({ finding: f, onUpdated, onEdit }: { finding: Finding; onUpdated: () => void; onEdit: () => void }) {
  const [isPending, startTransition] = useTransition()
  const handleDelete = () => {
    if (!confirm('Obrisati nalaz?')) return
    startTransition(async () => {
      const res = await deleteFinding(f.id)
      if (res.ok) { toast.success('Obrisano'); onUpdated() }
      else toast.error(res.error ?? 'Greška')
    })
  }
  const isOverdue = f.dueDate && new Date(f.dueDate) < new Date() && f.status !== 'CLOSED' && f.status !== 'VERIFIED'
  return (
    <Card className={`p-4 border-l-4 ${f.classification === 'MAJOR' ? 'border-l-red-500' : f.classification === 'MINOR' ? 'border-l-amber-500' : 'border-l-blue-500'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">{f.findingId}</Badge>
            <Badge className={`text-xs ${CLASSIFICATION_COLORS[f.classification]}`}>{CLASSIFICATION_LABELS[f.classification]}</Badge>
            <Badge variant="secondary" className="text-xs">{FINDING_CATEGORY_LABELS[f.category] ?? f.category}</Badge>
            <Badge variant="outline" className="text-xs">{FINDING_STATUS_LABELS[f.status] ?? f.status}</Badge>
            {f.riskLevel && <Badge className={`text-xs ${f.riskLevel === 'CRITICAL' ? 'bg-red-100 text-red-800' : f.riskLevel === 'HIGH' ? 'bg-orange-100 text-orange-800' : 'bg-amber-100 text-amber-800'}`}>{f.riskLevel}</Badge>}
            {isOverdue && <Badge className="text-xs bg-red-100 text-red-800 animate-pulse">PREKORAČENO</Badge>}
          </div>
          <div className="text-sm font-medium">{f.title}</div>
          <div className="text-xs text-muted-foreground mt-1">{f.description}</div>
          {f.criteria && <div className="text-xs mt-1 p-1.5 bg-muted/30 rounded">Kriterijum: <strong>{f.criteria}</strong></div>}
          {f.evidence && <div className="text-xs mt-1">Dokaz: {f.evidence}</div>}
          {f.area && <div className="text-xs text-muted-foreground mt-0.5">Oblast: {f.area}{f.process && ` · Proces: ${f.process}`}</div>}
          {f.rootCause && <div className="text-xs mt-1 p-1.5 bg-amber-50 rounded"><strong>Korijenski uzrok:</strong> {f.rootCause}</div>}
          {(f.correctiveAction || f.immediateAction || f.preventiveAction) && (
            <div className="text-xs mt-1 p-1.5 bg-emerald-50 rounded">
              {f.immediateAction && <div><strong>Hitna:</strong> {f.immediateAction}</div>}
              {f.correctiveAction && <div><strong>Korektivna:</strong> {f.correctiveAction}</div>}
              {f.preventiveAction && <div><strong>Preventivna:</strong> {f.preventiveAction}</div>}
            </div>
          )}
          {f.verificationResult && <div className="text-xs mt-1 p-1.5 bg-blue-50 rounded"><strong>Verifikacija:</strong> {f.verificationResult} {f.verifiedBy && `(${f.verifiedBy})`}</div>}
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span>{new Date(f.createdAt).toLocaleDateString('hr-HR')}</span>
            {f.audit && <span>· Audit: {f.audit.auditId}</span>}
            {f.assignedTo && <span>Zadužen: {f.assignedTo}</span>}
            {f.dueDate && <span className={isOverdue ? 'text-red-600 font-medium' : ''}>Rok: {new Date(f.dueDate).toLocaleDateString('hr-HR')}</span>}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit}>Upravljaj</Button>
          <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function AddFindingDialog({ open, onOpenChange, onAdded, audits }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void; audits: Audit[] }) {
  const [auditId, setAuditId] = useState('')
  const [classification, setClassification] = useState('MINOR')
  const [category, setCategory] = useState('PROCESS')
  const [findingType, setFindingType] = useState('CONFORMITY')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [criteria, setCriteria] = useState('')
  const [evidence, setEvidence] = useState('')
  const [area, setArea] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [riskLevel, setRiskLevel] = useState('MEDIUM')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!auditId) { toast.error('Izaberite audit'); return }
    startTransition(async () => {
      const res = await createFinding({
        auditId, classification, category, findingType, title, description,
        criteria: criteria || undefined, evidence: evidence || undefined, area: area || undefined,
        assignedTo: assignedTo || undefined, dueDate: dueDate || undefined, riskLevel,
      })
      if (res.ok) {
        toast.success(`Nalaz kreiran: ${res.findingId}`)
        onOpenChange(false); onAdded()
        setTitle(''); setDescription(''); setCriteria(''); setEvidence(''); setArea(''); setAssignedTo(''); setDueDate('')
      } else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novi nalaz audita</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Audit *</Label>
            <Select value={auditId} onValueChange={setAuditId}>
              <SelectTrigger><SelectValue placeholder="Izaberite audit..." /></SelectTrigger>
              <SelectContent>{audits.map(a => <SelectItem key={a.id} value={a.id}>{a.auditId} — {a.title.slice(0, 30)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Klasifikacija</Label>
              <Select value={classification} onValueChange={setClassification}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kategorija</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(FINDING_CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Tip nalaza</Label>
              <Select value={findingType} onValueChange={setFindingType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONFORMITY">Sukladnost</SelectItem>
                  <SelectItem value="EFFECTIVENESS">Efikasnost</SelectItem>
                  <SelectItem value="OPPORTUNITY_FOR_IMPROVEMENT">Prilika za unapređenje</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nivo rizika</Label>
              <Select value={riskLevel} onValueChange={setRiskLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(r => <SelectItem key={r} value={r}>{PRIORITY_LABELS[r] ?? r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Naslov *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label>Opis *</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Kriterijum</Label><Input value={criteria} onChange={(e) => setCriteria(e.target.value)} placeholder="npr. Part-145.A.40" /></div>
            <div className="space-y-1.5"><Label>Oblast</Label><Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Maintenance log" /></div>
          </div>
          <div className="space-y-1.5"><Label>Dokaz</Label><Textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={2} placeholder="Interview, dokument, posmatranje..." /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Zadužen</Label><Input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Rok</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sačuvaj</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditFindingDialog({ finding, onOpenChange, onUpdated }: { finding: Finding | null; onOpenChange: (v: boolean) => void; onUpdated: () => void }) {
  const [rootCause, setRootCause] = useState('')
  const [immediateAction, setImmediateAction] = useState('')
  const [correctiveAction, setCorrectiveAction] = useState('')
  const [preventiveAction, setPreventiveAction] = useState('')
  const [status, setStatus] = useState('OPEN')
  const [verificationResult, setVerificationResult] = useState('')
  const [verifiedBy, setVerifiedBy] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (finding) {
      setRootCause(finding.rootCause || '')
      setImmediateAction(finding.immediateAction || '')
      setCorrectiveAction(finding.correctiveAction || '')
      setPreventiveAction(finding.preventiveAction || '')
      setStatus(finding.status)
      setVerificationResult(finding.verificationResult || '')
      setVerifiedBy(finding.verifiedBy || '')
    }
  }, [finding])

  if (!finding) return null
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await updateFinding(finding.id, {
        rootCause, immediateAction, correctiveAction, preventiveAction, status,
        verificationResult: verificationResult || undefined, verifiedBy: verifiedBy || undefined,
      })
      if (res.ok) { toast.success('Nalaz ažuriran'); onOpenChange(false); onUpdated() }
      else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={!!finding} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Upravljaj nalazom: {finding.findingId}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="p-2 bg-muted/30 rounded text-sm">
            <div className="font-medium">{finding.title}</div>
            <div className="text-xs text-muted-foreground mt-1">{finding.description.slice(0, 100)}...</div>
          </div>
          <div className="space-y-1.5"><Label>Korijenski uzrok (5-why)</Label><Textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={3} placeholder="Analiza korijenskog uzroka..." /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Hitna mjera</Label><Textarea value={immediateAction} onChange={(e) => setImmediateAction(e.target.value)} rows={2} /></div>
            <div className="space-y-1.5"><Label>Korektivna mjera</Label><Textarea value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} rows={2} /></div>
          </div>
          <div className="space-y-1.5"><Label>Preventivna mjera</Label><Textarea value={preventiveAction} onChange={(e) => setPreventiveAction(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(FINDING_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Verifikovao</Label><Input value={verifiedBy} onChange={(e) => setVerifiedBy(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Rezultat verifikacije</Label><Textarea value={verificationResult} onChange={(e) => setVerificationResult(e.target.value)} rows={2} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sačuvaj</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// CAPA LIST
// ============================================================================

function CAPAList({ capas, findings, onUpdated }: { capas: CAPA[]; findings: Finding[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)
  const [editCAPA, setEditCAPA] = useState<CAPA | null>(null)

  const filtered = capas.filter((c) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [c.capaId, c.title, c.description, c.problemStatement, c.rootCause, c.correctiveAction, c.preventiveAction, c.assignedTo, c.sourceRef, c.verificationResult].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (typeFilter !== 'ALL' && c.type !== typeFilter) return false
    if (sourceFilter !== 'ALL' && c.source !== sourceFilter) return false
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po ID, naslovu, problemu, akciji..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Tip" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi tipovi</SelectItem>
            {Object.entries(CAPA_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Izvor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi izvori</SelectItem>
            {Object.entries(CAPA_SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            {Object.entries(CAPA_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Nova CAPA</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {capas.length}</div>
      </div>

      {capas.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <ListChecks className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema CAPA akcija.</p>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <ListChecks className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema rezultata pretrage.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => <CAPACard key={c.id} capa={c} onUpdated={onUpdated} onEdit={() => setEditCAPA(c)} />)}
        </div>
      )}

      <AddCAPADialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} findings={findings} />
      <EditCAPADialog capa={editCAPA} onOpenChange={(v) => !v && setEditCAPA(null)} onUpdated={onUpdated} />
    </div>
  )
}

function CAPACard({ capa: c, onUpdated, onEdit }: { capa: CAPA; onUpdated: () => void; onEdit: () => void }) {
  const [isPending, startTransition] = useTransition()
  const handleDelete = () => {
    if (!confirm('Obrisati CAPA?')) return
    startTransition(async () => {
      const res = await deleteCAPA(c.id)
      if (res.ok) { toast.success('Obrisano'); onUpdated() }
      else toast.error(res.error ?? 'Greška')
    })
  }
  const isOverdue = c.dueDate && new Date(c.dueDate) < new Date() && c.status !== 'CLOSED' && c.status !== 'VERIFIED'
  return (
    <Card className={`p-4 border-l-4 ${c.status === 'CLOSED' || c.status === 'VERIFIED' ? 'border-l-emerald-500' : isOverdue ? 'border-l-red-500' : 'border-l-purple-500'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">{c.capaId}</Badge>
            <Badge variant="secondary" className="text-xs">{CAPA_TYPE_LABELS[c.type] ?? c.type}</Badge>
            <Badge variant="outline" className="text-xs">{CAPA_SOURCE_LABELS[c.source] ?? c.source}</Badge>
            <Badge className="text-xs">{CAPA_STATUS_LABELS[c.status] ?? c.status}</Badge>
            {c.sourceRef && <Badge variant="outline" className="text-xs font-mono">{c.sourceRef}</Badge>}
            {isOverdue && <Badge className="text-xs bg-red-100 text-red-800 animate-pulse">PREKORAČENO</Badge>}
          </div>
          <div className="text-sm font-medium">{c.title}</div>
          <div className="text-xs text-muted-foreground mt-1">{c.description}</div>
          <div className="text-xs mt-1 p-1.5 bg-muted/30 rounded"><strong>Problem:</strong> {c.problemStatement}</div>
          {c.rootCause && <div className="text-xs mt-1 p-1.5 bg-amber-50 rounded"><strong>Korijenski uzrok:</strong> {c.rootCause}</div>}
          {(c.correctiveAction || c.preventiveAction) && (
            <div className="text-xs mt-1 p-1.5 bg-emerald-50 rounded">
              {c.correctiveAction && <div><strong>Korektivna:</strong> {c.correctiveAction}</div>}
              {c.preventiveAction && <div><strong>Preventivna:</strong> {c.preventiveAction}</div>}
            </div>
          )}
          {c.verificationResult && <div className="text-xs mt-1 p-1.5 bg-blue-50 rounded"><strong>Verifikacija:</strong> {c.verificationResult} {c.verifiedBy && `(${c.verifiedBy})`}</div>}
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span>Zadužen: {c.assignedTo}</span>
            <span className={isOverdue ? 'text-red-600 font-medium' : ''}>Rok: {new Date(c.dueDate).toLocaleDateString('hr-HR')}</span>
            {c.completedAt && <span>Završeno: {new Date(c.completedAt).toLocaleDateString('hr-HR')}</span>}
            {c.estimatedCost != null && <span>Procjena: {c.estimatedCost}€</span>}
            {c.actualCost != null && <span>Stvarno: {c.actualCost}€</span>}
          </div>
          {c.progressNotes && <div className="text-xs mt-1 text-muted-foreground italic">{c.progressNotes}</div>}
        </div>
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit}>Upravljaj</Button>
          <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function AddCAPADialog({ open, onOpenChange, onAdded, findings }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void; findings: Finding[] }) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState('CORRECTIVE')
  const [source, setSource] = useState('AUDIT_FINDING')
  const [sourceRef, setSourceRef] = useState('')
  const [problemStatement, setProblemStatement] = useState('')
  const [rootCause, setRootCause] = useState('')
  const [correctiveAction, setCorrectiveAction] = useState('')
  const [preventiveAction, setPreventiveAction] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await createCAPA({
        title, description: problemStatement.slice(0, 200), type, source,
        sourceRef: sourceRef || undefined, problemStatement,
        rootCause: rootCause || undefined,
        correctiveAction: correctiveAction || undefined,
        preventiveAction: preventiveAction || undefined,
        assignedTo, dueDate: dueDate || new Date(Date.now() + 30 * 86400000).toISOString(),
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
      })
      if (res.ok) {
        toast.success(`CAPA kreirana: ${res.capaId}`)
        onOpenChange(false); onAdded()
        setTitle(''); setProblemStatement(''); setRootCause(''); setCorrectiveAction(''); setPreventiveAction(''); setAssignedTo(''); setSourceRef(''); setEstimatedCost(''); setDueDate('')
      } else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova CAPA akcija</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5"><Label>Naslov *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Tip</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CAPA_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Izvor</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CAPA_SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Referenca izvora</Label><Input value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="FIN-2026-001, HZ-2026-001..." className="font-mono" /></div>
          <div className="space-y-1.5"><Label>Opis problema *</Label><Textarea value={problemStatement} onChange={(e) => setProblemStatement(e.target.value)} rows={3} required /></div>
          <div className="space-y-1.5"><Label>Korijenski uzrok (5-why)</Label><Textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={3} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Korektivna akcija</Label><Textarea value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} rows={2} /></div>
            <div className="space-y-1.5"><Label>Preventivna akcija</Label><Textarea value={preventiveAction} onChange={(e) => setPreventiveAction(e.target.value)} rows={2} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5"><Label>Zadužen *</Label><Input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Rok</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Procjena (€)</Label><Input type="number" step="0.01" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sačuvaj</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditCAPADialog({ capa, onOpenChange, onUpdated }: { capa: CAPA | null; onOpenChange: (v: boolean) => void; onUpdated: () => void }) {
  const [status, setStatus] = useState('OPEN')
  const [implementationEvidence, setImplementationEvidence] = useState('')
  const [verificationMethod, setVerificationMethod] = useState('')
  const [verificationResult, setVerificationResult] = useState('')
  const [verifiedBy, setVerifiedBy] = useState('')
  const [actualCost, setActualCost] = useState('')
  const [progressNotes, setProgressNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (capa) {
      setStatus(capa.status)
      setImplementationEvidence(capa.implementationEvidence || '')
      setVerificationMethod(capa.verificationMethod || '')
      setVerificationResult(capa.verificationResult || '')
      setVerifiedBy(capa.verifiedBy || '')
      setActualCost(capa.actualCost?.toString() || '')
      setProgressNotes(capa.progressNotes || '')
    }
  }, [capa])

  if (!capa) return null
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await updateCAPA(capa.id, {
        status,
        implementationEvidence: implementationEvidence || undefined,
        verificationMethod: verificationMethod || undefined,
        verificationResult: verificationResult || undefined,
        verifiedBy: verifiedBy || undefined,
        actualCost: actualCost ? parseFloat(actualCost) : undefined,
        progressNotes: progressNotes || undefined,
      })
      if (res.ok) { toast.success('CAPA ažurirana'); onOpenChange(false); onUpdated() }
      else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={!!capa} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Upravljaj CAPA: {capa.capaId}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="p-2 bg-muted/30 rounded text-sm">
            <div className="font-medium">{capa.title}</div>
            <div className="text-xs text-muted-foreground mt-1">{capa.problemStatement.slice(0, 100)}...</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CAPA_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Verifikovao</Label><Input value={verifiedBy} onChange={(e) => setVerifiedBy(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Dokazi implementacije</Label><Textarea value={implementationEvidence} onChange={(e) => setImplementationEvidence(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Metod verifikacije</Label><Input value={verificationMethod} onChange={(e) => setVerificationMethod(e.target.value)} placeholder="Inspekcija, intervju..." /></div>
            <div className="space-y-1.5"><Label>Stvarni trošak (€)</Label><Input type="number" step="0.01" value={actualCost} onChange={(e) => setActualCost(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Rezultat verifikacije</Label><Textarea value={verificationResult} onChange={(e) => setVerificationResult(e.target.value)} rows={2} placeholder="EFFECTIVE / NOT_EFFECTIVE / PARTIAL..." /></div>
          <div className="space-y-1.5"><Label>Bilješke o napretku</Label><Textarea value={progressNotes} onChange={(e) => setProgressNotes(e.target.value)} rows={2} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sačuvaj</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// COMPLIANCE MATRIX
// ============================================================================

function ComplianceList({ items, onUpdated }: { items: Item[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)

  const filtered = items.filter((i) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [i.itemId, i.regulation, i.requirement, i.requirementText, i.internalDoc, i.docOwner, i.evidenceRef, i.evidenceDescription, i.gapDescription].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (catFilter !== 'ALL' && i.category !== catFilter) return false
    if (statusFilter !== 'ALL' && i.status !== statusFilter) return false
    return true
  })

  const compliant = filtered.filter(i => i.status === 'COMPLIANT').length
  const rate = filtered.length > 0 ? (compliant / filtered.length) * 100 : 0

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po regulativi, zahtjevu, dokumentu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Kategorija" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Sve kategorije</SelectItem>
            {Object.entries(COMPLIANCE_CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            {Object.entries(COMPLIANCE_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Nova stavka</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {items.length} · Sukladnost: <strong className={rate === 100 ? 'text-emerald-600' : rate >= 80 ? 'text-amber-600' : 'text-red-600'}>{rate.toFixed(0)}%</strong></div>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema definisanih compliance stavki.</p>
          <p className="text-xs mt-1">Kliknite "Nova stavka" da kreirate compliance matrix.</p>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema rezultata pretrage.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((i) => <ComplianceCard key={i.id} item={i} onDeleted={onUpdated} />)}
        </div>
      )}

      <AddComplianceDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} />
    </div>
  )
}

function ComplianceCard({ item: i, onDeleted }: { item: Item; onDeleted: () => void }) {
  const [isPending, startTransition] = useTransition()
  const handleDelete = () => {
    if (!confirm('Obrisati compliance stavku?')) return
    startTransition(async () => {
      const res = await deleteComplianceItem(i.id)
      if (res.ok) { toast.success('Obrisano'); onDeleted() }
      else toast.error(res.error ?? 'Greška')
    })
  }
  return (
    <Card className={`p-4 border-l-4 ${i.status === 'COMPLIANT' ? 'border-l-emerald-500' : i.status === 'NON_COMPLIANT' ? 'border-l-red-500' : i.status === 'PARTIAL' ? 'border-l-amber-500' : 'border-l-blue-500'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">{i.itemId}</Badge>
            <Badge className={`text-xs ${COMPLIANCE_STATUS_COLORS[i.status]}`}>{COMPLIANCE_STATUS_LABELS[i.status]}</Badge>
            <Badge variant="secondary" className="text-xs">{COMPLIANCE_CATEGORY_LABELS[i.category] ?? i.category}</Badge>
            <Badge variant="outline" className="font-mono text-xs">{i.regulation}</Badge>
            {i.riskLevel && <Badge className={`text-xs ${i.riskLevel === 'HIGH' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{i.riskLevel}</Badge>}
          </div>
          <div className="text-sm font-medium">{i.requirement}</div>
          {i.requirementText && <div className="text-xs text-muted-foreground mt-1">{i.requirementText.slice(0, 200)}{i.requirementText.length > 200 ? '...' : ''}</div>}
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            {i.internalDoc && <span>Interni dokument: <strong>{i.internalDoc}</strong>{i.docVersion && ` v${i.docVersion}`}</span>}
            {i.docOwner && <span>Vlasnik: {i.docOwner}</span>}
            {i.docLocation && <span>Lokacija: {i.docLocation}</span>}
          </div>
          {i.evidenceRef && <div className="text-xs mt-1 p-1.5 bg-emerald-50 rounded"><strong>Dokaz:</strong> {i.evidenceRef} {i.evidenceDescription && `· ${i.evidenceDescription}`}</div>}
          {i.gapDescription && <div className="text-xs mt-1 p-1.5 bg-red-50 rounded"><strong>Gap:</strong> {i.gapDescription}</div>}
          {i.correctiveAction && <div className="text-xs mt-1 p-1.5 bg-amber-50 rounded"><strong>Korektivna akcija:</strong> {i.correctiveAction}</div>}
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            {i.lastVerified && <span>Verifikovano: {new Date(i.lastVerified).toLocaleDateString('hr-HR')} {i.verifiedBy && `(${i.verifiedBy})`}</span>}
            {i.nextReviewDate && <span className={new Date(i.nextReviewDate) < new Date() ? 'text-red-600 font-medium' : ''}>Sljedeći pregled: {new Date(i.nextReviewDate).toLocaleDateString('hr-HR')}</span>}
            {i.reviewFrequency && <span>Učestalost: {i.reviewFrequency}</span>}
          </div>
          {i.notes && <div className="text-xs mt-1 text-muted-foreground italic">{i.notes}</div>}
        </div>
        <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
        </Button>
      </div>
    </Card>
  )
}

function AddComplianceDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const [regulation, setRegulation] = useState('')
  const [requirement, setRequirement] = useState('')
  const [requirementText, setRequirementText] = useState('')
  const [category, setCategory] = useState('MAINTENANCE')
  const [internalDoc, setInternalDoc] = useState('')
  const [docVersion, setDocVersion] = useState('')
  const [docOwner, setDocOwner] = useState('')
  const [evidenceType, setEvidenceType] = useState('DOCUMENT')
  const [evidenceRef, setEvidenceRef] = useState('')
  const [status, setStatus] = useState('COMPLIANT')
  const [riskLevel, setRiskLevel] = useState('LOW')
  const [gapDescription, setGapDescription] = useState('')
  const [correctiveAction, setCorrectiveAction] = useState('')
  const [reviewFrequency, setReviewFrequency] = useState('ANNUAL')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await createComplianceItem({
        regulation, requirement, requirementText: requirementText || undefined, category,
        internalDoc: internalDoc || undefined, docVersion: docVersion || undefined, docOwner: docOwner || undefined,
        evidenceType, evidenceRef: evidenceRef || undefined,
        status, riskLevel, gapDescription: gapDescription || undefined,
        correctiveAction: correctiveAction || undefined, reviewFrequency, notes: notes || undefined,
      })
      if (res.ok) {
        toast.success(`Stavka kreirana: ${res.itemId}`)
        onOpenChange(false); onAdded()
        setRegulation(''); setRequirement(''); setRequirementText(''); setInternalDoc(''); setDocVersion(''); setDocOwner('')
        setEvidenceRef(''); setGapDescription(''); setCorrectiveAction(''); setNotes('')
      } else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova compliance stavka</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Regulativa *</Label><Input value={regulation} onChange={(e) => setRegulation(e.target.value)} placeholder="EASA Part-145.A.40" className="font-mono" required /></div>
            <div className="space-y-1.5">
              <Label>Kategorija</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(COMPLIANCE_CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Zahtjev *</Label><Input value={requirement} onChange={(e) => setRequirement(e.target.value)} placeholder="Kratak opis zahtjeva" required /></div>
          <div className="space-y-1.5"><Label>Pun tekst zahtjeva</Label><Textarea value={requirementText} onChange={(e) => setRequirementText(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5"><Label>Interni dokument</Label><Input value={internalDoc} onChange={(e) => setInternalDoc(e.target.value)} placeholder="MOM-001" className="font-mono" /></div>
            <div className="space-y-1.5"><Label>Verzija</Label><Input value={docVersion} onChange={(e) => setDocVersion(e.target.value)} placeholder="2.1" /></div>
            <div className="space-y-1.5"><Label>Vlasnik</Label><Input value={docOwner} onChange={(e) => setDocOwner(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Tip dokaza</Label>
              <Select value={evidenceType} onValueChange={setEvidenceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DOCUMENT">Dokument</SelectItem>
                  <SelectItem value="RECORD">Evidencija</SelectItem>
                  <SelectItem value="INTERVIEW">Intervju</SelectItem>
                  <SelectItem value="OBSERVATION">Posmatranje</SelectItem>
                  <SelectItem value="TEST">Test</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Referenca dokaza</Label><Input value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)} placeholder="AUD-2026-001" className="font-mono" /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(COMPLIANCE_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nivo rizika</Label>
              <Select value={riskLevel} onValueChange={setRiskLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['LOW', 'MEDIUM', 'HIGH'].map(r => <SelectItem key={r} value={r}>{PRIORITY_LABELS[r] ?? r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Učestalost pregleda</Label>
              <Select value={reviewFrequency} onValueChange={setReviewFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANNUAL">Godišnje</SelectItem>
                  <SelectItem value="BIENNIAL">Biennialno</SelectItem>
                  <SelectItem value="QUARTERLY">Kvartalno</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {status === 'NON_COMPLIANT' || status === 'PARTIAL' ? (
            <>
              <div className="space-y-1.5"><Label>Opis gap-a</Label><Textarea value={gapDescription} onChange={(e) => setGapDescription(e.target.value)} rows={2} /></div>
              <div className="space-y-1.5"><Label>Korektivna akcija</Label><Textarea value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} rows={2} /></div>
            </>
          ) : null}
          <div className="space-y-1.5"><Label>Napomene</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Odustani</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sačuvaj</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Shared components
// ============================================================================

function AlertCard({ icon: Icon, label, value, tone, onClick }: any) {
  const colors: any = {
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
  }
  const iconColors: any = { amber: 'text-amber-600', red: 'text-red-600', purple: 'text-purple-600', blue: 'text-blue-600' }
  return (
    <button onClick={onClick} className={'text-left p-4 rounded-lg border ' + colors[tone] + ' hover:opacity-80 transition'}>
      <div className="flex items-center justify-between">
        <div><div className="text-2xl font-bold">{value}</div><div className="text-xs mt-0.5">{label}</div></div>
        <Icon className={'h-6 w-6 ' + iconColors[tone]} />
      </div>
    </button>
  )
}

function TabBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button onClick={onClick} className={'px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ' + (active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
      <Icon className="h-4 w-4" />{label}
    </button>
  )
}

function StatCard({ label, value, sub, icon: Icon, tone }: any) {
  const colors: any = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  }
  return (
    <div className={'p-4 rounded-lg border ' + colors[tone]}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs mt-0.5">{label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
        </div>
        <Icon className="h-6 w-6 opacity-60" />
      </div>
    </div>
  )
}
