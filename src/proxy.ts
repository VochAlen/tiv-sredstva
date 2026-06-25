import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isDemoMode, DEMO_USERS } from './lib/auth-mode'

// Rute koje su javne (ne zahtijevaju auth)
// / je JAVNA - radnici skeniraju QR bez login-a
// /dashboard je ZAŠTIĆENA - samo admin/inženjer
const PUBLIC_ROUTES = ['/', '/login', '/fids', '/auth/callback', '/auth/demo-login', '/auth/logout', '/about', '/features']

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((r) => pathname === r || (r !== '/' && pathname.startsWith(r + '/')))
}

// Provjeri da li je cookie value validan user ID
function isValidSessionCookie(value: string | undefined): boolean {
  if (!value) return false
  return DEMO_USERS.some((u) => u.id === value)
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Uvijek dozvoli static assets i API rute
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname === '/logo.svg' ||
    pathname === '/robots.txt' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname.startsWith('/icon-')
  ) {
    return NextResponse.next()
  }

  // Demo/Mock mode - nema pravog Supabase auth, koristi cookie-based session
  if (isDemoMode()) {
    const sessionCookie = request.cookies.get('gse-session')
    const isValid = isValidSessionCookie(sessionCookie?.value)

    // Ako cookie postoji ali nije validan (stari cookie), obriši ga
    if (sessionCookie && !isValid) {
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('gse-session')
      return response
    }

    // Ako ima validan session cookie i pokušava pristupiti /login → preusmjeri na /dashboard
    if (isValid && pathname === '/login') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }

    // Ako nema validan session cookie i pokušava pristupiti /dashboard → redirect na /login
    if (!isValid && pathname === '/dashboard') {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    return NextResponse.next()
  }

  // Pravi Supabase mode
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Osvježi session
  const { data: { user } } = await supabase.auth.getUser()

  // Ako user nije ulogovan i pokušava pristupiti /dashboard → preusmjeri na /login
  if (!user && pathname === '/dashboard') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Ako je user ulogovan i pokušava pristupiti /login → preusmjeri na /dashboard
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.svg|robots.txt|manifest.json|sw.js|icon-).*)',
  ],
}
