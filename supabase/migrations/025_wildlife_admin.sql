-- 025: Wildlife — obrada prijava (status, napomena admina) i uređivanje od strane admina
alter table public.wildlife_reports add column if not exists status text not null default 'NEW';
alter table public.wildlife_reports add column if not exists admin_notes text;
alter table public.wildlife_reports add column if not exists updated_by text;
alter table public.wildlife_reports add column if not exists updated_at timestamptz default now();

alter table public.wildlife_reports drop constraint if exists wildlife_reports_status_check;
alter table public.wildlife_reports add constraint wildlife_reports_status_check
  check (status in ('NEW', 'IN_REVIEW', 'CLOSED'));

-- Samo admin smije mijenjati prijave (brisanje namjerno nije dozvoljeno — evidencija)
drop policy if exists "Wildlife: admin update" on public.wildlife_reports;
create policy "Wildlife: admin update" on public.wildlife_reports
  for update using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Trag izmjena (zahtijeva 023_audit_trail.sql)
drop trigger if exists trg_audit_wildlife_reports on public.wildlife_reports;
create trigger trg_audit_wildlife_reports after insert or update on public.wildlife_reports
  for each row execute function public.fn_audit_capture();
