-- =====================================================
-- GSE Control - Supabase migration (initial schema)
-- Pokrenuti u Supabase Dashboard > SQL Editor
-- =====================================================

-- =====================================================
-- 1. PROFILES tabela - proširuje auth.users sa role i metapodacima
-- =====================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  card_id text unique,  -- npr. "EMP-1001" - povezano sa ID karticom radnika
  role text not null default 'operator' check (role in ('operator', 'engineer', 'admin')),
  department text default 'Ramp',
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-kreiraj profile kada se novi user registruje
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, card_id, role, department)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'card_id',
    coalesce(new.raw_user_meta_data->>'role', 'operator'),
    coalesce(new.raw_user_meta_data->>'department', 'Ramp')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================
-- 2. EQUIPMENT - GSE sredstva
-- =====================================================
create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  type text not null check (type in ('TOW_TRACTOR','GPU','BELT_LOADER','PUSHBACK','STAIRS','DOLLY','LAVATORY','WATER','BUS','OTHER')),
  serial_number text,
  location text default 'Stand A1',
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE','ASSIGNED','OUT_OF_SERVICE','MAINTENANCE')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_equipment_status on public.equipment(status);
create index if not exists idx_equipment_type on public.equipment(type);

-- =====================================================
-- 3. EMPLOYEES - evidencija radnika (ne mora biti auth user)
-- =====================================================
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  card_id text unique not null,
  name text not null,
  department text default 'Ramp',
  role text default 'Operator',
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================
-- 4. ASSIGNMENTS - historija zaduživanja/razduživanja
-- =====================================================
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid references public.equipment(id) on delete cascade,
  equipment_code text not null,
  equipment_name text not null,
  employee_id uuid references public.employees(id),
  employee_card_id text not null,
  employee_name text not null,
  action text not null check (action in ('CHECK_OUT','CHECK_IN')),
  inspection_result text not null check (inspection_result in ('OK','MINOR_DAMAGE','MAJOR_DAMAGE','OUT_OF_SERVICE')),
  inspection_notes text,
  checklist_json text default '[]',
  shift text,
  damage_report_id uuid,
  timestamp timestamptz default now()
);

create index if not exists idx_assignments_equipment on public.assignments(equipment_id);
create index if not exists idx_assignments_employee_card on public.assignments(employee_card_id);
create index if not exists idx_assignments_action on public.assignments(action);
create index if not exists idx_assignments_timestamp on public.assignments(timestamp desc);

-- =====================================================
-- 5. DAMAGE_REPORTS - prijave oštećenja
-- =====================================================
create table if not exists public.damage_reports (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid references public.equipment(id) on delete cascade,
  equipment_code text not null,
  equipment_name text not null,
  reported_by_card_id text not null,
  reported_by_name text not null,
  employee_id uuid references public.employees(id),
  severity text not null default 'MINOR' check (severity in ('MINOR','MAJOR','CRITICAL')),
  description text not null,
  status text not null default 'OPEN' check (status in ('OPEN','IN_REPAIR','RESOLVED')),
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_damages_status on public.damage_reports(status);
create index if not exists idx_damages_equipment on public.damage_reports(equipment_id);

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS) policies
-- =====================================================
alter table public.profiles enable row level security;
alter table public.equipment enable row level security;
alter table public.employees enable row level security;
alter table public.assignments enable row level security;
alter table public.damage_reports enable row level security;

-- Helper funkcija: dohvati role trenutnog usera
create or replace function public.current_user_role()
returns text
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'anonymous'
  )
$$;

-- Helper: da li je trenutni user autentifikovan
create or replace function public.is_authenticated()
returns boolean
language sql
stable
as $$
  select auth.uid() is not null
$$;

