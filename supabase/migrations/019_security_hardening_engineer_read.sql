-- =====================================================
-- 019: Security hardening (dio 3) - RLS "authenticated read" politike
-- koje su šire od stvarne namjere aplikacionog sloja.
--
-- NALAZ: za equipment_components, service_bulletins,
-- airworthiness_directives, shift_handovers (migracija 003) i
-- spare_parts, part_purchases, part_consumption (migracija 008),
-- RLS SELECT politika je "authenticated read" - dozvoljava BILO KOJOJ
-- prijavljenoj roli (uključujući 'operator') da čita podatke direktno
-- preko REST-a. Međutim, odgovarajuće server akcije u
-- src/lib/actions-easa.ts i src/lib/actions-scheduling.ts (getComponents,
-- getServiceBulletins, getAirworthinessDirectives, getShiftHandovers,
-- getSpareParts, getPartPurchases, getPartConsumption, getCostSummary)
-- VEĆ zahtijevaju requireRole(['engineer', 'admin']) - ovo su
-- EASA Part-145/Part-M inženjerski podaci (life-limited komponente,
-- service bulletins, airworthiness directives, rezervni djelovi i
-- troškovi) namijenjeni samo inženjerskom/admin osoblju, ne operatorima.
--
-- Isti obrazac kao u migracijama 016/017: RLS politika na nivou tabele
-- je bila širа od stvarne namjere app-layer provjere. Ovdje se SELECT
-- politika sužava sa "authenticated" na "engineer+", u skladu sa već
-- postojećom "engineer+ write" politikom na istim tabelama (samo se
-- SELECT usklađuje sa WRITE-om, bez promjene ponašanja za engineer/admin).
--
-- shift_handovers: createShiftHandover() u actions-easa.ts nije trenutno
-- povezan sa UI-jem (nema poziva iz komponenti), pa se INSERT politika
-- ("authenticated insert") ne mijenja ovom migracijom - ostavljeno kao
-- napomena za budući rad ako se ta funkcija poveže sa worker flow-om.
-- =====================================================

-- ---------- EASA: equipment_components ----------
DROP POLICY IF EXISTS "Components: authenticated read" ON public.equipment_components;
CREATE POLICY "Components: engineer+ read" ON public.equipment_components
  FOR SELECT USING (public.current_user_role() IN ('engineer', 'admin'));

-- ---------- EASA: service_bulletins ----------
DROP POLICY IF EXISTS "ServiceBulletins: authenticated read" ON public.service_bulletins;
CREATE POLICY "ServiceBulletins: engineer+ read" ON public.service_bulletins
  FOR SELECT USING (public.current_user_role() IN ('engineer', 'admin'));

-- ---------- EASA: airworthiness_directives ----------
DROP POLICY IF EXISTS "ADs: authenticated read" ON public.airworthiness_directives;
CREATE POLICY "ADs: engineer+ read" ON public.airworthiness_directives
  FOR SELECT USING (public.current_user_role() IN ('engineer', 'admin'));

-- ---------- EASA: shift_handovers (samo SELECT; vidi napomenu gore) ----------
DROP POLICY IF EXISTS "ShiftHandovers: authenticated read" ON public.shift_handovers;
CREATE POLICY "ShiftHandovers: engineer+ read" ON public.shift_handovers
  FOR SELECT USING (public.current_user_role() IN ('engineer', 'admin'));

-- ---------- Scheduling: spare_parts ----------
DROP POLICY IF EXISTS "Parts: authenticated read" ON public.spare_parts;
CREATE POLICY "Parts: engineer+ read" ON public.spare_parts
  FOR SELECT USING (public.current_user_role() IN ('engineer', 'admin'));

-- ---------- Scheduling: part_purchases ----------
DROP POLICY IF EXISTS "Purchases: authenticated read" ON public.part_purchases;
CREATE POLICY "Purchases: engineer+ read" ON public.part_purchases
  FOR SELECT USING (public.current_user_role() IN ('engineer', 'admin'));

-- ---------- Scheduling: part_consumption ----------
DROP POLICY IF EXISTS "Consumption: authenticated read" ON public.part_consumption;
CREATE POLICY "Consumption: engineer+ read" ON public.part_consumption
  FOR SELECT USING (public.current_user_role() IN ('engineer', 'admin'));
