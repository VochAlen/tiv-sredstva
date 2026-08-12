'use server'

// ADR.OPS.C.005 - Driver Authorization za Movement Area
// Ko smije na koju zonu aerodroma

import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser, type AppUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function requireRole(roles: Array<'operator' | 'engineer' | 'admin'>): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Morate biti ulogovani')
  if (!roles.includes(user.role)) throw new Error(`Nemate dozvolu. Potrebna rola: ${roles.join(' ili ')}`)
  return user
}

export interface DriverAuthData {
  id: string
  employeeCardId: string
  employeeName: string
  category1: boolean
  category2: boolean
  category3: boolean
  licenseNumber: string | null
  issuedAt: Date | null
  validUntil: Date | null
  issuedBy: string | null
  trainingCompleted: boolean
  trainingDate: Date | null
  trainingExpiry: Date | null
  active: boolean
  suspendedAt: Date | null
  suspendReason: string | null
  createdAt: Date
}

// =====================================================
// CHECK authorization — javna funkcija (poziva se iz checkout)
// =====================================================

export async function checkDriverAuthorization(employeeCardId: string): Promise<{ authorized: boolean; reason?: string; categories?: string[] }> {
  if (isDemoMode()) {
    const auth = await db.driverAuthorization.findUnique({
      where: { employeeCardId: employeeCardId.toUpperCase() },
    })

    if (!auth || !auth.active) {
      return { authorized: false, reason: 'Nemate važeću vozačku dozvolu za airside. Kontaktirajte supervizora.' }
    }

    // Provjeri datum isteka dozvole
    if (auth.validUntil && new Date(auth.validUntil) < new Date()) {
      return { authorized: false, reason: 'Vaša airside vozačka dozvola je istekla. Kontaktirajte supervizora.' }
    }

    // Provjeri obuku
    if (auth.trainingExpiry && new Date(auth.trainingExpiry) < new Date()) {
      return { authorized: false, reason: 'Vaša obuka za airside vožnju je istekla. Kontaktirajte supervizora.' }
    }

    const cats: string[] = []
    if (auth.category1) cats.push('Cat.1 (Airside)')
    if (auth.category2) cats.push('Cat.2 (Maneuvering)')
    if (auth.category3) cats.push('Cat.3 (Runway)')

    return { authorized: true, categories: cats }
  }

  // Supabase
  const supabase = await createSupabaseClient()
  const { data: auth } = await supabase
    .from('driver_authorizations')
    .select('*')
    .eq('employee_card_id', employeeCardId.toUpperCase())
    .single()

  if (!auth || !auth.active) {
    return { authorized: false, reason: 'Nemate važeću vozačku dozvolu za airside.' }
  }

  if (auth.valid_until && new Date(auth.valid_until) < new Date()) {
    return { authorized: false, reason: 'Vaša airside vozačka dozvola je istekla.' }
  }

  if (auth.training_expiry && new Date(auth.training_expiry) < new Date()) {
    return { authorized: false, reason: 'Vaša obuka za airside vožnju je istekla.' }
  }

  const cats: string[] = []
  if (auth.category1) cats.push('Cat.1 (Airside)')
  if (auth.category2) cats.push('Cat.2 (Maneuvering)')
  if (auth.category3) cats.push('Cat.3 (Runway)')

  return { authorized: true, categories: cats }
}

// =====================================================
// GET all driver authorizations
// =====================================================

export async function getDriverAuthorizations() {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    return db.driverAuthorization.findMany({ orderBy: { employeeName: 'asc' } })
  }

  const supabase = await createSupabaseClient()
  const { data } = await supabase.from('driver_authorizations').select('*').order('employee_name', { ascending: true })

  return (data ?? []).map((a: any) => ({
    id: a.id,
    employeeCardId: a.employee_card_id,
    employeeName: a.employee_name,
    category1: a.category1,
    category2: a.category2,
    category3: a.category3,
    licenseNumber: a.license_number,
    issuedAt: a.issued_at ? new Date(a.issued_at) : null,
    validUntil: a.valid_until ? new Date(a.valid_until) : null,
    issuedBy: a.issued_by,
    trainingCompleted: a.training_completed,
    trainingDate: a.training_date ? new Date(a.training_date) : null,
    trainingExpiry: a.training_expiry ? new Date(a.training_expiry) : null,
    active: a.active,
    suspendedAt: a.suspended_at ? new Date(a.suspended_at) : null,
    suspendReason: a.suspend_reason,
    createdAt: new Date(a.created_at),
  }))
}

// =====================================================
// ADD driver authorization
// =====================================================

