'use server'

// Kvalifikacija radionice PO KATEGORIJI KVARA - odvojeno od
// EquipmentQualification (ko smije rukovati sredstvom). Ovo određuje ko
// smije da POPRAVI kvar te vrste: električar ne dira kočnice, mehaničar ne
// dira električnu instalaciju, itd.

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { revalidatePath } from 'next/cache'
import type { ChecklistCategory } from '@/lib/types'

async function requireRole(roles: Array<'operator' | 'engineer' | 'admin'>): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  if (!roles.includes(user.role)) throw new Error(`Nemate dozvolu. Potrebna rola: ${roles.join(' ili ')}`)
  return user
}

export interface MaintenanceSkillCheckResult {
  qualified: boolean
  reason?: string
  level?: 'JUNIOR' | 'CERTIFIED' | 'SENIOR'
  validUntil?: string | null
}

// =====================================================
// CHECK - poziva se iz markRepaired prije nego se popravka prihvati
// =====================================================

export async function checkMaintenanceSkill(
  employeeCardId: string | null | undefined,
  category: ChecklistCategory | string
): Promise<MaintenanceSkillCheckResult> {
  if (!employeeCardId) {
    return {
      qualified: false,
      reason: 'Vaš nalog nije povezan sa brojem ID kartice, pa se ne može provjeriti kvalifikacija za popravke. Kontaktirajte administratora.',
    }
  }
  const cardId = employeeCardId.trim().toUpperCase()

  if (isDemoMode()) {
    const skill = await db.maintenanceSkill.findFirst({
      where: { employeeCardId: cardId, category: String(category) },
    })
    if (!skill) {
      return { qualified: false, reason: `Niste kvalifikovani za popravke kategorije "${category}". Ovu popravku mora preuzeti radnik sa odgovarajućom kvalifikacijom.` }
    }
    if (skill.validUntil && new Date(skill.validUntil) < new Date()) {
      return { qualified: false, reason: `Vaša kvalifikacija za "${category}" je istekla. Potrebna obnova.`, level: skill.level as any, validUntil: skill.validUntil.toISOString() }
    }
    return { qualified: true, level: skill.level as any, validUntil: skill.validUntil ? skill.validUntil.toISOString() : null }
  }

  const supabase = await createSupabaseClient()
  const { data: skill } = await supabase
    .from('maintenance_skills')
    .select('*')
    .eq('employee_card_id', cardId)
    .eq('category', String(category))
    .maybeSingle()

  if (!skill) {
    return { qualified: false, reason: `Niste kvalifikovani za popravke kategorije "${category}". Ovu popravku mora preuzeti radnik sa odgovarajućom kvalifikacijom.` }
  }
  if (skill.valid_until && new Date(skill.valid_until) < new Date()) {
    return { qualified: false, reason: `Vaša kvalifikacija za "${category}" je istekla. Potrebna obnova.`, level: skill.level, validUntil: skill.valid_until }
  }
  return { qualified: true, level: skill.level, validUntil: skill.valid_until }
}

// =====================================================
// GET - sve vještine radnika (za dashboard/admin prikaz)
// =====================================================

export async function getMaintenanceSkillsForEmployee(employeeCardId: string) {
  await requireRole(['engineer', 'admin'])
  const cardId = employeeCardId.trim().toUpperCase()

  if (isDemoMode()) {
    return db.maintenanceSkill.findMany({ where: { employeeCardId: cardId }, orderBy: { category: 'asc' } })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('maintenance_skills').select('*').eq('employee_card_id', cardId).order('category', { ascending: true })
  return data ?? []
}

export async function getAllMaintenanceSkills() {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    return db.maintenanceSkill.findMany({ orderBy: [{ employeeName: 'asc' }, { category: 'asc' }] })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('maintenance_skills').select('*').order('employee_name', { ascending: true })
  return data ?? []
}

// =====================================================
// GRANT / REVOKE - samo admin (šef službe)
// =====================================================

export async function grantMaintenanceSkill(params: {
  employeeCardId: string
  employeeName: string
  category: ChecklistCategory | string
  level?: 'JUNIOR' | 'CERTIFIED' | 'SENIOR'
  certificateNumber?: string
  validUntil?: string
}) {
  const user = await requireRole(['admin'])
  const cardId = params.employeeCardId.trim().toUpperCase()

  if (isDemoMode()) {
    await db.maintenanceSkill.upsert({
      where: { employeeCardId_category: { employeeCardId: cardId, category: String(params.category) } },
      update: {
        level: params.level ?? 'CERTIFIED',
        certifiedBy: user.full_name,
        certificateNumber: params.certificateNumber,
        validUntil: params.validUntil ? new Date(params.validUntil) : null,
      },
      create: {
        employeeCardId: cardId,
        employeeName: params.employeeName,
        category: String(params.category),
        level: params.level ?? 'CERTIFIED',
        certifiedBy: user.full_name,
        certificateNumber: params.certificateNumber,
        validUntil: params.validUntil ? new Date(params.validUntil) : null,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('maintenance_skills').upsert(
    {
      employee_card_id: cardId,
      employee_name: params.employeeName,
      category: String(params.category),
      level: params.level ?? 'CERTIFIED',
      certified_by: user.full_name,
      certificate_number: params.certificateNumber ?? null,
      valid_until: params.validUntil ?? null,
    },
    { onConflict: 'employee_card_id,category' }
  )
  if (error) throw error
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function revokeMaintenanceSkill(skillId: string) {
  await requireRole(['admin'])

  if (isDemoMode()) {
    await db.maintenanceSkill.delete({ where: { id: skillId } })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  await supabase.from('maintenance_skills').delete().eq('id', skillId)
  revalidatePath('/dashboard')
  return { ok: true }
}
