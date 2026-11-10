// Sadržaj landing stranice (HR/EN): sve što aplikacija trenutno sadrži, grupisano po cjelinama.
// Ažurirati ovdje kad se doda nova funkcija.

import type { Language } from '@/lib/i18n'

export type FeatureGroupId = 'worker' | 'workshop' | 'maintenance' | 'safety' | 'authorisation' | 'reports' | 'data'

interface L { hr: string; en: string }
export interface FeatureGroup { id: FeatureGroupId; accent: string; title: L; lead: L; items: L[] }

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: 'worker', accent: '#F2A516',
    title: { hr: 'Zaduživanje za osoblje', en: 'Check-out for staff' },
    lead: { hr: 'Skeniraj, odgovori, gotovo. Bez prijave i bez papira, na telefonu ili tabletu.', en: 'Scan, answer, done. No login, no paper, on a phone or tablet.' },
    items: [
      { hr: 'QR zaduživanje jednim skenom, dugmad ZADUŽI i VRATI', en: 'One-scan QR check-out with CHECK OUT and RETURN buttons' },
      { hr: 'Kartica se upisuje jednom i pamti, može se skenirati kamerom', en: 'Card number entered once and remembered, can be scanned by camera' },
      { hr: 'Dnevna pre-use checklista po tipu sredstva, kao papirni obrazac', en: 'Daily pre-use checklist per equipment type, mirroring the paper form' },
      { hr: 'Potvrda sposobnosti za rad pri zaduživanju (ADR.OR.C.045)', en: 'Fitness-for-duty confirmation at check-out (ADR.OR.C.045)' },
      { hr: 'Neispravno sredstvo i sredstvo bez dnevnog pregleda se ne može zadužiti', en: 'Faulty equipment or equipment without a daily inspection cannot be checked out' },
      { hr: 'Upis km i radnih sati pri vraćanju za servisni plan', en: 'Km and operating hours entered on return for the service plan' },
      { hr: 'Hrvatski i engleski, radi i uz slabu vezu', en: 'Croatian and English, works with a weak connection' },
    ],
  },
  {
    id: 'workshop', accent: '#E3473F',
    title: { hr: 'Kvarovi i radionica', en: 'Faults and workshop' },
    lead: { hr: 'Od prijave kvara do puštanja u rad, sa tragom ko je šta uradio.', en: 'From fault report to return to service, with a trail of who did what.' },
    items: [
      { hr: 'Prijava kvara slikom, kategorijom i jednom rečenicom', en: 'Fault report by photo, category and one sentence' },
      { hr: 'Težina kvara: manji kvar se bilježi, veći zaustavlja sredstvo', en: 'Fault severity: minor faults are logged, major faults stop the equipment' },
      { hr: 'Radionica preuzima popravku prema kvalifikaciji radnika', en: 'Workshop takes repairs according to worker qualifications' },
      { hr: 'Inspekcija šefa, primopredaja i CRS potvrda o puštanju u rad', en: 'Supervisor inspection, handover and CRS certificate of release to service' },
      { hr: 'Magacin rezervnih dijelova i istorija popravki po sredstvu', en: 'Spare-parts store and repair history per equipment' },
      { hr: 'Nalijepnica "Neispravno" za štampu', en: 'Printable "Out of service" sticker' },
    ],
  },
  {
    id: 'maintenance', accent: '#4C8DF2',
    title: { hr: 'Preventivno održavanje', en: 'Preventive maintenance' },
    lead: { hr: 'Servisni plan po sredstvu i godišnji plan za nacionalnu agenciju.', en: 'A service plan per equipment and an annual plan for the national authority.' },
    items: [
      { hr: 'Servisni plan: minor i major servisi po km, satima i roku', en: 'Service plan: minor and major services by km, hours and deadline' },
      { hr: 'Godišnji plan održavanja za CAA, kalendarska godina, grupisan po mjesecima', en: 'Annual maintenance plan for the CAA, calendar year, grouped by month' },
      { hr: 'Karton sredstva sa kompletnom istorijom (PDF)', en: 'Equipment record with the full history (PDF)' },
      { hr: 'Uputstva proizvođača dostupna pri zaduživanju', en: 'Manufacturer manuals available at check-out' },
      { hr: 'Upozorenja o rokovima servisa', en: 'Service due-date warnings' },
    ],
  },
  {
    id: 'safety', accent: '#3FB27F',
    title: { hr: 'Bezbjednost aerodroma', en: 'Aerodrome safety' },
    lead: { hr: 'Prijave koje ne traže skeniranje opreme i traju par sekundi.', en: 'Reports that need no equipment scan and take seconds.' },
    items: [
      { hr: 'Prijava stranih predmeta (FOD)', en: 'Foreign object debris (FOD) reports' },
      { hr: 'Prijava divljih životinja sa mapom aerodroma, zonama i vremenskim uslovima', en: 'Wildlife reports with an airport map, zones and weather conditions' },
      { hr: 'Evidencija odleđivanja (de-icing)', en: 'De-icing records' },
      { hr: 'Statistika FOD-a i divljih životinja', en: 'FOD and wildlife statistics' },
    ],
  },
  {
    id: 'authorisation', accent: '#A78BFA',
    title: { hr: 'Ovlaštenja vozača i vozila', en: 'Driver and vehicle authorisation' },
    lead: { hr: 'Ko smije voziti i koje vozilo smije na koju površinu, sa istorijom promjena.', en: 'Who may drive and which vehicle may go where, with a change history.' },
    items: [
      { hr: 'Ovlaštenja vozača: kategorije, obuka i rokovi isteka (ADR.OPS.B.024)', en: 'Driver authorisations: categories, training and expiry dates (ADR.OPS.B.024)' },
      { hr: 'Ovlaštenje vozila: zone vožnje, radio, pozivni znak, označavanje i svjetla (ADR.OPS.B.026)', en: 'Vehicle authorisation: driving zones, radio, call sign, marking and lighting (ADR.OPS.B.026)' },
      { hr: 'Suspenzija i opoziv sa razlogom, provjera pri zaduživanju', en: 'Suspension and revocation with a reason, checked at check-out' },
      { hr: 'Registar ovlaštenih vozila za štampu', en: 'Printable register of authorised vehicles' },
    ],
  },
  {
    id: 'reports', accent: '#F2A516',
    title: { hr: 'Izvještaji i nadzor', en: 'Reports and oversight' },
    lead: { hr: 'Dokumenti koje agencija traži, spremni za štampu ili PDF.', en: 'The documents the authority asks for, ready to print or save as PDF.' },
    items: [
      { hr: 'Jutarnje checkliste po službama za Operativni centar, identične papirnim obrascima', en: 'Morning checklists per department for the Operations Centre, identical to the paper forms' },
      { hr: 'Primopredaja smjene, dnevni, mjesečni i godišnji izvještaji (PDF)', en: 'Shift handover, daily, monthly and annual reports (PDF)' },
      { hr: 'CAA nadzorni izvještaj sa agregatnim podacima', en: 'CAA oversight report with aggregate data' },
      { hr: 'Pregled usklađenosti sa EASA propisima za održavanje opreme', en: 'EASA compliance overview for equipment maintenance' },
      { hr: 'Dnevnik aktivnosti svih korisnika', en: 'Activity log of all users' },
    ],
  },
  {
    id: 'data', accent: '#8A94A0',
    title: { hr: 'Podaci i pristup', en: 'Data and access' },
    lead: { hr: 'Zapisi se čuvaju kako propis traži, a svako vidi samo ono što mu treba.', en: 'Records are kept as regulations require, and everyone sees only what they need.' },
    items: [
      { hr: 'Čuvanje zapisa najmanje 5 godina, baza ne dozvoljava raniji brisanje', en: 'Records kept for at least 5 years, the database blocks earlier deletion' },
      { hr: 'Uloge: operator, inženjer i administrator', en: 'Roles: operator, engineer and administrator' },
      { hr: 'Ograničen broj pokušaja pri provjeri kartice', en: 'Limited attempts when checking a card number' },
      { hr: 'FIDS prikaz stanja flote za monitor', en: 'FIDS fleet status display for a monitor' },
    ],
  },
]

