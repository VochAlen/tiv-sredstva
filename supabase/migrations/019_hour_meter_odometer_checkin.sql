-- =====================================================
-- 019 - Sati rada / kilometraža pri check-in-u
-- =====================================================
-- Equipment.total_operating_hours / total_km su postojali u šemi i
-- MaintenanceSchedule ih koristi za DUE detekciju, ali check-in ih nikad
-- nije upisivao pa su ostajali zamrznuti na seed vrijednostima. Ovo dodaje
-- opciono očitavanje brojača pri razduživanju - radnik unosi trenutno
-- stanje sata/kilometraže SAMO ako sredstvo ima brojač (opciono polje).

drop function if exists public.fn_check_in_equipment(text, text, text, text, text, text);

create or replace function public.fn_check_in_equipment(
  p_equipment_code text,
  p_employee_card_id text,
  p_employee_name text,
  p_notes text default null,
  p_found_damage text default null,
  p_damage_severity text default 'MINOR',
  p_hour_meter numeric default null,
  p_odometer numeric default null
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

  -- Ažuriraj brojače SAMO ako je novo očitavanje veće od trenutnog
  -- (sprječava slučajni/pogrešan unos da vrati brojač unazad)
  if p_hour_meter is not null and p_hour_meter > coalesce(v_equipment.total_operating_hours, 0) then
    update public.equipment set total_operating_hours = p_hour_meter where id = v_equipment.id;
  end if;
  if p_odometer is not null and p_odometer > coalesce(v_equipment.total_km, 0) then
    update public.equipment set total_km = p_odometer where id = v_equipment.id;
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
    update public.equipment set status = 'AVAILABLE', active_restrictions = null, notes = null where id = v_equipment.id;
  end if;

  insert into public.assignments (equipment_id, equipment_code, equipment_name, employee_id, employee_card_id, employee_name, action, inspection_result, inspection_notes, checklist_json, damage_report_id)
  values (v_equipment.id, v_equipment.code, v_equipment.name, v_employee_id, v_card, p_employee_name, 'CHECK_IN', v_inspection_result, p_notes, '[]', v_damage_id);

  return jsonb_build_object('ok', true, 'damageReportId', v_damage_id);
end;
$$;

grant execute on function public.fn_check_in_equipment(text, text, text, text, text, text, numeric, numeric) to anon, authenticated;
