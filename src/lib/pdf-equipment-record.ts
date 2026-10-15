// Crtanje PDF-a "Karton sredstva" (odvojeno od rute da se može testirati bez baze).
//
// KARTON SREDSTVA - kompletna evidencija jednog sredstva (A4, više strana) za inspekciju / audit:
// identitet i garancija, servisni plan, svi kvarovi sa tokom radionice (ko i kada), probni rad i pregled šefa službe,
// radni nalozi i dijelovi, redovni servisi, PM nalozi, CRS, dnevni pregledi, brojila, ponavljajući kvarovi.
// (Jednostranični "karton ispravnosti" za zadnjih 30 dana je zaseban izvještaj: gse-equipment-card.)

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { EquipmentRecord } from '@/lib/actions-equipment-record'
import { EQUIPMENT_TYPE_LABELS } from '@/lib/types'
import { REPEAT_ADVICE } from '@/lib/repeat-defects'
import {
  W, H, M, NAVY, ACCENT, INK, MUTED, LINE, ZEBRA, GREEN, AMBER, RED, GRAY, WHITE,
  makeCtx, drawHeader, drawKpis, drawSectionTitle, drawTableHead, type Ctx,
} from '@/lib/pdf-gse-kit'
import { transliterate as tr } from '@/lib/pdf-utils'

const SOFT_RED = rgb(0.99, 0.9, 0.9) // pozadina zaglavlja otvorenog kvara
const SEV: Record<string, string> = { MINOR: 'Manje', MAJOR: 'Vece', CRITICAL: 'Kriticno' }
const DMG_STATUS: Record<string, string> = { OPEN: 'Otvoreno', IN_REPAIR: 'U popravci', AWAITING_APPROVAL: 'Ceka pregled sefa', RESOLVED: 'Rijeseno' }
const CAT: Record<string, string> = { MEHANIKA: 'Mehanika', ELEKTRIKA: 'Elektrika', HIDRAULIKA: 'Hidraulika', BEZBJEDNOST: 'Bezbjednost', OPSTE: 'Opste' }
const STATUS_TXT: Record<string, string> = { AVAILABLE: 'DOSTUPNO', ASSIGNED: 'ZADUZENO', OUT_OF_SERVICE: 'NEISPRAVNO', MAINTENANCE: 'NA ODRZAVANJU' }
const MNT_TYPE: Record<string, string> = { PREVENTIVE: 'Preventivno', CORRECTIVE: 'Korektivno', INSPECTION: 'Inspekcija', OVERHAUL: 'Remont' }
const INSP: Record<string, string> = { FIT: 'Ispravno', CONDITIONAL: 'Sa ogranicenjem', UNFIT: 'Neispravno' }

