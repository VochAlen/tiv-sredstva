// Jednostrani vodič za radionicu (A4) - za zid. Koraci + QR kod koji vodi na aplikaciju.
// Ne zavisi od baze. QR se crta iz SVG putanje koju generiše qrcode.react (bez nove zavisnosti).

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QRCodeSVG } from 'qrcode.react'
import { W, H, M, NAVY, ACCENT, INK, MUTED, LINE, ZEBRA, RED, WHITE, makeCtx } from '@/lib/pdf-gse-kit'
import { transliterate as tr } from '@/lib/pdf-utils'

const STEPS: Array<{ title: string; text: string }> = [
  { title: 'Skeniraj QR na vozilu', text: 'Radionica > "Skeniraj QR". Odmah se otvara kartica kvara tog sredstva sa velikim dugmetom sljedeceg koraka.' },
  { title: 'PREUZMI KVAR', text: 'Jedan dodir. Upisuje se ko je preuzeo i kada. Kvar je od sada "U radionici".' },
  { title: 'Sredstvo dovezeno u radionicu', text: 'Izaberi sa liste ko je dovezao sredstvo. Datum i vrijeme dolaska upisuju se automatski.' },
  { title: 'POPRAVKA ZAVRSENA', text: 'Upisi sta je uradjeno i koji dijelovi. Radnike izaberi sa liste (moze vise osoba).' },
  { title: 'Pregled sefa sluzbe', text: 'Sef izabere sebe sa liste, potvrdi probu i rezultat. Ako pregled ne prodje, kvar se vraca u popravku.' },
  { title: 'Preuzimanje iz radionice', text: 'Izaberi ko preuzima sredstvo. Tek tada je sredstvo ponovo spremno za rad.' },
]

export async function buildWorkshopGuidePdf(appUrl: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle('Vodic za radionicu - GSE Control')
  pdf.setAuthor('GSE Control - Aerodrom Tivat')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([W, H])
  const c = makeCtx(page, font, bold)
  const { T, fit } = c

  // Zaglavlje
  page.drawRectangle({ x: 0, y: H - 92, width: W, height: 92, color: NAVY })
  T('RADIONICA - KAKO RADIMO', M, H - 44, 26, bold, WHITE)
  T('Jedan kvar = jedna kartica. Svaki korak je jedan veliki taster.', M, H - 66, 11, font, rgb(0.8, 0.9, 0.95))

  // Koraci
  let y = H - 118
  const rowH = 78
  STEPS.forEach((s, i) => {
    if (i % 2 === 0) page.drawRectangle({ x: M, y: y - rowH + 8, width: W - 2 * M, height: rowH - 4, color: ZEBRA })
    page.drawCircle({ x: M + 30, y: y - 28, size: 22, color: ACCENT })
    const n = String(i + 1)
    T(n, M + 30 - bold.widthOfTextAtSize(n, 24) / 2, y - 36, 24, bold, WHITE)
    T(tr(s.title), M + 66, y - 20, 17, bold, NAVY)
    // zamotaj tekst u 2 reda
    const words = tr(s.text).split(' ')
    const lines: string[] = []
    let cur = ''
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w
      if (font.widthOfTextAtSize(t, 11.5) > W - 2 * M - 80) { lines.push(cur); cur = w } else cur = t
    }
    if (cur) lines.push(cur)
    lines.slice(0, 3).forEach((l, k) => T(l, M + 66, y - 38 - k * 14, 11.5, font, INK))
    y -= rowH
  })

  // Pravila
  y -= 6
  page.drawRectangle({ x: M, y: y - 62, width: W - 2 * M, height: 62, borderColor: RED, borderWidth: 1.5, color: rgb(1, 0.96, 0.96) })
  T('3 DANA BEZ STATUSA = CRVENO UPOZORENJE', M + 12, y - 20, 13, bold, RED)
  T('Ako se sredstvo 3 dana ne pomjera, upisi status (npr. "Cekamo dio"). Nista drugo se ne trazi.', M + 12, y - 38, 10.5, font, INK)
  T('Imena se biraju sa liste radnika - ne kucaju se. Ako nekog nema, javi sefu da ga doda u evidenciju.', M + 12, y - 52, 10.5, font, INK)

  // QR
  const qrSize = 120
  const svg = renderToStaticMarkup(createElement(QRCodeSVG, { value: appUrl, size: 256, level: 'M', marginSize: 0 }))
  const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1])
  const qrPath = paths[paths.length - 1] // zadnja putanja = tamni moduli
  const dim = Number(svg.match(/viewBox="0 0 (\d+)/)?.[1] ?? 0) || 1
  const qx = W - M - qrSize
  const qy = 40
  page.drawRectangle({ x: qx - 6, y: qy - 6, width: qrSize + 12, height: qrSize + 12, color: WHITE, borderColor: LINE, borderWidth: 1 })
  if (qrPath) page.drawSvgPath(qrPath, { x: qx, y: qy + qrSize, scale: qrSize / dim, color: rgb(0, 0, 0), borderWidth: 0 })
  T('SKENIRAJ - OTVORI APLIKACIJU', M, qy + 92, 14, bold, NAVY)
  T('Prijava u aplikaciju: Radionica je prvi ekran.', M, qy + 74, 10.5, font, INK)
  T(fit(appUrl, font, 10, qx - M - 20), M, qy + 56, 10, font, MUTED)
  T('Savjet: dodaj aplikaciju na pocetni ekran tableta (Chrome > Dodaj na pocetni ekran).', M, qy + 38, 9.5, font, MUTED)
  T('GSE Control - Aerodrom Tivat (LYTV)  |  EASA ADR.OPS.C.007', M, 24, 8, font, MUTED)

  return await pdf.save()
}
