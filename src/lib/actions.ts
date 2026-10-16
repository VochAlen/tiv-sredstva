'use server'

// Server Actions za GSE Control
// Dual-mode: Prisma (Demo Mode) ili Supabase (Production)
// Sve mutacije provjeravaju auth i role

import { db } from '@/lib/db'
import { wasInspectedToday, NOT_INSPECTED_MSG } from '@/lib/inspection-gate'
import { logRepairEvent } from '@/lib/workshop-log'
import { revalidatePath } from 'next/cache'
import { notifyExternalFault } from '@/lib/service-notify'
import { after } from 'next/server'
import { sendWebhookNotification } from '@/lib/webhook-notify'
import { createServiceClient, hasServiceClient } from '@/lib/supabase/service'
import { getChecklistForType, type ChecklistItem, type InspectionResult } from '@/lib/types'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from "@/lib/supabase/server"
import { checkMaintenanceSkill } from '@/lib/actions-maintenance-skills'
import { createMaintenanceLog } from '@/lib/actions-advanced'

// =====================================================
// AUTH HELPERS
// =====================================================

async function requireAuth(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Morate biti ulogovani za ovu akciju')
  }
  return user
}

async function requireRole(roles: Array<'operator' | 'engineer' | 'admin'>): Promise<AppUser> {
  const user = await requireAuth()
  if (!roles.includes(user.role)) {
    throw new Error(`Nemate dozvolu za ovu akciju. Potrebna rola: ${roles.join(' ili ')}`)
  }
  return user
}

// =====================================================
// SUPABASE FALLBACK HELPERS
// Koriste se kada je isDemoMode() === false
// =====================================================

// Konverzija između snake_case (Supabase) i camelCase (Prisma) tipova
type SupabaseEquipment = {
  id: string
  code: string
  name: string
  type: string
  serial_number: string | null
  location: string
  status: string
  notes: string | null
  department?: string | null
  active_restrictions?: unknown
}

// =====================================================
// QUERY FUNCTIONS (read)
// =====================================================

export async function getAllEquipment() {
  await requireAuth()

  if (isDemoMode()) {
    return db.equipment.findMany({
      orderBy: [{ status: 'asc' }, { code: 'asc' }],
      include: {
        _count: {
          select: {
            damages: { where: { status: { not: 'RESOLVED' } } },
          },
        },
      },
    })
  }

  // Supabase
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .order('status', { ascending: true })
    .order('code', { ascending: true })

  if (error) throw error

  // Za svaki equipment dohvati count otvorenih damages
  const equipmentIds = (data ?? []).map((e: SupabaseEquipment) => e.id)
  let damagesCount: Record<string, number> = {}
  if (equipmentIds.length > 0) {
    const { data: damages } = await supabase
      .from('damage_reports')
      .select('equipment_id')
      .neq('status', 'RESOLVED')
      .in('equipment_id', equipmentIds)
    damagesCount = (damages ?? []).reduce((acc: Record<string, number>, d: { equipment_id: string }) => {
      acc[d.equipment_id] = (acc[d.equipment_id] ?? 0) + 1
      return acc
    }, {})
  }

  return (data ?? []).map((e: SupabaseEquipment) => ({
    id: e.id,
    code: e.code,
    name: e.name,
    type: e.type,
    serialNumber: e.serial_number,
    location: e.location,
    status: e.status,
    notes: e.notes,
    department: e.department ?? null,
    activeRestrictions: typeof e.active_restrictions === 'string' ? e.active_restrictions : e.active_restrictions ? JSON.stringify(e.active_restrictions) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { damages: damagesCount[e.id] ?? 0 },
  }))
}

