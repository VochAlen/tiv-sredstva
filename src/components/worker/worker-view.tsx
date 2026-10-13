'use client'

import { useState, useTransition, useEffect } from 'react'
import { DamageQuickFields, fallbackDamageDescription } from './damage-quick-fields'
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Package,
  User,
  ClipboardList,
  Send,
  LogOut,
  Loader2,
  MapPin,
  Wrench,
  Camera,
  Lock,
  FileText,
  Bird,
  ShieldCheck,
} from 'lucide-react'
import { QrScanner } from './qr-scanner'
import { QuickReportDialog } from './quick-report-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import {
  DEFAULT_CHECKLIST,
  getChecklistForType,
  EQUIPMENT_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  type ChecklistItem,
  type EquipmentStatus,
  type InspectionResult,
} from '@/lib/types'
import {
  checkOutEquipment,
  checkInEquipment,
  getEquipmentByCode,
} from '@/lib/actions'
import { getManualsForEquipment } from '@/lib/actions-manuals'
import { type EquipmentManualData, MANUAL_TYPE_LABELS } from '@/lib/constants-export'
import { toast } from 'sonner'
import { HelpButton } from '@/components/ui/help-button'
import { recordFitnessDeclaration } from '@/lib/actions-safety-reports'

type Step = 'scan' | 'identify' | 'inspect' | 'success' | 'blocked'

interface EquipmentInfo {
  id: string
  code: string
  name: string
  type: string
  serialNumber: string | null
  location: string
  status: string
  notes: string | null
  manualUrl?: string | null
}

// Normalizuje ono što je skenirano u kod opreme
function normalizeScan(raw: string): string {
  let v = raw.trim().toUpperCase()
  // Ako je skeniran URL sa ?scan=XXX, izvuci parametar
  const urlMatch = v.match(/[?&]SCAN=([^&\s]+)/i)
  if (urlMatch) return decodeURIComponent(urlMatch[1]).toUpperCase()
  // Ako je cijeli URL sa path-om /eq/CODE, izvuci
  const pathMatch = v.match(/\/EQ\/([A-Z0-9-]+)/)
  if (pathMatch) return pathMatch[1]
  return v
}

const SHIFT_KEY = 'gse.worker.shift'

