'use client'

// Shematska mapa aerodroma Tivat (SVG): pista 2500 x 45 m u razmjeri, apron, rulne staze, okolina.
//  - mode="pick": korisnik dodirne mjesto na mapi -> zona + tačka (prijava wildlife)
//  - mode="heat": heatmapa opažanja, jedna boja po vrsti (FOD & Wildlife stranica)

import { useId, useMemo, type MouseEvent } from 'react'
import {
  MAP_W, MAP_H, RUNWAY, THIRD_BOUNDS, THRESHOLD_LEFT, THRESHOLD_RIGHT, APRON_RECTS, TERMINAL_RECT, TWY_RECTS, INFIELD_RECT,
  ZONES, zoneAt, speciesById, type ZoneId,
} from '@/lib/airport-map'

export interface HeatPoint {
  id: string
  x: number
  y: number
  count: number
  strike: boolean
  speciesId: string
}

interface Props {
  mode: 'pick' | 'heat'
  className?: string
  // pick
  selectedZone?: ZoneId | null
  point?: { x: number; y: number } | null
  onPick?: (p: { x: number; y: number; zone: ZoneId }) => void
  // heat
  points?: HeatPoint[]
  activeSpecies?: Set<string>
}

const rect = (r: { x0: number; y0: number; x1: number; y1: number }) => ({ x: r.x0, y: r.y0, width: r.x1 - r.x0, height: r.y1 - r.y0 })

function Plane({ x, y, s = 1.2, rot = 0 }: { x: number; y: number; s?: number; rot?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}
      d="M0,-9 L2,-3 L11,2 L11,4 L2,2 L2,7 L5,9 L5,10 L0,9 L-5,10 L-5,9 L-2,7 L-2,2 L-11,4 L-11,2 L-2,-3 Z"
      fill="#5b6470"
    />
  )
}

