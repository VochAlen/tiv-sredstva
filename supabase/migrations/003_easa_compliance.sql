-- =====================================================
-- GSE Control - Migration 003: EASA Part-145 Compliance + Worker PIN
-- Dodaje: worker PIN (no-login), life-limited components,
-- service bulletins, airworthiness directives, shift handovers
-- =====================================================

-- =====================================================
-- 1. EMPLOYEES - dodaj PIN za no-login identifikaciju
-- =====================================================
alter table public.employees
  add column if not exists pin text,
  add column if not exists id_card_qr text;  -- QR kod na ID kartici (npr. "EMP-1001")

-- Index za brzo pretraživanje po PIN-u
create index if not exists idx_employees_pin on public.employees(pin) where pin is not null;
create index if not exists idx_employees_card_id on public.employees(card_id);

-- Seed PIN-ove za demo radnike (4-cifreni)
update public.employees set pin = '1001', id_card_qr = 'EMP-1001' where card_id = 'EMP-1001';
update public.employees set pin = '1002', id_card_qr = 'EMP-1002' where card_id = 'EMP-1002';
update public.employees set pin = '1003', id_card_qr = 'EMP-1003' where card_id = 'EMP-1003';
update public.employees set pin = '1004', id_card_qr = 'EMP-1004' where card_id = 'EMP-1004';
update public.employees set pin = '1005', id_card_qr = 'EMP-1005' where card_id = 'EMP-1005';

