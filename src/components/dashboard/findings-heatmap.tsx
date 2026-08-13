'use client'

import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Finding = {
  id: string
  category: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
  latitude: number
  longitude: number
  status: string
  createdAt: string
}

const SEVERITY_COLOR: Record<string, string> = {
  LOW: '#3b82f6',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  CRITICAL: '#dc2626',
}

// Tivat Airport (LYTV) — približan centar aerodroma
const AIRPORT_CENTER: [number, number] = [18.7328, 42.4047]

export function FindingsHeatmap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/findings/geo?days=90')
      .then((r) => r.json())
      .then(setFindings)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return
    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: AIRPORT_CENTER,
      zoom: 15,
    })
    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right')

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    const markers: maplibregl.Marker[] = []

    findings.forEach((f) => {
      const el = document.createElement('div')
      el.style.width = '14px'
      el.style.height = '14px'
      el.style.borderRadius = '50%'
      el.style.border = '2px solid white'
      el.style.boxShadow = '0 0 4px rgba(0,0,0,0.4)'
      el.style.background = SEVERITY_COLOR[f.severity] ?? '#888'

      const popup = new maplibregl.Popup({ offset: 12 }).setHTML(
        `<div style="font-size:12px;max-width:200px">
          <strong>${f.category}</strong> · ${f.severity}<br/>
          ${f.description.slice(0, 100)}<br/>
          <span style="color:#888">${new Date(f.createdAt).toLocaleDateString('hr-HR')}</span>
        </div>`
      )

      const marker = new maplibregl.Marker({ element: el }).setLngLat([f.longitude, f.latitude]).setPopup(popup).addTo(mapRef.current!)
      markers.push(marker)
    })

    return () => markers.forEach((m) => m.remove())
  }, [findings])

  const counts = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1
    return acc
  }, {})

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-base">Mapa nalaza inspekcije (90 dana)</CardTitle>
        <div className="flex gap-1.5">
          {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((sev) => (
            <Badge
              key={sev}
              variant="outline"
              style={{ borderColor: SEVERITY_COLOR[sev], color: SEVERITY_COLOR[sev] }}
              className="text-[10px]"
            >
              {sev}: {counts[sev] ?? 0}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[400px] flex items-center justify-center text-sm text-muted-foreground">Ucitavanje...</div>
        ) : (
          <div ref={mapContainer} className="h-[400px] w-full rounded-lg overflow-hidden border" />
        )}
      </CardContent>
    </Card>
  )
}