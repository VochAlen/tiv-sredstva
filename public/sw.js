// Service Worker za GSE Control PWA
// Cache statičkih resursa za offline rad

const CACHE_NAME = 'gse-control-v1'
const STATIC_ASSETS = [
  '/',
  '/login',
  '/fids',
  '/manifest.json',
  '/logo.svg',
  '/icon-192.png',
  '/icon-512.png',
]

// Install - prefetch static assets
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

// Activate - očisti stare cache-ove
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Fetch - network-first za API, cache-first za statičke
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return

  // Skip Next.js HMR/dev requests
  if (url.pathname.startsWith('/_next/webpack-hmr')) return

  // Cache-first za _next/static (JS/CSS chunk-ovi - nepromjenjivi po hash-u)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
      })
    )
    return
  }

  // Network-first za stranice i API (uvijek najnoviji podaci)
  if (request.mode === 'navigate' || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Sačuvaj u cache ako je uspješan
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch(() => {
          // Ako nema interneta, vrati iz cache-a
          return caches.match(request).then((cached) => {
            return cached || caches.match('/')
          })
        })
    )
    return
  }

  // Cache-first za ostale statičke assete (slike, fontovi)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone)
          })
        }
        return response
      })
    })
  )
})
