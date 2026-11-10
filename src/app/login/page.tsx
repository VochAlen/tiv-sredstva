'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode, isSupabaseConfigured, DEMO_USERS, DEMO_PASSWORD, findDemoUserByEmail } from '@/lib/auth-mode'
import { Plane, LogIn, Loader2, AlertCircle, User, Wrench, ShieldCheck, Sun, Moon, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import { LanguageToggle } from '@/components/language-toggle'
import { useLang } from '@/lib/lang-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

type Theme = 'dark' | 'light'
// Isti ključ kao landing, pa se tema pamti između početne i prijave.
const THEME_STORAGE_KEY = 'gse-landing-theme'

const DARK = {
  pageBg: '#0B0E11', text: '#EDEFF2', textMuted: '#AEB6BF', textFaint: '#8A94A0',
  headerBg: 'rgba(11,14,17,0.92)', cardBg: '#12161B', cardBorder: 'rgba(255,255,255,0.08)', inputBg: '#0B0E11',
  footerBorder: 'rgba(255,255,255,0.08)', footerText: '#6B7480',
  btnBorder: 'rgba(255,255,255,0.15)', btnBg: 'rgba(255,255,255,0.05)',
  heroOverlay: 'linear-gradient(to top, rgba(11,14,17,0.95) 0%, rgba(11,14,17,0.6) 50%, rgba(11,14,17,0.3) 100%)',
  heroText: '#EDEFF2', heroTextMuted: '#D7DBE0', heroTagBg: 'rgba(11,14,17,0.55)',
}
const LIGHT: typeof DARK = {
  pageBg: '#F4F5F7', text: '#12161B', textMuted: '#495057', textFaint: '#6B7480',
  headerBg: 'rgba(244,245,247,0.92)', cardBg: '#FFFFFF', cardBorder: 'rgba(11,14,17,0.1)', inputBg: '#FFFFFF',
  footerBorder: 'rgba(11,14,17,0.08)', footerText: '#8A94A0',
  btnBorder: 'rgba(11,14,17,0.14)', btnBg: 'rgba(11,14,17,0.03)',
  heroOverlay: 'linear-gradient(to top, rgba(244,245,247,0.96) 0%, rgba(244,245,247,0.65) 50%, rgba(244,245,247,0.3) 100%)',
  heroText: '#12161B', heroTextMuted: '#3C4248', heroTagBg: 'rgba(244,245,247,0.8)',
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [demoMode, setDemoMode] = useState(false)
  const [supabaseConfigured, setSupabaseConfigured] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [theme, setTheme] = useState<Theme>('dark')
  const { t } = useLang()

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
      if (saved === 'light' || saved === 'dark') setTheme(saved)
    } catch { /* ostaje zadana tema */ }
  }, [])

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try { window.localStorage.setItem(THEME_STORAGE_KEY, next) } catch { /* prekidač radi i bez čuvanja */ }
  }

  useEffect(() => {
    setDemoMode(isDemoMode())
    setSupabaseConfigured(isSupabaseConfigured())
  }, [])

  const handleDemoLogin = async (userEmail: string) => {
    // Postavi state da se input vizuelno ažurira
    setEmail(userEmail)
    setPassword(DEMO_PASSWORD)
    // Direktno pozovi login logiku sa overrideanim vrijednostima
    // (React state je async, pa ne možemo čekati setEmail da propagira)
    await performLogin(userEmail, DEMO_PASSWORD)
  }

  const performLogin = async (loginEmail: string, loginPassword: string) => {
    setError(null)
    setLoading(true)

    try {
      if (demoMode) {
        const user = findDemoUserByEmail(loginEmail)
        if (!user || loginPassword !== DEMO_PASSWORD) {
          setError('Pogrešan email ili lozinka. Pokušajte sa demo korisnikom (vidi ispod).')
          setLoading(false)
          return
        }
        const res = await fetch('/auth/demo-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        })
        if (!res.ok) throw new Error('Demo login failed')
        router.push(redirect)
        router.refresh()
        return
      }

      // Pravi Supabase auth
      const supabase = createClient()
      const { error: signInError, data } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      })

      if (signInError) {
        // Bolje error poruke na osnovu tipa greške
        if (signInError.message.includes('Email not confirmed')) {
          setError('Email nije potvrđen. U Supabase Dashboard → Authentication → Users, kliknite na korisnika i označite "Confirm user".')
        } else if (signInError.message.includes('Invalid login credentials')) {
          setError('Pogrešan email ili lozinka. Provjerite da li je korisnik kreiran u Supabase Dashboard → Authentication → Users.')
        } else {
          setError(signInError.message)
        }
        setLoading(false)
        return
      }

      if (data.user) {
        router.push(redirect)
        router.refresh()
      } else {
        setError('Login uspješan ali sesija nije kreirana. Pokušajte ponovo.')
      }
    } catch (err: any) {
      setError(err?.message ?? 'Greška pri prijavi')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await performLogin(email, password)
  }

  const c = theme === 'dark' ? DARK : LIGHT
  const inputStyle = { backgroundColor: c.inputBg, borderColor: c.cardBorder, color: c.text }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: c.pageBg, color: c.text }}>
      <header className="sticky top-0 z-40" style={{ backgroundColor: c.headerBg, backdropFilter: 'blur(8px)', borderBottom: '2px solid #F2A516' }}>
        <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-5 sm:py-2.5">
          <Link href="/" aria-label="GSE Control - početna stranica" className="flex items-center gap-2 min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2A516]">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F2A516' }}>
              <Plane className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: '#0B0E11' }} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm sm:text-base leading-tight truncate">GSE Control</div>
              <div className="text-[10px] leading-tight truncate hidden sm:block" style={{ color: c.textFaint }}>Ground Support Equipment Management</div>
            </div>
          </Link>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button type="button" variant="outline" size="icon" className="h-9 w-9"
              aria-label={theme === 'dark' ? t('theme.toggleToLight') : t('theme.toggleToDark')}
              title={theme === 'dark' ? t('theme.toggleToLight') : t('theme.toggleToDark')}
              onClick={toggleTheme}
              style={{ borderColor: c.btnBorder, backgroundColor: c.btnBg, color: c.text }}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <LanguageToggle />
            <Link href="/fids">
              <Button variant="outline" size="sm" className="h-9" style={{ borderColor: c.btnBorder, backgroundColor: c.btnBg, color: c.text }}>
                FIDS
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 grid lg:grid-cols-2">
        {/* Brend panel (samo desktop) */}
        <div className="relative hidden lg:block overflow-hidden">
          <Image src="/images/hero-tivat-apron.jpg" alt="" fill priority sizes="50vw" className="object-cover" />
          <div className="absolute inset-0" style={{ background: c.heroOverlay }} />
          <div className="relative h-full flex flex-col justify-end p-10 xl:p-14 max-w-xl" style={{ color: c.heroText }}>
            <h2 className="text-4xl font-bold leading-tight" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {t('hero.headlineLine1')}<br /><span style={{ color: '#F2A516' }}>{t('hero.headlineLine2')}</span>
            </h2>
            <p className="mt-4 text-base" style={{ color: c.heroTextMuted }}>{t('hero.subhead')}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {(['hero.tag1', 'hero.tag2', 'hero.tag3'] as const).map((k) => (
                <span key={k} className="text-xs rounded-full px-3 py-1 border" style={{ backgroundColor: c.heroTagBg, borderColor: c.btnBorder }}>{t(k)}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Forma */}
        <div className="flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md space-y-4">
            <div className="rounded-2xl border p-6 sm:p-8 shadow-sm" style={{ backgroundColor: c.cardBg, borderColor: c.cardBorder }}>
              <div className="mb-6">
                <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{t('login.title')}</h1>
                <p className="text-sm mt-1" style={{ color: c.textMuted }}>Dobrodošli nazad. Prijavite se na GSE Control.</p>
                {demoMode && (
                  <span className="inline-block mt-3 text-xs rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(242,165,22,0.15)', color: theme === 'dark' ? '#F2A516' : '#8A5A00' }}>
                    {t('login.demoMode')}
                  </span>
                )}
              </div>
              <form id="login-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t('login.email')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: c.textFaint }} />
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="operator@gse.control" autoComplete="email" className="h-11 pl-10" style={inputStyle} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">{t('login.password')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: c.textFaint }} />
                    <Input id="password" type={showPw ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" autoComplete="current-password" className="h-11 pl-10 pr-11" style={inputStyle} />
                    <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Sakrij lozinku' : 'Prikaži lozinku'}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-md" style={{ color: c.textFaint }}>
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {error && (
                  <div role="alert" className="flex items-start gap-2 text-sm p-3 rounded-lg border" style={{ color: theme === 'dark' ? '#FF8A84' : '#B3261E', backgroundColor: 'rgba(227,71,63,0.12)', borderColor: 'rgba(227,71,63,0.35)' }}>
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                <Button type="submit" disabled={loading} className="w-full h-11 text-base font-semibold hover:opacity-90" style={{ backgroundColor: '#F2A516', color: '#0B0E11' }}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
                  {t('login.submit')}
                </Button>
              </form>
            </div>

            {demoMode && (
              <div className="rounded-2xl border p-4 space-y-2" style={{ backgroundColor: c.cardBg, borderColor: c.cardBorder }}>
                <div className="text-sm font-semibold">{t('login.demoUsers')}</div>
                {DEMO_USERS.map((user) => {
                  const Icon = user.role === 'admin' ? ShieldCheck : user.role === 'engineer' ? Wrench : User
                  const roleLabel = user.role === 'admin' ? 'ADMINISTRATOR' : user.role === 'engineer' ? 'INŽENJER' : 'OPERATOR'
                  const description =
                    user.role === 'admin'
                      ? 'Pun pristup — upravlja opremom, korisnicima, statusima'
                      : user.role === 'engineer'
                      ? 'Vidi Dashboard + rješava prijave oštećenja'
                      : 'Vidi samo Radnik view — skenira QR, popunjava check-listu'
                  return (
                    <DemoUserButton key={user.id} icon={<Icon className="h-4 w-4" />} name={user.full_name} email={user.email}
                      role={roleLabel} description={description} onClick={() => handleDemoLogin(user.email)} c={c} />
                  )
                })}
                <p className="text-xs pt-1" style={{ color: c.textFaint }}>
                  {t('login.demoPassword')}: <code className="px-1 py-0.5 rounded" style={{ backgroundColor: c.btnBg }}>{DEMO_PASSWORD}</code>
                </p>
              </div>
            )}

            <div className="text-center">
              <Link href="/" className="inline-flex items-center gap-1.5 text-sm hover:underline" style={{ color: c.textMuted }}>
                <ArrowLeft className="h-4 w-4" />Nazad na početnu
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t py-3 text-center text-xs" style={{ borderColor: c.footerBorder, color: c.footerText }}>
        GSE Control · IATA AHM 340 compliant
      </footer>
    </div>
  )
}

function DemoUserButton({
  icon, name, email, role, description, onClick, c,
}: {
  icon: React.ReactNode
  name: string
  email: string
  role: string
  description: string
  onClick: () => void
  c: typeof DARK
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl border transition flex items-start gap-3 hover:brightness-110"
      style={{ backgroundColor: c.btnBg, borderColor: c.btnBorder, color: c.text }}
    >
      <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(242,165,22,0.18)', color: '#F2A516' }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{name}</span>
          <span className="text-[10px] rounded-full border px-2 py-0.5" style={{ borderColor: c.btnBorder, color: c.textMuted }}>{role}</span>
        </div>
        <div className="text-xs mt-0.5" style={{ color: c.textMuted }}>{description}</div>
        <div className="text-xs font-mono mt-0.5" style={{ color: c.textFaint }}>{email}</div>
      </div>
    </button>
  )
}
