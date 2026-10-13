-- =====================================================
-- 016 - Sigurnosna zakrpa + semafor checklist + kvalifikacije
-- =====================================================
-- KONTEKST: RLSPOLICY.sql je otvorio "USING (true)" / "WITH CHECK (true)"
-- politike za anon rolu na equipment/assignments/damage_reports/employees/
-- equipment_photos, da bi radnici (koji se ne loguju, identifikuju se PIN-om)
-- mogli zaduživati/razduživati opremu. Problem: anon (publishable) key je
-- javan po dizajnu (u client bundle-u), pa je bilo ko mogao pozivati
-- PostgREST direktno i zaobići SVE provjere iz actions.ts (driver auth,
-- equipment access, status provjere) jer RLS te provjere uopšte nije znao.
--
-- RJEŠENJE: sve mutacije koje radi anonimni radnik idu ISKLJUČIVO kroz
-- dvije SECURITY DEFINER funkcije (fn_check_out_equipment / fn_check_in_equipment)
-- koje:
--   1) zaključavaju red opreme (FOR UPDATE) - rješava race condition kod
--      istovremenog zaduživanja istog sredstva,
--   2) same provjeravaju status/access/driver-auth/kvalifikaciju (ne vjeruju
--      klijentu), i rade SVE upise atomično u jednoj transakciji,
--   3) rade kao vlasnik funkcije (bypass RLS) - RLS na baznim tabelama se
--      vraća na "samo authenticated" kao što je bilo prije RLSPOLICY.sql,
--      pa direktan REST poziv anon korisnika na te tabele više ne prolazi.
-- =====================================================

-- ---------------------------------------------------
-- 1. Nove kolone - semafor ograničenja i radionica-acknowledge
-- ---------------------------------------------------

alter table public.equipment
  add column if not exists active_restrictions jsonb;

alter table public.assignments
  add column if not exists restrictions_json jsonb;

alter table public.damage_reports
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by text;

-- ---------------------------------------------------
-- 2. Zatvori RLS rupu - ukloni "public true" politike, vrati na authenticated
-- ---------------------------------------------------

drop policy if exists "Equipment: public update" on public.equipment;
drop policy if exists "Equipment: authenticated update" on public.equipment;
create policy "Equipment: authenticated update"
  on public.equipment for update
  using (public.is_authenticated());

drop policy if exists "Assignments: public insert" on public.assignments;
-- Nema anon/authenticated direktan INSERT na assignments - ide isključivo
-- kroz fn_check_out_equipment / fn_check_in_equipment (SECURITY DEFINER).
-- Audit log ostaje append-only i van dohvata direktnog REST poziva.

drop policy if exists "Employees: public insert" on public.employees;
-- Employee upsert se sada radi unutar SECURITY DEFINER funkcija.
-- Authenticated admin i dalje može ručno kroz postojeću "Employees: authenticated insert" (001).
drop policy if exists "Employees: authenticated insert" on public.employees;
create policy "Employees: authenticated insert"
  on public.employees for insert
  with check (public.is_authenticated());

drop policy if exists "Damages: public insert" on public.damage_reports;
-- Damage report insert ide isključivo kroz check-out/check-in funkcije.
-- Authenticated (dashboard) i dalje smije prijaviti kvar ručno:
drop policy if exists "Damages: authenticated insert" on public.damage_reports;
create policy "Damages: authenticated insert"
  on public.damage_reports for insert
  with check (public.is_authenticated());

drop policy if exists "Photos: public insert" on public.equipment_photos;
-- Foto-dokazi se šalju samo iz autentifikovanog dashboard/radionica flow-a
-- (photo-upload.tsx nije dio anonimnog worker kiosk flow-a).
drop policy if exists "Photos: authenticated insert" on public.equipment_photos;
create policy "Photos: authenticated insert"
  on public.equipment_photos for insert
  with check (public.is_authenticated());

-- ShiftHandovers ostaje javno-insert namjerno: radnici bez logina predaju
-- smjenu, tekst bez uticaja na status/bezbjednost opreme - nizak rizik.

-- ---------------------------------------------------
-- 3. fn_check_out_equipment - atomično, sa validacijom i semaforom
-- ---------------------------------------------------

