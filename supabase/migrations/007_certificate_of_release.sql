-- =====================================================
-- GSE Control - Migration 007: Certificate of Release to Service
-- EASA Part-145.A.50 - CRS required before returning equipment to service
-- =====================================================

create table if not exists public.certificates_of_release (
  id uuid primary key default gen_random_uuid(),
  crs_number text not null unique,
  equipment_id uuid references public.equipment(id) on delete cascade,
  equipment_code text not null,
  equipment_name text not null,

  damage_report_id uuid,
  maintenance_log_id uuid,

  work_description text not null,
  work_order_number text,

  certifier_card_id text not null,
  certifier_name text not null,
  certifier_role text default 'CERTIFYING_STAFF',
  certifier_signature text,

  status text not null default 'VALID' check (status in ('VALID', 'REVOKED', 'SUPERSEDED')),

  release_date timestamptz default now(),
  valid_until timestamptz,

  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_crs_equipment on public.certificates_of_release(equipment_id);
create index if not exists idx_crs_number on public.certificates_of_release(crs_number);
create index if not exists idx_crs_status on public.certificates_of_release(status);
create index if not exists idx_crs_date on public.certificates_of_release(release_date desc);

alter table public.certificates_of_release enable row level security;

-- Javno čitanje (radnici moraju vidjeti CRS na opremi)
drop policy if exists "CRS: public read" on public.certificates_of_release;
create policy "CRS: public read"
  on public.certificates_of_release for select
  using (true);

-- Samo inženjer/admin mogu kreirati CRS
drop policy if exists "CRS: engineer+ insert" on public.certificates_of_release;
create policy "CRS: engineer+ insert"
  on public.certificates_of_release for insert
  with check (public.current_user_role() in ('engineer', 'admin'));

-- Samo admin može mijenjati/brisati CRS
drop policy if exists "CRS: admin update" on public.certificates_of_release;
create policy "CRS: admin update"
  on public.certificates_of_release for update
  using (public.current_user_role() = 'admin');

drop policy if exists "CRS: admin delete" on public.certificates_of_release;
create policy "CRS: admin delete"
  on public.certificates_of_release for delete
  using (public.current_user_role() = 'admin');

-- Seed demo CRS
insert into public.certificates_of_release (crs_number, equipment_id, equipment_code, equipment_name, work_description, work_order_number, certifier_card_id, certifier_name, certifier_role, release_date, notes)
select 'CRS-2026-001', id, code, name, 'Zamjena ulja i filtera - preventivno održavanje na 500h', 'WO-2026-001', 'EMP-1004', 'Milica Medenica', 'ENGINEER', '2026-01-15'::timestamptz, 'Sve provjere prošle uspješno'
from public.equipment where code = 'GSE-TOW-001'
and not exists (select 1 from public.certificates_of_release where crs_number = 'CRS-2026-001');

comment on table public.certificates_of_release is 'EASA Part-145.A.50 - Certificate of Release to Service';
