-- =====================================================
-- GSE Control - Migration 004: ADR.OPS.C.007 Compliance
-- Vehicle Fitness Certificate + Maintenance Schedule + Daily Inspection
-- =====================================================

-- =====================================================
-- 1. EQUIPMENT - dodaj fitness polja
-- =====================================================
alter table public.equipment
  add column if not exists fitness_status text,
  add column if not exists fitness_calculated_at timestamptz,
  add column if not exists fitness_reason text;

-- =====================================================
-- 2. MAINTENANCE_SCHEDULE - automatsko generisanje
-- =====================================================
create table if not exists public.maintenance_schedule (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid references public.equipment(id) on delete cascade,
  equipment_code text not null,
  equipment_name text not null,

  maintenance_type text not null check (maintenance_type in ('PREVENTIVE', 'PERIODIC', 'ANNUAL', 'SCHEDULED')),
  title text not null,
  description text,

  trigger_hours numeric,
  trigger_date date,
  trigger_interval numeric,

  status text not null default 'SCHEDULED' check (status in ('SCHEDULED', 'DUE', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE')),
  priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),

  completed_at timestamptz,
  completed_by text,
  completion_notes text,
  actual_hours numeric,

  auto_generated boolean default false,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_maintsched_equipment on public.maintenance_schedule(equipment_id);
create index if not exists idx_maintsched_status on public.maintenance_schedule(status);
create index if not exists idx_maintsched_priority on public.maintenance_schedule(priority);

alter table public.maintenance_schedule enable row level security;

drop policy if exists "MaintSchedule: authenticated read" on public.maintenance_schedule;
create policy "MaintSchedule: authenticated read"
  on public.maintenance_schedule for select
  using (public.is_authenticated());

drop policy if exists "MaintSchedule: engineer+ write" on public.maintenance_schedule;
create policy "MaintSchedule: engineer+ write"
  on public.maintenance_schedule for all
  using (public.current_user_role() in ('engineer', 'admin'))
  with check (public.current_user_role() in ('engineer', 'admin'));

-- =====================================================
-- 3. DAILY_INSPECTION - jutarnja inspekcija
-- =====================================================
create table if not exists public.daily_inspections (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid references public.equipment(id) on delete cascade,
  equipment_code text not null,
  equipment_name text not null,

  inspector_card_id text not null,
  inspector_name text not null,

  inspection_date timestamptz default now(),
  shift text check (shift in ('MORNING', 'AFTERNOON', 'NIGHT')),

  checklist_json text default '[]',
  result text check (result in ('FIT', 'UNFIT', 'CONDITIONAL')),
  notes text,

  issues_found integer default 0,
  issues_json text,

  created_at timestamptz default now()
);

create index if not exists idx_dailyinsp_equipment on public.daily_inspections(equipment_id);
create index if not exists idx_dailyinsp_date on public.daily_inspections(inspection_date desc);
create index if not exists idx_dailyinsp_result on public.daily_inspections(result);

alter table public.daily_inspections enable row level security;

-- Daily inspection može biti kreirana od strane svih (i radnika bez login-a)
drop policy if exists "DailyInspection: public read" on public.daily_inspections;
create policy "DailyInspection: public read"
  on public.daily_inspections for select
  using (true);

drop policy if exists "DailyInspection: public insert" on public.daily_inspections;
create policy "DailyInspection: public insert"
  on public.daily_inspections for insert
  with check (true);

drop policy if exists "DailyInspection: engineer+ update" on public.daily_inspections;
create policy "DailyInspection: engineer+ update"
  on public.daily_inspections for update
  using (public.current_user_role() in ('engineer', 'admin'));

-- =====================================================
-- 4. Seed demo maintenance schedule
-- =====================================================
insert into public.maintenance_schedule (equipment_id, equipment_code, equipment_name, maintenance_type, title, description, trigger_hours, trigger_interval, status, priority, auto_generated)
select id, code, name, 'PREVENTIVE', 'Periodično održavanje (500h)', 'Zamjena ulja, filtera i opća inspekcija', 500, 500, 'SCHEDULED', 'MEDIUM', true
from public.equipment
where code = 'GSE-TOW-001'
and not exists (select 1 from public.maintenance_schedule where equipment_code = 'GSE-TOW-001');

insert into public.maintenance_schedule (equipment_id, equipment_code, equipment_name, maintenance_type, title, description, trigger_date, status, priority, auto_generated)
select id, code, name, 'ANNUAL', 'Godišnji tehnički pregled', 'Kompletna godišnja inspekcija vozila', '2026-01-15'::date, 'SCHEDULED', 'HIGH', true
from public.equipment
where code = 'GSE-TOW-001'
and not exists (select 1 from public.maintenance_schedule where equipment_code = 'GSE-TOW-001' and maintenance_type = 'ANNUAL');

-- =====================================================
-- 5. Komentari
-- =====================================================
comment on table public.maintenance_schedule is 'ADR.OPS.C.007(b) - Systematic maintenance schedule';
comment on table public.daily_inspections is 'ADR.OPS.C.007(c) - Daily inspection record';
comment on column public.equipment.fitness_status is 'ADR.OPS.C.007(a) - Auto-calculated fitness: FIT | UNFIT | CONDITIONAL';
