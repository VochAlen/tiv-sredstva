'use client'

import { Plane, QrCode, Camera, FileText, BarChart3, Wrench, ShieldCheck, AlertTriangle, Users, Clock, Download, Smartphone, Lock, Database, Globe, RefreshCw, CheckCircle2 } from 'lucide-react'
import { LanguageToggle } from '@/components/language-toggle'
import { useLang } from '@/lib/lang-context'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function FeaturesPage() {
  const { t } = useLang()
  const coreFeatures = [
    { icon: QrCode, title: 'QR Skeniranje', desc: 'Radnici skeniraju QR kod sa telefona — podržana back kamera na iOS i Android' },
    { icon: Lock, title: 'PIN Identifikacija', desc: 'Brza identifikacija radnika pomoću 4-cifrenog PIN-a — bez login-a' },
    { icon: CheckCircle2, title: 'Pre-use Checklist', desc: '9-stavka IATA AHM 340 inspekcijska check-lista prije svakog zaduživanja' },
    { icon: AlertTriangle, title: 'Automatska blokada', desc: 'Sistem blokira zaduživanje neispravne opreme i automatski kreira Damage Report' },
    { icon: Camera, title: 'Foto dokazi', desc: 'Radnici mogu slikati oštećenja sa telefona kao dokaz za osiguranje i audit' },
    { icon: RefreshCw, title: 'Razduživanje', desc: 'Skeniranjem istog QR koda na kraju smjene — sa opcijom prijave novog oštećenja' },
  ]
  const advancedFeatures = [
    { icon: FileText, title: 'PDF Izvještaji', desc: 'Dnevni, mjesečni i godišnji izvještaji sa MTBF/MTTR metrikama — spremni za audit' },
    { icon: BarChart3, title: 'Statistika & Analytics', desc: 'Compliance rate, utilization, MTBF, MTTR, predictive maintenance alerti' },
    { icon: Wrench, title: 'Maintenance Log', desc: 'EASA Part-145 compliant log sa certifikatima, troškovima i zamijenjenim dijelovima' },
    { icon: ShieldCheck, title: 'EASA Compliance', desc: 'Life-limited komponente, Service Bulletins, Airworthiness Directives, shift handovers' },
    { icon: Users, title: 'Operator Qualifications', desc: 'Praćenje ko je obučen za koju vrstu opreme (IATA AHM 1110)' },
    { icon: Download, title: 'Export CSV', desc: 'Izvoz svih podataka (oprema, aktivnosti, oštećenja) u CSV format' },
  ]
  const techFeatures = [
    { icon: Smartphone, title: 'PWA Offline', desc: 'Radi na platformi bez interneta — Service Worker cache' },
    { icon: Globe, title: 'HR/EN Jezici', desc: 'Potpuna višejezična podrška sa pamćenjem izbora' },
    { icon: Database, title: 'Supabase + Prisma', desc: 'PostgreSQL sa Row Level Security — dvostruka zaštita podataka' },
    { icon: Clock, title: 'Real-time FIDS', desc: 'Javni aerodromski display sa auto-refresh svakih 30 sekundi' },
  ]
  const compliance = [
    { code: 'IATA AHM 340', desc: 'Pre-use inspection checklista' },
    { code: 'IATA AHM 1110', desc: 'Operator qualifications' },
    { code: 'IATA AHM 1130', desc: 'GSE damage reporting' },
    { code: 'EASA Part-145 §50', desc: 'Life-limited components' },
    { code: 'EASA Part-145 §71', desc: 'Service bulletins' },
    { code: 'EASA Part-M §39', desc: 'Airworthiness directives' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/30">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <Link href="/"><div className="flex items-center gap-2.5"><div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><Plane className="h-5 w-5" /></div><div className="font-bold text-base">GSE Control</div></div></Link>
          <div className="flex items-center gap-2"><LanguageToggle /><Link href="/about"><Button variant="ghost" size="sm">{t('nav.about')}</Button></Link><Link href="/"><Button variant="outline" size="sm">{t('nav.home')}</Button></Link></div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-10 max-w-5xl">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/20">{t('landing.badge')}</Badge>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">{t('features.title')}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t('features.subtitle')}</p>
        </div>
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" />{t('features.complianceTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {compliance.map((c) => (<Card key={c.code} className="p-4 border-l-4 border-l-emerald-500"><div className="font-mono text-sm font-bold text-emerald-700">{c.code}</div><div className="text-xs text-muted-foreground mt-1">{c.desc}</div></Card>))}
          </div>
        </div>
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />{t('features.coreTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {coreFeatures.map((f) => (<Card key={f.title} className="p-5 hover:shadow-md transition"><div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3"><f.icon className="h-5 w-5 text-primary" /></div><h3 className="font-semibold text-sm mb-1">{f.title}</h3><p className="text-xs text-muted-foreground">{f.desc}</p></Card>))}
          </div>
        </div>
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-orange-600" />{t('features.advancedTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {advancedFeatures.map((f) => (<Card key={f.title} className="p-5 hover:shadow-md transition"><div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center mb-3"><f.icon className="h-5 w-5 text-orange-600" /></div><h3 className="font-semibold text-sm mb-1">{f.title}</h3><p className="text-xs text-muted-foreground">{f.desc}</p></Card>))}
          </div>
        </div>
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Smartphone className="h-5 w-5 text-purple-600" />{t('features.techTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {techFeatures.map((f) => (<Card key={f.title} className="p-4 hover:shadow-md transition"><div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center mb-2"><f.icon className="h-4 w-4 text-purple-600" /></div><h3 className="font-semibold text-xs mb-1">{f.title}</h3><p className="text-xs text-muted-foreground">{f.desc}</p></Card>))}
          </div>
        </div>
        <div className="text-center"><Link href="/"><Button size="lg">{t('landing.getStarted')} →</Button></Link></div>
      </main>
      <footer className="mt-auto border-t py-4 text-center text-xs text-muted-foreground"><p>{t('landing.footer')}</p></footer>
    </div>
  )
}
