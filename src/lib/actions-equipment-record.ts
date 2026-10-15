'use server'

// Karton sredstva (kompletna evidencija jednog sredstva za inspekciju / audit): identitet, servisni plan, svi kvarovi sa tokom radionice,
// redovni servisi, radni nalozi PM, održavanje, CRS, dnevni pregledi, očitanja brojila, utrošeni dijelovi, ponavljajući kvarovi.

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { loadPlanRows } from '@/lib/service-plan-data'
import { PROGRAM_SHORT, KIND_LABEL, STATUS_LABEL } from '@/lib/service-plan'
import { findRepeats, type RepeatGroup } from '@/lib/repeat-defects'
import { parseRestrictions } from '@/lib/checklist-evaluation'

const iso = (v: unknown): string | null => { if (!v) return null; const d = new Date(v as string); return Number.isFinite(d.getTime()) ? d.toISOString() : null }
const numOrNull = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
const partsText = (raw: unknown): string | null => {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(v) && v.length ? v.map((p: any) => `${p.name} x${p.qty}`).join(', ') : null
  } catch { return null }
}
const failedLabels = (raw: unknown): string[] => {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(v) ? v.map((x: any) => String(x?.label ?? x?.id ?? '')).filter(Boolean) : []
  } catch { return [] }
}

export interface RecordDamage {
  id: string
  createdAt: string
  reportedBy: string
  severity: string
  category: string | null
  sourceItem: string | null
  status: string
  description: string
  restriction: string | null
  acknowledgedAt: string | null; acknowledgedBy: string | null
  workshopArrivedAt: string | null; workshopArrivedBy: string | null
  externalProvider: string | null; externalRef: string | null; externalSentAt: string | null; externalReturnedAt: string | null
  repairedAt: string | null; repairedBy: string | null
  resolution: string | null
  parts: string | null; workers: string | null; workHours: number | null; workCost: number | null
  chiefName: string | null; chiefInspectedAt: string | null; chiefResult: string | null; chiefNote: string | null
  testDone: boolean | null; testNote: string | null
  approvedBy: string | null; approvedAt: string | null
  handoverTo: string | null; handoverAt: string | null
  log: Array<{ at: string; kind: string; text: string | null; by: string }>
}

export interface EquipmentRecord {
  generatedAt: string
  equipment: {
    id: string; code: string; name: string; type: string; serialNumber: string | null; manufacturer: string | null; modelYear: number | null
    registrationNumber: string | null; purchaseDate: string | null; warrantyExpiry: string | null; location: string; department: string | null; status: string
    restrictions: string[]; fuelType: string | null; totalKm: number; totalHours: number
    externallyMaintained: boolean; serviceProvider: string | null; serviceProviderPhone: string | null
  }
  service: { programText: string; statusText: string; summary: string; plannedDate: string | null; lastDate: string | null; lastKm: number | null; lastHours: number | null } | null
  damages: RecordDamage[]
  serviceRecords: Array<{ performedAt: string; kind: string | null; by: string; provider: string | null; invoiceNo: string | null; km: number | null; hours: number | null; cost: number | null; notes: string | null }>
  pmOrders: Array<{ no: string; kind: string; status: string; issuedAt: string; completedAt: string | null; serviceable: boolean | null; leadMechanic: string | null }>
  maintenance: Array<{ performedAt: string; type: string; description: string; performedBy: string | null; cost: number | null; status: string }>
  crs: Array<{ crsNumber: string; releaseDate: string; certifier: string; work: string; status: string }>
  inspections: { days: number; total: number; fit: number; conditional: number; unfit: number; recent: Array<{ at: string; shift: string | null; inspector: string; result: string; failed: string[] }> }
  meters: Array<{ at: string; km: number | null; hours: number | null; by: string }>
  partsUsed: Array<{ at: string; name: string; qty: number; cost: number | null; by: string | null }>
  repeats: RepeatGroup[]
}

