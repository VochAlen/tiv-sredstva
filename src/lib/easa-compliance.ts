// Pregled usklađenosti sa EASA Reg. (EU) 139/2014 (EAR, mart 2026) - održavanje opreme, vozila i sredstava.
// Procjena stanja u aplikaciji (ne pravni zaključak). Ažurirati ovdje kad se nešto promijeni; PDF i stranica čitaju isti spisak.
// DONE = pokriveno u aplikaciji, PARTIAL = djelimično, MISSING = nije pokriveno, ORG = organizaciono (procedura/resursi), van aplikacije.

export type CStatus = 'DONE' | 'PARTIAL' | 'MISSING' | 'ORG'
export interface CItem { ref: string; req: string; status: CStatus; where: string; note?: string; /** stavka koristi AI pomoć (prikazuje se ikonica) */ ai?: boolean }
export interface CGroup { rule: string; title: string; items: CItem[] }

export const ASSESSED_ON = '2026-11-10'
export const BASIS = 'EASA Easy Access Rules for Aerodromes, Reg. (EU) No 139/2014 (mart 2026)'

export const STATUS_META: Record<CStatus, { label: string; short: string }> = {
  DONE: { label: 'Urađeno u aplikaciji', short: 'Urađeno' },
  PARTIAL: { label: 'Djelimično', short: 'Djelimično' },
  MISSING: { label: 'Nije pokriveno', short: 'Nedostaje' },
  ORG: { label: 'Procedura / organizacija (van aplikacije)', short: 'Procedura' },
}

