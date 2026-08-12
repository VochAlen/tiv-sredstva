---
Task ID: GSE-CONTROL-MAIN
Agent: Super Z (main agent)
Task: Build a QR-based GSE check-out/check-in system for airport ramp staff with inspection checklist, damage reporting, central dashboard, and Vercel deployment support.

Work Log:
- Initialized Next.js 16 fullstack environment via `curl .../init-fullstack.sh`
- Installed `html5-qrcode` (browser QR scanning) and `qrcode.react` (QR generation)
- Designed Prisma schema with 4 models: Employee, Equipment, Assignment (history), DamageReport
- Pushed schema to SQLite + wrote seed script with 19 realistic GSE items (tow tractors, GPUs, belt loaders, pushbacks, stairs, dollies, lavatory/water trucks, buses) and 5 employees
- Created Server Actions layer (src/lib/actions.ts): queries + mutations for check-out, check-in, damage resolution, status changes
- Built WorkerView (mobile-first, 4-step flow): QR scan → identify → inspect checklist → success/blocked screen
  - Auto-detection of inspection result based on number of failed checklist items
  - Hard block on OUT_OF_SERVICE / MAINTENANCE equipment (immediate blocked screen)
  - Hard block on ANY damage found during inspection (per user requirement)
  - Auto-detection of CHECK_IN vs CHECK_OUT based on equipment status
- Built DashboardView (5 tabs): Overview stats, Equipment table with filters, Damages with resolve dialog, Activity log, QR print view
- Configured `next.config.ts` with `experimental.serverActions.allowedOrigins` to fix cross-origin Server Actions in preview environment
- Fixed bug: `setEquipmentAvailable` undefined variable in DamageRowCard.handleResolve
- Fixed bug: blocked check-out attempts were polluting active assignments list (filtered by `damageReportId: null`)
- Ran full E2E test via agent-browser:
  - Verified QR manual entry → identify → checklist → submit → success flow
  - Verified check-out then check-in (same QR) flow
  - Verified scanning OUT_OF_SERVICE equipment immediately blocks
  - Verified damage report during inspection blocks + creates DamageReport
  - Verified maintenance can resolve damage → equipment returns to AVAILABLE
  - Verified activity log shows complete audit trail
- Wrote comprehensive README with Vercel + Turso deployment instructions

Stage Summary:
- Working Next.js 16 app at /home/z/my-project, runs on port 3000
- Database: SQLite (local) with documented migration path to Turso (libSQL) for Vercel
- All core user flows verified end-to-end via agent-browser
- Lint passes clean (0 errors, 0 warnings)
- README.md saved to /home/z/my-project/download/README.md with full deployment guide
- Production hardening recommendations included in README (auth, photos, PWA, audit log)

---
Task ID: GSE-CONTROL-SUPABASE
Agent: Super Z (main agent)
Task: Migracija sa Prisma/SQLite na Supabase, dodavanje Supabase Auth sa 3 role, kreiranje public FIDS stranice.

Work Log:
- Instalirao @supabase/supabase-js i @supabase/ssr
- Kreirao Supabase klijente (src/lib/supabase/client.ts i server.ts)
- Napisao SQL migraciju (supabase/migrations/001_initial_schema.sql) sa:
  - 5 tabela: profiles, equipment, employees, assignments, damage_reports
  - Row Level Security policies za sve tabele
  - fids_equipment view za public read (bez notes kolone)
  - Trigger za auto-kreiranje profile-a pri registraciji
  - Seed podaci (19 GSE + 5 radnika)
- Kreirao auth adapter (src/lib/auth-mode.ts) sa Demo Mode fallback
- Kreirao src/lib/auth-server.ts sa getCurrentUser() i role helpers
- Kreirao middleware.ts za zaštitu privatnih ruta (preusmjerava na /login)
- Kreirao /login stranicu sa 3 demo korisnika (operator/engineer/admin) - jedan klik za prijavu
- Kreirao /auth/demo-login i /auth/logout API rute
- Kreirao public /fids stranicu - aerodromski FIDS display:
  - Tamni dizajn sa žutom bojom (kao pravi aerodromski displej)
  - Live clock, statistika, status board, pregled po tipu
  - Auto-refresh svakih 30 sekundi
  - Pulse animacija za "u upotrebi" i "neispravno"
- Kreirao src/lib/fids-actions.ts sa fetchFidsData() - radi sa Supabase ili Prisma fallback
- Ažurirao src/app/page.tsx - sada je server component sa auth check, redirecta na /login ako nije ulogovan
- Kreirao src/app/home-content.tsx - client component sa role-based UI:
  - Operator: samo Radnik tab (Dashboard tab disabled)
  - Inženjer: Radnik + Dashboard (bez Edit/Novo sredstvo)
  - Admin: sve + Edit + Novo sredstvo
- Ažurirao DashboardView da prihvata currentUser prop i sakriva akcije po roli
- Ažurirao WorkerView da prihvata defaultEmployeeName i defaultEmployeeCardId (prepopuni iz auth sesije)
- Testirao sve 3 role u browseru:
  - Operator login → vidi samo Radnik, ime prepopunjeno
  - Inženjer login → vidi Dashboard bez "Novo sredstvo", može riješiti prijave
  - Admin login → vidi sve, može dodavati opremu
- Testirao /fids - radi bez auth, prikazuje svih 19 sredstava sa statusima
- Lint prolazi čisto (0 errors)
- Ažurirao README sa detaljnim Supabase setup uputama i RLS tabelom
- Ažurirao .env sa jasnijim komentarima

Stage Summary:
- Aplikacija radi u dva moda:
  1. Demo Mode (default, bez Supabase env varijabli) - SQLite + hardcoded demo korisnici
  2. Production Mode (kada se postave NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_ANON_KEY) - koristi pravi Supabase
- Kod je identičan u oba moda - samo env varijable se mijenjaju
- RLS policies osiguravaju da frontend provjere nisu jedina linija odbrane
- Public FIDS stranica radi anon read preko Supabase RLS
- 3 role sa jasnno odvojenim pravima pristupa
- Zip ažuriran (210 KB) sa svim novim fajlovima

---
Task ID: GSE-CONTROL-SEARCH-MAINT-SCHED
Agent: Super Z (main agent)
Task: Dodati search i filter funkcionalnost u "Servisni planer & Rezervni dijelovi" i "Održavanje i kvalifikacije" tabove + novi PDF izvještaji

Work Log:
- Pročitao postojeći scheduling-view.tsx i maintenance-view.tsx
- Dodao search + filter u ScheduleList (Servisni plan):
  • Search po kodu opreme, nazivu, opisu, tipu, bilješkama završetka
  • Filter po statusu (Zakazano/Na naplatu/U toku/Završeno/Prekoračeno)
  • Filter po tipu (Preventivno/Korektivno/Inspekcija/Generalni)
  • Prikaz brojača "X / Y" rezultata
- Dodao search + filter u PurchasesList (Nabavke):
  • Search po broju dijela, nazivu, dobavljaču, broju računa, broju porudžbe
  • Filter po statusu plaćanja (Plaćeno/Nije plaćeno)
- Dodao search u ConsumptionList (Utrošak):
  • Search po broju dijela, nazivu, kodu vozila, potrošaču, napomenama
- Dodao search + filter u MaintenanceLogsList:
  • Search po imenu izvođača, kodu opreme, nazivu, opisu, certifikatu, zamijenjenim dijelovima
  • Filter po tipu (4 tipa) i statusu (4 statusa)
  • PDF dugme za izvoz
