-- 039: Rok čuvanja zapisa o GSE - 5 godina (zabrana brisanja mlađih zapisa)
-- Evidencija o održavanju, pregledima, zaduženjima i kvarovima ne smije se brisati prije isteka 5 godina.
-- Trigger radi na nivou baze, pa važi i za SQL editor i za API, ne samo za aplikaciju.
-- Napomena: ako se briše sredstvo koje ima ovakve zapise, brisanje se zaustavlja (isto kao i u aplikaciji).
-- Izuzetak (npr. ispravka greške pri unosu) mora izvesti administrator baze svjesno:
--   alter table public.<tabela> disable trigger trg_retention_5y;  ...  pa ponovo enable.

create or replace function public.fn_block_delete_younger_than_5y()
returns trigger
language plpgsql
as $$
declare
  col text := tg_argv[0];
  ts  timestamptz;
begin
  begin
    ts := (to_jsonb(old) ->> col)::timestamptz;
  exception when others then
    ts := null;
  end;
  -- ako se datum ne može odrediti, štitimo zapis (bolje blokirati nego izgubiti evidenciju)
  if ts is null or ts > (now() - interval '5 years') then
    raise exception 'Zapis (%) je mlađi od 5 godina i ne smije se brisati (rok čuvanja evidencije o GSE).', tg_table_name
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('damage_reports',          'created_at'),
      ('assignments',             'timestamp'),
      ('maintenance_log',         'created_at'),
      ('daily_inspections',       'inspection_date'),
      ('certificates_of_release', 'created_at'),
      ('equipment_photos',        'taken_at'),
      ('repair_status_log',       'at'),
      ('meter_readings',          'at'),
      ('fuel_logs',               'created_at'),
      ('parking_confirmations',   'created_at')
    ) as t(tbl, col)
  loop
    if to_regclass('public.' || r.tbl) is not null then
      execute format('drop trigger if exists trg_retention_5y on public.%I', r.tbl);
      execute format(
        'create trigger trg_retention_5y before delete on public.%I for each row execute function public.fn_block_delete_younger_than_5y(%L)',
        r.tbl, r.col);
    end if;
  end loop;
end $$;
