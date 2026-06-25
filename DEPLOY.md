# 🚀 KAKO POKRENUTI GSE CONTROL — Vodič za ne-programere

Ovaj vodič objašnjava kako postaviti aplikaciju na internet **bez programerskog znanja**. Cijeli proces traje oko **20 minuta** i košta **0€ mjesečno** (besplatni Supabase + besplatni Vercel).

---

## 📋 Šta vam treba prije početka

- Email adresa (bilo koja)
- 20 minuta vremena
- **NIŠTA drugo** — ne treba vam instaliran program, ne treba vam programersko znanje

---

## KORAK 1: Kreirajte Supabase nalog (baza podataka) — 5 min

Supabase je mjesto gdje se čuvaju svi podaci (popis opreme, radnici, prijave).

1. Otvorite https://supabase.com u browseru
2. Kliknite **"Start your project"** → **"Sign up with GitHub"** (ili email)
3. Kliknite **"New project"**
4. Popunite:
   - **Name:** `GSE Control` (ili bilo koje ime)
   - **Database Password:** kliknite **"Generate a password"** → kopirajte i sačuvajte negdje (npr. u Notes)
   - **Region:** `Frankfurt` (najbliža Crnoj Gori)
   - **Pricing Plan:** `Free` ($0)
5. Kliknite **"Create new project"** i sačekajte ~2 minuta (supabase kreira bazu)
6. **Ne zatvarajte još prozor** — trebaće nam u sljedećim koracima

✅ **Gotovo!** Imate svoju bazu podataka na internetu.

---

## KORAK 2: Ubacite tabele i podatke u bazu — 3 min

Sada moramo reći bazi kakvu strukturu želimo (tabele za opremu, radnike, prijave) i ubaciti početne podatke.

1. U Supabase dashboardu (još uvijek otvoren), kliknite **"SQL Editor"** u levom meniju
2. Kliknite **"+ New query"**
3. Otvorite fajl `supabase/migrations/001_initial_schema.sql` iz ovog projekta (u Notepadu ili VS Code-u)
4. **Kopirajte sav sadržaj** tog fajla (Ctrl+A → Ctrl+C)
5. **Zalijepite ga** u Supabase SQL Editor (Ctrl+V)
6. Kliknite zeleno dugme **"Run"** (ili Ctrl+Enter)
7. Sačekajte par sekundi — trebali biste vidjeti "Success. No rows returned"

✅ **Gotovo!** Baza sada ima sve tabele + 19 primjera opreme + 5 radnika.

---

## KORAK 3: Kreirajte 3 korisnika (operator, inženjer, admin) — 5 min

Sada kreiramo korisničke naloge za osoblje.

1. U Supabase dashboardu kliknite **"Authentication"** u levom meniju → **"Users"**
2. Kliknite **"Add user"** → **"Create new user"**
3. Popunite za **OPERATOR**:
   - **Email:** `operator@gse.control` (ili pravi email radnika)
   - **Password:** `DemoPass123!` (ili neku drugu jaku lozinku — zapišite je!)
   - **Auto Confirm User:** ✅ uključite
   - Kliknite **"Create user"**
4. Ponovo kliknite **"Add user"** → **"Create new user"** za **INŽENJER**:
   - **Email:** `engineer@gse.control`
   - **Password:** `DemoPass123!`
   - **Auto Confirm User:** ✅
   - **VAŽNO:** Prije nego kliknete "Create user", kliknite na "Additional user metadata" (ili "User Metadata") i zalijepite:
     ```json
     {
       "full_name": "Milica Medenica",
       "card_id": "EMP-1004",
       "role": "engineer",
       "department": "Maintenance"
     }
     ```
   - Kliknite **"Create user"**
5. Ponovo za **ADMINISTRATOR**:
   - **Email:** `admin@gse.control`
   - **Password:** `DemoPass123!`
   - **Auto Confirm User:** ✅
   - **User Metadata:**
     ```json
     {
       "full_name": "Blažo Adžić",
       "card_id": "EMP-1005",
       "role": "admin",
       "department": "Operations"
     }
     ```
   - Kliknite **"Create user"**
6. Za operatora (kojeg smo pravili bez metadata) - kliknite na njega u listi, dodajte metadata:
   ```json
   {
     "full_name": "Vukan Vojvodić",
     "card_id": "EMP-1001",
     "role": "operator",
     "department": "Ramp"
   }
   ```
   i kliknite **"Save"**

✅ **Gotovo!** Imate 3 korisnika sa različitim pravima pristupa.

---

## KORAK 4: Pokrenite aplikaciju na Vercelu — 5 min

Vercel je mjesto gdje aplikacija "živi" na internetu. Besplatno je i brzo.

1. Otvorite https://vercel.com u browseru
2. Kliknite **"Sign Up"** → **"Continue with GitHub"** (ili email)
3. Autorizujte Vercel da pristupi GitHub-u
4. Kliknite **"Add New..."** → **"Project"**
5. Ako imate kod na GitHub-u:
   - Kliknite **"Import"** pored vašeg repository-ja
   - Preskočite na korak 6 ispod
