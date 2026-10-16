-- 037: Radionica - status "Čeka dio" sa očekivanim datumom (upozorenje 3 dana bez statusa se ne pali dok datum nije prošao).
-- Pokrenuti ručno u Supabase SQL editoru (nakon 036). Bezbjedno za ponovno pokretanje.
alter table public.damage_reports
  add column if not exists waiting_part_until date;
