-- =====================================================
-- 018 - Kvalifikacija radionice po kategoriji kvara
-- =====================================================
-- Cilj: kvar na električnom sistemu smije popraviti samo radnik kvalifikovan
-- za ELEKTRIKA, kvar na kočnicama samo radnik kvalifikovan za MEHANIKA, itd.
-- Kategorija dolazi automatski iz pre-use checkliste (svaka stavka već ima
-- category: MEHANIKA/ELEKTRIKA/HIDRAULIKA/BEZBJEDNOST/OPSTE), a za slobodne
-- prijave (check-in, ručni unos) radionica je mora ručno postaviti prije
-- nego označi "popravljeno".

-- ---------------------------------------------------
-- 1. Kategorija na prijavi kvara
-- ---------------------------------------------------

alter table public.damage_reports add column if not exists category text;

-- ---------------------------------------------------
-- 2. Tabela kvalifikacija radionice po kategoriji
-- ---------------------------------------------------

create table if not exists public.maintenance_skills (
  id uuid primary key default gen_random_uuid(),
  employee_card_id text not null,
  employee_name text not null,
  category text not null,
  level text not null default 'CERTIFIED',
  certified_by text,
  certificate_number text,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  unique (employee_card_id, category)
);

create index if not exists idx_maintenance_skills_card on public.maintenance_skills(employee_card_id);
create index if not exists idx_maintenance_skills_category on public.maintenance_skills(category);

alter table public.maintenance_skills enable row level security;

drop policy if exists "MaintenanceSkills: authenticated read" on public.maintenance_skills;
create policy "MaintenanceSkills: authenticated read"
  on public.maintenance_skills for select
  using (public.is_authenticated());

drop policy if exists "MaintenanceSkills: admin write" on public.maintenance_skills;
create policy "MaintenanceSkills: admin write"
  on public.maintenance_skills for all
  using (public.is_authenticated())
  with check (public.is_authenticated());
-- Napomena: fino filtriranje na "samo admin" (šef službe) radi se u server
-- action sloju (requireRole(['admin'])) kao i za ostale admin-only akcije u
-- ovoj aplikaciji - RLS ovdje samo garantuje da je korisnik ulogovan.

-- ---------------------------------------------------
-- 3. fn_check_out_equipment - izvedi category iz checkliste kad se otvara
--    prijava kvara (BLOCKED grana)
-- ---------------------------------------------------

drop function if exists public.fn_check_out_equipment(text, text, text, jsonb, text, text, text, text, boolean);

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
  v_category text;
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
    -- Kategorija = kategorija prve blokirajuće neispravne stavke
    select item->>'category' into v_category
      from jsonb_array_elements(p_checklist) as item
      where (item->>'severity') = 'BLOCKING' and (item->>'passed')::boolean = false
      limit 1;

    v_inspection_result := case when p_damage_severity = 'CRITICAL' then 'OUT_OF_SERVICE' else 'MAJOR_DAMAGE' end;

    insert into public.damage_reports (equipment_id, equipment_code, equipment_name, reported_by_card_id, reported_by_name, employee_id, severity, description, status, category)
    values (v_equipment.id, v_equipment.code, v_equipment.name, v_card, p_employee_name, v_employee_id, coalesce(p_damage_severity, 'MAJOR'), coalesce(p_damage_description, 'Kvar utvrđen na pre-use checklisti (blokirajuće stavke)'), 'OPEN', v_category)
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
-- 4. fn_mark_repaired - dodaj p_category i provjeri kvalifikaciju
--    tehničara za tu kategoriju PRIJE nego dozvoli prelazak u
--    AWAITING_APPROVAL. Odbrana u dubinu (isto se provjerava i u
--    TypeScript sloju) - safety-relevantno pravilo zaslužuje dvostruku
--    provjeru, ne samo UI validaciju.
-- ---------------------------------------------------

drop function if exists public.fn_mark_repaired(uuid, text, text, text);

create or replace function public.fn_mark_repaired(
  p_damage_id uuid,
  p_repaired_by_card_id text,
  p_repaired_by_name text,
  p_repair_notes text,
  p_category text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_category text;
  v_card text := upper(trim(p_repaired_by_card_id));
  v_skill record;
begin
  select category into v_category from public.damage_reports where id = p_damage_id;
  v_category := coalesce(v_category, p_category);

  if v_category is null then
    return jsonb_build_object('ok', false, 'error', 'Kvar nema određenu kategoriju. Odaberite kategoriju prije nego označite popravku.');
  end if;

  select * into v_skill from public.maintenance_skills
    where employee_card_id = v_card and category = v_category;

  if not found then
    return jsonb_build_object('ok', false, 'error', format('Niste kvalifikovani za popravke kategorije "%s". Ovu popravku mora preuzeti radnik sa odgovarajućom kvalifikacijom.', v_category));
  end if;

  if v_skill.valid_until is not null and v_skill.valid_until < now() then
    return jsonb_build_object('ok', false, 'error', format('Vaša kvalifikacija za "%s" je istekla. Potrebna obnova.', v_category));
  end if;

  update public.damage_reports
    set status = 'AWAITING_APPROVAL',
        category = v_category,
        repaired_by_card_id = p_repaired_by_card_id,
        repaired_by_name = p_repaired_by_name,
        repaired_at = now(),
        resolution = p_repair_notes
    where id = p_damage_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.fn_mark_repaired(uuid, text, text, text, text) to authenticated;
