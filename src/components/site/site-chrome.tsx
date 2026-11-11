'use client'

// Zajednički okvir javnih stranica (/features, /about): zaglavlje, podnožje i naslovi cjelina.
// Isti vizuelni jezik kao početna stranica (worker-page.tsx).

import Link from 'next/link'
import { Plane, LayoutDashboard, Sun, Moon, MoreVertical, Info, Sparkles, ExternalLink, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LanguageToggle } from '@/components/language-toggle'
import { useLang } from '@/lib/lang-context'
import { BEACON, TARMAC, type Theme, type ThemeTokens } from '@/lib/site-theme'

export function SiteHeader({ c, theme, onToggleTheme, active }: { c: ThemeTokens; theme: Theme; onToggleTheme: () => void; active: 'features' | 'about' }) {
  const { t } = useLang()
  const linkCls = (on: boolean) => `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${on ? '' : 'hover:opacity-80'}`
  return (
    <header className="sticky top-0 z-40 print:hidden" style={{ backgroundColor: c.headerBg, backdropFilter: 'blur(8px)', borderBottom: `2px solid ${BEACON}` }}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-5 sm:py-2.5">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BEACON }}>
            <Plane className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: TARMAC }} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm sm:text-base leading-tight truncate" style={{ color: c.text }}>GSE Control</div>
            <div className="text-[10px] leading-tight truncate hidden sm:block" style={{ color: c.textFaint }}>{t('app.tagline')}</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1" style={{ color: c.textMuted }}>
          <Link href="/" className={linkCls(false)}>{t('nav.home')}</Link>
          <Link href="/features" className={linkCls(active === 'features')} style={active === 'features' ? { color: BEACON, backgroundColor: 'rgba(242,165,22,0.12)' } : undefined}>{t('nav.features')}</Link>
          <Link href="/about" className={linkCls(active === 'about')} style={active === 'about' ? { color: BEACON, backgroundColor: 'rgba(242,165,22,0.12)' } : undefined}>{t('nav.about')}</Link>
        </nav>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={onToggleTheme}
            aria-label={theme === 'dark' ? t('theme.toggleToLight') : t('theme.toggleToDark')}
            title={theme === 'dark' ? t('theme.toggleToLight') : t('theme.toggleToDark')}
            style={{ borderColor: c.btnBorder, backgroundColor: c.btnBg, color: c.text }}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <LanguageToggle />
          <Link href="/login">
            <Button variant="outline" size="sm" className="h-9" style={{ borderColor: c.btnBorder, backgroundColor: c.btnBg, color: c.text }}>
              <LayoutDashboard className="h-4 w-4" />
              <span className="ml-1.5 hidden sm:inline">{t('nav.dashboard')}</span>
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" style={{ color: c.text }} aria-label="Menu"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild><Link href="/" className="flex items-center gap-2 cursor-pointer"><Home className="h-4 w-4" />{t('nav.home')}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/features" className="flex items-center gap-2 cursor-pointer"><Sparkles className="h-4 w-4" />{t('nav.features')}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/about" className="flex items-center gap-2 cursor-pointer"><Info className="h-4 w-4" />{t('nav.about')}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/fids" target="_blank" className="flex items-center gap-2 cursor-pointer"><ExternalLink className="h-4 w-4" />{t('nav.fids')}</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

export function SiteFooter({ c }: { c: ThemeTokens }) {
  const { t } = useLang()
  return (
    <footer className="border-t py-5 px-4 text-center text-[11px] print:hidden" style={{ borderColor: c.footerBorder, color: c.footerText }}>
      <p>{t('landing.footer')}</p>
    </footer>
  )
}

export function Eyebrow({ children, icon: Icon }: { children: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wide uppercase"
      style={{ borderColor: 'rgba(242,165,22,0.4)', backgroundColor: 'rgba(242,165,22,0.1)', color: BEACON }}>
      {Icon && <Icon className="h-3.5 w-3.5" />}{children}
    </div>
  )
}

export function SectionTitle({ title, sub, c, center }: { title: string; sub?: string; c: ThemeTokens; center?: boolean }) {
  return (
    <div className={center ? 'text-center max-w-2xl mx-auto' : 'max-w-2xl'}>
      <div className={`h-[3px] w-10 rounded-full mb-3 ${center ? 'mx-auto' : ''}`} style={{ backgroundColor: BEACON }} />
      <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: c.text }}>{title}</h2>
      {sub && <p className="mt-2 text-sm sm:text-base" style={{ color: c.textMuted }}>{sub}</p>}
    </div>
  )
}

/** Pozadina hero sekcije: fina mreža + amber sjaj + isprekidana linija piste. */
export function HeroBackdrop({ c }: { c: ThemeTokens }) {
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0" style={{
        backgroundImage: `linear-gradient(${c.grid} 1px, transparent 1px), linear-gradient(90deg, ${c.grid} 1px, transparent 1px)`,
        backgroundSize: '44px 44px',
        maskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, #000 40%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, #000 40%, transparent 100%)',
      }} />
      <div className="absolute left-1/2 -top-40 h-[28rem] w-[46rem] -translate-x-1/2 rounded-full blur-3xl" style={{ backgroundColor: c.glow }} />
      <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ backgroundImage: `repeating-linear-gradient(90deg, ${BEACON} 0 28px, transparent 28px 52px)`, opacity: 0.55 }} />
    </div>
  )
}
