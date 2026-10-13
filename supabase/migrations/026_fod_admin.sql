-- 026: FOD — obrada prijava (status, napomena admina); admin uređuje prijavu
alter table public.fod_reports add column if not exists status text not null default 'NEW';
alter table public.fod_reports add column if not exists admin_notes text;
alter table public.fod_reports add column if not exists updated_by text;
alter table public.fod_reports add column if not exists updated_at timestamptz default now();

alter table public.fod_reports drop constraint if exists fod_reports_status_check;
alter table public.fod_reports add constraint fod_reports_status_check
  check (status in ('NEW', 'IN_REVIEW', 'CLOSED'));
-- Pravilo za izmjenu (engineer+, migracija 024) već postoji; admin ulazi u "engineer+".
