-- 028: dnevni pregled -> prijave kvara + ograničenja upotrebe + radni nalog popravke
-- Idempotentno. Zavisi od 016/018 (damage_reports.category, equipment.active_restrictions) i 027.

-- ---------------------------------------------------
-- 1. Nove kolone na prijavi kvara
-- ---------------------------------------------------
alter table public.damage_reports
  add column if not exists restriction_code text,      -- npr. DAYTIME_ONLY; ako je popunjeno, kvar ograničava upotrebu (ne blokira)
  add column if not exists restriction_label text,
  add column if not exists source_item text,           -- npr. 'daily:lights' - sprječava dupliranje iste prijave
  add column if not exists parts_json jsonb,           -- [{ "name": "...", "qty": 2 }]
  add column if not exists work_hours numeric,
  add column if not exists work_cost numeric,
  add column if not exists worker_names text;          -- ko je radio popravku (slobodan tekst, može više imena)

create index if not exists idx_damage_source_item on public.damage_reports(equipment_id, source_item) where source_item is not null;

-- ---------------------------------------------------
-- 2. Ograničenja koja prate otvorene prijave kvara
--    equipment.active_restrictions = ograničenja iz zaduženja (bez damageId)
--                                   + ograničenja otvorenih prijava (sa damageId).
--    Razduženje/zaduženje više ne može obrisati ograničenje dok je kvar otvoren.
-- ---------------------------------------------------
create or replace function public.fn_open_restrictions(p_equipment_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'code', restriction_code,
      'label', coalesce(restriction_label, restriction_code),
      'source', coalesce(source_item, 'damage'),
      'since', to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'damageId', id
    ) order by created_at), '[]'::jsonb)
  from public.damage_reports
  where equipment_id = p_equipment_id
    and status <> 'RESOLVED'
    and restriction_code is not null;
$$;

create or replace function public.fn_equipment_restrictions_guard()
returns trigger
language plpgsql
as $$
begin
  new.active_restrictions := nullif(
    coalesce((select jsonb_agg(f) from jsonb_array_elements(coalesce(new.active_restrictions, '[]'::jsonb)) f where not (f ? 'damageId')), '[]'::jsonb)
    || public.fn_open_restrictions(new.id),
    '[]'::jsonb);
  return new;
end;
$$;

drop trigger if exists trg_equipment_restrictions_guard on public.equipment;
create trigger trg_equipment_restrictions_guard
  before update of active_restrictions on public.equipment
  for each row execute function public.fn_equipment_restrictions_guard();

create or replace function public.fn_damage_sync_restrictions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := coalesce(new.equipment_id, old.equipment_id);
begin
  if v_id is null then return coalesce(new, old); end if;
  -- postavlja se na vrijednost koju guard-trigger odmah preračuna (zadrži ne-damage ograničenja + otvorene kvarove)
  update public.equipment e
     set active_restrictions = e.active_restrictions
   where e.id = v_id
     and e.active_restrictions is distinct from nullif(
        coalesce((select jsonb_agg(f) from jsonb_array_elements(coalesce(e.active_restrictions, '[]'::jsonb)) f where not (f ? 'damageId')), '[]'::jsonb)
        || public.fn_open_restrictions(e.id), '[]'::jsonb);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_damage_sync_restrictions on public.damage_reports;
create trigger trg_damage_sync_restrictions
  after insert or delete or update of status, restriction_code on public.damage_reports
  for each row execute function public.fn_damage_sync_restrictions();