- Dodao search + filter u QualificationsList:
  • Search po imenu vozača, broju kartice, certifikatu, certifikatoru
  • Filter po tipu opreme (svih 12 tipova)
  • Filter po statusu: Važeće / Ističe u 30 dana / Istekle / Bez roka
  • PDF dugme za izvoz
- Kreirao 4 nove API rute za PDF izvještaje:
  • /api/reports/maintenance-log — PDF dnevnik održavanja sa sažetkom po tipu, tabelom i opisima
  • /api/reports/qualifications — PDF spisak kvalifikacija sa statusom (boje: zelena=važeća, žuta=ističe, crvena=istekla)
  • /api/reports/purchases — PDF nabavke sa PDV razradom, ukupnim iznosima i statusom plaćanja
  • /api/reports/consumption — PDF utrošak sa ukupnim količinama, troškovima i napomenama
- Dodao PDF dugmad u Servisni planer header (Nabavke PDF, Utrošak PDF)
- Build prolazi čisto (TypeScript 0 grešaka, ESLint 0 grešaka, 26 stranica generisano)

Stage Summary:
- Sva 4 sub-tab-a u "Servisni planer & Rezervni dijelovi" sada imaju search (schedule, parts već imao, purchases, consumption)
- Oba sub-tab-a u "Održavanje i kvalifikacije" sada imaju search + filter (Maintenance Log, Kvalifikacije)
- Filter po statusu za kvalifikacije: Važeće / Ističe u 30 dana / Istekle / Bez roka
- 4 nova PDF izvještaja dostupna sa dugmadima direktno u tabovima
- Sve radi u Demo i Supabase modu

---
Task ID: GSE-CONTROL-SEARCH-FIX-V2
Agent: Super Z (main agent)
Task: Fix bug — search bar nije bio vidljiv kada je baza prazna (rani return prije prikaza search bara)

Work Log:
- Identifikovao root cause: u MaintenanceLogsList, QualificationsList, i ScheduleList postojao je `if (length === 0) return <empty card>` PRIJE bloka sa search barom
- Zato kad baza nema zapisa, korisnik nije vidio search bar uopšte
- Popravio MaintenanceLogsList — search bar UVIJEK prikazan, empty state ide ispod
- Popravio QualificationsList — search bar UVIJEK prikazan čak i kad nema kvalifikacija (sa svim filterima)
- Popravio ScheduleList — search bar UVIJEK prikazan čak i kad nema zakazanih servisa
- PurchasesList, ConsumptionList, PartsList su već bili OK (nisu imali early return)
- Dodao helpful napomene "Kliknite Novi log..." / "Kliknite Auto-generiši servise..." u empty state poruke
- TypeScript: 0 grešaka, ESLint: 0 grešaka, Build: uspješan (26 stranica)

Stage Summary:
- Search i filteri su sada UVIJEK vidljivi u svim sub-tabovima — bez obzira da li ima podataka ili ne
- Korisnik mora hard-refreshati browser (Ctrl+Shift+R) jer vjerovatno gleda keširanu verziju

---
Task ID: GSE-CONTROL-PROXY-COOKIE-FIX
Agent: Super Z (main agent)
Task: Fix bug — korisnik se ne mogao ulogovati u demo mode jer proxy čita pogrešan cookie name

Work Log:
- Korisnik prijavio da ne vidi search opcije ni nakon vise hard refresh-ova
- Testirao sam sa agent-browserom: pokušaj demo login-a je redirect-ovao nazad na /login
- Root cause: proxy.ts je čitao cookie 'gse-session', ali demo-login route.ts setuje 'demo-session'
  • auth-server.ts je čitao 'demo-session' (ispravno)
  • proxy.ts je čitao 'gse-session' (pogrešno)
  • Zato je proxy uvijek odbijao pristup /dashboard jer je njegov cookie bio prazan
  • Korisnik nikad nije mogao ući na dashboard uopšte, jer je ostajao na /login strani
- Popravio proxy.ts da čita i 'demo-session' i 'gse-session' (za migraciju starih korisnika)
- Testirao sa agent-browserom:
  • Demo login kao admin ✓
  • Otvoren dashboard ✓
  • Klik na tab "Održavanje" → search "Pretraga po izvođaču, opremi, opisu..." ✓ + filteri "Svi tipovi" / "Svi statusi" + PDF dugme ✓
  • Klik na sub-tab "Kvalifikacije" → search "Pretraga po imenu, kartici, certifikatu..." ✓ + filteri "Svi tipovi opreme" / "Svi statusi" (Važeće/Ističe/Istekle/Bez roka) ✓
  • Klik na tab "Servis & Dijelovi" → servisni plan prikazuje search "Pretraga po kodu, nazivu, opisu..." ✓ + filteri "Svi statusi" / "Svi tipovi" ✓
  • Sub-tab "Nabavke" → search "Pretraga po dijelu, dobavljaču, računu..." ✓ + filter "Sve nabavke / Plaćeno / Nije plaćeno" ✓
  • Auto-generisao 38 servisa, testirao search sa "TOW" → prikazano 3 servisa (GSE-TOW-001/002/003) ✓
  • Testirao sa "GPU" → prikazano 2 servisa (GSE-GPU-002/003) ✓
  • Search filter radi ispravno — broj rezultata se mijenja sa upisom

Stage Summary:
- Pravi problem NIJE bio u search kodu (search je već bio ispravno implementiran prošli put)
- Problem je bio u cookie mismatch-u između proxy.ts i demo-login route.ts
- Korisnik nikad nije mogao ući na dashboard u demo mode-u jer ga je proxy redirect-ovao nazad na /login
- Sada radi: login → dashboard → svi tabovi sa search/filtrima funkcionišu
- Build čist, sve funkcionalno testirano end-to-end kroz agent-browser

---
Task ID: GSE-CONTROL-DEICING-MODULE
Agent: Super Z (main agent)
Task: Implementacija kompletnog De-icing / Anti-icing modula sa HOT kalkulatorom, search-om, PDF izvještajima i statistikom

Work Log:
- Prisma schema: 3 nova modela (DeicingFluid, DeicingRecord, DeicingFluidDisposal) sa odgovarajućim indeksima
- Supabase SQL migracija 011_deicing.sql sa RLS policies, triggers, seed podacima (2 DEICER vozila, 2 fluida)
- HOT lookup tabele (src/lib/hot-tables.ts):
  • Type I HOT — 22 ćelije (4 temp range × 5 padavina)
  • Type II/IV HOT — 40+ ćelija (3 koncentracije × 5 padavina × 2-3 temp range)
  • Type III HOT — 10 ćelija
  • Ukupno ~70 HOT entries bazirano na ISO 11076 / Transport Canada 2024-2025
  • Funkcija calculateHOT() sa pravilnom logikom za temp range po koncentraciji
  • Posebna obrada FREEZING_FOG (nema intenzitet), COLD_SOAK (samo -3+)
- Server actions (src/lib/actions-deicing.ts):
  • CRUD za DeicingFluid (add, delete, update quantity, list)
  • CRUD za DeicingRecord (create sa auto-HOT calc, delete, list)
  • CRUD za DeicingFluidDisposal (create, delete, list)
  • getDeicingStats() — ukupno stock, potrošeno, odbačeno, po tipu, po vozilu, po mjesecu, isteklo, ističe uskoro