export const LANDING_TEXT: Record<Language, {
  navFeatures: string; navHow: string; navCompliance: string
  howTitle: string; howSub: string; steps: { t: string; d: string }[]
  featuresTitle: string; featuresSub: string
  compTitle: string; compSub: string; compItems: { ref: string; d: string }[]
  ctaTitle: string; ctaSub: string; ctaPrimary: string; ctaSecondary: string
  toTool: string
}> = {
  hr: {
    navFeatures: 'Funkcije', navHow: 'Kako radi', navCompliance: 'Usklađenost',
    howTitle: 'Tri koraka do zaduženja', howSub: 'Radnik ne mora ništa učiti. Ekran vodi korak po korak.',
    steps: [
      { t: 'Skeniraj', d: 'Usmjeri kameru na QR naljepnicu na sredstvu.' },
      { t: 'Odgovori', d: 'Prođi kratku checklistu ili odmah prijavi kvar slikom.' },
      { t: 'Gotovo', d: 'Sredstvo je zaduženo na tvoje ime. Vraćanje je jedno dugme.' },
    ],
    featuresTitle: 'Šta aplikacija sadrži', featuresSub: 'Cijeli životni ciklus sredstava na aerodromu, od zaduživanja do izvještaja za agenciju.',
    compTitle: 'Usklađeno sa propisima', compSub: 'Aplikacija prati zahtjeve EASA Reg. (EU) 139/2014 za održavanje opreme i vozila. Pregled po tačkama je u aplikaciji, uz štampu.',
    compItems: [
      { ref: 'ADR.OPS.C.005', d: 'Program održavanja' },
      { ref: 'ADR.OPS.C.007', d: 'Održavanje vozila, dnevni pregled, neispravna vozila' },
      { ref: 'ADR.OPS.B.024', d: 'Ovlaštenje vozača' },
      { ref: 'ADR.OPS.B.026', d: 'Ovlaštenje vozila' },
      { ref: 'ADR.OR.D.035', d: 'Čuvanje zapisa, 5 godina' },
      { ref: 'IATA AHM 340', d: 'Pre-use inspekcija opreme' },
    ],
    ctaTitle: 'Spremni za rad', ctaSub: 'Radnici zadužuju bez prijave. Šefovi, radionica i administracija ulaze preko prijave.',
    ctaPrimary: 'Prijava u sistem', ctaSecondary: 'Pogledaj FIDS',
    toTool: 'Zaduži sredstvo',
  },
  en: {
    navFeatures: 'Features', navHow: 'How it works', navCompliance: 'Compliance',
    howTitle: 'Three steps to check out', howSub: 'Staff need no training. The screen guides them step by step.',
    steps: [
      { t: 'Scan', d: 'Point the camera at the QR sticker on the equipment.' },
      { t: 'Answer', d: 'Go through the short checklist or report a fault with a photo.' },
      { t: 'Done', d: 'The equipment is checked out in your name. Returning is one button.' },
    ],
    featuresTitle: 'What the app contains', featuresSub: 'The whole lifecycle of airport equipment, from check-out to reports for the authority.',
    compTitle: 'Aligned with regulations', compSub: 'The app follows the EASA Reg. (EU) 139/2014 requirements for equipment and vehicle maintenance. A point-by-point overview is in the app, with printing.',
    compItems: [
      { ref: 'ADR.OPS.C.005', d: 'Maintenance programme' },
      { ref: 'ADR.OPS.C.007', d: 'Vehicle maintenance, daily check, unserviceable vehicles' },
      { ref: 'ADR.OPS.B.024', d: 'Driver authorisation' },
      { ref: 'ADR.OPS.B.026', d: 'Vehicle authorisation' },
      { ref: 'ADR.OR.D.035', d: 'Record keeping, 5 years' },
      { ref: 'IATA AHM 340', d: 'Pre-use equipment inspection' },
    ],
    ctaTitle: 'Ready for work', ctaSub: 'Staff check out without logging in. Supervisors, the workshop and administration sign in.',
    ctaPrimary: 'Sign in', ctaSecondary: 'View FIDS',
    toTool: 'Check out equipment',
  },
}
