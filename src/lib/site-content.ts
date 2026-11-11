// Sadržaj stranica /features i /about (HR/EN). Spisak funkcija i propisa dolazi iz landing-content.ts,
// da sve tri javne stranice uvijek govore isto. Ovdje je samo ono što je specifično za ove dvije stranice.

import type { Language } from '@/lib/i18n'

interface L { hr: string; en: string }

export interface RoleCard { id: 'worker' | 'engineer' | 'admin'; title: L; who: L; items: L[] }

export const ROLE_CARDS: RoleCard[] = [
  {
    id: 'worker', title: { hr: 'Radnik / operator', en: 'Worker / operator' },
    who: { hr: 'Bez prijave. Dovoljna je ID kartica.', en: 'No login. The ID card is enough.' },
    items: [
      { hr: 'Zaduživanje i vraćanje sredstva QR skenom', en: 'QR check-out and return of equipment' },
      { hr: 'Dnevni pregled vozila prije zaduživanja', en: 'Daily vehicle inspection before check-out' },
      { hr: 'Prijava kvara, FOD-a i divljih životinja', en: 'Fault, FOD and wildlife reports' },
      { hr: 'Kratak test znanja kad dođe na red', en: 'Short knowledge test when it is due' },
    ],
  },
  {
    id: 'engineer', title: { hr: 'Inženjer / šef / radionica', en: 'Engineer / supervisor / workshop' },
    who: { hr: 'Prijava u sistem.', en: 'Signs in.' },
    items: [
      { hr: 'Radionica: preuzimanje kvara, popravka, inspekcija šefa, CRS', en: 'Workshop: take over a fault, repair, supervisor inspection, CRS' },
      { hr: 'Servisni plan, nalozi, dijelovi i karton sredstva', en: 'Service plan, work orders, parts and the equipment record' },
      { hr: 'Ovlaštenja vozača i vozila, pregled osposobljenosti i zadavanje provjere', en: 'Driver and vehicle authorisations, competence overview and assigning a check' },
      { hr: 'Izvještaji, statistika i pregled usklađenosti', en: 'Reports, statistics and the compliance overview' },
    ],
  },
  {
    id: 'admin', title: { hr: 'Administrator', en: 'Administrator' },
    who: { hr: 'Sve što i inženjer, plus podešavanja.', en: 'Everything an engineer has, plus settings.' },
    items: [
      { hr: 'Korisnici i prava, kvalifikacije radionice, obavještenja', en: 'Users and permissions, workshop qualifications, notifications' },
      { hr: 'Imenovanje mentora za radnike koji nisu prošli test', en: 'Naming mentors for workers who failed the test' },
      { hr: 'Postavke provjere znanja: rok u mjesecima, broj pitanja, prag prolaza', en: 'Knowledge-check settings: interval in months, number of questions, pass mark' },
      { hr: 'Banka pitanja: pisanje, izmjena, uključivanje i isključivanje pitanja', en: 'Question pool: write, edit, enable and disable questions' },
    ],
  },
]

