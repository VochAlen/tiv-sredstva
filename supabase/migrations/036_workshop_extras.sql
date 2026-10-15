-- 036: Radionica - test nakon popravke, eksterni servis, dijelovi iz magacina na radnom nalogu, očitanja brojila.
-- Pokrenuti ručno u Supabase SQL editoru (nakon 035). Bezbjedno za ponovno pokretanje.

-- 1) Prijava kvara: probni rad / funkcionalni test prije puštanja u rad + eksterni servis
alter table public.damage_reports
  add column if not exists test_done              boolean,
  add column if not exists test_note              text,
  add column if not exists test_at                timestamptz,
  add column if not exists test_by                text,
  add column if not exists external_provider      text,
  add column if not exists external_ref           text,
  add column if not exists external_sent_at       timestamptz,
  add column if not exists external_expected_at   date,
  add column if not exists external_returned_at   timestamptz;

-- 2) Istorija popravke: novi tipovi događaja (vanjski servis)
alter table public.repair_status_log drop constraint if exists repair_status_log_kind_check;
alter table public.repair_status_log add constraint repair_status_log_kind_check
  check (kind in ('TAKEN', 'ARRIVED', 'STATUS', 'CHIEF_OK', 'CHIEF_FAILED', 'HANDOVER', 'EXTERNAL_SENT', 'EXTERNAL_BACK'));

-- 3) Utrošak dijelova vezan za prijavu kvara (radni nalog skida zalihu iz magacina)
alter table public.part_consumption
  add column if not exists damage_id uuid references public.damage_reports(id) on delete set null;
create index if not exists idx_consumption_damage on public.part_consumption (damage_id);

-- 4) Očitanja brojila (km / radni sati) unesena pri razduženju
create table if not exists public.meter_readings (
  id             uuid primary key default gen_random_uuid(),
  equipment_id   uuid not null references public.equipment(id) on delete cascade,
  equipment_code text not null,
  km             numeric,
  hours          numeric,
  by_name        text not null,
  by_card_id     text,
  source         text not null default 'CHECK_IN',
  at             timestamptz not null default now()
);
create index if not exists meter_readings_eq_idx on public.meter_readings (equipment_id, at desc);

alter table public.meter_readings enable row level security;
drop policy if exists "Meter: engineer+ read" on public.meter_readings;
create policy "Meter: engineer+ read" on public.meter_readings for select
  using (public.current_user_role() in ('engineer', 'admin'));
-- Upis radi server (service role) nakon provjere ID kartice radnika; anonimni korisnik nema direktan upis.
