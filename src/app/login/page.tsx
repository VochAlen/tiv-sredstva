'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode, isSupabaseConfigured, DEMO_USERS, DEMO_PASSWORD, findDemoUserByEmail } from '@/lib/auth-mode'
import { Plane, LogIn, Loader2, AlertCircle, User, Wrench, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'

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

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/30">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Plane className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-base leading-tight">GSE Control</div>
              <div className="text-[10px] text-muted-foreground leading-tight">
                Ground Support Equipment Management
              </div>
            </div>
          </div>
          <Link href="/fids">
            <Button variant="outline" size="sm">
              FIDS Display
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <LogIn className="h-5 w-5" />
                Prijava
              </CardTitle>
              {demoMode && (
                <Badge variant="secondary" className="mx-auto w-fit">
                  Demo Mode — Supabase nije konfigurisan
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <form id="login-form" onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@gse.control"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Lozinka</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Prijavi se
                </Button>
              </form>
            </CardContent>
          </Card>

          {demoMode && (
            <Card className="bg-muted/30">
              <CardHeader>
                <CardTitle className="text-sm">Demo korisnici (jedan klik za prijavu)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
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
                    <DemoUserButton
                      key={user.id}
                      icon={<Icon className="h-4 w-4" />}
                      name={user.full_name}
                      email={user.email}
                      role={roleLabel}
                      description={description}
                      onClick={() => handleDemoLogin(user.email)}
                    />
                  )
                })}
                <Separator className="my-2" />
                <p className="text-xs text-muted-foreground">
                  Lozinka za sve demo korisnike: <code className="bg-muted px-1 py-0.5 rounded">{DEMO_PASSWORD}</code>
                </p>
                <p className="text-xs text-muted-foreground">
                  U produkciji, konfigurišite Supabase (vidi <code>supabase/migrations/001_initial_schema.sql</code>).
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <footer className="border-t py-3 text-center text-xs text-muted-foreground">
        GSE Control · IATA AHM 340 compliant
      </footer>
    </div>
  )
}

function DemoUserButton({
  icon,
  name,
  email,
  role,
  description,
  onClick,
}: {
  icon: React.ReactNode
  name: string
  email: string
  role: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border bg-background hover:bg-accent transition flex items-start gap-3"
    >
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{name}</span>
          <Badge variant="outline" className="text-[10px]">{role}</Badge>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        <div className="text-xs font-mono text-muted-foreground mt-0.5">{email}</div>
      </div>
    </button>
  )
}
