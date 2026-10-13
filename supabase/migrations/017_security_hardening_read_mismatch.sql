-- =====================================================
-- 017: Security hardening (dio 2) - RLS "public read" politike koje
-- su u suprotnosti sa namjerom aplikacionog sloja.
--
-- NALAZ: za fuel_logs, parking_confirmations i incidents, migracije
-- 009/010 su dodale "public read" (SELECT USING (true)) politike, ALI
-- odgovarajuće server akcije (getFuelLogs, getFuelStats,
-- getParkingConfirmations, getParkingStats, getIncidents,
-- getIncidentStats, updateIncident u src/lib/actions-fuel-parking.ts
-- i actions-incidents.ts) VEĆ zahtijevaju requireRole(['engineer',
-- 'admin']) prije čitanja - znači namjera je da ovi podaci (troškovi
-- goriva, parking fotografije/lokacije, detalji incidenata sa
-- povredama i procjenom štete) budu vidljivi samo prijavljenom
-- osoblju. RLS politika na nivou tabele je bila šira od stvarne
-- namjere i omogućavala direktan anon REST pristup mimo app-layer
-- provjere - isti obrazac kao u migraciji 016, ali ovdje je public
-- INSERT namjerno ostao (radnici toče gorivo/parkiraju/prijavljuju
-- incident bez login-a), pa SELECT i INSERT moraju biti razdvojeni.
--
-- Napomena: za razliku od migracije 016 (gdje je i INSERT bio
-- pogrešno otvoren), ovdje tabele i dalje MORAJU dozvoliti anon
-- INSERT (addFuelLog/addParkingConfirmation/createIncident su
-- namjerno javne funkcije). Problem je što anon INSERT + povučen
-- SELECT na istom upitu (".insert().select().single()") zahtijeva
-- SELECT dozvolu da bi vratio ID novog reda. Rješenje: aplikacija je
-- izmijenjena da generiše UUID unaprijed (crypto.randomUUID()) i
-- eksplicitno ga šalje u INSERT, umjesto da ga čita nazad - tako
-- SELECT može biti bezbjedno ograničen na authenticated bez da
-- pokvari anoniman unos (vidi actions-fuel-parking.ts, actions-incidents.ts).
-- =====================================================

-- ---------- FUEL LOGS ----------
DROP POLICY IF EXISTS "FuelLogs: public read" ON public.fuel_logs;
CREATE POLICY "FuelLogs: authenticated read" ON public.fuel_logs
  FOR SELECT TO authenticated USING (true);

-- ---------- PARKING CONFIRMATIONS ----------
DROP POLICY IF EXISTS "Parking: public read" ON public.parking_confirmations;
CREATE POLICY "Parking: authenticated read" ON public.parking_confirmations
  FOR SELECT TO authenticated USING (true);

-- ---------- INCIDENTS ----------
DROP POLICY IF EXISTS "Incidents: public read" ON public.incidents;
CREATE POLICY "Incidents: authenticated read" ON public.incidents
  FOR SELECT TO authenticated USING (true);

-- =====================================================
-- Bonus fix: app_settings seed red je imao pogrešan default naziv
-- aerodroma ("Aerodrom Podgorica" / "TGD") ostao iz šablona - ova
-- aplikacija je za Aerodrom Tivat (TIV/LYTV). Ne mijenja se ako je
-- admin već ručno postavio druge vrijednosti (provjera na stare
-- default vrijednosti, ne bezuslovni UPDATE).
-- =====================================================
UPDATE public.app_settings
SET airport_name = 'Aerodrom Tivat', airport_code = 'TIV'
WHERE id = 1 AND airport_name = 'Aerodrom Podgorica' AND airport_code = 'TGD';