-- =====================================================
-- 2. EQUIPMENT_COMPONENTS - life-limited parts (EASA Part-145 §50)
-- Prati komponente sa ograničenim vijekom (gume, kablovi, hidraulika...)
-- =====================================================
create table if not exists public.equipment_components (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid references public.equipment(id) on delete cascade,
  equipment_code text not null,

  component_name text not null,  -- npr. "Prednja guma lijevo"
  component_type text not null check (component_type in ('TIRE', 'CABLE', 'HYDRAULIC', 'BRAKE', 'ENGINE', 'BATTERY', 'OTHER')),

  serial_number text,
  manufacturer text,

  -- Life tracking
  installed_at date,
  installed_hours numeric default 0,  -- radni sati pri instalaciji
  life_limit_hours numeric,  -- max sati rada (null = neograničeno)
  life_limit_cycles numeric,  -- max ciklusa (npr. broj vožnji)
  current_hours numeric default 0,
  current_cycles numeric default 0,

  -- Status
  status text default 'ACTIVE' check (status in ('ACTIVE', 'REPLACED', 'INSPECT')),

  replaced_at date,
  replaced_by text,
  replacement_cost numeric,

  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_components_equipment on public.equipment_components(equipment_id);
create index if not exists idx_components_status on public.equipment_components(status);
create index if not exists idx_components_type on public.equipment_components(component_type);

alter table public.equipment_components enable row level security;

drop policy if exists "Components: authenticated read" on public.equipment_components;
create policy "Components: authenticated read"
  on public.equipment_components for select
  using (public.is_authenticated());

drop policy if exists "Components: engineer+ write" on public.equipment_components;
create policy "Components: engineer+ write"
  on public.equipment_components for all
  using (public.current_user_role() in ('engineer', 'admin'))
  with check (public.current_user_role() in ('engineer', 'admin'));

-- =====================================================
-- 3. SERVICE_BULLETINS - obavijesti proizvođača (Part-145 §71)
-- =====================================================
create table if not exists public.service_bulletins (
  id uuid primary key default gen_random_uuid(),
  bulletin_number text not null unique,  -- npr. "Goldhofer-SB-2024-001"
  title text not null,
  manufacturer text not null,  -- Goldhofer, TLD, ITW, Douglas...

  -- Applicability
  equipment_type text,  -- null = svi tipovi
  equipment_codes text[],  -- specific codes (null = all)
  serial_range text,  -- npr. "GH-2019-040 to GH-2019-060"

  -- Content
  description text not null,
  required_action text not null,
  parts_required text,
  estimated_hours numeric,

  -- Compliance
  priority text default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  compliance_deadline date,
  status text default 'OPEN' check (status in ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'NOT_APPLICABLE')),

  -- Tracking
  issued_at date not null,
  completed_at date,
  completed_by text,
  completion_notes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_sb_status on public.service_bulletins(status);
create index if not exists idx_sb_manufacturer on public.service_bulletins(manufacturer);
create index if not exists idx_sb_priority on public.service_bulletins(priority);

alter table public.service_bulletins enable row level security;

drop policy if exists "ServiceBulletins: authenticated read" on public.service_bulletins;
create policy "ServiceBulletins: authenticated read"
  on public.service_bulletins for select
  using (public.is_authenticated());

drop policy if exists "ServiceBulletins: engineer+ write" on public.service_bulletins;
create policy "ServiceBulletins: engineer+ write"
  on public.service_bulletins for all
  using (public.current_user_role() in ('engineer', 'admin'))
  with check (public.current_user_role() in ('engineer', 'admin'));

-- =====================================================
-- 4. AIRWORTHINESS_DIRECTIVES - EASA AD-ovi (Part-M §39)
-- =====================================================
create table if not exists public.airworthiness_directives (
  id uuid primary key default gen_random_uuid(),
  ad_number text not null unique,  -- npr. "EASA AD 2024-001"
  title text not null,

  -- Applicability
  equipment_type text,
  equipment_codes text[],

  -- Content
  description text not null,
  required_action text not null,
  compliance_method text,  -- INSPECTION, REPLACEMENT, MODIFICATION

  -- Compliance
  priority text default 'HIGH' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  effective_date date not null,
  compliance_deadline date,
  recurring boolean default false,
  recurring_interval_hours numeric,

  status text default 'OPEN' check (status in ('OPEN', 'COMPLIED', 'NOT_APPLICABLE')),

  complied_at date,
  complied_by text,
  compliance_notes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_ad_status on public.airworthiness_directives(status);
create index if not exists idx_ad_priority on public.airworthiness_directives(priority);

alter table public.airworthiness_directives enable row level security;

drop policy if exists "ADs: authenticated read" on public.airworthiness_directives;
create policy "ADs: authenticated read"
  on public.airworthiness_directives for select
  using (public.is_authenticated());

drop policy if exists "ADs: engineer+ write" on public.airworthiness_directives;
create policy "ADs: engineer+ write"
  on public.airworthiness_directives for all
  using (public.current_user_role() in ('engineer', 'admin'))
  with check (public.current_user_role() in ('engineer', 'admin'));

-- =====================================================
-- 5. SHIFT_HANDOVERS - predaja smjene (AHM 340)
-- =====================================================
create table if not exists public.shift_handovers (
  id uuid primary key default gen_random_uuid(),
  shift_date date not null,
  shift_type text not null check (shift_type in ('MORNING', 'AFTERNOON', 'NIGHT')),

  -- Outgoing (radnik koji predaje)
  outgoing_card_id text not null,
  outgoing_name text not null,
  outgoing_signature text,  -- potvrda predaje

  -- Incoming (radnik koji preuzima)
  incoming_card_id text not null,
  incoming_name text not null,
  incoming_signature text,  -- potvrda preuzimanja

  -- Handover details
  assigned_equipment_count integer default 0,
  open_damages_count integer default 0,
  notes text,

  -- Status
  status text default 'COMPLETED' check (status in ('PENDING', 'COMPLETED', 'CANCELLED')),

  handover_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_handover_date on public.shift_handovers(shift_date desc);
create index if not exists idx_handover_card on public.shift_handovers(outgoing_card_id, incoming_card_id);

alter table public.shift_handovers enable row level security;

drop policy if exists "ShiftHandovers: authenticated read" on public.shift_handovers;
create policy "ShiftHandovers: authenticated read"
  on public.shift_handovers for select
  using (public.is_authenticated());

drop policy if exists "ShiftHandovers: authenticated insert" on public.shift_handovers;
create policy "ShiftHandovers: authenticated insert"
  on public.shift_handovers for insert
  with check (public.is_authenticated());

drop policy if exists "ShiftHandovers: engineer+ update" on public.shift_handovers;
create policy "ShiftHandovers: engineer+ update"
  on public.shift_handovers for update
  using (public.current_user_role() in ('engineer', 'admin'));

-- =====================================================
-- 6. Seed demo podaci za EASA komponente
-- =====================================================

-- Komponente za GSE-TOW-001
insert into public.equipment_components (equipment_id, equipment_code, component_name, component_type, serial_number, manufacturer, installed_at, installed_hours, life_limit_hours, current_hours)
select id, 'GSE-TOW-001', 'Prednje gume (set)', 'TIRE', 'TIRE-2024-001', 'Michelin', '2024-01-15'::date, 0, 4000, 1850
from public.equipment where code = 'GSE-TOW-001'
and not exists (select 1 from public.equipment_components where equipment_code = 'GSE-TOW-001' and component_name = 'Prednje gume (set)');

insert into public.equipment_components (equipment_id, equipment_code, component_name, component_type, serial_number, manufacturer, installed_at, installed_hours, life_limit_hours, current_hours)
select id, 'GSE-TOW-001', 'Zadnje gume (set)', 'TIRE', 'TIRE-2024-002', 'Michelin', '2024-01-15'::date, 0, 4000, 1850
from public.equipment where code = 'GSE-TOW-001'
and not exists (select 1 from public.equipment_components where equipment_code = 'GSE-TOW-001' and component_name = 'Zadnje gume (set)');

insert into public.equipment_components (equipment_id, equipment_code, component_name, component_type, serial_number, manufacturer, installed_at, installed_hours, life_limit_hours, current_hours, status)
select id, 'GSE-TOW-001', 'Hidraulična pumpa', 'HYDRAULIC', 'HYD-2023-015', 'Bosch', '2023-06-01'::date, 0, 6000, 4200, 'INSPECT'
from public.equipment where code = 'GSE-TOW-001'
and not exists (select 1 from public.equipment_components where equipment_code = 'GSE-TOW-001' and component_name = 'Hidraulična pumpa');

-- Komponente za GSE-GPU-003 (neispravan)
insert into public.equipment_components (equipment_id, equipment_code, component_name, component_type, serial_number, manufacturer, installed_at, installed_hours, life_limit_hours, current_hours, status, notes)
select id, 'GSE-GPU-003', 'Kabel za napajanje aviona', 'CABLE', 'CAB-2022-008', 'ITW GSE', '2022-03-10'::date, 0, 3000, 2800, 'INSPECT', 'Oštećen konektor - potrebna zamjena'
from public.equipment where code = 'GSE-GPU-003'
and not exists (select 1 from public.equipment_components where equipment_code = 'GSE-GPU-003' and component_name = 'Kabel za napajanje aviona');

-- =====================================================
-- 7. Seed demo Service Bulletin
-- =====================================================
insert into public.service_bulletins (bulletin_number, title, manufacturer, equipment_type, description, required_action, parts_required, estimated_hours, priority, compliance_deadline, status, issued_at)
select 'GOLDFER-SB-2025-001', 'Inspekcija upravljačkog mehanizma AST-2', 'Goldhofer', 'TOW_TRACTOR',
'Proizvođač je identifikovao potencijalno slabljenje upravljačkog mehanizma na modelima AST-2 proizvedenim 2019-2020.',
'Vizuelna inspekcija zupčanika i zgloba upravljača. Zamjena ako se pronađe igra veća od 2mm.',
'Kit inspekcije GOL-INS-001 (ako je potrebno)', 2.5, 'HIGH', '2025-12-31'::date, 'OPEN', '2025-03-15'::date
where not exists (select 1 from public.service_bulletins where bulletin_number = 'GOLDFER-SB-2025-001');

-- =====================================================
-- 8. Seed demo Airworthiness Directive
-- =====================================================
insert into public.airworthiness_directives (ad_number, title, equipment_type, description, required_action, compliance_method, priority, effective_date, compliance_deadline, recurring, recurring_interval_hours, status)
select 'EASA-AD-2025-014', 'Obavezna zamjena hidrauličnih crijeva na GSE opremi', NULL,
'EASA je izdala direktivu koja zahtijeva zamjenu svih hidrauličnih crijeva starijih od 5 godina na GSE opremi zbog rizika od pucanja.',
'Zamjena svih hidrauličnih crijeva starijih od 5 godina sa novim certificiranim crijevima.',
'REPLACEMENT', 'CRITICAL', '2025-01-01'::date, '2025-09-30'::date, true, 43800, 'OPEN'
where not exists (select 1 from public.airworthiness_directives where ad_number = 'EASA-AD-2025-014');

-- =====================================================
-- 9. Komentari
-- =====================================================
comment on table public.equipment_components is 'EASA Part-145 §50 - Life-limited components tracking';
comment on table public.service_bulletins is 'EASA Part-145 §71 - Manufacturer service bulletins';
comment on table public.airworthiness_directives is 'EASA Part-M §39 - Airworthiness Directives compliance';
comment on table public.shift_handovers is 'IATA AHM 340 - Shift accountability and handover';
comment on column public.employees.pin is '4-digit PIN for no-login worker identification';
