-- =====================================================
-- GSE Control - Migration 002: Advanced features
-- Dodaje: periodic inspections, maintenance log, photo evidence,
-- training/qualifications, webhook settings, root cause analysis
-- =====================================================

-- =====================================================
-- 1. EQUIPMENT - dodaj polja za periodic inspections i lifecycle
-- =====================================================
alter table public.equipment
  add column if not exists last_inspection_date date,
  add column if not exists next_inspection_date date,
  add column if not exists inspection_interval_months integer default 12,
  add column if not exists total_operating_hours numeric default 0,
  add column if not exists maintenance_interval_hours numeric default 500,
  add column if not exists last_maintenance_hours numeric default 0,
  add column if not exists manufacturer text,
  add column if not exists model_year integer,
  add column if not exists purchase_date date,
  add column if not exists warranty_expiry date,
  add column if not exists registration_number text;

-- =====================================================
-- 2. MAINTENANCE_LOG - istorija održavanja
-- =====================================================
create table if not exists public.maintenance_log (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid references public.equipment(id) on delete cascade,
  equipment_code text not null,
  equipment_name text not null,

  maintenance_type text not null check (maintenance_type in ('PREVENTIVE', 'CORRECTIVE', 'INSPECTION', 'OVERHAUL')),
  description text not null,
  performed_by text,
  performed_by_card_id text,
  cost numeric,
  duration_hours numeric,
  operating_hours_at_service numeric,

  -- EASA Part-145 compliance fields
  certificate_number text,
  parts_replaced text,
  next_due_hours numeric,
  next_due_date date,

  status text not null default 'COMPLETED' check (status in ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),

  performed_at date default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_maintlog_equipment on public.maintenance_log(equipment_id);
create index if not exists idx_maintlog_type on public.maintenance_log(maintenance_type);
create index if not exists idx_maintlog_performed on public.maintenance_log(performed_at desc);

alter table public.maintenance_log enable row level security;

drop policy if exists "MaintenanceLog: authenticated read" on public.maintenance_log;
create policy "MaintenanceLog: authenticated read"
  on public.maintenance_log for select
  using (public.is_authenticated());

drop policy if exists "MaintenanceLog: engineer+ insert" on public.maintenance_log;
create policy "MaintenanceLog: engineer+ insert"
  on public.maintenance_log for insert
  with check (public.current_user_role() in ('engineer', 'admin'));

drop policy if exists "MaintenanceLog: engineer+ update" on public.maintenance_log;
create policy "MaintenanceLog: engineer+ update"
  on public.maintenance_log for update
  using (public.current_user_role() in ('engineer', 'admin'));

drop policy if exists "MaintenanceLog: admin delete" on public.maintenance_log;
create policy "MaintenanceLog: admin delete"
  on public.maintenance_log for delete
  using (public.current_user_role() = 'admin');

-- =====================================================
-- 3. EQUIPMENT_PHOTOS - fotografije oštećenja
-- =====================================================
create table if not exists public.equipment_photos (
  id uuid primary key default gen_random_uuid(),
  damage_report_id uuid references public.damage_reports(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete cascade,
  photo_data text not null,  -- base64 encoded (jednostavnije od Supabase Storage)
  photo_type text default 'image/jpeg',
  caption text,
  taken_by_card_id text,
  taken_by_name text,
  taken_at timestamptz default now()
);

create index if not exists idx_photos_damage on public.equipment_photos(damage_report_id);
create index if not exists idx_photos_equipment on public.equipment_photos(equipment_id);

alter table public.equipment_photos enable row level security;

-- Public read (FIDS može vidjeti photos? NE - samo auth)
drop policy if exists "Photos: authenticated read" on public.equipment_photos;
create policy "Photos: authenticated read"
  on public.equipment_photos for select
  using (public.is_authenticated());

drop policy if exists "Photos: authenticated insert" on public.equipment_photos;
create policy "Photos: authenticated insert"
  on public.equipment_photos for insert
  with check (public.is_authenticated());

drop policy if exists "Photos: engineer+ delete" on public.equipment_photos;
create policy "Photos: engineer+ delete"
  on public.equipment_photos for delete
  using (public.current_user_role() in ('engineer', 'admin'));

-- =====================================================
-- 4. DAMAGE_REPORTS - dodaj root cause analysis
-- =====================================================
alter table public.damage_reports
  add column if not exists root_cause text,
  add column if not exists corrective_action text,
  add column if not exists preventive_action text,
  add column if not exists insurance_claim_ref text,
  add column if not exists estimated_cost numeric;

-- =====================================================
-- 5. EQUIPMENT_QUALIFICATIONS - ko može šta da upravlja
-- =====================================================
create table if not exists public.equipment_qualifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade,
  employee_card_id text not null,
  employee_name text not null,
  equipment_type text not null,  -- npr. 'TOW_TRACTOR', 'GPU', ...
  qualification_level text default 'OPERATOR' check (qualification_level in ('OPERATOR', 'SENIOR', 'INSTRUCTOR')),
  trained_at date,
  valid_until date,
  certified_by text,
  certificate_number text,
  created_at timestamptz default now()
);

create unique index if not exists idx_qual_emp_type on public.equipment_qualifications(employee_id, equipment_type);
create index if not exists idx_qual_employee on public.equipment_qualifications(employee_id);
create index if not exists idx_qual_type on public.equipment_qualifications(equipment_type);

alter table public.equipment_qualifications enable row level security;

drop policy if exists "Qualifications: authenticated read" on public.equipment_qualifications;
create policy "Qualifications: authenticated read"
  on public.equipment_qualifications for select
  using (public.is_authenticated());

drop policy if exists "Qualifications: admin manage" on public.equipment_qualifications;
create policy "Qualifications: admin manage"
  on public.equipment_qualifications for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- =====================================================
-- 6. WEBHOOK_SETTINGS - Slack/Teams notifikacije
-- =====================================================
create table if not exists public.webhook_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  webhook_url text not null,
  webhook_type text default 'SLACK' check (webhook_type in ('SLACK', 'TEAMS', 'GENERIC', 'EMAIL')),
  enabled boolean default true,
  -- Koji eventi trigger-uju webhook
  trigger_critical_damage boolean default true,
  trigger_damage_resolved boolean default false,
  trigger_out_of_service boolean default true,
  trigger_inspection_overdue boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.webhook_settings enable row level security;

drop policy if exists "WebhookSettings: admin manage" on public.webhook_settings;
create policy "WebhookSettings: admin manage"
  on public.webhook_settings for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- =====================================================
-- 7. AUDIT_LOG - dodatni log svih admin/inženjer akcija (EASA compliance)
-- =====================================================
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_email text,
  user_role text,
  action text not null,  -- npr. 'EQUIPMENT_STATUS_CHANGE', 'DAMAGE_RESOLVED', 'USER_ROLE_CHANGED'
  entity_type text,
  entity_id text,
  details text,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

create index if not exists idx_audit_user on public.audit_log(user_id);
create index if not exists idx_audit_action on public.audit_log(action);
create index if not exists idx_audit_created on public.audit_log(created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "AuditLog: admin read" on public.audit_log;
create policy "AuditLog: admin read"
  on public.audit_log for select
  using (public.current_user_role() = 'admin');

drop policy if exists "AuditLog: authenticated insert" on public.audit_log;
create policy "AuditLog: authenticated insert"
  on public.audit_log for insert
  with check (public.is_authenticated());

-- =====================================================
-- 8. SETTINGS - globalne aplikacijske postavke
-- =====================================================
create table if not exists public.app_settings (
  id integer primary key default 1,
  airport_name text default 'Aerodrom',
  airport_code text default 'XXX',
  timezone text default 'Europe/Podgorica',
  language text default 'hr',
  require_photo_for_damage boolean default false,
  require_qualification_for_checkout boolean default true,
  enable_email_notifications boolean default true,
  enable_webhook_notifications boolean default false,
  inspection_reminder_days integer default 30,  -- podsjeti X dana prije isteka
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

insert into public.app_settings (id, airport_name, airport_code) values (1, 'Aerodrom Podgorica', 'TGD')
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "AppSettings: public read" on public.app_settings;
create policy "AppSettings: public read"
  on public.app_settings for select
  using (true);

drop policy if exists "AppSettings: admin update" on public.app_settings;
create policy "AppSettings: admin update"
  on public.app_settings for update
  using (public.current_user_role() = 'admin');

-- =====================================================
-- 9. Update equipment sa periodic inspection dates
-- =====================================================
update public.equipment
  set last_inspection_date = '2025-06-01'::date,
      next_inspection_date = '2026-06-01'::date,
      inspection_interval_months = 12
where last_inspection_date is null;

-- =====================================================
-- 10. Seed demo kvalifikacija
-- =====================================================
insert into public.equipment_qualifications (employee_card_id, employee_name, equipment_type, qualification_level, trained_at, valid_until, certified_by)
select 'EMP-1001', 'Vukan Vojvodić', 'TOW_TRACTOR', 'OPERATOR', '2024-01-15'::date, '2026-01-15'::date, 'Training Center Podgorica'
where not exists (select 1 from public.equipment_qualifications where employee_card_id = 'EMP-1001' and equipment_type = 'TOW_TRACTOR');

insert into public.equipment_qualifications (employee_card_id, employee_name, equipment_type, qualification_level, trained_at, valid_until, certified_by)
select 'EMP-1001', 'Vukan Vojvodić', 'GPU', 'OPERATOR', '2024-01-15'::date, '2026-01-15'::date, 'Training Center Podgorica'
where not exists (select 1 from public.equipment_qualifications where employee_card_id = 'EMP-1001' and equipment_type = 'GPU');

insert into public.equipment_qualifications (employee_card_id, employee_name, equipment_type, qualification_level, trained_at, valid_until, certified_by)
select 'EMP-1002', 'Milena Popović', 'BELT_LOADER', 'OPERATOR', '2024-03-20'::date, '2026-03-20'::date, 'Training Center Podgorica'
where not exists (select 1 from public.equipment_qualifications where employee_card_id = 'EMP-1002' and equipment_type = 'BELT_LOADER');

insert into public.equipment_qualifications (employee_card_id, employee_name, equipment_type, qualification_level, trained_at, valid_until, certified_by)
select 'EMP-1003', 'Novak Knežević', 'TOW_TRACTOR', 'SENIOR', '2023-05-10'::date, '2025-05-10'::date, 'Training Center Podgorica'
where not exists (select 1 from public.equipment_qualifications where employee_card_id = 'EMP-1003' and equipment_type = 'TOW_TRACTOR');

insert into public.equipment_qualifications (employee_card_id, employee_name, equipment_type, qualification_level, trained_at, valid_until, certified_by)
select 'EMP-1003', 'Novak Knežević', 'PUSHBACK', 'INSTRUCTOR', '2023-05-10'::date, '2025-05-10'::date, 'Training Center Podgorica'
where not exists (select 1 from public.equipment_qualifications where employee_card_id = 'EMP-1003' and equipment_type = 'PUSHBACK');

-- =====================================================
-- 11. Seed demo maintenance log
-- =====================================================
insert into public.maintenance_log (equipment_id, equipment_code, equipment_name, maintenance_type, description, performed_by, performed_at, certificate_number, status)
select id, code, name, 'PREVENTIVE', 'Godišnji pregled - zamjena ulja i filtera', 'Ana Novak', '2025-06-01'::date, 'MAINT-2025-001', 'COMPLETED'
from public.equipment
where code = 'GSE-TOW-001'
  and not exists (select 1 from public.maintenance_log where equipment_code = 'GSE-TOW-001');

insert into public.maintenance_log (equipment_id, equipment_code, equipment_name, maintenance_type, description, performed_by, performed_at, certificate_number, status)
select id, code, name, 'INSPECTION', 'Kontrola kočionog sistema i guma', 'Ana Novak', '2025-06-15'::date, 'MAINT-2025-002', 'COMPLETED'
from public.equipment
where code = 'GSE-BLT-001'
  and not exists (select 1 from public.maintenance_log where equipment_code = 'GSE-BLT-001');

insert into public.maintenance_log (equipment_id, equipment_code, equipment_name, maintenance_type, description, performed_by, performed_at, certificate_number, status)
select id, code, name, 'CORRECTIVE', 'Zamjena oštećenog kabla za napajanje', 'Ana Novak', '2025-06-18'::date, 'MAINT-2025-003', 'IN_PROGRESS'
from public.equipment
where code = 'GSE-GPU-003'
  and not exists (select 1 from public.maintenance_log where equipment_code = 'GSE-GPU-003');

-- =====================================================
-- 12. Komentari
-- =====================================================
comment on table public.maintenance_log is 'EASA Part-145 compliant maintenance log per oprema';
comment on table public.equipment_photos is 'Foto-dokaz oštećenja - base64 encoded (jednostavnije od Supabase Storage)';
comment on table public.equipment_qualifications is 'IATA AHM 1110 - samo obučeno osoblje može upravljati opremom';
comment on table public.webhook_settings is 'Slack/Teams webhook notifikacije za kritične događaje';
comment on table public.audit_log is 'EASA compliance audit log svih admin/inženjer akcija';
comment on table public.app_settings is 'Globalne aplikacijske postavke (single row)';
