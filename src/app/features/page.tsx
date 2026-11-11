'use client'

// /features — pregled svega što aplikacija radi. Sadržaj dolazi iz landing-content.ts (isti izvor kao početna),
// a tema iz site-theme.ts (ista kao na početnoj i na /about).

import Link from 'next/link'
import {
  Sparkles, ScanLine, Hammer, CalendarCheck, AlertTriangle, BadgeCheck, GraduationCap, FileText, Database,
  Check, ShieldCheck, ArrowRight, Info, QrCode, UserCog, Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLang } from '@/lib/lang-context'
import { FEATURE_GROUPS, LANDING_TEXT, type FeatureGroupId } from '@/lib/landing-content'
import { ROLE_CARDS, SITE_TEXT } from '@/lib/site-content'
import { BEACON, TARMAC, useSiteTheme } from '@/lib/site-theme'
import { SiteHeader, SiteFooter, Eyebrow, SectionTitle, HeroBackdrop } from '@/components/site/site-chrome'

type Icon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>
const GROUP_ICONS: Record<FeatureGroupId, Icon> = {
  worker: ScanLine, workshop: Hammer, maintenance: CalendarCheck, safety: AlertTriangle,
  authorisation: BadgeCheck, competence: GraduationCap, reports: FileText, data: Database,
}
const ROLE_ICONS: Record<string, Icon> = { worker: QrCode, engineer: Wrench, admin: UserCog }

