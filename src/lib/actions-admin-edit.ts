'use server'

// Uređivanje kvalifikacija i zapisa održavanja (samo admin). Svaka izmjena ide u audit trag.

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/actions-advanced'

async function requireAdmin(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  if (user.role !== 'admin') throw new Error('Nemate dozvolu. Potrebna rola: admin')
  return user
}

type Result = { ok: boolean; error?: string }

const EQUIPMENT_TYPES = ['GPU', 'AIR_STARTER', 'TOW_TRACTOR', 'BELT_LOADER', 'CARGO_LOADER', 'STAIRS', 'WATER', 'LAVATORY', 'PUSHBACK', 'FORKLIFT', 'DOLLY', 'BUS', 'FIRE_TRUCK', 'AMBULANCE', 'FOLLOW_ME', 'SERVICE_CAR', 'OTHER']
const SKILL_CATEGORIES = ['MEHANIKA', 'ELEKTRIKA', 'HIDRAULIKA', 'BEZBJEDNOST', 'OPSTE']
const dateOrNull = (v?: string | null) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)

// =====================================================
// Kvalifikacije radnika: tipovi opreme + kategorije kvarova, odjednom
// =====================================================

export async function setWorkerQualifications(params: {
  employeeCardId: string
  employeeName: string
  equipmentTypes: string[]
  categories: string[]
  validUntil?: string | null // primjenjuje se na sve redove ovog radnika; undefined = ne dirati
}): Promise<Result> {
  const admin = await requireAdmin()
  const card = params.employeeCardId.trim().toUpperCase()
  const name = params.employeeName.trim()
  if (!card || !name) return { ok: false, error: 'Unesite broj kartice i ime' }
  const types = [...new Set(params.equipmentTypes)].filter((t) => EQUIPMENT_TYPES.includes(t))
  const cats = [...new Set(params.categories)].filter((c) => SKILL_CATEGORIES.includes(c))
  const until = params.validUntil === undefined ? undefined : dateOrNull(params.validUntil)

  if (isDemoMode()) {
    const emp = await db.employee.upsert({ where: { cardId: card }, update: { name }, create: { cardId: card, name } })
    const curQ = await db.equipmentQualification.findMany({ where: { employeeCardId: card } })
    const curS = await db.maintenanceSkill.findMany({ where: { employeeCardId: card } })
    await db.equipmentQualification.deleteMany({ where: { employeeCardId: card, equipmentType: { notIn: types } } })
    for (const t of types.filter((t) => !curQ.some((q) => q.equipmentType === t))) {
      await db.equipmentQualification.create({
        data: { employeeId: emp.id, employeeCardId: card, employeeName: name, equipmentType: t, qualificationLevel: 'OPERATOR', trainedAt: new Date(), validUntil: until ? new Date(until) : null, certifiedBy: admin.full_name },
      })
    }
    await db.maintenanceSkill.deleteMany({ where: { employeeCardId: card, category: { notIn: cats } } })
    for (const c of cats.filter((c) => !curS.some((s) => s.category === c))) {
      await db.maintenanceSkill.create({
        data: { employeeCardId: card, employeeName: name, category: c, level: 'CERTIFIED', certifiedBy: admin.full_name, validUntil: until ? new Date(until) : null },
      })
    }
    if (until !== undefined) {
      await db.equipmentQualification.updateMany({ where: { employeeCardId: card }, data: { validUntil: until ? new Date(until) : null, employeeName: name } })
      await db.maintenanceSkill.updateMany({ where: { employeeCardId: card }, data: { validUntil: until ? new Date(until) : null, employeeName: name } })
    }
  } else {
    const supabase = await createSupabaseClient()
    const { data: emp, error: empErr } = await supabase
      .from('employees').upsert({ card_id: card, name }, { onConflict: 'card_id' }).select('id').single()
    if (empErr) return { ok: false, error: empErr.message }

    const [{ data: curQ }, { data: curS }] = await Promise.all([
      supabase.from('equipment_qualifications').select('id,equipment_type').eq('employee_card_id', card),
      supabase.from('maintenance_skills').select('id,category').eq('employee_card_id', card),
    ])
    const delQ = (curQ ?? []).filter((q: any) => !types.includes(q.equipment_type)).map((q: any) => q.id)
    const delS = (curS ?? []).filter((s: any) => !cats.includes(s.category)).map((s: any) => s.id)
    if (delQ.length) { const { error } = await supabase.from('equipment_qualifications').delete().in('id', delQ); if (error) return { ok: false, error: error.message } }
    if (delS.length) { const { error } = await supabase.from('maintenance_skills').delete().in('id', delS); if (error) return { ok: false, error: error.message } }

    const newQ = types.filter((t) => !(curQ ?? []).some((q: any) => q.equipment_type === t)).map((t) => ({
      employee_id: emp?.id ?? null, employee_card_id: card, employee_name: name, equipment_type: t,
      qualification_level: 'OPERATOR', trained_at: new Date().toISOString().slice(0, 10), valid_until: until ?? null, certified_by: admin.full_name,
    }))
    if (newQ.length) { const { error } = await supabase.from('equipment_qualifications').insert(newQ); if (error) return { ok: false, error: error.message } }
    const newS = cats.filter((c) => !(curS ?? []).some((s: any) => s.category === c)).map((c) => ({
      employee_card_id: card, employee_name: name, category: c, level: 'CERTIFIED', certified_by: admin.full_name, valid_until: until ?? null,
    }))
    if (newS.length) { const { error } = await supabase.from('maintenance_skills').insert(newS); if (error) return { ok: false, error: error.message } }

    if (until !== undefined) {
      await supabase.from('equipment_qualifications').update({ valid_until: until, employee_name: name }).eq('employee_card_id', card)
      await supabase.from('maintenance_skills').update({ valid_until: until, employee_name: name }).eq('employee_card_id', card)
    }
  }

  await logAudit('WORKER_QUALIFICATIONS_SET', 'employee', card, JSON.stringify({ name, equipmentTypes: types, categories: cats, validUntil: until }))
  revalidatePath('/')
  return { ok: true }
}

