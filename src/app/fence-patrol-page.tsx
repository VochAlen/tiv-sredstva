'use client'

// FTO patrola ograde - PRG.03.02, 3.2.3.3 (dnevni pregled ograde, 2-4x
// dnevno). Namjerno BEZ logina, kao GSE worker kiosk - FTO službenik u
// papirnom procesu takođe nema pristup dashboardu, samo ide na teren.

import { useEffect, useState } from 'react'
import { ShieldCheck, CheckCircle2, Plus, X, Loader2, Send, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { createFencePatrol, getLatestFencePatrol, type FencePatrolFinding } from '@/lib/actions-inspection'
import { FENCE_DEFECT_CATEGORIES } from '@/lib/inspection-codes'

type Step = 'form' | 'success'

export function FencePatrolPage() {
  const [step, setStep] = useState<Step>('form')
  const [name, setName] = useState('')
  const [cardId, setCardId] = useState('')
  const [findings, setFindings] = useState<FencePatrolFinding[]>([])
  const [addingFinding, setAddingFinding] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [lastPatrol, setLastPatrol] = useState<{ performedBy: string; inspectionDate: Date; findingsCount: number } | null>(null)

  // Nova stavka nedostatka u toku unosa
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [stubFrom, setStubFrom] = useState('')
  const [stubTo, setStubTo] = useState('')
  const [vegetationHeight, setVegetationHeight] = useState('')

  useEffect(() => {
    getLatestFencePatrol().then((p) => {
      if (p) setLastPatrol({ performedBy: p.performedBy, inspectionDate: new Date(p.inspectionDate), findingsCount: p.findingsCount ?? 0 })
    }).catch(() => {})
  }, [])

  const resetNewFindingForm = () => {
    setCategory('')
    setDescription('')
    setStubFrom('')
    setStubTo('')
    setVegetationHeight('')
    setAddingFinding(false)
  }

  const addFinding = () => {
    if (!category) {
      toast.error('Odaberite vrstu nedostatka')
      return
    }
    if (!stubFrom.trim()) {
      toast.error('Unesite broj stuba (ili opseg od-do)')
      return
    }
    const def = FENCE_DEFECT_CATEGORIES.find((c) => c.category === category)
    const finding: FencePatrolFinding = {
      category,
      description: description.trim() || def?.label || category,
      fenceStubFrom: Number(stubFrom),
      fenceStubTo: stubTo.trim() ? Number(stubTo) : Number(stubFrom),
    }
    setFindings((prev) => [...prev, finding])
    resetNewFindingForm()
    toast.success('Nedostatak dodat na listu')
  }

  const removeFinding = (idx: number) => {
    setFindings((prev) => prev.filter((_, i) => i !== idx))
  }

  const submit = async () => {
    if (!name.trim()) {
      toast.error('Unesite ime i prezime')
      return
    }
    setIsPending(true)
    try {
      const res = await createFencePatrol({
        patrollerName: name.trim(),
        patrollerCardId: cardId.trim() || undefined,
        findings,
      })
      if (res.ok) {
        setStep('success')
      } else {
        toast.error(res.error ?? 'Greška pri slanju')
      }
    } finally {
      setIsPending(false)
    }
  }

  const reset = () => {
    setStep('form')
    setFindings([])
    resetNewFindingForm()
    getLatestFencePatrol().then((p) => {
      if (p) setLastPatrol({ performedBy: p.performedBy, inspectionDate: new Date(p.inspectionDate), findingsCount: p.findingsCount ?? 0 })
    }).catch(() => {})
  }

  const selectedDef = FENCE_DEFECT_CATEGORIES.find((c) => c.category === category)

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white shadow-xl overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <h1 className="text-lg font-bold">Patrola ograde</h1>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Dnevni pregled žičane ograde aerodroma - Služba bezbjednosti (FTO)
            </p>

            {lastPatrol && step === 'form' && (
              <div className="mb-4 p-2.5 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                Poslednja patrola: <strong>{lastPatrol.performedBy}</strong>,{' '}
                {lastPatrol.inspectionDate.toLocaleString('hr-HR')}
                {lastPatrol.findingsCount > 0 && (
                  <span className="text-amber-700"> · {lastPatrol.findingsCount} nedostataka prijavljeno</span>
                )}
              </div>
            )}

            {step === 'form' && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-4 space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Ime i prezime *</Label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="npr. Jelena Mijušković" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cardId">Broj ID kartice (opciono)</Label>
                      <Input id="cardId" value={cardId} onChange={(e) => setCardId(e.target.value.toUpperCase())} placeholder="npr. EMP-1007" className="font-mono uppercase" />
                    </div>
                  </CardContent>
                </Card>

                {findings.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Prijavljeni nedostaci ({findings.length})</Label>
                    {findings.map((f, idx) => {
                      const def = FENCE_DEFECT_CATEGORIES.find((c) => c.category === f.category)
                      return (
                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg border border-amber-300 bg-amber-50 text-sm">
                          <div>
                            <div className="font-medium">{def?.label ?? f.category}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              Stub {f.fenceStubFrom}{f.fenceStubTo !== f.fenceStubFrom ? `-${f.fenceStubTo}` : ''}
                            </div>
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeFinding(idx)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {!addingFinding ? (
                  <Button type="button" variant="outline" className="w-full" onClick={() => setAddingFinding(true)}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Prijavi nedostatak na ogradi
                  </Button>
                ) : (
                  <Card className="border-amber-300">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Novi nedostatak</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Vrsta nedostatka *</Label>
                        <Select value={category} onValueChange={setCategory}>
                          <SelectTrigger><SelectValue placeholder="Odaberite..." /></SelectTrigger>
                          <SelectContent>
                            {FENCE_DEFECT_CATEGORIES.map((c) => (
                              <SelectItem key={c.category} value={c.category}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label>Stub (od) *</Label>
                          <Input type="number" inputMode="numeric" value={stubFrom} onChange={(e) => setStubFrom(e.target.value)} placeholder="npr. 152" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Stub (do)</Label>
                          <Input type="number" inputMode="numeric" value={stubTo} onChange={(e) => setStubTo(e.target.value)} placeholder="opciono" />
                        </div>
                      </div>
                      {selectedDef?.measurements.some((m) => m.field === 'maxDepthCm') && (
                        <div className="space-y-1.5">
                          <Label>Visina rastinja (cm)</Label>
                          <Input type="number" inputMode="numeric" value={vegetationHeight} onChange={(e) => setVegetationHeight(e.target.value)} />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label>Napomena (opciono)</Label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" className="flex-1" onClick={resetNewFindingForm}>Otkaži</Button>
                        <Button type="button" className="flex-1" onClick={addFinding}>Dodaj na listu</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Button
                  size="lg"
                  className={`w-full h-14 ${findings.length === 0 ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                  disabled={isPending}
                  onClick={submit}
                >
                  {isPending ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : findings.length === 0 ? (
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                  ) : (
                    <Send className="h-5 w-5 mr-2" />
                  )}
                  {findings.length === 0 ? 'Sve u redu - pošalji patrolu' : `Pošalji patrolu (${findings.length} nedostataka)`}
                </Button>
              </div>
            )}

            {step === 'success' && (
              <div className="text-center py-8 space-y-3">
                <div className="h-16 w-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-9 w-9 text-emerald-600" />
                </div>
                <h2 className="text-lg font-bold text-emerald-900">Patrola zabilježena</h2>
                {findings.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {findings.length} nedostataka prijavljeno. Šef Tehničke službe je obaviješten.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Ograda je pregledana - sve u redu.</p>
                )}
                <Badge variant="outline" className="mt-2">{new Date().toLocaleString('hr-HR')}</Badge>
                <Button onClick={reset} className="mt-4 w-full">Nova patrola</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
