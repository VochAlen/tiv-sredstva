-- 033: IATA AHM 917 - program preventivnog održavanja (minor/major ciklus) + radni nalozi (PM check sheet)
-- Idempotentno. Zahtijeva 032.

alter table public.equipment add column if not exists service_program text;
alter table public.equipment drop constraint if exists equipment_service_program_check;
alter table public.equipment add constraint equipment_service_program_check
  check (service_program is null or service_program in ('IATA_4M', 'IATA_6M', 'OEM'));
alter table public.equipment add column if not exists last_major_date date;
alter table public.equipment add column if not exists last_major_hours numeric;
-- sekcije PM liste koje ne važe za ovo vozilo (zarezom razdvojeni id-evi), pamti se između naloga
alter table public.equipment add column if not exists pm_excluded_sections text;

alter table public.service_records add column if not exists kind text;
alter table public.service_records drop constraint if exists service_records_kind_check;
alter table public.service_records add constraint service_records_kind_check
  check (kind is null or kind in ('MINOR', 'MAJOR', 'OTHER'));

create table if not exists public.pm_work_orders (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  equipment_code text not null,
  checklist_type text not null,                       -- npr. STAIRS
  kind text not null check (kind in ('MINOR', 'MAJOR')),
  status text not null default 'OPEN' check (status in ('OPEN', 'DONE')),
  pm_based_on text,                                   -- 'HOURS' | 'MONTHS' | 'KM'
  meter_hours numeric,
  meter_km numeric,
  lead_mechanic text,
  additional_mechanic text,
  items jsonb not null default '[]'::jsonb,           -- [{k, s: OK|NOT_OK|FIXED|NA, c}]
  excluded_sections text,
  hours_worked numeric,
  parts_cost numeric,
  tire_cost numeric,
  comment text,
  defects_rectified boolean,
  serviceable boolean,
  issued_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by text,
  completed_by text
);
create index if not exists pm_work_orders_equipment_idx on public.pm_work_orders (equipment_id, issued_at desc);

alter table public.pm_work_orders enable row level security;
drop policy if exists "PmWorkOrders: engineer+ read" on public.pm_work_orders;
create policy "PmWorkOrders: engineer+ read" on public.pm_work_orders for select
  using (public.current_user_role() in ('engineer', 'admin'));
drop policy if exists "PmWorkOrders: engineer+ write" on public.pm_work_orders;
create policy "PmWorkOrders: engineer+ write" on public.pm_work_orders for all
  using (public.current_user_role() in ('engineer', 'admin'))
  with check (public.current_user_role() in ('engineer', 'admin'));
