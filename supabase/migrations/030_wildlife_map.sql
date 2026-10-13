-- 030: Wildlife - lokacija na mapi aerodroma (zona + tačka) i šifra vrste (za heatmapu)
-- Idempotentno. Stare prijave ostaju bez zone/koordinata (heatmapa ih prepoznaje po tekstu vrste).

alter table public.wildlife_reports add column if not exists zone text;
alter table public.wildlife_reports add column if not exists map_x numeric;
alter table public.wildlife_reports add column if not exists map_y numeric;
alter table public.wildlife_reports add column if not exists species_code text;

alter table public.wildlife_reports drop constraint if exists wildlife_reports_zone_check;
alter table public.wildlife_reports add constraint wildlife_reports_zone_check
  check (zone is null or zone in ('RWY_1', 'RWY_2', 'RWY_3', 'TWY', 'APRON', 'SURROUNDING'));

alter table public.wildlife_reports drop constraint if exists wildlife_reports_map_check;
alter table public.wildlife_reports add constraint wildlife_reports_map_check
  check ((map_x is null or (map_x >= 0 and map_x <= 1)) and (map_y is null or (map_y >= 0 and map_y <= 1)));

create index if not exists idx_wildlife_zone on public.wildlife_reports(zone);
