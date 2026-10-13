'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Bird, Loader2, MapPin, User, Clock, Download, Plane } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs'
import {
  getFodReports, getFodStats, getWildlifeReports, getWildlifeStats,
} from '@/lib/actions-safety-reports'
import { FOD_ITEM_TYPE_LABELS } from '@/lib/constants-export'

export function FodWildlifeView() {
  const [tab, setTab] = useState('fod')
  const [fodReports, setFodReports] = useState<any[]>([])
  const [fodStats, setFodStats] = useState<any>(null)
  const [wildlifeReports, setWildlifeReports] = useState<any[]>([])
  const [wildlifeStats, setWildlifeStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [fr, fs, wr, ws] = await Promise.all([
        getFodReports(), getFodStats(), getWildlifeReports(), getWildlifeStats(),
      ])
      setFodReports(fr); setFodStats(fs); setWildlifeReports(wr); setWildlifeStats(ws)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><AlertTriangle className="h-5 w-5" />FOD & Wildlife</h2>
          <p className="text-sm text-muted-foreground">ADR.OPS.B.016 (strani predmeti) i ADR.OPS.B.020 (divlje životinje)</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.open('/api/reports/fod-wildlife', '_blank')}>
          <Download className="h-4 w-4 mr-1.5" />PDF izvještaj
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="fod"><AlertTriangle className="h-4 w-4 mr-1.5" />FOD {fodStats && <Badge variant="secondary" className="ml-1.5">{fodStats.total}</Badge>}</TabsTrigger>
          <TabsTrigger value="wildlife"><Bird className="h-4 w-4 mr-1.5" />Wildlife {wildlifeStats && <Badge variant="secondary" className="ml-1.5">{wildlifeStats.total}</Badge>}</TabsTrigger>
        </TabsList>

        <TabsContent value="fod" className="space-y-3 mt-3">
          {fodStats && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard label="Ukupno prijava" value={fodStats.total} tone="blue" />
              <StatCard label="Zadnjih 12mj" value={fodStats.last12m} tone="amber" />
              <div className="col-span-2 md:col-span-1 p-4 rounded-lg border bg-muted/20">
                <div className="text-xs font-medium mb-1.5">Najčešće lokacije (12mj)</div>
                {fodStats.byLocation?.length ? fodStats.byLocation.map((l: any) => (
                  <div key={l.location} className="text-xs flex justify-between"><span>{l.location}</span><span className="font-semibold">{l.count}</span></div>
                )) : <div className="text-xs text-muted-foreground">Nema podataka</div>}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : fodReports.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Nema prijavljenih FOD nalaza.</p></CardContent></Card>
          ) : (
            <div className="space-y-2">
              {fodReports.map((f) => (
                <Card key={f.id} className="p-3 border-l-4 border-l-amber-500">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="secondary" className="text-xs">{FOD_ITEM_TYPE_LABELS[f.itemType] || f.itemType}</Badge>
                        {f.aircraftPartSuspected && <Badge className="bg-red-100 text-red-800 text-xs"><Plane className="h-3 w-3 mr-0.5" />Sumnja — dio aviona</Badge>}
                        {f.removed && <Badge className="bg-emerald-100 text-emerald-800 text-xs">Uklonjeno</Badge>}
                      </div>
                      <div className="text-sm">{f.description}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{f.location}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(f.foundAt).toLocaleString('hr-HR')}</span>
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{f.foundByName}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="wildlife" className="space-y-3 mt-3">
          {wildlifeStats && (
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Ukupno opažanja" value={wildlifeStats.total} tone="blue" />
              <StatCard label="Sudari" value={wildlifeStats.strikes} tone="red" />
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : wildlifeReports.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><Bird className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Nema prijavljenih opažanja.</p></CardContent></Card>
          ) : (
            <div className="space-y-2">
              {wildlifeReports.map((w) => (
                <Card key={w.id} className={'p-3 border-l-4 ' + (w.strike ? 'border-l-red-500' : 'border-l-emerald-500')}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="secondary" className="text-xs">{w.species} × {w.count}</Badge>
                        {w.strike && <Badge className="bg-red-100 text-red-800 text-xs">Sudar</Badge>}
                      </div>
                      {w.actionTaken && <div className="text-sm">{w.actionTaken}</div>}
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{w.location}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(w.observedAt).toLocaleString('hr-HR')}</span>
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{w.reportedByName}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatCard({ label, value, tone }: any) {
  const colors: any = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900', red: 'bg-red-50 border-red-200 text-red-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
  }
  return <div className={'p-4 rounded-lg border ' + colors[tone]}><div className="text-2xl font-bold">{value}</div><div className="text-xs mt-0.5">{label}</div></div>
}