export default function FeaturesPage() {
  const { lang } = useLang()
  const { theme, toggle, c } = useSiteTheme()
  const st = SITE_TEXT[lang]
  const lt = LANDING_TEXT[lang]
  const functionCount = FEATURE_GROUPS.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: c.pageBg, color: c.text }}>
      <SiteHeader c={c} theme={theme} onToggleTheme={toggle} active="features" />

      {/* HERO */}
      <section className="relative overflow-hidden px-3 sm:px-5">
        <HeroBackdrop c={c} />
        <div className="relative max-w-6xl mx-auto pt-12 pb-14 sm:pt-16 sm:pb-20 text-center">
          <Eyebrow icon={Sparkles}>{st.featEyebrow}</Eyebrow>
          <h1 className="mt-5 font-display text-4xl sm:text-5xl lg:text-[3.4rem] font-semibold tracking-tight leading-[1.05]" style={{ color: c.text }}>{st.featTitle}</h1>
          <p className="mt-4 text-base sm:text-lg max-w-2xl mx-auto" style={{ color: c.textMuted }}>{st.featSub}</p>

          <dl className="mt-9 grid grid-cols-3 gap-2 sm:gap-4 max-w-xl mx-auto">
            {[
              [FEATURE_GROUPS.length, st.statGroups],
              [functionCount, st.statFunctions],
              [lt.compItems.length, st.statStandards],
            ].map(([n, label]) => (
              <div key={String(label)} className="rounded-xl border px-2 py-3 sm:py-4" style={{ backgroundColor: c.cardBg, borderColor: c.cardBorder }}>
                <dt className="font-display text-3xl sm:text-4xl font-semibold tabular-nums" style={{ color: BEACON }}>{n}</dt>
                <dd className="text-[11px] sm:text-xs mt-0.5" style={{ color: c.textMuted }}>{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* BRZA NAVIGACIJA PO CJELINAMA */}
      <nav aria-label={st.groupsNav} className="sticky top-[53px] sm:top-[58px] z-30 border-y" style={{ backgroundColor: c.headerBg, backdropFilter: 'blur(8px)', borderColor: c.sectionBorder }}>
        <div className="max-w-6xl mx-auto px-3 sm:px-5 py-2 flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {FEATURE_GROUPS.map((g) => (
            <a key={g.id} href={`#${g.id}`} className="flex-shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-xs sm:text-sm font-medium whitespace-nowrap transition-colors hover:opacity-80"
              style={{ borderColor: c.btnBorder, backgroundColor: c.btnBg, color: c.text }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.accent }} />{g.title[lang]}
            </a>
          ))}
        </div>
      </nav>

      {/* CJELINE */}
      <main className="px-3 sm:px-5 py-10 sm:py-14">
        <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6">
          {FEATURE_GROUPS.map((g, gi) => {
            const Ico = GROUP_ICONS[g.id]
            return (
              <article key={g.id} id={g.id} className="scroll-mt-32 rounded-2xl border overflow-hidden" style={{ backgroundColor: c.cardBg, borderColor: c.cardBorder }}>
                <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${g.accent}, transparent 70%)` }} />
                <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] gap-6 lg:gap-10 p-5 sm:p-8">
                  <header>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${g.accent}22` }}>
                        <Ico className="h-6 w-6" style={{ color: g.accent }} />
                      </div>
                      <span className="font-mono text-xs tabular-nums" style={{ color: c.textFaint }}>{String(gi + 1).padStart(2, '0')} / {String(FEATURE_GROUPS.length).padStart(2, '0')}</span>
                    </div>
                    <h2 className="mt-4 font-display text-2xl sm:text-[1.7rem] font-semibold tracking-tight" style={{ color: c.text }}>{g.title[lang]}</h2>
                    <p className="mt-2 text-sm sm:text-base" style={{ color: c.textMuted }}>{g.lead[lang]}</p>
                  </header>
                  <ul className="grid gap-2 sm:grid-cols-2 content-start">
                    {g.items.map((it, i) => (
                      <li key={i} className="flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm" style={{ borderColor: c.cardBorder, backgroundColor: c.btnBg, color: c.text }}>
                        <Check className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: g.accent }} />
                        <span>{it[lang]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            )
          })}
        </div>
      </main>

      {/* KO ŠTA VIDI */}
      <section className="px-3 sm:px-5 py-12 sm:py-16 border-y" style={{ backgroundColor: c.sectionBg, borderColor: c.sectionBorder }}>
        <div className="max-w-6xl mx-auto">
          <SectionTitle title={st.rolesTitle} sub={st.rolesSub} c={c} />
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {ROLE_CARDS.map((r) => {
              const Ico = ROLE_ICONS[r.id]
              return (
                <div key={r.id} className="rounded-xl border p-5 sm:p-6" style={{ backgroundColor: c.pageBg, borderColor: c.cardBorder }}>
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(242,165,22,0.14)' }}><Ico className="h-5 w-5" style={{ color: BEACON }} /></div>
                  <h3 className="mt-4 font-display text-lg font-semibold" style={{ color: c.text }}>{r.title[lang]}</h3>
                  <p className="text-xs mt-0.5" style={{ color: c.textFaint }}>{r.who[lang]}</p>
                  <ul className="mt-4 space-y-2">
                    {r.items.map((it, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: c.textMuted }}>
                        <span className="mt-2 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: BEACON }} />{it[lang]}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* USKLAĐENOST */}
      <section className="px-3 sm:px-5 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto">
          <SectionTitle title={lt.compTitle} sub={lt.compSub} c={c} />
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lt.compItems.map((x) => (
              <div key={x.ref} className="rounded-xl border p-4 flex items-start gap-3" style={{ backgroundColor: c.cardBg, borderColor: c.cardBorder }}>
                <ShieldCheck className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: '#3FB27F' }} />
                <div>
                  <div className="font-mono text-xs font-semibold" style={{ color: BEACON }}>{x.ref}</div>
                  <div className="text-sm mt-0.5" style={{ color: c.text }}>{x.d}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border p-4 sm:p-5 flex items-start gap-3" style={{ borderColor: 'rgba(242,165,22,0.35)', backgroundColor: 'rgba(242,165,22,0.07)' }}>
            <Info className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: BEACON }} />
            <div>
              <div className="font-semibold text-sm" style={{ color: c.text }}>{st.limitsTitle}</div>
              <p className="text-sm mt-1" style={{ color: c.textMuted }}>{st.limitsBody}</p>
            </div>
          </div>
        </div>
      </section>

      {/* POZIV NA AKCIJU */}
      <section className="px-3 sm:px-5 pb-12 sm:pb-16">
        <div className="max-w-6xl mx-auto rounded-2xl p-6 sm:p-10 text-center border" style={{ backgroundColor: c.cardBg, borderColor: c.cardBorder, boxShadow: `inset 0 3px 0 ${BEACON}` }}>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold" style={{ color: c.text }}>{st.featCtaTitle}</h2>
          <p className="mt-2 text-sm sm:text-base max-w-xl mx-auto" style={{ color: c.textMuted }}>{st.featCtaSub}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/"><Button className="h-11 px-6 font-semibold hover:opacity-90" style={{ backgroundColor: BEACON, color: TARMAC }}>{lt.toTool}<ArrowRight className="h-4 w-4 ml-2" /></Button></Link>
            <Link href="/about"><Button variant="outline" className="h-11 px-6" style={{ borderColor: c.btnBorder, backgroundColor: c.btnBg, color: c.text }}>{st.aboutEyebrow}</Button></Link>
          </div>
        </div>
      </section>

      <div className="mt-auto"><SiteFooter c={c} /></div>
    </div>
  )
}