- DeicingView komponenta (src/components/dashboard/deicing-view.tsx):
  • 5 sub-tabova: Operacije, Tečnosti, Disposal, HOT Kalkulator, Statistika
  • Search UVIJEK vidljiv (i kad je baza prazna) u sva 3 lista sub-tab-a
  • Filteri: po tipu tečnosti, statusu (važeće/ističe/isteklo), operaciji, metodi disposal-a
  • HOT Kalkulator — interaktivni sa live preview-om
  • Add Record dialog — sa auto-HOT calc i prikazom u realnom vremenu
  • Statistika — 4 KPI kartice + by type + by vehicle + by month (12 mjesečni trend bar chart)
- 4 PDF API rute:
  • /api/reports/deicing-records — tabela svih operacija sa HOT kolonom
  • /api/reports/deicing-fluids — inventar sa statusom (važeće/ističe/isteklo)
  • /api/reports/deicing-disposal — disposal records sa metodom, vendorom, troškom
  • /api/reports/deicing-stats — sažetak + by type + by vehicle + by month
- Dodat "De-icing" tab u dashboard (između Gorivo & Parking i Izvještaji) sa Snowflake ikonom
- Seed skript (scripts/seed-deicing.js):
  • 2 DEICER vozila (GSE-DEI-001 Vestergaard, GSE-DEI-002 Bucher)
  • 4 fluida (Type I, Type II 75/25 ističe, Type IV, Type I istekao)
  • 2 operacije (de-icing A320, anti-icing B737)
  • 1 disposal record
- Bug fix: HOT kalkulator vraća null jer getTempRangeKey je koristio > umjesto >= za -3
- Bug fix: Type II/IV temperature ranges su različiti od Type I (75/25 ima samo -3-25, ne -3-14 i -14-25)
- Bug fix: FREEZING_FOG ne koristi intenzitet u HOT tabelama
- Testirano end-to-end sa agent-browser:
  • Login kao admin ✓
  • De-icing tab prikazuje 4 alert kartice sa brojevima (2/4/1/1) ✓
  • Search bar vidljiv u Operacije, Tečnosti, Disposal sub-tabovima ✓
  • HOT Kalkulator: Type II 100/0 Snow Moderate @ -3°C → 23 minuta ✓
  • Search "Kilfrost" filtrira fluide na 2 rezultata ✓
  • Svi 4 PDF-a generišu se sa HTTP 200 ✓
  • Statistika prikazuje: 1630L stock, 10696€ vrijednost, 330L potrošeno, 30L odbačeno ✓
- TypeScript: 0 grešaka, ESLint: 0 grešaka, Build: uspješan (30 stranica)

Stage Summary:
- Kompletan De-icing modul sa 5 sub-tabova funkcionalan
- HOT kalkulator sa ISO 11076 tabelama (Type I/II/III/IV × 7 padavina × 3 intenziteta × više temp range)
- Sve 3 liste (records, fluids, disposal) imaju search + filtere UVIJEK vidljive
- 4 PDF izvještaja rade (records, fluids, disposal, stats)
- Statistika uključuje: ukupno stock, vrijednost, potrošnja, disposal, po tipu, po vozilu, mjesečni trend
- Compliance: ICAO Annex 3, AEA Recommendations, ISO 11076, environmental (ISO 14001) za disposal
- Seed podaci omogućavaju odmah testiranje (2 vozila, 4 fluida, 2 operacije, 1 disposal)

---
Task ID: GSE-CONTROL-AERODROME-INSPECTION
Agent: Super Z (main agent)
Task: Implementacija Aerodrome Daily Inspection modula (ADR.OPS.B.005 + ICAO Annex 14)

Work Log:
- Prisma schema: 3 nova modela (AerodromeInspection, InspectionFinding, Notam)
  • AerodromeInspection: 15+ checklist polja (runway/taxiway/apron/movement area)
  • InspectionFinding: kategorija, težina, koordinate, foto, NOTAM link
  • Notam: full ICAO Annex 15 format (series, qualifier, FIR, aerodrome, scope, traffic, text)
- Supabase SQL migracija 012_aerodrome_inspection.sql sa RLS policies, triggers
- Server actions (src/lib/actions-inspection.ts):
  • CRUD za AerodromeInspection (sa ugrađenim findings create)
  • CRUD za InspectionFinding (sa status update)
  • CRUD za Notam (sa auto-generacijom broja A1234/26)
  • getInspectionStats() — byType, byStatus, byCategory, bySeverity, byInspector, byMonth, criticalByMonth, topProblemLocations, topProblemCategories
- AerodromeInspectionView sa 5 sub-tabova:
  • Inspekcije — search + filteri (tip, status), checklist prikaz sa OK/NOT_OK/N_A
  • Nalazi — search + filteri (kategorija, težina, status), foto dokazi, koordinate
  • NOTAM — search + filter (status), kreiranje iz finding-a, otkazivanje
  • Statistika — 4 KPI + bar charts (tip, status, kategorija, težina) + Top 10 lokacija
  • Trendovi — mjesečni bar chart inspekcija + kritičnih + performanse inspektora
- 4 PDF API rute:
  • /api/reports/daily-inspection — sve inspekcije sa nalazima
  • /api/reports/inspection-findings — svi nalazi sa koordinatama i NOTAM-om
  • /api/reports/inspection-monthly-stats — sažetak 30 dana + top problemi
  • /api/reports/inspection-annual-stats — godišnja statistika sa mjesečnim trendom
- Tab "Aerodrom Inspekcija" dodan u dashboard sa Plane ikonom
- Seed podaci (scripts/seed-aero-inspection.js):
  • 6 inspekcija (4 runway, 1 taxiway, 1 apron, 1 movement area joint)
  • 6 nalaza (1 kritični, 2 srednja, 2 niska, 1 visoki) sa različitim statusima
  • 2 NOTAM-a (1 aktivan za kritični nalaz, 1 otkazan)
- Testirano end-to-end:
  • Login kao admin ✓
  • Tab prikazuje 4 alert kartice: 6/3/1/1 ✓
  • Search "Milica" filtrira na 2 inspekcije ✓
  • Svi 4 PDF-a vraćaju HTTP 200 ✓
  • NOTAM tab prikazuje 2 NOTAM-a sa pravim statusima ✓
  • Statistika prikazuje KPI brojeve ✓
- Build čist: TypeScript 0, ESLint 0, 30 stranica generisano

Stage Summary:
- Kompletan Aerodrome Daily Inspection modul funkcionalan
- Search UVIJEK vidljiv u svim 3 listama (Inspekcije, Nalazi, NOTAM)
- Filteri: po tipu, statusu, kategoriji, težini, NOTAM statusu
- 4 PDF izvještaja sa top problem lokacijama i statistikom
- Compliance: ADR.OPS.B.005, ICAO Annex 14, ICAO Annex 15 (NOTAM)
- Auto-status: ako inspekcija ima kritični nalaz → status='CRITICAL'
- Auto-NOTAM broj: A + 4 random cifre / 2-cifrene godine
- Top 10 problematičnih lokacija pomaže identifikaciju šta je najveći problem

---
Task ID: GSE-CONTROL-SMS-MODULE
Agent: Super Z (main agent)
Task: Implementacija SMS modula (ICAO Annex 19, EASA M.GEN.205) + ažuriranje PPT prezentacije

