'use server'

import { isDemoMode } from '@/lib/auth-mode'
import { getCurrentUser } from '@/lib/auth-server'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { collectExpiring } from '@/lib/expiry-data'

/** Rokovi koji ističu u 30 dana (ili su istekli) — za ekran "Moj zadatak". */
export async function getExpiringSoon() {
  const user = await getCurrentUser()
  if (!user || user.role === 'operator') return []
  const client = isDemoMode() ? null : await createSupabaseClient()
  return collectExpiring(client, 30)
}
