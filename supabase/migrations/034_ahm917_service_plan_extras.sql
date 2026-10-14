-- 034: dopuna programa održavanja po IATA AHM 917 (nadogradnja na 033_pm_ahm917.sql; zahtijeva 032 i 033)
--   service_program: IATA_4M = minor + minor + major (provjere 4 mj. / 500 h, veliki servis 12 mj. / 1500 h)
--                    IATA_6M = minor + major        (provjere 6 mj. / 750 h,  veliki servis 12 mj. / 1500 h)
--                    OEM     = intervali proizvođača (imaju prednost nad IATA ako postoje)
-- Idempotentno.

alter table public.equipment add column if not exists last_major_km numeric;
alter table public.equipment add column if not exists major_interval_months int;
alter table public.equipment add column if not exists major_interval_hours numeric;
alter table public.equipment add column if not exists major_interval_km numeric;
alter table public.equipment add column if not exists service_variation_note text; -- dogovorena (manje stroga) varijacija od OEM + oznaka dokumenta

alter table public.equipment drop constraint if exists equipment_major_interval_months_check;
alter table public.equipment add constraint equipment_major_interval_months_check
  check (major_interval_months is null or major_interval_months between 1 and 12);

-- Sredstva koja su po migraciji 032 već imala svoje km / sati intervale prelaze na OEM (da se ne izgube).
update public.equipment set service_program = 'OEM'
 where service_program is null and (service_interval_km is not null or service_interval_hours is not null);
