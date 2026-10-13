'use server'

// Provjera kvalifikacije radnika za rukovanje određenim tipom GSE opreme.
// EquipmentQualification model je postojao u šemi, ali se do sada nije
// provjeravao u checkOutEquipment/checkOutPrisma - ovo to popravlja.
//
// Napomena: ovo je NAMJERNO odvojeno od checkDriverAuthorization
// (ADR.OPS.C.005 - dozvola za kretanje po movement area) - kvalifikacija
// govori "da li smije rukovati OVIM TIPOM opreme", vozačka dozvola govori
// "da li smije uopšte voziti po airside zonama". Za CHECK_OUT su potrebna oba.

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { revalidatePath } from 'next/cache'

async function requireRole(roles: Array<'operator' | 'engineer' | 'admin'>): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  if (!roles.includes(user.role)) throw new Error(`Nemate dozvolu. Potrebna rola: ${roles.join(' ili ')}`)
  return user
}

export interface QualificationCheckResult {
  qualified: boolean
  reason?: string
  level?: 'OPERATOR' | 'SENIOR' | 'INSTRUCTOR'
  validUntil?: string | null
}

// =====================================================
// CHECK - javna funkcija, poziva se iz checkOutEquipment
// =====================================================

export async function checkEquipmentQualification(
  employeeCardId: string,
  equipmentType: string
): Promise<QualificationCheckResult> {
  const cardId = employeeCardId.trim().toUpperCase()

  if (isDemoMode()) {
    const qual = await db.equipmentQualification.findFirst({
      where: { employeeCardId: cardId, equipmentType },
    })

    if (!qual) {
      return {
        qualified: false,
        reason: `Radnik nema evidentiranu kvalifikaciju za tip opreme "${equipmentType}". Kontaktirajte supervizora za obuku/ovlašćenje.`,
      }
    }

    if (qual.validUntil && new Date(qual.validUntil) < new Date()) {
      return {
        qualified: false,
        reason: `Kvalifikacija za "${equipmentType}" je istekla (važila do ${new Date(qual.validUntil).toLocaleDateString('sr-Latn-ME')}). Potrebna obnova obuke.`,
        level: qual.qualificationLevel as any,
        validUntil: qual.validUntil.toISOString(),
      }
    }

    return {
      qualified: true,
      level: qual.qualificationLevel as any,
      validUntil: qual.validUntil ? qual.validUntil.toISOString() : null,
    }
  }

  // Supabase
  const supabase = await createSupabaseClient()
  const { data: qual } = await supabase
    .from('equipment_qualifications')
    .select('*')
    .eq('employee_card_id', cardId)
    .eq('equipment_type', equipmentType)
    .maybeSingle()

  if (!qual) {
    return {
      qualified: false,
      reason: `Radnik nema evidentiranu kvalifikaciju za tip opreme "${equipmentType}". Kontaktirajte supervizora za obuku/ovlašćenje.`,
    }
  }

  if (qual.valid_until && new Date(qual.valid_until) < new Date()) {
    return {
      qualified: false,
      reason: `Kvalifikacija za "${equipmentType}" je istekla (važila do ${new Date(qual.valid_until).toLocaleDateString('sr-Latn-ME')}). Potrebna obnova obuke.`,
      level: qual.qualification_level,
      validUntil: qual.valid_until,
    }
  }

  return {
    qualified: true,
    level: qual.qualification_level,
    validUntil: qual.valid_until,
  }
}

// =====================================================
// GET - lista kvalifikacija radnika (za dashboard/admin)
// =====================================================

export async function getQualificationsForEmployee(employeeCardId: string) {
  await requireRole(['engineer', 'admin'])
  const cardId = employeeCardId.trim().toUpperCase()

  if (isDemoMode()) {
    return db.equipmentQualification.findMany({
      where: { employeeCardId: cardId },
      orderBy: { equipmentType: 'asc' },
    })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('equipment_qualifications')
    .select('*')
    .eq('employee_card_id', cardId)
    .order('equipment_type', { ascending: true })

  return data ?? []
}

// =====================================================
// GRANT - admin dodaje/produžava kvalifikaciju
// =====================================================

export async function grantQualification(params: {
  employeeId: string
  employeeCardId: string
  employeeName: string
  equipmentType: string
  qualificationLevel?: 'OPERATOR' | 'SENIOR' | 'INSTRUCTOR'
  trainedAt?: string
  validUntil?: string
  certifiedBy?: string
  certificateNumber?: string
}) {
  const user = await requireRole(['admin'])
  const cardId = params.employeeCardId.trim().toUpperCase()

  if (isDemoMode()) {
    await db.equipmentQualification.upsert({
      where: { employeeId_equipmentType: { employeeId: params.employeeId, equipmentType: params.equipmentType } },
      update: {
        qualificationLevel: params.qualificationLevel ?? 'OPERATOR',
        trainedAt: params.trainedAt ? new Date(params.trainedAt) : undefined,
        validUntil: params.validUntil ? new Date(params.validUntil) : null,
        certifiedBy: params.certifiedBy ?? user.full_name,
        certificateNumber: params.certificateNumber,
      },
      create: {
        employeeId: params.employeeId,
        employeeCardId: cardId,
        employeeName: params.employeeName,
        equipmentType: params.equipmentType,
        qualificationLevel: params.qualificationLevel ?? 'OPERATOR',
        trainedAt: params.trainedAt ? new Date(params.trainedAt) : null,
        validUntil: params.validUntil ? new Date(params.validUntil) : null,
        certifiedBy: params.certifiedBy ?? user.full_name,
        certificateNumber: params.certificateNumber,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('equipment_qualifications').upsert(
    {
      employee_id: params.employeeId,
      employee_card_id: cardId,
      employee_name: params.employeeName,
      equipment_type: params.equipmentType,
      qualification_level: params.qualificationLevel ?? 'OPERATOR',
      trained_at: params.trainedAt ?? null,
      valid_until: params.validUntil ?? null,
      certified_by: params.certifiedBy ?? user.full_name,
      certificate_number: params.certificateNumber ?? null,
    },
    { onConflict: 'employee_id,equipment_type' }
  )
  if (error) throw error
  revalidatePath('/dashboard')
  return { ok: true }
}

// =====================================================
// REVOKE - admin uklanja kvalifikaciju
// =====================================================

export async function revokeQualification(qualificationId: string) {
  await requireRole(['admin'])

  if (isDemoMode()) {
    await db.equipmentQualification.delete({ where: { id: qualificationId } })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  await supabase.from('equipment_qualifications').delete().eq('id', qualificationId)
  revalidatePath('/dashboard')
  return { ok: true }
}