// =====================================================
// Pojedinačna kvalifikacija za opremu (stranica "Održavanje")
// =====================================================

export async function updateQualification(id: string, patch: {
  qualificationLevel?: 'OPERATOR' | 'SENIOR' | 'INSTRUCTOR'
  trainedAt?: string | null
  validUntil?: string | null
  certifiedBy?: string | null
  certificateNumber?: string | null
}): Promise<Result> {
  await requireAdmin()
  const clean = (v?: string | null) => (v === undefined ? undefined : v && v.trim() ? v.trim() : null)
  if (isDemoMode()) {
    await db.equipmentQualification.update({
      where: { id },
      data: {
        ...(patch.qualificationLevel && { qualificationLevel: patch.qualificationLevel }),
        ...(patch.trainedAt !== undefined && { trainedAt: dateOrNull(patch.trainedAt) ? new Date(dateOrNull(patch.trainedAt)!) : null }),
        ...(patch.validUntil !== undefined && { validUntil: dateOrNull(patch.validUntil) ? new Date(dateOrNull(patch.validUntil)!) : null }),
        ...(patch.certifiedBy !== undefined && { certifiedBy: clean(patch.certifiedBy) }),
        ...(patch.certificateNumber !== undefined && { certificateNumber: clean(patch.certificateNumber) }),
      },
    })
  } else {
    const row: Record<string, unknown> = {}
    if (patch.qualificationLevel) row.qualification_level = patch.qualificationLevel
    if (patch.trainedAt !== undefined) row.trained_at = dateOrNull(patch.trainedAt)
    if (patch.validUntil !== undefined) row.valid_until = dateOrNull(patch.validUntil)
    if (patch.certifiedBy !== undefined) row.certified_by = clean(patch.certifiedBy)
    if (patch.certificateNumber !== undefined) row.certificate_number = clean(patch.certificateNumber)
    const supabase = await createSupabaseClient()
    const { error } = await supabase.from('equipment_qualifications').update(row).eq('id', id)
    if (error) return { ok: false, error: error.message }
  }
  await logAudit('QUALIFICATION_UPDATED', 'equipment_qualification', id, JSON.stringify(patch))
  revalidatePath('/')
  return { ok: true }
}