-- ===== PROFILES policies =====
-- Svaki user može vidjeti svoj profile
-- Admin vidi sve profile
drop policy if exists "Profiles: select own or admin" on public.profiles;
create policy "Profiles: select own or admin"
  on public.profiles for select
  using (id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "Profiles: update own" on public.profiles;
create policy "Profiles: update own"
  on public.profiles for update
  using (id = auth.uid());

drop policy if exists "Profiles: admin manage" on public.profiles;
create policy "Profiles: admin manage"
  on public.profiles for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- ===== EQUIPMENT policies =====
-- ANON (public FIDS): može čitati (bez notes oštećenja - kroz view)
-- AUTH (svi): mogu čitati sve
-- AUTH (svi): mogu insert (admin kroz Server Action)
-- AUTH (svi): mogu update statusa (worker check-out/check-in mijenja status; engineer+ manualno)
-- ADMIN: može brisati
-- Napomena: Role-based provjere se dodatno rade u Server Actions (requireRole)
drop policy if exists "Equipment: public read" on public.equipment;
create policy "Equipment: public read"
  on public.equipment for select
  using (true);  -- FIDS je public

drop policy if exists "Equipment: authenticated insert" on public.equipment;
create policy "Equipment: authenticated insert"
  on public.equipment for insert
  with check (public.is_authenticated());

drop policy if exists "Equipment: authenticated update" on public.equipment;
create policy "Equipment: authenticated update"
  on public.equipment for update
  using (public.is_authenticated());

drop policy if exists "Equipment: admin delete" on public.equipment;
create policy "Equipment: admin delete"
  on public.equipment for delete
  using (public.current_user_role() = 'admin');

-- ===== EMPLOYEES policies =====
-- AUTH (svi): mogu čitati i insertati (worker check-out kreira novog employee ako ne postoji)
-- ADMIN: može uređivati/brisati
drop policy if exists "Employees: authenticated read" on public.employees;
create policy "Employees: authenticated read"
  on public.employees for select
  using (public.is_authenticated());

drop policy if exists "Employees: authenticated insert" on public.employees;
create policy "Employees: authenticated insert"
  on public.employees for insert
  with check (public.is_authenticated());

drop policy if exists "Employees: admin update" on public.employees;
create policy "Employees: admin update"
  on public.employees for update
  using (public.current_user_role() = 'admin');

drop policy if exists "Employees: admin delete" on public.employees;
create policy "Employees: admin delete"
  on public.employees for delete
  using (public.current_user_role() = 'admin');

-- ===== ASSIGNMENTS policies =====
-- AUTH (svi): mogu čitati
-- AUTH (svi): mogu insert (worker check-out/check-in)
-- Napomena: Nema UPDATE/DELETE - audit log je nepromjenjiv
drop policy if exists "Assignments: authenticated read" on public.assignments;
create policy "Assignments: authenticated read"
  on public.assignments for select
  using (public.is_authenticated());

drop policy if exists "Assignments: authenticated insert" on public.assignments;
create policy "Assignments: authenticated insert"
  on public.assignments for insert
  with check (public.is_authenticated());

-- ===== DAMAGE_REPORTS policies =====
-- AUTH (svi): mogu čitati
-- AUTH (svi): mogu insert (worker prijavljuje)
-- ENGINEER, ADMIN: mogu update (resolve, change status)
drop policy if exists "Damages: authenticated read" on public.damage_reports;
create policy "Damages: authenticated read"
  on public.damage_reports for select
  using (public.is_authenticated());

drop policy if exists "Damages: authenticated insert" on public.damage_reports;
create policy "Damages: authenticated insert"
  on public.damage_reports for insert
  with check (public.is_authenticated());

drop policy if exists "Damages: engineer+ update" on public.damage_reports;
create policy "Damages: engineer+ update"
  on public.damage_reports for update
  using (public.current_user_role() in ('engineer', 'admin'));

-- =====================================================
-- 7. PUBLIC VIEW za FIDS - bez notes (koji mogu sadržavati osjetljive podatke o oštećenjima)
-- =====================================================
create or replace view public.fids_equipment as
select
  id, code, name, type, serial_number, location, status,
  (status = 'ASSIGNED') as in_use,
  created_at, updated_at
from public.equipment
order by code;

comment on view public.fids_equipment is 'Public view for FIDS display - excludes notes field';

-- =====================================================
-- 8. SEED DATA - primjer GSE inventara
-- =====================================================
insert into public.equipment (code, name, type, serial_number, location, status) values
  ('GSE-TOW-001', 'Tow Tractor Goldhofer AST-2', 'TOW_TRACTOR', 'GH-2019-045', 'Stand B12', 'AVAILABLE'),
  ('GSE-TOW-002', 'Tow Tractor Douglas KT-15', 'TOW_TRACTOR', 'DK-2021-082', 'Stand B14', 'AVAILABLE'),
  ('GSE-TOW-003', 'Tow Tractor JBT AeroTech', 'TOW_TRACTOR', 'JBT-2020-117', 'Maintenance Hangar', 'MAINTENANCE'),
  ('GSE-GPU-001', 'GPU ITW GSE 1400', 'GPU', 'ITW-2018-011', 'Stand A1', 'AVAILABLE'),
  ('GSE-GPU-002', 'GPU Textron GSE 90kVA', 'GPU', 'TX-2022-034', 'Stand A3', 'AVAILABLE'),
  ('GSE-GPU-003', 'GPU Houchin Diesel', 'GPU', 'HC-2017-008', 'Stand C5', 'OUT_OF_SERVICE'),
  ('GSE-BLT-001', 'Belt Loader TLD TB-150', 'BELT_LOADER', 'TLD-2019-201', 'Stand A2', 'AVAILABLE'),
  ('GSE-BLT-002', 'Belt Loader Mallaghan BL-7', 'BELT_LOADER', 'MG-2020-145', 'Stand B11', 'AVAILABLE'),
  ('GSE-BLT-003', 'Belt Loader NMC WDS50', 'BELT_LOADER', 'NMC-2023-008', 'Stand C2', 'AVAILABLE'),
  ('GSE-PB-001', 'Pushback Goldhofer AST-1X', 'PUSHBACK', 'GH-2020-019', 'Head-of-stand A', 'AVAILABLE'),
  ('GSE-PB-002', 'Pushback Douglas KPD-40', 'PUSHBACK', 'DK-2021-022', 'Head-of-stand B', 'AVAILABLE'),
  ('GSE-STR-001', 'Passenger Stairs TLD PS-30', 'STAIRS', 'TLD-2018-088', 'Remote Stand R3', 'AVAILABLE'),
  ('GSE-STR-002', 'Passenger Stairs Mallaghan', 'STAIRS', 'MG-2019-045', 'Remote Stand R5', 'AVAILABLE'),
  ('GSE-DLY-001', 'Cargo Dolly CD-10T', 'DOLLY', 'CD-2017-301', 'Cargo Area', 'AVAILABLE'),
  ('GSE-DLY-002', 'Container Dolly PMC', 'DOLLY', 'CD-2020-122', 'Cargo Area', 'AVAILABLE'),
  ('GSE-LAV-001', 'Lavatory Service Truck', 'LAVATORY', 'LS-2019-007', 'Service Road S1', 'AVAILABLE'),
  ('GSE-WTR-001', 'Potable Water Truck 5000L', 'WATER', 'PW-2021-014', 'Service Road S2', 'AVAILABLE'),
  ('GSE-BUS-001', 'Passenger Bus Cobus 3000', 'BUS', 'CB-2018-002', 'Bus Stop 1', 'AVAILABLE'),
  ('GSE-BUS-002', 'Passenger Bus Cobus 3000', 'BUS', 'CB-2019-005', 'Bus Stop 2', 'AVAILABLE')
on conflict (code) do nothing;

-- Seed employees (radnici koji ne moraju biti auth users)
insert into public.employees (card_id, name, department, role) values
  ('EMP-1001', 'Vukan Vojvodić', 'Ramp', 'Operator'),
  ('EMP-1002', 'Milena Popović', 'Ramp', 'Operator'),
  ('EMP-1003', 'Novak Knežević', 'Ramp', 'Senior Operator'),
  ('EMP-1004', 'Milica Medenica', 'Maintenance', 'Technician'),
  ('EMP-1005', 'Blažo Adžić', 'Operations', 'Supervisor')
on conflict (card_id) do nothing;

-- =====================================================
-- 9. DEMO AUTH USERS - kreirati ručno u Supabase Dashboard > Authentication > Users
-- Za svakog korisnika dodati metadata:
--   { "full_name": "...", "card_id": "EMP-1001", "role": "operator"|"engineer"|"admin", "department": "Ramp" }
--
-- Preporučeni demo korisnici:
--   operator@gse.control    / DemoPass123!  → role: operator  (Vukan Vojvodić, EMP-1001)
--   engineer@gse.control    / DemoPass123!  → role: engineer  (Milica Medenica, EMP-1004)
--   admin@gse.control       / DemoPass123!  → role: admin     (Blažo Adžić, EMP-1005)
-- =====================================================
