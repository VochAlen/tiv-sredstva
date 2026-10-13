'use client'

// =====================================================
// O APLIKACIJI (/about) — restilizovano da vizuelno prati landing
// stranicu (worker-page.tsx): isti "operations console at night" smjer
// (tamni tarmac fon, amber beacon akcenat, Space Grotesk za naslove),
// umjesto generičkog shadcn Card/Badge izgleda koji je stranica ranije
// imala. Sadržajno dopunjeno sa svih 5 cjelina funkcionalnosti koje
// danas postoje u dashboard-u (Pregled, Oprema, Sigurnost & regulativa,
// Operacije, Izvještaji), ne samo starim tech-stack/compliance blokom.
//
// Namjerno FIKSNA tamna tema (bez light/dark prekidača) - ovo je
// informativna stranica, ne radni alat, pa dodatni prekidač ne donosi
// vrijednost a dodaje kompleksnost koju staff ne treba ovdje.
// =====================================================

import {
  Plane, ShieldCheck, Code2, Calendar, MapPin, Award, Target, Cpu, Database,
  Cloud, Smartphone, QrCode, LayoutDashboard, Home, Activity, Package,
  Wrench, FileCheck, ArrowRight,
} from 'lucide-react'
import { LanguageToggle } from '@/components/language-toggle'
import { useLang } from '@/lib/lang-context'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const TARMAC = '#0B0E11'
const HANGAR = '#12161B'
const CHALK = '#EDEFF2'
const STEEL = '#8A94A0'
const STEEL_LIGHT = '#AEB6BF'
const BEACON = '#F2A516'
const CARD_BORDER = 'rgba(255,255,255,0.06)'