const dt = (v: string | null | undefined) => (v ? new Date(v).toLocaleString('hr-HR', { timeZone: 'Europe/Podgorica', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-')
const d = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString('hr-HR', { timeZone: 'Europe/Podgorica', day: '2-digit', month: '2-digit', year: 'numeric' }) : '-')
const num = (v: number | null | undefined, unit = '') => (v == null ? '-' : `${Math.round(v * 10) / 10}${unit}`)

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = tr(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w
    if (font.widthOfTextAtSize(t, size) <= maxW) cur = t
    else { if (cur) lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

export async function buildEquipmentRecordPdf(rec: EquipmentRecord, generatedBy: string): Promise<Uint8Array> {
  const eq = rec.equipment

  const pdf = await PDFDocument.create()
  pdf.setTitle(`Karton sredstva ${eq.code}`)
  pdf.setAuthor('GSE Control - Aerodrom Tivat')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const pages: PDFPage[] = []
  let c!: Ctx
  let page!: PDFPage
  let y = 0
  const BOTTOM = 52

  const firstPage = () => {
    page = pdf.addPage([W, H]); pages.push(page); c = makeCtx(page, font, bold)
    y = drawHeader(c, {
      title: 'KARTON SREDSTVA', subtitle: 'Equipment Maintenance Record  |  Reg. (EU) No 139/2014, ADR.OPS.C.007',
      line3: 'GSE Control  -  Aerodrom Tivat (LYTV)', bigRight: eq.code, smallRight: eq.name.slice(0, 40), smallRight2: `Stanje na dan ${d(rec.generatedAt)}`,
    }) - 10
  }
  const nextPage = () => {
    page = pdf.addPage([W, H]); pages.push(page); c = makeCtx(page, font, bold)
    page.drawRectangle({ x: 0, y: H - 24, width: W, height: 24, color: NAVY })
    c.T(`KARTON SREDSTVA  ${eq.code}`, M, H - 16, 9, bold, WHITE)
    c.TR(eq.name.slice(0, 50), W - M, H - 16, 8, font, WHITE)
    y = H - 24 - 14
  }
  const ensure = (h: number) => { if (y - h < BOTTOM) nextPage() }
  const section = (title: string) => { ensure(40); y -= 10; y = drawSectionTitle(c, title, y) + 2 }
  const para = (text: string, o: { x?: number; size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; w?: number } = {}) => {
    const size = o.size ?? 7, x = o.x ?? M, w = o.w ?? W - 2 * M - (x - M)
    for (const line of wrap(text, o.f ?? font, size, w)) { ensure(size + 3); c.T(line, x, y - size, size, o.f ?? font, o.color ?? INK); y -= size + 2.6 }
  }
  const kv = (rows: Array<[string, string]>) => {
    const colW = (W - 2 * M) / 2
    for (let i = 0; i < rows.length; i += 2) {
      ensure(12)
      ;[rows[i], rows[i + 1]].forEach((r, k) => {
        if (!r) return
        const x = M + k * colW
        c.T(r[0], x, y - 8, 6.3, bold, MUTED)
        c.T(c.fit(r[1], font, 7.6, colW - 92), x + 88, y - 8, 7.6, font, INK)
      })
      y -= 11.5
    }
  }
  const table = (cols: Array<{ label: string; x: number; w: number }>, rows: string[][], empty: string) => {
    ensure(40)
    y = drawTableHead(c, y, cols.map((x) => ({ label: x.label, x: x.x })))
    if (!rows.length) { c.T(empty, M + 4, y - 9, 7, font, MUTED); y -= 16; return }
    rows.forEach((r, i) => {
      ensure(12)
      if (i % 2 === 0) page.drawRectangle({ x: M, y: y - 11, width: W - 2 * M, height: 11, color: ZEBRA })
      r.forEach((cell, ci) => c.T(c.fit(cell, font, 6.8, cols[ci].w), cols[ci].x, y - 8, 6.8, font, INK))
      y -= 11
    })
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.4, color: LINE })
    y -= 6
  }

  firstPage()

  // ---------- Identitet ----------
  const st = STATUS_TXT[eq.status] ?? eq.status
  page.drawRectangle({ x: M, y: y - 20, width: W - 2 * M, height: 20, color: ZEBRA })
  page.drawRectangle({ x: M, y: y - 20, width: 3, height: 20, color: eq.status === 'AVAILABLE' ? GREEN : eq.status === 'OUT_OF_SERVICE' ? RED : AMBER })
  c.T(c.fit(`${eq.name}`, bold, 11, W - 2 * M - 150), M + 10, y - 14, 11, bold, NAVY)
  c.TR(st, W - M - 6, y - 14, 10, bold, eq.status === 'AVAILABLE' ? GREEN : eq.status === 'OUT_OF_SERVICE' ? RED : AMBER)
  y -= 28
  kv([
    ['Tip', (EQUIPMENT_TYPE_LABELS as Record<string, string>)[eq.type] ?? eq.type], ['Serijski broj', eq.serialNumber ?? '-'],
    ['Proizvodjac', eq.manufacturer ?? '-'], ['Godina proizvodnje', eq.modelYear ? String(eq.modelYear) : '-'],
    ['Registracija', eq.registrationNumber ?? '-'], ['Datum nabavke', d(eq.purchaseDate)],
    ['Garancija do', eq.warrantyExpiry ? `${d(eq.warrantyExpiry)}${new Date(eq.warrantyExpiry).getTime() >= Date.now() ? ' (vazi)' : ' (istekla)'}` : '-'], ['Lokacija', eq.location],
    ['Sluzba', eq.department === 'SLUZBA_PO' ? 'Sluzba zemaljskog opsluzivanja' : 'Tehnicka sluzba'], ['Gorivo', eq.fuelType ?? '-'],
    ['Brojac (km)', num(eq.totalKm, ' km')], ['Radni sati', num(eq.totalHours, ' h')],
    ['Servis', eq.externallyMaintained ? `Eksterni: ${eq.serviceProvider ?? '-'}${eq.serviceProviderPhone ? `, ${eq.serviceProviderPhone}` : ''}` : 'Interni (radionica)'], ['Aktivna ogranicenja', eq.restrictions.length ? eq.restrictions.join('; ') : 'nema'],
  ])
  y -= 4

  // ---------- KPI ----------
  const open = rec.damages.filter((x) => x.status !== 'RESOLVED').length
  ensure(40)
  y = drawKpis(c, y, [
    ['KVAROVA (UKUPNO)', rec.damages.length, NAVY], ['OTVORENO', open, open ? RED : GREEN], ['PREGLEDA (12 MJ.)', rec.inspections.total, ACCENT],
    ['NEISPRAVNO / OGR.', `${rec.inspections.unfit} / ${rec.inspections.conditional}`, rec.inspections.unfit ? RED : AMBER], ['REDOVNIH SERVISA', rec.serviceRecords.length, ACCENT], ['CRS', rec.crs.length, GRAY],
  ]) - 4

  // ---------- Ponavljajući kvarovi ----------
  if (rec.repeats.length) {
    section('PONAVLJAJUCI KVAROVI (3+ u 90 dana)')
    for (const g of rec.repeats) para(`${g.label}: ${g.count}x (${d(g.firstAt)} - ${d(g.lastAt)})${g.hasOpen ? ' - ima otvorenih' : ''}`, { f: bold, color: RED })
    para(REPEAT_ADVICE, { size: 6.5, color: MUTED })
  }

  // ---------- Servisni plan ----------
  section('SERVISNI PLAN (IATA AHM 917 / OEM)')
  if (rec.service) {
    kv([
      ['Program', rec.service.programText], ['Stanje plana', rec.service.statusText],
      ['Zadnji servis', `${d(rec.service.lastDate)}  (${num(rec.service.lastKm, ' km')}, ${num(rec.service.lastHours, ' h')})`], ['Sljedeci servis (procjena)', d(rec.service.plannedDate)],
    ])
    para(rec.service.summary, { size: 6.8, color: MUTED })
  } else para('Servisni plan nije konfigurisan za ovo sredstvo.', { color: MUTED })

  // ---------- Kvarovi i popravke ----------
  section(`KVAROVI I POPRAVKE (${rec.damages.length})`)
  if (!rec.damages.length) para('Nema evidentiranih kvarova.', { color: MUTED })
  for (const dm of rec.damages) {
    ensure(46)
    page.drawRectangle({ x: M, y: y - 12, width: W - 2 * M, height: 12, color: dm.status === 'RESOLVED' ? ZEBRA : SOFT_RED })
    c.T(`${dt(dm.createdAt)}  |  ${SEV[dm.severity] ?? dm.severity}${dm.category ? `  |  ${CAT[dm.category] ?? dm.category}` : ''}  |  Prijavio/la: ${dm.reportedBy}`, M + 4, y - 9, 7, bold, INK)
    c.TR(DMG_STATUS[dm.status] ?? dm.status, W - M - 4, y - 9, 7, bold, dm.status === 'RESOLVED' ? GREEN : RED)
    y -= 15
    para(dm.description + (dm.restriction ? `  [Ogranicenje: ${dm.restriction}]` : ''), { x: M + 4, size: 7 })
    const steps: string[] = []
    if (dm.acknowledgedAt) steps.push(`Preuzeto: ${dt(dm.acknowledgedAt)} (${dm.acknowledgedBy ?? '-'})`)
    if (dm.externalSentAt) steps.push(`Vanjski servis: ${dm.externalProvider ?? '-'}${dm.externalRef ? ` (nalog ${dm.externalRef})` : ''}, poslano ${dt(dm.externalSentAt)}${dm.externalReturnedAt ? `, vraceno ${dt(dm.externalReturnedAt)}` : ''}`)
    if (dm.workshopArrivedAt) steps.push(`U radionici: ${dt(dm.workshopArrivedAt)} (dovezao/la: ${dm.workshopArrivedBy ?? '-'})`)
    if (dm.repairedAt) steps.push(`Popravka zavrsena: ${dt(dm.repairedAt)} (${dm.repairedBy ?? '-'})`)
    if (dm.chiefInspectedAt) steps.push(`Pregled sefa sluzbe: ${dm.chiefName ?? '-'}, ${dt(dm.chiefInspectedAt)} - ${dm.chiefResult === 'OK' ? 'PROSAO' : 'NIJE PROSAO'}${dm.chiefNote ? ` (${dm.chiefNote})` : ''}`)
    if (dm.testDone) steps.push(`Probni rad / funkcionalni test: zadovoljava${dm.testNote ? ` (${dm.testNote})` : ''}`)
    if (dm.approvedAt) steps.push(`Odobreno / pusteno u rad: ${dt(dm.approvedAt)} (${dm.approvedBy ?? '-'})`)
    if (dm.handoverAt) steps.push(`Preuzeto iz radionice: ${dt(dm.handoverAt)} (${dm.handoverTo ?? '-'})`)
    for (const s of steps) para(s, { x: M + 10, size: 6.8 })
    if (dm.resolution) para(`Sta je uradjeno: ${dm.resolution}`, { x: M + 10, size: 6.8, color: GREEN })
    const wo = [dm.parts ? `Dijelovi: ${dm.parts}` : '', dm.workers ? `Radio/la: ${dm.workers}` : '', dm.workHours != null ? `Sati: ${dm.workHours}` : '', dm.workCost != null ? `Trosak: ${dm.workCost} EUR` : ''].filter(Boolean).join('  |  ')
    if (wo) para(`Radni nalog - ${wo}`, { x: M + 10, size: 6.8 })
    const statuses = dm.log.filter((l) => l.kind === 'STATUS')
    if (statuses.length) {
      para('Statusi popravke:', { x: M + 10, size: 6.5, f: bold, color: MUTED })
      for (const l of statuses.slice(-6)) para(`${dt(l.at)}  ${l.text ?? ''} (${l.by})`, { x: M + 16, size: 6.5, color: MUTED })
    }
    y -= 5
  }

  // ---------- Redovni servisi ----------
  section(`REDOVNI SERVISI (${rec.serviceRecords.length})`)
  table(
    [{ label: 'DATUM', x: M + 4, w: 46 }, { label: 'VRSTA', x: M + 54, w: 38 }, { label: 'IZVEO', x: M + 96, w: 52 }, { label: 'SERVISER / RACUN', x: M + 152, w: 150 }, { label: 'KM', x: M + 306, w: 44 }, { label: 'SATI', x: M + 354, w: 36 }, { label: 'TROSAK', x: M + 394, w: 42 }, { label: 'NAPOMENA', x: M + 440, w: W - 2 * M - 444 }],
    rec.serviceRecords.map((s) => [d(s.performedAt), s.kind === 'MAJOR' ? 'Major' : s.kind === 'MINOR' ? 'Minor' : '-', s.by, [s.provider, s.invoiceNo].filter(Boolean).join(' / ') || '-', num(s.km), num(s.hours), s.cost != null ? `${s.cost} EUR` : '-', s.notes ?? '']),
    'Nema upisanih redovnih servisa.',
  )
  section(`RADNI NALOZI PREVENTIVNOG ODRZAVANJA (${rec.pmOrders.length})`)
  table(
    [{ label: 'BROJ NALOGA', x: M + 4, w: 90 }, { label: 'VRSTA', x: M + 98, w: 40 }, { label: 'IZDAT', x: M + 142, w: 70 }, { label: 'ZAVRSEN', x: M + 216, w: 70 }, { label: 'STATUS', x: M + 290, w: 50 }, { label: 'ISPRAVNO', x: M + 344, w: 50 }, { label: 'MEHANICAR', x: M + 398, w: W - 2 * M - 402 }],
    rec.pmOrders.map((o) => [o.no, o.kind === 'MAJOR' ? 'Major' : 'Minor', d(o.issuedAt), d(o.completedAt), o.status === 'DONE' ? 'Zavrsen' : 'Otvoren', o.serviceable == null ? '-' : o.serviceable ? 'DA' : 'NE', o.leadMechanic ?? '-']),
    'Nema radnih naloga.',
  )
  section(`ODRZAVANJE (EVIDENCIJA) (${rec.maintenance.length})`)
  table(
    [{ label: 'DATUM', x: M + 4, w: 46 }, { label: 'TIP', x: M + 54, w: 54 }, { label: 'OPIS', x: M + 112, w: 270 }, { label: 'IZVEO/LA', x: M + 386, w: 84 }, { label: 'TROSAK', x: M + 474, w: W - 2 * M - 478 }],
    rec.maintenance.slice(0, 20).map((m) => [d(m.performedAt), MNT_TYPE[m.type] ?? m.type, m.description, m.performedBy ?? '-', m.cost != null ? `${m.cost} EUR` : '-']),
    'Nema zapisa o odrzavanju.',
  )
  section(`CERTIFICATE OF RELEASE TO SERVICE (${rec.crs.length})`)
  table(
    [{ label: 'CRS BROJ', x: M + 4, w: 70 }, { label: 'DATUM', x: M + 78, w: 50 }, { label: 'OVLASTENA OSOBA', x: M + 132, w: 110 }, { label: 'RADOVI', x: M + 246, w: 230 }, { label: 'STATUS', x: M + 480, w: W - 2 * M - 484 }],
    rec.crs.map((r) => [r.crsNumber, d(r.releaseDate), r.certifier, r.work, r.status]),
    'Nema izdatih CRS.',
  )

  // ---------- Dnevni pregledi ----------
  section('DNEVNI PREGLEDI (zadnjih 12 mjeseci)')
  para(`Ukupno pregleda: ${rec.inspections.total}  |  ispravno: ${rec.inspections.fit}  |  sa ogranicenjem: ${rec.inspections.conditional}  |  neispravno: ${rec.inspections.unfit}`, { f: bold })
  y -= 2
  table(
    [{ label: 'DATUM / VRIJEME', x: M + 4, w: 80 }, { label: 'PREGLEDAO/LA', x: M + 90, w: 100 }, { label: 'REZULTAT', x: M + 196, w: 70 }, { label: 'NEISPRAVNE STAVKE', x: M + 272, w: W - 2 * M - 276 }],
    rec.inspections.recent.map((i) => [dt(i.at), i.inspector, INSP[i.result] ?? i.result, i.failed.join('; ') || '-']),
    'Nema pregleda sa nalazom u zadnjih 12 mjeseci.',
  )

  // ---------- Brojila + dijelovi ----------
  section('OCITANJA BROJILA (pri razduzenju)')
  table(
    [{ label: 'DATUM / VRIJEME', x: M + 4, w: 90 }, { label: 'KM', x: M + 100, w: 70 }, { label: 'RADNI SATI', x: M + 176, w: 70 }, { label: 'UPISAO/LA', x: M + 252, w: W - 2 * M - 256 }],
    rec.meters.map((m) => [dt(m.at), num(m.km), num(m.hours), m.by]),
    'Nema upisanih ocitanja.',
  )
  section('UTROSENI REZERVNI DIJELOVI')
  table(
    [{ label: 'DATUM', x: M + 4, w: 46 }, { label: 'DIO', x: M + 54, w: 280 }, { label: 'KOL.', x: M + 338, w: 40 }, { label: 'TROSAK', x: M + 382, w: 60 }, { label: 'UZEO/LA', x: M + 446, w: W - 2 * M - 450 }],
    rec.partsUsed.map((p) => [d(p.at), p.name, String(p.qty), p.cost != null ? `${Math.round(p.cost * 100) / 100} EUR` : '-', p.by ?? '-']),
    'Nema evidentiranog utroska dijelova.',
  )

  // ---------- Potpisi (zadnja strana) ----------
  ensure(56)
  y -= 10
  const half = (W - 2 * M - 30) / 2
  ;([['Sastavio / Prepared by (ime i potpis)', M], ['Sef sluzbe / Approved by (potpis i pecat)', M + half + 30]] as Array<[string, number]>).forEach(([label, x]) => {
    page.drawLine({ start: { x, y: y - 30 }, end: { x: x + half, y: y - 30 }, thickness: 0.6, color: INK })
    c.T(label, x, y - 39, 6.5, font, MUTED)
  })

  // ---------- Podnožje na svim stranama ----------
  const total = pages.length
  pages.forEach((p, i) => {
    const cc = makeCtx(p, font, bold)
    p.drawLine({ start: { x: M, y: 34 }, end: { x: W - M, y: 34 }, thickness: 0.4, color: LINE })
    cc.T(`Generisano iz GSE Control: ${generatedBy}, ${dt(rec.generatedAt)}`, M, 24, 6.5, font, MUTED)
    cc.TR(`Karton sredstva ${eq.code}  |  Stranica ${i + 1}/${total}`, W - M, 24, 6.5, font, MUTED)
  })

  return await pdf.save()
}
