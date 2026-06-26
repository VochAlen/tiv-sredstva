'use client'

import { useState, useTransition, useEffect } from 'react'
import { Shield, Plus, Trash2, Lock, Unlock, Loader2, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  getAuthorizedWorkers, authorizeWorker, removeAuthorization, toggleRestrictedAccess, getAllEmployees,
} from '@/lib/actions-access'
import type { AccessEntry } from '@/lib/actions-access'

export function AccessControlDialog({ equipmentId, equipmentCode, equipmentName }: {
  equipmentId: string
  equipmentCode: string
  equipmentName: string
}) {
  const [open, setOpen] = useState(false)
  const [restricted, setRestricted] = useState(false)
  const [workers, setWorkers] = useState<AccessEntry[]>([])
  const [employees, setEmployees] = useState<Array<{ id: string; cardId: string; name: string }>>([])
  const [selectedCardId, setSelectedCardId] = useState('')
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const load = async () => {
    setLoading(true)
    try {
      const [access, emps] = await Promise.all([
        getAuthorizedWorkers(equipmentId),
        getAllEmployees(),
      ])
      setWorkers(access)
      setEmployees(emps)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (open) load()
  }, [open])

  const handleToggle = (restricted: boolean) => {
    setRestricted(restricted)
    startTransition(async () => {
      await toggleRestrictedAccess(equipmentId, restricted)
      toast.success(restricted ? 'Pristup ograničen' : 'Pristup otvoren za sve')
    })
  }

  const handleAuthorize = () => {
    if (!selectedCardId) {
      toast.error('Izaberite radnika')
      return
    }
    const emp = employees.find((e) => e.cardId === selectedCardId)
    if (!emp) return

    startTransition(async () => {
      const res = await authorizeWorker({
        equipmentId,
        equipmentCode,
        employeeCardId: emp.cardId,
        employeeName: emp.name,
      })
      if (res.ok) {
        toast.success(`${emp.name} autorizovan`)
        setSelectedCardId('')
        load()
      } else {
        toast.error(res.error ?? 'Greška')
      }
    })
  }

  const handleRemove = (accessId: string, name: string) => {
    startTransition(async () => {
      await removeAuthorization(accessId)
      toast.success(`Dozvola uklonjena za ${name}`)
      load()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Access Control">
          <Shield className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Access Control — {equipmentCode}
          </DialogTitle>
          <DialogDescription>{equipmentName}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Toggle restricted access */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                {restricted ? <Lock className="h-4 w-4 text-red-600" /> : <Unlock className="h-4 w-4 text-emerald-600" />}
                <div>
                  <div className="text-sm font-medium">Ograničen pristup</div>
                  <div className="text-xs text-muted-foreground">
                    {restricted ? 'Samo autorizovani radnici mogu zadužiti' : 'Svi radnici mogu zadužiti'}
                  </div>
                </div>
              </div>
              <Switch checked={restricted} onCheckedChange={handleToggle} />
            </div>

            {restricted && (
              <>
                {/* Authorized workers list */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4" />
                    <Label>Autorizovani radnici ({workers.length})</Label>
                  </div>
                  {workers.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3 bg-muted/20 rounded text-center">
                      Nema autorizovanih radnika. Dodajte ispod.
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {workers.map((w) => (
                        <div key={w.id} className="flex items-center justify-between p-2 rounded border bg-card">
                          <div>
                            <div className="text-sm font-medium">{w.employeeName}</div>
                            <div className="text-xs text-muted-foreground font-mono">{w.employeeCardId}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemove(w.id, w.employeeName)}
                            disabled={isPending}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add worker */}
                <div className="space-y-2">
                  <Label>Dodaj radnika</Label>
                  <div className="flex gap-2">
                    <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Izaberite radnika..." />
                      </SelectTrigger>
                      <SelectContent>
                        {employees
                          .filter((e) => !workers.some((w) => w.employeeCardId === e.cardId))
                          .map((e) => (
                            <SelectItem key={e.id} value={e.cardId}>
                              {e.name} ({e.cardId})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAuthorize} disabled={isPending || !selectedCardId}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}

            {!restricted && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
                ✓ Ovo sredstvo mogu zadužiti svi radnici na platformi.
                Uključite "Ograničen pristup" da biste kontrolisali ko smije da ga zaduži.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Zatvori</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