export async function getEquipmentRecord(code: string): Promise<EquipmentRecord | null> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  if (user.role !== 'engineer' && user.role !== 'admin') throw new Error('Nemate dozvolu. Potrebna rola: engineer')
  const cleanCode = String(code ?? '').trim().slice(0, 60)
  if (!cleanCode) return null
  const since365 = new Date(Date.now() - 365 * 86_400_000)

  let eq: EquipmentRecord['equipment']
  let damages: RecordDamage[] = []
  let maintenance: EquipmentRecord['maintenance'] = []
  let crs: EquipmentRecord['crs'] = []
  let insp: Array<{ at: Date; shift: string | null; inspector: string; result: string; failed: string[] }> = []
  let meters: EquipmentRecord['meters'] = []
  let partsUsed: EquipmentRecord['partsUsed'] = []

  if (isDemoMode()) {
    const e = await db.equipment.findUnique({ where: { code: cleanCode } })
    if (!e) return null
    eq = {
      id: e.id, code: e.code, name: e.name, type: e.type, serialNumber: e.serialNumber, manufacturer: e.manufacturer, modelYear: e.modelYear,
      registrationNumber: e.registrationNumber, purchaseDate: iso(e.purchaseDate), warrantyExpiry: iso(e.warrantyExpiry), location: e.location, department: e.department, status: e.status,
      restrictions: parseRestrictions(e.activeRestrictions).map((r) => r.label), fuelType: e.fuelType, totalKm: e.totalKm ?? 0, totalHours: e.totalOperatingHours ?? 0,
      externallyMaintained: e.externallyMaintained, serviceProvider: e.serviceProvider, serviceProviderPhone: e.serviceProviderPhone,
    }
    const [dm, mn, cr, ins, mt, pu] = await Promise.all([
      db.damageReport.findMany({ where: { equipmentId: e.id }, orderBy: { createdAt: 'desc' }, take: 60, include: { statusLog: { orderBy: { at: 'asc' } } } }),
      db.maintenanceLog.findMany({ where: { equipmentId: e.id }, orderBy: { performedAt: 'desc' }, take: 40 }),
      db.certificateOfRelease.findMany({ where: { equipmentId: e.id }, orderBy: { releaseDate: 'desc' }, take: 20 }),
      db.dailyInspection.findMany({ where: { equipmentId: e.id, inspectionDate: { gte: since365 } }, orderBy: { inspectionDate: 'desc' }, take: 1000 }),
      db.meterReading.findMany({ where: { equipmentId: e.id }, orderBy: { at: 'desc' }, take: 10 }),
      db.partConsumption.findMany({ where: { equipmentId: e.id }, orderBy: { consumedAt: 'desc' }, take: 30 }),
    ])
    damages = dm.map((d) => ({
      id: d.id, createdAt: d.createdAt.toISOString(), reportedBy: d.reportedByName, severity: d.severity, category: d.category, sourceItem: d.sourceItem, status: d.status, description: d.description, restriction: d.restrictionLabel,
      acknowledgedAt: iso(d.acknowledgedAt), acknowledgedBy: d.acknowledgedBy, workshopArrivedAt: iso(d.workshopArrivedAt), workshopArrivedBy: d.workshopArrivedBy,
      externalProvider: d.externalProvider, externalRef: d.externalRef, externalSentAt: iso(d.externalSentAt), externalReturnedAt: iso(d.externalReturnedAt),
      repairedAt: iso(d.repairedAt), repairedBy: d.repairedByName, resolution: d.resolution, parts: partsText(d.partsJson), workers: d.workerNames, workHours: d.workHours, workCost: d.workCost,
      chiefName: d.chiefName, chiefInspectedAt: iso(d.chiefInspectedAt), chiefResult: d.chiefResult, chiefNote: d.chiefNote, testDone: d.testDone, testNote: d.testNote,
      approvedBy: d.approvedByName, approvedAt: iso(d.approvedAt), handoverTo: d.handoverTo, handoverAt: iso(d.handoverAt),
      log: d.statusLog.map((l) => ({ at: l.at.toISOString(), kind: l.kind, text: l.text, by: l.byName })),
    }))
    maintenance = mn.map((m) => ({ performedAt: m.performedAt.toISOString(), type: m.maintenanceType, description: m.description, performedBy: m.performedBy, cost: m.cost, status: m.status }))
    crs = cr.map((c) => ({ crsNumber: c.crsNumber, releaseDate: c.releaseDate.toISOString(), certifier: c.certifierName, work: c.workDescription, status: c.status }))
    insp = ins.map((i) => ({ at: i.inspectionDate, shift: i.shift, inspector: i.inspectorName, result: i.result ?? 'FIT', failed: failedLabels(i.issuesJson) }))
    meters = mt.map((m) => ({ at: m.at.toISOString(), km: m.km, hours: m.hours, by: m.byName }))
    partsUsed = pu.map((p) => ({ at: p.consumedAt.toISOString(), name: p.partName, qty: p.quantity, cost: p.totalCost, by: p.consumedBy }))
  } else {
    const sb = await createSupabaseClient()
    const { data: e } = await sb.from('equipment').select('*').eq('code', cleanCode).maybeSingle()
    if (!e) return null
    eq = {
      id: e.id, code: e.code, name: e.name, type: e.type, serialNumber: e.serial_number ?? null, manufacturer: e.manufacturer ?? null, modelYear: numOrNull(e.model_year),
      registrationNumber: e.registration_number ?? null, purchaseDate: iso(e.purchase_date), warrantyExpiry: iso(e.warranty_expiry), location: e.location, department: e.department ?? null, status: e.status,
      restrictions: (Array.isArray(e.active_restrictions) ? e.active_restrictions : parseRestrictions(typeof e.active_restrictions === 'string' ? e.active_restrictions : null)).map((r: any) => String(r.label ?? r.code)),
      fuelType: e.fuel_type ?? null, totalKm: Number(e.total_km ?? 0), totalHours: Number(e.total_operating_hours ?? 0),
      externallyMaintained: !!e.externally_maintained, serviceProvider: e.service_provider ?? null, serviceProviderPhone: e.service_provider_phone ?? null,
    }
    const [dm, mn, cr, ins, mt, pu] = await Promise.all([
      sb.from('damage_reports').select('*').eq('equipment_id', e.id).order('created_at', { ascending: false }).limit(60),
      sb.from('maintenance_log').select('performed_at,maintenance_type,description,performed_by,cost,status').eq('equipment_id', e.id).order('performed_at', { ascending: false }).limit(40),
      sb.from('certificates_of_release').select('crs_number,release_date,certifier_name,work_description,status').eq('equipment_id', e.id).order('release_date', { ascending: false }).limit(20),
      sb.from('daily_inspections').select('inspection_date,shift,inspector_name,result,issues_json').eq('equipment_id', e.id).gte('inspection_date', since365.toISOString()).order('inspection_date', { ascending: false }).limit(1000),
      sb.from('meter_readings').select('at,km,hours,by_name').eq('equipment_id', e.id).order('at', { ascending: false }).limit(10),
      sb.from('part_consumption').select('consumed_at,part_name,quantity,total_cost,consumed_by').eq('equipment_id', e.id).order('consumed_at', { ascending: false }).limit(30),
    ])
    const dmRows = dm.data ?? []
    const logsByDamage = new Map<string, RecordDamage['log']>()
    if (dmRows.length) {
      const { data: logs } = await sb.from('repair_status_log').select('damage_id,at,kind,text,by_name').in('damage_id', dmRows.map((d: any) => d.id)).order('at', { ascending: true }).limit(2000)
      for (const l of logs ?? []) { const a = logsByDamage.get(l.damage_id) ?? []; a.push({ at: new Date(l.at).toISOString(), kind: l.kind, text: l.text, by: l.by_name }); logsByDamage.set(l.damage_id, a) }
    }
    damages = dmRows.map((d: any) => ({
      id: d.id, createdAt: new Date(d.created_at).toISOString(), reportedBy: d.reported_by_name, severity: d.severity, category: d.category ?? null, sourceItem: d.source_item ?? null, status: d.status, description: d.description, restriction: d.restriction_label ?? null,
      acknowledgedAt: iso(d.acknowledged_at), acknowledgedBy: d.acknowledged_by ?? null, workshopArrivedAt: iso(d.workshop_arrived_at), workshopArrivedBy: d.workshop_arrived_by ?? null,
      externalProvider: d.external_provider ?? null, externalRef: d.external_ref ?? null, externalSentAt: iso(d.external_sent_at), externalReturnedAt: iso(d.external_returned_at),
      repairedAt: iso(d.repaired_at), repairedBy: d.repaired_by_name ?? null, resolution: d.resolution ?? null, parts: partsText(d.parts_json), workers: d.worker_names ?? null, workHours: numOrNull(d.work_hours), workCost: numOrNull(d.work_cost),
      chiefName: d.chief_name ?? null, chiefInspectedAt: iso(d.chief_inspected_at), chiefResult: d.chief_result ?? null, chiefNote: d.chief_note ?? null, testDone: d.test_done ?? null, testNote: d.test_note ?? null,
      approvedBy: d.approved_by_name ?? null, approvedAt: iso(d.approved_at), handoverTo: d.handover_to ?? null, handoverAt: iso(d.handover_at),
      log: logsByDamage.get(d.id) ?? [],
    }))
    maintenance = (mn.data ?? []).map((m: any) => ({ performedAt: new Date(m.performed_at).toISOString(), type: m.maintenance_type, description: m.description, performedBy: m.performed_by ?? null, cost: numOrNull(m.cost), status: m.status }))
    crs = (cr.data ?? []).map((c: any) => ({ crsNumber: c.crs_number, releaseDate: new Date(c.release_date).toISOString(), certifier: c.certifier_name, work: c.work_description, status: c.status }))
    insp = (ins.data ?? []).map((i: any) => ({ at: new Date(i.inspection_date), shift: i.shift ?? null, inspector: i.inspector_name, result: i.result, failed: failedLabels(i.issues_json) }))
    meters = (mt.data ?? []).map((m: any) => ({ at: new Date(m.at).toISOString(), km: numOrNull(m.km), hours: numOrNull(m.hours), by: m.by_name }))
    partsUsed = (pu.data ?? []).map((p: any) => ({ at: new Date(p.consumed_at).toISOString(), name: p.part_name, qty: Number(p.quantity ?? 0), cost: numOrNull(p.total_cost), by: p.consumed_by ?? null }))
  }

  // Servisni plan (isti proračun kao stranica "Servisni plan") + istorija servisa + PM nalozi
  let service: EquipmentRecord['service'] = null
  let serviceRecords: EquipmentRecord['serviceRecords'] = []
  let pmOrders: EquipmentRecord['pmOrders'] = []
  try {
    const rows = await loadPlanRows(isDemoMode() ? null : await createSupabaseClient())
    const r = rows.find((x) => x.id === eq.id)
    if (r) {
      service = {
        programText: `${PROGRAM_SHORT[r.program]}${r.external ? ' · eksterni servis' : ''}`,
        statusText: STATUS_LABEL[r.result.status], summary: r.result.summary, plannedDate: r.result.plannedDate,
        lastDate: r.lastDate, lastKm: r.lastKm, lastHours: r.lastHours,
      }
      if (r.result.kind) service.summary = `${KIND_LABEL[r.result.kind]}: ${r.result.summary}`
    }
  } catch { /* servisni plan nije konfigurisan (migracije 032-034) */ }
  try {
    const { getServiceHistory } = await import('@/lib/actions-service-plan')
    serviceRecords = (await getServiceHistory(eq.id)).slice(0, 25).map((s) => ({ performedAt: s.performedAt, kind: s.kind, by: s.performedBy === 'EXTERNAL' ? 'Eksterni' : 'Interni', provider: s.provider, invoiceNo: s.invoiceNo, km: s.km, hours: s.hours, cost: s.cost, notes: s.notes }))
  } catch { /* nema istorije */ }
  try {
    const { listPmWorkOrders } = await import('@/lib/actions-pm')
    pmOrders = (await listPmWorkOrders(eq.id)).map((o) => ({ no: o.no, kind: o.kind, status: o.status, issuedAt: o.issuedAt, completedAt: o.completedAt, serviceable: o.serviceable, leadMechanic: o.leadMechanic }))
  } catch { /* nema PM naloga */ }

  const count = (r: string) => insp.filter((i) => i.result === r).length
  const repeats = findRepeats(damages.map((d) => ({ id: d.id, equipmentId: eq.id, equipmentCode: eq.code, equipmentName: eq.name, category: d.category, sourceItem: d.sourceItem, description: d.description, createdAt: d.createdAt, status: d.status })))

  return {
    generatedAt: new Date().toISOString(),
    equipment: eq, service, damages, serviceRecords, pmOrders, maintenance, crs,
    inspections: { days: 365, total: insp.length, fit: count('FIT'), conditional: count('CONDITIONAL'), unfit: count('UNFIT'), recent: insp.filter((i) => i.result !== 'FIT').slice(0, 12).map((i) => ({ at: i.at.toISOString(), shift: i.shift, inspector: i.inspector, result: i.result, failed: i.failed })) },
    meters, partsUsed, repeats,
  }
}