export function AirportMap({ mode, className, selectedZone, point, onPick, points, activeSpecies }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const isPick = mode === 'pick'

  const handle = (e: MouseEvent<SVGSVGElement>) => {
    if (!isPick || !onPick) return
    const r = e.currentTarget.getBoundingClientRect()
    if (!r.width || !r.height) return
    const x = Math.min(MAP_W, Math.max(0, ((e.clientX - r.left) / r.width) * MAP_W))
    const y = Math.min(MAP_H, Math.max(0, ((e.clientY - r.top) / r.height) * MAP_H))
    onPick({ x, y, zone: zoneAt(x, y) })
  }

  const visible = useMemo(
    () => (points ?? []).filter((p) => !activeSpecies || activeSpecies.has(p.speciesId)),
    [points, activeSpecies],
  )
  const usedSpecies = useMemo(() => [...new Set((points ?? []).map((p) => p.speciesId))], [points])

  const thirdW = (RUNWAY.x1 - RUNWAY.x0) / 3

  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      className={className}
      style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'manipulation', cursor: isPick ? 'crosshair' : 'default', borderRadius: 8 }}
      role="img"
      aria-label="Shematska mapa aerodroma Tivat: pista 2500 x 45 m, apron i okolina"
      onClick={handle}
    >
      <defs>
        {usedSpecies.map((id) => {
          const c = speciesById(id).color
          return (
            <radialGradient key={id} id={`${uid}-${id}`}>
              <stop offset="0%" stopColor={c} stopOpacity="0.7" />
              <stop offset="55%" stopColor={c} stopOpacity="0.3" />
              <stop offset="100%" stopColor={c} stopOpacity="0" />
            </radialGradient>
          )
        })}
      </defs>

      {/* okolina */}
      <rect x="0" y="0" width={MAP_W} height={MAP_H} fill="#eef3e9" />
      <rect x="20" y="244" width="960" height="56" fill="#e0e9d6" />

      {/* infield (trava) */}
      <rect {...rect(INFIELD_RECT)} rx="14" fill="#e4eddc" />

      {/* rulne staze */}
      {TWY_RECTS.map((r, i) => <rect key={i} {...rect(r)} fill="#c3c8ce" />)}

      {/* apron + terminal */}
      {APRON_RECTS.map((r, i) => <rect key={i} {...rect(r)} fill="#d6dae0" />)}
      <rect {...rect(TERMINAL_RECT)} fill="#9aa3ad" />
      <rect x="150" y="36" width="180" height="6" fill="#7d8791" />
      <text x="240" y="58" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">TERMINAL</text>
      <Plane x={250} y={118} />
      <Plane x={330} y={126} rot={20} />
      <Plane x={430} y={116} />
      <text x="500" y="160" textAnchor="end" fontSize="12" fontWeight="700" fill="#5b6470">APRON</text>
      <text x="650" y="142" textAnchor="middle" fontSize="11" fontWeight="700" fill="#5b6470">APRON</text>
      <text x="330" y="199" textAnchor="middle" fontSize="11" fontWeight="600" fill="#8a9a78">trava</text>
      <text x="335" y="240" textAnchor="middle" fontSize="10" fontWeight="700" fill="#5b6470">RULNA STAZA (TWY)</text>

      {/* pista 2500 x 45 m */}
      <rect x={RUNWAY.x0} y={RUNWAY.y0} width={RUNWAY.x1 - RUNWAY.x0} height={RUNWAY.y1 - RUNWAY.y0} fill="#7f8791" />
      <line x1={RUNWAY.x0 + 30} y1={(RUNWAY.y0 + RUNWAY.y1) / 2} x2={RUNWAY.x1 - 30} y2={(RUNWAY.y0 + RUNWAY.y1) / 2} stroke="#fff" strokeWidth="1.4" strokeDasharray="14 10" />
      {[0, 1].map((i) => (
        <g key={i}>
          {[0, 1, 2, 3].map((k) => (
            <rect key={k} x={i === 0 ? RUNWAY.x0 + 4 : RUNWAY.x1 - 9} y={RUNWAY.y0 + 1.5 + k * 3.6} width="5" height="1.8" fill="#fff" />
          ))}
        </g>
      ))}
      <text x={RUNWAY.x0 + 16} y={RUNWAY.y0 + 12} fontSize="9" fontWeight="800" fill="#fff">{THRESHOLD_LEFT}</text>
      <text x={RUNWAY.x1 - 16} y={RUNWAY.y0 + 12} fontSize="9" fontWeight="800" fill="#fff" textAnchor="end">{THRESHOLD_RIGHT}</text>

      {/* granice trećina */}
      {THIRD_BOUNDS.map((x) => (
        <line key={x} x1={x} y1="248" x2={x} y2="286" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
      ))}
      {[0, 1, 2].map((i) => (
        <text key={i} x={RUNWAY.x0 + thirdW * i + thirdW / 2} y="284" textAnchor="middle" fontSize="12" fontWeight="800" fill="#334155">
          {i + 1}/3
        </text>
      ))}
      <text x="500" y="312" textAnchor="middle" fontSize="10" fontWeight="600" fill="#7a8a68">OKOLINA</text>

      {/* razmjera 500 m */}
      <g transform="translate(790 24)">
        <rect x="0" y="0" width={500 * 0.36} height="4" fill="#334155" />
        <text x={(500 * 0.36) / 2} y="16" textAnchor="middle" fontSize="9" fontWeight="600" fill="#334155">500 m</text>
      </g>
      <text x="790" y="52" fontSize="8.5" fill="#64748b">Pista 2500 x 45 m (shema)</text>

      {/* izabrana zona (prijava) */}
      {isPick && selectedZone && <ZoneHighlight zone={selectedZone} />}

      {/* heatmapa */}
      {!isPick && (
        <g>
          {visible.map((p) => {
            const r = 18 + Math.min(22, 6 * Math.log2(p.count + 1))
            return <circle key={p.id} cx={p.x} cy={p.y} r={r} fill={`url(#${uid}-${p.speciesId})`} />
          })}
          {visible.filter((p) => p.strike).map((p) => (
            <g key={`s-${p.id}`} stroke="#111827" strokeWidth="1.6" strokeLinecap="round">
              <circle cx={p.x} cy={p.y} r="6" fill="#fff" fillOpacity="0.85" />
              <line x1={p.x - 3} y1={p.y - 3} x2={p.x + 3} y2={p.y + 3} />
              <line x1={p.x - 3} y1={p.y + 3} x2={p.x + 3} y2={p.y - 3} />
            </g>
          ))}
        </g>
      )}

      {/* oznaka izabrane tačke */}
      {isPick && point && (
        <g>
          <circle cx={point.x} cy={point.y} r="11" fill="#dc2626" fillOpacity="0.25" />
          <circle cx={point.x} cy={point.y} r="5" fill="#dc2626" stroke="#fff" strokeWidth="2" />
        </g>
      )}

      <rect x="0.5" y="0.5" width={MAP_W - 1} height={MAP_H - 1} fill="none" stroke="#c9d1c0" />
    </svg>
  )
}

function ZoneHighlight({ zone }: { zone: ZoneId }) {
  const common = { fill: '#2563eb', fillOpacity: 0.2, stroke: '#2563eb', strokeWidth: 2 }
  const thirdW = (RUNWAY.x1 - RUNWAY.x0) / 3
  switch (zone) {
    case 'RWY_1': case 'RWY_2': case 'RWY_3': {
      const i = zone === 'RWY_1' ? 0 : zone === 'RWY_2' ? 1 : 2
      return <rect x={RUNWAY.x0 + thirdW * i} y={RUNWAY.y0 - 4} width={thirdW} height={RUNWAY.y1 - RUNWAY.y0 + 8} {...common} />
    }
    case 'APRON':
      return <g>{APRON_RECTS.map((r, i) => <rect key={i} {...rect(r)} {...common} />)}<rect {...rect(TERMINAL_RECT)} {...common} /></g>
    case 'TWY':
      return <g>{TWY_RECTS.map((r, i) => <rect key={i} {...rect(r)} {...common} />)}</g>
    default:
      return <rect x="3" y="3" width={MAP_W - 6} height={MAP_H - 6} fill="none" stroke="#2563eb" strokeWidth="3" strokeDasharray="10 6" />
  }
}

export { ZONES }
