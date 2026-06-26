'use server'

// Equipment Access Control
// Admin upravlja ko može zadužiti koje sredstvo

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function requireRole(roles: Array<'operator' | 'engineer' | 'admin'>): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  if (!roles.includes(user.role)) {
    throw new Error(`Nemate dozvolu. Potrebna rola: ${roles.join(' ili ')}`)
  }
  return user
}

export interface AccessEntry {
  id: string
  equipmentId: string
  equipmentCode: string
  employeeCardId: string
  employeeName: string
  grantedBy: string | null
  createdAt: Date
}

// =====================================================
// Provjeri da li radnik može zadužiti sredstvo
// Javna funkcija - poziva se iz checkOutEquipment
// =====================================================

export async function checkEquipmentAccess(equipmentId: string, employeeCardId: string): Promise<{ allowed: boolean; reason?: string }> {
  if (isDemoMode()) {
    const equipment = await db.equipment.findUnique({ where: { id: equipmentId } })
    if (!equipment) return { allowed: false, reason: 'Sredstvo nije pronađeno' }

    // Ako nije ograničeno, svi mogu
    if (!equipment.restrictedAccess) return { allowed: true }

    // Ako je ograničeno, provjeri da li radnik ima dozvolu
    const access = await db.equipmentAccess.findUnique({
      where: {
        equipmentId_employeeCardId: {
          equipmentId,
          employeeCardId: employeeCardId.toUpperCase(),
        },
      },
    })

    if (!access) {
      return { allowed: false, reason: 'Nemate dozvolu za zaduživanje ovog sredstva. Kontaktirajte supervizora.' }
    }

    return { allowed: true }
  }

  // Supabase
  const supabase = await createSupabaseClient()
  const { data: equipment } = await supabase.from('equipment').select('restricted_access').eq('id', equipmentId).single()

  if (!equipment) return { allowed: false, reason: 'Sredstvo nije pronađeno' }
  if (!equipment.restricted_access) return { allowed: true }

  const { data: access } = await supabase
    .from('equipment_access')
    .select('id')
    .eq('equipment_id', equipmentId)
    .eq('employee_card_id', employeeCardId.toUpperCase())
    .single()

  if (!access) {
    return { allowed: false, reason: 'Nemate dozvolu za zaduživanje ovog sredstva. Kontaktirajte supervizora.' }
  }

  return { allowed: true }
}

// =====================================================
// GET authorized workers for equipment
// =====================================================

export async function getAuthorizedWorkers(equipmentId: string): Promise<AccessEntry[]> {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    return db.equipmentAccess.findMany({
      where: { equipmentId },
      orderBy: { createdAt: 'desc' },
    })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('equipment_access')
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('created_at', { ascending: false })

  return (data ?? []).map((a: any) => ({
    id: a.id,
    equipmentId: a.equipment_id,
    equipmentCode: a.equipment_code,
    employeeCardId: a.employee_card_id,
    employeeName: a.employee_name,
    grantedBy: a.granted_by,
    createdAt: new Date(a.created_at),
  }))
}

// =====================================================
// AUTHORIZE worker for equipment
// =====================================================

export async function authorizeWorker(params: {
  equipmentId: string
  equipmentCode: string
  employeeCardId: string
  employeeName: string
}) {
  await requireRole(['admin'])
  const user = await getCurrentUser()

  if (isDemoMode()) {
    try {
      await db.equipmentAccess.create({
        data: {
          equipmentId: params.equipmentId,
          equipmentCode: params.equipmentCode,
          employeeCardId: params.employeeCardId.toUpperCase(),
          employeeName: params.employeeName,
          grantedBy: user?.full_name ?? null,
        },
      })
    } catch {
      return { ok: false, error: 'Radnik je već autorizovan za ovo sredstvo' }
    }
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('equipment_access').insert({
    equipment_id: params.equipmentId,
    equipment_code: params.equipmentCode,
    employee_card_id: params.employeeCardId.toUpperCase(),
    employee_name: params.employeeName,
    granted_by: user?.full_name ?? null,
  })

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Radnik je već autorizovan' }
    throw error
  }
  revalidatePath('/dashboard')
  return { ok: true }
}

// =====================================================
// REMOVE authorization
// =====================================================

export async function removeAuthorization(accessId: string) {
  await requireRole(['admin'])

  if (isDemoMode()) {
    await db.equipmentAccess.delete({ where: { id: accessId } })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  await supabase.from('equipment_access').delete().eq('id', accessId)
  revalidatePath('/dashboard')
  return { ok: true }
}

// =====================================================
// TOGGLE restricted access on equipment
// =====================================================

export async function toggleRestrictedAccess(equipmentId: string, restricted: boolean) {
  await requireRole(['admin'])

  if (isDemoMode()) {
    await db.equipment.update({
      where: { id: equipmentId },
      data: { restrictedAccess: restricted },
    })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  await supabase.from('equipment').update({ restricted_access: restricted }).eq('id', equipmentId)
  revalidatePath('/dashboard')
  return { ok: true }
}

// =====================================================
// GET all employees (for dropdown in authorize dialog)
// =====================================================

export async function getAllEmployees() {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    return db.employee.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('employees')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true })

  return (data ?? []).map((e: any) => ({
    id: e.id,
    cardId: e.card_id,
    name: e.name,
    department: e.department,
    role: e.role,
    pin: e.pin,
  }))
}
