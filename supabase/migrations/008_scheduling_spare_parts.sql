-- =====================================================
-- GSE Control - Migration 008: Maintenance Scheduling + Spare Parts
-- =====================================================

-- 1. Dodaj km polja na equipment
alter table public.equipment
  add column if not exists total_km numeric default 0,
  add column if not exists maintenance_interval_km numeric default 10000,
  add column if not exists last_maintenance_km numeric default 0;

-- 2. Dodaj km triggere na maintenance_schedule
alter table public.maintenance_schedule
  add column if not exists trigger_km numeric,
  add column if not exists trigger_interval_km numeric,
  add column if not exists trigger_interval_months integer;

-- 3. Spare Parts — katalog rezervnih dijelova u magacinu
create table if not exists public.spare_parts (
  id uuid primary key default gen_random_uuid(),
  part_number text not null unique,
  name text not null,
  category text check (category in ('TIRE','BRAKE','HYDRAULIC','ELECTRICAL','FILTER','ENGINE','OTHER')),
  manufacturer text,
  description text,

  quantity integer default 0,
  min_quantity integer default 1,
  unit text default 'kom',
  location text,

  unit_price numeric,
  vat_rate numeric default 21,

  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_parts_category on public.spare_parts(category);
create index if not exists idx_parts_name on public.spare_parts(name);

alter table public.spare_parts enable row level security;

drop policy if exists "Parts: authenticated read" on public.spare_parts;
create policy "Parts: authenticated read"
  on public.spare_parts for select using (public.is_authenticated());

drop policy if exists "Parts: engineer+ write" on public.spare_parts;
create policy "Parts: engineer+ write"
  on public.spare_parts for all
  using (public.current_user_role() in ('engineer','admin'))
  with check (public.current_user_role() in ('engineer','admin'));

-- 4. Part Purchases — nabavka
create table if not exists public.part_purchases (
  id uuid primary key default gen_random_uuid(),
  part_id uuid,
  part_number text not null,
  part_name text not null,

  order_number text,
  supplier text not null,
  supplier_address text,
  invoice_number text,
  invoice_date date,

  quantity integer not null,
  unit_price_net numeric not null,
  vat_rate numeric default 21,
  vat_amount numeric default 0,
  total_net numeric not null,
  total_gross numeric not null,

  payment_method text,
  paid boolean default false,
  paid_date date,

  notes text,
  purchased_by text,
  created_at timestamptz default now()
);

create index if not exists idx_purchases_part on public.part_purchases(part_id);
create index if not exists idx_purchases_supplier on public.part_purchases(supplier);
create index if not exists idx_purchases_date on public.part_purchases(invoice_date desc);

alter table public.part_purchases enable row level security;

drop policy if exists "Purchases: authenticated read" on public.part_purchases;
create policy "Purchases: authenticated read"
  on public.part_purchases for select using (public.is_authenticated());

drop policy if exists "Purchases: engineer+ write" on public.part_purchases;
create policy "Purchases: engineer+ write"
  on public.part_purchases for all
  using (public.current_user_role() in ('engineer','admin'))
  with check (public.current_user_role() in ('engineer','admin'));

-- 5. Part Consumption — utrošak
create table if not exists public.part_consumption (
  id uuid primary key default gen_random_uuid(),
  part_id uuid,
  part_number text not null,
  part_name text not null,

  equipment_id uuid,
  equipment_code text,
  maintenance_log_id uuid,

  quantity integer default 1,
  unit_price_net numeric,
  total_cost numeric,

  consumed_by text,
  consumed_at timestamptz default now(),
  notes text
);

create index if not exists idx_consumption_part on public.part_consumption(part_id);
create index if not exists idx_consumption_equipment on public.part_consumption(equipment_id);
create index if not exists idx_consumption_date on public.part_consumption(consumed_at desc);

alter table public.part_consumption enable row level security;

drop policy if exists "Consumption: authenticated read" on public.part_consumption;
create policy "Consumption: authenticated read"
  on public.part_consumption for select using (public.is_authenticated());

drop policy if exists "Consumption: engineer+ write" on public.part_consumption;
create policy "Consumption: engineer+ write"
  on public.part_consumption for all
  using (public.current_user_role() in ('engineer','admin'))
  with check (public.current_user_role() in ('engineer','admin'));

-- 6. Seed demo rezervni dijelovi
insert into public.spare_parts (part_number, name, category, manufacturer, quantity, min_quantity, unit, location, unit_price, vat_rate)
select 'TIRE-11225', 'Prednja guma 11x22.5', 'TIRE', 'Michelin', 4, 2, 'kom', 'Polica A-1', 450.00, 21
where not exists (select 1 from public.spare_parts where part_number = 'TIRE-11225');

insert into public.spare_parts (part_number, name, category, manufacturer, quantity, min_quantity, unit, location, unit_price, vat_rate)
select 'OIL-5W40-20L', 'Ulvo Motul 5W-40 20L', 'FILTER', 'Motul', 6, 3, 'litar', 'Polica B-2', 8.50, 21
where not exists (select 1 from public.spare_parts where part_number = 'OIL-5W40-20L');

insert into public.spare_parts (part_number, name, category, manufacturer, quantity, min_quantity, unit, location, unit_price, vat_rate)
select 'FILTER-OEM-12345', 'Filter ulja OEM-12345', 'FILTER', 'Bosch', 8, 4, 'kom', 'Polica B-3', 35.00, 21
where not exists (select 1 from public.spare_parts where part_number = 'FILTER-OEM-12345');

insert into public.spare_parts (part_number, name, category, manufacturer, quantity, min_quantity, unit, location, unit_price, vat_rate)
select 'BRAKE-PAD-001', 'Kočione pločice prednje', 'BRAKE', 'Brembo', 2, 2, 'kom', 'Polica C-1', 120.00, 21
where not exists (select 1 from public.spare_parts where part_number = 'BRAKE-PAD-001');

-- 7. Seed demo nabavka
insert into public.part_purchases (part_id, part_number, part_name, order_number, supplier, invoice_number, invoice_date, quantity, unit_price_net, vat_rate, vat_amount, total_net, total_gross, payment_method, paid)
select sp.id, 'TIRE-11225', 'Prednja guma 11x22.5', 'PO-2026-001', 'Michelin Crna Gora', 'INV-2026-001', '2026-01-15'::date, 4, 450.00, 21, 378.00, 1800.00, 2178.00, 'INVOICE', true
from public.spare_parts sp where sp.part_number = 'TIRE-11225'
and not exists (select 1 from public.part_purchases where part_number = 'TIRE-11225');

comment on table public.spare_parts is 'Spare parts inventory — katalog i stanje u magacinu';
comment on table public.part_purchases is 'Part purchases — nabavka sa PDV razradom';
comment on table public.part_consumption is 'Part consumption — utrošak rezervnih dijelova';