export default function AboutPage() {
  const { t } = useLang()

  const techStack = [
    { icon: Code2, name: 'Next.js 16', desc: 'App Router, Server Actions' },
    { icon: Cpu, name: 'TypeScript', desc: 'Type-safe end-to-end' },
    { icon: Database, name: 'Supabase', desc: 'PostgreSQL + Auth + RLS' },
    { icon: Smartphone, name: 'PWA', desc: 'Offline podrška' },
    { icon: QrCode, name: 'html5-qrcode', desc: 'QR skeniranje' },
    { icon: Cloud, name: 'Vercel', desc: 'Deploy + Edge' },
  ]

  const compliance: [string, string][] = [
    ['IATA AHM 340', 'Pre-use inspection'],
    ['IATA AHM 1110', 'Operator qualifications'],
    ['IATA AHM 1130', 'Damage reporting'],
    ['EASA Part-145', 'Maintenance log'],
    ['EASA Part-M §39', 'Airworthiness Directives'],
    ['EASA Part-145 §50', 'Life-limited parts'],
  ]

  const capabilityGroups = [
    { icon: Activity, accent: '#4C8DF2', title: t('about.cap.overview.title'), items: t('about.cap.overview.items') },
    { icon: Package, accent: BEACON, title: t('about.cap.equipment.title'), items: t('about.cap.equipment.items') },
    { icon: ShieldCheck, accent: '#E3473F', title: t('about.cap.safety.title'), items: t('about.cap.safety.items') },
    { icon: Wrench, accent: '#3FB27F', title: t('about.cap.ops.title'), items: t('about.cap.ops.items') },
    { icon: FileCheck, accent: STEEL, title: t('about.cap.reports.title'), items: t('about.cap.reports.items') },
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: TARMAC, color: CHALK }}>
      {/* HEADER */}
      <header className="sticky top-0 z-40" style={{ backgroundColor: 'rgba(11,14,17,0.92)', backdropFilter: 'blur(8px)', borderBottom: `2px solid ${BEACON}` }}>
        <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-5 sm:py-2.5">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BEACON }}>
              <Plane className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: TARMAC }} />
            </div>
            <div className="font-semibold text-sm sm:text-base leading-tight truncate" style={{ color: CHALK }}>GSE Control</div>
          </Link>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <LanguageToggle />
            <Link href="/features">
              <Button variant="outline" size="sm" className="h-9" style={{ borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', color: CHALK }}>
                <LayoutDashboard className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">{t('nav.features')}</span>
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" size="sm" className="h-9" style={{ borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)', color: CHALK }}>
                <Home className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">{t('nav.home')}</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-3 sm:px-5">
        <div className="max-w-5xl mx-auto py-10 sm:py-14">
          {/* HERO */}
          <div className="text-center mb-10 sm:mb-14">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium mb-4"
              style={{ borderColor: 'rgba(242,165,22,0.4)', backgroundColor: 'rgba(242,165,22,0.1)', color: BEACON }}
            >
              <Award className="h-3.5 w-3.5" />
              {t('about.experience')}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold tracking-tight mb-3" style={{ color: CHALK }}>
              {t('about.title')}
            </h1>
            <p className="text-base sm:text-lg max-w-2xl mx-auto" style={{ color: STEEL_LIGHT }}>
              {t('about.subtitle')}
            </p>
          </div>

          {/* DEVELOPER CARD */}
          <div
            className="rounded-xl p-6 sm:p-8 mb-6"
            style={{
              backgroundColor: HANGAR,
              borderStyle: 'solid',
              borderLeftWidth: '1px',
              borderRightWidth: '1px',
              borderBottomWidth: '1px',
              borderTopWidth: '3px',
              borderLeftColor: CARD_BORDER,
              borderRightColor: CARD_BORDER,
              borderBottomColor: CARD_BORDER,
              borderTopColor: BEACON,
            }}
          >
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="h-20 w-20 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BEACON }}>
                <Plane className="h-10 w-10" style={{ color: TARMAC }} />
              </div>
              <div className="flex-1">
                <h2 className="font-display text-xl font-semibold mb-1" style={{ color: CHALK }}>{t('about.developerName')}</h2>
                <div className="flex flex-wrap items-center gap-3 text-sm mb-4" style={{ color: STEEL }}>
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />Aerodrom Tivat (TIV)</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />25 godina</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: STEEL_LIGHT }}>{t('about.developerBio')}</p>
              </div>
            </div>
          </div>

          {/* MISSION */}
          <div className="rounded-xl p-6 mb-12 text-center" style={{ backgroundColor: HANGAR, border: `1px solid ${CARD_BORDER}` }}>
            <Target className="h-7 w-7 mx-auto mb-3" style={{ color: BEACON }} />
            <h3 className="font-display font-semibold mb-2" style={{ color: CHALK }}>{t('about.missionTitle')}</h3>
            <p className="text-sm max-w-2xl mx-auto" style={{ color: STEEL_LIGHT }}>{t('about.missionText')}</p>
          </div>

          {/* SVE FUNKCIJE SISTEMA — 5 cjelina koje odgovaraju 5 grupa u
              dashboard sidebar-u, da about stranica stvarno odražava šta
              sistem danas radi. */}
          <div className="mb-6 text-center">
            <h2 className="font-display text-2xl sm:text-[1.75rem] font-semibold mb-2" style={{ color: CHALK }}>{t('about.capTitle')}</h2>
            <p className="text-sm sm:text-base max-w-2xl mx-auto" style={{ color: STEEL_LIGHT }}>{t('about.capSubtitle')}</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mb-12">
            {capabilityGroups.map((g) => (
              <CapabilityCard key={g.title} icon={g.icon} accent={g.accent} title={g.title} items={g.items} />
            ))}
          </div>

          {/* TECH STACK */}
          <div className="mb-4 text-center">
            <h2 className="font-display text-xl font-semibold mb-1" style={{ color: CHALK }}>{t('about.techTitle')}</h2>
            <p className="text-sm" style={{ color: STEEL_LIGHT }}>{t('about.techSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-12">
            {techStack.map((tech) => (
              <div key={tech.name} className="rounded-lg p-4" style={{ backgroundColor: HANGAR, border: `1px solid ${CARD_BORDER}` }}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(242,165,22,0.12)' }}>
                    <tech.icon className="h-5 w-5" style={{ color: BEACON }} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: CHALK }}>{tech.name}</div>
                    <div className="text-xs" style={{ color: STEEL }}>{tech.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* COMPLIANCE & STANDARDS */}
          <div
            className="rounded-xl p-6 mb-10"
            style={{
              backgroundColor: HANGAR,
              borderStyle: 'solid',
              borderTopWidth: '1px',
              borderRightWidth: '1px',
              borderBottomWidth: '1px',
              borderLeftWidth: '4px',
              borderTopColor: CARD_BORDER,
              borderRightColor: CARD_BORDER,
              borderBottomColor: CARD_BORDER,
              borderLeftColor: '#3FB27F',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="h-6 w-6" style={{ color: '#3FB27F' }} />
              <h3 className="font-display font-semibold" style={{ color: CHALK }}>Compliance & Standards</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {compliance.map(([code, desc]) => (
                <div key={code} className="flex items-start gap-2">
                  <Award className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#3FB27F' }} />
                  <div style={{ color: STEEL_LIGHT }}>
                    <strong style={{ color: CHALK }}>{code}</strong> — {desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center">
            <Link href="/features">
              <Button size="lg" style={{ backgroundColor: BEACON, color: TARMAC }} className="hover:opacity-90">
                {t('nav.features')}
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t py-4 px-4 text-center text-[11px]" style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#6B7480' }}>
        <p>{t('landing.footer')}</p>
      </footer>
    </div>
  )
}

function CapabilityCard({
  icon: Icon, accent, title, items,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  accent: string
  title: string
  items: string
}) {
  return (
    <div
      className="rounded-xl p-5 sm:p-6"
      style={{
        backgroundColor: HANGAR,
        borderStyle: 'solid',
        borderTopWidth: '1px',
        borderRightWidth: '1px',
        borderBottomWidth: '1px',
        borderLeftWidth: '4px',
        borderTopColor: CARD_BORDER,
        borderRightColor: CARD_BORDER,
        borderBottomColor: CARD_BORDER,
        borderLeftColor: accent,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${accent}1A` }}>
          <Icon className="h-5 w-5" style={{ color: accent }} />
        </div>
        <h3 className="font-display text-base sm:text-lg font-semibold" style={{ color: CHALK }}>{title}</h3>
      </div>
      <ul className="space-y-1.5">
        {items.split('•').map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm" style={{ color: STEEL_LIGHT }}>
            <span className="mt-1.5 h-1 w-1 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
