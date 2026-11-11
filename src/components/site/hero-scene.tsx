'use client'

import { useEffect, useRef, useState } from 'react'

// Three.js pozadina hero sekcije. Sve teško (three, ~150 KB gzip) se učitava
// tek nakon hidratacije, u zasebnom chunk-u, pa alat za skeniranje nikad ne
// čeka na animaciju. Ako WebGL ne radi, korisnik uključi "Uštedu podataka" ili
// se izgubi GL kontekst, ostaje običan hero sa fotografijom ispod.
export default function HeroScene() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number }
    if (nav.connection?.saveData) return

    let cancelled = false
    let handle: { start(): void; stop(): void; dispose(): void } | null = null
    let io: IntersectionObserver | null = null
    let onVis: (() => void) | null = null
    let visible = true

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const compact = window.innerWidth < 768 || (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4

    const onLost = (e: Event) => { e.preventDefault(); setReady(false); handle?.stop() }
    canvas.addEventListener('webglcontextlost', onLost)

    import('./hero-scene-core')
      .then(({ createHeroScene }) => {
        if (cancelled) return
        try {
          handle = createHeroScene(canvas, { reducedMotion, compact, onReady: () => setReady(true) })
        } catch {
          return // nema WebGL-a: ostaje fotografija
        }
        const sync = () => { if (visible && !document.hidden) handle?.start(); else handle?.stop() }
        io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync() }, { threshold: 0.02 })
        io.observe(wrap)
        onVis = sync
        document.addEventListener('visibilitychange', onVis)
        sync()
      })
      .catch(() => { /* chunk nije učitan: ostaje fotografija */ })

    return () => {
      cancelled = true
      canvas.removeEventListener('webglcontextlost', onLost)
      if (onVis) document.removeEventListener('visibilitychange', onVis)
      io?.disconnect()
      handle?.dispose()
    }
  }, [])

  return (
    <div ref={wrapRef} className="absolute inset-0" aria-hidden="true">
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={{ opacity: ready ? 1 : 0, transition: 'opacity 900ms ease' }}
      />
    </div>
  )
}
