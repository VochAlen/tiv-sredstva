-- Radnik: Alen Vočanec (služba tehnike) — sva ovlašćenja za sva sredstva.
-- Pokrenuti u Supabase SQL editoru. Može se pokrenuti više puta (ne pravi duplikate).
--
-- PRIJE POKRETANJA: provjerite broj kartice u v_card. Ako je taj broj već dodijeljen
-- drugoj osobi, skripta staje sa greškom i ništa ne mijenja.

do $$
declare
  v_card   constant text := 'EMP-1011';           -- <-- broj ID kartice (promijeniti po potrebi)
  v_name   constant text := 'Alen Vočanec';
  v_until  constant date := (current_date + interval '5 years')::date;
  v_emp_id uuid;
  v_other  text;
  v_type   text;
  v_cat    text;
begin
  select name into v_other from public.employees where card_id = v_card and name <> v_name;
  if v_other is not null then
    raise exception 'Kartica % je već dodijeljena osobi "%". Promijenite v_card.', v_card, v_other;
  end if;

  insert into public.employees (card_id, name, department, role, active)
  values (v_card, v_name, 'Maintenance', 'Služba tehnike - sva ovlašćenja', true)
  on conflict (card_id) do update
    set name = excluded.name, department = excluded.department, role = excluded.role, active = true
  returning id into v_emp_id;

  -- Airside vozačka dozvola: sve kategorije (1 apron, 2 manevarska površina, 3 poletno-sletna staza)
  insert into public.driver_authorizations
    (employee_card_id, employee_name, category1, category2, category3, license_number,
     issued_at, valid_until, issued_by, training_completed, training_date, training_expiry, active)
  values
    (v_card, v_name, true, true, true, 'ADP-' || right(v_card, 4),
     current_date, v_until, 'Operativna služba Aerodroma Tivat', true, current_date, v_until, true)
  on conflict (employee_card_id) do update
    set employee_name = excluded.employee_name,
        category1 = true, category2 = true, category3 = true,
        valid_until = excluded.valid_until, training_completed = true,
        training_expiry = excluded.training_expiry, active = true,
        suspended_at = null, suspend_reason = null;

  -- Kvalifikacija za SVAKI tip opreme koji baza dozvoljava (pokriva i buduća sredstva)
  foreach v_type in array array['GPU','AIR_STARTER','TOW_TRACTOR','BELT_LOADER','CARGO_LOADER','STAIRS','WATER',
      'LAVATORY','PUSHBACK','FORKLIFT','DOLLY','BUS','FIRE_TRUCK','AMBULANCE','FOLLOW_ME','SERVICE_CAR','OTHER']
  loop
    if exists (select 1 from public.equipment_qualifications where employee_card_id = v_card and equipment_type = v_type) then
      update public.equipment_qualifications
        set employee_id = v_emp_id, employee_name = v_name, qualification_level = 'SENIOR', valid_until = v_until
        where employee_card_id = v_card and equipment_type = v_type;
    else
      insert into public.equipment_qualifications
        (employee_id, employee_card_id, employee_name, equipment_type, qualification_level, trained_at, valid_until, certified_by)
      values (v_emp_id, v_card, v_name, v_type, 'SENIOR', current_date, v_until, 'Šef službe GSE');
    end if;
  end loop;

  -- Kvalifikacije radionice: sve kategorije kvara (potrebne za "Popravljeno")
  foreach v_cat in array array['MEHANIKA','ELEKTRIKA','HIDRAULIKA','BEZBJEDNOST','OPSTE']
  loop
    insert into public.maintenance_skills (employee_card_id, employee_name, category, level, certified_by, valid_until)
    values (v_card, v_name, v_cat, 'SENIOR', 'Šef službe GSE', v_until::timestamptz)
    on conflict (employee_card_id, category) do update
      set employee_name = excluded.employee_name, level = 'SENIOR', valid_until = excluded.valid_until;
  end loop;

  -- Sredstva sa ograničenim pristupom (restricted_access): izričita dozvola za svako
  insert into public.equipment_access (equipment_id, equipment_code, employee_card_id, employee_name, granted_by)
  select e.id, e.code, v_card, v_name, 'Šef službe GSE'
  from public.equipment e
  where e.restricted_access
    and not exists (select 1 from public.equipment_access a where a.equipment_id = e.id and a.employee_card_id = v_card);
end $$;

-- Provjera
select 'driver' as dio, count(*) from public.driver_authorizations where employee_card_id = 'EMP-1011'
union all select 'oprema (tipovi)', count(*) from public.equipment_qualifications where employee_card_id = 'EMP-1011'
union all select 'radionica (kategorije)', count(*) from public.maintenance_skills where employee_card_id = 'EMP-1011';