export const COMPLIANCE: CGroup[] = [
  { rule: 'ADR.OPS.C.005', title: 'Održavanje — opšte', items: [
    { ref: 'C.005(a)', req: 'Program održavanja sa preventivnim održavanjem za opremu potrebnu za rad aerodroma', status: 'DONE', where: 'Servisni plan i nalozi (AHM 917), godišnji plan održavanja (PDF)', note: 'Obuhvata GSE i vozila. Objekti, staze i svjetla nisu u aplikaciji.' },
    { ref: 'AMC1 C.005(b)', req: 'Korektivno održavanje: pravovremene radnje za kvarove nađene pri pregledu ili u radu', status: 'DONE', where: 'Radionica: preuzimanje kvara, popravka, inspekcija šefa, primopredaja' },
    { ref: 'C.005(b)', req: 'Odgovarajuća sredstva za provođenje programa (ljudi, alat, prostor)', status: 'ORG', where: 'Van aplikacije', note: 'Alat i prostor su odluka uprave; kvalifikacije radionice se prate u aplikaciji.' },
  ] },
  { rule: 'ADR.OPS.C.007', title: 'Održavanje vozila', items: [
    { ref: 'C.007(a)(1)', req: 'Program održavanja vatrogasnih vozila, uključujući vrijeme odziva', status: 'PARTIAL', where: 'Vatrogasna vozila su u evidenciji i servisnom planu', note: 'Vrijeme odziva se ne prati u aplikaciji.' },
    { ref: 'C.007(a)(2)', req: 'Program održavanja ostalih vozila na manevarskoj i drugim operativnim površinama', status: 'DONE', where: 'Servisni plan po sredstvu (minor / major, km, sati, rok)' },
    { ref: 'C.007(b)(1)', req: 'Procedure koje podržavaju program (učestalost, vrste radova, rezervni dijelovi, zbrinjavanje, prijava kvarova)', status: 'ORG', where: 'Procedura aerodroma', note: 'Aplikacija daje alate, ali sam postupak mora biti napisan u proceduri.' },
    { ref: 'C.007(b)(2)', req: 'Objekti i sredstva za održavanje, zalihe dijelova, dokumentacija, obuka osoblja radionice', status: 'PARTIAL', where: 'Magacin dijelova, kvalifikacije radionice', note: 'Adekvatnost prostora i alata je organizaciono pitanje.' },
    { ref: 'C.007(b)(3)', req: 'Evidencija održavanja za svako vozilo (vrsta, stavke, datum ulaska i izlaska iz radionice, ko je radio)', status: 'DONE', where: 'Karton sredstva (PDF), zapis održavanja, istorija popravke' },
    { ref: 'C.007(c)', req: 'Vozila drugih organizacija na aerodromu se održavaju po programu, uz evidenciju i provjeru (audit)', status: 'MISSING', where: '—', note: 'Aplikacija vodi samo vlastitu flotu. Nema evidencije tuđih vozila.' },
    { ref: 'C.007(d)', req: 'Neispravna vozila se ne koriste', status: 'DONE', where: 'Blokada zaduživanja, status Neispravno, nalijepnica "Neispravno" (PDF)' },
    { ref: 'AMC1 C.007(a)(1)', req: 'Dnevni pregled prije upotrebe: najmanje 11 stavki (upozorenja, upravljač, svjetla, kočnice, radio/transponder, gume, retrovizori, brisači, osiguranje opreme, curenje, nova oštećenja)', status: 'DONE', where: 'Dnevni pregled i checklista pri zaduživanju', note: 'Lista sadrži svih 11 stavki.' },
    { ref: 'AMC1 C.007(a)(1)(b)', req: 'Povratna informacija o kvarovima jedinici koja održava vozilo', status: 'DONE', where: 'Prijava kvara ide direktno radionici, upozorenje za kritične kvarove' },
    { ref: 'GM1 C.007(d)', req: 'Sprječavanje nenamjerne upotrebe neispravnog vozila, obavještenje sljedeće smjene', status: 'DONE', where: 'Nalijepnica "Neispravno" (PDF), primopredaja smjene (PDF)' },
    { ref: 'GM1 C.007 (od 27.3.2028)', req: 'Pravilo važi i za vozila za prevoz putnika i posade i opsluživanje osoba smanjene pokretljivosti ako ih aerodrom opslužuje sam', status: 'PARTIAL', where: 'Autobus i ambulift su u evidenciji', note: 'Provjeriti primjenjivost za Tivat prije 2028.' },
  ] },
  { rule: 'ADR.OPS.B.024', title: 'Ovlaštenje vozača', items: [
    { ref: 'B.024(a)', req: 'Za vožnju na manevarskoj i drugim operativnim površinama potrebno je ovlaštenje aerodroma sa zonama vožnje', status: 'PARTIAL', where: 'Ovlaštenja vozača: kategorije (airside, manevarska, pista), provjera pri zaduživanju', note: 'Zona vozača se ne poredi sa zonom vozila.' },
    { ref: 'B.024(a)(2)', req: 'Važeća vozačka dozvola i druge potrebne dozvole za specijalna vozila', status: 'PARTIAL', where: 'Broj i važenje airside dozvole', note: 'Ne evidentira se nacionalna vozačka dozvola i kategorija.' },
    { ref: 'B.024(a)(4) / B.029', req: 'Poznavanje jezika za vožnju na manevarskoj površini', status: 'MISSING', where: '—' },
    { ref: 'B.024(b)', req: 'Program obuke vozača (propisi, vozilo, komunikacije, radiotelefonija, ljudski faktor, upoznavanje sa terenom) i ocjena osposobljenosti', status: 'PARTIAL', where: 'Datum obuke i istek se prate', note: 'Sadržaj programa obuke je u proceduri.' },
    { ref: 'B.024(c)(2)', req: 'Ponovna obuka i provjera osposobljenosti najkasnije svakih 24 mjeseca', status: 'DONE', where: 'Provjera znanja (kratak test) sa rokom (mjeseci) koji upisuje administrator, upozorenje preko 24 mjeseca; istek obuke i upozorenja', note: 'Periodična provjera znanja je u aplikaciji. Pitanja se mogu pisati uz AI pomoć (prijedlog, a odobrava administrator). Praktičnu provjeru na vozilu vodi procedura aerodroma.', ai: true },
    { ref: 'B.024(d)', req: 'Privremeno ovlaštenje za vožnju uz pratnju ovlaštenog vozila', status: 'MISSING', where: '—' },
    { ref: 'B.024(e)', req: 'Postupak izdavanja, praćenja, suspenzije i opoziva, uz evidenciju', status: 'PARTIAL', where: 'Aktivno / suspendovano stanje ovlaštenja', note: 'Istorija promjena nije potpuna kao kod ovlaštenja vozila.' },
  ] },
  { rule: 'ADR.OPS.B.026', title: 'Ovlaštenje vozila', items: [
    { ref: 'B.026(a),(c)', req: 'Ovlaštenje za svako vozilo: ispravno, označeno i osvijetljeno, sa radijom i transponderom gdje treba, sa zonama vožnje', status: 'DONE', where: 'Dugme "Ovlaštenje vozila" na sredstvu', note: 'Novo. Bez zapisa vozilo se još može zadužiti dok se ne popuni cijela flota.' },
    { ref: 'B.026(d)', req: 'Pozivni znak vozila sa radijom', status: 'DONE', where: 'Ovlaštenje vozila: pozivni znak' },
    { ref: 'B.026(f)', req: 'Postupak izdavanja i opoziva, praćenje usklađenosti, evidencija', status: 'DONE', where: 'Suspenzija / opoziv sa razlogom, istorija promjena, registar (PDF)', note: 'Postupak (ko izdaje i opoziva) mora biti i u proceduri. To je nalaz CAA.' },
    { ref: 'B.026(e)', req: 'Privremeni ulazak vozila i vozila bez radija uz pratnju', status: 'MISSING', where: '—' },
    { ref: 'B.026(b)', req: 'Broj ovlaštenih vozila je ograničen na najmanji potreban', status: 'ORG', where: 'Odluka uprave', note: 'Registar ovlaštenja pomaže pregledu.' },
  ] },
  { rule: 'ADR.OPS.B.080', title: 'Označavanje i svjetla vozila', items: [
    { ref: 'B.080(a)', req: 'Vozila na manevarskoj površini imaju uočljive boje ili zastavice, a noću i pri slaboj vidljivosti svjetla', status: 'PARTIAL', where: 'Označavanje i svjetla u ovlaštenju vozila, svjetla u dnevnom pregledu' },
    { ref: 'B.080(b)', req: 'Izuzeće opreme i vozila koja rade samo na stajanci', status: 'ORG', where: 'Procedura aerodroma', note: 'Izuzeće mora biti zapisano u proceduri.' },
  ] },
  { rule: 'ADR.OR.D.017', title: 'Obuka osoblja', items: [
    { ref: 'D.017(a),(b)', req: 'Program obuke za osoblje koje radi na održavanju i vožnji (početna, ponovna, osvježavajuća)', status: 'PARTIAL', where: 'Kvalifikacije radionice, istek rokova', note: 'Početna obuka i sadržaj programa su u proceduri.' },
    { ref: 'D.017(f)', req: 'Ponovna obuka najkasnije svakih 24 mjeseca', status: 'DONE', where: 'Periodična provjera znanja, rok u mjesecima po izboru administratora, banka pitanja i evidencija pokušaja; upozorenja o isteku rokova', note: 'Pitanja se mogu pisati uz AI pomoć (prijedlog, a odobrava administrator); sadržaj pitanja odobrava odgovorni za obuku.', ai: true },
  ] },
  { rule: 'ADR.OR.D.035', title: 'Čuvanje zapisa', items: [
    { ref: 'D.035(d)', req: 'Opšti rok čuvanja zapisa najmanje 5 godina', status: 'DONE', where: 'Baza ne dozvoljava brisanje zapisa mlađih od 5 godina (migracija 039)' },
    { ref: 'D.035(d)(8)', req: 'Ovlaštenja vozila i evidencija održavanja vozila: najmanje 4 godine poslije povlačenja vozila', status: 'PARTIAL', where: 'Ovlaštenja vozila se ne brišu (migracija 040)', note: 'Pravilo po vozilu za evidenciju održavanja još nije uvedeno. Trigger dozvoljava brisanje poslije 5 godina.' },
    { ref: 'D.035(d)(5),(7)', req: 'Ovlaštenja vozača i evidencija obuke: najmanje 4 godine poslije odlaska radnika ili opoziva', status: 'MISSING', where: '—', note: 'Brisanje ovih zapisa nije zaštićeno.' },
    { ref: 'D.035(c)', req: 'Zaštita zapisa od oštećenja, izmjene i krađe', status: 'PARTIAL', where: 'Baza sa ograničenim pristupom po ulogama', note: 'Redovna rezervna kopija i test vraćanja nisu potvrđeni.' },
    { ref: 'D.035(e)', req: 'Zapisi podliježu zakonu o zaštiti podataka', status: 'ORG', where: 'Procedura aerodroma' },
  ] },
]

export function countStatuses(): Record<CStatus, number> & { total: number } {
  const c = { DONE: 0, PARTIAL: 0, MISSING: 0, ORG: 0, total: 0 }
  for (const g of COMPLIANCE) for (const i of g.items) { c[i.status]++; c.total++ }
  return c
}
