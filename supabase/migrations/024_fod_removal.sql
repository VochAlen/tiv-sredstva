-- 024: FOD — evidencija uklanjanja
-- Prijava FOD-a više ne tvrdi da je predmet uklonjen dok to neko ne potvrdi.
alter table public.fod_reports add column if not exists removed_at timestamptz;
alter table public.fod_reports add column if not exists removed_by text;
alter table public.fod_reports alter column removed set default false;

-- Inženjer/admin smije potvrditi uklanjanje
drop policy if exists "FOD: engineer+ update" on public.fod_reports;
create policy "FOD: engineer+ update" on public.fod_reports
  for update using (public.current_user_role() in ('engineer', 'admin'))
  with check (public.current_user_role() in ('engineer', 'admin'));

-- Trag izmjena (zahtijeva 023_audit_trail.sql)
drop trigger if exists trg_audit_fod_reports on public.fod_reports;
create trigger trg_audit_fod_reports after insert or update on public.fod_reports
  for each row execute function public.fn_audit_capture();
