-- =====================================================
-- GSE Control - Migration 005: Vehicle Operating Manuals
-- EASA Part-145 §65 - Operating manuals per equipment
-- =====================================================

-- 1. Dodaj manualUrl na equipment
alter table public.equipment
  add column if not exists manual_url text;

-- 2. Kreiraj equipment_manuals tabelu
create table if not exists public.equipment_manuals (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid references public.equipment(id) on delete cascade,
  equipment_code text,
  equipment_name text,
  equipment_type text not null,

  title text not null,
  manual_url text not null,
  manual_type text default 'OPERATING' check (manual_type in ('OPERATING', 'MAINTENANCE', 'SAFETY', 'PARTS')),
  language text default 'hr',
  file_size integer,
  uploaded_by text,
  version text,
  active boolean default true,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_manuals_equipment on public.equipment_manuals(equipment_id);
create index if not exists idx_manuals_type on public.equipment_manuals(equipment_type);
create index if not exists idx_manuals_manual_type on public.equipment_manuals(manual_type);

alter table public.equipment_manuals enable row level security;

-- Javno čitanje (radnici moraju vidjeti manuale bez login-a)
drop policy if exists "Manuals: public read" on public.equipment_manuals;
create policy "Manuals: public read"
  on public.equipment_manuals for select
  using (true);

-- Samo admin/inženjer mogu dodavati/uređivati manuale
drop policy if exists "Manuals: engineer+ write" on public.equipment_manuals;
create policy "Manuals: engineer+ write"
  on public.equipment_manuals for all
  using (public.current_user_role() in ('engineer', 'admin'))
  with check (public.current_user_role() in ('engineer', 'admin'));

-- 3. Seed demo manuali (po tipu opreme - fallback)
insert into public.equipment_manuals (equipment_type, title, manual_url, manual_type, language, version, active)
select 'TOW_TRACTOR', 'Goldhofer AST-2 Operating Manual', 'https://www.goldhofer.com/fileadmin/user_upload/Downloads/Products/AST-2_Manual.pdf', 'OPERATING', 'en', 'v3.0', true
where not exists (select 1 from public.equipment_manuals where equipment_type = 'TOW_TRACTOR' and title = 'Goldhofer AST-2 Operating Manual');

insert into public.equipment_manuals (equipment_type, title, manual_url, manual_type, language, version, active)
select 'GPU', 'ITW GSE 1400 GPU Manual', 'https://www.itwgse.com/products/gpu-1400/manual.pdf', 'OPERATING', 'en', 'v2.1', true
where not exists (select 1 from public.equipment_manuals where equipment_type = 'GPU' and title = 'ITW GSE 1400 GPU Manual');

insert into public.equipment_manuals (equipment_type, title, manual_url, manual_type, language, version, active)
select 'BELT_LOADER', 'TLD TB-150 Belt Loader Manual', 'https://www.tld-group.com/products/belt-loaders/tb-150/manual.pdf', 'OPERATING', 'en', 'v1.8', true
where not exists (select 1 from public.equipment_manuals where equipment_type = 'BELT_LOADER' and title = 'TLD TB-150 Belt Loader Manual');

insert into public.equipment_manuals (equipment_type, title, manual_url, manual_type, language, version, active)
select 'PUSHBACK', 'Goldhofer AST-1X Pushback Manual', 'https://www.goldhofer.com/fileadmin/user_upload/Downloads/Products/AST-1X_Manual.pdf', 'OPERATING', 'en', 'v2.5', true
where not exists (select 1 from public.equipment_manuals where equipment_type = 'PUSHBACK' and title = 'Goldhofer AST-1X Pushback Manual');

-- Sigurnosna uputstva po tipu
insert into public.equipment_manuals (equipment_type, title, manual_url, manual_type, language, version, active)
select 'TOW_TRACTOR', 'Tow Tractor Safety Procedures', 'https://example.com/safety/tow-tractor-safety.pdf', 'SAFETY', 'en', 'v1.0', true
where not exists (select 1 from public.equipment_manuals where equipment_type = 'TOW_TRACTOR' and manual_type = 'SAFETY');

comment on table public.equipment_manuals is 'EASA Part-145 §65 - Vehicle operating manuals per equipment or equipment type';
comment on column public.equipment.manual_url is 'Direct link to PDF manual (optional - use equipment_manuals table for multiple)';
