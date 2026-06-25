import { NextRequest, NextResponse } from 'next/server'
import { createClientAsync } from '@/lib/supabase/server'
import { isDemoMode } from '@/lib/auth-mode'

// POST /auth/logout — briše session (i Supabase i demo)
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true })

  if (isDemoMode()) {
    response.cookies.delete('demo-session')
    return response
  }

  const supabase = await createClientAsync()
  await supabase.auth.signOut()
  return response
}
