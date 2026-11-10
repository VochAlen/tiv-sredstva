-- 040: Ovlaštenje vozila (ADR.OPS.B.026) - zapis po sredstvu + istorija promjena
-- Pokrenuti ručno u Supabase SQL editoru (nakon 039). Bezbjedno za ponovno pokretanje.

create table if not exists public.vehicle_authorisations (
  id                    uuid primary key default gen_random_uuid(),
  equipment_id          uuid not null unique references public.equipment(id) on delete restrict,
  equipment_code        text not null,
  status                text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED','REVOKED')),
  area_apron            boolean not null default false,
  area_other            boolean not null default false,
  area_manoeuvring      boolean not null default false,
  call_sign             text,
  radio_equipped        boolean not null default false,
  transponder_equipped  boolean not null default false,
  marking_ok            boolean not null default false,
  lighting_ok           boolean not null default false,
  issued_at             timestamptz not null default now(),
  issued_by             text,
  notes                 text,
  reason                text,
  changed_by            text,
  updated_at            timestamptz not null default now()
);

create table if not exists public.vehicle_authorisation_log (
  id              uuid primary key default gen_random_uuid(),
  auth_id         uuid not null references public.vehicle_authorisations(id) on delete restrict,
  equipment_code  text not null,
  action          text not null,
  reason          text,
  by_name         text,
  at              timestamptz not null default now()
);
create index if not exists vehicle_auth_log_idx on public.vehicle_authorisation_log (auth_id, at desc);

alter table public.vehicle_authorisations enable row level security;
alter table public.vehicle_authorisation_log enable row level security;

drop policy if exists "VehAuth: engineer+ read" on public.vehicle_authorisations;
create policy "VehAuth: engineer+ read" on public.vehicle_authorisations for select
  using (public.current_user_role() in ('engineer', 'admin'));
drop policy if exists "VehAuth: engineer+ write" on public.vehicle_authorisations;
create policy "VehAuth: engineer+ write" on public.vehicle_authorisations for all
  using (public.current_user_role() in ('engineer', 'admin'))
  with check (public.current_user_role() in ('engineer', 'admin'));

drop policy if exists "VehAuthLog: engineer+ read" on public.vehicle_authorisation_log;
create policy "VehAuthLog: engineer+ read" on public.vehicle_authorisation_log for select
  using (public.current_user_role() in ('engineer', 'admin'));
drop policy if exists "VehAuthLog: engineer+ insert" on public.vehicle_authorisation_log;
create policy "VehAuthLog: engineer+ insert" on public.vehicle_authorisation_log for insert
  with check (public.current_user_role() in ('engineer', 'admin'));

-- Rok čuvanja (ADR.OR.D.035(d)(8)): ovlaštenja vozila se ne brišu (opoziv umjesto brisanja)
create or replace function public.fn_block_delete_always()
returns trigger language plpgsql as $$
begin
  raise exception 'Zapis (%) se ne briše: ovlaštenja vozila se čuvaju najmanje 4 godine nakon povlačenja vozila (opozovite ovlaštenje).', tg_table_name
    using errcode = 'P0001';
end;
$$;
drop trigger if exists trg_no_delete on public.vehicle_authorisations;
create trigger trg_no_delete before delete on public.vehicle_authorisations for each row execute function public.fn_block_delete_always();
drop trigger if exists trg_no_delete on public.vehicle_authorisation_log;
create trigger trg_no_delete before delete on public.vehicle_authorisation_log for each row execute function public.fn_block_delete_always();
