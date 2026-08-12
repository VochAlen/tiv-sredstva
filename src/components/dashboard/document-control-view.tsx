'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  FileText, Plus, Loader2, Calendar, Trash2, Search, Download, AlertTriangle,
  History, ClipboardCheck, Users, BarChart3, Pencil, CheckCircle2, Clock,
  FileCheck, Link as LinkIcon,
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import {
  getDocuments, getDocumentStats,
  createDocument, updateDocument, deleteDocument,
  createVersion, deleteVersion,
  createReview, deleteReview,
  createDistribution, acknowledgeDistribution, deleteDistribution,
} from '@/lib/actions-document-control'

type Doc = Awaited<ReturnType<typeof getDocuments>>[number]
type Version = Doc['versions'][number]
type Review = Doc['reviews'][number]
type Distribution = Doc['distributions'][number]
type Stats = Awaited<ReturnType<typeof getDocumentStats>>

// ============================================================================
// LABELS
// ============================================================================

const CATEGORY_LABELS: Record<string, string> = {
  MANUAL: 'Manual', PROCEDURE: 'Procedura', WORK_INSTRUCTION: 'Radno uputstvo',
  FORM: 'Formular', RECORD: 'Evidencija', POLICY: 'Politika', PLAN: 'Plan', OTHER: 'Ostalo',
}

const DOC_TYPE_LABELS: Record<string, string> = {
  OPERATIONS: 'Operacije', MAINTENANCE: 'Održavanje', SAFETY: 'Sigurnost',
  QUALITY: 'Kvalitet', TRAINING: 'Obuka', ADMINISTRATIVE: 'Administrativno', TECHNICAL: 'Tehničko',
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nacrt', UNDER_REVIEW: 'Na pregledu', APPROVED: 'Odobren',
  PUBLISHED: 'Objavljen', SUPERSEDED: 'Zamijenjen', WITHDRAWN: 'Povučen',
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  PUBLIC: 'Javno', INTERNAL: 'Interni', CONFIDENTIAL: 'Povjerljivo', RESTRICTED: 'Ograničeno',
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  PUBLIC: 'bg-emerald-100 text-emerald-800',
  INTERNAL: 'bg-blue-100 text-blue-800',
  CONFIDENTIAL: 'bg-amber-100 text-amber-800',
  RESTRICTED: 'bg-red-100 text-red-800',
}

const REVIEW_TYPE_LABELS: Record<string, string> = {
  SCHEDULED: 'Zakazani', AD_HOC: 'Ad hoc',
  CHANGE_REQUEST: 'Zahtjev za promjenu', INCIDENT_DRIVEN: 'Iz incidenta',
}

const REVIEW_RESULT_LABELS: Record<string, string> = {
  NO_CHANGE_NEEDED: 'Bez promjene', MINOR_UPDATE: 'Minor update',
  MAJOR_REVISION: 'Velika revizija', WITHDRAW: 'Povući', SUPERSEDE: 'Zamijeniti',
}

const REVIEW_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Otvoren', IN_PROGRESS: 'U toku', COMPLETED: 'Završen', CANCELLED: 'Otkazan',
}

const REVIEW_STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
}

const DISTRIBUTION_METHOD_LABELS: Record<string, string> = {
  EMAIL: 'Email', HARD_COPY: 'Hard copy', PORTAL: 'Portal', TRAINING: 'Obuka', OTHER: 'Ostalo',
}

const DISTRIBUTION_STATUS_LABELS: Record<string, string> = {
  DISTRIBUTED: 'Distribuirano', ACKNOWLEDGED: 'Potvrđeno',
  RETURNED: 'Vraćeno', SUPERSEDED: 'Zamijenjeno',
}

const REVIEW_FREQUENCY_LABELS: Record<string, string> = {
  ANNUAL: 'Godišnje', BIENNIAL: 'Bienalno', QUARTERLY: 'Kvartalno',
  ON_CHANGE: 'Na promjenu', AD_HOC: 'Ad hoc',
}

const VERSION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nacrt', UNDER_REVIEW: 'Na pregledu', APPROVED: 'Odobren',
  PUBLISHED: 'Objavljen', SUPERSEDED: 'Zamijenjen',
}