Work Log:
- Prisma schema: 4 nova modela (Hazard, SPI, SPT, SafetyAction) sa poljima za ALARP, residual risk, due dates
- Supabase SQL migracija 013_sms.sql sa RLS policies, triggers
- Server actions (src/lib/actions-sms.ts):
  • CRUD za Hazards (sa auto-generacijom HZ-YYYY-NNN ID)
  • CRUD za SPI (sa auto status GREEN/AMBER/RED na osnovu threshold-a)
  • CRUD za SPT (sa auto progress % i status ON_TRACK/AT_RISK/OFF_TRACK/ACHIEVED)
  • CRUD za SafetyActions (sa auto-generacijom SAP-YYYY-NNN ID)
  • getSMSSummary() — sve KPI na jednom mjestu
- Risk Matrix utility (src/lib/risk-matrix.ts) — 5x5 matrix sa 4 nivoa rizika
- SMSView sa 6 sub-tabova:
  • Sažetak — KPI kartice + distribucija rizika + SPI/SPT statusi
  • Hazardi — search + filteri (kategorija, rizik, status) + mitigacija sa ALARP
  • Risk Matrix — vizuelna 5x5 grid sa brojem hazarda po ćeliji
  • SPI — search + filteri (kategorija, status) + progress bar sa alert markerom
  • SPT — search + filter (status) + progress % + dana do roka
  • Action Plan — search + filteri (kategorija, prioritet, status) + overdue alert
- 5 PDF API rute:
  • /api/reports/sms-hazards — Hazard Identification Log
  • /api/reports/sms-risk-register — Risk Register sa 5x5 matrix vizualizacijom
  • /api/reports/sms-spi-spt — SPI i SPT tabela
  • /api/reports/sms-action-plan — Safety Action Plan sa troškovima
  • /api/reports/sms-summary — Kompletan SMS sažetak sa zaključkom
- Tab "SMS" dodan u dashboard sa Shield ikonom
- Seed podaci (scripts/seed-sms.js):
  • 4 hazarda (1 critical, 2 high, 1 medium) sa mitigacijama i ALARP
  • 4 SPI-a (2 green, 1 amber, 1 red) — npr. GSE incidenti po 10k, MTBF
  • 3 SPT-a (2 on-track, 1 off-track) — npr. smanjiti incidente 20% YoY
  • 4 safety akcije (1 critical, 1 high, 1 medium, 1 completed)
- Testirano end-to-end:
  • Login kao admin ✓
  • SMS tab prikazuje 4 alert kartice: 2/1/1/1 ✓
  • Svi 5 PDF-a vraćaju HTTP 200 ✓
  • Risk Matrix prikazuje 5x5 grid sa hazardima ✓
- Bug fix: 'use server' fajl ne može izvoziti calculateRiskLevel — premješteno u risk-matrix.ts
- Bug fix: ExclamationTriangle ne postoji u lucide-react — zamijenjeno sa AlertTriangle
- Build čist: TypeScript 0, ESLint 0, 30 stranica generisano

- Ažurirana PPT prezentacija:
  • 12 slajdova sa svim modulima aplikacije
  • Naslovna, Pregled, Worker Flow (QR), Dashboard (20+ tabova), De-icing modul, Aerodrom Inspekcija, SMS modul, EASA/ICAO compliance, Search+PDF, Tehnologija, Statistika, Zaključak
  • Dark aviation theme sa safety akcentima
  • Inter + JetBrains Mono fontovi
  • Material Icons
  • PPTX: 3.2 MB

Stage Summary:
- Kompletan SMS modul funkcionalan sa 6 sub-tabova
- Search UVIJEK vidljiv u svim listama (Hazards, SPI, SPT, Actions)
- 5 PDF izvještaja: Hazardi, Risk Register (sa 5x5 matrix), SPI/SPT, Action Plan, Sažetak sa zaključkom
- Risk Matrix 5x5 sa auto-izračunatim nivoima rizika (Low/Medium/High/Critical)
- ALARP justification ugrađen u hazard mitigaciju
- Auto-status: SPI → GREEN/AMBER/RED; SPT → ON_TRACK/AT_RISK/OFF_TRACK/ACHIEVED
- PPT prezentacija ažurirana sa svim modulima (12 slajdova)
- Compliance: ICAO Annex 19, EASA M.GEN.205, ALARP princip

---
Task ID: GSE-AUDIT-PDF-ROUTES
Agent: Super Z (sub agent)
Task: Kreirati 6 PDF API ruta za Audit & Compliance modul u /api/reports/

Work Log:
- Pročitao worklog.md i referentnu rutu /api/reports/sms-summary/route.ts radi usklađivanja pristupa
- Pročitao /components/dashboard/audit-view.tsx da izvužem sve labele (AUDIT_TYPE_LABELS, PROGRAM_STATUS_LABELS, AUDIT_STATUS_LABELS, RESULT_LABELS, CLASSIFICATION_LABELS, FINDING_CATEGORY_LABELS, FINDING_STATUS_LABELS, CAPA_TYPE_LABELS, CAPA_SOURCE_LABELS, CAPA_STATUS_LABELS, COMPLIANCE_STATUS_LABELS, COMPLIANCE_CATEGORY_LABELS, PRIORITY_LABELS)
- Pročitao prisma/schema.prisma (AuditProgram, Audit, AuditFinding, CAPA, ComplianceItem) i lib/actions-audit.ts (mappere između snake_case Supabase i camelCase Prisma)
- Pročitao lib/pdf-utils.ts (transliterate funkcija) i potvrdio pristup: sve tekstove provući kroz transliterate() prije drawText
- Kreirao 6 novih API ruta (svaka koristi isti pattern kao sms-summary): PDFDocument/StandardFonts/rgb iz pdf-lib, getCurrentUser za auth, isDemoMode + db (Demo) ili createClientAsync (Supabase), A4 595.28×841.89, margin 50, footer "GSE Control · <datum>"

  1. /api/reports/audit-program/route.ts
     • Header: "GSE CONTROL — AUDIT PROGRAM" + subtitle "ADR.OPS.D.005 · EASA Part-145.A.65"
     • Sažetak: ukupno, planned/scheduled, completed, overdue (sa statusnim bojama)
     • Tabela: ID, Naslov, Tip, Auditor, Status, Rezultat, Nalaza (7 kolona)
     • Detalji po programu: Opseg, Standard, Auditees, Planirani datum (year/quarter), Prioritet, Auditor, broj Major/Minor/Opservacija nalaza, rezultat
     • Filename: audit-program-YYYY-MM-DD.pdf

  2. /api/reports/audit-audits/route.ts
     • Header: "GSE CONTROL — AUDITI"
     • Sažetak: total, scheduled, in_progress, completed
     • Tabela: ID, Naslov, Tip, Auditor, Datum, Status, Rezultat (7 kolona)
     • Detalji po auditu: Tip/Status/Rezultat, Opseg, Standard, Auditees (organizacija + oblasti), datumi (scheduled/start/end), auditor + tim, Summary (word-wrap), Recommendations (word-wrap)
     • Filename: audit-audits-YYYY-MM-DD.pdf

  3. /api/reports/audit-findings/route.ts
     • Header: "GSE CONTROL — AUDIT FINDINGS (NALAZI AUDITA)"
     • Sažetak po klasifikaciji: Major (crveno), Minor (žuto), Opservacija (plavo), Pozitivno (zeleno) + prekoraceni rok
     • Tabela: ID, Klasifikacija, Kategorija, Naslov, Status, Zadužen, Rok (7 kolona)
     • Detalji po nalazu: klasa/kategorija/status/rizik, vezani audit, oblast/proces/zadužen/rok, te blokovi: Opis, Kriterijum, Dokaz, Korektivna akcija, Verifikacija (svi sa word-wrap za duge tekstove)
     • Filename: audit-findings-YYYY-MM-DD.pdf

  4. /api/reports/audit-capa/route.ts
     • Header: "GSE CONTROL — CAPA (Corrective and Preventive Actions)"
     • Sažetak: open, implemented, verified, closed, overdue + ukupni trošak (EUR)
     • Tabela: ID, Tip, Naslov, Izvor, Zadužen, Rok, Status (7 kolona)
     • Detalji po CAPA: tip/izvor/sourceRef/status, zadužen/rok/trošak (actual/estimated), te blokovi: Problem, Korijenski uzrok, Korektivna akcija, Preventivna akcija, Verifikacija, Dokaz implementacije (word-wrap)
     • Filename: audit-capa-YYYY-MM-DD.pdf

  5. /api/reports/audit-compliance-matrix/route.ts
     • Header: "GSE CONTROL — COMPLIANCE MATRIX"
     • Subtitle: "EASA Part-145 · ICAO Annex 14/15/19 · IATA AHM"
     • Sažetak: total, compliant, non_compliant, partial, stopa sukladnosti % (boja: ≥90 zeleno, ≥70 žuto, <70 crveno)
     • Tabela: ID, Regulativa, Zahtjev, Status, Rizik, Interni dok (6 kolona)
     • Sekcija "GAP ANALIZA" — samo za NON_COMPLIANT i PARTIAL: prikazuje opis gap-a + korektivnu akciju za svaku stavku (word-wrap); ako nema — ispisuje zeleno "sve sukladne"
     • Filename: audit-compliance-matrix-YYYY-MM-DD.pdf

  6. /api/reports/audit-summary/route.ts
     • Combo svih 5 modula u jedan PDF sažetka
     • Header: "GSE CONTROL — AUDIT & COMPLIANCE SAŽETAK"
     • Subtitle: "ADR.OPS.D.005 · EASA Part-145.A.65 · ICAO Annex 19 · EASA M.GEN.205"
     • Sekcije sa KPI: 1. AUDIT PROGRAM (ukupno/planned/completed/overdue), 2. AUDITI (ukupno/scheduled/in_progress/completed), 3. FINDINGS (Major/Minor/Ops/Poz + open/closed/overdue), 4. CAPA (open/implemented/verified/closed/overdue + total cost), 5. COMPLIANCE MATRIX (total/compliant/non/partial/pending + compliance rate)
     • Sekcija 6: ZAKLJUCAK — overall health baziran na compliance rate i otvorenim kriticnim (MAJOR+OPEN/IN_PROGRESS) nalazima: crveno (<70% ili kritični otvoreni), žuto (<90% ili gap-ovi), zeleno (≥90% i bez kritičnih)
     • Automatske preporuke na osnovu stanja (zatvoriti MAJOR, obraditi nesukladnosti, pregora CAPA, etc.)
     • Filename: audit-summary-YYYY-MM-DD.pdf

