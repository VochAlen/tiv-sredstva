import { NextRequest, NextResponse } from 'next/server'
import { isDemoMode, DEMO_USERS } from '@/lib/auth-mode'

// POST /auth/demo-login — postavlja demo session cookie
// Radi samo u Demo načinu rada (kada Supabase nije konfigurisan)
export async function POST(request: NextRequest) {
  // Sigurnosna provjera - nikada ne dozvoli u Production
  if (!isDemoMode()) {
    return NextResponse.json(
      { error: 'Demo login not available in production mode' },
      { status: 403 }
    )
  }

  const { userId } = await request.json()
  const user = DEMO_USERS.find((u) => u.id === userId)
  if (!user) {
    return NextResponse.json({ error: 'Invalid demo user' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('demo-session', user.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 dana
  })
  return response
}
