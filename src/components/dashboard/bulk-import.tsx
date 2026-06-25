'use client'

import { useState, useTransition, useRef } from 'react'
import { Upload, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { bulkImportEquipment } from '@/lib/actions-advanced'

interface ImportResult {
  ok: boolean
  created: number
  skipped: number
  errors: string[]
}

export function BulkImportDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setCsvText(event.target?.result as string)
      setResult(null)
    }
    reader.readAsText(file)
  }

  const handleImport = () => {
    if (!csvText.trim()) {
      toast.error('Unesite CSV tekst ili uploadajte fajl')
      return
    }

    const lines = csvText.trim().split('\n')
    if (lines.length < 2) {
      toast.error('CSV mora imati header red i najmanje jedan red podataka')
      return
    }

    // Parse CSV: code,name,type,serialNumber,location
    const items: Array<{ code: string; name: string; type: string; serialNumber?: string; location: string }> = []
    const errors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''))
      if (parts.length < 5) {
        errors.push(`Red ${i + 1}: Nedovoljno kolona (potrebno 5: code,name,type,serialNumber,location)`)
        continue
      }
      items.push({
        code: parts[0].toUpperCase(),
        name: parts[1],
        type: parts[2].toUpperCase(),
        serialNumber: parts[3] || undefined,
        location: parts[4],
      })
    }

    if (items.length === 0) {
      toast.error('Nema validnih redova za import')
      return
    }

    startTransition(async () => {
      try {
        const res = await bulkImportEquipment(items)
        setResult(res as ImportResult)
        if (res.ok) {
          toast.success(`Import završen: ${res.created} kreirano, ${res.skipped} preskočeno`)
          onImported()
        }
      } catch (e: any) {
        toast.error(`Greška: ${e?.message ?? e}`)
      }
    })
  }

  const downloadTemplate = () => {
    const template = `code,name,type,serialNumber,location
GSE-TOW-010,Tow Tractor Goldhofer AST-3,TOW_TRACTOR,GH-2025-001,Stand D1
GSE-GPU-004,GPU ITW GSE 1400,GPU,ITW-2024-050,Stand D2
GSE-BLT-004,Belt Loader TLD TB-150,BELT_LOADER,TLD-2024-300,Stand D3`
    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'gse-import-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 mr-1.5" />
        Bulk import CSV
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Bulk import opreme iz CSV
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                CSV format: <code className="bg-muted px-1 py-0.5 rounded text-xs">code,name,type,serialNumber,location</code>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                  Upload CSV fajl
                </Button>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-1.5" />
                  Preuzmi template
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileUpload}
              />

              <div className="space-y-1.5">
                <Label>CSV sadržaj</Label>
                <Textarea
                  value={csvText}
                  onChange={(e) => { setCsvText(e.target.value); setResult(null) }}
                  rows={8}
                  placeholder="code,name,type,serialNumber,location&#10;GSE-TOW-010,Tow Tractor Goldhofer,TOW_TRACTOR,GH-2025-001,Stand D1"
                  className="font-mono text-xs"
                />
              </div>

              {result && (
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      {result.created} kreirano
                    </span>
                    <span className="flex items-center gap-1 text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      {result.skipped} preskočeno (već postoji)
                    </span>
                    {result.errors.length > 0 && (
                      <span className="flex items-center gap-1 text-red-600">
                        <AlertCircle className="h-4 w-4" />
                        {result.errors.length} grešaka
                      </span>
                    )}
                  </div>
                  {result.errors.length > 0 && (
                    <div className="text-xs text-red-600 space-y-0.5 max-h-32 overflow-y-auto">
                      {result.errors.map((err, i) => (
                        <div key={i}>{err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setOpen(false)}>Zatvori</Button>
                <Button onClick={handleImport} disabled={isPending || !csvText.trim()}>
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Import
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
