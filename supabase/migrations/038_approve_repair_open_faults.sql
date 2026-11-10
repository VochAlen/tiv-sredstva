-- 038: Odobrenje popravke ne smije pustiti sredstvo u rad ako na njemu ima drugih otvorenih kvarova.
-- Ranije je fn_approve_repair uvijek postavljao status AVAILABLE (i prepisivao napomenu), pa bi sredstvo sa dva kvara
-- bilo "slobodno" nakon odobrenja samo jednog. Pokrenuti ručno u Supabase SQL editoru (nakon 037). Bezbjedno za ponovno pokretanje.
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

  if v_equipment_id is not null
     and not exists (
       select 1 from public.damage_reports
       where equipment_id = v_equipment_id and status <> 'RESOLVED' and id <> p_damage_id
     )
  then
    update public.equipment
      set status = 'AVAILABLE',
          needs_first_use_confirmation = true,
          notes = 'Popravka odobrena - čeka potvrdu prvog radnika pri zaduživanju'
      where id = v_equipment_id;
  end if;
end;
$$;
