-- =====================================================
-- GSE Control - Migration 009: Incident Reporting + Driver Authorization
-- ADR.OPS.B.005 (SMS) + ADR.OPS.C.005 (Movement Area)
-- =====================================================

-- 1. INCIDENTS — prijava sigurnosnih događaja
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  incident_number text not null unique,

  incident_type text not null check (incident_type in ('GSE_AIRCRAFT','GSE_PERSON','GSE_INFRASTRUCTURE','GSE_GSE','FOD','SPILL','OTHER')),
  severity text not null default 'MINOR' check (severity in ('MINOR','MAJOR','SERIOUS','ACCIDENT')),
  smor_required boolean default false,

  location text not null,
  zone text check (zone in ('APRON','TAXIWAY','RUNWAY','SERVICE_ROAD','TERMINAL')),
  occurred_at timestamptz not null,

  weather text,
  visibility text,
  surface_condition text,

  equipment_id uuid,
  equipment_code text,
  equipment_name text,

  operator_card_id text,
  operator_name text,

  description text not null,
  immediate_action text,

  root_cause text,
  contributing_factors text,

  corrective_actions text,
  preventive_actions text,

  status text not null default 'OPEN' check (status in ('OPEN','INVESTIGATING','RESOLVED','CLOSED')),
  reported_by text not null,
  reported_by_card_id text,
  reported_at timestamptz default now(),

  injuries_reported boolean default false,
  injury_details text,
  damage_estimate numeric,

  authority_notified text,
  notification_date timestamptz,

  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_inc_type on public.incidents(incident_type);
create index if not exists idx_inc_severity on public.incidents(severity);
create index if not exists idx_inc_status on public.incidents(status);
create index if not exists idx_inc_date on public.incidents(occurred_at desc);
create index if not exists idx_inc_equipment on public.incidents(equipment_id);

alter table public.incidents enable row level security;

-- Javno čitanje i upis (radnici prijavljuju incidente bez login-a)
drop policy if exists "Incidents: public read" on public.incidents;
create policy "Incidents: public read"
  on public.incidents for select using (true);

drop policy if exists "Incidents: public insert" on public.incidents;
create policy "Incidents: public insert"
  on public.incidents for insert with check (true);

drop policy if exists "Incidents: engineer+ update" on public.incidents;
create policy "Incidents: engineer+ update"
  on public.incidents for update
  using (public.current_user_role() in ('engineer','admin'));

-- 2. DRIVER AUTHORIZATIONS — dozvole za movement area
create table if not exists public.driver_authorizations (
  id uuid primary key default gen_random_uuid(),
  employee_card_id text not null unique,
  employee_name text not null,

  category1 boolean default false,
  category2 boolean default false,
  category3 boolean default false,

  license_number text,
  issued_at date,
  valid_until date,
  issued_by text,

  training_completed boolean default false,
  training_date date,
  training_expiry date,

  active boolean default true,
  suspended_at timestamptz,
  suspend_reason text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_drvauth_card on public.driver_authorizations(employee_card_id);
create index if not exists idx_drvauth_valid on public.driver_authorizations(valid_until);
create index if not exists idx_drvauth_training on public.driver_authorizations(training_expiry);

alter table public.driver_authorizations enable row level security;

-- Javno čitanje (radnici moraju provjeriti da li imaju dozvolu)
drop policy if exists "DriverAuth: public read" on public.driver_authorizations;
create policy "DriverAuth: public read"
  on public.driver_authorizations for select using (true);

-- Samo admin upravlja dozvolama
drop policy if exists "DriverAuth: admin write" on public.driver_authorizations;
create policy "DriverAuth: admin write"
  on public.driver_authorizations for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- 3. Seed demo driver authorizations
insert into public.driver_authorizations (employee_card_id, employee_name, category1, category2, category3, license_number, issued_at, valid_until, issued_by, training_completed, training_date, training_expiry)
select 'EMP-1001', 'Vukan Vojvodić', true, false, false, 'ADP-1001', '2025-01-15'::date, '2027-01-15'::date, 'Airport Authority', true, '2025-01-15'::date, '2027-01-15'::date
where not exists (select 1 from public.driver_authorizations where employee_card_id = 'EMP-1001');

insert into public.driver_authorizations (employee_card_id, employee_name, category1, category2, category3, license_number, issued_at, valid_until, issued_by, training_completed, training_date, training_expiry)
select 'EMP-1003', 'Novak Knežević', true, true, false, 'ADP-1003', '2025-03-10'::date, '2027-03-10'::date, 'Airport Authority', true, '2025-03-10'::date, '2027-03-10'::date
where not exists (select 1 from public.driver_authorizations where employee_card_id = 'EMP-1003');

insert into public.driver_authorizations (employee_card_id, employee_name, category1, category2, category3, license_number, issued_at, valid_until, issued_by, training_completed, training_date, training_expiry)
select 'EMP-1005', 'Blažo Adžić', true, true, true, 'ADP-1005', '2025-01-20'::date, '2027-01-20'::date, 'Airport Authority', true, '2025-01-20'::date, '2027-01-20'::date
where not exists (select 1 from public.driver_authorizations where employee_card_id = 'EMP-1005');

-- 4. Seed demo incident
insert into public.incidents (incident_number, incident_type, severity, smor_required, location, zone, occurred_at, weather, visibility, surface_condition, equipment_code, equipment_name, operator_card_id, operator_name, description, immediate_action, status, reported_by, reported_at, injuries_reported, damage_estimate)
select 'INC-2026-001', 'GSE_AIRCRAFT', 'MAJOR', true, 'Stand A1', 'APRON', '2026-02-15'::timestamptz, 'RAIN', 'MODERATE', 'WET', 'GSE-TOW-001', 'Tow Tractor Goldhofer AST-2', 'EMP-1002', 'Milena Popović', 'Tow tractor je pri manevrisanju zakačio wing-tip aviona. Došlo je do kontakta sa desnim krilom A320.', 'Vozilo zaustavljeno, supervisor obaviješten, avion pregledan', 'RESOLVED', 'Blažo Adžić', '2026-02-15'::timestamptz, false, 15000.00
where not exists (select 1 from public.incidents where incident_number = 'INC-2026-001');

comment on table public.incidents is 'ADR.OPS.B.005 - Incident/Accident Reporting (Safety Management System)';
comment on table public.driver_authorizations is 'ADR.OPS.C.005 - Driver Authorization for Movement Area';