export const SITE_TEXT: Record<Language, {
  featEyebrow: string; featTitle: string; featSub: string
  statGroups: string; statFunctions: string; statStandards: string
  groupsNav: string
  rolesTitle: string; rolesSub: string
  limitsTitle: string; limitsBody: string
  featCtaTitle: string; featCtaSub: string
  aboutEyebrow: string; aboutTitle: string; aboutSub: string
  problemTitle: string; problemBody: string; solutionTitle: string; solutionBody: string
  principlesTitle: string; principlesSub: string; principles: { t: string; d: string }[]
  stackTitle: string; stackSub: string
  standardsTitle: string; standardsSub: string
  devTitle: string; devName: string; devBio: string; devPlace: string
  aboutCtaTitle: string; aboutCtaSub: string; seeFeatures: string; toTool: string
}> = {
  hr: {
    featEyebrow: 'Sve što aplikacija radi', featTitle: 'Funkcije sistema',
    featSub: 'Cijeli životni ciklus opreme i vozila na aerodromu: od zaduživanja i dnevnog pregleda, preko kvarova i servisa, do izvještaja za agenciju.',
    statGroups: 'cjelina', statFunctions: 'funkcija', statStandards: 'propisa i standarda',
    groupsNav: 'Cjeline',
    rolesTitle: 'Ko šta vidi', rolesSub: 'Svako vidi samo ono što mu treba za posao. Radniku ne treba prijava, a podešavanja su samo za administratora.',
    limitsTitle: 'Šta treba znati',
    limitsBody: 'Pregled usklađenosti u aplikaciji je tehnička procjena stanja, a ne zvanična potvrda: provjeru radi odgovorno lice kod operatera aerodroma i agencija. Neke stvari rješava procedura, a ne aplikacija, na primjer praktična provjera vozača na vozilu i jezička osposobljenost.',
    featCtaTitle: 'Pogledajte kako radi', featCtaSub: 'Radnici zadužuju bez prijave. Šefovi, radionica i administracija ulaze preko prijave.',
    aboutEyebrow: 'O aplikaciji', aboutTitle: 'Napravljeno na aerodromu, za aerodrom',
    aboutSub: 'GSE Control zamjenjuje papirne obrasce za zaduživanje, dnevne preglede, kvarove i održavanje opreme na Aerodromu Tivat.',
    problemTitle: 'Problem', problemBody: 'Papirni formulari za zaduživanje opreme se gube, teško je pratiti ko je posljednji koristio neispravno vozilo, a prijave FOD-a, divljih životinja i oštećenja kasne ili se ne popunjavaju.',
    solutionTitle: 'Rješenje', solutionBody: 'Jedan sken QR koda zamjenjuje papir. Svaka prijava, kvar i pregled se odmah bilježi i vidljiv je radionici i menadžmentu, uz izvještaje spremne za nadzor agencije.',
    principlesTitle: 'Na čemu je zasnovana', principlesSub: 'Pravila kojih se držimo kad dodajemo nešto novo.',
    principles: [
      { t: 'Bez prijave za radnike', d: 'Radnik upiše ID karticu jednom, a ime se popuni samo. Ekran ga vodi korak po korak.' },
      { t: 'Aplikacija zaustavlja, ne samo bilježi', d: 'Neispravno ili nepregledano sredstvo se ne može zadužiti. Zaštita je ugrađena, ne prepuštena navici.' },
      { t: 'Zapisi se ne gube', d: 'Zapisi o zaduženjima, kvarovima, popravkama i pregledima čuvaju se najmanje 5 godina. Baza ne dozvoljava raniji brisanje.' },
      { t: 'Svako vidi svoje', d: 'Operator, inženjer i administrator imaju različita prava. Tačni odgovori testa vidljivi su samo administratoru.' },
    ],
    stackTitle: 'Tehnologija', stackSub: 'Savremeni, provjereni alati, birani da održavanje ostane jednostavno.',
    standardsTitle: 'Propisi i standardi', standardsSub: 'Aplikacija prati zahtjeve EASA Reg. (EU) 139/2014 za održavanje opreme i vozila. Pregled po tačkama je u aplikaciji.',
    devTitle: 'O autoru', devName: 'Programer za Aerodrom Tivat',
    devBio: 'Sa 25 godina iskustva u avijaciji i radom na Aerodromu Tivat, razvio sam GSE Control kao odgovor na stvarne potrebe aerodromske platforme. Sistem je pravljen na osnovu praktičnog znanja o radu sa opremom, IATA standardima i EASA propisima, da pojednostavi svakodnevni rad osoblja na platformi.',
    devPlace: 'Aerodrom Tivat (TIV)',
    aboutCtaTitle: 'Spremni za rad', aboutCtaSub: 'Pogledajte šta sve aplikacija radi ili pređite pravo na zaduživanje.', seeFeatures: 'Sve funkcije', toTool: 'Zaduži sredstvo',
  },
  en: {
    featEyebrow: 'Everything the app does', featTitle: 'System features',
    featSub: 'The whole lifecycle of airport equipment and vehicles: from check-out and the daily inspection, through faults and servicing, to reports for the authority.',
    statGroups: 'areas', statFunctions: 'functions', statStandards: 'regulations and standards',
    groupsNav: 'Areas',
    rolesTitle: 'Who sees what', rolesSub: 'Everyone sees only what they need for the job. Staff need no login, and settings are for the administrator only.',
    limitsTitle: 'Good to know',
    limitsBody: 'The compliance overview in the app is a technical assessment of the state of the data, not an official confirmation: the check is done by the responsible person at the aerodrome operator and by the authority. Some things are handled by procedure, not by the app, for example the practical check of a driver on the vehicle and language proficiency.',
    featCtaTitle: 'See how it works', featCtaSub: 'Staff check out without logging in. Supervisors, the workshop and administration sign in.',
    aboutEyebrow: 'About the app', aboutTitle: 'Built at the airport, for the airport',
    aboutSub: 'GSE Control replaces paper forms for check-out, daily inspections, faults and equipment maintenance at Tivat Airport.',
    problemTitle: 'The problem', problemBody: 'Paper check-out forms get lost, it is hard to see who last used a faulty vehicle, and reports of FOD, wildlife and damage are late or not filled in.',
    solutionTitle: 'The solution', solutionBody: 'One QR scan replaces paper. Every report, fault and inspection is logged at once and visible to the workshop and management, with reports ready for the authority.',
    principlesTitle: 'What it is built on', principlesSub: 'The rules we keep to whenever something new is added.',
    principles: [
      { t: 'No login for staff', d: 'A worker enters the ID card once and the name fills in by itself. The screen guides them step by step.' },
      { t: 'The app stops, not just records', d: 'Faulty or uninspected equipment cannot be checked out. The safeguard is built in, not left to habit.' },
      { t: 'Records are not lost', d: 'Records of check-outs, faults, repairs and inspections are kept for at least 5 years. The database blocks earlier deletion.' },
      { t: 'Everyone sees their own', d: 'Operator, engineer and administrator have different rights. The correct test answers are visible to the administrator only.' },
    ],
    stackTitle: 'Technology', stackSub: 'Modern, proven tools, chosen to keep maintenance simple.',
    standardsTitle: 'Regulations and standards', standardsSub: 'The app follows the EASA Reg. (EU) 139/2014 requirements for equipment and vehicle maintenance. A point-by-point overview is in the app.',
    devTitle: 'About the author', devName: 'Developer at Tivat Airport',
    devBio: 'With 25 years in aviation and work at Tivat Airport, I built GSE Control in response to the real needs of the apron. The system rests on practical knowledge of equipment operations, IATA standards and EASA rules, to simplify the everyday work of staff on the apron.',
    devPlace: 'Tivat Airport (TIV)',
    aboutCtaTitle: 'Ready for work', aboutCtaSub: 'See everything the app does, or go straight to check-out.', seeFeatures: 'All features', toTool: 'Check out equipment',
  },
}

export const STACK: { name: string; desc: L }[] = [
  { name: 'Next.js 16', desc: { hr: 'App Router i serverske akcije', en: 'App Router and server actions' } },
  { name: 'TypeScript', desc: { hr: 'Provjera tipova od baze do ekrana', en: 'Type-checked from database to screen' } },
  { name: 'Supabase', desc: { hr: 'PostgreSQL, prijava i pravila pristupa po redovima (RLS)', en: 'PostgreSQL, authentication and row-level security (RLS)' } },
  { name: 'Tailwind CSS + shadcn/ui', desc: { hr: 'Isti izgled na telefonu, tabletu i računaru', en: 'The same look on phone, tablet and desktop' } },
  { name: 'PWA', desc: { hr: 'Instalira se na početni ekran', en: 'Installs to the home screen' } },
  { name: 'Vercel', desc: { hr: 'Hosting i automatski dnevni zadaci', en: 'Hosting and automatic daily jobs' } },
]