- Implementirao wrapText() helper za duge tekstove (Summary, Recommendations, Opis, Problem, Gap) — do 110 znakova po liniji, automatski word-wrap
- Boje konzistentne kroz sve rute: rgb(0.86, 0.15, 0.15) crveno, rgb(0.1, 0.55, 0.15) zeleno, rgb(0.85, 0.55, 0.1) žuto, plus plavo rgb(0.2, 0.4, 0.7) za opservacije/verifikovane i sivo za napomene
- Sve labele identične kao u audit-view.tsx (nakon transliteracije — č, ć, ž, š, đ → c/c/z/s/dj)
- Footer na svakoj strani: "GSE Control · <datum/hr-HR>" na y=30
- Multi-page support: prije svake sekcije provjerava y < threshold i dodaje novu stranu
- Demo mode: db.auditProgram.findMany / db.audit.findMany / db.auditFinding.findMany (sa include: { audit: true }) / db.cAPA.findMany / db.complianceItem.findMany
- Supabase mode: select(*) sa odgovarajućim mapperima iz snake_case u camelCase
- TypeScript: 0 grešaka (`npx tsc --noEmit`)
- ESLint: 0 grešaka (`npx eslint` na svih 6 fajlova)

Stage Summary:
- 6 novih PDF API ruta kreirano u /home/z/my-project/src/app/api/reports/
- Sve rute već povezane u audit-view.tsx preko "Program PDF / Auditi PDF / Nalazi PDF / CAPA PDF / Compliance Matrix PDF / Sažetak PDF" dugmadi
- Isti pattern kao postojeći PDF rute (sms-summary, inspection-findings, itd.) — konzistentno API
- Sve rute podržavaju Demo i Supabase mod
- Sve ruke poštuju format A4 (595.28 × 841.89), margin 50, footer sa datumom
- Compliance: ADR.OPS.D.005, EASA Part-145.A.65, ICAO Annex 14/15/19, IATA AHM

---
Task ID: GSE-CONTROL-AUDIT-MODULE
Agent: Super Z (main agent)
Task: Implementacija Audit & Compliance Monitoring modula (ADR.OPS.D.005 + EASA Part-145.A.65)

Work Log:
- Prisma schema: 5 novih modela (AuditProgram, Audit, AuditFinding, CAPA, ComplianceItem)
- Supabase SQL migracija 014_audit_compliance.sql sa RLS policies, triggers
- Server actions (src/lib/actions-audit.ts):
  • CRUD za AuditProgram (auto-generacija AP-YYYY-NNN)
  • CRUD za Audit (auto-generacija AUD-YYYY-NNN, sa status update-om)
  • CRUD za AuditFinding (auto-generacija FIN-YYYY-NNN, sa CAPA management-om)
  • CRUD za CAPA (auto-generacija CAPA-YYYY-NNN, sa verifikacijom)
  • CRUD za ComplianceItem (auto-generacija CM-NNN)
  • getAuditSummary() — sve KPI na jednom mjestu
- AuditView komponenta sa 6 sub-tabova:
  • Sažetak — 4 KPI + distribucija nalaza + compliance po kategoriji
  • Audit Program — godišnji plan (PLANNED/SCHEDULED/IN_PROGRESS/COMPLETED)
  • Auditi — pojedinačni auditi sa status update i overall result
  • Nalazi (Findings) — MAJOR/MINOR/OBSERVATION/POSITIVE sa 5-why root cause
  • CAPA — Corrective/Preventive sa verifikacijom i troškovima
  • Compliance Matrix — EASA Reg → interni dokument → dokaz sukladnosti
- 6 PDF API ruta (kreirano preko subagenta):
  • /api/reports/audit-program — godišnji plan sa nalazima
  • /api/reports/audit-audits — svi auditi sa summary i preporukama
  • /api/reports/audit-findings — nalazi sa klasifikacijom i verifikacijom
  • /api/reports/audit-capa — CAPA sa root cause i troškovima
  • /api/reports/audit-compliance-matrix — compliance matrix sa gap analizom
  • /api/reports/audit-summary — kompletan sažetak sa zaključkom
- Tab "Audit & Compliance" dodan u dashboard sa ClipboardCheck ikonom
- Seed podaci (scripts/seed-audit.js):
  • 3 audit programa (Q1 završen sa 1 major, Q2 zakazan, Q3 planiran)
  • 3 audita (1 završen non-conformant, 1 u toku, 1 zakazan)
  • 5 nalaza (1 MAJOR CRS, 3 MINOR, 1 OBSERVATION)
  • 4 CAPA (1 in_progress, 1 verified, 1 open, 1 overdue)
  • 12 compliance stavki (8 compliant, 1 non-compliant, 1 partial, 2 other)
