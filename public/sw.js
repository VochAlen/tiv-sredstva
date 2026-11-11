// Service Worker za GSE Control PWA
//
// PRAVILO: u keš ide SAMO javno i nepromjenjivo (JS/CSS chunk-ovi, ikone, slike, javna početna i login stranica).
// Ništa što zavisi od prijavljenog korisnika se ne kešira: /api/* (PDF izvještaji, podaci), dashboard stranice,
// RSC zahtjevi. Tablet koji dijeli više radnika zato ne čuva kopije tuđih izvještaja.
//
// Promjena CACHE_NAME briše sve starije keševe pri aktivaciji (tako nestaju i kopije
// koje je prethodna verzija ovog fajla možda sačuvala).

const CACHE_NAME = 'gse-control-v2'

// Javne stranice koje smiju u keš kao "offline ljuska" (isti HTML za sve posjetioce)
const PUBLIC_PAGES = ['/', '/login']

const STATIC_ASSETS = [
  '/',
  '/login',
  '/manifest.json',
  '/logo.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
]

// Javni statički resursi koji smiju u keš (po putanji/ekstenziji)
const STATIC_EXT = /\.(?:png|jpe?g|webp|avif|svg|ico|woff2?|ttf|otf)$/i
const isPublicStatic = (url) =>
  url.pathname.startsWith('/_next/static/') ||
  url.pathname.startsWith('/images/') ||
  STATIC_EXT.test(url.pathname)

// Install - prefetch javne ljuske
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Neki asseti možda ne postoje, ignoriši
      })
    })
  )
  self.skipWaiting()
})

// Activate - obriši SVE stare keševe (uključujući sve što je ranije sačuvano)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  )
  self.clients.claim()
})

const putInCache = (request, response) => {
  if (!response || !response.ok || response.type === 'opaque') return
  const copy = response.clone()
  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {})
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/_next/webpack-hmr')) return

  // Podaci i izvještaji: nikad kroz keš. Mreža, bez kopije.
  if (url.pathname.startsWith('/api/')) return

  // Next.js RSC / prefetch zahtjevi nose podatke prijavljenog korisnika: ne diraj
  if (url.searchParams.has('_rsc') || request.headers.get('RSC') || request.headers.get('Next-Router-Prefetch')) return

  // Stranice: uvijek mreža. U keš samo javne stranice; ostalo se ne čuva.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Ne kešira se ako je odgovor preusmjeren ili ako je korisniku dostavljen nešto drugo od javne stranice
          if (PUBLIC_PAGES.includes(url.pathname) && !response.redirected) putInCache(request, response)
          return response
        })
        .catch(() =>
          // Bez interneta: samo javna ljuska (početna). Nikad stranica sa podacima.
          caches.match(request).then((cached) => (PUBLIC_PAGES.includes(url.pathname) && cached) || caches.match('/'))
        )
    )
    return
  }

  // Javna statika: iz keša, pa mreža. Sve ostalo prolazi bez keša.
  if (isPublicStatic(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          putInCache(request, response)
          return response
        })
      })
    )
  }
})
