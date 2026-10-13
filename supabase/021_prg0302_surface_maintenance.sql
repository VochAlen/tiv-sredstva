-- =====================================================
-- 021 - PRG.03.02 (Program tehničkog održavanja operativne površine) -
-- proširenje postojeće AerodromeInspection/InspectionFinding
-- infrastrukture umjesto građenja paralelnog sistema.
-- =====================================================

-- ---------------------------------------------------
-- 1. Ista klasa sigurnosne rupe kao ranije za equipment/damage_reports/
--    daily_inspections - "public" politike sa USING(true)/WITH CHECK(true),
--    ovdje čak i za DELETE. Za razliku od GSE checkout-a, OVDJE ne postoji
--    legitiman anon (bez logina) use-case - actions-inspection.ts već
--    zahtijeva requireAuth() na SVAKOJ mutaciji - pa je dovoljno pooštriti
--    RLS na "samo authenticated", bez potrebe za SECURITY DEFINER funkcijom.
-- ---------------------------------------------------

drop policy if exists "Public insert aero_inspections" on public.aerodrome_inspections;
drop policy if exists "Public update aero_inspections" on public.aerodrome_inspections;
drop policy if exists "Public delete aero_inspections" on public.aerodrome_inspections;
create policy "Aero inspections: authenticated insert" on public.aerodrome_inspections for insert with check (public.is_authenticated());
create policy "Aero inspections: authenticated update" on public.aerodrome_inspections for update using (public.is_authenticated());
create policy "Aero inspections: authenticated delete" on public.aerodrome_inspections for delete using (public.is_authenticated());
-- "Public read aero_inspections" (SELECT) ostaje - čitanje nije rizik.

drop policy if exists "Public insert findings" on public.inspection_findings;
drop policy if exists "Public update findings" on public.inspection_findings;
drop policy if exists "Public delete findings" on public.inspection_findings;
create policy "Findings: authenticated insert" on public.inspection_findings for insert with check (public.is_authenticated());
create policy "Findings: authenticated update" on public.inspection_findings for update using (public.is_authenticated());
create policy "Findings: authenticated delete" on public.inspection_findings for delete using (public.is_authenticated());

-- ---------------------------------------------------
-- 2. Strukturirani K-kodovnik + praćenje kroz vrijeme (umjesto ručnog
--    upoređivanja markirane pukotine na papiru staro 6 mjeseci)
-- ---------------------------------------------------

alter table public.inspection_findings
  add column if not exists length_m numeric,
  add column if not exists max_width_cm numeric,
  add column if not exists max_depth_cm numeric,
  add column if not exists location_code text,
  add column if not exists is_marked boolean not null default false,
  add column if not exists condition_rating text,
  add column if not exists fence_stub_from integer,
  add column if not exists fence_stub_to integer,
  add column if not exists tracking_group_id text;

create index if not exists idx_findings_tracking on public.inspection_findings(tracking_group_id);

-- inspection_type i category su već slobodan TEXT bez CHECK ograničenja
-- (potvrđeno u 012_aerodrome_inspection.sql) - nove vrijednosti
-- (RUNWAY_STRIP, TAXIWAY_STRIP, PARKING, DRAINAGE, FENCE, BUILDING,
-- WATER_SEWAGE, GREEN_AREA i K-kod kategorije) rade bez izmjene šeme.