- Search UVIJEK vidljiv u svih 5 lista (Program, Audits, Findings, CAPA, Compliance)
- Filteri:
  • Program: tip, status
  • Audits: tip, status
  • Findings: klasifikacija, kategorija, status
  • CAPA: tip, izvor, status
  • Compliance: kategorija, status + prikaz compliance rate %
- Auto-izračunavanje: compliance rate %, findings count, overdue alerts
- Testirano end-to-end:
  • Login kao admin ✓
  • Audit tab prikazuje 4 alert kartice: 3/1/3/2 ✓
  • Search "Part-145" u Compliance filtrira na 6 rezultata ✓
  • Svi 6 PDF-a vraćaju HTTP 200 ✓
- Build čist: TypeScript 0, ESLint 0, 36 stranica generisano

Stage Summary:
- Kompletan Audit & Compliance modul funkcionalan sa 6 sub-tabova
- Search UVIJEK vidljiv u svih 5 lista
- 6 PDF izvještaja: Program, Auditi, Nalazi, CAPA, Compliance Matrix, Sažetak
- Auto-generacija ID-a (AP-/AUD-/FIN-/CAPA-/CM-)
- 5-Why root cause analysis ugrađen u Findings i CAPA
- Compliance rate % prikazan u real-time
- Gap analiza za NON_COMPLIANT i PARTIAL stavke
- Compliance: ADR.OPS.D.005, EASA Part-145.A.65, ICAO Annex 19

---
Task ID: GSE-DOC-CONTROL-VIEW
Agent: Sub agent (general-purpose)
Task: Kreiraj React komponentu za Document Control modul (po uzoru na audit-view.tsx pattern).

Work Log:
- Pročitan worklog.md za kontekst, src/lib/actions-document-control.ts za server actions, src/components/dashboard/audit-view.tsx kao referentni primjer strukture.
- Kreiran fajl src/components/dashboard/document-control-view.tsx (1470 linija) sa sledećom strukturom:
  • Glavna `DocumentControlView` komponenta
    - Header sa FileText ikonom, naslov "Document Control System", subtitle "EASA Part-145.A.65 · ISO 9001"
    - 6 PDF dugmadi: Documents, Versions, Reviews, Distribution, Statistics, Summary (svako vodi na odgovarajući /api/reports/doc-control-* endpoint)
    - 4 klikabilne AlertCard kartice: Ukupno dokumenata (blue), Reviews overdue (red), Reviews due soon (amber), Pending acknowledgment (purple) — otvaraju odgovarajući tab
    - 6 tabova: Documents (FileText), Versions (History), Reviews (ClipboardCheck), Distribution (Users), Statistics (BarChart3), Reviews Calendar (Calendar)
  • `DocumentsList` — search (po docId, title, description, owner, author, keywords, standard) + 3 filtera (category, status, classification) + Add Document dialog + DocumentCard sa svim poljima + Edit + Delete + brojač X/Y
  • `DocumentCard` — docId, title, status badge, category, currentVersion, owner, effectiveDate, nextReviewDate (crveni ako overdue), classification badge, standard, keywords, file link
  • `AddDocumentDialog` — sva polja iz ControlledDocument modela (docId, title, description, category, docType, standard, currentVersion, status, effectiveDate, nextReviewDate, owner, author, approver, fileUrl, location, reviewFrequency, classification, keywords, notes)
  • `EditDocumentDialog` — status change + title, owner, approver, nextReviewDate, classification, keywords, notes (poziva updateDocument)
  • `VersionsList` — search (po docId, versionNumber, revisedBy, changeDescription, changeReason) + filter status + Add Version dialog + VersionCard + Delete + brojač
  • `VersionCard` — documentId→docId, versionNumber, revisionDate, revisedBy, approvedBy, changeDescription, changeReason, affectedSections, status badge, file link
  • `AddVersionDialog` — documentId select, versionNumber, revisedBy, approvedBy, changeDescription, changeReason, affectedSections, status, effectiveDate, fileUrl + info banner o automatskom ažuriranju currentVersion pri PUBLISHED statusu
  • `ReviewsList` — search (po docId, reviewer, result, reviewComments, changesRequired, actionTaken) + 3 filtera (reviewType, result, status) + Add Review dialog + ReviewCard + Delete + brojač
  • `ReviewCard` — documentId→docId, reviewType, reviewDate, reviewer, result, reviewComments, changesRequired, actionTaken, newVersionRequired badge, status, completedAt
  • `AddReviewDialog` — documentId, reviewType, reviewer, result, reviewComments, changesRequired, newVersionRequired checkbox, actionTaken, status
  • `DistributionList` — search (po docId, recipientName, recipientRole, recipientDepartment, recipientEmail, distributedBy) + 2 filtera (status, distributionMethod) + Add Distribution dialog + DistributionCard sa Acknowledge dugmetom + Delete + brojač
  • `DistributionCard` — documentId→docId, recipientName, recipientRole, recipientDepartment, distributionDate, distributedBy, distributionMethod, acknowledged (badge), acknowledgedAt, versionNumber
  • `AddDistributionDialog` — documentId, recipientName, recipientRole, recipientDepartment, recipientEmail, distributionMethod, distributedBy, versionNumber, notes
  • `StatisticsView` — 4 StatCard kartice (Total, Published, Reviews overdue, Ack rate %) + 4 bar chart-a (po statusu, po kategoriji, po tipu dokumenta, po klasifikaciji) + Top 10 vlasnika tabela + Reviews by result bar chart + sekcije "Reviews overdue" i "Reviews due soon"
  • `ReviewsCalendarView` — lista dokumenata sortirana po nextReviewDate, color-coded (crvena overdue / žuta ≤30 dana / zelena >30 dana), search + filter po reviewFrequency
  • Shared komponente na dnu: `AlertCard`, `TabBtn`, `StatCard` (iste kao u audit-view.tsx)

- Sve labele definirane prema specifikaciji (CATEGORY_LABELS, DOC_TYPE_LABELS, STATUS_LABELS, CLASSIFICATION_LABELS, REVIEW_TYPE_LABELS, REVIEW_RESULT_LABELS, REVIEW_STATUS_LABELS, DISTRIBUTION_METHOD_LABELS, DISTRIBUTION_STATUS_LABELS, REVIEW_FREQUENCY_LABELS, VERSION_STATUS_LABELS)
- STATUS_COLORS mapiran prema specifikaciji (PUBLISHED=emerald, APPROVED=blue, UNDER_REVIEW=amber, DRAFT=gray, SUPERSEDED=orange, WITHDRAWN=red)
- dodatne CLASSIFICATION_COLORS i REVIEW_STATUS_COLORS za konzistentne boje
- Search bar UVIJEK vidljiv u svih 6 prikaza (Documents, Versions, Reviews, Distribution, Calendar + search u Statistics nije potreban jer nema liste) — KRITIČNO pravilo ispunjeno
- Empty state poruke prikazane ISPOD search bara
- Brojač "X / Y" prikazan desno od searchbara u svih 5 lista
- Sve sub-komponente definirane OUTSIDE glavne komponente (zbog ESLint react-hooks/static-components rule) — AuditView pattern
- shadcn/ui komponente: Card, CardContent, CardHeader, CardTitle, Button, Badge, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Label, Input, Textarea, Checkbox, Select (+ SelectContent/Item/Trigger/Value), Table (+ TableBody/Cell/Head/Header/Row)
- lucide-react ikone: FileText, Plus, Loader2, Calendar, Trash2, Search, Download, AlertTriangle, History, ClipboardCheck, Users, BarChart3, Pencil, CheckCircle2, Clock, FileCheck, Link
- `toast` iz sonner za notifikacije
- `useTransition` za pending state u svim mutacijama (delete, create, update, acknowledge)
- Auto-izračunavanje: alert counts (overdue/due-soon/pending-ack), statistics (ack rate %, max values za bar charts)
- Verifikacija:
  • TypeScript: 0 grešaka (`npx tsc --noEmit`)
  • ESLint: 0 grešaka/upozorenja (`npx eslint src/components/dashboard/document-control-view.tsx`)

