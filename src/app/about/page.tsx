'use client'

// /about — o aplikaciji. Propisi dolaze iz landing-content.ts (isti izvor kao početna i /features),
// tema iz site-theme.ts (ista kao na ostalim javnim stranicama).

import Link from 'next/link'
import { Plane, MapPin, Calendar, Award, ShieldCheck, ArrowRight, AlertTriangle, CheckCircle2, UserCheck, Lock, Archive, Eye, Code2, Cpu, Database, Palette, Smartphone, Cloud, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLang } from '@/lib/lang-context'
import { LANDING_TEXT } from '@/lib/landing-content'
import { SITE_TEXT, STACK } from '@/lib/site-content'
import { BEACON, GO, STOP, TARMAC, useSiteTheme } from '@/lib/site-theme'
import { SiteHeader, SiteFooter, Eyebrow, SectionTitle, HeroBackdrop } from '@/components/site/site-chrome'

type Icon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>
const PRINCIPLE_ICONS: Icon[] = [UserCheck, Lock, Archive, Eye]
const STACK_ICONS: Icon[] = [Code2, Cpu, Database, Palette, Smartphone, Cloud]

export default function AboutPage() {
  const { lang } = useLang()
  const { theme, toggle, c } = useSiteTheme()
  const st = SITE_TEXT[lang]
  const lt = LANDING_TEXT[lang]

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: c.pageBg, color: c.text }}>
      <SiteHeader c={c} theme={theme} onToggleTheme={toggle} active="about" />

      {/* HERO */}
      <section className="relative overflow-hidden px-3 sm:px-5">
        <HeroBackdrop c={c} />
        <div className="relative max-w-4xl mx-auto pt-12 pb-14 sm:pt-16 sm:pb-20 text-center">
          <Eyebrow icon={Info}>{st.aboutEyebrow}</Eyebrow>
          <h1 className="mt-5 font-display text-4xl sm:text-5xl lg:text-[3.4rem] font-semibold tracking-tight leading-[1.05]" style={{ color: c.text }}>{st.aboutTitle}</h1>
          <p className="mt-4 text-base sm:text-lg max-w-2xl mx-auto" style={{ color: c.textMuted }}>{st.aboutSub}</p>
        </div>
      </section>

      {/* PROBLEM / RJEŠENJE */}
      <section className="px-3 sm:px-5 pb-12 sm:pb-16">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-4">
          {[
            { icon: AlertTriangle, color: STOP, title: st.problemTitle, body: st.problemBody },
            { icon: CheckCircle2, color: GO, title: st.solutionTitle, body: st.solutionBody },
          ].map((b) => (
            <div key={b.title} className="rounded-2xl border p-6 sm:p-8" style={{ backgroundColor: c.cardBg, borderColor: c.cardBorder, boxShadow: `inset 0 3px 0 ${b.color}` }}>
              <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${b.color}22` }}><b.icon className="h-5 w-5" style={{ color: b.color }} /></div>
              <h2 className="mt-4 font-display text-xl font-semibold" style={{ color: c.text }}>{b.title}</h2>
              <p className="mt-2 text-sm sm:text-base leading-relaxed" style={{ color: c.textMuted }}>{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* NAČELA */}
      <section className="px-3 sm:px-5 py-12 sm:py-16 border-y" style={{ backgroundColor: c.sectionBg, borderColor: c.sectionBorder }}>
        <div className="max-w-5xl mx-auto">
          <SectionTitle title={st.principlesTitle} sub={st.principlesSub} c={c} />
          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            {st.principles.map((p, i) => {
              const Ico = PRINCIPLE_ICONS[i]
              return (
                <div key={p.t} className="rounded-xl border p-5 sm:p-6 flex gap-4" style={{ backgroundColor: c.pageBg, borderColor: c.cardBorder }}>
                  <div className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(242,165,22,0.14)' }}><Ico className="h-5 w-5" style={{ color: BEACON }} /></div>
                  <div>
                    <h3 className="font-display text-base sm:text-lg font-semibold" style={{ color: c.text }}>{p.t}</h3>
                    <p className="mt-1 text-sm" style={{ color: c.textMuted }}>{p.d}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* TEHNOLOGIJA */}
      <section className="px-3 sm:px-5 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <SectionTitle title={st.stackTitle} sub={st.stackSub} c={c} />
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {STACK.map((s, i) => {
              const Ico = STACK_ICONS[i]
              return (
                <div key={s.name} className="rounded-xl border p-4 flex items-center gap-3" style={{ backgroundColor: c.cardBg, borderColor: c.cardBorder }}>
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(242,165,22,0.12)' }}><Ico className="h-5 w-5" style={{ color: BEACON }} /></div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm" style={{ color: c.text }}>{s.name}</div>
                    <div className="text-xs" style={{ color: c.textFaint }}>{s.desc[lang]}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* PROPISI */}
      <section className="px-3 sm:px-5 py-12 sm:py-16 border-y" style={{ backgroundColor: c.sectionBg, borderColor: c.sectionBorder }}>
        <div className="max-w-5xl mx-auto">
          <SectionTitle title={st.standardsTitle} sub={st.standardsSub} c={c} />
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lt.compItems.map((x) => (
              <div key={x.ref} className="rounded-xl border p-4 flex items-start gap-3" style={{ backgroundColor: c.pageBg, borderColor: c.cardBorder }}>
                <ShieldCheck className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GO }} />
                <div>
                  <div className="font-mono text-xs font-semibold" style={{ color: BEACON }}>{x.ref}</div>
                  <div className="text-sm mt-0.5" style={{ color: c.text }}>{x.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AUTOR */}
      <section className="px-3 sm:px-5 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto rounded-2xl border p-6 sm:p-8" style={{ backgroundColor: c.cardBg, borderColor: c.cardBorder, boxShadow: `inset 0 3px 0 ${BEACON}` }}>
          <div className="flex flex-col sm:flex-row items-start gap-5 sm:gap-6">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BEACON }}><Plane className="h-8 w-8 sm:h-10 sm:w-10" style={{ color: TARMAC }} /></div>
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wide font-semibold" style={{ color: BEACON }}>{st.devTitle}</div>
              <h2 className="font-display text-xl sm:text-2xl font-semibold mt-1" style={{ color: c.text }}>{st.devName}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{ color: c.textFaint }}>
                <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{st.devPlace}</span>
                <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{lang === 'en' ? '25 years in aviation' : '25 godina u avijaciji'}</span>
                <span className="inline-flex items-center gap-1.5"><Award className="h-3.5 w-3.5" />IATA · EASA</span>
              </div>
              <p className="mt-4 text-sm sm:text-base leading-relaxed" style={{ color: c.textMuted }}>{st.devBio}</p>
            </div>
          </div>
        </div>
      </section>

      {/* POZIV NA AKCIJU */}
      <section className="px-3 sm:px-5 pb-12 sm:pb-16">
        <div className="max-w-5xl mx-auto rounded-2xl p-6 sm:p-10 text-center border" style={{ backgroundColor: c.cardBg, borderColor: c.cardBorder }}>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold" style={{ color: c.text }}>{st.aboutCtaTitle}</h2>
          <p className="mt-2 text-sm sm:text-base max-w-xl mx-auto" style={{ color: c.textMuted }}>{st.aboutCtaSub}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/features"><Button className="h-11 px-6 font-semibold hover:opacity-90" style={{ backgroundColor: BEACON, color: TARMAC }}>{st.seeFeatures}<ArrowRight className="h-4 w-4 ml-2" /></Button></Link>
            <Link href="/"><Button variant="outline" className="h-11 px-6" style={{ borderColor: c.btnBorder, backgroundColor: c.btnBg, color: c.text }}>{st.toTool}</Button></Link>
          </div>
        </div>
      </section>

      <div className="mt-auto"><SiteFooter c={c} /></div>
    </div>
  )
}
