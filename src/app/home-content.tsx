'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Smartphone,
  LayoutDashboard,
  Plane,
  LogOut,
  User,
  Wrench,
  ShieldCheck,
  ExternalLink,
  Loader2,
  MoreVertical,
} from 'lucide-react'
import { WorkerView } from '@/components/worker/worker-view'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

// =====================================================
// LANDING PAGE — redizajnirano za telefone (Motorola G34 5G, Redmi 13 i
// slični uređaji sa ~390-412px CSS širine). Cilj: header koji ne guta
// prostor i ne prikazuje dugmad koja operator ne može koristiti.
//
// Operator (glavni korisnik telefona) nikad ne vidi Dashboard, pa stari
// header je svejedno prikazivao onemogućen "Dashboard" tab - čist šum.
// Sada: operator vidi samo brend + kompaktan meni (FIDS, odjava).
// Inženjer/admin i dalje imaju segment-switch Radnik/Dashboard, ali bez
// duplog reda sa korisničkim podacima - to je sada u meniju.
//
// Sadržaj WorkerView/DashboardView nije mijenjan - samo "školjka" oko njih.
// =====================================================

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
      {/* Header — jedan red, fiksna visina, bez skrivanja/pojavljivanja
          elemenata na raznim širinama (to je ranije pravilo nejednaku
          visinu headera i "skakanje" layout-a na uskim telefonima). */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-40 print:hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
              <Plane className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm sm:text-base leading-tight truncate">GSE Control</div>
              <div className="text-[11px] text-muted-foreground leading-tight truncate flex items-center gap-1">
                <span className="truncate">{user.full_name}</span>
                <RoleBadge role={user.role} compact />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Segment-switch Radnik/Dashboard - samo za inženjera/admina.
                Operator ga nikad ne vidi (showDashboard=false), tako da
                nema praznog/onemogućenog dugmeta na njegovom ekranu. */}
            {showDashboard && (
              <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
                <button
                  type="button"
                  onClick={() => setTab('worker')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${tab === 'worker' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span className="hidden min-[400px]:inline">Radnik</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('dashboard')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${tab === 'dashboard' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span className="hidden min-[400px]:inline">Dashboard</span>
                </button>
              </div>
            )}

            {/* Sekundarne akcije (FIDS, odjava) - jedno dugme umjesto reda
                dugmića koji su se na uskim telefonima lomili u drugi red. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <RoleIcon role={user.role} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{user.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.card_id ?? user.email}</div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/fids" target="_blank" className="flex items-center gap-2 cursor-pointer">
                    <ExternalLink className="h-4 w-4" />
                    Otvori FIDS display
                  </Link>
                </DropdownMenuItem>
                {demoMode && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1">
                      <Badge variant="secondary" className="text-[10px]">Demo Mode</Badge>
                    </div>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600">
                  <LogOut className="h-4 w-4" />
                  Odjava
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      {/* Dashboard (sidebar layout) treba punu širinu - bez centriranog max-w-7xl kontejnera. Radnik tab je uvijek uzan i centriran (telefon-first). */}
      <main className={tab === 'dashboard' && showDashboard ? 'flex-1 w-full min-h-0' : 'flex-1 w-full px-3 py-3 sm:px-4 sm:py-6'}>
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

      {/* Footer — sakriven na telefonima (ispod sm breakpoint-a) da ne
          krade vertikalni prostor dok radnik popunjava checklistu;
          vidljiv na tabletu/desktopu. */}
      <footer className="hidden sm:block mt-auto border-t bg-background/95 py-3 px-4 text-center text-xs text-muted-foreground print:hidden">
        <span>GSE Control · IATA AHM 340 compliant pre-use inspection</span>
        {demoMode && <span className="ml-2 text-amber-600">· Demo Mode</span>}
      </footer>
    </div>
  )
}

function RoleIcon({ role }: { role: 'operator' | 'engineer' | 'admin' }) {
  if (role === 'admin') return <ShieldCheck className="h-4 w-4 text-purple-600 flex-shrink-0" />
  if (role === 'engineer') return <Wrench className="h-4 w-4 text-orange-600 flex-shrink-0" />
  return <User className="h-4 w-4 text-emerald-600 flex-shrink-0" />
}

function RoleBadge({ role, compact = false }: { role: 'operator' | 'engineer' | 'admin'; compact?: boolean }) {
  const config = {
    operator: { label: 'OPERATOR', cls: 'bg-emerald-100 text-emerald-800' },
    engineer: { label: 'INŽENJER', cls: 'bg-orange-100 text-orange-800' },
    admin: { label: 'ADMIN', cls: 'bg-purple-100 text-purple-800' },
  }[role]
  return (
    <Badge variant="outline" className={`text-[9px] px-1 py-0 leading-tight flex-shrink-0 ${config.cls} ${compact ? '' : ''}`}>
      {config.label}
    </Badge>
  )
}
