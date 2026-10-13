'use client'

// Tabela ispod kartica na stranici "Pregled": klik na karticu (Neispravno / Održavanje /
// Zaduženo / Otvorena oštećenja) prikazuje odgovarajuću listu, od najnovije ka najstarijoj, sa paginacijom.

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export type OverviewKind = 'oos' | 'maint' | 'assigned' | 'damages'

const PAGE_SIZE = 10
const SEV_LABEL: Record<string, string> = { MINOR: 'Manje', MAJOR: 'Veće', CRITICAL: 'Kritično' }
const SEV_RANK: Record<string, number> = { MINOR: 1, MAJOR: 2, CRITICAL: 3 }
const SEV_CLASS: Record<string, string> = {
  MINOR: 'bg-amber-100 text-amber-800', MAJOR: 'bg-orange-100 text-orange-800', CRITICAL: 'bg-red-100 text-red-800',
}
const DMG_STATUS: Record<string, string> = {
  OPEN: 'Otvoreno', IN_REPAIR: 'U popravci', AWAITING_APPROVAL: 'Čeka odobrenje', RESOLVED: 'Riješeno',
}
const TITLES: Record<OverviewKind, string> = {
  oos: 'Neispravna sredstva',
  maint: 'Sredstva na održavanju',
  assigned: 'Zadužena sredstva',
  damages: 'Sredstva sa otvorenim oštećenjima',
}

const fmt = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const ts = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : 0)

interface Eq { id: string; code: string; name: string; status: string; location?: string | null }
interface Dmg { id: string; equipmentId: string; equipmentCode: string; equipmentName: string; description: string; severity: string; status: string; reportedByName: string; createdAt: Date | string }
interface Asg { id: string; equipmentId: string; equipmentCode: string; equipmentName: string; employeeName: string; employeeCardId: string; timestamp: Date | string }

export function OverviewDetailTable({
  kind, equipment, damages, active, onClose, onOpenDamages,
}: {
  kind: OverviewKind
  equipment: Eq[]
  damages: Dmg[]
  active: Asg[]
  onClose: () => void
  onOpenDamages: () => void
}) {
  const [page, setPage] = useState(0)
  useEffect(() => { setPage(0) }, [kind])

  // otvorene prijave po sredstvu (najnovija prva)
  const byEquip = useMemo(() => {
    const m = new Map<string, Dmg[]>()
    for (const d of [...damages].sort((a, b) => ts(b.createdAt) - ts(a.createdAt))) {
      const list = m.get(d.equipmentId) ?? []
      list.push(d)
      m.set(d.equipmentId, list)
    }
    return m
  }, [damages])

  // Jedan red tabele = jedno sredstvo (ili jedna prijava), sa vremenom po kojem se sortira
  const rows = useMemo(() => {
    if (kind === 'damages') {
      return [...damages].sort((a, b) => ts(b.createdAt) - ts(a.createdAt)).map((d) => ({
        key: d.id, time: ts(d.createdAt),
        cells: [
          <CodeCell key="c" code={d.equipmentCode} name={d.equipmentName} />,
          <span key="d" className="text-sm">{d.description}</span>,
          <SevBadge key="s" sev={d.severity} />,
          <span key="st" className="text-xs">{DMG_STATUS[d.status] ?? d.status}</span>,
          <span key="p" className="text-xs">{d.reportedByName}</span>,
          <span key="t" className="text-xs whitespace-nowrap">{fmt(d.createdAt)}</span>,
        ],
      }))
    }
    if (kind === 'assigned') {
      const assignedIds = new Set(equipment.filter((e) => e.status === 'ASSIGNED').map((e) => e.id))
      return active.filter((a) => assignedIds.has(a.equipmentId)).sort((a, b) => ts(b.timestamp) - ts(a.timestamp)).map((a) => ({
        key: a.id, time: ts(a.timestamp),
        cells: [
          <CodeCell key="c" code={a.equipmentCode} name={a.equipmentName} />,
          <span key="w" className="text-sm">{a.employeeName} <span className="text-xs text-muted-foreground font-mono">({a.employeeCardId})</span></span>,
          <span key="t" className="text-xs whitespace-nowrap">{fmt(a.timestamp)}</span>,
          <Badge key="r" variant="outline" className="text-xs">još zaduženo</Badge>,
        ],
      }))
    }
    const status = kind === 'oos' ? 'OUT_OF_SERVICE' : 'MAINTENANCE'
    return equipment.filter((e) => e.status === status).map((e) => {
      const ds = byEquip.get(e.id) ?? []
      const top = ds.reduce<Dmg | null>((m, d) => (!m || (SEV_RANK[d.severity] ?? 0) > (SEV_RANK[m.severity] ?? 0) ? d : m), null)
      const latest = ds[0]
      return {
        key: e.id, time: latest ? ts(latest.createdAt) : 0,
        cells: [
          <CodeCell key="c" code={e.code} name={e.name} />,
          <span key="d" className="text-sm">{latest ? latest.description : <em className="text-muted-foreground">nema otvorene prijave</em>}{ds.length > 1 && <span className="text-xs text-muted-foreground"> (+{ds.length - 1})</span>}</span>,
          top ? <SevBadge key="s" sev={top.severity} /> : <span key="s">—</span>,
          <span key="st" className="text-xs">{latest ? (DMG_STATUS[latest.status] ?? latest.status) : '—'}</span>,
          <span key="p" className="text-xs">{latest?.reportedByName ?? '—'}</span>,
          <span key="t" className="text-xs whitespace-nowrap">{fmt(latest?.createdAt)}</span>,
        ],
      }
    }).sort((a, b) => b.time - a.time)
  }, [kind, equipment, damages, active, byEquip])

  const heads = kind === 'assigned'
    ? ['Sredstvo', 'Zadužio/la', 'Zaduženo (vrijeme)', 'Razduženo']
    : ['Sredstvo', kind === 'damages' ? 'Opis oštećenja' : 'Zadnja prijava kvara', 'Težina', 'Status prijave', 'Prijavio/la', 'Vrijeme prijave']

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const cur = Math.min(page, pages - 1)
  const slice = rows.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{TITLES[kind]} ({rows.length})</CardTitle>
        <div className="flex gap-2">
          {kind !== 'assigned' && (
            <Button size="sm" variant="outline" onClick={onOpenDamages}>Obradi prijave</Button>
          )}
          <Button size="sm" variant="ghost" aria-label="Zatvori tabelu" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nema sredstava u ovoj kategoriji.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>{heads.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {slice.map((r) => (
                    <TableRow key={r.key}>
                      {r.cells.map((c, i) => <TableCell key={i} className="align-top">{c}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between pt-3 text-sm">
              <span className="text-muted-foreground text-xs">
                {cur * PAGE_SIZE + 1}–{Math.min(rows.length, (cur + 1) * PAGE_SIZE)} od {rows.length} · najnovije prvo
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Prethodna strana"><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-xs">Strana {cur + 1} / {pages}</span>
                <Button size="sm" variant="outline" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Sljedeća strana"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function CodeCell({ code, name }: { code: string; name: string }) {
  return (
    <div className="min-w-[120px]">
      <Badge variant="outline" className="font-mono text-xs">{code}</Badge>
      <div className="text-xs text-muted-foreground mt-0.5">{name}</div>
    </div>
  )
}

function SevBadge({ sev }: { sev: string }) {
  return <Badge className={`text-xs ${SEV_CLASS[sev] ?? ''}`}>{SEV_LABEL[sev] ?? sev}</Badge>
}
