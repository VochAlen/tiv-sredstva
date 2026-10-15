// =====================================================
// HELP SADRŽAJ — kratka, jednostavna objašnjenja po ekranu/koraku
//
// Namjena: osoblje (radnici na terenu, bez IT predznanja) i korisnici
// (inženjeri/admin na dashboard-u) treba da mogu na svakoj stranici
// otvoriti pomoć koja objašnjava BAŠ taj dio koji trenutno koriste.
//
// Ovo je statički sadržaj (bez baze, bez API poziva) - ne dodaje
// nikakvo Vercel serverless opterećenje niti trošak, jer se isporučuje
// kao dio JS bundle-a i renderuje se potpuno na klijentu.
// =====================================================

export interface HelpTopic {
  title: string
  summary: string
  steps: string[]
  tip?: string
}

export const HELP_CONTENT: Record<string, HelpTopic> = {
  // ---------------------------------------------------
  // RADNIK (javna stranica, bez login-a) - worker-view.tsx
  // ---------------------------------------------------
  'worker.scan': {
    title: 'Skeniranje opreme',
    summary: 'Prvi korak: identifikujte sredstvo koje preuzimate ili vraćate.',
    steps: [
      'Pritisnite dugme "Skeniraj QR kod" i uperite kameru u QR naljepnicu na sredstvu.',
      'Ako nema kamere ili QR kod ne radi, ukucajte šifru sredstva rukom (npr. GSE-TOW-001) i pritisnite "Pretraži".',
      'Nakon što se sredstvo pronađe, aplikacija sama prelazi na sljedeći korak.',
      'Ako samo želite prijaviti strani predmet (FOD) ili divlju životinju, nije potrebno skenirati ništa - koristite dugmad ispod skenera.',
    ],
    tip: 'Šifra sredstva je uvijek napisana i na naljepnici, ispod QR koda.',
  },
  'worker.identify': {
    title: 'Podaci o sredstvu i vama',
    summary: 'Provjerite da je sredstvo tačno, unesite svoju identifikacijsku karticu i potvrdite sposobnost za rad.',
    steps: [
      'Provjerite da naziv i šifra sredstva na ekranu odgovaraju sredstvu ispred vas.',
      'Unesite broj svoje kartice (ili ime, ako nemate karticu).',
      'Obavezno potvrdite kvačicom da ste sposobni za rad (niste pod uticajem alkohola/supstanci) - bez toga se ne može nastaviti.',
      'Pritisnite "Nastavi" - aplikacija sama prepoznaje da li preuzimate (zaduženje) ili vraćate (razduženje) sredstvo.',
    ],
  },
  'worker.inspect': {
    title: 'Pregled sredstva',
    summary: 'Prije zaduživanja vizuelno pregledajte sredstvo.',
    steps: [
      'Ako je sve u redu, pritisnite "Sredstvo sam vizuelno pregledao i utvrdio da je ispravno", pa "Zaduži sredstvo".',
      'Ako uočite kvar ili oštećenje, pritisnite "Uočio sam kvar / oštećenje — prijavi odmah", izaberite težinu i dodajte sliku ili kratak opis.',
      'Kod većeg ili kritičnog kvara sredstvo je "nije za upotrebu" i ne može se zadužiti.',
      'Zaduživati se mogu samo sredstva kojima je danas urađen dnevni pregled. Ako nije, možete samo prijaviti kvar.',
    ],
    tip: 'Za opis kvara dovoljno je par riječi ili slika, npr. "guma ispuhana" ili "ne radi svjetlo".',
  },
  'worker.success': {
    title: 'Gotovo',
    summary: 'Zaduženje ili razduženje je uspješno sačuvano.',
    steps: [
      'Ako želite štampani ili PDF dokaz (potpisnu listu), pritisnite link "Preuzmi PDF".',
      'Pritisnite "Novo skeniranje" da nastavite sa sljedećim sredstvom.',
    ],
  },
  'worker.blocked': {
    title: 'Sredstvo nije za upotrebu',
    summary: 'Sredstvo se trenutno ne može preuzeti jer je prijavljen kvar ili nije ispravno.',
    steps: [
      'Pregledajte razlog blokade na ekranu.',
      'Obratite se inženjeru/održavanju prije upotrebe ovog sredstva.',
      'Pritisnite "Novo skeniranje" da probate sa drugim sredstvom.',
    ],
    tip: 'Blokada je sigurnosna mjera - ne pokušavajte zaobići provjeru ako je sredstvo prijavljeno kao neispravno.',
  },

  // ---------------------------------------------------
  // DASHBOARD (login potreban) - dashboard-view.tsx tabovi
  // ---------------------------------------------------
  overview: {
    title: 'Pregled (Overview)',
    summary: 'Opšta slika stanja: broj sredstava, otvoreni kvarovi i šta dospijeva ovog mjeseca.',
    steps: [
      'Kartica "Dospijeva ovog mjeseca" pokazuje sredstva kojima ističe pregled/održavanje - planirajte unaprijed.',
      'Brojke na vrhu (dostupno, zaduženo, neispravno...) se automatski ažuriraju - pritisnite "Osvježi" za najnovije podatke.',
      'Klik na broj otvorenih kvarova vodi direktno na tab "Kvarovi".',
    ],
  },
  equipment: {
    title: 'Sredstva (Equipment)',
    summary: 'Spisak svih GSE sredstava sa statusom, tipom i radnim satima.',
    steps: [
      'Koristite filtere (status, tip) iznad liste da suzite pretragu.',
      'Pretraga po šifri ili nazivu radi direktno u polju za pretragu.',
      'Klik na sredstvo otvara detalje i istoriju tog sredstva.',
    ],
  },
  damages: {
    title: 'Kvarovi (Damages)',
    summary: 'Svi prijavljeni kvarovi i oštećenja, sortirani po hitnosti.',
    steps: [
      'Oznaka "Hitnost" (LOW/MEDIUM/HIGH/CRITICAL) pomaže da znate šta prvo rješavati.',
      'Promijenite status kvara (u toku/riješeno) direktno iz padajuće liste na kartici kvara.',
      'Svaki kvar ima datum prijave i ko ga je prijavio.',
    ],
  },
  statistics: {
    title: 'Statistika',
    summary: 'Grafici i brojevi o korišćenju opreme kroz vrijeme.',
    steps: [
      'Odaberite period da vidite trend aktivnosti.',
      'Statistika se koristi za planiranje (npr. koje sredstvo se najviše koristi).',
    ],
  },
  maintenance: {
    title: 'Održavanje',
    summary: 'Pregled otvorenih kvarova i rokova za preventivno održavanje.',
    steps: [
      'Tab "Kvarovi" prikazuje otvorene kvarove, sortirane po hitnosti.',
      'Kartica "Dospijeva ovog mjeseca" prikazuje sredstva kojima je potreban pregled/servis u ovom mjesecu.',
      'Nakon što je servis obavljen, ažurirajte podatke kod odgovarajućeg sredstva.',
    ],
  },
  adr: {
    title: 'ADR.OPS.C.007 — Dnevna inspekcija vozila',
    summary: 'EASA ADR provjera tehničke ispravnosti vozila/sredstava i raspored održavanja.',
    steps: [
      'Ovdje se vidi da li je sredstvo tehnički ispravno za korišćenje na aerodromu (ADR fitness).',
      'Raspored održavanja (maintenance schedule) prikazuje kada je sljedeći obavezni pregled.',
      'Kompletiranje zadatka održavanja se radi klikom na "Završi zadatak" kod odgovarajuće stavke.',
    ],
  },
  crs: {
    title: 'CRS — Certifikat o puštanju u rad',
    summary: 'Sertifikati koji potvrđuju da je sredstvo ispravno nakon servisa/popravke.',
    steps: [
      'Novi CRS se izdaje nakon što je popravka/servis završen i provjeren.',
      'CRS ima datum važenja - nakon isteka sredstvo ponovo treba provjeru.',
      'Povlačenje (revoke) CRS-a koristite samo ako se utvrdi greška ili novi kvar.',
    ],
  },
  scheduling: {
    title: 'Servis & Dijelovi',
    summary: 'Rezervni djelovi, nabavka i potrošnja dijelova, raspored servisa.',
    steps: [
      'Tab "Rezervni djelovi" prikazuje stanje na zalihama - niska zaliha je obilježena.',
      'Novu nabavku dijela unosite kroz "Dodaj nabavku".',
      'Kad dio potrošite na popravci, unesite to kroz "Potroši dio" da se zaliha automatski smanji.',
    ],
  },
  incidents: {
    title: 'Incidenti',
    summary: 'Prijave incidenata sa opremom (povrede, oštećenja, bezbjednosni događaji).',
    steps: [
      'Radnici mogu prijaviti incident i bez login-a - ovdje inženjer/admin pregleda i obrađuje prijave.',
      'Promijenite status incidenta kad je istraga/rješavanje u toku ili završeno.',
      'Detalji o povredama i procjeni štete su vidljivi samo prijavljenom osoblju (engineer/admin).',
    ],
  },
  driverauth: {
    title: 'Driver Auth — Ovlašćenja vozača',
    summary: 'Provjera i upravljanje ovlašćenjima radnika za upravljanje određenim tipom sredstva.',
    steps: [
      'Ovdje dodajete/uklanjate ovlašćenje radnika za određeni tip opreme (npr. TOW_TRACTOR).',
      'Sistem automatski provjerava ovlašćenje prilikom zaduženja sredstva na radničkoj stranici.',
    ],
  },
  fuelparking: {
    title: 'Gorivo & Parking',
    summary: 'Evidencija točenja goriva/punjenja i potvrde pravilnog parkiranja opreme.',
    steps: [
      'Tab "Gorivo" prikazuje sve unose točenja - radnici ih unose sa terena bez login-a.',
      'Tab "Parking" prikazuje potvrde da je sredstvo pravilno parkirano (kočnica, kontakt isključen...).',
      'Statistika na vrhu pokazuje ukupnu potrošnju i trošak goriva.',
    ],
  },
  deicing: {
    title: 'De-icing',
    summary: 'Evidencija tretiranja sredstvima protiv zaleđivanja (tečnosti, utrošak, zbrinjavanje).',
    steps: [
      'Svaki tretman se evidentira sa tipom tečnosti, količinom i vremenom.',
      'Zbrinjavanje (disposal) tečnosti se posebno evidentira - obavezno za ekološku usklađenost.',
    ],
  },
  'aero-inspection': {
    title: 'Aerodrom Inspekcija',
    summary: 'Periodične inspekcije aerodromske površine/infrastrukture i prijave nalaza.',
    steps: [
      'Nova inspekcija se kreira dugmetom "Nova inspekcija".',
      'Svaki nalaz (finding) tokom inspekcije dobija status i rok za otklanjanje.',
      'Zatvoreni nalazi ostaju u istoriji radi audit traga (CAA/EASA).',
    ],
  },
  sms: {
    title: 'SMS — Sistem upravljanja bezbjednošću',
    summary: 'Hazardi, bezbjednosni indikatori (SPI), ciljevi (SPT) i korektivne akcije.',
    steps: [
      'Tab "Hazardi" - prijava i praćenje bezbjednosnih rizika.',
      'Tab "SPI/SPT" - brojevi koji pokazuju da li je bezbjednost u granicama cilja.',
      'Tab "Akcije" - korektivne/preventivne akcije sa statusom i rokom.',
    ],
  },
  audit: {
    title: 'Audit & Compliance',
    summary: 'Programi audita, nalazi, CAPA (korektivne akcije) i usklađenost sa propisima.',
    steps: [
      'Novi audit program/audit se kreira dugmetom "Novi".',
      'Nalazi (findings) sa audita se povezuju sa CAPA akcijama koje ih rješavaju.',
      'Tab "Usklađenost" prikazuje opštu sliku poštovanja EASA/CAA zahtjeva.',
    ],
  },
  'doc-control': {
    title: 'Document Control',
    summary: 'Kontrolisana dokumentacija - procedure, verzije, pregledi i distribucija.',
    steps: [
      'Svaki dokument ima verzije - nova verzija se dodaje kad se procedura mijenja.',
      'Pregled (review) dokumenta se evidentira prije nego što dokument stupi na snagu.',
      'Distribucija pokazuje ko je primio/potvrdio dokument.',
    ],
  },
  'fod-wildlife': {
    title: 'FOD & Wildlife',
    summary: 'Prijave stranih predmeta (FOD) i opažanja/sudara sa divljim životinjama.',
    steps: [
      'Tab "FOD" prikazuje sve prijavljene strane predmete, sa najčešćim lokacijama (korisno za uočavanje trendova).',
      'Tab "Wildlife" prikazuje opažanja i sudare sa životinjama.',
      'Radnici prijavljuju direktno sa radničke stranice, bez login-a - vi ovdje samo pregledate i preuzimate PDF izvještaj.',
    ],
  },
  reports: {
    title: 'Izvještaji',
    summary: 'PDF izvještaji za internu upotrebu i CAA/EASA audit.',
    steps: [
      'Pritisnite "Generiši PDF" na kartici izvještaja koji vam je potreban.',
      '"Kandidati za zamjenu" rangira sredstva koja bi trebalo zamijeniti (po kvarovima, satima rada i starosti).',
      '"CAA nadzorni izvještaj" je jednostranični sažetak namijenjen CAA Montenegro - sadrži samo agregatne brojke (bez imena osoblja).',
      'Svi izvještaji se preuzimaju direktno - nema čekanja ili slanja e-mailom.',
    ],
  },
  activity: {
    title: 'Aktivnost',
    summary: 'Hronološki pregled svih zaduženja/razduženja sredstava.',
    steps: [
      'Svaki red prikazuje ko, kada i koje sredstvo je preuzeo ili vratio.',
      'Koristite pretragu da nađete aktivnost određenog radnika ili sredstva.',
    ],
  },
  qr: {
    title: 'QR kodovi',
    summary: 'Štampanje QR naljepnica za sredstva.',
    steps: [
      'Odaberite sredstvo i pritisnite "Štampaj QR".',
      'Zalijepite naljepnicu na vidljivo mjesto na sredstvu - radnici je skeniraju na radničkoj stranici.',
    ],
  },
}

export function getHelpTopic(key: string): HelpTopic | undefined {
  return HELP_CONTENT[key]
}
