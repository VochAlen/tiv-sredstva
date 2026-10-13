-- 031: vremenski uslovi u trenutku prijave (FOD i wildlife) - za statistiku po uslovima
-- Idempotentno. Stare prijave ostaju bez uslova (u statistici "Nije upisano").

alter table public.wildlife_reports add column if not exists weather text;
alter table public.fod_reports      add column if not exists weather text;

alter table public.wildlife_reports drop constraint if exists wildlife_reports_weather_check;
alter table public.wildlife_reports add constraint wildlife_reports_weather_check
  check (weather is null or weather in ('SUNNY', 'CLOUDY', 'RAIN', 'WIND', 'FOG', 'SNOW', 'ICE', 'STORM'));

alter table public.fod_reports drop constraint if exists fod_reports_weather_check;
alter table public.fod_reports add constraint fod_reports_weather_check
  check (weather is null or weather in ('SUNNY', 'CLOUDY', 'RAIN', 'WIND', 'FOG', 'SNOW', 'ICE', 'STORM'));