export function WorkerView({
  initialScan,
  defaultEmployeeName = '',
  defaultEmployeeCardId = '',
}: {
  initialScan?: string
  defaultEmployeeName?: string
  defaultEmployeeCardId?: string
}) {
  const [step, setStep] = useState<Step>('scan')
  const [equipment, setEquipment] = useState<EquipmentInfo | null>(null)
  const [cardId, setCardId] = useState(defaultEmployeeCardId)
  const [employeeName, setEmployeeName] = useState(defaultEmployeeName)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST.map((i) => ({ ...i })))
  const [inspectionResult, setInspectionResult] = useState<InspectionResult>('OK')
  const [notes, setNotes] = useState('')
  const [damageDescription, setDamageDescription] = useState('')
  const [damageSeverity, setDamageSeverity] = useState<'MINOR' | 'MAJOR' | 'CRITICAL'>('MINOR')
  const [damageCategory, setDamageCategory] = useState('')
  const [damagePhotos, setDamagePhotos] = useState<string[]>([])
  const [reportDamageIn, setReportDamageIn] = useState(false)
  const [actionType, setActionType] = useState<'CHECK_OUT' | 'CHECK_IN'>('CHECK_OUT')
  const [isPending, startTransition] = useTransition()
  const [lookupLoading, setLookupLoading] = useState(false)
  const [manuals, setManuals] = useState<EquipmentManualData[]>([])
  const [showManuals, setShowManuals] = useState(false)
  const [assignmentId, setAssignmentId] = useState<string | null>(null)
  const [showFodDialog, setShowFodDialog] = useState(false)
  const [showWildlifeDialog, setShowWildlifeDialog] = useState(false)
  const [fitnessConfirmed, setFitnessConfirmed] = useState(false)
  // Radnik zapamćen za smjenu (samo ovaj tab/uređaj, sessionStorage, ~10h)
  const [remembered, setRemembered] = useState<{ cardId: string; name: string } | null>(null)
  const [editingWorker, setEditingWorker] = useState(false)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SHIFT_KEY)
      if (!raw) return
      const v = JSON.parse(raw)
      if (v && typeof v.cardId === 'string' && typeof v.name === 'string' && typeof v.exp === 'number' && v.exp > Date.now()) {
        setRemembered({ cardId: v.cardId, name: v.name })
        setCardId(v.cardId)
        setEmployeeName(v.name)
      } else {
        sessionStorage.removeItem(SHIFT_KEY)
      }
    } catch { /* sessionStorage nedostupan — radi se bez pamćenja */ }
  }, [])

  const forgetWorker = () => {
    try { sessionStorage.removeItem(SHIFT_KEY) } catch { /* ignore */ }
    setRemembered(null)
    setEditingWorker(false)
    setCardId('')
    setEmployeeName('')
  }

  // Ako je otvoreno preko ?scan=XXX URL parametra (skener telefona)
  useEffect(() => {
    if (initialScan) {
      // eslint-disable-next-line react-hooks/immutability
      handleScan(initialScan)
    }
  }, [initialScan])

  // Reset svega
  const reset = () => {
    setStep('scan')
    setEquipment(null)
    setCardId(remembered?.cardId ?? defaultEmployeeCardId)
    setEmployeeName(remembered?.name ?? defaultEmployeeName)
    setEditingWorker(false)
    setChecklist(DEFAULT_CHECKLIST.map((i) => ({ ...i })))
    setInspectionResult('OK')
    setNotes('')
    setDamageDescription('')
    setDamageSeverity('MINOR')
    setDamageCategory('')
    setDamagePhotos([])
    setReportDamageIn(false)
    setActionType('CHECK_OUT')
    setAssignmentId(null)
    setFitnessConfirmed(false)
  }

  // Kad skener vrati vrijednost
  const handleScan = async (raw: string) => {
    const code = normalizeScan(raw)
    setLookupLoading(true)
    try {
      const eq = await getEquipmentByCode(code)
      if (!eq) {
        toast.error(`Sredstvo sa kodom "${code}" nije pronađeno`)
        return
      }
      setEquipment({
        id: eq.id,
        code: eq.code,
        name: eq.name,
        type: eq.type,
        serialNumber: eq.serialNumber,
        location: eq.location,
        status: eq.status,
        notes: eq.notes,
        manualUrl: (eq as any).manualUrl ?? null,
      })

      // Čeklista zavisi od tipa sredstva (identična papirnom obrascu)
      setChecklist(getChecklistForType(eq.type))

      // Ako je neispravno ili na održavanju - odmah blokiraj
      if (eq.status === 'OUT_OF_SERVICE' || eq.status === 'MAINTENANCE') {
        setActionType('CHECK_OUT')
        setStep('blocked')
        return
      }

      // Odredi akciju na osnovu trenutnog statusa
      if (eq.status === 'ASSIGNED') {
        setActionType('CHECK_IN')
      } else {
        setActionType('CHECK_OUT')
      }

      // Učitaj uputstva za upotrebu (EASA Part-145 §65)
      try {
        const manualsData = await getManualsForEquipment(eq.id, eq.type)
        setManuals(manualsData)
      } catch {
        setManuals([])
      }

      setStep('identify')
    } catch (e) {
      toast.error('Greška pri pretrazi sredstva')
    } finally {
      setLookupLoading(false)
    }
  }

  // Submit sa identifikacionog step-a na inspection
  const handleIdentifySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cardId.trim() || !employeeName.trim()) {
      toast.error('Unesite broj ID kartice i ime')
      return
    }
    if (!fitnessConfirmed) {
      toast.error('Potvrdite da ste sposobni za rad prije nastavka')
      return
    }
    // ADR.OR.C.045 — bilježi se samo potvrda i vrijeme, bez zdravstvenih
    // podataka. Best-effort, ne blokira glavni tok ako loguje neuspješno.
    recordFitnessDeclaration({ employeeCardId: cardId, employeeName, confirmed: true }).catch(() => {})
    try {
      sessionStorage.setItem(SHIFT_KEY, JSON.stringify({ cardId: cardId.trim(), name: employeeName.trim(), exp: Date.now() + 10 * 3600 * 1000 }))
      setRemembered({ cardId: cardId.trim(), name: employeeName.trim() })
    } catch { /* ignore */ }
    if (actionType === 'CHECK_IN') {
      // CHECK_IN - ide direktno na success path (kraći proces)
      // ali ipak ide na inspect step da se potvrdi
    }
    setStep('inspect')
  }

  // Submit inspekcijske forme
  const handleInspectSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!equipment) return

    // Ako je CHECK_OUT i rezultat je OK - obavezno sve iz checkliste prošlo
    if (actionType === 'CHECK_OUT') {
      const unanswered = checklist.filter((i) => i.passed === null)
      if (unanswered.length > 0) {
        toast.error(`Morate odgovoriti na sva pitanja u checklisti (${unanswered.length} preostalo)`)
        return
      }
      const failedItems = checklist.filter((i) => i.passed === false)
      if (failedItems.length > 0 && inspectionResult === 'OK') {
        toast.error(`Označili ste ${failedItems.length} neispravnih stavki, ali ste rezultat označili kao "Ispravno". Ispravite.`)
        return
      }
      if (inspectionResult !== 'OK' && !damageDescription.trim() && !damageCategory && damagePhotos.length === 0) {
        toast.error('Dodajte sliku, izaberite kategoriju ili upišite kratak opis kvara')
        return
      }
    }

    submitInspect()
  }

  // Izdvojeno iz handleInspectSubmit da i brza dugmad (markAllPassed +
  // submit, quickCheckIn) mogu pozvati isti kod bez events-a.
  const submitInspect = (overrides?: { damageDescription?: string; firstUseConfirmed?: boolean }) => {
    if (!equipment) return
    // Radnik ne mora ukucati ništa ako je dao sliku ili kategoriju (foto-prvo prijava)
    const damageActive = actionType === 'CHECK_OUT' ? inspectionResult !== 'OK' : reportDamageIn
    const quick = overrides?.damageDescription !== undefined // brza dugmad: bez prijave kvara
    const typedDamage = overrides?.damageDescription ?? damageDescription
    const effectiveDamageDescription =
      typedDamage.trim() || (!quick && damageActive && (damageCategory || damagePhotos.length > 0)
        ? fallbackDamageDescription(damageCategory, damagePhotos.length)
        : '')
    const extras = damageActive && !quick
      ? { damageCategory: damageCategory || undefined, damagePhotos: damagePhotos.length ? damagePhotos : undefined }
      : {}

    startTransition(async () => {
      try {
        if (actionType === 'CHECK_OUT') {
          const res = await checkOutEquipment({
            equipmentCode: equipment.code,
            employeeCardId: cardId.trim(),
            employeeName: employeeName.trim(),
            checklist,
            inspectionResult,
            inspectionNotes: notes.trim() || undefined,
            damageDescription: inspectionResult !== 'OK' ? effectiveDamageDescription.trim() : undefined,
            damageSeverity,
            ...extras,
            firstUseConfirmed: overrides?.firstUseConfirmed,
          })
          if ((res as any).needsFirstUseConfirmation) {
            // Sredstvo je nedavno popravljeno — prvi radnik mora potvrditi da ga je pregledao
            if (window.confirm(`${res.error}\n\nPotvrđujem da sam pregledao/la sredstvo i da je ispravno.`)) {
              submitInspect({ ...overrides, firstUseConfirmed: true })
            }
            return
          }
          setAssignmentId((res as any).assignmentId ?? null)
          if (res.ok) {
            // Zaduženo; ako je uz to prijavljeno oštećenje koje ne blokira, radionica je obaviještena
            setStep('success')
            if (res.damageReportId && inspectionResult !== 'OK') {
              toast.warning('Zaduženo. Prijava oštećenja je zabilježena i proslijeđena radionici.')
            } else {
              toast.success('Uspješno zaduženo!')
            }
          } else {
            // Vjerovatno OUT_OF_SERVICE ili MAINTENANCE
            setStep('blocked')
            toast.error(res.error ?? 'Greška')
          }
        } else {
          // CHECK_IN
          const res = await checkInEquipment({
            equipmentCode: equipment.code,
            employeeCardId: cardId.trim(),
            employeeName: employeeName.trim(),
            notes: notes.trim() || undefined,
            foundDamage: effectiveDamageDescription.trim() || undefined,
            damageSeverity,
            ...extras,
          })
          if (res.ok) {
            setStep('success')
            toast.success('Uspješno razduženo!')
          } else {
            toast.error(res.error ?? 'Greška')
          }
        }
      } catch (e: any) {
        toast.error(`Greška: ${e?.message ?? e}`)
      }
    })
  }

  // Update checklist item
  const updateChecklistItem = (id: string, value: boolean) => {
    setChecklist((prev) => prev.map((i) => (i.id === id ? { ...i, passed: value } : i)))
  }

  // Brzo zaduživanje - jednim klikom oznaci sve stavke kao ispravne
  // (radnik ipak može kliknuti na pojedinačnu stavku ako primijeti kvar)
  const markAllPassed = () => {
    setChecklist((prev) => prev.map((i) => ({ ...i, passed: true })))
    setInspectionResult('OK')
  }

  // Brzo razduživanje - jednim klikom potvrdi "sve OK, nema novog
  // oštećenja" i odmah pošalji (isti obrazac kao markAllPassed za
  // zaduživanje, za CHECK_IN tok).
  const quickCheckIn = () => {
    setDamageDescription('')
    submitInspect({ damageDescription: '' })
  }

  // Auto-set inspection result na osnovu checkliste
  useEffect(() => {
    if (actionType !== 'CHECK_OUT') return
    const allAnswered = checklist.every((i) => i.passed !== null)
    if (!allAnswered) return
    const failed = checklist.filter((i) => i.passed === false).length
    if (failed === 0) setInspectionResult('OK')
    else if (failed <= 2) setInspectionResult((prev) => (prev === 'OK' ? 'MINOR_DAMAGE' : prev))
    else setInspectionResult((prev) => (prev === 'OK' ? 'MAJOR_DAMAGE' : prev))
  }, [checklist, actionType])

  // Automatski upiši naziv neispravne stavke u opis oštećenja, da
  // održavanje odmah vidi koji dio sredstva je u kvaru - radnik ne
  // mora ponovo kucati ono što je već oznacio u checklisti (ali može
  // dopisati detalje).
  useEffect(() => {
    if (actionType !== 'CHECK_OUT') return
    const failedLabels = checklist.filter((i) => i.passed === false).map((i) => i.label)
    if (failedLabels.length === 0) return
    const autoText = `Neispravno: ${failedLabels.join('; ')}`
    setDamageDescription((prev) => (prev.trim() === '' || prev.startsWith('Neispravno: ') ? autoText : prev))
  }, [checklist, actionType])

  return (
    <div className="max-w-md mx-auto pb-24">
      <HelpButton helpKey={`worker.${step}`} />
      {/* Header sa step indikatorom */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {step !== 'scan' && step !== 'success' && step !== 'blocked' && (
            <Button variant="ghost" size="sm" onClick={() => setStep(step === 'inspect' ? 'identify' : 'scan')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Nazad
            </Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          Korak {step === 'scan' ? 1 : step === 'identify' ? 2 : step === 'inspect' ? 3 : 4} / 4
        </div>
      </div>

      {lookupLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* STEP 1: SCAN */}
      {step === 'scan' && !lookupLoading && (
        <div className="space-y-4">
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="pt-6 text-center">
              <Package className="h-12 w-12 mx-auto text-primary mb-2" />
              <h2 className="text-lg font-semibold">Zaduži / Razduži sredstvo</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Skenirajte QR kod sa vozila ili opreme
              </p>
            </CardContent>
          </Card>

          <QrScanner onScan={handleScan} />

          <Card className="bg-muted/30">
            <CardContent className="pt-4 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Kako radi?</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Skeniraj QR kod na vozilu/opremi</li>
                <li>Unesi broj ID kartice i ime</li>
                <li>Pregledaj i potvrdi checklistu</li>
                <li>Prijava završena — sredstvo je zaduženo</li>
              </ol>
            </CardContent>
          </Card>

          {/* Brze prijave — ne zahtijevaju skeniranje opreme (ADR.OPS.B.016/B.020) */}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowFodDialog(true)}>
              <AlertTriangle className="h-4 w-4 mr-1.5 text-amber-600" />
              Prijavi FOD
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowWildlifeDialog(true)}>
              <Bird className="h-4 w-4 mr-1.5 text-emerald-600" />
              Divlja životinja
            </Button>
          </div>
        </div>
      )}

      <QuickReportDialog open={showFodDialog} onOpenChange={setShowFodDialog} type="FOD" />
      <QuickReportDialog open={showWildlifeDialog} onOpenChange={setShowWildlifeDialog} type="WILDLIFE" />

      {/* STEP 2: IDENTIFY - info o sredstvu + ID radnika */}
      {step === 'identify' && equipment && !lookupLoading && (
        <form onSubmit={handleIdentifySubmit} className="space-y-4">
          <EquipmentCard equipment={equipment} actionType={actionType} />

          {/* Uputstvo za upotrebu (EASA Part-145 §65) */}
          {manuals.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {manuals.map((m) => (
                <a
                  key={m.id}
                  href={m.manualUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition text-sm font-medium"
                >
                  <FileText className="h-4 w-4" />
                  {MANUAL_TYPE_LABELS[m.manualType] || 'Uputstvo'}
                  {m.version && <span className="text-xs opacity-60">({m.version})</span>}
                </a>
              ))}
            </div>
          )}
          {manuals.length === 0 && equipment.manualUrl && (
            <a
              href={equipment.manualUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition text-sm font-medium"
            >
              <FileText className="h-4 w-4" />
              Uputstvo za upotrebu
            </a>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Vaši podaci
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {remembered && !editingWorker ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{remembered.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{remembered.cardId}</div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={forgetWorker}>
                    Nisam ja
                  </Button>
                </div>
              ) : (
                <>
              <div className="space-y-1.5">
                <Label htmlFor="cardId">Broj ID kartice *</Label>
                <Input
                  id="cardId"
                  value={cardId}
                  onChange={(e) => setCardId(e.target.value.toUpperCase())}
                  placeholder="npr. EMP-1001"
                  className="font-mono uppercase"
                  autoCapitalize="characters"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="empName">Ime i prezime *</Label>
                <Input
                  id="empName"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="npr. Vukan Vojvodić"
                  required
                />
              </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ADR.OR.C.045 — potvrda sposobnosti za rad (bez zdravstvenih podataka) */}
          <label className="flex items-start gap-2.5 text-sm p-3 rounded-lg border bg-muted/30 cursor-pointer">
            <input
              type="checkbox"
              checked={fitnessConfirmed}
              onChange={(e) => setFitnessConfirmed(e.target.checked)}
              className="h-4 w-4 mt-0.5 flex-shrink-0"
            />
            <span className="flex items-start gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              Potvrđujem da sam sposoban/na za rad (nisam pod uticajem alkohola ili psihoaktivnih supstanci)
            </span>
          </label>

          <Button type="submit" size="lg" className="w-full" disabled={!fitnessConfirmed}>
            {actionType === 'CHECK_OUT' ? 'Nastavi na pregled' : 'Nastavi na razduživanje'}
          </Button>
        </form>
      )}

      {/* STEP 3: INSPECT */}
      {step === 'inspect' && equipment && !lookupLoading && (
        <form onSubmit={handleInspectSubmit} className="space-y-4">
          <EquipmentCard equipment={equipment} actionType={actionType} compact />

          {actionType === 'CHECK_OUT' ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Pre-use inspection checklista
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Označite svaku stavku kao ispravnu ili neispravnu
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    onClick={markAllPassed}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Sve stavke ispravne (brzo zaduživanje)
                  </Button>
                  <Separator />
                  {checklist.map((item, idx) => {
                    const prevGroup = idx > 0 ? checklist[idx - 1].group : undefined
                    const showGroupHeader = item.group !== undefined && item.group !== prevGroup
                    return (
                      <div key={item.id} className="space-y-1.5">
                        {showGroupHeader && (
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pt-1">
                            Grupa {item.group}
                          </div>
                        )}
                        <div className="text-sm font-medium flex items-center gap-1.5">
                          {idx + 1}. {item.label}
                          {item.blocking && (
                            <Badge variant="outline" className="text-[10px] border-red-300 text-red-700">
                              blokira zaduživanje
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={item.passed === true ? 'default' : 'outline'}
                            className={item.passed === true ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                            onClick={() => updateChecklistItem(item.id, true)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Ispravno
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={item.passed === false ? 'default' : 'outline'}
                            className={item.passed === false ? 'bg-red-600 hover:bg-red-700' : ''}
                            onClick={() => updateChecklistItem(item.id, false)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Neispravno
                          </Button>
                        </div>
                        {idx < checklist.length - 1 && <Separator className="mt-3" />}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Rezultat pregleda</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <RadioGroup
                    value={inspectionResult}
                    onValueChange={(v) => setInspectionResult(v as InspectionResult)}
                    className="grid grid-cols-2 gap-2"
                  >
                    <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition ${inspectionResult === 'OK' ? 'border-emerald-500 bg-emerald-50' : 'border-border'}`}>
                      <RadioGroupItem value="OK" />
                      <span className="text-sm font-medium">Ispravno</span>
                    </label>
                    <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition ${inspectionResult === 'MINOR_DAMAGE' ? 'border-amber-500 bg-amber-50' : 'border-border'}`}>
                      <RadioGroupItem value="MINOR_DAMAGE" />
                      <span className="text-sm font-medium">Manje oštećenje</span>
                    </label>
                    <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition ${inspectionResult === 'MAJOR_DAMAGE' ? 'border-orange-500 bg-orange-50' : 'border-border'}`}>
                      <RadioGroupItem value="MAJOR_DAMAGE" />
                      <span className="text-sm font-medium">Veće oštećenje</span>
                    </label>
                    <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition ${inspectionResult === 'OUT_OF_SERVICE' ? 'border-red-500 bg-red-50' : 'border-border'}`}>
                      <RadioGroupItem value="OUT_OF_SERVICE" />
                      <span className="text-sm font-medium">Neispravno</span>
                    </label>
                  </RadioGroup>

                  {inspectionResult !== 'OK' && (
                    <div className="space-y-3 mt-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                      <DamageQuickFields
                        category={damageCategory}
                        onCategory={setDamageCategory}
                        photos={damagePhotos}
                        onPhotos={setDamagePhotos}
                        description={damageDescription}
                        onDescription={setDamageDescription}
                      />
                      <div className="space-y-1.5">
                        <Label className="text-sm">Težina oštećenja</Label>
                        <RadioGroup
                          value={damageSeverity}
                          onValueChange={(v) => setDamageSeverity(v as 'MINOR' | 'MAJOR' | 'CRITICAL')}
                          className="grid grid-cols-3 gap-2"
                        >
                          {[
                            { v: 'MINOR', l: 'Manje', cls: 'border-amber-500 bg-amber-50' },
                            { v: 'MAJOR', l: 'Veće', cls: 'border-orange-500 bg-orange-50' },
                            { v: 'CRITICAL', l: 'Kritično', cls: 'border-red-500 bg-red-50' },
                          ].map((s) => (
                            <label
                              key={s.v}
                              className={`flex items-center justify-center gap-1 p-2 rounded-lg border-2 cursor-pointer text-xs font-medium ${damageSeverity === s.v ? s.cls : 'border-border'}`}
                            >
                              <RadioGroupItem value={s.v} className="sr-only" />
                              {s.l}
                            </label>
                          ))}
                        </RadioGroup>
                      </div>
                      <p className="text-xs text-destructive flex items-start gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        {inspectionResult === 'OUT_OF_SERVICE' || damageSeverity === 'CRITICAL'
                          ? 'Sredstvo se NEĆE moći zadužiti. Biće prebačeno u OUT_OF_SERVICE i prijava proslijeđena održavanju.'
                          : 'Sredstvo će biti zabilježeno sa oštećenjem, ali ćete ga moći zadužiti (ako je manje oštećenje).'}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="notes-insp">Dodatne napomene (opciono)</Label>
                    <Textarea
                      id="notes-insp"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Opciono: bilješke o stanju..."
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              <Button type="submit" size="lg" className="w-full" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Zaduži sredstvo
              </Button>
            </>
          ) : (
            // CHECK_IN form
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    Razduživanje
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-muted/30 p-3 rounded-lg text-sm">
                    <p>Potvrđujete da razdužujete ovo sredstvo i da ste ga vratili u istom stanju (ili prijavljujete novo oštećenje).</p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    onClick={quickCheckIn}
                    disabled={isPending}
                  >
                    {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Sve OK — brzo razduživanje
                  </Button>
                  <Separator />

                  <div className="space-y-1.5">
                    <Label>Dali ste primijetili novo oštećenje?</Label>
                    <RadioGroup
                      value={reportDamageIn ? 'yes' : 'no'}
                      onValueChange={(v) => {
                        setReportDamageIn(v === 'yes')
                        if (v === 'no') { setDamageDescription(''); setDamageCategory(''); setDamagePhotos([]) }
                      }}
                      className="grid grid-cols-2 gap-2"
                    >
                      <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer ${!reportDamageIn ? 'border-emerald-500 bg-emerald-50' : 'border-border'}`}>
                        <RadioGroupItem value="no" />
                        <span className="text-sm font-medium">Ne, sve OK</span>
                      </label>
                      <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer ${reportDamageIn ? 'border-red-500 bg-red-50' : 'border-border'}`}>
                        <RadioGroupItem value="yes" />
                        <span className="text-sm font-medium">Da, prijavljujem</span>
                      </label>
                    </RadioGroup>

                    {reportDamageIn && (
                      <div className="space-y-2 mt-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                        <DamageQuickFields
                          category={damageCategory}
                          onCategory={setDamageCategory}
                          photos={damagePhotos}
                          onPhotos={setDamagePhotos}
                          description={damageDescription}
                          onDescription={setDamageDescription}
                        />
                        <RadioGroup
                          value={damageSeverity}
                          onValueChange={(v) => setDamageSeverity(v as 'MINOR' | 'MAJOR' | 'CRITICAL')}
                          className="grid grid-cols-3 gap-2"
                        >
                          {[
                            { v: 'MINOR', l: 'Manje' },
                            { v: 'MAJOR', l: 'Veće' },
                            { v: 'CRITICAL', l: 'Kritično' },
                          ].map((s) => (
                            <label
                              key={s.v}
                              className={`flex items-center justify-center p-2 rounded-lg border-2 cursor-pointer text-xs font-medium ${damageSeverity === s.v ? 'border-primary bg-primary/5' : 'border-border'}`}
                            >
                              <RadioGroupItem value={s.v} className="sr-only" />
                              {s.l}
                            </label>
                          ))}
                        </RadioGroup>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notes-in">Napomene (opciono)</Label>
                    <Textarea
                      id="notes-in"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Opciono..."
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              <Button type="submit" size="lg" className="w-full" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogOut className="h-4 w-4 mr-2" />}
                Razduži sredstvo
              </Button>
            </>
          )}
        </form>
      )}

      {/* STEP 4a: SUCCESS */}
      {step === 'success' && equipment && (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <div className="h-16 w-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-emerald-900">
              {actionType === 'CHECK_OUT' ? 'Uspješno zaduženo!' : 'Uspješno razduženo!'}
            </h2>
            <p className="text-sm text-emerald-700">
              {actionType === 'CHECK_OUT'
                ? 'Preuzeli ste odgovornost za sredstvo tokom smjene.'
                : 'Sredstvo je vraćeno u dostupne.'}
            </p>
            <div className="bg-white/60 rounded-lg p-3 text-left text-sm space-y-1 max-w-xs mx-auto">
              <div className="font-mono font-semibold">{equipment.code}</div>
              <div className="text-muted-foreground">{equipment.name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date().toLocaleString('hr-HR')}
              </div>
            </div>
            <div className="flex flex-col gap-2 items-center mt-4">
              {assignmentId && actionType === 'CHECK_OUT' && (
                <a
                  href={`/api/reports/gse-checklist?id=${assignmentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition text-sm font-medium"
                >
                  <FileText className="h-4 w-4" />
                  Preuzmi PDF čeklistu
                </a>
              )}
              <Button onClick={reset}>
                Skeniraj sljedeće
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4b: BLOCKED - ne može se zadužiti */}
      {step === 'blocked' && equipment && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <div className="h-16 w-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-9 w-9 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-red-900">
              Zaduživanje blokirano
            </h2>
            <p className="text-sm text-red-700 max-w-md mx-auto">
              {damageDescription.trim()
                ? 'Prijavili ste oštećenje na sredstvu. Sredstvo je prebačeno u status "Neispravno" i ne može se zadužiti. Održavanje je automatski obaviješteno o vašoj prijavi.'
                : 'Sredstvo je trenutno neispravno ili je na održavanju. Zaduživanje nije moguće. Kontaktirajte održavanje ako smatrate da je greška.'}
            </p>
            <div className="bg-white/60 rounded-lg p-3 text-left text-sm space-y-1 max-w-md mx-auto border border-red-200">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-red-900">{equipment.code}</span>
                <span className="text-muted-foreground text-xs">— {equipment.name}</span>
              </div>
              {damageDescription.trim() ? (
                <div className="mt-2 pt-2 border-t border-red-200 space-y-1">
                  <div className="text-xs font-medium text-red-900 uppercase">Prijavljeno oštećenje:</div>
                  <div className="text-sm text-red-800">{damageDescription.trim()}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Težina: <strong className="text-red-900">{damageSeverity === 'MINOR' ? 'Manje' : damageSeverity === 'MAJOR' ? 'Veće' : 'Kritično'}</strong>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground mt-1">
                  Trenutni status: <strong className="text-red-900">{STATUS_LABELS[equipment.status as EquipmentStatus] ?? equipment.status}</strong>
                </div>
              )}
              {equipment.notes && !damageDescription.trim() && (
                <div className="text-xs text-red-700 mt-1 pt-1 border-t border-red-200">
                  <strong>Razlog:</strong> {equipment.notes}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 items-center mt-4">
              {assignmentId && (
                <a
                  href={`/api/reports/gse-checklist?id=${assignmentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-red-300 text-red-700 hover:bg-red-50 transition text-sm font-medium"
                >
                  <FileText className="h-4 w-4" />
                  Preuzmi PDF čeklistu
                </a>
              )}
              <Button onClick={reset} variant="outline">
                Skeniraj drugo sredstvo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function EquipmentCard({
  equipment,
  actionType,
  compact = false,
}: {
  equipment: EquipmentInfo
  actionType: 'CHECK_OUT' | 'CHECK_IN'
  compact?: boolean
}) {
  return (
    <Card className={actionType === 'CHECK_OUT' ? 'border-primary/30' : 'border-amber-300'}>
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="font-mono text-xs">
                {equipment.code}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {EQUIPMENT_TYPE_LABELS[equipment.type as keyof typeof EQUIPMENT_TYPE_LABELS] ?? equipment.type}
              </Badge>
            </div>
            <h3 className="font-semibold text-base leading-tight">{equipment.name}</h3>
            {equipment.serialNumber && (
              <div className="text-xs text-muted-foreground mt-1">
                S/N: {equipment.serialNumber}
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
              <MapPin className="h-3 w-3" />
              {equipment.location}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={`text-xs ${STATUS_COLORS[equipment.status as EquipmentStatus] ?? ''}`}>
              {STATUS_LABELS[equipment.status as EquipmentStatus] ?? equipment.status}
            </Badge>
            <div className="text-[10px] text-muted-foreground uppercase">
              {actionType === 'CHECK_OUT' ? 'Zaduživanje' : 'Razduživanje'}
            </div>
          </div>
        </div>
        {equipment.notes && (
          <div className="mt-3 text-xs flex items-start gap-1.5 p-2 bg-muted/50 rounded">
            <Wrench className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>{equipment.notes}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
