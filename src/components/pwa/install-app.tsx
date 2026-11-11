'use client'

import { useEffect, useState } from 'react'
import { Download, Share, SquarePlus, X, Smartphone } from 'lucide-react'
import { useLang } from '@/lib/lang-context'

// Instalacija aplikacije na početni ekran (PWA).
//  - Android / Chrome / Edge: hvata 'beforeinstallprompt' i jednim dodirom otvara sistemski prozor za instalaciju.
//  - iPhone / iPad (Safari): nema automatskog prozora, pa se prikazuje kratka uputa (Podijeli > Dodaj na početni ekran).
//  - Već instalirano (standalone) ili radnik kliknuo "Ne sada": ne prikazuje se ništa.
// Napomena: 'beforeinstallprompt' se pali samo na HTTPS-u, u produkciji (service worker se registruje samo tamo).

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'gse-install-dismissed'
const DISMISS_DAYS = 14

const TXT = {
  hr: {
    title: 'Instalirajte aplikaciju',
    sub: 'Ikona na početnom ekranu, otvara se preko cijelog ekrana.',
    install: 'Instaliraj',
    later: 'Ne sada',
    iosTitle: 'Dodajte na početni ekran',
    ios1: 'Dodirnite dugme Podijeli (kvadrat sa strelicom) u Safari-ju.',
    ios2: 'Izaberite „Dodaj na početni ekran“ (Add to Home Screen).',
    ios3: 'Potvrdite sa „Dodaj“. Ikona se pojavi među aplikacijama.',
    ok: 'Razumijem',
  },
  en: {
    title: 'Install the app',
    sub: 'Home-screen icon, opens full screen.',
    install: 'Install',
    later: 'Not now',
    iosTitle: 'Add to Home Screen',
    ios1: 'Tap the Share button (square with an arrow) in Safari.',
    ios2: 'Choose “Add to Home Screen”.',
    ios3: 'Confirm with “Add”. The icon appears among your apps.',
    ok: 'Got it',
  },
} as const

function isStandalone(): boolean {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true
    return (navigator as Navigator & { standalone?: boolean }).standalone === true
  } catch { return false }
}

function isIos(): boolean {
  const ua = navigator.userAgent
  const iPhoneOrPod = /iPhone|iPod/.test(ua)
  // iPadOS 13+ se predstavlja kao Mac, ali ima ekran na dodir
  const iPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return iPhoneOrPod || iPad
}

function recentlyDismissed(): boolean {
  try {
    const v = window.localStorage.getItem(DISMISS_KEY)
    if (!v) return false
    return Date.now() - Number(v) < DISMISS_DAYS * 86_400_000
  } catch { return false }
}

export function InstallApp() {
  const { lang } = useLang()
  const t = TXT[lang === 'en' ? 'en' : 'hr']
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [hidden, setHidden] = useState(true)
  const [showIos, setShowIos] = useState(false)

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setHidden(false)
    }
    const onInstalled = () => { setDeferred(null); setHidden(true) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    if (isIos()) { setIos(true); setHidden(false) }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => {
    setHidden(true)
    setShowIos(false)
    try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* privatni režim: samo se sakrije do osvježavanja */ }
  }

  const install = async () => {
    if (deferred) {
      try {
        await deferred.prompt()
        const { outcome } = await deferred.userChoice
        if (outcome === 'accepted') setHidden(true)
      } catch { /* prozor se ne može otvoriti: ostaje dugme */ }
      setDeferred(null)
      return
    }
    if (ios) setShowIos(true)
  }

  if (hidden || (!deferred && !ios)) return null

  return (
    <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-50 text-amber-950 p-3" role="region" aria-label={t.title}>
      <div className="flex items-start gap-3">
        <Smartphone className="h-5 w-5 mt-0.5 flex-shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t.title}</p>
          <p className="text-xs text-amber-900/80">{t.sub}</p>
        </div>
        <button type="button" onClick={dismiss} aria-label={t.later} className="h-9 w-9 -mr-1 -mt-1 flex items-center justify-center rounded-md text-amber-900/70 active:bg-amber-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      {showIos ? (
        <div className="mt-3 rounded-md bg-white/70 border border-amber-200 p-3 text-sm space-y-2">
          <p className="font-semibold">{t.iosTitle}</p>
          <p className="flex items-start gap-2"><Share className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden /><span>1. {t.ios1}</span></p>
          <p className="flex items-start gap-2"><SquarePlus className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden /><span>2. {t.ios2}</span></p>
          <p className="pl-6">3. {t.ios3}</p>
          <button type="button" onClick={dismiss} className="mt-1 h-11 w-full rounded-md bg-amber-500 text-amber-950 font-semibold active:bg-amber-600">{t.ok}</button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={install} className="h-11 flex-1 rounded-md bg-amber-500 text-amber-950 font-semibold flex items-center justify-center gap-2 active:bg-amber-600">
            <Download className="h-4 w-4" aria-hidden />{t.install}
          </button>
          <button type="button" onClick={dismiss} className="h-11 px-4 rounded-md border border-amber-400/60 text-sm active:bg-amber-100">{t.later}</button>
        </div>
      )}
    </div>
  )
}