export async function deleteQualification(id: string): Promise<Result> {
  await requireAdmin()
  if (isDemoMode()) await db.equipmentQualification.delete({ where: { id } })
  else {
    const supabase = await createSupabaseClient()
    const { error } = await supabase.from('equipment_qualifications').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
  }
  await logAudit('QUALIFICATION_DELETED', 'equipment_qualification', id)
  revalidatePath('/')
  return { ok: true }
}

// =====================================================
// Zapis održavanja (Maintenance log): uređivanje i status.
// Brisanja nema namjerno — zapis se otkazuje (CANCELLED), da ostane trag.
// =====================================================

export async function updateMaintenanceLog(id: string, patch: {
  maintenanceType?: 'PREVENTIVE' | 'CORRECTIVE' | 'INSPECTION' | 'OVERHAUL'
  description?: string
  performedBy?: string | null
  cost?: number | null
  durationHours?: number | null
  certificateNumber?: string | null
  partsReplaced?: string | null
  nextDueDate?: string | null
  status?: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
}): Promise<Result> {
  await requireAdmin()
  if (patch.description !== undefined && !patch.description.trim()) return { ok: false, error: 'Opis je obavezan' }
  const clean = (v?: string | null) => (v === undefined ? undefined : v && v.trim() ? v.trim() : null)
  const nextDue = patch.nextDueDate === undefined ? undefined : dateOrNull(patch.nextDueDate)

  if (isDemoMode()) {
    await db.maintenanceLog.update({
      where: { id },
      data: {
        ...(patch.maintenanceType && { maintenanceType: patch.maintenanceType }),
        ...(patch.description !== undefined && { description: patch.description.trim() }),
        ...(patch.performedBy !== undefined && { performedBy: clean(patch.performedBy) }),
        ...(patch.cost !== undefined && { cost: patch.cost }),
        ...(patch.durationHours !== undefined && { durationHours: patch.durationHours }),
        ...(patch.certificateNumber !== undefined && { certificateNumber: clean(patch.certificateNumber) }),
        ...(patch.partsReplaced !== undefined && { partsReplaced: clean(patch.partsReplaced) }),
        ...(nextDue !== undefined && { nextDueDate: nextDue ? new Date(nextDue) : null }),
        ...(patch.status && { status: patch.status }),
      },
    })
  } else {
    const row: Record<string, unknown> = {}
    if (patch.maintenanceType) row.maintenance_type = patch.maintenanceType
    if (patch.description !== undefined) row.description = patch.description.trim()
    if (patch.performedBy !== undefined) row.performed_by = clean(patch.performedBy)
    if (patch.cost !== undefined) row.cost = patch.cost
    if (patch.durationHours !== undefined) row.duration_hours = patch.durationHours
    if (patch.certificateNumber !== undefined) row.certificate_number = clean(patch.certificateNumber)
    if (patch.partsReplaced !== undefined) row.parts_replaced = clean(patch.partsReplaced)
    if (nextDue !== undefined) row.next_due_date = nextDue
    if (patch.status) row.status = patch.status
    row.updated_at = new Date().toISOString()
    const supabase = await createSupabaseClient()
    const { error } = await supabase.from('maintenance_log').update(row).eq('id', id)
    if (error) return { ok: false, error: error.message }
  }
  await logAudit('MAINTENANCE_LOG_UPDATED', 'maintenance_log', id, JSON.stringify(patch))
  revalidatePath('/')
  return { ok: true }
}

// =====================================================
// Prijava kvara: ispravka opisa / težine / kategorije (samo admin)
// =====================================================