export async function getEquipmentByCode(code: string) {
  // Javna funkcija - može se zvati i iz Worker view-a prije auth
  // ali će akcije koje slijede provjeravati auth

  if (isDemoMode()) {
    const e = await db.equipment.findUnique({
      where: { code },
      include: {
        assignments: {
          orderBy: { timestamp: 'desc' },
          take: 10,
        },
        damages: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    })
    return e ? {
      ...e,
      inspectedToday: await wasInspectedToday(e.id),
      meter: meterInfo({ km: e.totalKm, hours: e.totalOperatingHours, intervalKm: e.serviceIntervalKm, majorKm: e.majorIntervalKm, intervalHours: e.serviceIntervalHours, majorHours: e.majorIntervalHours, program: e.serviceProgram }),
    } : null
  }

  const supabase = await createSupabaseClient()
  const { data: equipment, error } = await supabase
    .from('equipment')
    .select('*')
    .eq('code', code)
    .single()

  if (error || !equipment) return null

  const eq = equipment as SupabaseEquipment

  const [assignmentsRes, damagesRes] = await Promise.all([
    supabase
      .from('assignments')
      .select('*')
      .eq('equipment_id', eq.id)
      .order('timestamp', { ascending: false })
      .limit(10),
    supabase
      .from('damage_reports')
      .select('*')
      .eq('equipment_id', eq.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const inspectedToday = await wasInspectedToday(eq.id)

  return {
    inspectedToday,
    meter: meterInfo({
      km: (eq as any).total_km, hours: (eq as any).total_operating_hours, intervalKm: (eq as any).service_interval_km, majorKm: (eq as any).major_interval_km,
      intervalHours: (eq as any).service_interval_hours, majorHours: (eq as any).major_interval_hours, program: (eq as any).service_program,
    }),
    id: eq.id,
    code: eq.code,
    name: eq.name,
    type: eq.type,
    serialNumber: eq.serial_number,
    location: eq.location,
    status: eq.status,
    notes: eq.notes,
    activeRestrictions: typeof (eq as any).active_restrictions === 'string' ? (eq as any).active_restrictions : (eq as any).active_restrictions ? JSON.stringify((eq as any).active_restrictions) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignments: (assignmentsRes.data ?? []).map((a: any) => ({
      id: a.id,
      equipmentId: a.equipment_id,
      equipmentCode: a.equipment_code,
      equipmentName: a.equipment_name,
      employeeId: a.employee_id,
      employeeCardId: a.employee_card_id,
      employeeName: a.employee_name,
      action: a.action,
      inspectionResult: a.inspection_result,
      inspectionNotes: a.inspection_notes,
      checklistJson: a.checklist_json,
      shift: a.shift,
      damageReportId: a.damage_report_id,
      timestamp: new Date(a.timestamp),
    })),
    damages: (damagesRes.data ?? []).map((d: any) => ({
      id: d.id,
      equipmentId: d.equipment_id,
      equipmentCode: d.equipment_code,
      equipmentName: d.equipment_name,
      reportedByCardId: d.reported_by_card_id,
      reportedByName: d.reported_by_name,
      employeeId: d.employee_id,
      severity: d.severity,
      description: d.description,
      status: d.status,
      resolution: d.resolution,
      resolvedAt: d.resolved_at ? new Date(d.resolved_at) : null,
      createdAt: new Date(d.created_at),
      updatedAt: new Date(d.updated_at),
    })),
  }
}

export async function getActiveAssignments() {
  await requireAuth()

  if (isDemoMode()) {
    const recent = await db.assignment.findMany({
      where: { damageReportId: null },
      orderBy: { timestamp: 'desc' },
      take: 200,
      include: { equipment: true },
    })
    const byEquip = new Map<string, typeof recent[number]>()
    for (const a of recent) {
      if (!byEquip.has(a.equipmentId)) byEquip.set(a.equipmentId, a)
    }
    return Array.from(byEquip.values())
      .filter((a) => a.action === 'CHECK_OUT')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  // Supabase - zadnja akcija po equipmentu je CHECK_OUT i bez damage
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .is('damage_report_id', null)
    .order('timestamp', { ascending: false })
    .limit(200)

  if (error) throw error

  const byEquip = new Map<string, any>()
  for (const a of data ?? []) {
    if (!byEquip.has(a.equipment_id)) byEquip.set(a.equipment_id, a)
  }
  return Array.from(byEquip.values())
    .filter((a: any) => a.action === 'CHECK_OUT')
    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map((a: any) => ({
      id: a.id,
      equipmentId: a.equipment_id,
      equipmentCode: a.equipment_code,
      equipmentName: a.equipment_name,
      employeeId: a.employee_id,
      employeeCardId: a.employee_card_id,
      employeeName: a.employee_name,
      action: a.action,
      inspectionResult: a.inspection_result,
      inspectionNotes: a.inspection_notes,
      checklistJson: a.checklist_json,
      shift: a.shift,
      damageReportId: a.damage_report_id,
      timestamp: new Date(a.timestamp),
    }))
}

export async function getRecentActivity(limit = 50) {
  await requireAuth()

  if (isDemoMode()) {
    return db.assignment.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    })
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data ?? []).map((a: any) => ({
    id: a.id,
    equipmentId: a.equipment_id,
    equipmentCode: a.equipment_code,
    equipmentName: a.equipment_name,
    employeeId: a.employee_id,
    employeeCardId: a.employee_card_id,
    employeeName: a.employee_name,
    action: a.action,
    inspectionResult: a.inspection_result,
    inspectionNotes: a.inspection_notes,
    checklistJson: a.checklist_json,
    shift: a.shift,
    damageReportId: a.damage_report_id,
    timestamp: new Date(a.timestamp),
  }))
}

/** Koja brojila se prate za servisni plan (radnik ih upisuje pri razduženju): km ako postoji km interval, sati osim kod OEM programa bez sati. */
function meterInfo(i: { km?: number | null; hours?: number | null; intervalKm?: number | null; majorKm?: number | null; intervalHours?: number | null; majorHours?: number | null; program?: string | null }) {
  const trackKm = !!(Number(i.intervalKm) > 0 || Number(i.majorKm) > 0)
  const trackHours = i.program !== 'OEM' || !!(Number(i.intervalHours) > 0 || Number(i.majorHours) > 0)
  return { km: Number(i.km ?? 0), hours: Number(i.hours ?? 0), trackKm, trackHours }
}

function mapDamageRow(d: any) {
  return {
    id: d.id,
    equipmentId: d.equipment_id,
    equipmentCode: d.equipment_code,
    equipmentName: d.equipment_name,
    reportedByCardId: d.reported_by_card_id,
    reportedByName: d.reported_by_name,
    employeeId: d.employee_id,
    severity: d.severity,
    description: d.description,
    status: d.status,
    resolution: d.resolution,
    resolvedAt: d.resolved_at ? new Date(d.resolved_at) : null,
    createdAt: new Date(d.created_at),
    updatedAt: new Date(d.updated_at),
    category: d.category ?? null,
    acknowledgedAt: d.acknowledged_at ? new Date(d.acknowledged_at) : null,
    acknowledgedBy: d.acknowledged_by ?? null,
    repairedByCardId: d.repaired_by_card_id ?? null,
    repairedByName: d.repaired_by_name ?? null,
    repairedAt: d.repaired_at ? new Date(d.repaired_at) : null,
    approvedByCardId: d.approved_by_card_id ?? null,
    approvedByName: d.approved_by_name ?? null,
    approvedAt: d.approved_at ? new Date(d.approved_at) : null,
    restrictionCode: d.restriction_code ?? null,
    restrictionLabel: d.restriction_label ?? null,
    sourceItem: d.source_item ?? null,
    partsJson: d.parts_json ? (typeof d.parts_json === 'string' ? d.parts_json : JSON.stringify(d.parts_json)) : null,
    workHours: d.work_hours != null ? Number(d.work_hours) : null,
    workCost: d.work_cost != null ? Number(d.work_cost) : null,
    workerNames: d.worker_names ?? null,
    workshopArrivedAt: d.workshop_arrived_at ? new Date(d.workshop_arrived_at) : null,
    workshopArrivedBy: d.workshop_arrived_by ?? null,
    chiefName: d.chief_name ?? null,
    chiefInspectedAt: d.chief_inspected_at ? new Date(d.chief_inspected_at) : null,
    chiefResult: d.chief_result ?? null,
    chiefNote: d.chief_note ?? null,
    handoverTo: d.handover_to ?? null,
    handoverAt: d.handover_at ? new Date(d.handover_at) : null,
    lastStatusText: d.last_status_text ?? null,
    lastStatusAt: d.last_status_at ? new Date(d.last_status_at) : null,
    lastStatusBy: d.last_status_by ?? null,
    waitingPartUntil: d.waiting_part_until ? new Date(d.waiting_part_until) : null,
    testDone: d.test_done ?? null,
    testNote: d.test_note ?? null,
    testAt: d.test_at ? new Date(d.test_at) : null,
    testBy: d.test_by ?? null,
    externalProvider: d.external_provider ?? null,
    externalRef: d.external_ref ?? null,
    externalSentAt: d.external_sent_at ? new Date(d.external_sent_at) : null,
    externalExpectedAt: d.external_expected_at ? new Date(d.external_expected_at) : null,
    externalReturnedAt: d.external_returned_at ? new Date(d.external_returned_at) : null,
    equipment: d.equipment
      ? {
          id: d.equipment.id,
          code: d.equipment.code,
          name: d.equipment.name,
          type: d.equipment.type,
          serialNumber: d.equipment.serial_number,
          location: d.equipment.location,
          status: d.equipment.status,
          notes: d.equipment.notes,
          department: d.equipment.department ?? null,
          warrantyExpiry: d.equipment.warranty_expiry ? new Date(d.equipment.warranty_expiry) : null,
          serviceProvider: d.equipment.service_provider ?? null,
          serviceProviderPhone: d.equipment.service_provider_phone ?? null,
          externallyMaintained: !!d.equipment.externally_maintained,
        }
      : null,
  }
}

export async function getOpenDamages() {
  await requireAuth()

  if (isDemoMode()) {
    return db.damageReport.findMany({
      where: { status: { not: 'RESOLVED' } },
      orderBy: { createdAt: 'desc' },
      include: { equipment: true },
    })
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('damage_reports')
    .select('*, equipment:equipment(*)')
    .neq('status', 'RESOLVED')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map(mapDamageRow)
}

export async function getAllDamages() {
  await requireAuth()

  if (isDemoMode()) {
    return db.damageReport.findMany({
      orderBy: { createdAt: 'desc' },
      include: { equipment: true },
    })
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase
    .from('damage_reports')
    .select('*, equipment:equipment(*)')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map(mapDamageRow)
}

// =====================================================
// MUTATION: CHECK-OUT (zaduživanje)
// =====================================================

// Kategorija i fotografije uz prijavu kvara. Best-effort: ako ovo ne uspije,
// prijava kvara (i blokada sredstva) ostaje — to je važnije od slike.
// Slike dolaze sa telefona već smanjene (JPEG data URL); ovdje se samo
// strogo provjerava oblik i veličina jer je tok javan (bez logina).
const MAX_DAMAGE_PHOTOS = 2
const MAX_PHOTO_CHARS = 400_000 // ~300 KB binarno
const VALID_DAMAGE_CATEGORIES = ['MEHANIKA', 'ELEKTRIKA', 'HIDRAULIKA', 'BEZBJEDNOST', 'OPSTE']

async function saveDamageExtras(
  damageId: string,
  equipmentId: string,
  category: string | undefined,
  photos: string[] | undefined,
  cardId: string,
  name: string,
  info?: { code: string; severity: string; description: string },
) {
  // Obavještenje radionici — poslije odgovora (after), da radnik ne čeka na Slack/Teams
  if (info) {
    const sev = info.severity === 'CRITICAL' ? 'KRITIČNO' : info.severity === 'MAJOR' ? 'veće' : 'manje'
    const msg = `GSE Control — novi kvar (${sev}): ${info.code} — ${info.description.slice(0, 200)} (prijavio/la: ${name})`
    try {
      after(() => sendWebhookNotification('triggerNewDamage', msg, { equipmentCode: info.code, severity: info.severity }))
      after(() => notifyExternalFault({ equipmentId, code: info.code, source: 'DAMAGE', severity: info.severity, description: info.description, reporter: name }))
    } catch {
      /* after() nedostupan van request konteksta — obavještenje se preskače */
    }
  }
  try {
    const cat = category && VALID_DAMAGE_CATEGORIES.includes(category) ? category : null
    const okPhotos = (photos ?? [])
      .filter((p) => typeof p === 'string' && p.startsWith('data:image/jpeg;base64,') && p.length <= MAX_PHOTO_CHARS)
      .slice(0, MAX_DAMAGE_PHOTOS)

    if (isDemoMode()) {
      if (cat) await db.damageReport.update({ where: { id: damageId }, data: { category: cat } })
      for (const photoData of okPhotos) {
        await db.equipmentPhoto.create({
          data: { damageReportId: damageId, equipmentId, photoData, photoType: 'image/jpeg', takenByCardId: cardId, takenByName: name },
        })
      }
      return
    }
    // Worker tok je anoniman, a RLS na equipment_photos traži prijavljenog korisnika
    // (is_authenticated()). Zato upis ide preko service-role klijenta — na serveru, nakon
    // stroge provjere oblika i veličine iznad. Bez ključa pokušava korisnički klijent.
    const supabase = hasServiceClient() ? createServiceClient() : await createSupabaseClient()
    if (cat) {
      const { error } = await supabase.from('damage_reports').update({ category: cat }).eq('id', damageId)
      if (error) console.error('damage category update failed:', error.message)
    }
    for (const photoData of okPhotos) {
      const { error } = await supabase.from('equipment_photos').insert({
        damage_report_id: damageId, equipment_id: equipmentId, photo_data: photoData,
        photo_type: 'image/jpeg', taken_by_card_id: cardId, taken_by_name: name,
      })
      if (error) console.error('damage photo insert failed:', error.message)
    }
  } catch (e) {
    console.error('saveDamageExtras failed (ignored):', e)
  }
}

export async function checkOutEquipment(params: {
  equipmentCode: string
  employeeCardId: string
  employeeName: string
  checklist: ChecklistItem[]
  inspectionResult: InspectionResult
  inspectionNotes?: string
  shift?: string
  damageDescription?: string
  damageSeverity?: 'MINOR' | 'MAJOR' | 'CRITICAL'
  damageCategory?: string
  damagePhotos?: string[]
  firstUseConfirmed?: boolean
}) {
  // checkOut je JAVNA akcija - radnici se identifikuju preko PIN-a/ID kartice
  // (ne zahtijeva auth login)

  const {
    equipmentCode,
    employeeCardId,
    employeeName,
    checklist,
    inspectionResult,
    inspectionNotes,
    shift,
    damageDescription,
    damageSeverity = 'MINOR',
    damageCategory,
    damagePhotos,
  } = params

  // Samo pregledano sredstvo (dnevni pregled danas urađen) smije se zadužiti - važi i za Demo i za Supabase
  const gateEquipmentId = isDemoMode()
    ? (await db.equipment.findUnique({ where: { code: equipmentCode }, select: { id: true } }))?.id ?? null
    : await getEquipmentIdByCode(equipmentCode)
  if (gateEquipmentId && !(await wasInspectedToday(gateEquipmentId))) {
    return { ok: false, error: NOT_INSPECTED_MSG, notInspected: true, damageReportId: null as string | null, assignmentId: undefined as string | undefined }
  }

  if (isDemoMode()) {
    return checkOutPrisma(params)
  }

  // Supabase: anonimni radnik NE smije pisati direktno u tabele (RLS, migracija 016).
  // Sve ide kroz SECURITY DEFINER funkciju koja atomično provjerava pravila (dozvola vozača,
  // kvalifikacija, semafor) i upisuje zaduženje, kvar i status sredstva.
  const supabase = await createSupabaseClient()
  const rpcArgs: Record<string, unknown> = {
    p_equipment_code: equipmentCode,
    p_employee_card_id: employeeCardId,
    p_employee_name: employeeName,
    p_checklist: checklist,
    p_inspection_notes: inspectionNotes ?? null,
    p_shift: shift ?? null,
    p_damage_description: damageDescription ?? null,
    p_damage_severity: damageSeverity,
  }
  // Šalje se samo kad je true, da radi i sa starijom verzijom funkcije (bez ovog parametra)
  if (params.firstUseConfirmed) rpcArgs.p_first_use_confirmed = true

  const { data, error } = await supabase.rpc('fn_check_out_equipment', rpcArgs)
  if (error) {
    console.error('fn_check_out_equipment failed:', error)
    const missing = error.code === 'PGRST202' || /function .* does not exist|Could not find the function/i.test(error.message)
    return {
      ok: false,
      error: missing
        ? 'Baza nije ažurirana (nedostaje funkcija za zaduživanje). Obavijestite administratora.'
        : 'Greška pri bilježenju zaduženja u bazi',
    }
  }

  const res = (data ?? {}) as {
    ok?: boolean; error?: string; damageReportId?: string; assignmentId?: string
    semaforResult?: string; restrictions?: unknown; needsFirstUseConfirmation?: boolean
  }

  let damageReportId: string | null = res.damageReportId ?? null

  // Kvar nađen u checklisti: funkcija ga je već upisala. Dopuni kategoriju/slike i obavijesti radionicu.
  if (damageReportId) {
    await saveDamageExtras(damageReportId, (await getEquipmentIdByCode(equipmentCode)) ?? '', damageCategory, damagePhotos, employeeCardId, employeeName, {
      code: equipmentCode, severity: damageSeverity, description: damageDescription ?? 'Kvar utvrđen na pre-use checklisti',
    })
  } else if (inspectionResult !== 'OK' && damageDescription && (res.ok || res.semaforResult)) {
    // Radnik je prijavio oštećenje koje checklista ne obuhvata (npr. samo ograničenje):
    // funkcija ga ne bilježi, pa se upisuje ovdje (server-side, service-role).
    damageReportId = await createFreeFormDamage({
      equipmentCode, employeeCardId, employeeName, severity: damageSeverity,
      description: damageDescription, category: damageCategory, photos: damagePhotos,
    })
  }

  revalidatePath('/')
  return {
    ok: !!res.ok,
    error: res.error,
    damageReportId,
    assignmentId: res.assignmentId,
    semaforResult: res.semaforResult,
    restrictions: res.restrictions,
    needsFirstUseConfirmation: !!res.needsFirstUseConfirmation,
  }
}

async function getEquipmentIdByCode(code: string): Promise<string | null> {
  try {
    const supabase = hasServiceClient() ? createServiceClient() : await createSupabaseClient()
    const { data } = await supabase.from('equipment').select('id').eq('code', code).maybeSingle()
    return data?.id ?? null
  } catch {
    return null
  }
}

// Prijava oštećenja izvan checkliste (server-side, service-role). Best-effort.
async function createFreeFormDamage(p: {
  equipmentCode: string; employeeCardId: string; employeeName: string
  severity: string; description: string; category?: string; photos?: string[]
}): Promise<string | null> {
  if (!hasServiceClient()) {
    console.error('createFreeFormDamage: SUPABASE_SERVICE_ROLE_KEY nije postavljen')
    return null
  }
  try {
    const supabase = createServiceClient()
    const { data: eq } = await supabase.from('equipment').select('id,code,name').eq('code', p.equipmentCode).maybeSingle()
    if (!eq) return null
    const { data: dr, error } = await supabase.from('damage_reports').insert({
      equipment_id: eq.id, equipment_code: eq.code, equipment_name: eq.name,
      reported_by_card_id: p.employeeCardId.trim().toUpperCase(), reported_by_name: p.employeeName,
      severity: p.severity, description: p.description, status: 'OPEN',
    }).select('id').single()
    if (error || !dr) {
      console.error('createFreeFormDamage failed:', error?.message)
      return null
    }
    await saveDamageExtras(dr.id, eq.id, p.category, p.photos, p.employeeCardId, p.employeeName, {
      code: eq.code, severity: p.severity, description: p.description,
    })
    return dr.id
  } catch (e) {
    console.error('createFreeFormDamage failed:', e)
    return null
  }
}

// Prijava kvara bez zaduživanja (javna akcija, radnik se identifikuje ID karticom). Koristi se kad radnik na
// sredstvu uoči kvar, a sredstvo nije pregledano ili ga ne želi preuzeti. Veći/kritičan kvar stavlja sredstvo van upotrebe.
export async function reportEquipmentFault(p: {
  equipmentCode: string
  employeeCardId: string
  employeeName: string
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL'
  description: string
  category?: string
  photos?: string[]
}): Promise<{ ok: boolean; error?: string; damageReportId?: string | null }> {
  const card = (p.employeeCardId ?? '').trim().toUpperCase()
  let name = (p.employeeName ?? '').trim().slice(0, 120)
  const description = (p.description ?? '').trim().slice(0, 1000)
  if (!card || !name) return { ok: false, error: 'Unesite broj ID kartice i ime' }
  if (!description) return { ok: false, error: 'Dodajte sliku, izaberite kategoriju ili upišite kratak opis kvara' }
  const severity = p.severity === 'CRITICAL' || p.severity === 'MAJOR' ? p.severity : 'MINOR'
  const blocking = severity !== 'MINOR'
  const UNKNOWN_CARD = 'ID kartica nije pronađena u evidenciji aktivnih radnika. Provjerite broj kartice ili se obratite administratoru.'

  if (isDemoMode()) {
    // Prijavu može poslati samo aktivan radnik iz evidencije; ime se uzima iz evidencije, ne od klijenta
    const emp = await db.employee.findUnique({ where: { cardId: card } })
    if (!emp || !emp.active) return { ok: false, error: UNKNOWN_CARD }
    name = emp.name
    const eq = await db.equipment.findUnique({ where: { code: p.equipmentCode } })
    if (!eq) return { ok: false, error: 'Sredstvo nije pronađeno' }
    const dr = await db.damageReport.create({
      data: { equipmentId: eq.id, equipmentCode: eq.code, equipmentName: eq.name, reportedByCardId: card, reportedByName: name, severity, description, status: 'OPEN' },
    })
    await saveDamageExtras(dr.id, eq.id, p.category, p.photos, card, name, { code: eq.code, severity, description })
    if (blocking && eq.status !== 'ASSIGNED') {
      await db.equipment.update({ where: { id: eq.id }, data: { status: 'OUT_OF_SERVICE', notes: `Kvar prijavljen ${new Date().toISOString().slice(0, 10)} od ${name}: ${description.slice(0, 100)}` } })
    }
    revalidatePath('/')
    return { ok: true, damageReportId: dr.id }
  }

  if (!hasServiceClient()) return { ok: false, error: 'Prijava kvara trenutno nije dostupna (server nije podešen). Obavijestite administratora.' }
  const sb = createServiceClient()
  const { data: emp } = await sb.from('employees').select('name, active').eq('card_id', card).maybeSingle()
  if (!emp || emp.active === false) return { ok: false, error: UNKNOWN_CARD }
  name = emp.name || name
  const { data: eq } = await sb.from('equipment').select('id, code, status').eq('code', p.equipmentCode).maybeSingle()
  if (!eq) return { ok: false, error: 'Sredstvo nije pronađeno' }
  const id = await createFreeFormDamage({ equipmentCode: eq.code, employeeCardId: card, employeeName: name, severity, description, category: p.category, photos: p.photos })
  if (!id) return { ok: false, error: 'Kvar nije upisan. Pokušajte ponovo ili obavijestite održavanje.' }
  if (blocking && eq.status !== 'ASSIGNED') {
    await sb.from('equipment').update({ status: 'OUT_OF_SERVICE', notes: `Kvar prijavljen ${new Date().toISOString().slice(0, 10)} od ${name}: ${description.slice(0, 100)}` }).eq('id', eq.id)
  }
  revalidatePath('/')
  return { ok: true, damageReportId: id }
}

// Prisma fallback za Demo Mode
async function checkOutPrisma(params: {
  equipmentCode: string
  employeeCardId: string
  employeeName: string
  checklist: ChecklistItem[]
  inspectionResult: InspectionResult
  inspectionNotes?: string
  shift?: string
  damageDescription?: string
  damageSeverity?: 'MINOR' | 'MAJOR' | 'CRITICAL'
  damageCategory?: string
  damagePhotos?: string[]
}) {
  const {
    equipmentCode,
    employeeCardId,
    employeeName,
    checklist,
    inspectionResult,
    inspectionNotes,
    shift,
    damageDescription,
    damageSeverity = 'MINOR',
    damageCategory,
    damagePhotos,
  } = params

  const equipment = await db.equipment.findUnique({ where: { code: equipmentCode } })
  if (!equipment) {
    return { ok: false, error: 'Sredstvo nije pronađeno' }
  }

  if (equipment.status === 'OUT_OF_SERVICE' || equipment.status === 'MAINTENANCE') {
    return {
      ok: false,
      error: `Sredstvo je trenutno u statusu: ${equipment.status}. Zaduživanje nije moguće.`,
    }
  }

  // Access Control - provjeri da li radnik ima dozvolu
  if (equipment.restrictedAccess) {
    const { checkEquipmentAccess } = await import('./actions-access')
    const accessResult = await checkEquipmentAccess(equipment.id, employeeCardId)
    if (!accessResult.allowed) {
      return { ok: false, error: accessResult.reason ?? 'Nemate dozvolu za ovo sredstvo' }
    }
  }

  // ADR.OPS.C.005 - Provjeri Driver Authorization
  const { checkDriverAuthorization } = await import('./actions-driver-auth')
  const driverAuth = await checkDriverAuthorization(employeeCardId)
  if (!driverAuth.authorized) {
    return { ok: false, error: driverAuth.reason ?? 'Nemate važeću airside vozačku dozvolu' }
  }

  const employee = await db.employee.upsert({
    where: { cardId: employeeCardId },
    update: { name: employeeName },
    create: { cardId: employeeCardId, name: employeeName },
  })

  let damageReportId: string | null = null
  if (inspectionResult !== 'OK' && damageDescription) {
    const dr = await db.damageReport.create({
      data: {
        equipmentId: equipment.id,
        equipmentCode: equipment.code,
        equipmentName: equipment.name,
        reportedByCardId: employeeCardId,
        reportedByName: employeeName,
        employeeId: employee.id,
        severity: damageSeverity,
        description: damageDescription,
        status: 'OPEN',
      },
    })
    damageReportId = dr.id
    await saveDamageExtras(dr.id, equipment.id, damageCategory, damagePhotos, employeeCardId, employeeName, { code: equipment.code, severity: damageSeverity, description: damageDescription ?? '' })

    await db.equipment.update({
      where: { id: equipment.id },
      data: {
        status: 'OUT_OF_SERVICE',
        notes: `Oštećenje prijavljeno ${new Date().toISOString().slice(0, 10)} od ${employeeName}: ${damageDescription.slice(0, 100)}`,
      },
    })

    const blockedAssignment = await db.assignment.create({
      data: {
        equipmentId: equipment.id,
        equipmentCode: equipment.code,
        equipmentName: equipment.name,
        employeeId: employee.id,
        employeeCardId: employee.cardId,
        employeeName: employee.name,
        action: 'CHECK_OUT',
        inspectionResult,
        inspectionNotes: inspectionNotes ?? null,
        checklistJson: JSON.stringify(checklist),
        shift: shift ?? null,
        damageReportId,
      },
    })

    revalidatePath('/')
    return {
      ok: false,
      error: 'Sredstvo ne može biti zaduženo zbog oštećenja. Status promijenjen u OUT_OF_SERVICE.',
      damageReportId,
      assignmentId: blockedAssignment.id,
    }
  }

  await db.equipment.update({
    where: { id: equipment.id },
    data: { status: 'ASSIGNED' },
  })

  const createdAssignment = await db.assignment.create({
    data: {
      equipmentId: equipment.id,
      equipmentCode: equipment.code,
      equipmentName: equipment.name,
      employeeId: employee.id,
      employeeCardId: employee.cardId,
      employeeName: employee.name,
      action: 'CHECK_OUT',
      inspectionResult,
      inspectionNotes: inspectionNotes ?? null,
      checklistJson: JSON.stringify(checklist),
      shift: shift ?? null,
      damageReportId,
    },
  })

  revalidatePath('/')
  return { ok: true, damageReportId, assignmentId: createdAssignment.id }
}

// =====================================================
// MUTATION: CHECK-IN (razduživanje)
// =====================================================

export async function checkInEquipment(params: {
  equipmentCode: string
  employeeCardId: string
  employeeName: string
  notes?: string
  foundDamage?: string
  damageSeverity?: 'MINOR' | 'MAJOR' | 'CRITICAL'
  damageCategory?: string
  damagePhotos?: string[]
}) {
  // checkIn je JAVNA akcija - radnici se identifikuju preko PIN-a/ID kartice

  if (isDemoMode()) {
    return checkInPrisma(params)
  }

  const { equipmentCode, employeeCardId, employeeName, notes, foundDamage, damageSeverity = 'MINOR', damageCategory, damagePhotos } = params

  // Anonimni radnik ne piše direktno u tabele (RLS) — sve ide kroz SECURITY DEFINER funkciju.
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.rpc('fn_check_in_equipment', {
    p_equipment_code: equipmentCode,
    p_employee_card_id: employeeCardId,
    p_employee_name: employeeName,
    p_notes: notes ?? null,
    p_found_damage: foundDamage && foundDamage.trim() ? foundDamage.trim() : null,
    p_damage_severity: damageSeverity,
  })
  if (error) {
    console.error('fn_check_in_equipment failed:', error)
    const missing = error.code === 'PGRST202' || /Could not find the function/i.test(error.message)
    return {
      ok: false,
      error: missing
        ? 'Baza nije ažurirana (nedostaje funkcija za razduživanje). Obavijestite administratora.'
        : 'Greška pri bilježenju razduživanja u bazi',
    }
  }
  const res = (data ?? {}) as { ok?: boolean; error?: string; damageReportId?: string }
  if (res.ok && res.damageReportId) {
    await saveDamageExtras(res.damageReportId, (await getEquipmentIdByCode(equipmentCode)) ?? '', damageCategory, damagePhotos, employeeCardId, employeeName, {
      code: equipmentCode, severity: damageSeverity, description: foundDamage ?? '',
    })
  }
  revalidatePath('/')
  return { ok: !!res.ok, error: res.error, damageReportId: res.damageReportId ?? null }
}

async function checkInPrisma(params: {
  equipmentCode: string
  employeeCardId: string
  employeeName: string
  notes?: string
  foundDamage?: string
  damageSeverity?: 'MINOR' | 'MAJOR' | 'CRITICAL'
  damageCategory?: string
  damagePhotos?: string[]
}) {
  const { equipmentCode, employeeCardId, employeeName, notes, foundDamage, damageSeverity = 'MINOR', damageCategory, damagePhotos } = params

  const equipment = await db.equipment.findUnique({ where: { code: equipmentCode } })
  if (!equipment) return { ok: false, error: 'Sredstvo nije pronađeno' }
  if (equipment.status === 'AVAILABLE') {
    return { ok: false, error: 'Ovo sredstvo je već razduženo.' }
  }

  const employee = await db.employee.upsert({
    where: { cardId: employeeCardId },
    update: { name: employeeName },
    create: { cardId: employeeCardId, name: employeeName },
  })

  let damageReportId: string | null = null
  let inspectionResult: InspectionResult = 'OK'

  if (foundDamage && foundDamage.trim().length > 0) {
    const dr = await db.damageReport.create({
      data: {
        equipmentId: equipment.id,
        equipmentCode: equipment.code,
        equipmentName: equipment.name,
        reportedByCardId: employeeCardId,
        reportedByName: employeeName,
        employeeId: employee.id,
        severity: damageSeverity,
        description: foundDamage,
        status: 'OPEN',
      },
    })
    damageReportId = dr.id
    await saveDamageExtras(dr.id, equipment.id, damageCategory, damagePhotos, employeeCardId, employeeName, { code: equipment.code, severity: damageSeverity, description: foundDamage ?? '' })
    inspectionResult = damageSeverity === 'CRITICAL' ? 'OUT_OF_SERVICE' : damageSeverity === 'MAJOR' ? 'MAJOR_DAMAGE' : 'MINOR_DAMAGE'

    if (damageSeverity === 'CRITICAL' || damageSeverity === 'MAJOR') {
      await db.equipment.update({
        where: { id: equipment.id },
        data: { status: 'OUT_OF_SERVICE' },
      })
    } else {
      await db.equipment.update({
        where: { id: equipment.id },
        data: { status: 'AVAILABLE', notes: `Manje oštećenje prijavljeno ${new Date().toISOString().slice(0, 10)}` },
      })
    }
  } else {
    await db.equipment.update({
      where: { id: equipment.id },
      data: { status: 'AVAILABLE', notes: null },
    })
  }

  await db.assignment.create({
    data: {
      equipmentId: equipment.id,
      equipmentCode: equipment.code,
      equipmentName: equipment.name,
      employeeId: employee.id,
      employeeCardId: employee.cardId,
      employeeName: employee.name,
      action: 'CHECK_IN',
      inspectionResult,
      inspectionNotes: notes ?? null,
      checklistJson: JSON.stringify(getChecklistForType(equipment.type).map((i) => ({ ...i, passed: true }))),
      damageReportId,
    },
  })

  revalidatePath('/')
  return { ok: true, damageReportId }
}

// =====================================================
// MUTATION: Dashboard - promjena statusa opreme (engineer+)
// =====================================================

export async function updateEquipmentStatus(params: {
  equipmentId: string
  status: 'AVAILABLE' | 'ASSIGNED' | 'OUT_OF_SERVICE' | 'MAINTENANCE'
  notes?: string
}) {
  await requireRole(['engineer', 'admin'])

  const { equipmentId, status, notes } = params

  if (isDemoMode()) {
    await db.equipment.update({
      where: { id: equipmentId },
      data: { status, ...(notes !== undefined ? { notes } : {}) },
    })
    revalidatePath('/')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const update: Record<string, unknown> = { status }
  if (notes !== undefined) update.notes = notes
  const { error } = await supabase.from('equipment').update(update).eq('id', equipmentId)
  if (error) throw error
  revalidatePath('/')
  return { ok: true }
}

// =====================================================
// MUTATION: Edit opreme (admin only)
// =====================================================

export async function updateEquipment(params: {
  equipmentId: string
  name?: string
  type?: string
  location?: string
  serialNumber?: string
  notes?: string
  department?: string
}) {
  await requireRole(['admin'])

  const { equipmentId, ...data } = params

  if (isDemoMode()) {
    await db.equipment.update({
      where: { id: equipmentId },
      data,
    })
    revalidatePath('/')
    return { ok: true }
  }

  // Konverzija camelCase → snake_case za Supabase
  const update: Record<string, unknown> = {}
  if (data.name !== undefined) update.name = data.name
  if (data.type !== undefined) update.type = data.type
  if (data.location !== undefined) update.location = data.location
  if (data.serialNumber !== undefined) update.serial_number = data.serialNumber
  if (data.notes !== undefined) update.notes = data.notes
  if (data.department !== undefined) update.department = data.department

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('equipment').update(update).eq('id', equipmentId)
  if (error) throw error
  revalidatePath('/')
  return { ok: true }
}

export async function createEquipment(params: {
  code: string
  name: string
  type: string
  serialNumber?: string
  location: string
  department?: string
}) {
  await requireRole(['admin'])

  if (isDemoMode()) {
    const existing = await db.equipment.findUnique({ where: { code: params.code } })
    if (existing) return { ok: false, error: 'Kod već postoji' }

    await db.equipment.create({
      data: {
        code: params.code,
        name: params.name,
        type: params.type,
        serialNumber: params.serialNumber ?? null,
        location: params.location,
        department: params.department ?? null,
        status: 'AVAILABLE',
      },
    })
    revalidatePath('/')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('equipment').insert({
    code: params.code,
    name: params.name,
    type: params.type,
    serial_number: params.serialNumber ?? null,
    location: params.location,
    department: params.department ?? null,
    status: 'AVAILABLE',
  })

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Kod već postoji' }
    throw error
  }
  revalidatePath('/')
  return { ok: true }
}

// =====================================================
// MUTATION: Damage report upravljanje (engineer+)
// =====================================================

export async function resolveDamageReport(params: {
  damageId: string
  resolution: string
  setEquipmentAvailable?: boolean
}) {
  await requireRole(['engineer', 'admin'])

  const { damageId, resolution, setEquipmentAvailable } = params

  if (isDemoMode()) {
    const dr = await db.damageReport.update({
      where: { id: damageId },
      data: {
        status: 'RESOLVED',
        resolution,
        resolvedAt: new Date(),
      },
    })

    if (setEquipmentAvailable) {
      await db.equipment.update({
        where: { id: dr.equipmentId },
        data: {
          status: 'AVAILABLE',
          notes: `Popravljeno ${new Date().toISOString().slice(0, 10)}: ${resolution.slice(0, 100)}`,
        },
      })
    }

    revalidatePath('/')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()

  // Dohvati damage report da znamo equipment_id
  const { data: dr } = await supabase
    .from('damage_reports')
    .select('equipment_id')
    .eq('id', damageId)
    .single()

  await supabase
    .from('damage_reports')
    .update({
      status: 'RESOLVED',
      resolution,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', damageId)

  if (setEquipmentAvailable && dr?.equipment_id) {
    await supabase
      .from('equipment')
      .update({
        status: 'AVAILABLE',
        notes: `Popravljeno ${new Date().toISOString().slice(0, 10)}: ${resolution.slice(0, 100)}`,
      })
      .eq('id', dr.equipment_id)
  }

  revalidatePath('/')
  return { ok: true }
}

export async function updateDamageStatus(params: {
  damageId: string
  status: 'OPEN' | 'IN_REPAIR' | 'RESOLVED'
}) {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    await db.damageReport.update({
      where: { id: params.damageId },
      data: {
        status: params.status,
        ...(params.status === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
      },
    })
    revalidatePath('/')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const update: Record<string, unknown> = { status: params.status }
  if (params.status === 'RESOLVED') {
    update.resolved_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('damage_reports')
    .update(update)
    .eq('id', params.damageId)

  if (error) throw error
  revalidatePath('/')
  return { ok: true }
}

// =====================================================
// TOK POPRAVKE KVARA: preuzmi (radionica) -> označi popravljeno -> odobri (šef)
// Isti redoslijed kao fn_mark_repaired / fn_approve_repair u migraciji 017.
// =====================================================

export async function acknowledgeDamage(damageId: string) {
  const user = await requireRole(['engineer', 'admin'])
  const now = new Date()

  if (isDemoMode()) {
    await db.damageReport.update({
      where: { id: damageId },
      data: {
        status: 'IN_REPAIR',
        acknowledgedAt: now,
        acknowledgedBy: user.full_name,
      },
    })
    await logRepairEvent({ damageId, kind: 'TAKEN', text: 'Prijava preuzeta', byName: user.full_name, byCardId: user.card_id })
    revalidatePath('/')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase
    .from('damage_reports')
    .update({
      status: 'IN_REPAIR',
      acknowledged_at: now.toISOString(),
      acknowledged_by: user.full_name,
    })
    .eq('id', damageId)
  if (error) throw error
  await logRepairEvent({ damageId, kind: 'TAKEN', text: 'Prijava preuzeta', byName: user.full_name, byCardId: user.card_id })
  revalidatePath('/')
  return { ok: true }
}

export async function markRepaired(params: {
  damageId: string
  repairNotes: string
  category?: string
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole(['engineer', 'admin'])
  const notes = params.repairNotes.trim()
  if (!notes) return { ok: false, error: 'Unesite kratak opis popravke' }

  // Kategorija: iz prijave (izvedena iz čeklista) ili ručno odabrana za slobodne prijave
  let category: string | null = null
  let equipmentCode = ''
  if (isDemoMode()) {
    const dr = await db.damageReport.findUnique({ where: { id: params.damageId } })
    if (!dr) return { ok: false, error: 'Kvar nije pronađen' }
    equipmentCode = dr.equipmentCode
    category = dr.category ?? params.category ?? null
  } else {
    const supabase = await createSupabaseClient()
    const { data: dr } = await supabase.from('damage_reports').select('category,equipment_code').eq('id', params.damageId).maybeSingle()
    if (!dr) return { ok: false, error: 'Kvar nije pronađen' }
    equipmentCode = dr.equipment_code ?? ''
    category = dr.category ?? params.category ?? null
  }
  if (!category) return { ok: false, error: 'Odaberite kategoriju kvara' }

  // Samo radnik sa važećom kvalifikacijom za kategoriju smije označiti popravku
  const skill = await checkMaintenanceSkill(user.card_id, category)
  if (!skill.qualified) return { ok: false, error: skill.reason ?? 'Niste kvalifikovani za ovu kategoriju' }

  const now = new Date()
  if (isDemoMode()) {
    await db.damageReport.update({
      where: { id: params.damageId },
      data: {
        status: 'AWAITING_APPROVAL',
        category,
        resolution: notes,
        repairedByCardId: user.card_id,
        repairedByName: user.full_name,
        repairedAt: now,
      },
    })
    revalidatePath('/')
    try {
      after(() => sendWebhookNotification('triggerRepairAwaitingApproval', `GSE Control — popravka čeka odobrenje: ${equipmentCode} (popravio/la: ${user.full_name})`, { equipmentCode }))
    } catch { /* after() nedostupan — preskoči */ }
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase
    .from('damage_reports')
    .update({
      status: 'AWAITING_APPROVAL',
      category,
      resolution: notes,
      repaired_by_card_id: user.card_id,
      repaired_by_name: user.full_name,
      repaired_at: now.toISOString(),
    })
    .eq('id', params.damageId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/')
  try {
    after(() => sendWebhookNotification('triggerRepairAwaitingApproval', `GSE Control — popravka čeka odobrenje: ${equipmentCode} (popravio/la: ${user.full_name})`, { equipmentCode }))
  } catch { /* after() nedostupan — preskoči */ }
  return { ok: true }
}

export async function approveRepair(params: {
  damageId: string
  cost?: number
  partsReplaced?: string
  durationHours?: number
  /** Šef službe koji je pregledao vozilo i datum/vrijeme njegovog pregleda (ISO). Upisuje radionica ili admin. */
  chiefName: string
  inspectedAt?: string
  /** Probni rad / funkcionalni test nakon popravke je urađen i zadovoljava (obavezno prije puštanja u rad). */
  testDone: boolean
  testNote?: string
}): Promise<{ ok: boolean; error?: string; crsNumber?: string }> {
  const user = await requireRole(['engineer', 'admin'])
  const now = new Date()
  const chiefName = (params.chiefName ?? '').trim().slice(0, 120)
  if (chiefName.length < 3) return { ok: false, error: 'Upišite ime i prezime šefa službe koji je pregledao vozilo' }
  if (params.testDone !== true) return { ok: false, error: 'Potvrdite da je probni rad / funkcionalni test nakon popravke urađen i da zadovoljava' }
  const testNote = (params.testNote ?? '').trim().replace(/\s+/g, ' ').slice(0, 300) || null
  const inspectedAt = params.inspectedAt ? new Date(params.inspectedAt) : now
  if (!Number.isFinite(inspectedAt.getTime()) || inspectedAt.getTime() > now.getTime() + 10 * 60_000) return { ok: false, error: 'Datum i vrijeme pregleda nisu ispravni (ne mogu biti u budućnosti)' }

  let equipmentId: string | null = null
  let resolution = ''
  let repairedByName: string | null = null
  let repairedByCardId: string | null = null
  let saved: { workers: string | null; parts: string | null; hours: number | null; cost: number | null } = { workers: null, parts: null, hours: null, cost: null }
  const fmtParts = (raw: unknown): string | null => {
    try {
      const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (!Array.isArray(arr) || arr.length === 0) return null
      return arr.map((p: any) => `${p.name} ×${p.qty}`).join(', ')
    } catch { return null }
  }

  if (isDemoMode()) {
    const dr = await db.damageReport.findUnique({ where: { id: params.damageId } })
    if (!dr) return { ok: false, error: 'Kvar nije pronađen' }
    if (dr.status !== 'AWAITING_APPROVAL') return { ok: false, error: 'Popravka nije označena kao završena' }
    equipmentId = dr.equipmentId
    resolution = dr.resolution ?? ''
    repairedByName = dr.repairedByName
    repairedByCardId = dr.repairedByCardId
    saved = { workers: dr.workerNames ?? null, parts: fmtParts(dr.partsJson), hours: dr.workHours ?? null, cost: dr.workCost ?? null }

    await db.damageReport.update({
      where: { id: params.damageId },
      data: {
        status: 'RESOLVED',
        approvedByCardId: user.card_id,
        approvedByName: user.full_name,
        approvedAt: now,
        resolvedAt: now,
        chiefName,
        chiefInspectedAt: inspectedAt,
        chiefResult: 'OK',
        testDone: true,
        testNote,
        testAt: inspectedAt,
        testBy: chiefName,
      },
    })
    await db.equipment.update({
      where: { id: dr.equipmentId },
      data: {
        status: 'AVAILABLE',
        needsFirstUseConfirmation: true,
        notes: 'Popravka odobrena - čeka potvrdu prvog radnika pri zaduživanju',
      },
    })
  } else {
    const supabase = await createSupabaseClient()
    const { data: dr } = await supabase
      .from('damage_reports')
      .select('equipment_id, status, resolution, repaired_by_name, repaired_by_card_id, worker_names, parts_json, work_hours, work_cost')
      .eq('id', params.damageId)
      .maybeSingle()
    if (!dr) return { ok: false, error: 'Kvar nije pronađen' }
    if (dr.status !== 'AWAITING_APPROVAL') return { ok: false, error: 'Popravka nije označena kao završena' }
    equipmentId = dr.equipment_id
    resolution = dr.resolution ?? ''
    repairedByName = dr.repaired_by_name
    repairedByCardId = dr.repaired_by_card_id
    saved = { workers: dr.worker_names ?? null, parts: fmtParts(dr.parts_json), hours: dr.work_hours != null ? Number(dr.work_hours) : null, cost: dr.work_cost != null ? Number(dr.work_cost) : null }

    // Atomično: isto što i fn_approve_repair (status RESOLVED + oprema AVAILABLE)
    const { error } = await supabase.rpc('fn_approve_repair', {
      p_damage_id: params.damageId,
      p_approved_by_card_id: user.card_id,
      p_approved_by_name: user.full_name,
    })
    if (error) return { ok: false, error: error.message }
    await supabase.from('damage_reports').update({ chief_name: chiefName, chief_inspected_at: inspectedAt.toISOString(), chief_result: 'OK', test_done: true, test_note: testNote, test_at: inspectedAt.toISOString(), test_by: chiefName }).eq('id', params.damageId)
  }

  await logRepairEvent({ damageId: params.damageId, kind: 'CHIEF_OK', text: `Pregled šefa službe: ${chiefName} — OK. Probni rad / funkcionalni test: zadovoljava${testNote ? ` (${testNote})` : ''}`, byName: user.full_name, byCardId: user.card_id })

  // Zapis u evidenciju održavanja (Part-145) - samo ako imamo sredstvo
  if (equipmentId) {
    try {
      await createMaintenanceLog({
        equipmentId,
        maintenanceType: 'CORRECTIVE',
        description: resolution || 'Korektivna popravka po prijavi kvara',
        performedBy: saved.workers ?? repairedByName ?? undefined,
        performedByCardId: repairedByCardId ?? undefined,
        cost: params.cost ?? saved.cost ?? undefined,
        durationHours: params.durationHours ?? saved.hours ?? undefined,
        partsReplaced: params.partsReplaced ?? saved.parts ?? undefined,
      })
    } catch (e) {
      // Popravka je već odobrena - neuspjeh evidencije ne smije poništiti odobrenje
      console.error('approveRepair: maintenance log nije upisan', e)
    }
  }

  revalidatePath('/')
  return { ok: true }
}
