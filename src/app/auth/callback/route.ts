import { NextResponse } from 'next/server'
import { createClientAsync } from '@/lib/supabase/server'

// GET /auth/callback — Supabase OAuth/email-confirm callback
// Supabase redirektuje ovdje nakon email confirmation, password reset, magic link
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClientAsync()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
