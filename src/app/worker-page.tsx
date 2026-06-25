'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Plane, LayoutDashboard, ExternalLink, ShieldCheck, Wrench, User,
  ScanLine, CheckCircle2, Camera, Clock, AlertTriangle, FileText,
  Smartphone, ArrowRight, Globe, Zap, Lock, Cloud,
} from 'lucide-react'
import { WorkerView } from '@/components/worker/worker-view'
import { LanguageToggle } from '@/components/language-toggle'
import { useLang } from '@/lib/lang-context'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { isDemoMode } from '@/lib/auth-mode'

function WorkerPageInner() {
  const sp = useSearchParams()
  const router = useRouter()
  const scanParam = sp.get('scan')
  const handledScanRef = useRef<string | null>(null)
  const { t } = useLang()

  const [initialScan, setInitialScan] = useState<string | undefined>(undefined)
  const [demoMode, setDemoMode] = useState(false)

  useEffect(() => { setDemoMode(isDemoMode()) }, [])

  useEffect(() => {
    if (scanParam && handledScanRef.current !== scanParam) {
      handledScanRef.current = scanParam
      setInitialScan(scanParam)
      router.replace('/', { scroll: false })
    }
  }, [scanParam, router])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-background/80 backdrop-blur-xl sticky top-0 z-50 print:hidden">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
              <Plane className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-base leading-tight truncate">GSE Control</div>
              <div className="text-[10px] text-muted-foreground leading-tight hidden sm:block">{t('app.tagline')}</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Link href="/about" className="hidden sm:block"><Button variant="ghost" size="sm">{t('nav.about')}</Button></Link>
            <Link href="/features" className="hidden sm:block"><Button variant="ghost" size="sm">{t('nav.features')}</Button></Link>
            <Link href="/fids" target="_blank"><Button variant="outline" size="sm"><ExternalLink className="h-4 w-4" /><span className="ml-1.5 hidden md:inline">{t('nav.fids')}</span></Button></Link>
            <Link href="/login"><Button variant="outline" size="sm"><LayoutDashboard className="h-4 w-4" /><span className="ml-1.5 hidden md:inline">{t('nav.dashboard')}</span></Button></Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
          <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.04] w-[120%] h-auto" viewBox="0 0 1000 500" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M100 250 L400 230 L500 100 L550 100 L570 220 L800 240 L900 220 L920 240 L800 270 L570 280 L550 400 L500 400 L400 270 L100 250 Z" fill="white" />
          </svg>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative container mx-auto px-4 py-12 sm:py-16 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="text-center lg:text-left text-white">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium mb-5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />{t('landing.badge')}
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4 bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">{t('worker.title')}</h1>
              <p className="text-base sm:text-lg text-white/70 mb-8 max-w-lg mx-auto lg:mx-0">{t('worker.subtitle')} — {t('app.tagline')}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto lg:mx-0 mb-8">
                {[{ icon: ScanLine, label: 'QR Scan' }, { icon: CheckCircle2, label: t('worker.checklist') }, { icon: Camera, label: t('worker.photoEvidence').split(' ')[0] }, { icon: Clock, label: 'Real-time' }].map((f, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
                    <f.icon className="h-5 w-5 text-cyan-400" /><span className="text-xs font-medium text-white/80 text-center">{f.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 justify-center lg:justify-start">
                <Link href="/features"><Button size="lg" className="bg-white text-slate-900 hover:bg-white/90">{t('landing.learnMore')}<ArrowRight className="h-4 w-4 ml-2" /></Button></Link>
                <Link href="/about"><Button size="lg" variant="outline" className="bg-white/5 border-white/20 text-white hover:bg-white/10">{t('nav.about')}</Button></Link>
              </div>
            </div>
            <div className="max-w-md mx-auto w-full">
              <div className="rounded-2xl bg-white shadow-2xl shadow-black/20 overflow-hidden">
                <WorkerView initialScan={initialScan} />
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
      </section>

      <section className="border-b bg-muted/20">
        <div className="container mx-auto px-4 py-12 sm:py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">{t('landing.featuresTitle')}</h2>
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto">{t('landing.featuresSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[{ icon: Smartphone, title: t('landing.workerTitle'), desc: t('landing.workerDesc'), color: 'text-emerald-600 bg-emerald-100' },
              { icon: LayoutDashboard, title: t('landing.dashboardTitle'), desc: t('landing.dashboardDesc'), color: 'text-blue-600 bg-blue-100' },
              { icon: AlertTriangle, title: t('landing.damagesTitle'), desc: t('landing.damagesDesc'), color: 'text-orange-600 bg-orange-100' },
              { icon: FileText, title: t('landing.reportsTitle'), desc: t('landing.reportsDesc'), color: 'text-purple-600 bg-purple-100' }
            ].map((f, i) => (
              <div key={i} className="p-5 rounded-xl border bg-card hover:shadow-lg transition hover:-translate-y-1">
                <div className={'h-10 w-10 rounded-lg flex items-center justify-center mb-3 ' + f.color}><f.icon className="h-5 w-5" /></div>
                <h3 className="font-semibold text-sm mb-1">{f.title}</h3><p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b">
        <div className="container mx-auto px-4 py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">{t('landing.rolesTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[{ icon: User, color: 'emerald', title: t('landing.operatorTitle'), features: ['QR skeniranje', 'PIN identifikacija', t('worker.checklist'), t('worker.photoEvidence').split(' ')[0]] },
              { icon: Wrench, color: 'orange', title: t('landing.engineerTitle'), features: [t('nav.radnik'), t('dash.maintenance'), t('dash.damages'), t('dash.compliance')] },
              { icon: ShieldCheck, color: 'purple', title: t('landing.adminTitle'), features: [t('dash.equipment'), t('dash.reports'), t('dash.statistics'), t('dash.analytics')] }
            ].map((role, i) => {
              const colorMap: Record<string, string> = { emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700', orange: 'bg-orange-50 border-orange-200 text-orange-700', purple: 'bg-purple-50 border-purple-200 text-purple-700' }
              const iconColorMap: Record<string, string> = { emerald: 'text-emerald-600', orange: 'text-orange-600', purple: 'text-purple-600' }
              const cardClass = colorMap[role.color] || ''
              const iconClass = iconColorMap[role.color] || ''
              return (
                <div key={i} className={'p-6 rounded-xl border-2 ' + cardClass + ' hover:shadow-lg transition'}>
                  <div className="flex items-center gap-3 mb-4"><role.icon className={'h-7 w-7 ' + iconClass} /><h3 className="font-bold text-lg">{role.title}</h3></div>
                  <ul className="space-y-2">{role.features.map((f, j) => (<li key={j} className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 flex-shrink-0" />{f}</li>))}</ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="border-b bg-muted/20">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[{ icon: Globe, title: 'HR / EN', desc: 'Višejezična podrška' }, { icon: Zap, title: 'PWA', desc: 'Offline podrška' }, { icon: Lock, title: 'RLS', desc: 'Row Level Security' }, { icon: Cloud, title: 'Cloud', desc: 'Vercel + Supabase' }].map((item, i) => (
              <div key={i} className="text-center p-4 rounded-xl bg-card border"><item.icon className="h-6 w-6 text-primary mx-auto mb-2" /><div className="font-bold text-sm">{item.title}</div><div className="text-xs text-muted-foreground">{item.desc}</div></div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t py-6 px-4 text-center text-xs text-muted-foreground print:hidden">
        <div className="container mx-auto space-y-1">
          <p>{t('landing.footer')}</p>
          {demoMode && <p className="text-amber-600">{t('landing.demoMode')}</p>}
          <div className="flex gap-4 justify-center pt-2">
            <Link href="/about" className="hover:text-foreground transition">{t('nav.about')}</Link>
            <Link href="/features" className="hover:text-foreground transition">{t('nav.features')}</Link>
            <Link href="/fids" className="hover:text-foreground transition">{t('nav.fids')}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export function WorkerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-muted-foreground">Učitavanje...</div></div>}>
      <WorkerPageInner />
    </Suspense>
  )
}
