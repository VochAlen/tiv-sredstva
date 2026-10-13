'use client'

// Dnevni pregled ispravnosti opreme po službama - digitalna zamjena za
// papirne obrasce PRO.03.04.OBR1/OBR2. Prikazuje se na vrhu Pregled taba
// jer je to prva stvar koju šef smjene treba vidjeti ujutru: da li je
// svako sredstvo prošlo dnevni pregled prije nego što se pusti u rad.

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, FileDown, ClipboardList } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getDailyInspectionStatus, type DailyInspectionStatusRow } from '@/lib/actions-adr'
import { EQUIPMENT_TYPE_LABELS } from '@/lib/types'

const DEPARTMENTS: Array<{ id: string; label: string }> = [
  { id: 'TEHNICKA_SLUZBA', label: 'Tehnička služba' },
  { id: 'SLUZBA_PO', label: 'Služba zemaljskog opsluživanja (P/O)' },
]

export function DailyInspectionOverview() {
  const [rows, setRows] = useState<DailyInspectionStatusRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const today = new Date().toISOString().slice(0, 10)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getDailyInspectionStatus(today)
      setRows(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // Osvježi periodično tokom dana - lagan 2-minutni poll je dovoljan
    // (ovo nije real-time kritično kao oštećenja)
    const interval = setInterval(load, 120_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Dnevni pregled ispravnosti opreme - {new Date(today).toLocaleDateString('hr-HR')}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Svako sredstvo mora proći dnevni pregled na početku radnog dana prije nego što je prihvatljivo za rad.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && rows.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">Učitavanje...</div>
        ) : (
          DEPARTMENTS.map((dept) => {
            const deptRows = rows.filter((r) => (r.department ?? 'TEHNICKA_SLUZBA') === dept.id)
            const inspected = deptRows.filter((r) => r.inspection).length
            const unfit = deptRows.filter((r) => r.inspection?.result === 'UNFIT').length
            const total = deptRows.length
            const complete = total > 0 && inspected === total
            const isExpanded = expanded === dept.id

            return (
              <div key={dept.id} className="border rounded-lg overflow-hidden">
                <div
                  className={`flex items-center justify-between p-3 cursor-pointer ${complete ? 'bg-emerald-50' : 'bg-amber-50'}`}
                  onClick={() => setExpanded(isExpanded ? null : dept.id)}
                >
                  <div className="flex items-center gap-2">
                    {complete ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                    )}
                    <div>
                      <div className="text-sm font-semibold">{dept.label}</div>
                      <div className="text-xs text-muted-foreground">
                        Pregledano {inspected} / {total}
                        {unfit > 0 && <span className="text-red-700 font-medium"> · {unfit} neispravno</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                      {complete ? 'Kompletno' : `${total - inspected} preostalo`}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(`/api/reports/gse-daily-checklist?department=${dept.id}&date=${today}`, '_blank')
                      }}
                    >
                      <FileDown className="h-3.5 w-3.5 mr-1" />
                      Štampaj PDF
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-3 border-t space-y-1 max-h-72 overflow-y-auto">
                    {deptRows.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">Nema sredstava u ovoj službi</p>
                    ) : (
                      deptRows.map((r) => (
                        <div key={r.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/40 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="outline" className="font-mono text-xs flex-shrink-0">{r.code}</Badge>
                            <span className="truncate text-xs">{r.name}</span>
                            <span className="text-[10px] text-muted-foreground flex-shrink-0">
                              {EQUIPMENT_TYPE_LABELS[r.type as keyof typeof EQUIPMENT_TYPE_LABELS] ?? r.type}
                            </span>
                          </div>
                          {r.inspection ? (
                            <Badge
                              className={`text-xs flex-shrink-0 ${
                                r.inspection.result === 'FIT'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.inspection.result === 'UNFIT'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {r.inspection.result === 'FIT' ? (
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                              ) : (
                                <XCircle className="h-3 w-3 mr-1" />
                              )}
                              {r.inspection.result}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground flex-shrink-0">
                              Nije pregledano
                            </Badge>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
