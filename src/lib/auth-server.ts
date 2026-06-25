// Server-side auth helperi
// Radi sa Supabase Auth ili demo mode fallback

import { createClientAsync } from './supabase/server'
import { isDemoMode, DEMO_USERS, type DemoUser } from './auth-mode'
import { cookies } from 'next/headers'

export type AppUser = {
  id: string
  email: string
  full_name: string
  card_id: string | null
  role: 'operator' | 'engineer' | 'admin'
  department: string
}

// Dohvati trenutnog usera (iz Supabase ili demo cookie)
export async function getCurrentUser(): Promise<AppUser | null> {
  if (isDemoMode()) {
    return getDemoUserFromCookie()
  }

  const supabase = await createClientAsync()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Dohvati profile iz baze
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    // Fallback na metadata iz auth.users - ali siguran (operator je default)
    return {
      id: user.id,
      email: user.email ?? '',
      full_name: user.user_metadata?.full_name ?? user.email ?? '',
      card_id: user.user_metadata?.card_id ?? null,
      // Bez obzira na metadata, ako nema profile zapis, tretiraj kao operator
      // Trigger handle_new_user bi trebao uvijek kreirati profile, pa je ovo rijedak edge case
      role: 'operator',
      department: user.user_metadata?.department ?? 'Ramp',
    }
  }

  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name ?? '',
    card_id: profile.card_id,
    role: profile.role,
    department: profile.department ?? 'Ramp',
  }
}

// Demo mode: čita user ID iz cookie-ja
async function getDemoUserFromCookie(): Promise<AppUser | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('demo-session')
  if (!sessionCookie?.value) return null

  const user = DEMO_USERS.find((u) => u.id === sessionCookie.value)
  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    card_id: user.card_id,
    role: user.role,
    department: user.department,
  }
}

// Role helpers - koriste se u Server Actions (requireRole)
export function canAccessDashboard(user: AppUser | null): boolean {
  if (!user) return false
  return user.role === 'engineer' || user.role === 'admin'
}

export function canManageEquipment(user: AppUser | null): boolean {
  if (!user) return false
  return user.role === 'admin'
}

export function canResolveDamages(user: AppUser | null): boolean {
  if (!user) return false
  return user.role === 'engineer' || user.role === 'admin'
}

export function canManageUsers(user: AppUser | null): boolean {
  if (!user) return false
  return user.role === 'admin'
}
