'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Plane, LayoutDashboard, ExternalLink, MoreVertical, Info, Sparkles,
  QrCode, ShieldCheck, WifiOff, AlertTriangle, ScanLine, Sun, Moon,
  Check, Hammer, CalendarCheck, BadgeCheck, FileText, Database,
} from 'lucide-react'
import { WorkerView } from '@/components/worker/worker-view'
import { LanguageToggle } from '@/components/language-toggle'
import { useLang } from '@/lib/lang-context'
import { FEATURE_GROUPS, LANDING_TEXT, type FeatureGroupId } from '@/lib/landing-content'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { isDemoMode } from '@/lib/auth-mode'

// =====================================================
// JAVNA RADNIČKA STRANICA (/) — vizuelni identitet.
//
// Smjer: "operations console at night" — GSE vozila na aerodromu nose
// amber rotaciona svjetla (zakonski obavezna signalizacija), a platforma
// se osvjetljava reflektorima na tamnom asfaltu. Odatle paleta: taman
// "tarmac" fon + amber "beacon" akcenat, umjesto generičkog
// ljubičasto-bijelog gradijenta.
//
// Alat (WorkerView) je uvijek prvi vidljiv ekran na telefonu - uložen je
// kao svijetao "konzolni panel" (kao instrument-tabla na tamnoj kućici)
// tako da njegov postojeći (svijetli) dizajn ostaje netaknut, a cijela
// stranica ipak djeluje kao jedna cjelina. Problem/Solution i 5
// obilježja su ispod, za one koji skroluju dalje - ne blokiraju alat.
//
// Hero fotografija (platforma Aerodroma Tivat u sumrak) je namjerno
// FIKSNO tamna/amber u OBA režima - to je stvarna fotografija sumraka,
// ne UI boja, pa se ne mijenja sa light/dark prekidačem. Prekidač mijenja
// samo "chrome" dijelove ispod hero-a: header, Problem/Solution, 5
// obilježja i footer. Ovo nije Tailwind .dark klasa (ta je rezervisana
// za ostatak app-a/shadcn temu) nego lokalni par token objekata ispod,
// jer je ova stranica pisana sa inline hex stilovima.
// =====================================================

// Boje (vidi napomenu u odgovoru asistenta za RGB i usage notes):
// tarmac #0B0E11 · hangar #161B20 · beacon #F2A516 · chalk #EDEFF2 · steel #8A94A0
// go #3FB27F · stop #E3473F · taxiway #4C8DF2

type Theme = 'dark' | 'light'

const THEME_STORAGE_KEY = 'gse-landing-theme'

const DARK = {
  pageBg: '#0B0E11',
  text: '#EDEFF2',
  textMuted: '#AEB6BF',
  textFaint: '#8A94A0',
  headerBg: 'rgba(11,14,17,0.92)',
  sectionBg: '#12161B',
  sectionBorder: 'rgba(255,255,255,0.06)',
  cardBg: '#12161B',
  cardBorder: 'rgba(255,255,255,0.06)',
  footerBorder: 'rgba(255,255,255,0.08)',
  footerText: '#6B7480',
  btnBorder: 'rgba(255,255,255,0.15)',
  btnBg: 'rgba(255,255,255,0.05)',
  btnHoverBg: 'rgba(255,255,255,0.1)',
  // Hero (preko fotografije platforme u sumrak) — overlay i tekst se i
  // dalje prilagođavaju prekidaču, samo sa drugačijim smjerom osvjetljenja
  // (tamna "noćna" scena vs. zasvijetljena "dnevna" scena iste fotografije).
  heroOverlayVertical: 'linear-gradient(to bottom, rgba(11,14,17,0.55) 0%, rgba(11,14,17,0.72) 45%, rgba(11,14,17,0.93) 100%)',
  heroOverlayHorizontal: 'linear-gradient(to right, rgba(11,14,17,0.88) 0%, rgba(11,14,17,0.55) 48%, rgba(11,14,17,0.22) 100%)',
  heroText: '#EDEFF2',
  heroTextMuted: '#D7DBE0',
  heroTagBg: 'rgba(11,14,17,0.55)',
}