create or replace function public.fn_check_out_equipment(
  p_equipment_code text,
  p_employee_card_id text,
  p_employee_name text,
  p_checklist jsonb,       -- niz { id, category, label, passed, severity, restrictionCode, restrictionLabel }
  p_inspection_notes text default null,
  p_shift text default null,
  p_damage_description text default null,
  p_damage_severity text default 'MINOR'
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
  -- Zaključaj red opreme - sprječava dvostruko zaduživanje pri simultanom pozivu
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

  -- Access control (ograničen pristup)
  if v_equipment.restricted_access then
    if not exists (
      select 1 from public.equipment_access
      where equipment_id = v_equipment.id and employee_card_id = v_card
    ) then
      return jsonb_build_object('ok', false, 'error', 'Nemate dozvolu za zaduživanje ovog sredstva. Kontaktirajte supervizora.');
    end if;
  end if;

  -- Driver authorization (ADR.OPS.C.005)
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

  -- Kvalifikacija za tip opreme
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

  -- Upsert employee
  insert into public.employees (card_id, name)
  values (v_card, p_employee_name)
  on conflict (card_id) do update set name = excluded.name
  returning id into v_employee_id;

  -- Semafor evaluacija checkliste
  select count(*) into v_blocking_count
    from jsonb_array_elements(p_checklist) as item
    where (item->>'severity') = 'BLOCKING' and (item->>'passed')::boolean = false;

  select jsonb_agg(item) into v_restrictive_items
    from jsonb_array_elements(p_checklist) as item
    where (item->>'severity') = 'RESTRICTIVE' and (item->>'passed')::boolean = false;

  if v_blocking_count > 0 then
    -- CRVENO - blokirano, sredstvo ide OUT_OF_SERVICE
    v_inspection_result := case when p_damage_severity = 'CRITICAL' then 'OUT_OF_SERVICE' else 'MAJOR_DAMAGE' end;

    insert into public.damage_reports (equipment_id, equipment_code, equipment_name, reported_by_card_id, reported_by_name, employee_id, severity, description, status)
    values (v_equipment.id, v_equipment.code, v_equipment.name, v_card, p_employee_name, v_employee_id, coalesce(p_damage_severity, 'MAJOR'), coalesce(p_damage_description, 'Kvar utvrđen na pre-use checklisti (blokirajuće stavke)'), 'OPEN')
    returning id into v_damage_id;

    update public.equipment
      set status = 'OUT_OF_SERVICE',
          active_restrictions = null,
          notes = format('Oštećenje prijavljeno %s od %s: %s', to_char(now(), 'YYYY-MM-DD'), p_employee_name, left(coalesce(p_damage_description, ''), 100))
      where id = v_equipment.id;

    insert into public.assignments (equipment_id, equipment_code, equipment_name, employee_id, employee_card_id, employee_name, action, inspection_result, inspection_notes, checklist_json, shift, damage_report_id, restrictions_json)
    values (v_equipment.id, v_equipment.code, v_equipment.name, v_employee_id, v_card, p_employee_name, 'CHECK_OUT', v_inspection_result, p_inspection_notes, p_checklist::text, p_shift, v_damage_id, null);

    return jsonb_build_object('ok', false, 'error', 'Sredstvo ne može biti zaduženo - utvrđen kvar koji blokira upotrebu. Status promijenjen u OUT_OF_SERVICE.', 'damageReportId', v_damage_id, 'semaforResult', 'BLOCKED');
  end if;

  if v_restrictive_items is not null and jsonb_array_length(v_restrictive_items) > 0 then
    -- NARANDŽASTO - dozvoljeno sa ograničenjima
    select jsonb_agg(jsonb_build_object(
        'code', item->>'restrictionCode',
        'label', item->>'restrictionLabel',
        'source', item->>'id',
        'since', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      )) into v_restrictions
      from jsonb_array_elements(v_restrictive_items) as item;

    update public.equipment set status = 'ASSIGNED', active_restrictions = v_restrictions where id = v_equipment.id;

    insert into public.assignments (equipment_id, equipment_code, equipment_name, employee_id, employee_card_id, employee_name, action, inspection_result, inspection_notes, checklist_json, shift, damage_report_id, restrictions_json)
    values (v_equipment.id, v_equipment.code, v_equipment.name, v_employee_id, v_card, p_employee_name, 'CHECK_OUT', 'MINOR_DAMAGE', p_inspection_notes, p_checklist::text, p_shift, null, v_restrictions)
    returning id into v_assignment_id;

    return jsonb_build_object('ok', true, 'semaforResult', 'RESTRICTED', 'restrictions', v_restrictions, 'assignmentId', v_assignment_id);
  end if;

  -- ZELENO - sve u redu
  update public.equipment set status = 'ASSIGNED', active_restrictions = null where id = v_equipment.id;

  insert into public.assignments (equipment_id, equipment_code, equipment_name, employee_id, employee_card_id, employee_name, action, inspection_result, inspection_notes, checklist_json, shift, damage_report_id, restrictions_json)
  values (v_equipment.id, v_equipment.code, v_equipment.name, v_employee_id, v_card, p_employee_name, 'CHECK_OUT', 'OK', p_inspection_notes, p_checklist::text, p_shift, null, null)
  returning id into v_assignment_id;

  return jsonb_build_object('ok', true, 'semaforResult', 'OK', 'assignmentId', v_assignment_id);
end;
$$;

grant execute on function public.fn_check_out_equipment(text, text, text, jsonb, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------
-- 4. fn_check_in_equipment - atomično razduživanje
-- ---------------------------------------------------

create or replace function public.fn_check_in_equipment(
  p_equipment_code text,
  p_employee_card_id text,
  p_employee_name text,
  p_notes text default null,
  p_found_damage text default null,
  p_damage_severity text default 'MINOR'
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
  v_damage_id uuid;
  v_inspection_result text := 'OK';
begin
  select * into v_equipment from public.equipment where code = p_equipment_code for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Sredstvo nije pronađeno');
  end if;

  if v_equipment.status = 'AVAILABLE' then
    return jsonb_build_object('ok', false, 'error', 'Ovo sredstvo je već razduženo.');
  end if;

  insert into public.employees (card_id, name)
  values (v_card, p_employee_name)
  on conflict (card_id) do update set name = excluded.name
  returning id into v_employee_id;

  if p_found_damage is not null and length(trim(p_found_damage)) > 0 then
    v_inspection_result := case p_damage_severity
      when 'CRITICAL' then 'OUT_OF_SERVICE'
      when 'MAJOR' then 'MAJOR_DAMAGE'
      else 'MINOR_DAMAGE'
    end;

    insert into public.damage_reports (equipment_id, equipment_code, equipment_name, reported_by_card_id, reported_by_name, employee_id, severity, description, status)
    values (v_equipment.id, v_equipment.code, v_equipment.name, v_card, p_employee_name, v_employee_id, p_damage_severity, p_found_damage, 'OPEN')
    returning id into v_damage_id;

    if p_damage_severity in ('CRITICAL', 'MAJOR') then
      update public.equipment set status = 'OUT_OF_SERVICE', active_restrictions = null where id = v_equipment.id;
    else
      update public.equipment
        set status = 'AVAILABLE',
            active_restrictions = null,
            notes = format('Manje oštećenje prijavljeno %s', to_char(now(), 'YYYY-MM-DD'))
        where id = v_equipment.id;
    end if;
  else
    -- Bez novog oštećenja - vraća se u AVAILABLE, ograničenja se brišu
    -- (radionica treba da potvrdi da je uzrok ograničenja otklonjen prije
    -- sljedećeg pregleda; ako nije, sljedeći check-out će ga ponovo otkriti)
    update public.equipment set status = 'AVAILABLE', active_restrictions = null, notes = null where id = v_equipment.id;
  end if;

  insert into public.assignments (equipment_id, equipment_code, equipment_name, employee_id, employee_card_id, employee_name, action, inspection_result, inspection_notes, checklist_json, damage_report_id)
  values (v_equipment.id, v_equipment.code, v_equipment.name, v_employee_id, v_card, p_employee_name, 'CHECK_IN', v_inspection_result, p_notes, '[]', v_damage_id);

  return jsonb_build_object('ok', true, 'damageReportId', v_damage_id);
end;
$$;

grant execute on function public.fn_check_in_equipment(text, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------
-- 5. Radionica vidi prijave odmah - realtime + acknowledge helper
-- ---------------------------------------------------

alter table public.damage_reports replica identity full;
alter table public.equipment replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'damage_reports'
  ) then
    alter publication supabase_realtime add table public.damage_reports;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'equipment'
  ) then
    alter publication supabase_realtime add table public.equipment;
  end if;
exception when undefined_object then
  -- supabase_realtime publikacija ne postoji u ovom projektu (npr. lokalni test) - preskoči
  null;
end $$;

-- "Preuzmi u radionicu" - jedan poziv, samo authenticated (engineer/admin)
create or replace function public.fn_acknowledge_damage(p_damage_id uuid, p_by text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.damage_reports
    set acknowledged_at = now(), acknowledged_by = p_by, status = case when status = 'OPEN' then 'IN_REPAIR' else status end
    where id = p_damage_id;
$$;

grant execute on function public.fn_acknowledge_damage(uuid, text) to authenticated;