export async function addDriverAuthorization(params: {
  employeeCardId: string
  employeeName: string
  category1?: boolean
  category2?: boolean
  category3?: boolean
  licenseNumber?: string
  issuedAt?: string
  validUntil?: string
  issuedBy?: string
  trainingDate?: string
  trainingExpiry?: string
}) {
  await requireRole(['admin'])

  if (isDemoMode()) {
    const existing = await db.driverAuthorization.findUnique({
      where: { employeeCardId: params.employeeCardId.toUpperCase() },
    })
    if (existing) return { ok: false, error: 'Radnik već ima dozvolu' }

    const auth = await db.driverAuthorization.create({
      data: {
        employeeCardId: params.employeeCardId.toUpperCase(),
        employeeName: params.employeeName,
        category1: params.category1 ?? false,
        category2: params.category2 ?? false,
        category3: params.category3 ?? false,
        licenseNumber: params.licenseNumber ?? null,
        issuedAt: params.issuedAt ? new Date(params.issuedAt) : null,
        validUntil: params.validUntil ? new Date(params.validUntil) : null,
        issuedBy: params.issuedBy ?? null,
        trainingCompleted: true,
        trainingDate: params.trainingDate ? new Date(params.trainingDate) : null,
        trainingExpiry: params.trainingExpiry ? new Date(params.trainingExpiry) : null,
      },
    })
    revalidatePath('/dashboard')
    return { ok: true, id: auth.id }
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.from('driver_authorizations').insert({
    employee_card_id: params.employeeCardId.toUpperCase(),
    employee_name: params.employeeName,
    category1: params.category1 ?? false,
    category2: params.category2 ?? false,
    category3: params.category3 ?? false,
    license_number: params.licenseNumber ?? null,
    issued_at: params.issuedAt ?? null,
    valid_until: params.validUntil ?? null,
    issued_by: params.issuedBy ?? null,
    training_completed: true,
    training_date: params.trainingDate ?? null,
    training_expiry: params.trainingExpiry ?? null,
  }).select().single()

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Radnik već ima dozvolu' }
    throw error
  }
  revalidatePath('/dashboard')
  return { ok: true, id: data?.id }
}

// =====================================================
// UPDATE driver authorization
// =====================================================

export async function updateDriverAuthorization(params: {
  id: string
  category1?: boolean
  category2?: boolean
  category3?: boolean
  validUntil?: string
  trainingExpiry?: string
  active?: boolean
  suspendReason?: string
}) {
  await requireRole(['admin'])

  if (isDemoMode()) {
    await db.driverAuthorization.update({
      where: { id: params.id },
      data: {
        ...(params.category1 !== undefined ? { category1: params.category1 } : {}),
        ...(params.category2 !== undefined ? { category2: params.category2 } : {}),
        ...(params.category3 !== undefined ? { category3: params.category3 } : {}),
        ...(params.validUntil !== undefined ? { validUntil: params.validUntil ? new Date(params.validUntil) : null } : {}),
        ...(params.trainingExpiry !== undefined ? { trainingExpiry: params.trainingExpiry ? new Date(params.trainingExpiry) : null } : {}),
        ...(params.active !== undefined ? { active: params.active, suspendedAt: params.active === false ? new Date() : null, suspendReason: params.suspendReason ?? null } : {}),
      },
    })
    revalidatePath('/dashboard')
    return { ok: true }
  }

  const supabase = await createSupabaseClient()
  const update: Record<string, unknown> = {}
  if (params.category1 !== undefined) update.category1 = params.category1
  if (params.category2 !== undefined) update.category2 = params.category2
  if (params.category3 !== undefined) update.category3 = params.category3
  if (params.validUntil !== undefined) update.valid_until = params.validUntil || null
  if (params.trainingExpiry !== undefined) update.training_expiry = params.trainingExpiry || null
  if (params.active !== undefined) {
    update.active = params.active
    update.suspended_at = params.active === false ? new Date().toISOString() : null
    update.suspend_reason = params.suspendReason ?? null
  }

  await supabase.from('driver_authorizations').update(update).eq('id', params.id)
  revalidatePath('/dashboard')
  return { ok: true }
}

// =====================================================
// GET driver auth statistics
// =====================================================

export async function getDriverAuthStats() {
  await requireRole(['engineer', 'admin'])

  if (isDemoMode()) {
    const today = new Date()
    const [total, active, expired, expiringSoon, suspended, cat1, cat2, cat3] = await Promise.all([
      db.driverAuthorization.count(),
      db.driverAuthorization.count({ where: { active: true } }),
      db.driverAuthorization.count({ where: { validUntil: { lt: today } } }),
      db.driverAuthorization.count({ where: { validUntil: { gte: today, lte: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) } } }),
      db.driverAuthorization.count({ where: { active: false } }),
      db.driverAuthorization.count({ where: { category1: true } }),
      db.driverAuthorization.count({ where: { category2: true } }),
      db.driverAuthorization.count({ where: { category3: true } }),
    ])

    return { total, active, expired, expiringSoon, suspended, cat1, cat2, cat3 }
  }

  // Supabase — paralelno
  const supabase = await createSupabaseClient()
  const todayISO = new Date().toISOString()
  const thirtyDaysISO = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const [totalRes, activeRes, expiredRes, expiringRes, suspendedRes, cat1Res, cat2Res, cat3Res] = await Promise.all([
    supabase.from('driver_authorizations').select('*', { count: 'exact', head: true }),
    supabase.from('driver_authorizations').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase.from('driver_authorizations').select('*', { count: 'exact', head: true }).lt('valid_until', todayISO),
    supabase.from('driver_authorizations').select('*', { count: 'exact', head: true }).gte('valid_until', todayISO).lte('valid_until', thirtyDaysISO),
    supabase.from('driver_authorizations').select('*', { count: 'exact', head: true }).eq('active', false),
    supabase.from('driver_authorizations').select('*', { count: 'exact', head: true }).eq('category1', true),
    supabase.from('driver_authorizations').select('*', { count: 'exact', head: true }).eq('category2', true),
    supabase.from('driver_authorizations').select('*', { count: 'exact', head: true }).eq('category3', true),
  ])

  return {
    total: totalRes.count ?? 0,
    active: activeRes.count ?? 0,
    expired: expiredRes.count ?? 0,
    expiringSoon: expiringRes.count ?? 0,
    suspended: suspendedRes.count ?? 0,
    cat1: cat1Res.count ?? 0,
    cat2: cat2Res.count ?? 0,
    cat3: cat3Res.count ?? 0,
  }
}
