'use client'

// Dijeljena kartica za prijavu kvara - koristi se i u "GSE oprema > Oštećenja"
// tabu i u "Održavanje > Neispravna sredstva" pregledu. Namjerno JEDNA
// implementacija na jednom mjestu, da tok popravke (preuzmi → označi
// popravljeno → odobri) uvijek radi identično bez obzira odakle se otvori -
// razdvojene kopije bi vremenom počele da se razilaze.

import { useState, useTransition } from 'react'
import { Wrench, ShieldCheck, User, Calendar, CheckCircle2, Loader2, FileDown, Image as ImageIcon, ClipboardList, Plus, Trash2 } from 'lucide-react'
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
import { resolveDamageReport, acknowledgeDamage, markRepaired, approveRepair, getOpenDamages } from '@/lib/actions'
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
}: {
  damage: DamageRow
  onResolved: () => void
  currentUser: AppUser
  compact?: boolean
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
      toast.success('Prijava riješena')
      setOpen(false)
      setResolution('')
      onResolved()
    })
  }

  const handleAcknowledge = () => {
    startTransition(async () => {
      await acknowledgeDamage(damage.id)
      toast.success('Prijava preuzeta u radionicu')
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
  const savedParts: Array<{ name: string; qty: number }> = (() => {
    try { const v = typeof d.partsJson === 'string' ? JSON.parse(d.partsJson) : d.partsJson; return Array.isArray(v) ? v : [] } catch { return [] }
  })()
  const [workOpen, setWorkOpen] = useState(false)
  const [workNotes, setWorkNotes] = useState('')
  const [workParts, setWorkParts] = useState<Array<{ name: string; qty: string }>>([])
  const [workWorkers, setWorkWorkers] = useState('')
  const [workHours, setWorkHours] = useState('')
  const [workCost, setWorkCost] = useState('')
  const openWork = (o: boolean) => {
    setWorkOpen(o)
    if (o) {
      setWorkNotes(damage.resolution ?? '')
      setWorkParts(savedParts.length ? savedParts.map((p) => ({ name: p.name, qty: String(p.qty) })) : [{ name: '', qty: '1' }])
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
        parts: workParts.filter((p) => p.name.trim()).map((p) => ({ name: p.name, qty: Number(p.qty.replace(',', '.')) })),
        workerNames: workWorkers,
        workHours: workHours.trim() ? Number(workHours.replace(',', '.')) : null,
        workCost: workCost.trim() ? Number(workCost.replace(',', '.')) : null,
      })
      if (res.ok) { toast.success('Radni nalog snimljen'); setWorkOpen(false); onResolved() }
      else toast.error(res.error ?? 'Greška')
    })
  }
  const canWork = currentUser.role !== 'operator' && damage.status !== 'RESOLVED'
  const partsText = savedParts.map((p) => `${p.name} ×${p.qty}`).join(', ')

  const [approveOpen, setApproveOpen] = useState(false)
  const [approveCost, setApproveCost] = useState('')
  const [approveParts, setApproveParts] = useState('')
  const [approveDuration, setApproveDuration] = useState('')

  const handleApprove = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await approveRepair({
        damageId: damage.id,
        cost: approveCost.trim() ? Number(approveCost) : undefined,
        partsReplaced: approveParts.trim() || undefined,
        durationHours: approveDuration.trim() ? Number(approveDuration) : undefined,
      })
      if (res.ok) {
        toast.success(res.crsNumber ? `Popravka odobrena - izdat CRS ${res.crsNumber}` : 'Popravka odobrena - sredstvo vraćeno u upotrebu (čeka potvrdu prvog radnika)')
        setApproveOpen(false)
        onResolved()
      } else {
        toast.error(res.error ?? 'Greška')
      }
    })
  }

  const isNew = damage.status === 'OPEN' && !(damage as any).acknowledgedAt

  return (
    <div className={`p-3 rounded-lg border ${isNew ? 'border-red-400 bg-red-50 ring-2 ring-red-200' : damage.status === 'AWAITING_APPROVAL' ? 'border-purple-300 bg-purple-50/50' : damage.status === 'OPEN' ? 'border-red-200 bg-red-50/50' : damage.status === 'IN_REPAIR' ? 'border-amber-200 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/50'}`}>
      <div className="flex items-start justify-between gap-2">
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
          <div className="text-sm font-medium truncate">{damage.equipmentName}</div>
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
        <div className="flex flex-col gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => window.open(`/api/reports/prijava-kvara?id=${damage.id}`, '_blank')}
          >
            <FileDown className="h-3.5 w-3.5 mr-1" />
            Prijava kvara PDF
          </Button>
          {isNew && (
            <Button size="sm" className="h-8 text-xs bg-red-600 hover:bg-red-700" disabled={isPending} onClick={handleAcknowledge}>
              <Wrench className="h-3.5 w-3.5 mr-1" />
              Preuzmi u radionicu
            </Button>
          )}

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
                    Upišite šta je urađeno, koji dijelovi i u kojoj količini, ko je radio. Snimanjem se ne mijenja status prijave.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSaveWork} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Opis popravke</Label>
                    <Textarea rows={3} value={workNotes} onChange={(e) => setWorkNotes(e.target.value)} placeholder="npr. Zamijenjena sijalica prednjeg lijevog farova, testirano" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rezervni dijelovi</Label>
                    {workParts.map((p, i) => (
                      <div key={i} className="flex gap-1.5">
                        <Input className="flex-1" placeholder="Naziv dijela" value={p.name} onChange={(e) => setWorkParts((ps) => ps.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                        <Input className="w-20" inputMode="decimal" placeholder="Kol." value={p.qty} onChange={(e) => setWorkParts((ps) => ps.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} />
                        <Button type="button" variant="ghost" size="icon" aria-label="Ukloni dio" onClick={() => setWorkParts((ps) => ps.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setWorkParts((ps) => [...ps, { name: '', qty: '1' }])}><Plus className="h-4 w-4 mr-1" />Dodaj dio</Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ko je radio popravku</Label>
                    <Input value={workWorkers} onChange={(e) => setWorkWorkers(e.target.value)} placeholder="ime i prezime (više osoba odvojite zarezom)" />
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

          {/* Korak 1: mehaničar (engineer/admin) označava da je popravka gotova */}
          {damage.status === 'IN_REPAIR' && (
            <Dialog open={repairOpen} onOpenChange={(o) => { setRepairOpen(o); if (o && !repairNotes && damage.resolution) setRepairNotes(damage.resolution) }}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-9 text-xs bg-amber-600 hover:bg-amber-700">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Označi kao popravljeno
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
                        Ova prijava nije nastala iz pre-use checkliste, pa kategoriju treba ručno odrediti - od nje zavisi koji radnik smije preuzeti popravku.
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

          {/* Korak 2: šef službe (samo admin) pregleda i odobrava */}
          {damage.status === 'AWAITING_APPROVAL' && currentUser.role === 'admin' && (
            <Dialog open={approveOpen} onOpenChange={(o) => { setApproveOpen(o); if (o) { setApproveCost(d.workCost != null ? String(d.workCost) : ''); setApproveDuration(d.workHours != null ? String(d.workHours) : ''); setApproveParts(partsText) } }}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-9 text-xs bg-purple-600 hover:bg-purple-700">
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                  Odobri popravku
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Odobri popravku</DialogTitle>
                  <DialogDescription>
                    Popunjeno iz radnog naloga radionice (možete ispraviti). Upisuje se u servisni nalog (MaintenanceLog), zajedno sa imenom ko je radio i ko je odobrio.
                    {(damage.severity === 'MAJOR' || damage.severity === 'CRITICAL') && ' Za ovu težinu kvara automatski se izdaje i Certificate of Release (EASA Part-145.A.50).'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleApprove} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label>Trošak (€)</Label>
                      <Input type="number" inputMode="decimal" value={approveCost} onChange={(e) => setApproveCost(e.target.value)} placeholder="opciono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Trajanje (h)</Label>
                      <Input type="number" inputMode="decimal" value={approveDuration} onChange={(e) => setApproveDuration(e.target.value)} placeholder="opciono" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Zamijenjeni djelovi</Label>
                    <Input value={approveParts} onChange={(e) => setApproveParts(e.target.value)} placeholder="opciono, npr. kabl napajanja 3x2.5mm" />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setApproveOpen(false)}>Odustani</Button>
                    <Button type="submit" disabled={isPending}>
                      {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Odobri
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
          {damage.status === 'AWAITING_APPROVAL' && currentUser.role !== 'admin' && (
            <div className="text-xs text-purple-700 flex items-center gap-1 max-w-[140px] text-right">
              <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
              Čeka odobrenje šefa
            </div>
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
                  <DialogTitle>Ručno riješi prijavu (zaobilazi odobrenje šefa)</DialogTitle>
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
      </div>
    </div>
  )
}