const LIGHT = {
  pageBg: '#F4F5F7',
  text: '#12161B',
  textMuted: '#495057',
  textFaint: '#6B7480',
  headerBg: 'rgba(244,245,247,0.92)',
  sectionBg: '#FFFFFF',
  sectionBorder: 'rgba(11,14,17,0.08)',
  cardBg: '#FFFFFF',
  cardBorder: 'rgba(11,14,17,0.08)',
  footerBorder: 'rgba(11,14,17,0.08)',
  footerText: '#8A94A0',
  btnBorder: 'rgba(11,14,17,0.14)',
  btnBg: 'rgba(11,14,17,0.03)',
  btnHoverBg: 'rgba(11,14,17,0.08)',
  heroOverlayVertical: 'linear-gradient(to bottom, rgba(244,245,247,0.5) 0%, rgba(244,245,247,0.72) 45%, rgba(244,245,247,0.95) 100%)',
  heroOverlayHorizontal: 'linear-gradient(to right, rgba(244,245,247,0.94) 0%, rgba(244,245,247,0.62) 48%, rgba(244,245,247,0.25) 100%)',
  heroText: '#12161B',
  heroTextMuted: '#3C4248',
  heroTagBg: 'rgba(244,245,247,0.8)',
}

function WorkerPageInner() {
  const sp = useSearchParams()
  const router = useRouter()
  const scanParam = sp.get('scan')
  const handledScanRef = useRef<string | null>(null)
  const { t, lang } = useLang()
  const lt = LANDING_TEXT[lang]

  const [initialScan, setInitialScan] = useState<string | undefined>(undefined)
  const [demoMode, setDemoMode] = useState(false)
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => { setDemoMode(isDemoMode()) }, [])

  // Učitaj sačuvanu temu (per-browser, ne mijenja ostatak app-a). Sandbox-
  // otporno na private mode / blokiran storage - jednostavno ostaje na
  // zadanoj ("dark") temi ako pristup nije moguć.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
      if (saved === 'light' || saved === 'dark') setTheme(saved)
    } catch {
      // ignoriši - ostaje zadana tema
    }
  }, [])

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // ignoriši - prekidač radi i bez trajnog čuvanja
    }
  }

  useEffect(() => {
    if (scanParam && handledScanRef.current !== scanParam) {
      handledScanRef.current = scanParam
      setInitialScan(scanParam)
      router.replace('/', { scroll: false })
    }
  }, [scanParam, router])

  const c = theme === 'dark' ? DARK : LIGHT

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: c.pageBg, color: c.text }}>
      {/* HEADER */}
      <header className="sticky top-0 z-40 print:hidden" style={{ backgroundColor: c.headerBg, backdropFilter: 'blur(8px)', borderBottom: '2px solid #F2A516' }}>
        <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-5 sm:py-2.5">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F2A516' }}>
              <Plane className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: '#0B0E11' }} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm sm:text-base leading-tight truncate" style={{ color: c.text }}>GSE Control</div>
              <div className="text-[10px] leading-tight truncate hidden sm:block" style={{ color: c.textFaint }}>{t('app.tagline')}</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium" style={{ color: c.textMuted }}>
            <a href="#how" className="hover:opacity-80">{lt.navHow}</a>
            <a href="#features" className="hover:opacity-80">{lt.navFeatures}</a>
            <a href="#compliance" className="hover:opacity-80">{lt.navCompliance}</a>
          </nav>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={theme === 'dark' ? t('theme.toggleToLight') : t('theme.toggleToDark')}
              title={theme === 'dark' ? t('theme.toggleToLight') : t('theme.toggleToDark')}
              onClick={toggleTheme}
              className="h-9 w-9"
              style={{ borderColor: c.btnBorder, backgroundColor: c.btnBg, color: c.text }}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <LanguageToggle />
            <Link href="/login">
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                style={{ borderColor: c.btnBorder, backgroundColor: c.btnBg, color: c.text }}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">{t('nav.dashboard')}</span>
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" style={{ color: c.text }}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/about" className="flex items-center gap-2 cursor-pointer">
                    <Info className="h-4 w-4" />
                    {t('nav.about')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/features" className="flex items-center gap-2 cursor-pointer">
                    <Sparkles className="h-4 w-4" />
                    {t('nav.features')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/fids" target="_blank" className="flex items-center gap-2 cursor-pointer">
                    <ExternalLink className="h-4 w-4" />
                    {t('nav.fids')}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* HERO + ALAT — fotografija platforme Aerodroma Tivat u sumrak kao
          fon, sa tamnim gradijentom preko za čitljivost teksta. Fiksno
          tamno/amber bez obzira na light/dark prekidač (vidi napomenu
          gore). Na telefonu alat (order-1) dolazi prije teksta (order-2),
          tako da radnik ne mora skrolati kroz headline da bi stigao do
          skeniranja. Na desktopu su jedno pored drugog. */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/hero-tivat-apron.jpg"
            alt={t('hero.imageAlt')}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          {/* Vertikalni overlay - čitljivost na telefonu, gdje tekst pada
              ispod konzolnog panela. Prati light/dark prekidač: tamniji
              "noćni" smjer u dark temi, zasvijetljeni u light temi - ista
              fotografija, drugo osvjetljenje. */}
          <div className="absolute inset-0" style={{ background: c.heroOverlayVertical }} />
          {/* Horizontalni overlay - čitljivost na desktopu, gdje tekst
              stoji lijevo pored fotografije. */}
          <div className="absolute inset-0 hidden lg:block" style={{ background: c.heroOverlayHorizontal }} />
        </div>

        <div className="relative px-3 sm:px-5">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-8 lg:gap-12 items-start py-8 lg:py-20">
            <div className="order-2 lg:order-1 lg:pt-4">
              <h1
                className="font-display text-[2rem] sm:text-[2.6rem] lg:text-[3.1rem] font-semibold leading-[1.08] tracking-tight"
                style={{ color: c.heroText }}
              >
                {t('hero.headlineLine1')}
                <br />
                {t('hero.headlineLine2')}
              </h1>
              <p className="mt-5 text-base sm:text-lg max-w-[34ch]" style={{ color: c.heroTextMuted }}>
                {t('hero.subhead')}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  { icon: QrCode, label: t('hero.tag1') },
                  { icon: ShieldCheck, label: t('hero.tag2') },
                  { icon: WifiOff, label: t('hero.tag3') },
                ].map((tag, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-medium"
                    style={{ borderColor: 'rgba(242,165,22,0.45)', backgroundColor: c.heroTagBg, color: '#F2A516' }}
                  >
                    <tag.icon className="h-3.5 w-3.5" />
                    {tag.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Konzolni panel - svijetao "ekran" uložen u tamnu/fotografsku
                kućicu, sadrži netaknut WorkerView alat. */}
            <div className="order-1 lg:order-2 w-full">
              <div className="force-light rounded-xl overflow-hidden shadow-[0_20px_60px_-20px_rgba(0,0,0,0.75)]" style={{ backgroundColor: '#F4F5F7' }}>
                <div className="h-[3px]" style={{ backgroundColor: '#F2A516' }} />
                <div className="px-3 py-4 sm:px-5 sm:py-5">
                  <WorkerView initialScan={initialScan} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRAKA POUZDANJA */}
      <section style={{ backgroundColor: c.sectionBg, borderTop: `1px solid ${c.sectionBorder}`, borderBottom: `1px solid ${c.sectionBorder}` }}>
        <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs sm:text-sm font-medium" style={{ color: c.textMuted }}>
          {['EASA Reg. (EU) 139/2014', 'IATA AHM 340', lang === 'en' ? 'Works offline' : 'Radi i offline', lang === 'en' ? 'Phone, tablet, desktop' : 'Telefon, tablet, računar', 'HR / EN'].map((x) => (
            <span key={x} className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#F2A516' }} />{x}</span>
          ))}
        </div>
      </section>

      {/* KAKO RADI */}
      <section id="how" className="scroll-mt-20 px-3 sm:px-5 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto">
          <SectionHead title={lt.howTitle} sub={lt.howSub} c={c} />
          <ol className="mt-8 grid md:grid-cols-3 gap-4">
            {lt.steps.map((st, i) => (
              <li key={i} className="rounded-xl p-5 sm:p-6 border" style={{ backgroundColor: c.cardBg, borderColor: c.cardBorder }}>
                <div className="h-9 w-9 rounded-full flex items-center justify-center font-display font-bold text-sm" style={{ backgroundColor: '#F2A516', color: '#0B0E11' }}>{i + 1}</div>
                <h3 className="mt-4 font-display text-lg font-semibold" style={{ color: c.text }}>{st.t}</h3>
                <p className="mt-1.5 text-sm" style={{ color: c.textMuted }}>{st.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FUNKCIJE */}
      <section id="features" className="scroll-mt-20 px-3 sm:px-5 py-12 sm:py-16" style={{ backgroundColor: c.sectionBg, borderTop: `1px solid ${c.sectionBorder}`, borderBottom: `1px solid ${c.sectionBorder}` }}>
        <div className="max-w-6xl mx-auto">
          <SectionHead title={lt.featuresTitle} sub={lt.featuresSub} c={c} />
          <div className="mt-8 grid md:grid-cols-2 gap-4">
            {FEATURE_GROUPS.map((g, gi) => {
              const Icon = GROUP_ICONS[g.id]
              return (
                <article key={g.id} className={`rounded-xl border p-5 sm:p-6 ${gi === 0 ? 'md:col-span-2' : ''}`} style={{ backgroundColor: c.pageBg, borderColor: c.cardBorder }}>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${g.accent}22` }}>
                      <Icon className="h-5 w-5" style={{ color: g.accent }} />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-semibold" style={{ color: c.text }}>{g.title[lang]}</h3>
                      <p className="text-sm mt-0.5" style={{ color: c.textMuted }}>{g.lead[lang]}</p>
                    </div>
                  </div>
                  <ul className={`mt-4 grid gap-x-6 gap-y-2 ${gi === 0 ? 'sm:grid-cols-2' : ''}`}>
                    {g.items.map((it, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: c.text }}>
                        <Check className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: g.accent }} />
                        <span>{it[lang]}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* USKLAĐENOST */}
      <section id="compliance" className="scroll-mt-20 px-3 sm:px-5 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto">
          <SectionHead title={lt.compTitle} sub={lt.compSub} c={c} />
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lt.compItems.map((x) => (
              <div key={x.ref} className="rounded-xl border p-4 flex items-start gap-3" style={{ backgroundColor: c.cardBg, borderColor: c.cardBorder }}>
                <ShieldCheck className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: '#3FB27F' }} />
                <div>
                  <div className="font-mono text-xs font-semibold" style={{ color: '#F2A516' }}>{x.ref}</div>
                  <div className="text-sm mt-0.5" style={{ color: c.text }}>{x.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* POZIV NA AKCIJU */}
      <section className="px-3 sm:px-5 pb-12 sm:pb-16">
        <div className="max-w-6xl mx-auto rounded-2xl p-6 sm:p-10 text-center border" style={{ backgroundColor: c.cardBg, borderColor: c.cardBorder, borderTop: '3px solid #F2A516' }}>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold" style={{ color: c.text }}>{lt.ctaTitle}</h2>
          <p className="mt-2 text-sm sm:text-base max-w-xl mx-auto" style={{ color: c.textMuted }}>{lt.ctaSub}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/login">
              <Button className="h-11 px-6 font-semibold hover:opacity-90" style={{ backgroundColor: '#F2A516', color: '#0B0E11' }}>
                <LayoutDashboard className="h-4 w-4 mr-2" />{lt.ctaPrimary}
              </Button>
            </Link>
            <Link href="/fids" target="_blank">
              <Button variant="outline" className="h-11 px-6" style={{ borderColor: c.btnBorder, backgroundColor: c.btnBg, color: c.text }}>
                <ExternalLink className="h-4 w-4 mr-2" />{lt.ctaSecondary}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t py-4 px-4 text-center text-[11px] print:hidden" style={{ borderColor: c.footerBorder, color: c.footerText }}>
        <p>{t('landing.footer')}</p>
        {demoMode && <p className="mt-0.5" style={{ color: '#F2A516' }}>{t('landing.demoMode')}</p>}
      </footer>
    </div>
  )
}

type ThemeTokens = typeof DARK

function SectionHead({ title, sub, c }: { title: string; sub: string; c: ThemeTokens }) {
  return (
    <div className="max-w-2xl">
      <div className="h-[3px] w-10 rounded-full mb-3" style={{ backgroundColor: '#F2A516' }} />
      <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: c.text }}>{title}</h2>
      <p className="mt-2 text-sm sm:text-base" style={{ color: c.textMuted }}>{sub}</p>
    </div>
  )
}

const GROUP_ICONS: Record<FeatureGroupId, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  worker: ScanLine, workshop: Hammer, maintenance: CalendarCheck, safety: AlertTriangle,
  authorisation: BadgeCheck, reports: FileText, data: Database,
}

export function WorkerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0B0E11' }}><div style={{ color: '#8A94A0' }}>Učitavanje...</div></div>}>
      <WorkerPageInner />
    </Suspense>
  )
}
