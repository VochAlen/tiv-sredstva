'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Smartphone, LayoutDashboard, Plane, LogOut, User, Wrench, ShieldCheck, ExternalLink, Loader2 } from 'lucide-react'
import { WorkerView } from '@/components/worker/worker-view'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { AppUser } from '@/lib/auth-server'

interface HomeContentProps {
  user: AppUser
  demoMode: boolean
}

export function HomeContent(props: HomeContentProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <HomeInner {...props} />
    </Suspense>
  )
}

function HomeInner({ user, demoMode }: HomeContentProps) {
  const sp = useSearchParams()
  const router = useRouter()
  const scanParam = sp.get('scan')
  const handledScanRef = useRef<string | null>(null)

  // Operator default = worker view; engineer/admin default = dashboard
  const [tab, setTab] = useState<'worker' | 'dashboard'>(user.role === 'operator' ? 'worker' : 'dashboard')
  const [initialScan, setInitialScan] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (scanParam && handledScanRef.current !== scanParam) {
      handledScanRef.current = scanParam
      setTab('worker')
      setInitialScan(scanParam)
      router.replace('/', { scroll: false })
    }
  }, [scanParam, router])

  const showDashboard = user.role === 'engineer' || user.role === 'admin'

  const handleLogout = async () => {
    await fetch('/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-40 print:hidden">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
              <Plane className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-base leading-tight truncate">GSE Control</div>
              <div className="text-[10px] text-muted-foreground leading-tight hidden sm:block">
                Ground Support Equipment Management
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs - samo vidljive one koje user može pristupiti */}
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'worker' | 'dashboard')}>
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="worker">
                  <Smartphone className="h-4 w-4" />
                  <span className="ml-1.5 hidden sm:inline">Radnik</span>
                </TabsTrigger>
                {showDashboard ? (
                  <TabsTrigger value="dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="ml-1.5 hidden sm:inline">Dashboard</span>
                  </TabsTrigger>
                ) : (
                  <TabsTrigger value="worker" disabled className="opacity-30 cursor-not-allowed">
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="ml-1.5 hidden sm:inline">Dashboard</span>
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>

            {/* User badge */}
            <div className="hidden md:flex items-center gap-2 px-2 py-1 rounded-lg border bg-muted/30">
              <RoleIcon role={user.role} />
              <div className="text-xs">
                <div className="font-medium leading-tight">{user.full_name}</div>
                <div className="text-muted-foreground leading-tight">{user.card_id ?? user.email}</div>
              </div>
              <RoleBadge role={user.role} />
            </div>

            <Link href="/fids" target="_blank">
              <Button variant="outline" size="sm" title="Otvori FIDS display">
                <ExternalLink className="h-4 w-4" />
                <span className="ml-1.5 hidden lg:inline">FIDS</span>
              </Button>
            </Link>

            <Button variant="ghost" size="sm" onClick={handleLogout} title="Odjava">
              <LogOut className="h-4 w-4" />
              <span className="ml-1.5 hidden lg:inline">Odjava</span>
            </Button>
          </div>
        </div>

        {/* Mobile user info */}
        <div className="md:hidden container mx-auto px-4 pb-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <RoleIcon role={user.role} />
            <span className="font-medium">{user.full_name}</span>
            <RoleBadge role={user.role} />
          </div>
          {demoMode && (
            <Badge variant="secondary" className="text-[10px]">Demo Mode</Badge>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container mx-auto px-4 py-4 sm:py-6 w-full max-w-7xl">
        {!showDashboard && tab === 'dashboard' ? (
          <div className="text-center py-20 text-muted-foreground">
            <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nemate dozvolu za pristup dashboard-u.</p>
            <p className="text-xs mt-1">Samo inženjeri i administratori mogu vidjeti ovu stranicu.</p>
          </div>
        ) : tab === 'worker' ? (
          <WorkerView initialScan={initialScan} defaultEmployeeName={user.full_name} defaultEmployeeCardId={user.card_id ?? ''} />
        ) : (
          <DashboardView currentUser={user} />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-background/95 py-3 px-4 text-center text-xs text-muted-foreground print:hidden">
        <span>GSE Control · IATA AHM 340 compliant pre-use inspection</span>
        {demoMode && <span className="ml-2 text-amber-600">· Demo Mode</span>}
      </footer>
    </div>
  )
}

function RoleIcon({ role }: { role: 'operator' | 'engineer' | 'admin' }) {
  if (role === 'admin') return <ShieldCheck className="h-4 w-4 text-purple-600" />
  if (role === 'engineer') return <Wrench className="h-4 w-4 text-orange-600" />
  return <User className="h-4 w-4 text-emerald-600" />
}

function RoleBadge({ role }: { role: 'operator' | 'engineer' | 'admin' }) {
  const config = {
    operator: { label: 'OPERATOR', cls: 'bg-emerald-100 text-emerald-800' },
    engineer: { label: 'INŽENJER', cls: 'bg-orange-100 text-orange-800' },
    admin: { label: 'ADMIN', cls: 'bg-purple-100 text-purple-800' },
  }[role]
  return (
    <Badge variant="outline" className={`text-[10px] ${config.cls}`}>
      {config.label}
    </Badge>
  )
}