const STATUS_COLORS: Record<string, string> = {
  PUBLISHED: 'bg-emerald-100 text-emerald-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800',
  DRAFT: 'bg-gray-100 text-gray-800',
  SUPERSEDED: 'bg-orange-100 text-orange-800',
  WITHDRAWN: 'bg-red-100 text-red-800',
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DocumentControlView() {
  const [tab, setTab] = useState<'documents' | 'versions' | 'reviews' | 'distribution' | 'statistics' | 'calendar'>('documents')
  const [docs, setDocs] = useState<Doc[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [d, s] = await Promise.all([getDocuments(), getDocumentStats()])
      setDocs(d); setStats(s)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const today = new Date()
  const overdueReviews = docs.filter(d => d.nextReviewDate && new Date(d.nextReviewDate) < today && d.status === 'PUBLISHED').length
  const dueSoonReviews = docs.filter(d => {
    if (!d.nextReviewDate) return false
    const nr = new Date(d.nextReviewDate)
    return nr >= today && nr <= new Date(today.getTime() + 30 * 86400000)
  }).length
  const pendingAck = docs.reduce((sum, d) => sum + (d.distributions?.filter(dist => !dist.acknowledged).length || 0), 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-5 w-5" />Document Control System</h2>
          <p className="text-sm text-muted-foreground">EASA Part-145.A.65 · ISO 9001</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/doc-control-documents', '_blank')}><Download className="h-4 w-4 mr-1.5" />Documents PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/doc-control-versions', '_blank')}><Download className="h-4 w-4 mr-1.5" />Versions PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/doc-control-reviews', '_blank')}><Download className="h-4 w-4 mr-1.5" />Reviews PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/doc-control-distribution', '_blank')}><Download className="h-4 w-4 mr-1.5" />Distribution PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/doc-control-statistics', '_blank')}><Download className="h-4 w-4 mr-1.5" />Statistics PDF</Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/doc-control-summary', '_blank')}><Download className="h-4 w-4 mr-1.5" />Summary PDF</Button>
        </div>
      </div>

      {/* Alert cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AlertCard icon={FileText} label="Ukupno dokumenata" value={docs.length} tone="blue" onClick={() => setTab('documents')} />
        <AlertCard icon={AlertTriangle} label="Reviews overdue" value={overdueReviews} tone="red" onClick={() => setTab('calendar')} />
        <AlertCard icon={Clock} label="Reviews due soon" value={dueSoonReviews} tone="amber" onClick={() => setTab('calendar')} />
        <AlertCard icon={Users} label="Pending acknowledgment" value={pendingAck} tone="purple" onClick={() => setTab('distribution')} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto">
        <TabBtn active={tab === 'documents'} onClick={() => setTab('documents')} icon={FileText} label="Documents" />
        <TabBtn active={tab === 'versions'} onClick={() => setTab('versions')} icon={History} label="Versions" />
        <TabBtn active={tab === 'reviews'} onClick={() => setTab('reviews')} icon={ClipboardCheck} label="Reviews" />
        <TabBtn active={tab === 'distribution'} onClick={() => setTab('distribution')} icon={Users} label="Distribution" />
        <TabBtn active={tab === 'statistics'} onClick={() => setTab('statistics')} icon={BarChart3} label="Statistics" />
        <TabBtn active={tab === 'calendar'} onClick={() => setTab('calendar')} icon={Calendar} label="Reviews Calendar" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : tab === 'documents' ? (
        <DocumentsList docs={docs} onUpdated={load} />
      ) : tab === 'versions' ? (
        <VersionsList docs={docs} onUpdated={load} />
      ) : tab === 'reviews' ? (
        <ReviewsList docs={docs} onUpdated={load} />
      ) : tab === 'distribution' ? (
        <DistributionList docs={docs} onUpdated={load} />
      ) : tab === 'statistics' ? (
        <StatisticsView stats={stats} docs={docs} />
      ) : (
        <ReviewsCalendarView docs={docs} />
      )}
    </div>
  )
}

// ============================================================================
// DOCUMENTS LIST
// ============================================================================

function DocumentsList({ docs, onUpdated }: { docs: Doc[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [classFilter, setClassFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)
  const [editDoc, setEditDoc] = useState<Doc | null>(null)

  const filtered = docs.filter((d) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [d.docId, d.title, d.description, d.owner, d.author, d.keywords, d.standard].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (catFilter !== 'ALL' && d.category !== catFilter) return false
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false
    if (classFilter !== 'ALL' && d.classification !== classFilter) return false
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po docId, naslovu, opisu, vlasniku, autoru, ključnim riječima, standardu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Kategorija" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Sve kategorije</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Klasifikacija" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Sve klasifikacije</SelectItem>
            {Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Novi dokument</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {docs.length}</div>
      </div>

      {docs.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema dokumenata.</p>
          <p className="text-xs mt-1">Kliknite "Novi dokument" da kreirate prvi controlled document.</p>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema rezultata pretrage.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => <DocumentCard key={d.id} doc={d} onUpdated={onUpdated} onEdit={() => setEditDoc(d)} />)}
        </div>
      )}

      <AddDocumentDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} />
      <EditDocumentDialog doc={editDoc} onOpenChange={(v) => !v && setEditDoc(null)} onUpdated={onUpdated} />
    </div>
  )
}

function DocumentCard({ doc: d, onUpdated, onEdit }: { doc: Doc; onUpdated: () => void; onEdit: () => void }) {
  const [isPending, startTransition] = useTransition()
  const handleDelete = () => {
    if (!confirm('Obrisati dokument? Ovo će obrisati i sve vezane verzije, review-e i distribucije.')) return
    startTransition(async () => {
      const res = await deleteDocument(d.id)
      if (res.ok) { toast.success('Obrisano'); onUpdated() }
      else toast.error(res.error ?? 'Greška')
    })
  }
  const isOverdue = d.nextReviewDate && new Date(d.nextReviewDate) < new Date() && d.status === 'PUBLISHED'
  return (
    <Card className="p-4 border-l-4 border-l-blue-500">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">{d.docId}</Badge>
            <Badge className={`text-xs ${STATUS_COLORS[d.status] ?? 'bg-gray-100 text-gray-800'}`}>{STATUS_LABELS[d.status] ?? d.status}</Badge>
            <Badge variant="secondary" className="text-xs">{CATEGORY_LABELS[d.category] ?? d.category}</Badge>
            <Badge className={`text-xs ${CLASSIFICATION_COLORS[d.classification] ?? 'bg-gray-100 text-gray-800'}`}>{CLASSIFICATION_LABELS[d.classification] ?? d.classification}</Badge>
            <Badge variant="outline" className="text-xs font-mono">v{d.currentVersion}</Badge>
            {isOverdue && <Badge className="text-xs bg-red-100 text-red-800 animate-pulse">REVIEW OVERDUE</Badge>}
          </div>
          <div className="text-sm font-medium">{d.title}</div>
          {d.description && <div className="text-xs text-muted-foreground mt-1">{d.description}</div>}
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span>Vlasnik: {d.owner}</span>
            {d.author && <span>Autor: {d.author}</span>}
            {d.approver && <span>Odobrio: {d.approver}</span>}
            {d.standard && <span>Standard: <strong>{d.standard}</strong></span>}
            {d.docType && <span>{DOC_TYPE_LABELS[d.docType] ?? d.docType}</span>}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            {d.effectiveDate && <span>Na snazi od: {new Date(d.effectiveDate).toLocaleDateString('hr-HR')}</span>}
            {d.nextReviewDate && (
              <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                Sljedeći pregled: {new Date(d.nextReviewDate).toLocaleDateString('hr-HR')}
              </span>
            )}
            <span>Učestalost: {REVIEW_FREQUENCY_LABELS[d.reviewFrequency] ?? d.reviewFrequency}</span>
            {d.lastReviewedAt && <span>Zadnji pregled: {new Date(d.lastReviewedAt).toLocaleDateString('hr-HR')}</span>}
          </div>
          {d.keywords && <div className="text-xs mt-1"><span className="text-muted-foreground">Ključne riječi:</span> {d.keywords}</div>}
          {d.fileUrl && (
            <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-xs mt-1 inline-flex items-center gap-1 text-blue-600 hover:underline">
              <LinkIcon className="h-3 w-3" />{d.fileUrl}
            </a>
          )}
          {d.notes && <div className="text-xs mt-1 text-muted-foreground italic">{d.notes}</div>}
        </div>
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="h-4 w-4 mr-1" />Uredi</Button>
          <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function AddDocumentDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const [docId, setDocId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('PROCEDURE')
  const [docType, setDocType] = useState('OPERATIONS')
  const [standard, setStandard] = useState('')
  const [currentVersion, setCurrentVersion] = useState('1.0')
  const [status, setStatus] = useState('DRAFT')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [nextReviewDate, setNextReviewDate] = useState('')
  const [owner, setOwner] = useState('')
  const [author, setAuthor] = useState('')
  const [approver, setApprover] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [location, setLocation] = useState('')
  const [reviewFrequency, setReviewFrequency] = useState('ANNUAL')
  const [classification, setClassification] = useState('INTERNAL')
  const [keywords, setKeywords] = useState('')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!docId || !title || !owner) { toast.error('Popunite obavezna polja (docId, title, owner)'); return }
    startTransition(async () => {
      const res = await createDocument({
        docId, title, description: description || undefined,
        category, docType, standard: standard || undefined,
        currentVersion: currentVersion || undefined, status,
        effectiveDate: effectiveDate || undefined, nextReviewDate: nextReviewDate || undefined,
        owner, author: author || undefined, approver: approver || undefined,
        fileUrl: fileUrl || undefined, location: location || undefined,
        reviewFrequency, classification,
        keywords: keywords || undefined, notes: notes || undefined,
      })
      if (res.ok) {
        toast.success(`Dokument kreiran: ${res.docId}`)
        onOpenChange(false); onAdded()
        setDocId(''); setTitle(''); setDescription(''); setStandard(''); setCurrentVersion('1.0')
        setEffectiveDate(''); setNextReviewDate(''); setOwner(''); setAuthor(''); setApprover('')
        setFileUrl(''); setLocation(''); setKeywords(''); setNotes('')
      } else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novi controlled document</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Doc ID *</Label><Input value={docId} onChange={(e) => setDocId(e.target.value)} placeholder="MOM-001" className="font-mono" required /></div>
            <div className="space-y-1.5"><Label>Trenutna verzija</Label><Input value={currentVersion} onChange={(e) => setCurrentVersion(e.target.value)} placeholder="1.0" /></div>
          </div>
          <div className="space-y-1.5"><Label>Naslov *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label>Opis</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>Kategorija</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tip dokumenta</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Klasifikacija</Label>
              <Select value={classification} onValueChange={setClassification}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Učestalost pregleda</Label>
              <Select value={reviewFrequency} onValueChange={setReviewFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(REVIEW_FREQUENCY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Standard</Label><Input value={standard} onChange={(e) => setStandard(e.target.value)} placeholder="EASA Part-145" /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5"><Label>Vlasnik *</Label><Input value={owner} onChange={(e) => setOwner(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Autor</Label><Input value={author} onChange={(e) => setAuthor(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Odobrio</Label><Input value={approver} onChange={(e) => setApprover(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Effective date</Label><Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Next review date</Label><Input type="date" value={nextReviewDate} onChange={(e) => setNextReviewDate(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>File URL</Label><Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="/docs/mom-001.pdf" /></div>
            <div className="space-y-1.5"><Label>Lokacija</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="SharePoint / Drawer" /></div>
          </div>
          <div className="space-y-1.5"><Label>Ključne riječi</Label><Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="maintenance, manual, ramp" /></div>
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

function EditDocumentDialog({ doc, onOpenChange, onUpdated }: { doc: Doc | null; onOpenChange: (v: boolean) => void; onUpdated: () => void }) {
  const [status, setStatus] = useState('DRAFT')
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState('')
  const [approver, setApprover] = useState('')
  const [nextReviewDate, setNextReviewDate] = useState('')
  const [classification, setClassification] = useState('INTERNAL')
  const [keywords, setKeywords] = useState('')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (doc) {
      setStatus(doc.status)
      setTitle(doc.title)
      setOwner(doc.owner)
      setApprover(doc.approver || '')
      setNextReviewDate(doc.nextReviewDate ? new Date(doc.nextReviewDate).toISOString().slice(0, 10) : '')
      setClassification(doc.classification)
      setKeywords(doc.keywords || '')
      setNotes(doc.notes || '')
    }
  }, [doc])

  if (!doc) return null
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await updateDocument(doc.id, {
        title, status, owner, approver: approver || undefined,
        nextReviewDate: nextReviewDate || undefined,
        classification, keywords: keywords || undefined, notes: notes || undefined,
      })
      if (res.ok) { toast.success('Dokument ažuriran'); onOpenChange(false); onUpdated() }
      else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Uredi dokument: {doc.docId}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="p-2 bg-muted/30 rounded text-sm">
            <div className="font-medium">{doc.title}</div>
            <div className="text-xs text-muted-foreground mt-1">{CATEGORY_LABELS[doc.category]} · v{doc.currentVersion}</div>
          </div>
          <div className="space-y-1.5"><Label>Naslov</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Klasifikacija</Label>
              <Select value={classification} onValueChange={setClassification}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Vlasnik</Label><Input value={owner} onChange={(e) => setOwner(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Odobrio</Label><Input value={approver} onChange={(e) => setApprover(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Sljedeći pregled</Label><Input type="date" value={nextReviewDate} onChange={(e) => setNextReviewDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Ključne riječi</Label><Input value={keywords} onChange={(e) => setKeywords(e.target.value)} /></div>
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
// VERSIONS LIST
// ============================================================================

function VersionsList({ docs, onUpdated }: { docs: Doc[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)

  // Flatten all versions across all docs
  const allVersions = docs.flatMap(d => (d.versions || []).map(v => ({ ...v, docId: d.docId, docTitle: d.title })))

  const filtered = allVersions.filter((v) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [v.docId, v.versionNumber, v.revisedBy, v.changeDescription, v.changeReason].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (statusFilter !== 'ALL' && v.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po docId, verziji, revisor, opisu promjene..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            {Object.entries(VERSION_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)} disabled={docs.length === 0}><Plus className="h-4 w-4 mr-1.5" />Nova verzija</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {allVersions.length}</div>
      </div>

      {allVersions.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema verzija dokumenata.</p>
          <p className="text-xs mt-1">{docs.length === 0 ? 'Prvo kreirajte dokument.' : 'Kliknite "Nova verzija" da zabilježite reviziju.'}</p>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema rezultata pretrage.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((v) => <VersionCard key={v.id} version={v} onUpdated={onUpdated} />)}
        </div>
      )}

      <AddVersionDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} docs={docs} />
    </div>
  )
}

function VersionCard({ version: v, onUpdated }: { version: Version & { docId: string; docTitle: string }; onUpdated: () => void }) {
  const [isPending, startTransition] = useTransition()
  const handleDelete = () => {
    if (!confirm('Obrisati verziju?')) return
    startTransition(async () => {
      const res = await deleteVersion(v.id)
      if (res.ok) { toast.success('Obrisano'); onUpdated() }
      else toast.error(res.error ?? 'Greška')
    })
  }
  return (
    <Card className={`p-4 border-l-4 ${v.status === 'PUBLISHED' ? 'border-l-emerald-500' : v.status === 'APPROVED' ? 'border-l-blue-500' : 'border-l-amber-500'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">{v.docId}</Badge>
            <Badge variant="outline" className="text-xs font-mono">v{v.versionNumber}</Badge>
            <Badge className={`text-xs ${STATUS_COLORS[v.status] ?? 'bg-gray-100 text-gray-800'}`}>{VERSION_STATUS_LABELS[v.status] ?? v.status}</Badge>
          </div>
          <div className="text-sm font-medium">{v.docTitle}</div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span>Datum: {new Date(v.revisionDate).toLocaleDateString('hr-HR')}</span>
            <span>Revidirao: {v.revisedBy}</span>
            {v.approvedBy && <span>Odobrio: {v.approvedBy}</span>}
            {v.approvedAt && <span>Odobreno: {new Date(v.approvedAt).toLocaleDateString('hr-HR')}</span>}
            {v.effectiveDate && <span>Na snazi od: {new Date(v.effectiveDate).toLocaleDateString('hr-HR')}</span>}
          </div>
          {v.changeDescription && <div className="text-xs mt-1 p-1.5 bg-muted/30 rounded"><strong>Opis promjene:</strong> {v.changeDescription}</div>}
          {v.changeReason && <div className="text-xs mt-1 p-1.5 bg-amber-50 rounded"><strong>Razlog:</strong> {v.changeReason}</div>}
          {v.affectedSections && <div className="text-xs mt-1"><span className="text-muted-foreground">Pogođene sekcije:</span> {v.affectedSections}</div>}
          {v.fileUrl && (
            <a href={v.fileUrl} target="_blank" rel="noreferrer" className="text-xs mt-1 inline-flex items-center gap-1 text-blue-600 hover:underline">
              <LinkIcon className="h-3 w-3" />{v.fileUrl}
            </a>
          )}
          {v.reviewNotes && <div className="text-xs mt-1 text-muted-foreground italic">{v.reviewNotes}</div>}
        </div>
        <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
        </Button>
      </div>
    </Card>
  )
}

function AddVersionDialog({ open, onOpenChange, onAdded, docs }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void; docs: Doc[] }) {
  const [documentId, setDocumentId] = useState('')
  const [versionNumber, setVersionNumber] = useState('')
  const [revisedBy, setRevisedBy] = useState('')
  const [approvedBy, setApprovedBy] = useState('')
  const [changeDescription, setChangeDescription] = useState('')
  const [changeReason, setChangeReason] = useState('')
  const [affectedSections, setAffectedSections] = useState('')
  const [status, setStatus] = useState('DRAFT')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!documentId || !versionNumber || !revisedBy || !changeDescription) {
      toast.error('Popunite obavezna polja')
      return
    }
    startTransition(async () => {
      const res = await createVersion({
        documentId, versionNumber, revisedBy,
        approvedBy: approvedBy || undefined,
        changeDescription, changeReason: changeReason || undefined,
        affectedSections: affectedSections || undefined,
        status, effectiveDate: effectiveDate || undefined,
        fileUrl: fileUrl || undefined,
      })
      if (res.ok) {
        toast.success(status === 'PUBLISHED' ? `Verzija objavljena — currentVersion ažuriran na v${versionNumber}` : 'Verzija kreirana')
        onOpenChange(false); onAdded()
        setDocumentId(''); setVersionNumber(''); setRevisedBy(''); setApprovedBy('')
        setChangeDescription(''); setChangeReason(''); setAffectedSections('')
        setEffectiveDate(''); setFileUrl('')
      } else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova verzija dokumenta</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Dokument *</Label>
            <Select value={documentId} onValueChange={setDocumentId}>
              <SelectTrigger><SelectValue placeholder="Izaberite dokument..." /></SelectTrigger>
              <SelectContent>{docs.map(d => <SelectItem key={d.id} value={d.id}>{d.docId} — {d.title.slice(0, 40)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Verzija *</Label><Input value={versionNumber} onChange={(e) => setVersionNumber(e.target.value)} placeholder="2.0" className="font-mono" /></div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(VERSION_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Revidirao *</Label><Input value={revisedBy} onChange={(e) => setRevisedBy(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Odobrio</Label><Input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Opis promjene *</Label><Textarea value={changeDescription} onChange={(e) => setChangeDescription(e.target.value)} rows={2} required /></div>
          <div className="space-y-1.5"><Label>Razlog promjene</Label><Textarea value={changeReason} onChange={(e) => setChangeReason(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Pogođene sekcije</Label><Input value={affectedSections} onChange={(e) => setAffectedSections(e.target.value)} placeholder="3.2, 5.1, Appendix A" /></div>
            <div className="space-y-1.5"><Label>Effective date</Label><Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>File URL</Label><Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="/docs/..." /></div>
          {status === 'PUBLISHED' && (
            <div className="p-2 bg-emerald-50 rounded text-xs text-emerald-800">
              <strong>Napomena:</strong> Objavom verzije automatski se ažurira <code>currentVersion</code> na dokumentu.
            </div>
          )}
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
// REVIEWS LIST
// ============================================================================

function ReviewsList({ docs, onUpdated }: { docs: Doc[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [resultFilter, setResultFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)

  const allReviews = docs.flatMap(d => (d.reviews || []).map(r => ({ ...r, docId: d.docId, docTitle: d.title })))

  const filtered = allReviews.filter((r) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [r.docId, r.reviewer, r.result, r.reviewComments, r.changesRequired, r.actionTaken].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (typeFilter !== 'ALL' && r.reviewType !== typeFilter) return false
    if (resultFilter !== 'ALL' && r.result !== resultFilter) return false
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po docId, reviewer, rezultatu, komentarima..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Tip" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi tipovi</SelectItem>
            {Object.entries(REVIEW_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={resultFilter} onValueChange={setResultFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Rezultat" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi rezultati</SelectItem>
            {Object.entries(REVIEW_RESULT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            {Object.entries(REVIEW_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)} disabled={docs.length === 0}><Plus className="h-4 w-4 mr-1.5" />Novi review</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {allReviews.length}</div>
      </div>

      {allReviews.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema zabilježenih review-a.</p>
          <p className="text-xs mt-1">{docs.length === 0 ? 'Prvo kreirajte dokument.' : 'Kliknite "Novi review" da zabilježite pregled.'}</p>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema rezultata pretrage.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => <ReviewCard key={r.id} review={r} onUpdated={onUpdated} />)}
        </div>
      )}

      <AddReviewDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} docs={docs} />
    </div>
  )
}

function ReviewCard({ review: r, onUpdated }: { review: Review & { docId: string; docTitle: string }; onUpdated: () => void }) {
  const [isPending, startTransition] = useTransition()
  const handleDelete = () => {
    if (!confirm('Obrisati review?')) return
    startTransition(async () => {
      const res = await deleteReview(r.id)
      if (res.ok) { toast.success('Obrisano'); onUpdated() }
      else toast.error(res.error ?? 'Greška')
    })
  }
  return (
    <Card className={`p-4 border-l-4 ${r.status === 'COMPLETED' ? 'border-l-emerald-500' : r.status === 'CANCELLED' ? 'border-l-gray-500' : 'border-l-blue-500'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">{r.docId}</Badge>
            <Badge variant="secondary" className="text-xs">{REVIEW_TYPE_LABELS[r.reviewType] ?? r.reviewType}</Badge>
            <Badge className={`text-xs ${REVIEW_STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-800'}`}>{REVIEW_STATUS_LABELS[r.status] ?? r.status}</Badge>
            <Badge variant="outline" className="text-xs">{REVIEW_RESULT_LABELS[r.result] ?? r.result}</Badge>
            {r.newVersionRequired && <Badge className="text-xs bg-purple-100 text-purple-800">Nova verzija</Badge>}
          </div>
          <div className="text-sm font-medium">{r.docTitle}</div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span>Datum: {new Date(r.reviewDate).toLocaleDateString('hr-HR')}</span>
            <span>Reviewer: {r.reviewer}</span>
            {r.completedAt && <span>Završeno: {new Date(r.completedAt).toLocaleDateString('hr-HR')}</span>}
          </div>
          {r.reviewComments && <div className="text-xs mt-1 p-1.5 bg-muted/30 rounded"><strong>Komentari:</strong> {r.reviewComments}</div>}
          {r.changesRequired && <div className="text-xs mt-1 p-1.5 bg-amber-50 rounded"><strong>Potrebne promjene:</strong> {r.changesRequired}</div>}
          {r.actionTaken && <div className="text-xs mt-1 p-1.5 bg-emerald-50 rounded"><strong>Poduzeto:</strong> {r.actionTaken}</div>}
        </div>
        <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
        </Button>
      </div>
    </Card>
  )
}

function AddReviewDialog({ open, onOpenChange, onAdded, docs }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void; docs: Doc[] }) {
  const [documentId, setDocumentId] = useState('')
  const [reviewType, setReviewType] = useState('SCHEDULED')
  const [reviewer, setReviewer] = useState('')
  const [result, setResult] = useState('NO_CHANGE_NEEDED')
  const [reviewComments, setReviewComments] = useState('')
  const [changesRequired, setChangesRequired] = useState('')
  const [newVersionRequired, setNewVersionRequired] = useState(false)
  const [actionTaken, setActionTaken] = useState('')
  const [status, setStatus] = useState('OPEN')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!documentId || !reviewer) { toast.error('Popunite obavezna polja'); return }
    startTransition(async () => {
      const res = await createReview({
        documentId, reviewType, reviewer, result,
        reviewComments: reviewComments || undefined,
        changesRequired: changesRequired || undefined,
        newVersionRequired, actionTaken: actionTaken || undefined,
        status,
      })
      if (res.ok) {
        toast.success('Review kreiran')
        onOpenChange(false); onAdded()
        setDocumentId(''); setReviewer(''); setReviewComments('')
        setChangesRequired(''); setActionTaken(''); setNewVersionRequired(false)
      } else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novi review dokumenta</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Dokument *</Label>
            <Select value={documentId} onValueChange={setDocumentId}>
              <SelectTrigger><SelectValue placeholder="Izaberite dokument..." /></SelectTrigger>
              <SelectContent>{docs.map(d => <SelectItem key={d.id} value={d.id}>{d.docId} — {d.title.slice(0, 40)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Tip review-a</Label>
              <Select value={reviewType} onValueChange={setReviewType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(REVIEW_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Rezultat</Label>
              <Select value={result} onValueChange={setResult}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(REVIEW_RESULT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Reviewer *</Label><Input value={reviewer} onChange={(e) => setReviewer(e.target.value)} required /></div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(REVIEW_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Komentari pregleda</Label><Textarea value={reviewComments} onChange={(e) => setReviewComments(e.target.value)} rows={2} /></div>
          <div className="space-y-1.5"><Label>Potrebne promjene</Label><Textarea value={changesRequired} onChange={(e) => setChangesRequired(e.target.value)} rows={2} /></div>
          <div className="space-y-1.5"><Label>Poduzeta akcija</Label><Textarea value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} rows={2} /></div>
          <div className="flex items-center gap-2">
            <Checkbox id="newVersionRequired" checked={newVersionRequired} onCheckedChange={(v) => setNewVersionRequired(!!v)} />
            <Label htmlFor="newVersionRequired" className="text-sm cursor-pointer">Potrebna nova verzija dokumenta</Label>
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
// DISTRIBUTION LIST
// ============================================================================

function DistributionList({ docs, onUpdated }: { docs: Doc[]; onUpdated: () => void }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [methodFilter, setMethodFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)

  const allDist = docs.flatMap(d => (d.distributions || []).map(dist => ({ ...dist, docId: d.docId, docTitle: d.title })))

  const filtered = allDist.filter((d) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [d.docId, d.recipientName, d.recipientRole, d.recipientDepartment, d.recipientEmail, d.distributedBy].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false
    if (methodFilter !== 'ALL' && d.distributionMethod !== methodFilter) return false
    return true
  })

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po docId, primaocu, ulozi, odjeljenju, emailu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Svi statusi</SelectItem>
            {Object.entries(DISTRIBUTION_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Metoda" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Sve metode</SelectItem>
            {Object.entries(DISTRIBUTION_METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)} disabled={docs.length === 0}><Plus className="h-4 w-4 mr-1.5" />Nova distribucija</Button>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {allDist.length}</div>
      </div>

      {allDist.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema zabilježenih distribucija.</p>
          <p className="text-xs mt-1">{docs.length === 0 ? 'Prvo kreirajte dokument.' : 'Kliknite "Nova distribucija" da zabilježite slanje dokumenta.'}</p>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema rezultata pretrage.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => <DistributionCard key={d.id} dist={d} onUpdated={onUpdated} />)}
        </div>
      )}

      <AddDistributionDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onUpdated} docs={docs} />
    </div>
  )
}

function DistributionCard({ dist: d, onUpdated }: { dist: Distribution & { docId: string; docTitle: string }; onUpdated: () => void }) {
  const [isPending, startTransition] = useTransition()
  const handleAck = () => {
    startTransition(async () => {
      const res = await acknowledgeDistribution(d.id, 'PORTAL')
      if (res.ok) { toast.success('Potvrđeno'); onUpdated() }
      else toast.error(res.error ?? 'Greška')
    })
  }
  const handleDelete = () => {
    if (!confirm('Obrisati distribuciju?')) return
    startTransition(async () => {
      const res = await deleteDistribution(d.id)
      if (res.ok) { toast.success('Obrisano'); onUpdated() }
      else toast.error(res.error ?? 'Greška')
    })
  }
  return (
    <Card className={`p-4 border-l-4 ${d.acknowledged ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">{d.docId}</Badge>
            <Badge variant="secondary" className="text-xs">{DISTRIBUTION_METHOD_LABELS[d.distributionMethod] ?? d.distributionMethod}</Badge>
            <Badge className="text-xs">{DISTRIBUTION_STATUS_LABELS[d.status] ?? d.status}</Badge>
            {d.versionNumber && <Badge variant="outline" className="text-xs font-mono">v{d.versionNumber}</Badge>}
            {d.acknowledged ? (
              <Badge className="text-xs bg-emerald-100 text-emerald-800"><CheckCircle2 className="h-3 w-3 mr-1" />Potvrđeno</Badge>
            ) : (
              <Badge className="text-xs bg-amber-100 text-amber-800"><Clock className="h-3 w-3 mr-1" />Čeka potvrdu</Badge>
            )}
          </div>
          <div className="text-sm font-medium">{d.recipientName}</div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            {d.recipientRole && <span>Uloga: {d.recipientRole}</span>}
            {d.recipientDepartment && <span>Odjeljenje: {d.recipientDepartment}</span>}
            {d.recipientEmail && <span>Email: {d.recipientEmail}</span>}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span>Distribuirano: {new Date(d.distributionDate).toLocaleDateString('hr-HR')}</span>
            <span>Od strane: {d.distributedBy}</span>
            {d.acknowledgedAt && <span>Potvrđeno: {new Date(d.acknowledgedAt).toLocaleDateString('hr-HR')}</span>}
            {d.acknowledgedMethod && <span>Metoda: {d.acknowledgedMethod}</span>}
          </div>
          {d.notes && <div className="text-xs mt-1 text-muted-foreground italic">{d.notes}</div>}
        </div>
        <div className="flex flex-col gap-1">
          {!d.acknowledged && (
            <Button size="sm" variant="ghost" onClick={handleAck} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1 text-emerald-600" />}
              Potvrdi
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function AddDistributionDialog({ open, onOpenChange, onAdded, docs }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void; docs: Doc[] }) {
  const [documentId, setDocumentId] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientRole, setRecipientRole] = useState('')
  const [recipientDepartment, setRecipientDepartment] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [distributionMethod, setDistributionMethod] = useState('EMAIL')
  const [distributedBy, setDistributedBy] = useState('')
  const [versionNumber, setVersionNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!documentId || !recipientName || !distributedBy) { toast.error('Popunite obavezna polja'); return }
    startTransition(async () => {
      const res = await createDistribution({
        documentId, recipientName,
        recipientRole: recipientRole || undefined,
        recipientDepartment: recipientDepartment || undefined,
        recipientEmail: recipientEmail || undefined,
        distributionMethod, distributedBy,
        versionNumber: versionNumber || undefined,
        notes: notes || undefined,
      })
      if (res.ok) {
        toast.success('Distribucija kreirana')
        onOpenChange(false); onAdded()
        setDocumentId(''); setRecipientName(''); setRecipientRole(''); setRecipientDepartment('')
        setRecipientEmail(''); setDistributedBy(''); setVersionNumber(''); setNotes('')
      } else toast.error(res.error ?? 'Greška')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova distribucija dokumenta</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Dokument *</Label>
            <Select value={documentId} onValueChange={setDocumentId}>
              <SelectTrigger><SelectValue placeholder="Izaberite dokument..." /></SelectTrigger>
              <SelectContent>{docs.map(d => <SelectItem key={d.id} value={d.id}>{d.docId} — {d.title.slice(0, 40)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Ime primaoca *</Label><Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Uloga</Label><Input value={recipientRole} onChange={(e) => setRecipientRole(e.target.value)} placeholder="Tehničar, Inženjer..." /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Odjeljenje</Label><Input value={recipientDepartment} onChange={(e) => setRecipientDepartment(e.target.value)} placeholder="Line maintenance..." /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Metoda distribucije</Label>
              <Select value={distributionMethod} onValueChange={setDistributionMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DISTRIBUTION_METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Verzija</Label><Input value={versionNumber} onChange={(e) => setVersionNumber(e.target.value)} placeholder="2.0" /></div>
          </div>
          <div className="space-y-1.5"><Label>Distribuirao *</Label><Input value={distributedBy} onChange={(e) => setDistributedBy(e.target.value)} required /></div>
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
// STATISTICS VIEW
// ============================================================================

function StatisticsView({ stats, docs }: { stats: Stats | null; docs: Doc[] }) {
  if (!stats) return null
  const today = new Date()
  const overdueDocs = docs.filter(d => d.nextReviewDate && new Date(d.nextReviewDate) < today && d.status === 'PUBLISHED')
  const dueSoonDocs = docs.filter(d => {
    if (!d.nextReviewDate) return false
    const nr = new Date(d.nextReviewDate)
    return nr >= today && nr <= new Date(today.getTime() + 30 * 86400000)
  })

  const renderBar = (label: string, count: number, max: number, color: string) => (
    <div key={label} className="flex items-center gap-2">
      <div className="w-32 text-xs truncate">{label}</div>
      <div className="flex-1 h-6 bg-muted/30 rounded relative overflow-hidden">
        <div className={`absolute inset-y-0 left-0 ${color}`} style={{ width: `${max > 0 ? (count / max) * 100 : 0}%` }} />
        <div className="absolute inset-0 flex items-center px-2 text-xs font-medium">{count}</div>
      </div>
    </div>
  )

  const maxStatus = Math.max(...Object.values(stats.byStatus) as number[], 1)
  const maxCategory = Math.max(...Object.values(stats.byCategory) as number[], 1)
  const maxDocType = Math.max(...Object.values(stats.byDocType) as number[], 1)
  const maxClass = Math.max(...Object.values(stats.byClassification) as number[], 1)
  const maxResult = Math.max(...Object.values(stats.reviewsByResult) as number[], 1)
  const topOwners = Object.entries(stats.byOwner).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 10)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Ukupno dokumenata" value={stats.total} sub={`${stats.totalVersions} verzija`} icon={FileText} tone="blue" />
        <StatCard label="Objavljeno" value={stats.publishedCount} sub={`${stats.draftCount} nacrt`} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Reviews overdue" value={stats.reviewsOverdue} sub={`${stats.reviewsDueSoon} uskoro`} icon={AlertTriangle} tone="red" />
        <StatCard label="Ack rate" value={`${stats.ackRate.toFixed(0)}%`} sub={`${stats.acknowledgedDistributions}/${stats.totalDistributions}`} icon={FileCheck} tone="purple" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Po statusu</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(STATUS_LABELS).map(([k, v]) => renderBar(v, (stats.byStatus as any)[k] || 0, maxStatus, (STATUS_COLORS as any)[k]?.split(' ')[0] ?? 'bg-gray-500'))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Po kategoriji</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => renderBar(v, (stats.byCategory as any)[k] || 0, maxCategory, 'bg-blue-500'))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Po tipu dokumenta</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => renderBar(v, (stats.byDocType as any)[k] || 0, maxDocType, 'bg-purple-500'))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Po klasifikaciji</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => {
                const color = k === 'PUBLIC' ? 'bg-emerald-500' : k === 'INTERNAL' ? 'bg-blue-500' : k === 'CONFIDENTIAL' ? 'bg-amber-500' : 'bg-red-500'
                return renderBar(v, (stats.byClassification as any)[k] || 0, maxClass, color)
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Reviews po rezultatu</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(stats.reviewsByResult).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nema review-a</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(REVIEW_RESULT_LABELS).map(([k, v]) => renderBar(v, (stats.reviewsByResult as any)[k] || 0, maxResult, 'bg-amber-500'))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 vlasnika dokumenata</CardTitle></CardHeader>
          <CardContent>
            {topOwners.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nema podataka</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Vlasnik</TableHead>
                    <TableHead className="text-xs text-right">Dokumenata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topOwners.map(([owner, count]) => (
                    <TableRow key={owner}>
                      <TableCell className="text-sm">{owner}</TableCell>
                      <TableCell className="text-sm text-right font-medium">{count as number}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-600" />Reviews overdue ({overdueDocs.length})</CardTitle></CardHeader>
        <CardContent>
          {overdueDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nema dokumenata sa prekoračenim review rokom.</p>
          ) : (
            <div className="space-y-2">
              {overdueDocs.map(d => (
                <div key={d.id} className="flex items-center justify-between p-2 bg-red-50 rounded text-xs">
                  <div>
                    <span className="font-mono">{d.docId}</span> · {d.title}
                  </div>
                  <Badge className="bg-red-100 text-red-800">{new Date(d.nextReviewDate!).toLocaleDateString('hr-HR')}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-amber-600" />Reviews due soon (30 dana) ({dueSoonDocs.length})</CardTitle></CardHeader>
        <CardContent>
          {dueSoonDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nema dokumenata sa review-om u narednih 30 dana.</p>
          ) : (
            <div className="space-y-2">
              {dueSoonDocs.map(d => (
                <div key={d.id} className="flex items-center justify-between p-2 bg-amber-50 rounded text-xs">
                  <div>
                    <span className="font-mono">{d.docId}</span> · {d.title}
                  </div>
                  <Badge className="bg-amber-100 text-amber-800">{new Date(d.nextReviewDate!).toLocaleDateString('hr-HR')}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// REVIEWS CALENDAR VIEW
// ============================================================================

function ReviewsCalendarView({ docs }: { docs: Doc[] }) {
  const [search, setSearch] = useState('')
  const [freqFilter, setFreqFilter] = useState('ALL')

  const today = new Date()
  const sorted = [...docs]
    .filter(d => d.nextReviewDate)
    .sort((a, b) => new Date(a.nextReviewDate!).getTime() - new Date(b.nextReviewDate!).getTime())

  const filtered = sorted.filter((d) => {
    if (search) {
      const q = search.toLowerCase()
      const hay = [d.docId, d.title, d.owner, d.standard].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (freqFilter !== 'ALL' && d.reviewFrequency !== freqFilter) return false
    return true
  })

  const colorFor = (nextReview: Date) => {
    const nr = new Date(nextReview)
    if (nr < today) return 'border-l-red-500 bg-red-50'
    if (nr <= new Date(today.getTime() + 30 * 86400000)) return 'border-l-amber-500 bg-amber-50'
    return 'border-l-emerald-500 bg-emerald-50'
  }

  const daysUntil = (nextReview: Date) => {
    const diff = Math.ceil((new Date(nextReview).getTime() - today.getTime()) / 86400000)
    return diff
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraga po docId, naslovu, vlasniku, standardu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={freqFilter} onValueChange={setFreqFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Učestalost" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Sve učestalosti</SelectItem>
            {Object.entries(REVIEW_FREQUENCY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} / {sorted.length}</div>
      </div>

      <div className="flex gap-3 text-xs flex-wrap">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500" />Overdue</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-500" />Uskoro (≤30 dana)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500" />&gt;30 dana</div>
      </div>

      {sorted.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema dokumenata sa definisanim next review datumom.</p>
          <p className="text-xs mt-1">Postavite nextReviewDate na dokumentima da ih vidite u kalendaru.</p>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nema rezultata pretrage.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => {
            const nr = new Date(d.nextReviewDate!)
            const days = daysUntil(d.nextReviewDate!)
            return (
              <Card key={d.id} className={`p-4 border-l-4 ${colorFor(d.nextReviewDate!)}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className="font-mono text-xs">{d.docId}</Badge>
                      <Badge variant="secondary" className="text-xs">{REVIEW_FREQUENCY_LABELS[d.reviewFrequency] ?? d.reviewFrequency}</Badge>
                      <Badge className={`text-xs ${STATUS_COLORS[d.status] ?? 'bg-gray-100 text-gray-800'}`}>{STATUS_LABELS[d.status] ?? d.status}</Badge>
                      {days < 0 && <Badge className="text-xs bg-red-100 text-red-800 animate-pulse">OVERDUE {Math.abs(days)} dana</Badge>}
                      {days >= 0 && days <= 30 && <Badge className="text-xs bg-amber-100 text-amber-800">Za {days} dana</Badge>}
                      {days > 30 && <Badge className="text-xs bg-emerald-100 text-emerald-800">Za {days} dana</Badge>}
                    </div>
                    <div className="text-sm font-medium">{d.title}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                      <span>Vlasnik: {d.owner}</span>
                      {d.standard && <span>Standard: {d.standard}</span>}
                      {d.lastReviewedAt && <span>Zadnji pregled: {new Date(d.lastReviewedAt).toLocaleDateString('hr-HR')}</span>}
                      <span className="font-medium">Sljedeći pregled: {nr.toLocaleDateString('hr-HR')}</span>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SHARED COMPONENTS
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
