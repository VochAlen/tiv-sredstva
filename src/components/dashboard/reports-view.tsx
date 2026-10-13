'use client'

import { useState } from 'react'
import { FileText, Download, Loader2, Calendar, TrendingDown, AlertTriangle, ShieldCheck } from 'lucide-react'
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

  const downloadReport = async (type: 'daily' | 'monthly' | 'yearly' | 'procurement-candidates' | 'fod-wildlife' | 'caa-oversight') => {
    setLoading(type)
    try {
      let url = `/api/reports/${type}?`
      if (type === 'daily') {
        url += `date=${dailyDate}`
      } else if (type === 'monthly') {
        const [y, m] = monthlyMonth.split('-')
        url += `year=${y}&month=${m}`
      } else if (type === 'yearly') {
        url += `year=${yearlyYear}`
      }
      // 'procurement-candidates' nema parametre - analizira cijelu flotu

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

      <div className="grid md:grid-cols-4 gap-4">
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

        {/* Kandidati za zamjenu */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Kandidati za zamjenu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Rangira flotu po kvarovima, vremenu van stroja i servisnom intervalu — podrška za planiranje nabavke.
            </p>
            <Button
              onClick={() => downloadReport('procurement-candidates')}
              disabled={loading === 'procurement-candidates'}
              className="w-full"
            >
              {loading === 'procurement-candidates' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Generiši PDF
            </Button>
          </CardContent>
        </Card>

        {/* FOD & Wildlife */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              FOD & Wildlife
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Prijave stranih predmeta (FOD) i opažanja divljih životinja za zadnjih 12 mjeseci, sa analizom trendova po lokaciji.
            </p>
            <Button
              onClick={() => downloadReport('fod-wildlife')}
              disabled={loading === 'fod-wildlife'}
              className="w-full"
            >
              {loading === 'fod-wildlife' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Generiši PDF
            </Button>
          </CardContent>
        </Card>
        {/* CAA Montenegro nadzorni izvještaj */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-700" />
              CAA nadzorni izvještaj
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Sažeti pregled za CAA Montenegro — compliance, nalazi, hazardi, incidenti, FOD/wildlife, fitness-for-duty. Samo agregatni brojevi, bez ličnih podataka.
            </p>
            <Button
              onClick={() => downloadReport('caa-oversight')}
              disabled={loading === 'caa-oversight'}
              className="w-full"
            >
              {loading === 'caa-oversight' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
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
            <li><strong>Kandidati za zamjenu:</strong> Rang-lista flote po broju kvarova, danima van stroja, servisnom intervalu, starosti i trošku održavanja — podloga za budžetiranje nabavke</li>
            <li><strong>FOD & Wildlife:</strong> Sve prijave stranih predmeta i divljih životinja za zadnjih 12 mjeseci, sa trendom po lokaciji — ADR.OPS.B.016 / ADR.OPS.B.020</li>
            <li><strong>CAA nadzorni izvještaj:</strong> Jednostranični sažetak za CAA Montenegro — compliance rate, otvoreni nalazi/CAPA, SMS hazardi, incidenti, FOD/wildlife, stopa fitness-for-duty potvrda i CRS status — ADR.AR.C.040 (kontinuirani nadzor)</li>
          </ul>
          <p className="pt-2 border-t">
            Svi izvještaji su compliance-ready za IATA AHM 340 i EASA Part-145 audit.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
