'use client'

import { useRouter } from 'next/navigation'
import { Plane, LogOut, User, Wrench, ShieldCheck, ExternalLink } from 'lucide-react'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LanguageToggle } from '@/components/language-toggle'
import { useLang } from '@/lib/lang-context'
import Link from 'next/link'
import type { AppUser } from '@/lib/auth-server'

export function DashboardContent({ user, demoMode }: { user: AppUser; demoMode: boolean }) {
  const router = useRouter()
  const { t } = useLang()

  const handleLogout = async () => {
    await fetch('/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-40 print:hidden">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
              <Plane className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-base leading-tight truncate">{t('dash.title')}</div>
              <div className="text-[10px] text-muted-foreground leading-tight hidden sm:block">Ground Support Equipment Management</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 px-2 py-1 rounded-lg border bg-muted/30">
              <RoleIcon role={user.role} />
              <div className="text-xs">
                <div className="font-medium leading-tight">{user.full_name}</div>
                <div className="text-muted-foreground leading-tight">{user.card_id ?? user.email}</div>
              </div>
              <RoleBadge role={user.role} />
            </div>
            <LanguageToggle />
            <Link href="/" target="_blank"><Button variant="outline" size="sm"><ExternalLink className="h-4 w-4" /><span className="ml-1.5 hidden lg:inline">{t('nav.radnik')}</span></Button></Link>
            <Link href="/fids" target="_blank"><Button variant="outline" size="sm"><ExternalLink className="h-4 w-4" /><span className="ml-1.5 hidden lg:inline">{t('nav.fids')}</span></Button></Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="h-4 w-4" /><span className="ml-1.5 hidden lg:inline">{t('nav.odjava')}</span></Button>
          </div>
        </div>
        <div className="md:hidden container mx-auto px-4 pb-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5"><RoleIcon role={user.role} /><span className="font-medium">{user.full_name}</span><RoleBadge role={user.role} /></div>
          {demoMode && <Badge variant="secondary" className="text-[10px]">Demo Mode</Badge>}
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-4 sm:py-6 w-full max-w-7xl">
        <DashboardView currentUser={user} />
      </main>
      <footer className="mt-auto border-t bg-background/95 py-3 px-4 text-center text-xs text-muted-foreground print:hidden">
        <span>GSE Control · IATA AHM 340 + EASA Part-145 compliant</span>
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
  return <Badge variant="outline" className={`text-[10px] ${config.cls}`}>{config.label}</Badge>
}
