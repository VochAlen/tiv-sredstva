-- =====================================================
-- 020: Nove EASA ADR funkcije prepoznate u reviziji martovske (2026)
-- verzije EAR za aerodrome (Uredba (EU) 139/2014):
--
--  - ADR.OPS.B.016 Foreign object debris (FOD) kontrolni program
--  - ADR.OPS.B.020 Wildlife strike hazard reduction
--  - ADR.OR.C.045  Fitness for duty (alkohol/psihoaktivne supstance) —
--    bilježi se SAMO potvrda (da/ne) i vrijeme, nikada zdravstveni podatak
--
-- Sve tri su JAVNE funkcije (radnici prijavljuju bez login-a, isto kao
-- gorivo/parking/incidenti), pa INSERT ostaje otvoren za anon, a SELECT je
-- ograničen na authenticated/engineer+ — isti obrazac kao migracije 017/019
-- (RLS usklađen sa app-layer namjerom, ID generisan unaprijed u app sloju
-- da se izbjegne .select() posle .insert()).
-- =====================================================

-- ---------- FOD REPORTS ----------
CREATE TABLE IF NOT EXISTS public.fod_reports (
  id uuid primary key default gen_random_uuid(),
  location text not null,
  item_type text not null default 'OTHER',
  description text not null,

  aircraft_part_suspected boolean default false,
  removed boolean default true,
  atc_notified boolean default false,

  found_by_card_id text,
  found_by_name text not null,

  found_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_fod_found_at on public.fod_reports(found_at desc);
create index if not exists idx_fod_location on public.fod_reports(location);

alter table public.fod_reports enable row level security;

drop policy if exists "FOD: public insert" on public.fod_reports;
create policy "FOD: public insert" on public.fod_reports
  for insert with check (true);

drop policy if exists "FOD: engineer+ read" on public.fod_reports;
create policy "FOD: engineer+ read" on public.fod_reports
  for select using (public.current_user_role() in ('engineer', 'admin'));

comment on table public.fod_reports is 'ADR.OPS.B.016 - Foreign object debris control programme';

-- ---------- WILDLIFE REPORTS ----------
CREATE TABLE IF NOT EXISTS public.wildlife_reports (
  id uuid primary key default gen_random_uuid(),
  species text not null,
  count integer default 1,
  location text not null,
  strike boolean default false,

  action_taken text,
  damage_description text,

  reported_by_card_id text,
  reported_by_name text not null,

  observed_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_wildlife_observed_at on public.wildlife_reports(observed_at desc);
create index if not exists idx_wildlife_species on public.wildlife_reports(species);

alter table public.wildlife_reports enable row level security;

drop policy if exists "Wildlife: public insert" on public.wildlife_reports;
create policy "Wildlife: public insert" on public.wildlife_reports
  for insert with check (true);

drop policy if exists "Wildlife: engineer+ read" on public.wildlife_reports;
create policy "Wildlife: engineer+ read" on public.wildlife_reports
  for select using (public.current_user_role() in ('engineer', 'admin'));

comment on table public.wildlife_reports is 'ADR.OPS.B.020 - Wildlife strike hazard reduction';

-- ---------- FITNESS DECLARATIONS ----------
CREATE TABLE IF NOT EXISTS public.fitness_declarations (
  id uuid primary key default gen_random_uuid(),
  employee_card_id text,
  employee_name text not null,
  confirmed boolean default true,

  declared_at timestamptz default now()
);

create index if not exists idx_fitness_declared_at on public.fitness_declarations(declared_at desc);
create index if not exists idx_fitness_card on public.fitness_declarations(employee_card_id);

alter table public.fitness_declarations enable row level security;

drop policy if exists "Fitness: public insert" on public.fitness_declarations;
create policy "Fitness: public insert" on public.fitness_declarations
  for insert with check (true);

drop policy if exists "Fitness: engineer+ read" on public.fitness_declarations;
create policy "Fitness: engineer+ read" on public.fitness_declarations
  for select using (public.current_user_role() in ('engineer', 'admin'));

comment on table public.fitness_declarations is 'ADR.OR.C.045 - Fitness for duty potvrda (bez zdravstvenih podataka)';
