-- =====================================================
-- GSE Control - Migration 010: Fuel/Charging + Parking Management
-- =====================================================

-- 1. Dodaj fuel polja na equipment
alter table public.equipment
  add column if not exists fuel_type text,
  add column if not exists fuel_level numeric,
  add column if not exists fuel_capacity numeric,
  add column if not exists low_fuel_threshold numeric default 20;

-- 2. Fuel logs
create table if not exists public.fuel_logs (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid references public.equipment(id) on delete cascade,
  equipment_code text not null,
  equipment_name text not null,

  fuel_type text not null,
  amount numeric not null,
  unit text default 'L',

  level_before numeric,
  level_after numeric,

  pump_station text,
  cost_per_unit numeric,
  total_cost numeric,

  operator_card_id text not null,
  operator_name text not null,

  fueled_at timestamptz default now(),
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_fuel_equipment on public.fuel_logs(equipment_id);
create index if not exists idx_fuel_date on public.fuel_logs(fueled_at desc);
create index if not exists idx_fuel_type on public.fuel_logs(fuel_type);

alter table public.fuel_logs enable row level security;

drop policy if exists "FuelLogs: public read" on public.fuel_logs;
create policy "FuelLogs: public read" on public.fuel_logs for select using (true);

drop policy if exists "FuelLogs: public insert" on public.fuel_logs;
create policy "FuelLogs: public insert" on public.fuel_logs for insert with check (true);

drop policy if exists "FuelLogs: engineer+ update" on public.fuel_logs;
create policy "FuelLogs: engineer+ update" on public.fuel_logs for update using (public.current_user_role() in ('engineer','admin'));

-- 3. Parking confirmations (AHM 1115)
create table if not exists public.parking_confirmations (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid references public.equipment(id) on delete cascade,
  equipment_code text not null,
  equipment_name text not null,

  operator_card_id text not null,
  operator_name text not null,

  parked_at_designated_spot boolean default false,
  handbrake_engaged boolean default false,
  ignition_off boolean default false,
  lights_off boolean default false,
  key_removed boolean default false,
  chocks_placed boolean default false,

  parking_location text,
  photo_url text,

  assignment_id text,

  all_confirmed boolean default false,
  issues_reported text,

  confirmed_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_park_equipment on public.parking_confirmations(equipment_id);
create index if not exists idx_park_date on public.parking_confirmations(confirmed_at desc);
create index if not exists idx_park_operator on public.parking_confirmations(operator_card_id);

alter table public.parking_confirmations enable row level security;

drop policy if exists "Parking: public read" on public.parking_confirmations;
create policy "Parking: public read" on public.parking_confirmations for select using (true);

drop policy if exists "Parking: public insert" on public.parking_confirmations;
create policy "Parking: public insert" on public.parking_confirmations for insert with check (true);

-- 4. Seed fuel data na opremu
update public.equipment set fuel_type = 'DIESEL', fuel_level = 75, fuel_capacity = 150 where code = 'GSE-TOW-001' and fuel_type is null;
update public.equipment set fuel_type = 'DIESEL', fuel_level = 45, fuel_capacity = 100 where code = 'GSE-TOW-002' and fuel_type is null;
update public.equipment set fuel_type = 'DIESEL', fuel_level = 15, fuel_capacity = 80 where code = 'GSE-GPU-003' and fuel_type is null;
update public.equipment set fuel_type = 'ELECTRIC', fuel_level = 60, fuel_capacity = 40 where code = 'GSE-BLT-001' and fuel_type is null;
update public.equipment set fuel_type = 'ELECTRIC', fuel_level = 80, fuel_capacity = 40 where code = 'GSE-BUS-001' and fuel_type is null;
update public.equipment set fuel_type = 'DIESEL', fuel_level = 90, fuel_capacity = 120 where code = 'GSE-PB-001' and fuel_type is null;

-- 5. Seed demo fuel logs
insert into public.fuel_logs (equipment_id, equipment_code, equipment_name, fuel_type, amount, unit, level_before, level_after, pump_station, cost_per_unit, total_cost, operator_card_id, operator_name, fueled_at)
select id, code, name, 'DIESEL', 45, 'L', 30, 75, 'Pump 1', 1.65, 74.25, 'EMP-1003', 'Novak Knežević', '2026-02-10'::timestamptz
from public.equipment where code = 'GSE-TOW-001'
and not exists (select 1 from public.fuel_logs where equipment_code = 'GSE-TOW-001');

insert into public.fuel_logs (equipment_id, equipment_code, equipment_name, fuel_type, amount, unit, level_before, level_after, pump_station, cost_per_unit, total_cost, operator_card_id, operator_name, fueled_at)
select id, code, name, 'ELECTRIC', 25, 'kWh', 35, 60, 'Charger A', 0.12, 3.00, 'EMP-1001', 'Vukan Vojvodić', '2026-02-12'::timestamptz
from public.equipment where code = 'GSE-BLT-001'
and not exists (select 1 from public.fuel_logs where equipment_code = 'GSE-BLT-001');

-- 6. Seed demo parking confirmation
insert into public.parking_confirmations (equipment_id, equipment_code, equipment_name, operator_card_id, operator_name, parked_at_designated_spot, handbrake_engaged, ignition_off, lights_off, key_removed, parking_location, all_confirmed, confirmed_at)
select id, code, name, 'EMP-1001', 'Vukan Vojvodić', true, true, true, true, true, 'Stand A1 - Position 3', true, '2026-02-10'::timestamptz
from public.equipment where code = 'GSE-TOW-001'
and not exists (select 1 from public.parking_confirmations where equipment_code = 'GSE-TOW-001');

comment on table public.fuel_logs is 'Fuel/Charging management — točenje goriva i punjenje';
comment on table public.parking_confirmations is 'AHM 1115 — GSE Parking Management';
