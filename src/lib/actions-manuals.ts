'use server'

// EASA Part-145 §65 - Vehicle Operating Manuals
// Server actions za upravljanje uputstvima za vozila

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { EquipmentManualData } from '@/lib/constants-export'

async function requireRole(roles: Array<'operator' | 'engineer' | 'admin'>): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  if (!roles.includes(user.role)) {
    throw new Error(`Nemate dozvolu. Potrebna rola: ${roles.join(' ili ')}`)
  }
  return user
}

// =====================================================
// GET manuals for equipment (with type fallback)
// =====================================================

export async function getManualsForEquipment(equipmentId: string, equipmentType: string): Promise<EquipmentManualData[]> {
  // Javna funkcija - radnici mogu vidjeti manuale bez login-a

  if (isDemoMode()) {
    // 1. Prvo traži specifične manuale za ovo vozilo
    const specific = await db.equipmentManual.findMany({
      where: { equipmentId, active: true },
      orderBy: [{ manualType: 'asc' }, { createdAt: 'desc' }],
    })

    // 2. Ako nema specifičnih, traži po tipu (fallback)
    if (specific.length === 0) {
      const byType = await db.equipmentManual.findMany({
        where: { equipmentType, equipmentId: null, active: true },
        orderBy: [{ manualType: 'asc' }, { createdAt: 'desc' }],
      })
      return byType
    }

    return specific
  }

  // Supabase
  const supabase = await createSupabaseClient()

  // 1. Specifični manuale za vozilo
  const { data: specific } = await supabase
    .from('equipment_manuals')
    .select('*')
    .eq('equipment_id', equipmentId)
    .eq('active', true)
    .order('manual_type', { ascending: true })
    .order('created_at', { ascending: false })

  if (specific && specific.length > 0) {
    return specific.map(mapSupabaseManual)
  }

  // 2. Fallback: manuale po tipu opreme
  const { data: byType } = await supabase
    .from('equipment_manuals')
    .select('*')
    .eq('equipment_type', equipmentType)
    .is('equipment_id', null)
    .eq('active', true)
    .order('manual_type', { ascending: true })
    .order('created_at', { ascending: false })

  return (byType ?? []).map(mapSupabaseManual)
}

// =====================================================
// GET all manuals (for admin dashboard)
// =====================================================

export async function getAllManuals() {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    return db.equipmentManual.findMany({
      orderBy: [{ equipmentType: 'asc' }, { manualType: 'asc' }, { createdAt: 'desc' }],
    })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('equipment_manuals')
    .select('*')
    .order('equipment_type', { ascending: true })
    .order('manual_type', { ascending: true })
    .order('created_at', { ascending: false })

  return (data ?? []).map(mapSupabaseManual)
}

// =====================================================
// ADD manual
// =====================================================

export async function addManual(params: {
  equipmentId?: string
  equipmentCode?: string
  equipmentName?: string
  equipmentType: string
  title: string
  manualUrl: string
  manualType?: string
  language?: string
  version?: string
}) {
  await requireRole(['engineer', 'admin'])
  const user = await getCurrentUser()

  if (isDemoMode()) {
    const manual = await db.equipmentManual.create({
      data: {
        equipmentId: params.equipmentId ?? null,
        equipmentCode: params.equipmentCode ?? null,
        equipmentName: params.equipmentName ?? null,
        equipmentType: params.equipmentType,
        title: params.title,
        manualUrl: params.manualUrl,
        manualType: params.manualType ?? 'OPERATING',
        language: params.language ?? 'hr',
        version: params.version ?? null,
        uploadedBy: user?.full_name ?? null,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, id: manual.id }
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.from('equipment_manuals').insert({
    equipment_id: params.equipmentId ?? null,
    equipment_code: params.equipmentCode ?? null,
    equipment_name: params.equipmentName ?? null,
    equipment_type: params.equipmentType,
    title: params.title,
    manual_url: params.manualUrl,
    manual_type: params.manualType ?? 'OPERATING',
    language: params.language ?? 'hr',
    version: params.version ?? null,
    uploaded_by: user?.full_name ?? null,
  }).select().single()

  if (error) throw error
  revalidatePath('/dashboard')
  return { ok: true, id: data?.id }
}

// =====================================================
// DELETE manual
// =====================================================

export async function deleteManual(id: string) {
  await requireRole(['admin'])

  if (isDemoMode()) {
    await db.equipmentManual.delete({ where: { id } })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  await supabase.from('equipment_manuals').delete().eq('id', id)
  revalidatePath('/dashboard')
  return { ok: true }
}

// =====================================================
// Helper: map Supabase row to EquipmentManualData
// =====================================================

function mapSupabaseManual(m: any): EquipmentManualData {
  return {
    id: m.id,
    equipmentId: m.equipment_id,
    equipmentCode: m.equipment_code,
    equipmentName: m.equipment_name,
    equipmentType: m.equipment_type,
    title: m.title,
    manualUrl: m.manual_url,
    manualType: m.manual_type,
    language: m.language,
    fileSize: m.file_size,
    uploadedBy: m.uploaded_by,
    version: m.version,
    active: m.active,
    createdAt: new Date(m.created_at),
  }
}
