'use client'

// Karton sredstva u aplikaciji (klik na sredstvo na stranici "Oprema"): sve što auditor / aviokompanija traži na jednom mjestu.
// Isti podaci kao PDF "Karton sredstva" (jedan poziv: getEquipmentRecord); PDF-ovi ostaju dostupni dugmadima u zaglavlju.

import { useEffect, useState } from 'react'
import { FileDown, Loader2, Repeat } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { getEquipmentRecord, type EquipmentRecord, type RecordDamage } from '@/lib/actions-equipment-record'
import { EQUIPMENT_TYPE_LABELS, STATUS_LABELS, STATUS_COLORS, type EquipmentStatus } from '@/lib/types'
import { REPEAT_ADVICE } from '@/lib/repeat-defects'
import { fmtDT } from '@/lib/workshop'

const d = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString('hr-HR', { timeZone: 'Europe/Podgorica' }) : '—')
const num = (v: number | null | undefined, unit = '') => (v == null ? '—' : `${Math.round(v * 10) / 10}${unit}`)
const SEV: Record<string, string> = { MINOR: 'Manje', MAJOR: 'Veće', CRITICAL: 'Kritično' }
const DMG_STATUS: Record<string, string> = { OPEN: 'Otvoreno', IN_REPAIR: 'U popravci', AWAITING_APPROVAL: 'Čeka pregled šefa', RESOLVED: 'Riješeno' }
const CAT: Record<string, string> = { MEHANIKA: 'Mehanika', ELEKTRIKA: 'Elektrika', HIDRAULIKA: 'Hidraulika', BEZBJEDNOST: 'Bezbjednost', OPSTE: 'Opšte' }
const MNT_TYPE: Record<string, string> = { PREVENTIVE: 'Preventivno', CORRECTIVE: 'Korektivno', INSPECTION: 'Inspekcija', OVERHAUL: 'Remont' }
const INSP: Record<string, string> = { FIT: 'Ispravno', CONDITIONAL: 'Sa ograničenjem', UNFIT: 'Neispravno' }

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 border-b py-1.5 text-sm last:border-0">
      <dt className="w-40 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium">{value || '—'}</dd>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'red' | 'green' | 'amber' }) {
  const cls = tone === 'red' ? 'text-red-700' : tone === 'green' ? 'text-emerald-700' : tone === 'amber' ? 'text-amber-700' : ''
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

function SimpleTable({ head, rows }: { head: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>{head.map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="px-2 py-1.5 align-top">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DamageBlock({ dm }: { dm: RecordDamage }) {
  const steps: Array<[string, string]> = []
  if (dm.acknowledgedAt) steps.push(['Preuzeto', `${fmtDT(dm.acknowledgedAt)} — ${dm.acknowledgedBy ?? '—'}`])
  if (dm.externalSentAt) steps.push(['Vanjski servis', `${dm.externalProvider ?? '—'}${dm.externalRef ? ` (nalog ${dm.externalRef})` : ''}, poslano ${fmtDT(dm.externalSentAt)}${dm.externalReturnedAt ? `, vraćeno ${fmtDT(dm.externalReturnedAt)}` : ''}`])
  if (dm.workshopArrivedAt) steps.push(['U radionici', `${fmtDT(dm.workshopArrivedAt)} — dovezao/la: ${dm.workshopArrivedBy ?? '—'}`])
  if (dm.repairedAt) steps.push(['Popravka završena', `${fmtDT(dm.repairedAt)} — ${dm.repairedBy ?? '—'}`])
  if (dm.chiefInspectedAt) steps.push(['Pregled šefa službe', `${dm.chiefName ?? '—'}, ${fmtDT(dm.chiefInspectedAt)} — ${dm.chiefResult === 'OK' ? 'PROŠAO' : 'NIJE PROŠAO'}${dm.chiefNote ? ` (${dm.chiefNote})` : ''}`])
  if (dm.testDone) steps.push(['Probni rad / test', `zadovoljava${dm.testNote ? ` — ${dm.testNote}` : ''}`])
  if (dm.approvedAt) steps.push(['Pušteno u rad', `${fmtDT(dm.approvedAt)} — ${dm.approvedBy ?? '—'}`])
  if (dm.handoverAt) steps.push(['Preuzeto iz radionice', `${fmtDT(dm.handoverAt)} — ${dm.handoverTo ?? '—'}`])
  const wo = [dm.parts && `Dijelovi: ${dm.parts}`, dm.workers && `Radio/la: ${dm.workers}`, dm.workHours != null && `Sati: ${dm.workHours}`, dm.workCost != null && `Trošak: ${dm.workCost} €`].filter(Boolean).join(' · ')
  const statuses = dm.log.filter((l) => l.kind === 'STATUS')
  return (
    <div className={`rounded-lg border p-3 ${dm.status === 'RESOLVED' ? '' : 'border-red-300 bg-red-50/40'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold tabular-nums">{fmtDT(dm.createdAt)}</span>
        <Badge variant="outline" className="text-xs">{SEV[dm.severity] ?? dm.severity}</Badge>
        {dm.category && <Badge variant="outline" className="text-xs">{CAT[dm.category] ?? dm.category}</Badge>}
        <Badge className={`ml-auto text-xs ${dm.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{DMG_STATUS[dm.status] ?? dm.status}</Badge>
      </div>
      <p className="mt-1 text-sm">{dm.description}{dm.restriction ? <span className="text-orange-700"> [Ograničenje: {dm.restriction}]</span> : null}</p>
      <div className="text-xs text-muted-foreground">Prijavio/la: {dm.reportedBy}</div>
      {steps.length > 0 && (
        <dl className="mt-2 space-y-0.5 border-l-2 border-primary/30 pl-3 text-sm">
          {steps.map(([k, v]) => (<div key={k} className="flex gap-2"><dt className="w-40 shrink-0 text-muted-foreground">{k}</dt><dd className="min-w-0 flex-1">{v}</dd></div>))}
        </dl>
      )}
      {dm.resolution && <p className="mt-2 rounded bg-emerald-50 p-1.5 text-sm text-emerald-900"><strong>Šta je urađeno:</strong> {dm.resolution}</p>}
      {wo && <p className="mt-1 text-sm"><strong>Radni nalog:</strong> {wo}</p>}
      {statuses.length > 0 && (
        <details className="mt-1 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Statusi popravke ({statuses.length})</summary>
          <ul className="mt-1 space-y-0.5">{statuses.map((l, i) => <li key={i}>{fmtDT(l.at)} — {l.text} ({l.by})</li>)}</ul>
        </details>
      )}
    </div>
  )
}

export function EquipmentRecordDialog({ code, onClose }: { code: string | null; onClose: () => void }) {
  const [rec, setRec] = useState<EquipmentRecord | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!code) { setRec(null); return }
    let alive = true
    setLoading(true); setRec(null)
    getEquipmentRecord(code)
      .then((r) => { if (!alive) return; if (!r) toast.error('Karton nije pronađen'); setRec(r) })
      .catch((e) => { if (alive) toast.error(`Karton nije učitan: ${e?.message ?? e}`) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [code])

  const eq = rec?.equipment
  const open = rec ? rec.damages.filter((x) => x.status !== 'RESOLVED').length : 0
  return (
    <Dialog open={!!code} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{code}</span>
            {eq && <span className="font-normal">{eq.name}</span>}
            {eq && <Badge className={`text-xs ${STATUS_COLORS[eq.status as EquipmentStatus] ?? ''}`}>{STATUS_LABELS[eq.status as EquipmentStatus] ?? eq.status}</Badge>}
          </DialogTitle>
          <DialogDescription>Karton sredstva — kompletna evidencija za inspekciju i audit</DialogDescription>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" className="h-10" disabled={!code} onClick={() => window.open(`/api/reports/karton-sredstva?code=${encodeURIComponent(code ?? '')}`, '_blank')}>
              <FileDown className="mr-1.5 h-4 w-4" />Puni karton (PDF)
            </Button>
            <Button size="sm" variant="outline" className="h-10" disabled={!code} onClick={() => window.open(`/api/reports/gse-equipment-card?code=${encodeURIComponent(code ?? '')}`, '_blank')}>
              <FileDown className="mr-1.5 h-4 w-4" />Karton ispravnosti (PDF, 30 dana)
            </Button>
          </div>
        </DialogHeader>

        {loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
        {rec && eq && (
          <Tabs defaultValue="overview">
            <TabsList className="h-auto w-full flex-wrap justify-start">
              <TabsTrigger value="overview" className="h-10">Pregled</TabsTrigger>
              <TabsTrigger value="damages" className="h-10">Kvarovi i popravke ({rec.damages.length})</TabsTrigger>
              <TabsTrigger value="service" className="h-10">Servisi i održavanje</TabsTrigger>
              <TabsTrigger value="inspections" className="h-10">Dnevni pregledi</TabsTrigger>
              <TabsTrigger value="meters" className="h-10">Brojila i dijelovi</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-3">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Kpi label="Kvarova ukupno" value={rec.damages.length} />
                <Kpi label="Otvoreno" value={open} tone={open ? 'red' : 'green'} />
                <Kpi label="Pregleda (12 mj.)" value={rec.inspections.total} />
                <Kpi label="Neispravno / sa ogr." value={`${rec.inspections.unfit} / ${rec.inspections.conditional}`} tone={rec.inspections.unfit ? 'red' : 'amber'} />
              </div>
              {rec.repeats.length > 0 && (
                <div role="alert" className="rounded-lg border-2 border-orange-400 bg-orange-50 p-2.5 text-sm text-orange-950">
                  <div className="flex items-center gap-2 font-semibold"><Repeat className="h-4 w-4" />Ponavljajući kvarovi (3+ u 90 dana)</div>
                  <ul className="mt-1 list-disc pl-5">{rec.repeats.map((g) => <li key={g.kind + g.key}>{g.label}: {g.count}× ({d(g.firstAt)} – {d(g.lastAt)}){g.hasOpen ? ' — ima otvorenih' : ''}</li>)}</ul>
                  <p className="mt-1 text-xs">{REPEAT_ADVICE}</p>
                </div>
              )}
              <div className="grid gap-x-6 md:grid-cols-2">
                <dl>
                  <KV label="Tip" value={(EQUIPMENT_TYPE_LABELS as Record<string, string>)[eq.type] ?? eq.type} />
                  <KV label="Serijski broj" value={eq.serialNumber} />
                  <KV label="Proizvođač" value={eq.manufacturer} />
                  <KV label="Godina proizvodnje" value={eq.modelYear} />
                  <KV label="Registracija" value={eq.registrationNumber} />
                  <KV label="Datum nabavke" value={eq.purchaseDate ? d(eq.purchaseDate) : null} />
                </dl>
                <dl>
                  <KV label="Garancija do" value={eq.warrantyExpiry ? `${d(eq.warrantyExpiry)} ${new Date(eq.warrantyExpiry).getTime() >= Date.now() ? '(važi)' : '(istekla)'}` : null} />
                  <KV label="Lokacija" value={eq.location} />
                  <KV label="Služba" value={eq.department === 'SLUZBA_PO' ? 'Služba zemaljskog opsluživanja' : 'Tehnička služba'} />
                  <KV label="Brojač / radni sati" value={`${num(eq.totalKm, ' km')} · ${num(eq.totalHours, ' h')}`} />
                  <KV label="Održavanje" value={eq.externallyMaintained ? `Eksterni: ${eq.serviceProvider ?? '—'}${eq.serviceProviderPhone ? `, ${eq.serviceProviderPhone}` : ''}` : 'Interni (radionica)'} />
                  <KV label="Aktivna ograničenja" value={eq.restrictions.length ? eq.restrictions.join('; ') : 'nema'} />
                </dl>
              </div>
              <div className="rounded-lg border p-2.5">
                <div className="mb-1 text-sm font-semibold">Servisni plan</div>
                {rec.service ? (
                  <div className="text-sm">
                    <div><strong>{rec.service.programText}</strong> — {rec.service.statusText}</div>
                    <div className="text-muted-foreground">{rec.service.summary}</div>
                    <div className="text-xs text-muted-foreground">Zadnji servis: {d(rec.service.lastDate)} ({num(rec.service.lastKm, ' km')}, {num(rec.service.lastHours, ' h')}) · sljedeći (procjena): {d(rec.service.plannedDate)}</div>
                  </div>
                ) : <p className="text-sm text-muted-foreground">Servisni plan nije konfigurisan za ovo sredstvo.</p>}
              </div>
            </TabsContent>

            <TabsContent value="damages" className="space-y-2">
              {rec.damages.length === 0 ? <Empty>Nema evidentiranih kvarova.</Empty> : rec.damages.map((dm) => <DamageBlock key={dm.id} dm={dm} />)}
            </TabsContent>

            <TabsContent value="service" className="space-y-4">
              <section>
                <h3 className="mb-1 text-sm font-semibold">Redovni servisi ({rec.serviceRecords.length})</h3>
                {rec.serviceRecords.length === 0 ? <Empty>Nema upisanih redovnih servisa.</Empty> : (
                  <SimpleTable head={['Datum', 'Vrsta', 'Izveo', 'Serviser / račun', 'Km', 'Sati', 'Trošak', 'Napomena']}
                    rows={rec.serviceRecords.map((s) => [d(s.performedAt), s.kind === 'MAJOR' ? 'Major' : s.kind === 'MINOR' ? 'Minor' : '—', s.by, [s.provider, s.invoiceNo].filter(Boolean).join(' / ') || '—', num(s.km), num(s.hours), s.cost != null ? `${s.cost} €` : '—', s.notes ?? ''])} />
                )}
              </section>
              <section>
                <h3 className="mb-1 text-sm font-semibold">Radni nalozi preventivnog održavanja ({rec.pmOrders.length})</h3>
                {rec.pmOrders.length === 0 ? <Empty>Nema radnih naloga.</Empty> : (
                  <SimpleTable head={['Broj naloga', 'Vrsta', 'Izdat', 'Završen', 'Status', 'Ispravno', 'Mehaničar']}
                    rows={rec.pmOrders.map((o) => [o.no, o.kind === 'MAJOR' ? 'Major' : 'Minor', d(o.issuedAt), d(o.completedAt), o.status === 'DONE' ? 'Završen' : 'Otvoren', o.serviceable == null ? '—' : o.serviceable ? 'DA' : 'NE', o.leadMechanic ?? '—'])} />
                )}
              </section>
              <section>
                <h3 className="mb-1 text-sm font-semibold">Evidencija održavanja ({rec.maintenance.length})</h3>
                {rec.maintenance.length === 0 ? <Empty>Nema zapisa o održavanju.</Empty> : (
                  <SimpleTable head={['Datum', 'Tip', 'Opis', 'Izveo/la', 'Trošak']}
                    rows={rec.maintenance.map((m) => [d(m.performedAt), MNT_TYPE[m.type] ?? m.type, m.description, m.performedBy ?? '—', m.cost != null ? `${m.cost} €` : '—'])} />
                )}
              </section>
              <section>
                <h3 className="mb-1 text-sm font-semibold">Certificate of Release to Service ({rec.crs.length})</h3>
                {rec.crs.length === 0 ? <Empty>Nema izdatih CRS.</Empty> : (
                  <SimpleTable head={['CRS broj', 'Datum', 'Ovlaštena osoba', 'Radovi', 'Status']}
                    rows={rec.crs.map((r) => [r.crsNumber, d(r.releaseDate), r.certifier, r.work, r.status])} />
                )}
              </section>
            </TabsContent>

            <TabsContent value="inspections" className="space-y-3">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Kpi label="Ukupno (12 mj.)" value={rec.inspections.total} />
                <Kpi label="Ispravno" value={rec.inspections.fit} tone="green" />
                <Kpi label="Sa ograničenjem" value={rec.inspections.conditional} tone="amber" />
                <Kpi label="Neispravno" value={rec.inspections.unfit} tone={rec.inspections.unfit ? 'red' : undefined} />
              </div>
              <h3 className="text-sm font-semibold">Pregledi sa nalazom (zadnjih {rec.inspections.recent.length})</h3>
              {rec.inspections.recent.length === 0 ? <Empty>Nema pregleda sa nalazom u zadnjih 12 mjeseci.</Empty> : (
                <SimpleTable head={['Datum / vrijeme', 'Pregledao/la', 'Rezultat', 'Neispravne stavke']}
                  rows={rec.inspections.recent.map((i) => [fmtDT(i.at), i.inspector, INSP[i.result] ?? i.result, i.failed.join('; ') || '—'])} />
              )}
            </TabsContent>

            <TabsContent value="meters" className="space-y-4">
              <section>
                <h3 className="mb-1 text-sm font-semibold">Očitanja brojila (pri razduženju)</h3>
                {rec.meters.length === 0 ? <Empty>Nema upisanih očitanja.</Empty> : (
                  <SimpleTable head={['Datum / vrijeme', 'Km', 'Radni sati', 'Upisao/la']} rows={rec.meters.map((m) => [fmtDT(m.at), num(m.km), num(m.hours), m.by])} />
                )}
              </section>
              <section>
                <h3 className="mb-1 text-sm font-semibold">Utrošeni rezervni dijelovi</h3>
                {rec.partsUsed.length === 0 ? <Empty>Nema evidentiranog utroška dijelova.</Empty> : (
                  <SimpleTable head={['Datum', 'Dio', 'Količina', 'Trošak', 'Uzeo/la']} rows={rec.partsUsed.map((p) => [d(p.at), p.name, p.qty, p.cost != null ? `${Math.round(p.cost * 100) / 100} €` : '—', p.by ?? '—'])} />
                )}
              </section>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
