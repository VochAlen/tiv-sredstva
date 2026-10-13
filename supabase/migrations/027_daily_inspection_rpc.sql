-- 027: fn_create_daily_inspection u migracijama
-- Ista funkcija je ranije bila samo u supabase/020_department_and_daily_inspection_security.sql
-- (van foldera migrations), pa je mogla ostati nepokrenuta. Idempotentno.

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
  v_failed_count int;
  v_result text;
  v_issues jsonb;
  v_inspection_id uuid;
begin
  select * into v_equipment from public.equipment where code = p_equipment_code for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Sredstvo nije pronađeno');
  end if;

  select count(*) into v_failed_count
    from jsonb_array_elements(p_checklist) as item
    where (item->>'passed')::boolean = false;

  select jsonb_agg(item) into v_issues
    from jsonb_array_elements(p_checklist) as item
    where (item->>'passed')::boolean = false;

  v_result := case
    when v_failed_count > 2 then 'UNFIT'
    when v_failed_count > 0 then 'CONDITIONAL'
    else 'FIT'
  end;

  insert into public.daily_inspections
    (equipment_id, equipment_code, equipment_name, inspector_card_id, inspector_name, shift, checklist_json, result, notes, issues_found, issues_json)
  values
    (v_equipment.id, v_equipment.code, v_equipment.name, upper(trim(p_inspector_card_id)), p_inspector_name, p_shift, p_checklist::text, v_result, p_notes, v_failed_count, coalesce(v_issues::text, '[]'))
  returning id into v_inspection_id;

  if v_result = 'UNFIT' then
    update public.equipment set
      fitness_status = 'UNFIT',
      fitness_calculated_at = now(),
      fitness_reason = format('Dnevna inspekcija: %s neispravnih stavki', v_failed_count)
    where id = v_equipment.id;
  end if;

  return jsonb_build_object('ok', true, 'id', v_inspection_id, 'result', v_result);
end;
$$;

grant execute on function public.fn_create_daily_inspection(text, text, text, text, jsonb, text) to anon, authenticated;

-- Direktan INSERT u daily_inspections ide isključivo kroz funkciju iznad
drop policy if exists "DailyInspection: public insert" on public.daily_inspections;