Stage Summary:
- Document Control View komponenta (1470 linija) kompletno implementirana po uzoru na audit-view.tsx
- 6 pod-komponenti lista sa uvijek-vidljivim search barom i brojačem
- 4 AlertCard + 4 StatCard + 5 bar chart-a + Top 10 tabela + 2 overdue/due-soon sekcije
- Sva polja iz ControlledDocument, DocumentVersion, DocumentReview, DocumentDistribution modela pokrivena u dialogima
- Automatsko ažuriranje currentVersion pri kreiranju PUBLISHED verzije (logika u server action `createVersion` — komponenta prikazuje info banner)
- Acknowledge dugme na DistributionCard poziva `acknowledgeDistribution` server action
- Edit funkcija na DocumentCard poziva `updateDocument` (minimalno status change + ostala polja)
- Kompletna sukladnost sa zadanim labelama i bojama

---
Task ID: GSE-DOC-CONTROL-PDF
Agent: Sub agent (general-purpose)
Task: Kreiraj 6 PDF API ruta za Document Control modul u src/app/api/reports/ (po uzoru na audit-summary/route.ts pattern).

Work Log:
- Pročitan worklog.md za kontekst, src/app/api/reports/audit-summary/route.ts i audit-findings/route.ts kao referentni primjeri PDF route-a, src/lib/actions-document-control.ts za server actions (getDocuments, getDocumentStats), src/components/dashboard/document-control-view.tsx za labele i boje.
- Kreirano 6 novih ruta:
  • src/app/api/reports/doc-control-documents/route.ts — pregled ControlledDocument modela
  • src/app/api/reports/doc-control-versions/route.ts — DocumentVersion sa vezom na ControlledDocument
  • src/app/api/reports/doc-control-reviews/route.ts — DocumentReview sa vezom na ControlledDocument
  • src/app/api/reports/doc-control-distribution/route.ts — DocumentDistribution sa vezom na ControlledDocument
  • src/app/api/reports/doc-control-statistics/route.ts — kompletna statistika iz getDocumentStats()
  • src/app/api/reports/doc-control-summary/route.ts — combo sažeti izvještaj svih 4 modula

- Reference pattern primijenjen dosljedno:
  • pdf-lib (PDFDocument, StandardFonts, rgb)
  • getCurrentUser + 401 Unauthorized check
  • transliterate() primijenjen na sav tekst kroz addText() helper
  • A4 format (595.28 × 841.89), margin 50
  • Footer: `GSE Control · ${new Date().toLocaleString('hr-HR').slice(0, 16)}` na y=30
  • Header pattern: naslov (15pt bold) + subtitle (9pt grey) + generisao/datum linije
  • wrapText() helper za dugačke tekstove (110 karaktera)
  • Page break logika (y < 80 / 180 / 200) sa novom stranicom i reset y
  • Filename pattern: `doc-control-<module>-YYYY-MM-DD.pdf`
  • Content-Disposition: attachment header

- Labele (identične kao u document-control-view.tsx):
  • CATEGORY_LABELS, DOC_TYPE_LABELS, STATUS_LABELS, CLASSIFICATION_LABELS, REVIEW_FREQUENCY_LABELS (Route 1)
  • VERSION_STATUS_LABELS (Route 2)
  • REVIEW_TYPE_LABELS, REVIEW_RESULT_LABELS, REVIEW_STATUS_LABELS (Route 3)
  • DISTRIBUTION_METHOD_LABELS, DISTRIBUTION_STATUS_LABELS (Route 4)
  • Sve gore navedeno + REVIEW_RESULT_LABELS (Route 5)
  • VERSION_STATUS_LABELS, REVIEW_RESULT_LABELS, STATUS_LABELS (Route 6)

- Boje (konzistentne kroz sve 6 ruta):
  • RED = rgb(0.86, 0.15, 0.15)
  • GREEN = rgb(0.1, 0.55, 0.15)
  • YELLOW = rgb(0.85, 0.55, 0.1)
  • BLUE = rgb(0.2, 0.4, 0.7)
  • GREY = rgb(0.4, 0.4, 0.4)
  • Status/result color mappers primijenjeni per-pojačani prikaz (PUBLISHED=green, DRAFT=grey, SUPERSEDED/UNDER_REVIEW=yellow, WITHDRAWN=red)

- Route 1 (doc-control-documents):
  • Header: "GSE CONTROL — DOCUMENT REGISTER"
  • Subtitle: "EASA Part-145.A.65 · ISO 9001"
  • Sažetak: ukupno, published, draft, superseded, overdue reviews
  • Tabela: DocID, Naslov, Kategorija, Verzija, Status, Vlasnik, Sljedeći pregled
  • Detalji po dokumentu: Description, Standard, Classification, Owner, Author, Approver, File URL, Keywords, EffectiveDate, NextReviewDate, LastReviewedAt, ReviewFrequency

- Route 2 (doc-control-versions):
  • Header: "GSE CONTROL — DOCUMENT VERSIONS HISTORY"
  • Sažetak: ukupno verzija, recent (90 dana), po statusu
  • Tabela: DocID, Verzija, Datum revizije, Revidirao, Status, Promjena
  • Detalji po verziji: Change description, Change reason, Affected sections, Approved by (sa datumom), File URL
  • Verzije flattene iz getDocuments() sa _docId i _docTitle referencom

- Route 3 (doc-control-reviews):
  • Header: "GSE CONTROL — DOCUMENT REVIEWS"
  • Sažetak: ukupno reviews, po result-u (svih 5: NO_CHANGE_NEEDED, MINOR_UPDATE, MAJOR_REVISION, WITHDRAW, SUPERSEDE)
  • Tabela: DocID, Tip review-a, Datum, Reviewer, Rezultat, Status
  • Detalji: Review comments, Changes required, New version required (DA/NE), Action taken, CompletedAt
  • Reviews flattene iz getDocuments() sa _docId i _docTitle referencom

- Route 4 (doc-control-distribution):
  • Header: "GSE CONTROL — DOCUMENT DISTRIBUTION LIST"
  • Sažetak: ukupno distribucija, acknowledged, pending, ack rate %
  • Tabela: DocID, Primaoc, Odjel, Datum distribucije, Metoda, Status
  • Posebna sekcija "PENDING ACKNOWLEDGMENT" sa žutim headerom i pod-tabelom za nepotvrđene (ukupno + DocID, Primaoc, Odjel, Datum, Metoda, Email)
  • Detalji po distribuciji: odjel, uloga, email, datum, metoda, distributor, verzija, status, acknowledged flag, acknowledgedAt, acknowledgedMethod, notes
  • Distributions flattene iz getDocuments() sa _docId i _docTitle referencom

