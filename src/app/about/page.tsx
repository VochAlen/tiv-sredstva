'use client'

import { Plane, ShieldCheck, Code2, Calendar, MapPin, Award, Target, Cpu, Database, Cloud, Smartphone, QrCode } from 'lucide-react'
import { LanguageToggle } from '@/components/language-toggle'
import { useLang } from '@/lib/lang-context'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/30">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <Link href="/"><div className="flex items-center gap-2.5"><div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><Plane className="h-5 w-5" /></div><div className="font-bold text-base">GSE Control</div></div></Link>
          <div className="flex items-center gap-2"><LanguageToggle /><Link href="/features"><Button variant="ghost" size="sm">{t('nav.features')}</Button></Link><Link href="/"><Button variant="outline" size="sm">{t('nav.home')}</Button></Link></div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-10 max-w-4xl">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/20">{t('about.experience')}</Badge>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">{t('about.title')}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t('about.subtitle')}</p>
        </div>
        <Card className="mb-8 border-2 border-primary/20"><CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0"><Plane className="h-10 w-10 text-primary-foreground" /></div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-1">{t('about.developerName')}</h2>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4"><span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />Aerodrom Tivat (TIV)</span><span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />25 godina</span></div>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('about.developerBio')}</p>
            </div>
          </div>
        </CardContent></Card>
        <Card className="mb-8 bg-gradient-to-br from-primary/5 to-transparent"><CardContent className="p-6 text-center">
          <Target className="h-8 w-8 text-primary mx-auto mb-3" /><h3 className="font-semibold mb-2">{t('about.missionTitle')}</h3>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">{t('about.missionText')}</p>
        </CardContent></Card>
        <div className="mb-4"><h2 className="text-xl font-bold mb-1">{t('about.techTitle')}</h2><p className="text-sm text-muted-foreground mb-4">{t('about.techSubtitle')}</p></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-12">
          {techStack.map((tech) => (<Card key={tech.name} className="p-4 hover:shadow-md transition"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><tech.icon className="h-5 w-5 text-primary" /></div><div><div className="font-semibold text-sm">{tech.name}</div><div className="text-xs text-muted-foreground">{tech.desc}</div></div></div></Card>))}
        </div>
        <Card className="mb-8 border-2 border-emerald-200 bg-emerald-50/50"><CardContent className="p-6">
          <div className="flex items-center gap-3 mb-3"><ShieldCheck className="h-6 w-6 text-emerald-600" /><h3 className="font-semibold">Compliance & Standards</h3></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[['IATA AHM 340', 'Pre-use inspection'], ['IATA AHM 1110', 'Operator qualifications'], ['IATA AHM 1130', 'Damage reporting'], ['EASA Part-145', 'Maintenance log'], ['EASA Part-M §39', 'Airworthiness Directives'], ['EASA Part-145 §50', 'Life-limited parts']].map(([code, desc]) => (<div key={code} className="flex items-start gap-2"><Award className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" /><div><strong>{code}</strong> — {desc}</div></div>))}
          </div>
        </CardContent></Card>
        <div className="text-center"><Link href="/features"><Button size="lg">{t('nav.features')} →</Button></Link></div>
      </main>
      <footer className="mt-auto border-t py-4 text-center text-xs text-muted-foreground"><p>{t('landing.footer')}</p></footer>
    </div>
  )
}