export async function updateDamageReport(id: string, patch: {
  description?: string
  severity?: 'MINOR' | 'MAJOR' | 'CRITICAL'
  category?: string | null
}): Promise<Result> {
  await requireAdmin()
  const data: Record<string, unknown> = {}
  if (patch.description !== undefined) {
    if (!patch.description.trim()) return { ok: false, error: 'Opis ne može biti prazan' }
    data.description = patch.description.trim()
  }
  if (patch.severity) {
    if (!['MINOR', 'MAJOR', 'CRITICAL'].includes(patch.severity)) return { ok: false, error: 'Neispravna težina' }
    data.severity = patch.severity
  }
  if (patch.category !== undefined) {
    if (patch.category && !SKILL_CATEGORIES.includes(patch.category)) return { ok: false, error: 'Neispravna kategorija' }
    data.category = patch.category || null
  }
  if (Object.keys(data).length === 0) return { ok: true }

  if (isDemoMode()) {
    await db.damageReport.update({ where: { id }, data })
  } else {
    const supabase = await createSupabaseClient()
    const { error } = await supabase.from('damage_reports').update(data).eq('id', id)
    if (error) return { ok: false, error: error.message }
  }
  await logAudit('DAMAGE_REPORT_EDITED', 'damage_report', id, JSON.stringify(data))
  revalidatePath('/')
  return { ok: true }
}

// =====================================================
// Brisanje sredstva (samo admin). U bazi su veze "on delete cascade", pa bi
// brisanje sredstva tiho obrisalo i cijelu historiju (zaduženja, kvarove,
// preglede, održavanje) — što je neprihvatljivo za ADR evidenciju. Zato je
// brisanje dozvoljeno samo za sredstvo BEZ historije (npr. greškom upisano);
// inače se sredstvo stavlja van upotrebe, ne briše.
// =====================================================

export async function deleteEquipment(equipmentId: string): Promise<Result> {
  await requireAdmin()
  const REASON = 'Sredstvo ima historiju (zaduženja, kvarove, pregled ili održavanje) pa se ne može obrisati — to bi uništilo evidenciju. Postavite status „Neispravno“ ili „Na održavanju“.'
  let code = ''

  if (isDemoMode()) {
    const eq = await db.equipment.findUnique({ where: { id: equipmentId } })
    if (!eq) return { ok: false, error: 'Sredstvo nije pronađeno' }
    code = eq.code
    if (eq.status === 'ASSIGNED') return { ok: false, error: 'Sredstvo je trenutno zaduženo' }
    const counts = await Promise.all([
      db.assignment.count({ where: { equipmentId } }),
      db.damageReport.count({ where: { equipmentId } }),
      db.maintenanceLog.count({ where: { equipmentId } }),
      db.dailyInspection.count({ where: { equipmentId } }),
    ])
    if (counts.some((c) => c > 0)) return { ok: false, error: REASON }
    await db.equipment.delete({ where: { id: equipmentId } })
  } else {
    const supabase = await createSupabaseClient()
    const { data: eq } = await supabase.from('equipment').select('code,status').eq('id', equipmentId).maybeSingle()
    if (!eq) return { ok: false, error: 'Sredstvo nije pronađeno' }
    code = eq.code
    if (eq.status === 'ASSIGNED') return { ok: false, error: 'Sredstvo je trenutno zaduženo' }
    for (const table of ['assignments', 'damage_reports', 'maintenance_log', 'daily_inspections', 'certificates_of_release', 'fuel_logs', 'parking_confirmations']) {
      const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('equipment_id', equipmentId)
      if (error) return { ok: false, error: `Provjera historije nije uspjela (${table}): ${error.message}` }
      if ((count ?? 0) > 0) return { ok: false, error: REASON }
    }
    const { error } = await supabase.from('equipment').delete().eq('id', equipmentId)
    if (error) return { ok: false, error: error.message }
  }
  await logAudit('EQUIPMENT_DELETED', 'equipment', equipmentId, JSON.stringify({ code }))
  revalidatePath('/')
  return { ok: true }
}
