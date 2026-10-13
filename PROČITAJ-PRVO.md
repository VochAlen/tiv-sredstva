# GSE Control - dnevni pregled ispravnosti po službama + PDF izvještaji

## Šta je urađeno u ovoj sesiji

### 1. Digitalizacija dnevnog pregleda (postojeći backend, sad povezan)
Otkrio sam da je `DailyInspection` model + `createDailyInspection()` akcija
**već postojala u kodu, potpuno funkcionalna** (računa FIT/UNFIT/CONDITIONAL,
ažurira status opreme) - ali se nigdje nije pozivala iz UI-ja. Usput sam
otkrio i popravio istu sigurnosnu rupu kao ranije za checkout (anon insert
bez validacije + tihi bag gdje bi Supabase update statusa opreme pao pod
pooštrenom RLS politikom). Sad ide kroz `fn_create_daily_inspection`
(SECURITY DEFINER) - **testirano direktno protiv prave Postgres instance,
FIT i UNFIT scenario, oba rade ispravno.**

### 2. `department` polje na opremi
Svih 78 sredstava automatski razvrstano u **Tehnička služba** (33) /
**Služba zemaljskog opsluživanja - P/O** (45), na osnovu stvarne podjele
iz tvoja dva priložena obrasca (npr. IMT traktori → TS, AGT/Aviogei → P-O).

### 3. Dashboard "Dnevni pregled" (na početnoj strani)
Nova kartica na vrhu Pregled taba - pokazuje po službi koliko je sredstava
pregledano danas / ukupno, sa "Kompletno" ili "X preostalo" bedžom,
proširiva lista pojedinačnog statusa (Pregledano/FIT/CONDITIONAL/UNFIT),
i dugme **"Štampaj PDF"** po službi.

### 4. Dva nova PDF izvještaja (pdf-lib, ista biblioteka koja se već koristi)
- **`/api/reports/gse-daily-checklist?department=TEHNICKA_SLUZBA|SLUZBA_PO`**
  - digitalna zamjena za PRO.03.04.OBR1/OBR2, grupisano po kategoriji
    opreme (kao rimski brojevi na papirnom obrascu), sa STVARNIM Y/N
    statusom iz digitalnih inspekcija (ili prazno ako sredstvo još nije
    pregledano - može se i dalje ručno popuniti na odštampanom listu kao
    prelazno rješenje).
  - Ispod dugmeta "Štampaj PDF" u dashboard kartici.
- **`/api/reports/prijava-kvara?id=<damageId>`** - digitalna zamjena za
  "Prijava kvara" obrazac, dvodijelni (opis kvara + predao/primio, pa
  stanje pri prijemu iz tehničke službe sa opisom izvedenih radova).
  Polja koja app ne prati digitalno (tačno stanje goriva/ulja u litrima
  pri primopredaji) ostaju prazne linije za ručni upis - pošteno, ne
  izmišljam podatke koje nemam. Dugme "Prijava kvara PDF" je sad na
  svakoj kartici oštećenja (i u "Oštećenja" i u "Održavanje > Neispravna
  sredstva" tabu, pošto dijele istu komponentu).

## VAŽNO - PDF rute nisam mogao uživo testirati u ovom sandbox-u

Pokušao sam - dobio sam HTTP 500 "PrismaClient did not initialize". ALI
sam odmah provjerio i potvrdio da **i potpuno nedirnuta, već postojeća
ruta** (`/api/reports/daily-inspection`, koju nisam ni pipnuo) ima
**identičnu grešku** u ovom sandbox-u - dakle nije defekt u mom kodu, nego
isto poznato ograničenje (Prisma engine binary se ne može preuzeti zbog
mrežnih restrikcija sandbox-a). TypeScript i ESLint su čisti, kod prati
identičan obrazac kao postojeće, već funkcionalne rute. **Ipak, preporuka:
prvo što testiraj nakon deploya su baš ova dva PDF dugmeta**, pošto ovo
nisam mogao uživo potvrditi.

## Redoslijed primjene

1. Kopiraj sve fajlove.
2. `npx prisma generate && npx prisma db push` (demo mod).
3. Na Supabase: primijeni `020_department_and_daily_inspection_security.sql`
   (nakon 016-019 ako već nisu).
4. Pokreni `seed-real-fleet.sql` ponovo (ažuriran sa department poljem -
   bezbjedno za ponovno pokretanje, ON CONFLICT DO UPDATE).
5. `npm run build` da zatvoriš build validaciju.

## Validacija

- ✅ TypeScript - 0 grešaka
- ✅ ESLint (cijeli `src/`) - 0 grešaka, 0 upozorenja
- ✅ `fn_create_daily_inspection` SQL funkcija testirana protiv prave
  lokalne Postgres instance (FIT i UNFIT scenario)
- ✅ Dashboard "Dnevni pregled" potvrđen uživo (dev server, tekst
  prisutan u renderu, bez grešaka u logu)
- ⚠️ Production build - isto poznato sandbox ograničenje (Google Fonts)
- ⚠️ PDF rute - nisam mogao dobiti live 200 odgovor u ovom sandbox-u
  (objašnjeno iznad - isti problem pogađa i staru, netaknutu rutu),
  **testiraj prve nakon deploya**

## OSTAJE - radnički ekran za sam unos dnevnog pregleda

Sve iznad omogućava PRIKAZ i ŠTAMPU stanja, ali **radnici još uvijek
nemaju jednostavan UI da unesu dnevni pregled** (backend
`createDailyInspection()` postoji i radi, ali ništa ga ne poziva sa
worker strane). Ovo je sljedeći korak - jednostavan ekran gdje radnik
odabere svoju službu, vidi svu opremu grupisanu po kategoriji (kao na
papiru), označi Y/N za svako, i pošalje sve odjednom. Javi mi da
nastavim.
