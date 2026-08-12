'use server'

// EASA Part-145.A.50 - Certificate of Release to Service (CRS)
// Bez važećeg CRS, oprema ne može biti vraćena u upotrebu nakon popravke

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

export interface CRSData {
  id: string
  crsNumber: string
  equipmentId: string
  equipmentCode: string
  equipmentName: string
  damageReportId: string | null
  maintenanceLogId: string | null
  workDescription: string
  workOrderNumber: string | null
  certifierCardId: string
  certifierName: string
  certifierRole: string
  status: string
  releaseDate: Date
  validUntil: Date | null
  notes: string | null
  createdAt: Date
}

// =====================================================
// GET all CRS
// =====================================================

export async function getAllCRS() {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    return db.certificateOfRelease.findMany({
      orderBy: { releaseDate: 'desc' },
    })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('certificates_of_release')
    .select('*')
    .order('release_date', { ascending: false })

  return (data ?? []).map(mapSupabaseCRS)
}

// =====================================================
// GET valid CRS for equipment
// Javna funkcija - radnici mogu provjeriti bez login-a
// =====================================================

export async function getValidCRSForEquipment(equipmentId: string): Promise<CRSData | null> {
  if (isDemoMode()) {
    const crs = await db.certificateOfRelease.findFirst({
      where: { equipmentId, status: 'VALID' },
      orderBy: { releaseDate: 'desc' },
    })
    return crs
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase
    .from('certificates_of_release')
    .select('*')
    .eq('equipment_id', equipmentId)
    .eq('status', 'VALID')
    .order('release_date', { ascending: false })
    .limit(1)
    .single()

  if (!data) return null
  return mapSupabaseCRS(data)
}

// =====================================================
// CREATE CRS
// =====================================================

export async function createCRS(params: {
  equipmentId: string
  equipmentCode: string
  equipmentName: string
  damageReportId?: string
  maintenanceLogId?: string
  workDescription: string
  workOrderNumber?: string
  certifierCardId: string
  certifierName: string
  certifierRole?: string
  validUntil?: string
  notes?: string
}) {
  await requireRole(['engineer', 'admin'])

  // Generiši CRS broj: CRS-2026-XXX
  const year = new Date().getFullYear()
  let crsNumber = ''

  if (isDemoMode()) {
    const count = await db.certificateOfRelease.count()
    crsNumber = `CRS-${year}-${String(count + 1).padStart(3, '0')}`

    const crs = await db.certificateOfRelease.create({
      data: {
        crsNumber,
        equipmentId: params.equipmentId,
        equipmentCode: params.equipmentCode,
        equipmentName: params.equipmentName,
        damageReportId: params.damageReportId ?? null,
        maintenanceLogId: params.maintenanceLogId ?? null,
        workDescription: params.workDescription,
        workOrderNumber: params.workOrderNumber ?? null,
        certifierCardId: params.certifierCardId,
        certifierName: params.certifierName,
        certifierRole: params.certifierRole ?? 'CERTIFYING_STAFF',
        validUntil: params.validUntil ? new Date(params.validUntil) : null,
        notes: params.notes ?? null,
      },
    })

    // Ako je CRS povezan sa damage report-om, označi damage kao RESOLVED
    if (params.damageReportId) {
      await db.damageReport.update({
        where: { id: params.damageReportId },
        data: {
          status: 'RESOLVED',
          resolution: params.workDescription,
          resolvedAt: new Date(),
        },
      })
    }

    // Vrati opremu u AVAILABLE
    await db.equipment.update({
      where: { id: params.equipmentId },
      data: { status: 'AVAILABLE', notes: `CRS ${crsNumber} izdat ${new Date().toLocaleDateString('hr-HR')}` },
    })

    revalidatePath('/dashboard')
    return { ok: true, id: crs.id, crsNumber }
  }

  // Supabase
  const supabase = await createSupabaseClient()

  // Generiši broj
  const { count } = await supabase
    .from('certificates_of_release')
    .select('*', { count: 'exact', head: true })

  crsNumber = `CRS-${year}-${String((count ?? 0) + 1).padStart(3, '0')}`

  const { data, error } = await supabase.from('certificates_of_release').insert({
    crs_number: crsNumber,
    equipment_id: params.equipmentId,
    equipment_code: params.equipmentCode,
    equipment_name: params.equipmentName,
    damage_report_id: params.damageReportId ?? null,
    maintenance_log_id: params.maintenanceLogId ?? null,
    work_description: params.workDescription,
    work_order_number: params.workOrderNumber ?? null,
    certifier_card_id: params.certifierCardId,
    certifier_name: params.certifierName,
    certifier_role: params.certifierRole ?? 'CERTIFYING_STAFF',
    valid_until: params.validUntil ?? null,
    notes: params.notes ?? null,
  }).select().single()

  if (error) throw error

  // Ako je povezan sa damage report-om
  if (params.damageReportId) {
    await supabase.from('damage_reports').update({
      status: 'RESOLVED',
      resolution: params.workDescription,
      resolved_at: new Date().toISOString(),
    }).eq('id', params.damageReportId)
  }

  // Vrati opremu u AVAILABLE
  await supabase.from('equipment').update({
    status: 'AVAILABLE',
    notes: `CRS ${crsNumber} izdat ${new Date().toLocaleDateString('hr-HR')}`,
  }).eq('id', params.equipmentId)

  revalidatePath('/dashboard')
  return { ok: true, id: data?.id, crsNumber }
}

// =====================================================
// REVOKE CRS
// =====================================================

export async function revokeCRS(crsId: string, reason: string) {
  await requireRole(['admin'])

  if (isDemoMode()) {
    await db.certificateOfRelease.update({
      where: { id: crsId },
      data: { status: 'REVOKED', notes: reason },
    })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  await supabase.from('certificates_of_release').update({
    status: 'REVOKED',
    notes: reason,
  }).eq('id', crsId)

  revalidatePath('/dashboard')
  return { ok: true }
}

// =====================================================
// Helper
// =====================================================

function mapSupabaseCRS(c: any): CRSData {
  return {
    id: c.id,
    crsNumber: c.crs_number,
    equipmentId: c.equipment_id,
    equipmentCode: c.equipment_code,
    equipmentName: c.equipment_name,
    damageReportId: c.damage_report_id,
    maintenanceLogId: c.maintenance_log_id,
    workDescription: c.work_description,
    workOrderNumber: c.work_order_number,
    certifierCardId: c.certifier_card_id,
    certifierName: c.certifier_name,
    certifierRole: c.certifier_role,
    status: c.status,
    releaseDate: new Date(c.release_date),
    validUntil: c.valid_until ? new Date(c.valid_until) : null,
    notes: c.notes,
    createdAt: new Date(c.created_at),
  }
}
