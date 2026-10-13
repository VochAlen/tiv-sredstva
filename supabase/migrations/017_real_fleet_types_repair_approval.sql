-- =====================================================
-- 017 - Stvarni tipovi GSE opreme + dvostruka potvrda popravke
-- =====================================================

-- ---------------------------------------------------
-- 1. Proširi equipment.type CHECK na stvarne kategorije flote
-- ---------------------------------------------------

alter table public.equipment drop constraint if exists equipment_type_check;
alter table public.equipment add constraint equipment_type_check
  check (type in (
    'GPU','AIR_STARTER','TOW_TRACTOR','BELT_LOADER','CARGO_LOADER','STAIRS',
    'WATER','LAVATORY','PUSHBACK','FORKLIFT','DOLLY','BUS','FIRE_TRUCK',
    'AMBULANCE','FOLLOW_ME','SERVICE_CAR','OTHER'
  ));

-- ---------------------------------------------------
-- 2. Proširi damage_reports.status - dodaj AWAITING_APPROVAL
-- ---------------------------------------------------

alter table public.damage_reports drop constraint if exists damage_reports_status_check;
alter table public.damage_reports add constraint damage_reports_status_check
  check (status in ('OPEN','IN_REPAIR','AWAITING_APPROVAL','RESOLVED'));

-- ---------------------------------------------------
-- 3. Nove kolone - dvostruka potvrda popravke
-- ---------------------------------------------------

alter table public.equipment
  add column if not exists needs_first_use_confirmation boolean not null default false;

alter table public.damage_reports
  add column if not exists repaired_by_card_id text,
  add column if not exists repaired_by_name text,
  add column if not exists repaired_at timestamptz,
  add column if not exists approved_by_card_id text,
  add column if not exists approved_by_name text,
  add column if not exists approved_at timestamptz;

alter table public.assignments
  add column if not exists first_use_confirmed boolean not null default false;

-- ---------------------------------------------------
-- 4. fn_check_out_equipment - dodaj parametar p_first_use_confirmed
-- ---------------------------------------------------
-- Ako je equipment.needs_first_use_confirmation = true, radnik MORA
-- eksplicitno potvrditi (checkbox u aplikaciji) da je pregledao sredstvo i
-- da je ispravno nakon popravke, prije nego što se checkout uopšte obradi.
-- Bez toga se zaduživanje odbija - ovo je namjerno "tvrda" prepreka.

drop function if exists public.fn_check_out_equipment(text, text, text, jsonb, text, text, text, text);