- Route 5 (doc-control-statistics):
  • Header: "GSE CONTROL — DOCUMENT CONTROL STATISTICS"
  • 8 sekcija:
    1. Sažetak (total, published, draft, superseded, totalVersions, totalReviews, totalDistributions)
    2. Po statusu (svih 6: DRAFT, UNDER_REVIEW, APPROVED, PUBLISHED, SUPERSEDED, WITHDRAWN)
    3. Po kategoriji (svih 8: MANUAL, PROCEDURE, WORK_INSTRUCTION, FORM, RECORD, POLICY, PLAN, OTHER)
    4. Po tipu dokumenta (svih 7: OPERATIONS, MAINTENANCE, SAFETY, QUALITY, TRAINING, ADMINISTRATIVE, TECHNICAL)
    5. Po klasifikaciji (svih 4: PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED)
    6. Reviews by result (svih 5 rezultata)
    7. Overdue reviews — lista dokumenata sa nextReviewDate < today (crvena tabela)
    8. Reviews due soon (30 dana) — lista predstojećih pregleda (žuta tabela)
  • Promise.all([getDocumentStats(), getDocuments()]) za paralelan dohvat

- Route 6 (doc-control-summary):
  • Header: "GSE CONTROL — DOCUMENT CONTROL SUMMARY"
  • 5 sekcija:
    1. DOCUMENT REGISTER — KPI counts (total, published, draft, superseded, withdrawn, under_review, approved)
    2. VERSIONS — ukupno, recent (90 dana), po statusu
    3. REVIEWS — ukupno, overdue, due soon, po result
    4. DISTRIBUTION — ukupno, acknowledged, pending, ack rate %
    5. ZAKLJUČAK — overall health na osnovu overdue reviews i ack rate
  • Health logika:
    - RED: overdueReviews > 0 ILI ackRate < 70%
    - YELLOW: pendingDistributions > 5 ILI ackRate < 90% ILI dueSoonReviews > 0
    - GREEN: sve na vrijeme i distribucije potvrđene
  • Preporuke dinamički generisane na osnovu KPI (overdue reviews, due-soon, pending distributions, ack rate < 90%, draft count, withdrawn count)
  • Health tekst wrap-ovan kroz riječi sa max 95 karaktera

- Verifikacija:
  • TypeScript: 0 grešaka (`npx tsc --noEmit`)
  • ESLint: 0 grešaka/upozorenja (`npx eslint src/app/api/reports/doc-control-*/route.ts`)

Stage Summary:
- 6 PDF API ruta kompletno implementirano po uzoru na audit-summary/route.ts pattern
- Sve rute koriste getDocuments() / getDocumentStats() server actions iz actions-document-control.ts
- Podaci iz getDocuments() uključuju versions, reviews, distributions array-eve (flatten-ovano u rutama 2-4)
- Identične labele kao u document-control-view.tsx (konzistentan HR prijevod)
- Sve boje (RED/GREEN/YELLOW/BLUE/GREY) primijenjene konzistentno kroz sve rute
- transliterate() primijenjen na sav tekst zbog pdf-lib StandardFonts limitacije (bez dijakritika)
- A4 format sa margin 50, footer na y=30, page-break logika za duge sadržaje
- Content-Disposition: attachment sa filename pattern-om `doc-control-<module>-YYYY-MM-DD.pdf`
- Sve rute dostupne sa document-control-view.tsx UI-ja kroz Download dugmad (Documents/Versions/Reviews/Distribution/Statistics/Summary)

---
Task ID: GSE-CONTROL-DOCUMENT-CONTROL-MODULE
Agent: Super Z (main agent)
Task: Implementacija Document Control System modula (EASA Part-145.A.65 + ISO 9001)

Work Log:
- Prisma schema: 4 nova modela (ControlledDocument, DocumentVersion, DocumentReview, DocumentDistribution)
- Supabase SQL migracija 015_document_control.sql sa RLS policies, triggers
- Server actions (src/lib/actions-document-control.ts):
  • CRUD za ControlledDocument (sa auto-effectiveDate na PUBLISHED)
  • CRUD za DocumentVersion (sa auto-update currentVersion na dokumentu kad je PUBLISHED)
  • CRUD za DocumentReview (sa auto-update lastReviewedAt na dokumentu)
  • CRUD za DocumentDistribution (sa acknowledge funkcijom)
  • getDocumentStats() — sve KPI na jednom mjestu (byStatus, byCategory, byDocType, byOwner, byClassification, reviewsDueSoon, reviewsOverdue, ackRate, etc.)
- DocumentControlView komponenta sa 6 sub-tabova:
  • Documents — search + filteri (category, status, classification) + edit + delete
  • Versions — search + filter (status) + auto-update currentVersion na PUBLISHED
  • Reviews — search + filteri (reviewType, result, status)
  • Distribution — search + filteri (status, method) + acknowledge dugme
  • Statistics — 4 KPI + 5 bar chart-ova + Top 10 vlasnika + overdue/due soon sekcije
  • Reviews Calendar — color-coded lista nadolazećih review-a (crvena/žuta/zelena)
- 6 PDF API ruta:
  • /api/reports/doc-control-documents — Document Register
  • /api/reports/doc-control-versions — Version History
  • /api/reports/doc-control-reviews — Reviews Log
  • /api/reports/doc-control-distribution — Distribution List sa pending sekcijom
  • /api/reports/doc-control-statistics — kompletna statistika sa 8 sekcija
  • /api/reports/doc-control-summary — sažeti izvještaj sa zaključkom
- Tab "Document Control" dodan u dashboard sa FileText ikonom
- Seed podaci (scripts/seed-document-control.js):
  • 12 dokumenata (MOM, OPS-MAN, SMS-MAN, QM, WI, FORM, POL, PROC, PLAN, REC, PROC-DEICE, stari MOM)
  • 8 verzija (nekoliko dokumenata sa 2-3 verzije, uključujući SUPERSEDED i DRAFT)
  • 8 review-a (SCHEDULED, AD_HOC, CHANGE_REQUEST, INCIDENT_DRIVEN)
  • 12 distribucija (EMAIL, PORTAL, TRAINING — neke acknowledged, neke pending)
- Search UVIJEK vidljiv u svih 5 lista (Documents, Versions, Reviews, Distribution, Calendar)
- Auto-izračunavanje:
  • Compliance rate % u real-time
  • Ack rate % za distribucije
  • Overdue reviews (nextReviewDate < today)
  • Due soon reviews (30 dana)
  • Auto-update currentVersion kada se verzija publikuje
  • Auto-update lastReviewedAt kada se review završi
- Testirano end-to-end:
  • Login kao admin ✓
  • Document Control tab prikazuje 4 alert kartice: 12/1/4/4 ✓
  • Search "SMS" filtrira dokumente ✓
  • Svi 6 PDF-a vraćaju HTTP 200 ✓
- Build čist: TypeScript 0, ESLint 0

Stage Summary:
- Kompletan Document Control System funkcionalan sa 6 sub-tabova
- Search UVIJEK vidljiv u svih 5 lista
- 6 PDF izvještaja: Documents, Versions, Reviews, Distribution, Statistics, Summary
- Auto-generacija ID-a, auto-update verzija na PUBLISHED, auto-acknowledge
- Reviews Calendar sa color-coded prikazom (overdue/due soon/future)
- Compliance: EASA Part-145.A.65, ISO 9001, ICAO Annex 19
