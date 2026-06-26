'use client'

import { useState, useTransition, useEffect } from 'react'
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
} from 'lucide-react'
import { QrScanner } from './qr-scanner'
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
  const [actionType, setActionType] = useState<'CHECK_OUT' | 'CHECK_IN'>('CHECK_OUT')
  const [isPending, startTransition] = useTransition()
  const [lookupLoading, setLookupLoading] = useState(false)
  const [manuals, setManuals] = useState<EquipmentManualData[]>([])
  const [showManuals, setShowManuals] = useState(false)

  // Ako je otvoreno preko ?scan=XXX URL parametra (skener telefona)
  useEffect(() => {
    if (initialScan) {
      handleScan(initialScan)
    }
  }, [initialScan])

  // Reset svega
  const reset = () => {
    setStep('scan')
    setEquipment(null)
    setCardId(defaultEmployeeCardId)
    setEmployeeName(defaultEmployeeName)
    setChecklist(DEFAULT_CHECKLIST.map((i) => ({ ...i })))
    setInspectionResult('OK')
    setNotes('')
    setDamageDescription('')
    setDamageSeverity('MINOR')
    setActionType('CHECK_OUT')
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
      if (inspectionResult !== 'OK' && !damageDescription.trim()) {
        toast.error('Obavezno unijeti opis oštećenja')
        return
      }
    }

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
            damageDescription: inspectionResult !== 'OK' ? damageDescription.trim() : undefined,
            damageSeverity,
          })
          if (res.ok) {
            if (res.damageReportId && inspectionResult !== 'OK') {
              // Ažuriraj lokalni state - sredstvo je sad OUT_OF_SERVICE
              setEquipment((prev) => prev ? { ...prev, status: 'OUT_OF_SERVICE', notes: `Oštećenje prijavljeno: ${damageDescription.trim().slice(0, 100)}` } : prev)
              setStep('blocked')
              toast.warning('Zaduživanje uslovljeno oštećenjem - prijava zabilježena')
            } else {
              setStep('success')
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
            foundDamage: damageDescription.trim() || undefined,
            damageSeverity,
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

  return (
    <div className="max-w-md mx-auto pb-24">
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
        </div>
      )}

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
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full">
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
                  {checklist.map((item, idx) => (
                    <div key={item.id} className="space-y-1.5">
                      <div className="text-sm font-medium">
                        {idx + 1}. {item.label}
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
                  ))}
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
                      <div className="space-y-1.5">
                        <Label className="text-sm">Opis oštećenja *</Label>
                        <Textarea
                          value={damageDescription}
                          onChange={(e) => setDamageDescription(e.target.value)}
                          placeholder="Detaljno opišite šta je neispravno ili oštećeno..."
                          rows={3}
                          required
                        />
                      </div>
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

                  <div className="space-y-1.5">
                    <Label>Dali ste primijetili novo oštećenje?</Label>
                    <RadioGroup
                      value={damageDescription.trim() ? 'yes' : 'no'}
                      onValueChange={(v) => {
                        if (v === 'no') setDamageDescription('')
                      }}
                      className="grid grid-cols-2 gap-2"
                    >
                      <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer ${!damageDescription.trim() ? 'border-emerald-500 bg-emerald-50' : 'border-border'}`}>
                        <RadioGroupItem value="no" />
                        <span className="text-sm font-medium">Ne, sve OK</span>
                      </label>
                      <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer ${damageDescription.trim() ? 'border-red-500 bg-red-50' : 'border-border'}`}>
                        <RadioGroupItem value="yes" />
                        <span className="text-sm font-medium">Da, prijavljujem</span>
                      </label>
                    </RadioGroup>

                    {damageDescription.trim() && (
                      <div className="space-y-2 mt-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                        <Textarea
                          value={damageDescription}
                          onChange={(e) => setDamageDescription(e.target.value)}
                          placeholder="Opišite novo oštećenje..."
                          rows={3}
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
            <Button onClick={reset} className="mt-4">
              Skeniraj sljedeće
            </Button>
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
            <Button onClick={reset} className="mt-4" variant="outline">
              Skeniraj drugo sredstvo
            </Button>
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