6. Ako imate samo ZIP fajl sa kodom:
   - Prvo kreirajte GitHub repository:
     - Otvorite https://github.com → prijavite se → kliknite **"+"** → **"New repository"**
     - Ime: `gse-control` → **Private** → **"Create repository"**
     - Otpakujte ZIP fajl na kompjuteru
     - Prevucite sve fajlove na https://github.com (drag-and-drop na stranicu)
     - Kliknite **"Commit changes"**
   - Vratite se na Vercel → osvježite stranicu → kliknite **"Import"** pored `gse-control` repository-ja
7. Na stranici "Configure Project", ostavite sve defaultne vrijednosti (ne mijenjajte ništa)
8. **VAŽNO:** Prije "Deploy", kliknite **"Environment Variables"** i dodajte 2 varijable:
   - **Prva varijabla:**
     - Key: `NEXT_PUBLIC_SUPABASE_URL`
     - Value: (kopirajte iz Supabase-a: **Project Settings** → **API** → **Project URL**, izgleda kao `https://xxxxx.supabase.co`)
   - **Druga varijabla:**
     - Key: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - Value: (kopirajte iz Supabase-a: **Project Settings** → **API** → **Project API keys** → **anon public** - dugački string koji počinje sa `eyJ...`)
9. Kliknite **"Deploy"**
10. Sačekajte 2-3 minute — videćete animaciju dok Vercel gradi aplikaciju
11. Kada završi, kliknite **"Visit"** da otvorite svoju aplikaciju na internetu! 🎉

✅ **Gotovo!** Aplikacija je živa na internetu. URL izgleda kao `gse-control-xxxx.vercel.app`.

---

## KORAK 5: Testirajte — 2 min

1. Otvorite svoj Vercel URL (npr. `https://gse-control-xxxx.vercel.app`)
2. Vidjećete login stranicu
3. Ulogujte se kao admin:
   - Email: `admin@gse.control`
   - Lozinka: `DemoPass123!`
4. Vidjećete Dashboard sa svih 19 komada opreme
5. Kliknite tab **"QR kodovi"** → kliknite **"Štampaj sve"** → isprintajte QR kodove
6. Nalijepite QR kodove na vozila/opremu na aerodromu
7. Radnici sada mogu skenirati QR sa telefonom i otvoriće se aplikacija!

### Public FIDS Display

Ako želite prikazati status svih sredstava na TV ekranu:
- Otvorite `https://vaš-url.vercel.app/fids` (samo dodajte `/fids` na kraj)
- Ova stranica ne zahtijeva login - može se prikazivati na javnom ekranu
- Automatski se osvježava svakih 30 sekundi

---

## 🎯 To je to!

Aplikacija je sada živa na internetu. Trošak: **0€/mjesec** (besplatni Supabase Free plan + besplatni Vercel Hobby plan).

### Limiti besplatnih planova:
- **Supabase Free:** 500MB baze, 50,000 monthly active users — dovoljno za srednji aerodrom
- **Vercel Hobby:** 100GB bandwidth/mjesec, automatski HTTPS — dovoljno za internal app

### Ako vam zatreba više:
- Supabase Pro: $25/mjesec — 8GB baze, više korisnika
- Vercel Pro: $20/mjesec — za veći promet

---

## 🆘 Ako nešto ne radi

### Problem: "Demo Mode" se prikazuje umjesto pravog Supabase-a
**Uzrok:** Niste dodali Environment Variables u Vercel.
**Rješenje:** Vercel dashboard → vaš projekat → **Settings** → **Environment Variables** → dodajte `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY` → **Redeploy**.

### Problem: Ne mogu se ulogovati
**Uzrok:** Zaboravili ste uključiti "Auto Confirm User" pri kreiranju korisnika.
**Rješenje:** Supabase → Authentication → Users → kliknite na korisnika → **"Confirm user"**.

### Problem: Vercel build ne uspjeva
**Uzrok:** Možda fali neki fajl u GitHub repository-ju.
**Rješenje:** Provjerite da ste otpakovali cijeli ZIP i da su svi fajlovi uploadovani (uključujući `package.json`, `next.config.ts`, itd.).

### Problem: Aplikacija radi ali podaci nestaju
**Uzrok:** Vjerovatno aplikacija radi u Demo Mode (koristi lokalnu SQLite umjesto Supabase-a).
**Rješenje:** Provjerite da su Environment Variables ispravno postavljene (KORAK 4, tačka 8).

---

## 📞 Potrebna pomoć?

Ako zapnete, provjerite:
1. Da li ste tačno slijedili redoslijed koraka
2. Da li ste kopirali cijeli SQL fajl (KORAK 2)
3. Da li su Environment Variables ispravne (KORAK 4, tačka 8)

Sve detaljne tehničke informacije su u `README.md` (za programere).
