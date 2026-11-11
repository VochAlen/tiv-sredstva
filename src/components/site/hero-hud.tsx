'use client'

import { useEffect, useState } from 'react'

// Dekorativni HUD u uglovima hero sekcije (samo desktop). Nema izmišljenih
// podataka: oznaka aerodroma, staza 14/32, UTC vrijeme i koordinate aerodroma.
export default function HeroHud() {
  const [utc, setUtc] = useState('')
  useEffect(() => {
    const tick = () => setUtc(new Date().toISOString().slice(11, 19) + ' UTC')
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: '0.14em' } as const
  return (
    <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
      <div className="absolute left-5 top-4 text-[10px] uppercase" style={{ ...mono, color: 'rgba(242,165,22,0.85)' }}>
        <div>LYTV · TIVAT</div>
        <div style={{ color: 'rgba(237,239,242,0.55)' }}>RWY 14/32 · {utc || '--:--:-- UTC'}</div>
      </div>
      <div className="absolute bottom-3 left-5 text-[10px] uppercase" style={{ ...mono, color: 'rgba(237,239,242,0.45)' }}>
        42°24′N · 018°43′E
      </div>
    </div>
  )
}