create or replace function public.fn_check_out_equipment(
  p_equipment_code text,
  p_employee_card_id text,
  p_employee_name text,
  p_checklist jsonb,
  p_inspection_notes text default null,
  p_shift text default null,
  p_damage_description text default null,
  p_damage_severity text default 'MINOR',
  p_first_use_confirmed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_equipment record;
  v_employee_id uuid;
  v_card text := upper(trim(p_employee_card_id));
  v_blocking_count int;
  v_restrictive_items jsonb;
  v_restrictions jsonb;
  v_damage_id uuid;
  v_assignment_id uuid;
  v_inspection_result text;
begin
  select * into v_equipment from public.equipment where code = p_equipment_code for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Sredstvo nije pronađeno');
  end if;

  if v_equipment.status in ('OUT_OF_SERVICE', 'MAINTENANCE') then
    return jsonb_build_object('ok', false, 'error', format('Sredstvo je trenutno u statusu: %s. Zaduživanje nije moguće.', v_equipment.status));
  end if;

  if v_equipment.status = 'ASSIGNED' then
    return jsonb_build_object('ok', false, 'error', 'Sredstvo je već zaduženo od strane drugog radnika.');
  end if;

  -- Dvostruka potvrda popravke - prvi radnik nakon odobrenja šefa mora potvrditi
  if v_equipment.needs_first_use_confirmation and not p_first_use_confirmed then
    return jsonb_build_object('ok', false, 'error', 'Sredstvo je nedavno popravljeno. Morate potvrditi da ste ga pregledali i da je ispravno prije zaduživanja.', 'needsFirstUseConfirmation', true);
  end if;

  if v_equipment.restricted_access then
    if not exists (
      select 1 from public.equipment_access
      where equipment_id = v_equipment.id and employee_card_id = v_card
    ) then
      return jsonb_build_object('ok', false, 'error', 'Nemate dozvolu za zaduživanje ovog sredstva. Kontaktirajte supervizora.');
    end if;
  end if;

  declare
    v_auth record;
  begin
    select * into v_auth from public.driver_authorizations where employee_card_id = v_card;
    if not found or not v_auth.active then
      return jsonb_build_object('ok', false, 'error', 'Nemate važeću airside vozačku dozvolu. Kontaktirajte supervizora.');
    end if;
    if v_auth.valid_until is not null and v_auth.valid_until < now() then
      return jsonb_build_object('ok', false, 'error', 'Vaša airside vozačka dozvola je istekla.');
    end if;
    if v_auth.training_expiry is not null and v_auth.training_expiry < now() then
      return jsonb_build_object('ok', false, 'error', 'Vaša obuka za airside vožnju je istekla.');
    end if;
  end;

  declare
    v_qual record;
  begin
    select * into v_qual from public.equipment_qualifications
      where employee_card_id = v_card and equipment_type = v_equipment.type;
    if not found then
      return jsonb_build_object('ok', false, 'error', format('Nemate evidentiranu kvalifikaciju za tip opreme "%s". Kontaktirajte supervizora za obuku/ovlašćenje.', v_equipment.type));
    end if;
    if v_qual.valid_until is not null and v_qual.valid_until < current_date then
      return jsonb_build_object('ok', false, 'error', format('Vaša kvalifikacija za "%s" je istekla. Potrebna obnova obuke.', v_equipment.type));
    end if;
  end;

  insert into public.employees (card_id, name)
  values (v_card, p_employee_name)
  on conflict (card_id) do update set name = excluded.name
  returning id into v_employee_id;

  select count(*) into v_blocking_count
    from jsonb_array_elements(p_checklist) as item
    where (item->>'severity') = 'BLOCKING' and (item->>'passed')::boolean = false;

  select jsonb_agg(item) into v_restrictive_items
    from jsonb_array_elements(p_checklist) as item
    where (item->>'severity') = 'RESTRICTIVE' and (item->>'passed')::boolean = false;

  if v_blocking_count > 0 then
    v_inspection_result := case when p_damage_severity = 'CRITICAL' then 'OUT_OF_SERVICE' else 'MAJOR_DAMAGE' end;

    insert into public.damage_reports (equipment_id, equipment_code, equipment_name, reported_by_card_id, reported_by_name, employee_id, severity, description, status)
    values (v_equipment.id, v_equipment.code, v_equipment.name, v_card, p_employee_name, v_employee_id, coalesce(p_damage_severity, 'MAJOR'), coalesce(p_damage_description, 'Kvar utvrđen na pre-use checklisti (blokirajuće stavke)'), 'OPEN')
    returning id into v_damage_id;

    update public.equipment
      set status = 'OUT_OF_SERVICE',
          active_restrictions = null,
          needs_first_use_confirmation = false,
          notes = format('Oštećenje prijavljeno %s od %s: %s', to_char(now(), 'YYYY-MM-DD'), p_employee_name, left(coalesce(p_damage_description, ''), 100))
      where id = v_equipment.id;

    insert into public.assignments (equipment_id, equipment_code, equipment_name, employee_id, employee_card_id, employee_name, action, inspection_result, inspection_notes, checklist_json, shift, damage_report_id, restrictions_json, first_use_confirmed)
    values (v_equipment.id, v_equipment.code, v_equipment.name, v_employee_id, v_card, p_employee_name, 'CHECK_OUT', v_inspection_result, p_inspection_notes, p_checklist::text, p_shift, v_damage_id, null, p_first_use_confirmed);

    return jsonb_build_object('ok', false, 'error', 'Sredstvo ne može biti zaduženo - utvrđen kvar koji blokira upotrebu. Status promijenjen u OUT_OF_SERVICE.', 'damageReportId', v_damage_id, 'semaforResult', 'BLOCKED');
  end if;

  if v_restrictive_items is not null and jsonb_array_length(v_restrictive_items) > 0 then
    select jsonb_agg(jsonb_build_object(
        'code', item->>'restrictionCode',
        'label', item->>'restrictionLabel',
        'source', item->>'id',
        'since', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      )) into v_restrictions
      from jsonb_array_elements(v_restrictive_items) as item;

    update public.equipment set status = 'ASSIGNED', active_restrictions = v_restrictions, needs_first_use_confirmation = false where id = v_equipment.id;

    insert into public.assignments (equipment_id, equipment_code, equipment_name, employee_id, employee_card_id, employee_name, action, inspection_result, inspection_notes, checklist_json, shift, damage_report_id, restrictions_json, first_use_confirmed)
    values (v_equipment.id, v_equipment.code, v_equipment.name, v_employee_id, v_card, p_employee_name, 'CHECK_OUT', 'MINOR_DAMAGE', p_inspection_notes, p_checklist::text, p_shift, null, v_restrictions, p_first_use_confirmed)
    returning id into v_assignment_id;

    return jsonb_build_object('ok', true, 'semaforResult', 'RESTRICTED', 'restrictions', v_restrictions, 'assignmentId', v_assignment_id);
  end if;

  update public.equipment set status = 'ASSIGNED', active_restrictions = null, needs_first_use_confirmation = false where id = v_equipment.id;

  insert into public.assignments (equipment_id, equipment_code, equipment_name, employee_id, employee_card_id, employee_name, action, inspection_result, inspection_notes, checklist_json, shift, damage_report_id, restrictions_json, first_use_confirmed)
  values (v_equipment.id, v_equipment.code, v_equipment.name, v_employee_id, v_card, p_employee_name, 'CHECK_OUT', 'OK', p_inspection_notes, p_checklist::text, p_shift, null, null, p_first_use_confirmed)
  returning id into v_assignment_id;

  return jsonb_build_object('ok', true, 'semaforResult', 'OK', 'assignmentId', v_assignment_id);
end;
$$;

grant execute on function public.fn_check_out_equipment(text, text, text, jsonb, text, text, text, text, boolean) to anon, authenticated;

-- ---------------------------------------------------
-- 5. fn_mark_repaired / fn_approve_repair - authenticated only,
--    obični server-action update (RLS "engineer+ update" već pokriva),
--    ali ih dajemo i kao SQL helper radi konzistentnosti/atomičnosti.
-- ---------------------------------------------------

create or replace function public.fn_mark_repaired(
  p_damage_id uuid,
  p_repaired_by_card_id text,
  p_repaired_by_name text,
  p_repair_notes text
)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.damage_reports
    set status = 'AWAITING_APPROVAL',
        repaired_by_card_id = p_repaired_by_card_id,
        repaired_by_name = p_repaired_by_name,
        repaired_at = now(),
        resolution = p_repair_notes
    where id = p_damage_id;
$$;

grant execute on function public.fn_mark_repaired(uuid, text, text, text) to authenticated;

create or replace function public.fn_approve_repair(
  p_damage_id uuid,
  p_approved_by_card_id text,
  p_approved_by_name text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_equipment_id uuid;
begin
  update public.damage_reports
    set status = 'RESOLVED',
        approved_by_card_id = p_approved_by_card_id,
        approved_by_name = p_approved_by_name,
        approved_at = now(),
        resolved_at = now()
    where id = p_damage_id
    returning equipment_id into v_equipment_id;

  if v_equipment_id is not null then
    update public.equipment
      set status = 'AVAILABLE',
          needs_first_use_confirmation = true,
          notes = 'Popravka odobrena - čeka potvrdu prvog radnika pri zaduživanju'
      where id = v_equipment_id;
  end if;
end;
$$;

grant execute on function public.fn_approve_repair(uuid, text, text) to authenticated;
-- Napomena: fn_mark_repaired i fn_approve_repair koriste SECURITY INVOKER
-- (ne DEFINER) jer se pozivaju iz authenticated sesije koja već ima RLS
-- "Damages: engineer+ update" / "Equipment: authenticated update" pokriće -
-- ne treba im bypass, samo atomičnost dva upisa u jednom pozivu.