-- ---------------------------------------------------
-- 3. Dnevni pregled: svaka neispravna stavka -> prijava kvara; težina određuje ishod
--    p_checklist: [{ id, label, passed, severity, category, damageSeverity, restrictionCode, restrictionLabel }]
-- ---------------------------------------------------
create or replace function public.fn_create_daily_inspection(
  p_equipment_code text,
  p_inspector_card_id text,
  p_inspector_name text,
  p_shift text,
  p_checklist jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_equipment record;
  v_item jsonb;
  v_card text := upper(trim(p_inspector_card_id));
  v_failed_count int := 0;
  v_blocking int := 0;
  v_restrictive int := 0;
  v_issues jsonb := '[]'::jsonb;
  v_result text;
  v_inspection_id uuid;
  v_sev text;
  v_dmg_sev text;
  v_source text;
  v_new_damages int := 0;
begin
  select * into v_equipment from public.equipment where code = p_equipment_code for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Sredstvo nije pronađeno');
  end if;

  for v_item in select * from jsonb_array_elements(p_checklist) loop
    if (v_item->>'passed')::boolean is distinct from false then continue; end if;
    v_failed_count := v_failed_count + 1;
    v_issues := v_issues || jsonb_build_array(v_item);
    v_sev := coalesce(v_item->>'severity', 'MINOR');
    if v_sev = 'BLOCKING' then v_blocking := v_blocking + 1;
    elsif v_sev = 'RESTRICTIVE' then v_restrictive := v_restrictive + 1;
    end if;
  end loop;

  v_result := case
    when v_blocking > 0 then 'UNFIT'
    when v_failed_count > 0 then 'CONDITIONAL'
    else 'FIT'
  end;

  insert into public.daily_inspections
    (equipment_id, equipment_code, equipment_name, inspector_card_id, inspector_name, shift, checklist_json, result, notes, issues_found, issues_json)
  values
    (v_equipment.id, v_equipment.code, v_equipment.name, v_card, p_inspector_name, p_shift, p_checklist::text, v_result, p_notes, v_failed_count, v_issues::text)
  returning id into v_inspection_id;

  -- Prijava kvara za svaku neispravnu stavku (osim ako za tu stavku već postoji otvorena)
  for v_item in select * from jsonb_array_elements(v_issues) loop
    v_source := 'daily:' || (v_item->>'id');
    if exists (select 1 from public.damage_reports where equipment_id = v_equipment.id and source_item = v_source and status <> 'RESOLVED') then
      continue;
    end if;
    v_sev := coalesce(v_item->>'severity', 'MINOR');
    v_dmg_sev := case when v_sev = 'BLOCKING' then coalesce(v_item->>'damageSeverity', 'MAJOR') else 'MINOR' end;
    if v_dmg_sev not in ('MINOR', 'MAJOR', 'CRITICAL') then v_dmg_sev := 'MAJOR'; end if;

    insert into public.damage_reports
      (equipment_id, equipment_code, equipment_name, reported_by_card_id, reported_by_name, severity, description, status,
       category, restriction_code, restriction_label, source_item)
    values
      (v_equipment.id, v_equipment.code, v_equipment.name, v_card, p_inspector_name, v_dmg_sev,
       format('Dnevni pregled: neispravno - %s%s%s', v_item->>'label',
              case when v_sev = 'RESTRICTIVE' then format(' (ograničenje: %s)', coalesce(v_item->>'restrictionLabel', '')) else '' end,
              case when p_notes is not null and length(trim(p_notes)) > 0 then format('. Napomena: %s', p_notes) else '' end),
       'OPEN',
       case when (v_item->>'category') in ('MEHANIKA','ELEKTRIKA','HIDRAULIKA','BEZBJEDNOST','OPSTE') then v_item->>'category' else null end,
       case when v_sev = 'RESTRICTIVE' then coalesce(v_item->>'restrictionCode', upper(v_item->>'id')) else null end,
       case when v_sev = 'RESTRICTIVE' then coalesce(v_item->>'restrictionLabel', 'Ograničena upotreba') else null end,
       v_source);
    v_new_damages := v_new_damages + 1;
  end loop;

  if v_result = 'UNFIT' then
    update public.equipment set
      fitness_status = 'UNFIT',
      fitness_calculated_at = now(),
      fitness_reason = format('Dnevni pregled: neispravno (%s blokirajućih stavki)', v_blocking),
      status = case when status = 'ASSIGNED' then status else 'OUT_OF_SERVICE' end,
      notes = format('Dnevni pregled %s (%s): sredstvo neispravno - vidi prijave kvarova', to_char(now(), 'YYYY-MM-DD'), p_inspector_name)
    where id = v_equipment.id;
  elsif v_result = 'CONDITIONAL' then
    update public.equipment set
      fitness_status = 'CONDITIONAL',
      fitness_calculated_at = now(),
      fitness_reason = case when v_restrictive > 0 then 'Dnevni pregled: ispravno sa ograničenjem' else 'Dnevni pregled: manji nedostaci' end
    where id = v_equipment.id;
  else
    update public.equipment set fitness_status = 'FIT', fitness_calculated_at = now(), fitness_reason = null
    where id = v_equipment.id;
  end if;

  return jsonb_build_object('ok', true, 'id', v_inspection_id, 'result', v_result,
                            'blocking', v_blocking, 'restrictive', v_restrictive, 'damageReports', v_new_damages);
end;
$$;

grant execute on function public.fn_create_daily_inspection(text, text, text, text, jsonb, text) to anon, authenticated;
