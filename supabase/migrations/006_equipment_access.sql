-- =====================================================
-- GSE Control - Migration 006: Equipment Access Control
-- Admin može ograničiti ko može zadužiti koje sredstvo
-- =====================================================

-- 1. Dodaj restrictedAccess polje na equipment
alter table public.equipment
  add column if not exists restricted_access boolean default false;

-- 2. Kreiraj equipment_access tabelu
create table if not exists public.equipment_access (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid references public.equipment(id) on delete cascade,
  equipment_code text not null,
  employee_card_id text not null,
  employee_name text not null,
  granted_by text,
  created_at timestamptz default now()
);

create unique index if not exists idx_access_eq_emp on public.equipment_access(equipment_id, employee_card_id);
create index if not exists idx_access_equipment on public.equipment_access(equipment_id);
create index if not exists idx_access_employee on public.equipment_access(employee_card_id);

alter table public.equipment_access enable row level security;

-- Javno čitanje (radnici moraju provjeriti da li imaju pristup)
drop policy if exists "Access: public read" on public.equipment_access;
create policy "Access: public read"
  on public.equipment_access for select
  using (true);

-- Javni upis (radnici se automatski dodaju pri check-out za neograničena sredstva)
drop policy if exists "Access: public insert" on public.equipment_access;
create policy "Access: public insert"
  on public.equipment_access for insert
  with check (true);

-- Samo admin može brisati dozvole
drop policy if exists "Access: admin delete" on public.equipment_access;
create policy "Access: admin delete"
  on public.equipment_access for delete
  using (public.current_user_role() = 'admin');

-- Samo admin može uređivati dozvole
drop policy if exists "Access: admin update" on public.equipment_access;
create policy "Access: admin update"
  on public.equipment_access for update
  using (public.current_user_role() = 'admin');

comment on table public.equipment_access is 'Access control - who can check out which equipment';
comment on column public.equipment.restricted_access is 'If true, only authorized workers can check out this equipment';
