// Plakat "NEISPRAVNO - NE KORISTITI" za postavljanje u vozilo (GM1 ADR.OPS.C.007(d)): sprječava nenamjernu upotrebu
// neispravnog vozila, posebno od strane naredne smjene. ?id=<id prijave kvara>. A4, engineer i admin.
import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { db } from '@/lib/db'
import { createClientAsync as createSupabaseClient } from '@/lib/supabase/server'
import { transliterate as tr } from '@/lib/pdf-utils'

export const dynamic = 'force-dynamic'

function fitSize(text: string, font: PDFFont, max: number, want: number): number {
  const w = font.widthOfTextAtSize(text, want)
  return w <= max ? want : want * (max / w)
}
function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = []
  let line = ''
  for (const w of tr(text).split(/\s+/).filter(Boolean)) {
    const t = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(t, size) <= maxW) line = t
    else { if (line) out.push(line); line = w }
  }
  if (line) out.push(line)
  return out
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  if (user.role !== 'admin' && user.role !== 'engineer') return new NextResponse('Forbidden', { status: 403 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return new NextResponse('Nedostaje id prijave kvara', { status: 400 })

  let d: { code: string; name: string; description: string; severity: string; reportedBy: string; createdAt: string; location: string | null } | null = null
  if (isDemoMode()) {
    const r = await db.damageReport.findUnique({ where: { id }, include: { equipment: { select: { location: true } } } })
    if (r) d = { code: r.equipmentCode, name: r.equipmentName, description: r.description, severity: r.severity, reportedBy: r.reportedByName, createdAt: r.createdAt.toISOString(), location: r.equipment?.location ?? null }
  } else {
    const sb = await createSupabaseClient()
    const { data } = await sb.from('damage_reports').select('equipment_code, equipment_name, description, severity, reported_by_name, created_at, equipment:equipment(location)').eq('id', id).maybeSingle()
    if (data) d = { code: data.equipment_code, name: data.equipment_name, description: data.description, severity: data.severity, reportedBy: data.reported_by_name, createdAt: data.created_at, location: (data as any).equipment?.location ?? null }
  }
  if (!d) return new NextResponse('Prijava nije pronadjena', { status: 404 })

  const pdf = await PDFDocument.create()
  pdf.setTitle(`NEISPRAVNO - ${d.code}`)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const W = 595.28, H = 841.89
  const page = pdf.addPage([W, H])
  const RED = rgb(0.8, 0.07, 0.07)
  const center = (text: string, y: number, size: number, f: PDFFont, color = rgb(0, 0, 0), max = W - 80) => {
    const t = tr(text)
    const s = fitSize(t, f, max, size)
    page.drawText(t, { x: (W - f.widthOfTextAtSize(t, s)) / 2, y, size: s, font: f, color })
  }

  page.drawRectangle({ x: 0, y: H - 330, width: W, height: 330, color: RED })
  center('NEISPRAVNO', H - 150, 96, bold, rgb(1, 1, 1))
  center('NE KORISTITI', H - 235, 54, bold, rgb(1, 1, 1))
  center('NOT SERVICEABLE - DO NOT USE', H - 290, 26, bold, rgb(1, 0.9, 0.9))

  center(d.code, H - 420, 78, bold)
  center(d.name, H - 460, 22, font, rgb(0.2, 0.2, 0.2))
  if (d.location) center(`Lokacija: ${d.location}`, H - 484, 12, font, rgb(0.4, 0.4, 0.4))

  page.drawLine({ start: { x: 50, y: H - 510 }, end: { x: W - 50, y: H - 510 }, thickness: 1, color: rgb(0.7, 0.7, 0.7) })
  let y = H - 540
  page.drawText('RAZLOG:', { x: 50, y, size: 12, font: bold, color: RED })
  y -= 20
  for (const ln of wrap(d.description, font, 15, W - 100).slice(0, 5)) { page.drawText(ln, { x: 50, y, size: 15, font }); y -= 20 }
  y -= 10
  const when = new Date(d.createdAt).toLocaleString('hr-HR', { timeZone: 'Europe/Podgorica' })
  page.drawText(tr(`Prijavljeno: ${when}   |   Prijavio/la: ${d.reportedBy}   |   Tezina: ${d.severity}`), { x: 50, y, size: 10.5, font, color: rgb(0.3, 0.3, 0.3) })

  page.drawRectangle({ x: 50, y: 70, width: W - 100, height: 96, borderColor: RED, borderWidth: 2 })
  const rules = [
    'Ovaj plakat se postavlja u vozilo/na opremu dok je neispravno (ADR.OPS.C.007(d)).',
    'Vozilo se ne smije koristiti niti zaduziti dok radionica ne zavrsi popravku,',
    'a sef sluzbe ne pregleda vozilo i to ne upise u aplikaciju GSE Control.',
    'Plakat skida iskljucivo radionica ili sef sluzbe nakon odobrenog pregleda.',
  ]
  rules.forEach((r, i) => page.drawText(r, { x: 62, y: 146 - i * 17, size: 10.5, font: i === 3 ? bold : font }))
  page.drawText(tr(`GSE Control - Aerodrom Tivat (LYTV)  |  Stampao/la: ${user.full_name}, ${new Date().toLocaleString('hr-HR', { timeZone: 'Europe/Podgorica' })}`), { x: 50, y: 40, size: 8, font, color: rgb(0.5, 0.5, 0.5) })

  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="neispravno-${d.code}.pdf"`, 'Cache-Control': 'no-store' },
  })
}
