'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, ScanLine, X, Keyboard, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

interface QrScannerProps {
  onScan: (decoded: string) => void
  onError?: (err: string) => void
}

export function QrScanner({ onScan, onError }: QrScannerProps) {
  const containerId = 'qr-reader-container'
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [scanning, setScanning] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [manualValue, setManualValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([])
  const [activeCamera, setActiveCamera] = useState<string | null>(null)
  const lastScanRef = useRef<{ value: string; time: number }>({ value: '', time: 0 })

  // Prikaži listu kamera
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          setCameras(devices)
          // Preferiraj back kameru
          const back = devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices[devices.length - 1]
          setActiveCamera(back.id)
        }
      })
      .catch((err) => {
        setError(`Ne mogu pristupiti kameri: ${err}`)
        setManualMode(true)
      })
  }, [])

  const stop = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        await scannerRef.current.clear()
      } catch {
        // ignore
      }
      scannerRef.current = null
    }
    setScanning(false)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    if (!activeCamera) {
      setError('Kamera nije dostupna. Koristite ručni unos.')
      setManualMode(true)
      return
    }
    try {
      const el = document.getElementById(containerId)
      if (!el) return

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerId, { verbose: false })
      }

      await scannerRef.current.start(
        activeCamera,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          const now = Date.now()
          // Debounce - ne dozvoli istu vrijednost unutar 3s
          if (lastScanRef.current.value === decodedText && now - lastScanRef.current.time < 3000) return
          lastScanRef.current = { value: decodedText, time: now }
          onScan(decodedText)
        },
        () => {
          // ignore per-frame errors
        }
      )
      setScanning(true)
    } catch (err: any) {
      setError(`Greška pri pokretanju kamere: ${err?.message ?? err}`)
      setManualMode(true)
    }
  }, [activeCamera, onScan])

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(() => {})
      }
    }
  }, [])

  const handleSubmitManual = (e: React.FormEvent) => {
    e.preventDefault()
    const v = manualValue.trim().toUpperCase()
    if (!v) return
    onScan(v)
  }

  return (
    <div className="space-y-4">
      {!manualMode ? (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Camera className="h-4 w-4" />
              {scanning ? 'Skeniram...' : 'Skeniranje QR koda'}
            </div>
            {cameras.length > 1 && (
              <select
                className="text-xs border rounded px-2 py-1 bg-background"
                value={activeCamera ?? ''}
                onChange={(e) => {
                  setActiveCamera(e.target.value)
                  if (scanning) {
                    stop().then(() => start())
                  }
                }}
              >
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label || `Kamera ${c.id.slice(0, 4)}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div
            id={containerId}
            className="w-full aspect-square max-w-[320px] mx-auto rounded-lg overflow-hidden bg-black/5 border"
          />

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2">
            {!scanning ? (
              <Button onClick={start} className="flex-1">
                <ScanLine className="h-4 w-4 mr-2" />
                Pokreni kameru
              </Button>
            ) : (
              <Button onClick={stop} variant="destructive" className="flex-1">
                <X className="h-4 w-4 mr-2" />
                Zaustavi
              </Button>
            )}
            <Button onClick={() => setManualMode(true)} variant="outline">
              <Keyboard className="h-4 w-4 mr-2" />
              Ručno
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Keyboard className="h-4 w-4" />
            Ručni unos koda
          </div>
          <form onSubmit={handleSubmitManual} className="space-y-2">
            <Input
              autoFocus
              placeholder="npr. GSE-TOW-001"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              className="text-lg font-mono uppercase"
              autoCapitalize="characters"
            />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                Potvrdi
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setManualMode(false)
                  setError(null)
                }}
              >
                <Camera className="h-4 w-4 mr-2" />
                Kamera
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
