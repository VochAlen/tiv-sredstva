'use client'

import { useState } from 'react'
import { FileText, Download, Loader2, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export function ReportsView() {
  const [loading, setLoading] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const [dailyDate, setDailyDate] = useState(today)
  const [monthlyMonth, setMonthlyMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)
  const [yearlyYear, setYearlyYear] = useState(new Date().getFullYear().toString())

  const downloadReport = async (type: 'daily' | 'monthly' | 'yearly') => {
    setLoading(type)
    try {
      let url = `/api/reports/${type}?`
      if (type === 'daily') {
        url += `date=${dailyDate}`
      } else if (type === 'monthly') {
        const [y, m] = monthlyMonth.split('-')
        url += `year=${y}&month=${m}`
      } else {
        url += `year=${yearlyYear}`
      }

      const res = await fetch(url)
      if (!res.ok) throw new Error('Greška pri generisanju izvještaja')

      const blob = await res.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') ?? `${type}-report.pdf`
      link.click()
      URL.revokeObjectURL(downloadUrl)
      toast.success('Izvještaj generisan')
    } catch (e: any) {
      toast.error(`Greška: ${e?.message ?? e}`)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          PDF izvještaji
        </h2>
        <p className="text-sm text-muted-foreground">
          Generiši službene izvještaje u PDF formatu — IATA AHM 340 + EASA Part-145 compliant
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Dnevni */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              Dnevni izvještaj
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Sve aktivnosti, oštećenja i sažetak za izabrani dan.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="daily-date" className="text-xs">Datum</Label>
              <Input
                id="daily-date"
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
              />
            </div>
            <Button
              onClick={() => downloadReport('daily')}
              disabled={loading === 'daily'}
              className="w-full"
            >
              {loading === 'daily' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Generiši PDF
            </Button>
          </CardContent>
        </Card>

        {/* Mjesečni */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-600" />
              Mjesečni izvještaj
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Kompletna analiza mjeseca: aktivnost po danima, top oprema, prijave oštećenja, održavanje.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="monthly-month" className="text-xs">Mjesec</Label>
              <Input
                id="monthly-month"
                type="month"
                value={monthlyMonth}
                onChange={(e) => setMonthlyMonth(e.target.value)}
              />
            </div>
            <Button
              onClick={() => downloadReport('monthly')}
              disabled={loading === 'monthly'}
              className="w-full"
            >
              {loading === 'monthly' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Generiši PDF
            </Button>
          </CardContent>
        </Card>

        {/* Godišnji */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              Godišnji izvještaj
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Executive summary, MTBF/MTTR metriku, aktivnost po mjesecima, zaključci i preporuke.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="yearly-year" className="text-xs">Godina</Label>
              <Input
                id="yearly-year"
                type="number"
                value={yearlyYear}
                onChange={(e) => setYearlyYear(e.target.value)}
                min="2020"
                max="2100"
              />
            </div>
            <Button
              onClick={() => downloadReport('yearly')}
              disabled={loading === 'yearly'}
              className="w-full"
            >
              {loading === 'yearly' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Generiši PDF
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Šta sadrži koji izvještaj:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li><strong>Dnevni:</strong> Sažetak dana, lista zaduživanja, razduživanja, nove prijave oštećenja</li>
            <li><strong>Mjesečni:</strong> Kompletan sažetak mjeseca, aktivnost po danima, top 10 opreme, sve prijave oštećenja, aktivnosti održavanja</li>
            <li><strong>Godišnji:</strong> Executive summary, MTBF/MTTR metriku, aktivnost po mjesecima, najproblematičnija oprema, zaključci i preporuke</li>
          </ul>
          <p className="pt-2 border-t">
            Svi izvještaji su compliance-ready za IATA AHM 340 i EASA Part-145 audit.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
