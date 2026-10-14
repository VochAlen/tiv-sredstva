-- 032: eksterni serviseri + redovni servisni plan (km / radni sati / najmanje jednom godišnje)
-- Idempotentno.

alter table public.equipment add column if not exists externally_maintained boolean not null default false;
alter table public.equipment add column if not exists service_provider text;
alter table public.equipment add column if not exists service_provider_phone text;
alter table public.equipment add column if not exists service_provider_email text;
alter table public.equipment add column if not exists service_interval_km numeric;
alter table public.equipment add column if not exists service_interval_hours numeric;
alter table public.equipment add column if not exists service_interval_months int not null default 12;
alter table public.equipment add column if not exists last_service_date date;
alter table public.equipment add column if not exists last_service_km numeric;
alter table public.equipment add column if not exists last_service_hours numeric;
alter table public.equipment add column if not exists service_notified_at timestamptz;
alter table public.equipment add column if not exists service_notified_status text;

alter table public.equipment drop constraint if exists equipment_service_interval_months_check;
alter table public.equipment add constraint equipment_service_interval_months_check
  check (service_interval_months between 1 and 12);

create table if not exists public.service_records (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  equipment_code text not null,
  performed_at date not null,
  km numeric,
  hours numeric,
  performed_by text not null default 'INTERNAL' check (performed_by in ('INTERNAL', 'EXTERNAL')),
  provider text,
  invoice_no text,
  cost numeric,
  notes text,
  recorded_by text,
  created_at timestamptz not null default now()
);
create index if not exists service_records_equipment_idx on public.service_records (equipment_id, performed_at desc);

alter table public.service_records enable row level security;
drop policy if exists "ServiceRecords: engineer+ read" on public.service_records;
create policy "ServiceRecords: engineer+ read" on public.service_records for select
  using (public.current_user_role() in ('engineer', 'admin'));
drop policy if exists "ServiceRecords: engineer+ write" on public.service_records;
create policy "ServiceRecords: engineer+ write" on public.service_records for all
  using (public.current_user_role() in ('engineer', 'admin'))
  with check (public.current_user_role() in ('engineer', 'admin'));

-- Ključ/vrijednost podešavanja obavještenja (npr. email adrese šefa tehničke službe).
-- (postojeća app_settings je singleton tabela, zato posebna tabela)
create table if not exists public.notification_settings (
  key text primary key,
  value text,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.notification_settings enable row level security;
drop policy if exists "NotificationSettings: admin all" on public.notification_settings;
create policy "NotificationSettings: admin all" on public.notification_settings for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
