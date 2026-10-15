-- 035: Tok radionice - doveženo u radionicu, status (upozorenje svaka 3 dana), pregled šefa službe, preuzimanje iz radionice.
-- Preuzimanje prijave (acknowledged_at/by) već postoji. Pokrenuti ručno u Supabase SQL editoru.

alter table public.damage_reports
  add column if not exists workshop_arrived_at   timestamptz,
  add column if not exists workshop_arrived_by   text,
  add column if not exists chief_name            text,
  add column if not exists chief_inspected_at    timestamptz,
  add column if not exists chief_result          text check (chief_result in ('OK', 'FAILED')),
  add column if not exists chief_note            text,
  add column if not exists handover_to           text,
  add column if not exists handover_at           timestamptz,
  add column if not exists last_status_text      text,
  add column if not exists last_status_at        timestamptz,
  add column if not exists last_status_by        text,
  add column if not exists stale_notified_at     timestamptz;

create table if not exists public.repair_status_log (
  id            uuid primary key default gen_random_uuid(),
  damage_id     uuid not null references public.damage_reports(id) on delete cascade,
  kind          text not null check (kind in ('TAKEN', 'ARRIVED', 'STATUS', 'CHIEF_OK', 'CHIEF_FAILED', 'HANDOVER')),
  text          text,
  by_name       text not null,
  by_card_id    text,
  warned        boolean not null default false,   -- true = unos nastao nakon upozorenja "predugo u radionici"
  at            timestamptz not null default now()
);
create index if not exists repair_status_log_damage_idx on public.repair_status_log (damage_id, at desc);

alter table public.repair_status_log enable row level security;
drop policy if exists "RepairLog: engineer+ read" on public.repair_status_log;
create policy "RepairLog: engineer+ read" on public.repair_status_log for select
  using (public.current_user_role() in ('engineer', 'admin'));
drop policy if exists "RepairLog: engineer+ write" on public.repair_status_log;
create policy "RepairLog: engineer+ write" on public.repair_status_log for insert
  with check (public.current_user_role() in ('engineer', 'admin'));

-- Upit za "čeka preuzimanje iz radionice" i upozorenja
create index if not exists damage_reports_handover_idx on public.damage_reports (status, workshop_arrived_at, handover_at);
