-- 023: nepromjenjiv trag izmjena (audit trail)
-- 1) audit_log postaje append-only: UPDATE/DELETE/TRUNCATE se odbijaju (i za service-role).
-- 2) okidači na bazi bilježe ključne izmjene BEZ obzira na to kroz koji kod su nastale.
-- NAPOMENA: brisanje po isteku perioda čuvanja radi samo vlasnik baze, uz privremeno
-- isključivanje okidača (alter table public.audit_log disable trigger ...). Period čuvanja
-- odrediti sa osobom zaduženom za usklađenost.

create or replace function public.fn_audit_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_log je nepromjenjiv (% nije dozvoljen)', tg_op using errcode = 'insufficient_privilege';
end $$;

drop trigger if exists trg_audit_log_no_update on public.audit_log;
create trigger trg_audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.fn_audit_immutable();

drop trigger if exists trg_audit_log_no_truncate on public.audit_log;
create trigger trg_audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function public.fn_audit_immutable();

-- Razlika između starog i novog reda (samo promijenjena polja), bez "šuma"
create or replace function public.fn_jsonb_diff(p_old jsonb, p_new jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_object_agg(n.key, jsonb_build_object('from', p_old -> n.key, 'to', n.value)), '{}'::jsonb)
  from jsonb_each(p_new) n
  where n.key not in ('updated_at', 'created_at')
    and (p_old -> n.key) is distinct from n.value
$$;

create or replace function public.fn_audit_capture()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_details jsonb;
  v_id text;
  v_email text;
begin
  if tg_op = 'INSERT' then
    v_details := to_jsonb(new);
    v_id := (to_jsonb(new) ->> 'id');
  elsif tg_op = 'UPDATE' then
    v_details := public.fn_jsonb_diff(to_jsonb(old), to_jsonb(new));
    if v_details = '{}'::jsonb then return new; end if;
    v_id := (to_jsonb(new) ->> 'id');
  else
    v_details := to_jsonb(old);
    v_id := (to_jsonb(old) ->> 'id');
  end if;

  -- slike su teške i nisu potrebne u tragu
  v_details := v_details - 'photo_data';

  begin
    v_email := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email';
  exception when others then
    v_email := null;
  end;

  insert into public.audit_log (user_id, user_email, action, entity_type, entity_id, details)
  values (auth.uid(), v_email, upper(tg_table_name) || '_' || tg_op, tg_table_name, v_id, v_details::text);

  return coalesce(new, old);
end $$;

-- Sredstva: samo promjena statusa
drop trigger if exists trg_audit_equipment_status on public.equipment;
create trigger trg_audit_equipment_status after update of status on public.equipment
  for each row when (old.status is distinct from new.status)
  execute function public.fn_audit_capture();

-- Kvarovi: prijava i svaka izmjena (preuzimanje, popravka, odobrenje)
drop trigger if exists trg_audit_damage_reports on public.damage_reports;
create trigger trg_audit_damage_reports after insert or update or delete on public.damage_reports
  for each row execute function public.fn_audit_capture();

-- Dozvole vozača i kvalifikacije radionice
drop trigger if exists trg_audit_driver_authorizations on public.driver_authorizations;
create trigger trg_audit_driver_authorizations after insert or update or delete on public.driver_authorizations
  for each row execute function public.fn_audit_capture();

drop trigger if exists trg_audit_maintenance_skills on public.maintenance_skills;
create trigger trg_audit_maintenance_skills after insert or update or delete on public.maintenance_skills
  for each row execute function public.fn_audit_capture();
