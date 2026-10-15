'use client'

// Dijeljena kartica za prijavu kvara - koristi se i u "GSE oprema > Oštećenja"
// tabu i u "Održavanje > Neispravna sredstva" pregledu. Namjerno JEDNA
// implementacija na jednom mjestu, da tok popravke (preuzmi → označi
// popravljeno → odobri) uvijek radi identično bez obzira odakle se otvori -
// razdvojene kopije bi vremenom počele da se razilaze.

import { PersonPicker } from './person-picker'
import { useState, useTransition } from 'react'
import { History, Repeat, RefreshCw, Send, Truck, ClipboardEdit, UserCheck, Wrench, ShieldCheck, User, Calendar, CheckCircle2, Loader2, FileDown, Image as ImageIcon, ClipboardList, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { CHECKLIST_CATEGORY_LABELS, CHECKLIST_CATEGORY_ORDER } from '@/lib/types'
import { resolveDamageReport, acknowledgeDamage, markRepaired, getOpenDamages } from '@/lib/actions'
import { staleInfo, fmtDT } from '@/lib/workshop'
import {
  WorkshopStepper, StaleBanner, ArrivedDialog, StatusDialog, ChiefDialog, WorkshopHistory,
  ExternalSendDialog, ExternalReturnDialog, WarrantyBanner, ReplacementPanel,
} from '@/components/dashboard/workshop-actions'
import { getSpareParts } from '@/lib/actions-scheduling'
import { REPEAT_ADVICE, type RepeatGroup } from '@/lib/repeat-defects'
import { getPhotosForDamage } from '@/lib/actions-advanced'
import { saveRepairWork } from '@/lib/actions-repair'
import type { AppUser } from '@/lib/auth-server'
import { RestrictionBadges } from '@/components/restriction-badges'

export type DamageRow = Awaited<ReturnType<typeof getOpenDamages>>[number]

export const CATEGORY_LABEL: Record<string, string> = CHECKLIST_CATEGORY_LABELS
export const CATEGORY_BADGE_CLASS: Record<string, string> = {
  MEHANIKA: 'border-slate-400 text-slate-700 bg-slate-50',
  ELEKTRIKA: 'border-yellow-400 text-yellow-800 bg-yellow-50',
  HIDRAULIKA: 'border-blue-400 text-blue-800 bg-blue-50',
  BEZBJEDNOST: 'border-red-400 text-red-800 bg-red-50',
  OPSTE: 'border-gray-300 text-gray-600 bg-gray-50',
}

export function DamageRowCard({
  damage,
  onResolved,
  currentUser,
  compact = false,
  repeats = [],
}: {
  damage: DamageRow
  onResolved: () => void
  currentUser: AppUser
  compact?: boolean
  /** Ponavljajući kvarovi (3+ u 90 dana) - kartica prikazuje upozorenje ako joj prijava pripada nekoj grupi */
  repeats?: RepeatGroup[]
}) {
  const [open, setOpen] = useState(false)
  // Slike se učitavaju tek na klik (base64 je težak, ne vučemo ga za cijelu listu)
  const [photos, setPhotos] = useState<string[] | null>(null)
  const [photosLoading, setPhotosLoading] = useState(false)
  const loadPhotos = async () => {
    setPhotosLoading(true)
    try {
      const rows = await getPhotosForDamage(damage.id)
      setPhotos(rows.map((r: any) => r.photoData as string))
    } catch {
      toast.error('Slike nisu učitane')
      setPhotos([])
    } finally {
      setPhotosLoading(false)
    }
  }
  const [resolution, setResolution] = useState('')
  const [setAvailable, setSetAvailable] = useState(true)
  const [repairOpen, setRepairOpen] = useState(false)
  const [repairNotes, setRepairNotes] = useState('')
  const [repairCategory, setRepairCategory] = useState<string>((damage as any).category ?? '')
  const [isPending, startTransition] = useTransition()

  const severityBadge = {
    MINOR: 'bg-amber-100 text-amber-800',
    MAJOR: 'bg-orange-100 text-orange-800',
    CRITICAL: 'bg-red-100 text-red-800',
  }[damage.severity] ?? 'bg-gray-100'

  const statusBadge = {
    OPEN: 'bg-red-100 text-red-800',
    IN_REPAIR: 'bg-amber-100 text-amber-800',
    AWAITING_APPROVAL: 'bg-purple-100 text-purple-800',
    RESOLVED: 'bg-emerald-100 text-emerald-800',
  }[damage.status as string] ?? 'bg-gray-100'

  const statusLabel = {
    OPEN: 'Otvoreno',
    IN_REPAIR: 'U popravci',
    AWAITING_APPROVAL: 'Čeka odobrenje šefa',
    RESOLVED: 'Riješeno',
  }[damage.status as string] ?? damage.status

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
      toast.success('Kvar riješen')
      setOpen(false)
      setResolution('')
      onResolved()
    })
  }

  const handleAcknowledge = () => {
    startTransition(async () => {
      await acknowledgeDamage(damage.id)
      toast.success('Kvar preuzet — upisano ko i kada')
      onResolved()
    })
  }

  const handleMarkRepaired = (e: React.FormEvent) => {
    e.preventDefault()
    if (!repairNotes.trim()) {
      toast.error('Unesite kratak opis popravke')
      return
    }
    if (!(damage as any).category && !repairCategory) {
      toast.error('Odaberite kategoriju kvara')
      return
    }
    startTransition(async () => {
      const res = await markRepaired({ damageId: damage.id, repairNotes: repairNotes.trim(), category: repairCategory || undefined })
      if (res.ok) {
        toast.success('Popravka označena - čeka odobrenje šefa službe')
        setRepairOpen(false)
        setRepairNotes('')
        onResolved()
      } else {
        toast.error(res.error ?? 'Greška')
      }
    })
  }

  // ---- Radni nalog (dijelovi + količina, ko je radio, sati, trošak) ----
  const d: any = damage
  const savedParts: Array<{ name: string; qty: number; partId?: string | null }> = (() => {
    try { const v = typeof d.partsJson === 'string' ? JSON.parse(d.partsJson) : d.partsJson; return Array.isArray(v) ? v : [] } catch { return [] }
  })()
  const [workOpen, setWorkOpen] = useState(false)
  const [workNotes, setWorkNotes] = useState('')
  const [workParts, setWorkParts] = useState<Array<{ name: string; qty: string; partId: string | null }>>([])
  const [stock, setStock] = useState<Array<{ id: string; partNumber: string; name: string; quantity: number; unit: string }>>([])
  const [workWorkers, setWorkWorkers] = useState('')
  const [workHours, setWorkHours] = useState('')
  const [workCost, setWorkCost] = useState('')
  const openWork = (o: boolean) => {
    setWorkOpen(o)
    if (o) {
      setWorkNotes(damage.resolution ?? '')
      setWorkParts(savedParts.length ? savedParts.map((p) => ({ name: p.name, qty: String(p.qty), partId: p.partId ?? null })) : [{ name: '', qty: '1', partId: null }])
      // Magacin se učitava tek kad se nalog otvori (ne za cijelu listu kartica)
      getSpareParts()
        .then((rows: any[]) => setStock(rows.filter((r) => r.active !== false).map((r) => ({ id: r.id, partNumber: r.partNumber, name: r.name, quantity: Number(r.quantity ?? 0), unit: r.unit ?? 'kom' }))))
        .catch(() => { /* magacin nedostupan - ostaje slobodan unos */ })
      setWorkWorkers(d.workerNames ?? currentUser.full_name ?? '')
      setWorkHours(d.workHours != null ? String(d.workHours) : '')
      setWorkCost(d.workCost != null ? String(d.workCost) : '')
    }
  }
  const handleSaveWork = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await saveRepairWork({
        damageId: damage.id,
        resolution: workNotes,
        parts: workParts.filter((p) => p.name.trim()).map((p) => ({ name: p.name, qty: Number(p.qty.replace(',', '.')), partId: p.partId })),
        workerNames: workWorkers,
        workHours: workHours.trim() ? Number(workHours.replace(',', '.')) : null,
        workCost: workCost.trim() ? Number(workCost.replace(',', '.')) : null,
      })
      if (res.ok) {
        toast.success('Radni nalog snimljen')
        if (res.lowStock?.length) toast.warning(`Zaliha ispod minimuma: ${res.lowStock.join('; ')}`, { duration: 10000 })
        setWorkOpen(false); onResolved()
      }
      else toast.error(res.error ?? 'Greška')
    })
  }
  const canWork = currentUser.role !== 'operator' && damage.status !== 'RESOLVED'
  const partsText = savedParts.map((p) => `${p.name} ×${p.qty}`).join(', ')

  // ---- Tok radionice: dolazak, status, pregled šefa ----
  const [arrivedOpen, setArrivedOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [histOpen, setHistOpen] = useState(false)
  const [chiefOpen, setChiefOpen] = useState(false)
  const [extSendOpen, setExtSendOpen] = useState(false)
  const [extBackOpen, setExtBackOpen] = useState(false)
  const [replOpen, setReplOpen] = useState(false)
  const atExternal = !!d.externalSentAt && !d.externalReturnedAt
  const extOverdue = atExternal && d.externalExpectedAt && new Date(d.externalExpectedAt).getTime() < Date.now() - 86_400_000
  const myRepeats = repeats.filter((g) => g.damageIds.includes(damage.id))
  const stale = staleInfo(d)
  const inRepairFlow = damage.status === 'IN_REPAIR' || damage.status === 'AWAITING_APPROVAL'

  const isNew = damage.status === 'OPEN' && !(damage as any).acknowledgedAt

  return (
    <div className={`p-3 rounded-lg border ${isNew ? 'border-red-400 bg-red-50 ring-2 ring-red-200' : damage.status === 'AWAITING_APPROVAL' ? 'border-purple-300 bg-purple-50/50' : damage.status === 'OPEN' ? 'border-red-200 bg-red-50/50' : damage.status === 'IN_REPAIR' ? 'border-amber-200 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/50'}`}>
      <div className="flex flex-col gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {isNew && (
              <Badge className="text-xs bg-red-600 text-white animate-pulse">NOVO</Badge>
            )}
            <Badge variant="outline" className="font-mono text-xs">{damage.equipmentCode}</Badge>
            <Badge className={`text-xs ${severityBadge}`}>{damage.severity}</Badge>
            <Badge className={`text-xs ${statusBadge}`}>{statusLabel}</Badge>
            {(damage as any).restrictionCode && (
              <RestrictionBadges restrictions={[{ code: (damage as any).restrictionCode, label: (damage as any).restrictionLabel ?? (damage as any).restrictionCode, source: 'damage', since: '' }]} showLabel />
            )}
            {(damage as any).category ? (
              <Badge variant="outline" className={`text-xs ${CATEGORY_BADGE_CLASS[(damage as any).category as string] ?? ''}`}>
                {CATEGORY_LABEL[(damage as any).category as string] ?? (damage as any).category}
              </Badge>
            ) : (
              damage.status !== 'RESOLVED' && (
                <Badge variant="outline" className="text-xs border-dashed text-muted-foreground">
                  kategorija nije određena
                </Badge>
              )
            )}
          </div>
          {myRepeats.map((g) => (
            <div key={g.kind + g.key} role="alert" className="mb-1 flex items-start gap-2 rounded-md border-2 border-orange-500 bg-orange-50 p-2 text-sm text-orange-950">
              <Repeat className="mt-0.5 h-4 w-4 shrink-0" />
              <span><strong>Ponavljajući kvar: {g.label} — {g.count}× u 90 dana.</strong> {REPEAT_ADVICE}</span>
            </div>
          ))}
          <div className="text-sm font-medium truncate">{damage.equipmentName}</div>
          {!compact && <WorkshopStepper d={d} />}
          <div className="text-sm text-muted-foreground mt-1">{damage.description}</div>
          {photos === null ? (
            <button
              type="button"
              onClick={loadPhotos}
              disabled={photosLoading}
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
            >
              {photosLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
              Prikaži slike
            </button>
          ) : photos.length > 0 ? (
            <div className="mt-1.5 flex gap-2 flex-wrap">
              {photos.map((src, i) => (
                <img key={i} src={src} alt={`Slika kvara ${i + 1}`} className="h-24 w-24 rounded-md object-cover border" />
              ))}
            </div>
          ) : (
            <div className="mt-1.5 text-xs text-muted-foreground">Nema slika.</div>
          )}
          {!compact && (
            <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1"><User className="h-3 w-3" />{damage.reportedByName}</span>
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(damage.createdAt).toLocaleString('hr-HR')}</span>
              {(damage as any).acknowledgedAt && (
                <span className="flex items-center gap-1 text-amber-700"><Wrench className="h-3 w-3" />Preuzeo {(damage as any).acknowledgedBy} {new Date((damage as any).acknowledgedAt).toLocaleString('hr-HR')}</span>
              )}
              {d.workshopArrivedAt && (
                <span className="flex items-center gap-1 text-blue-700"><Truck className="h-3 w-3" />U radionici od {fmtDT(d.workshopArrivedAt)} (dovezao/la {d.workshopArrivedBy})</span>
              )}
              {d.chiefInspectedAt && (
                <span className={`flex items-center gap-1 ${d.chiefResult === 'OK' ? 'text-emerald-700' : 'text-red-700'}`}><UserCheck className="h-3 w-3" />Pregled šefa {d.chiefName}: {d.chiefResult === 'OK' ? 'prošao' : 'NIJE prošao'} {fmtDT(d.chiefInspectedAt)}</span>
              )}
              {(damage as any).repairedAt && (
                <span className="flex items-center gap-1 text-purple-700"><Wrench className="h-3 w-3" />Popravio {(damage as any).repairedByName} {new Date((damage as any).repairedAt).toLocaleString('hr-HR')}</span>
              )}
              {(damage as any).approvedAt && (
                <span className="flex items-center gap-1 text-emerald-700"><ShieldCheck className="h-3 w-3" />Odobrio {(damage as any).approvedByName} {new Date((damage as any).approvedAt).toLocaleString('hr-HR')}</span>
              )}
              {damage.resolvedAt && (
                <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3 w-3" />Riješeno {new Date(damage.resolvedAt).toLocaleDateString('hr-HR')}</span>
              )}
            </div>
          )}
          {d.lastStatusText && inRepairFlow && (
            <div className="mt-1.5 rounded border border-amber-300 bg-amber-50 p-1.5 text-xs">
              <strong>Status:</strong> {d.lastStatusText} <span className="text-muted-foreground">({d.lastStatusBy}, {fmtDT(d.lastStatusAt)})</span>
            </div>
          )}
          {damage.status !== 'RESOLVED' && <WarrantyBanner expiry={d.equipment?.warrantyExpiry} provider={d.equipment?.serviceProvider} phone={d.equipment?.serviceProviderPhone} />}
          {d.externalSentAt && (
            <div className={`mt-1.5 rounded border p-1.5 text-xs ${atExternal ? (extOverdue ? 'border-red-400 bg-red-50 text-red-900' : 'border-sky-300 bg-sky-50') : 'bg-background'}`}>
              <strong>Vanjski servis:</strong> {d.externalProvider}{d.externalRef ? ` (nalog ${d.externalRef})` : ''} — poslano {fmtDT(d.externalSentAt)}
              {d.externalReturnedAt ? `, vraćeno ${fmtDT(d.externalReturnedAt)}` : d.externalExpectedAt ? `, očekivani povrat ${new Date(d.externalExpectedAt).toLocaleDateString('hr-HR')}${extOverdue ? ' — ROK PROŠAO' : ''}` : ''}
            </div>
          )}
          {d.testDone && (
            <div className="mt-1.5 rounded border border-emerald-300 bg-emerald-50 p-1.5 text-xs text-emerald-900">
              <strong>Probni rad / funkcionalni test:</strong> zadovoljava{d.testNote ? ` — ${d.testNote}` : ''} <span className="text-muted-foreground">({d.testBy}, {fmtDT(d.testAt)})</span>
            </div>
          )}
          {stale.due && inRepairFlow && <StaleBanner days={stale.days} onAct={() => setStatusOpen(true)} />}
          {damage.resolution && (
            <div className="text-xs text-emerald-700 mt-1.5 p-1.5 bg-emerald-50 rounded">
              <strong>Šta je urađeno:</strong> {damage.resolution}
            </div>
          )}
          {(partsText || d.workerNames || d.workHours != null || d.workCost != null) && (
            <div className="text-xs mt-1.5 p-1.5 rounded border bg-background space-y-0.5">
              <div className="font-semibold flex items-center gap-1"><ClipboardList className="h-3 w-3" />Radni nalog</div>
              {partsText && <div><strong>Dijelovi:</strong> {partsText}</div>}
              {d.workerNames && <div><strong>Radio/la:</strong> {d.workerNames}</div>}
              {d.workHours != null && <div><strong>Sati:</strong> {d.workHours}</div>}
              {d.workCost != null && <div><strong>Trošak:</strong> {d.workCost} €</div>}
              {d.approvedByName && <div><strong>Odobrio/la:</strong> {d.approvedByName}</div>}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {/* SLJEDEĆI KORAK - uvijek samo jedno veliko dugme */}
          {isNew && (
            <Button size="lg" className="w-full h-16 text-lg font-bold bg-red-600 hover:bg-red-700 text-white animate-pulse" disabled={isPending} onClick={handleAcknowledge}>
              <Wrench className="h-5 w-5 mr-2" />
              PREUZMI KVAR
            </Button>
          )}
          {/* Korak 2: sredstvo doveženo u radionicu (ko + kada) */}
          {damage.status === 'IN_REPAIR' && atExternal && (
            <Button size="lg" className="w-full h-16 text-lg font-bold bg-sky-600 hover:bg-sky-700 text-white" onClick={() => setExtBackOpen(true)}>
              <RefreshCw className="h-5 w-5 mr-2" />
              Vraćeno iz vanjskog servisa
            </Button>
          )}
          {damage.status === 'IN_REPAIR' && !d.workshopArrivedAt && !atExternal && (
            <Button size="lg" className="w-full h-16 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setArrivedOpen(true)}>
              <Truck className="h-5 w-5 mr-2" />
              Sredstvo doveženo u radionicu
            </Button>
          )}
          {/* Korak 4: pregled šefa službe (upisuje radionica ili admin: ime šefa + vrijeme pregleda) */}
          {damage.status === 'AWAITING_APPROVAL' && (
            <Button size="lg" className="w-full h-16 text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white" onClick={() => setChiefOpen(true)}>
              <UserCheck className="h-5 w-5 mr-2" />
              Pregled šefa službe
            </Button>
          )}
          {/* Korak 1: mehaničar (engineer/admin) označava da je popravka gotova */}
          {damage.status === 'IN_REPAIR' && (
            <Dialog open={repairOpen} onOpenChange={(o) => { setRepairOpen(o); if (o && !repairNotes && damage.resolution) setRepairNotes(damage.resolution) }}>
              <DialogTrigger asChild>
                <Button size="lg" className={d.workshopArrivedAt ? 'w-full h-16 text-lg font-bold bg-amber-600 hover:bg-amber-700 text-white' : 'h-10 text-sm'} variant={d.workshopArrivedAt ? 'default' : 'outline'}>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  {d.workshopArrivedAt ? 'POPRAVKA ZAVRŠENA' : 'Popravljeno na licu mjesta'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Popravka završena</DialogTitle>
                  <DialogDescription>
                    Ukratko opišite šta je urađeno. Sredstvo OSTAJE nedostupno dok šef službe ne pregleda i odobri.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleMarkRepaired} className="space-y-3">
                  {(damage as any).category ? (
                    <div className="text-sm">
                      Kategorija kvara:{' '}
                      <Badge variant="outline" className={`text-xs ${CATEGORY_BADGE_CLASS[(damage as any).category as string] ?? ''}`}>
                        {CATEGORY_LABEL[(damage as any).category as string] ?? (damage as any).category}
                      </Badge>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label>Kategorija kvara *</Label>
                      <Select value={repairCategory} onValueChange={setRepairCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Odaberite kategoriju" />
                        </SelectTrigger>
                        <SelectContent>
                          {CHECKLIST_CATEGORY_ORDER.map((cat) => (
                            <SelectItem key={cat} value={cat}>{CHECKLIST_CATEGORY_LABELS[cat]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Ovaj kvar nije nastao iz pre-use checkliste, pa kategoriju treba ručno odrediti - od nje zavisi koji radnik smije preuzeti popravku.
                      </p>
                    </div>
                  )}
                  <Textarea
                    value={repairNotes}
                    onChange={(e) => setRepairNotes(e.target.value)}
                    rows={3}
                    placeholder="npr. Zamijenjen kabl za napajanje, testirano - radi ispravno"
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setRepairOpen(false)}>Odustani</Button>
                    <Button type="submit" disabled={isPending}>
                      {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Pošalji šefu na odobrenje
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}

          <div className="flex flex-wrap gap-2">
          {/* Status popravke - kad je upozorenje aktivno, dugme je crveno i obavezno */}
          {inRepairFlow && (
            <Button size="sm" variant={stale.due ? 'default' : 'outline'} className={`h-10 text-sm ${stale.due ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' : ''}`} onClick={() => setStatusOpen(true)}>
              <ClipboardEdit className="h-3.5 w-3.5 mr-1" />
              {stale.due ? 'Upiši status (obavezno)' : 'Upiši status'}
            </Button>
          )}

          {damage.status === 'IN_REPAIR' && !atExternal && (
            <Button size="sm" variant="outline" className="h-10 text-sm" onClick={() => setExtSendOpen(true)}>
              <Send className="h-3.5 w-3.5 mr-1" />
              Vanjski servis
            </Button>
          )}
          {damage.status !== 'RESOLVED' && currentUser.role !== 'operator' && (d.equipment?.status === 'OUT_OF_SERVICE' || d.equipment?.status === 'MAINTENANCE') && (
            <Button size="sm" variant={replOpen ? 'default' : 'outline'} className="h-10 text-sm" onClick={() => setReplOpen((v) => !v)}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Zamjensko sredstvo
            </Button>
          )}
          <Button size="sm" variant={histOpen ? 'default' : 'outline'} className="h-10 text-sm" onClick={() => setHistOpen((v) => !v)}>
            <History className="h-3.5 w-3.5 mr-1" />
            Istorija popravke
          </Button>
          {canWork && (
            <Dialog open={workOpen} onOpenChange={openWork}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs">
                  <ClipboardList className="h-3.5 w-3.5 mr-1" />
                  Radni nalog
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Radni nalog — {damage.equipmentCode}</DialogTitle>
                  <DialogDescription>
                    Upišite šta je urađeno, koji dijelovi i u kojoj količini, ko je radio. Dijelovi izabrani iz magacina automatski se skidaju sa zalihe. Snimanjem se ne mijenja status prijave.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSaveWork} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Opis popravke</Label>
                    <Textarea rows={3} value={workNotes} onChange={(e) => setWorkNotes(e.target.value)} placeholder="npr. Zamijenjena sijalica prednjeg lijevog farova, testirano" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rezervni dijelovi</Label>
                    {workParts.map((p, i) => {
                      const inv = p.partId ? stock.find((x) => x.id === p.partId) : null
                      return (
                        <div key={i} className="space-y-1 rounded-md border p-1.5">
                          <div className="flex gap-1.5">
                            {p.partId ? (
                              <div className="flex-1 min-w-0 rounded-md bg-muted/50 px-2 py-2 text-sm">
                                <span className="font-medium">{p.name}</span>
                                {inv && <span className="block text-xs text-muted-foreground">u magacinu: {inv.quantity} {inv.unit}</span>}
                              </div>
                            ) : (
                              <Input className="flex-1" placeholder="Naziv dijela" value={p.name} onChange={(e) => setWorkParts((ps) => ps.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                            )}
                            <Input className="w-20" inputMode="decimal" placeholder="Kol." value={p.qty} onChange={(e) => setWorkParts((ps) => ps.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} />
                            <Button type="button" variant="ghost" size="icon" aria-label="Ukloni dio" onClick={() => setWorkParts((ps) => ps.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                          {stock.length > 0 && (
                            <select
                              aria-label="Dio iz magacina"
                              className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                              value={p.partId ?? ''}
                              onChange={(e) => {
                                const sel = stock.find((x) => x.id === e.target.value)
                                setWorkParts((ps) => ps.map((x, j) => j === i ? (sel ? { ...x, partId: sel.id, name: `${sel.name} [${sel.partNumber}]` } : { ...x, partId: null }) : x))
                              }}
                            >
                              <option value="">Slobodan unos (nije iz magacina)</option>
                              {stock.map((x) => <option key={x.id} value={x.id}>{x.name} [{x.partNumber}] — stanje {x.quantity} {x.unit}</option>)}
                            </select>
                          )}
                        </div>
                      )
                    })}
                    <Button type="button" variant="outline" size="sm" onClick={() => setWorkParts((ps) => [...ps, { name: '', qty: '1', partId: null }])}><Plus className="h-4 w-4 mr-1" />Dodaj dio</Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ko je radio popravku</Label>
                    <PersonPicker multi storageKey="workers" value={workWorkers} onChange={setWorkWorkers} placeholder="Dodajte osobu (ime ili broj kartice)" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5"><Label>Utrošeno sati</Label><Input inputMode="decimal" value={workHours} onChange={(e) => setWorkHours(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Trošak (€)</Label><Input inputMode="decimal" value={workCost} onChange={(e) => setWorkCost(e.target.value)} /></div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setWorkOpen(false)}>Odustani</Button>
                    <Button type="submit" disabled={isPending}>
                      {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Snimi radni nalog
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}

          <Button
            size="sm"
            variant="outline"
            className="h-10 text-sm"
            onClick={() => window.open(`/api/reports/prijava-kvara?id=${damage.id}`, '_blank')}
          >
            <FileDown className="h-3.5 w-3.5 mr-1" />
            Kvar PDF
          </Button>
          {currentUser.role !== 'operator' && (
            <Button size="sm" variant="outline" className="h-10 text-sm" onClick={() => window.open(`/api/reports/karton-sredstva?code=${encodeURIComponent(damage.equipmentCode)}`, '_blank')}>
              <FileDown className="h-3.5 w-3.5 mr-1" />
              Karton sredstva
            </Button>
          )}
          {currentUser.role !== 'operator' && damage.status !== 'RESOLVED' && (
            <Button size="sm" variant="outline" className="h-10 text-sm border-red-400 text-red-700" onClick={() => window.open(`/api/reports/placard-neispravno?id=${damage.id}`, '_blank')}>
              <FileDown className="h-3.5 w-3.5 mr-1" />
              Plakat NEISPRAVNO
            </Button>
          )}
          {/* Napredna ručna izmjena - samo admin, kao izlaz u nuždi */}
          {currentUser.role === 'admin' && damage.status !== 'RESOLVED' && damage.status !== 'AWAITING_APPROVAL' && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs">
                  Ručno riješi
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ručno riješi kvar (zaobilazi odobrenje šefa)</DialogTitle>
                  <DialogDescription>
                    Koristiti samo u izuzetnim slučajevima - standardni put je "Označi kao popravljeno" pa odobrenje šefa.
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
          )}
          </div>
          {replOpen && <ReplacementPanel equipmentId={damage.equipmentId} equipmentCode={damage.equipmentCode} />}
          {histOpen && <WorkshopHistory damageId={damage.id} />}
          <ExternalSendDialog damageId={damage.id} code={damage.equipmentCode} defaultProvider={d.equipment?.serviceProvider} open={extSendOpen} onOpenChange={setExtSendOpen} onDone={onResolved} />
          <ExternalReturnDialog damageId={damage.id} code={damage.equipmentCode} provider={d.externalProvider} open={extBackOpen} onOpenChange={setExtBackOpen} onDone={onResolved} />
          <ChiefDialog
            damage={{ id: damage.id, equipmentCode: damage.equipmentCode, department: d.equipment?.department ?? null, workCost: d.workCost, workHours: d.workHours, partsText, severity: damage.severity }}
            open={chiefOpen} onOpenChange={setChiefOpen} onDone={onResolved}
          />
          <ArrivedDialog damageId={damage.id} code={damage.equipmentCode} open={arrivedOpen} onOpenChange={setArrivedOpen} onDone={onResolved} />
          <StatusDialog damageId={damage.id} code={damage.equipmentCode} staleDays={stale.due ? stale.days : null} open={statusOpen} onOpenChange={setStatusOpen} onDone={onResolved} />

        </div>
      </div>
    </div>
  )
}
