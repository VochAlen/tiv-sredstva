-- =====================================================
-- STVARNA GSE FLOTA AERODROMA TIVAT - direktan SQL insert
-- Izvor: 'Aerodromska oprema Aerodrom Tivat - azurirano avg. 2026'
-- =====================================================
-- VAZNO - OBAVEZAN REDOSLIJED:
-- 1) PRVO primijeni migracije 016, 017, 018, 019, 020 (tim redom!) - bez
--    migracije 017 ce INSERT za nove tipove opreme (AIR_STARTER,
--    CARGO_LOADER, FORKLIFT, FIRE_TRUCK, AMBULANCE, FOLLOW_ME,
--    SERVICE_CAR) PASTI na CHECK constraint gresci.
-- 2) Zatim pokreni ovu skriptu u cijelosti (Supabase Dashboard > SQL Editor).
-- Skripta je idempotentna - bezbjedno se moze pokrenuti vise puta
-- (ON CONFLICT ... DO UPDATE), nece duplirati redove.
-- =====================================================

-- ---------------------------------------------------
-- 1. OPREMA (78 stvarnih sredstava)
-- ---------------------------------------------------

insert into public.equipment (code, name, type, serial_number, location, status, notes, department) values
  ('GPU-01', 'GUINAULT GA 100 V 40', 'GPU', 'Int.br. 15 (T)', 'Platforma - stajanka', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('GPU-02', 'HITZINGER GPU 90 MDE 18', 'GPU', 'Int.br. 70 (T)', 'Platforma - stajanka', 'OUT_OF_SERVICE', 'Oštećen izlazni kabl za napajanje - čeka rezervni dio', 'TEHNICKA_SLUZBA'),
  ('GPU-03', 'BERTOLI 18D/90TE', 'GPU', 'Int.br. 60 (T)', 'Platforma - stajanka', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('GPU-04', 'BERTOLI 18D/90TE', 'GPU', 'Int.br. 61 (T)', 'Platforma - stajanka', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('STA-01', 'GUINAULT 500 GS 250 – MAX V 4', 'AIR_STARTER', 'Int.br. 37 (T)', 'Platforma - stajanka', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('TOW-01', 'IMT 539', 'TOW_TRACTOR', 'Int.br. 1 (H)', 'Radionica GSE / Platforma', 'MAINTENANCE', 'Redovni godišnji servis motora', 'TEHNICKA_SLUZBA'),
  ('TOW-02', 'IMT 539', 'TOW_TRACTOR', 'Int.br. 3 (H)', 'Radionica GSE / Platforma', 'AVAILABLE', 'Bez kabine', 'TEHNICKA_SLUZBA'),
  ('TOW-03', 'IMT 539', 'TOW_TRACTOR', 'Int.br. 5 (H)', 'Radionica GSE / Platforma', 'AVAILABLE', 'Bez kabine', 'TEHNICKA_SLUZBA'),
  ('TOW-04', 'IMT 539', 'TOW_TRACTOR', 'Int.br. 6 (T)', 'Radionica GSE / Platforma', 'AVAILABLE', 'Sa kabinom', 'TEHNICKA_SLUZBA'),
  ('TOW-05', 'IMT 539', 'TOW_TRACTOR', 'Int.br. 34 (H)', 'Radionica GSE / Platforma', 'AVAILABLE', 'Bez kabine', 'TEHNICKA_SLUZBA'),
  ('TOW-06', 'IMT 539', 'TOW_TRACTOR', 'Int.br. 35 (H)', 'Radionica GSE / Platforma', 'AVAILABLE', 'Sa kabinom', 'TEHNICKA_SLUZBA'),
  ('TOW-07', 'Agromehanika AGT 835 TS - sa kabinom', 'TOW_TRACTOR', 'Int.br. 38 (T)', 'Radionica GSE / Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('TOW-08', 'Agromehanika AGT 850 TS - sa kabinom', 'TOW_TRACTOR', 'Int.br. 39 (T)', 'Radionica GSE / Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('TOW-09', 'Agromehanika AGT 835 TS - sa kabinom', 'TOW_TRACTOR', 'Int.br. 40 (H)', 'Radionica GSE / Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('TOW-10', 'Agromehanika AGT 835 TS - bez kabine', 'TOW_TRACTOR', 'Int.br. 41 (H)', 'Radionica GSE / Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('TOW-11', 'Agromehanika AGT 835 TS - bez kabine', 'TOW_TRACTOR', 'Int.br. 42 (H)', 'Radionica GSE / Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('TOW-12', 'Agromehanika AGT 835 TS - bez kabine', 'TOW_TRACTOR', 'Int.br. 50 (H)', 'Radionica GSE / Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('TOW-13', 'Agromehanika AGT 835 TS - bez kabine', 'TOW_TRACTOR', 'Int.br. 51 (H)', 'Radionica GSE / Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('TOW-14', 'Agromehanika AGT 835 TS - bez kabine', 'TOW_TRACTOR', 'Int.br. 52 (H)', 'Radionica GSE / Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('TOW-15', 'AVRO GSE ST 470 E', 'TOW_TRACTOR', 'Int.br. 84 (H)', 'Radionica GSE / Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('TOW-16', 'AVRO GSE ST 470 E', 'TOW_TRACTOR', 'Int.br. 85 (H)', 'Radionica GSE / Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('TOW-17', 'AVRO GSE ST 470 E', 'TOW_TRACTOR', 'Int.br. 86 (H)', 'Radionica GSE / Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('TOW-18', 'AVRO GSE ST 470 E', 'TOW_TRACTOR', 'Int.br. 87 (H)', 'Radionica GSE / Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('TOW-19', 'AVRO GSE ST 470 E', 'TOW_TRACTOR', 'Int.br. 88 (H)', 'Radionica GSE / Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('TOW-20', 'Rakovica - sa kabinom', 'TOW_TRACTOR', 'Int.br. 17 (T)', 'Radionica GSE / Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('TOW-21', 'SOLIS Indija Solis – sa kabinom', 'TOW_TRACTOR', 'Int.br. 53 (T)', 'Radionica GSE / Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('BLT-01', 'AVIOGEI NS 450', 'BELT_LOADER', 'Int.br. 64 (H)', 'Platforma A', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('BLT-02', 'AVIOGEI NS 450', 'BELT_LOADER', 'Int.br. 63 (H)', 'Platforma A', 'MAINTENANCE', 'Zamjena trake u toku', 'SLUZBA_PO'),
  ('BLT-03', 'AVIOGEI NS 450', 'BELT_LOADER', 'Int.br. 30 (H)', 'Platforma A', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('BLT-04', 'AVIOGEI NS 450', 'BELT_LOADER', 'Int.br. 29 (H)', 'Platforma A', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('BLT-05', 'AVIOGEI NS 450 L', 'BELT_LOADER', 'Int.br. 65 (H)', 'Platforma A', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('BLT-06', 'AVIOGEI NS 450 L', 'BELT_LOADER', 'Int.br. 66 (H)', 'Platforma A', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('BLT-07', 'AVIOGEI NS 450 L', 'BELT_LOADER', 'Int.br. 67 (H)', 'Platforma A', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('BLT-08', 'AVRO GSE BL30E', 'BELT_LOADER', 'Int.br. 75 (H)', 'Platforma A', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('BLT-09', 'AVRO GSE BL30E', 'BELT_LOADER', 'Int.br. 76 (H)', 'Platforma A', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('BLT-10', 'AVRO GSE BL30E', 'BELT_LOADER', 'Int.br. 77 (H)', 'Platforma A', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('STR-01', 'AVIOGEI SI 18-39/male – samohodne', 'STAIRS', 'Int.br. 54 (H)', 'Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('STR-02', 'AVIOGEI SI 22-45/srednje-samoh.', 'STAIRS', 'Int.br. 74 (H)', 'Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('STR-03', 'AVIOGEI SI 22-45/srednje – samohodne', 'STAIRS', 'Int.br. 83 (H)', 'Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('STR-04', 'AVIOGEI SI 22-45 / srednje - samohodne', 'STAIRS', 'Int.br. 33 (H)', 'Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('STR-05', 'AVIOGEI SI 22-45 / srednje - samohodne', 'STAIRS', 'Int.br. 32 (H)', 'Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('STR-06', 'TBD TPS 2436 – električne', 'STAIRS', 'Int.br. 55 (H)', 'Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('STR-07', 'TBD TPS 2436 - električne', 'STAIRS', 'Int.br. 56 (H)', 'Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('STR-08', 'TBD TPS 2436 - električne', 'STAIRS', 'Int.br. 57 (H)', 'Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('STR-09', 'TBD TPS 2436 - električne', 'STAIRS', 'Int.br. 58 (H)', 'Platforma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('CGO-01', 'TREPEL LOADER CHAMP 70W; 7t', 'CARGO_LOADER', 'Int.br. 48 (H)', 'Teretni terminal', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('WTR-01', 'AVIOGEI VASM 2000', 'WATER', 'Int.br. 16 (H)', 'Servisna saobraćajnica', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('LAV-01', 'AVIOGEI VSTM 2000 V', 'LAVATORY', 'Int.br. 31 (H)', 'Servisna saobraćajnica', 'OUT_OF_SERVICE', 'Curenje na crijevu za pražnjenje - prijavljeno radionici', 'SLUZBA_PO'),
  ('LAV-02', 'AVIOGEI VSTM 2000 VE', 'LAVATORY', 'Int.br. 44 (H)', 'Servisna saobraćajnica', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('PBK-01', 'LEKTRO AP8750CX', 'PUSHBACK', 'Int.br. 71 (H)', 'Head-of-stand', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('PBK-02', 'LEKTRO AP8850SDA', 'PUSHBACK', 'Int.br. 72 (H)', 'Head-of-stand', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('FLT-01', 'TOYOTA Traigo 8FBMT30', 'FORKLIFT', 'Int.br. 11 (T)', 'Teretni terminal', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('DLY-01', 'FSM Prtljažna kolica kavez', 'DOLLY', NULL, 'Terminal - prtljažni prostor', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('DLY-02', 'TIPS CARGO 2515 B', 'DOLLY', NULL, 'Terminal - prtljažni prostor', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('DLY-03', 'TIPS CARGO 0024C', 'DOLLY', NULL, 'Terminal - prtljažni prostor', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('DLY-04', 'AVIOGEI RC 25 T', 'DOLLY', NULL, 'Terminal - prtljažni prostor', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('DLY-05', 'ZODIAC EQUIPMENT BDK 20 HR (kavez kolica) kom 11', 'DOLLY', NULL, 'Terminal - prtljažni prostor', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('BUS-01', 'MERCEDES BENZ. V – class rise v 220 d (GA)', 'BUS', 'Int.br. PGCGK32 (H)', 'Terminal - ukrcajna zona', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('SVC-01', 'TOYOTA Hilux Bezbjednost', 'SERVICE_CAR', 'Int.br. PGMN731 (S)', 'Landside - uprava aerodroma', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('SVC-02', 'TOYOTA Hilux Vatrogasci', 'SERVICE_CAR', 'Int.br. PGCG799 (F)', 'Landside - uprava aerodroma', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('SVC-03', 'TOYOTA Hilux RC22 2.4D-4D 4X4DC M/T6', 'SERVICE_CAR', 'Int.br. PGCGP80 (S)', 'Landside - uprava aerodroma', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('SVC-04', 'DACIA DUSTER LGV Comfort 1.5 blue DC', 'SERVICE_CAR', 'Int.br. PGCGL45 (T)', 'Landside - uprava aerodroma', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('SVC-05', 'VW Caddy', 'SERVICE_CAR', 'Int.br. PG MN 930 (T)', 'Landside - uprava aerodroma', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('SVC-06', 'ATTIVA 4.6', 'SERVICE_CAR', 'Int.br. 13 (H)', 'Landside - uprava aerodroma', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('SVC-07', 'ATTIVA 4.6', 'SERVICE_CAR', 'Int.br. 20 (S)', 'Landside - uprava aerodroma', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('SVC-08', 'ATTIVA 6LC.5', 'SERVICE_CAR', 'Int.br. 28 (H)', 'Landside - uprava aerodroma', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('SVC-09', 'ATTIVA 6LC.5', 'SERVICE_CAR', 'Int.br. 91 (T)', 'Landside - uprava aerodroma', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('FIR-01', 'ROSENBAUER Panther 6X6', 'FIRE_TRUCK', 'Int.br. PGCGB89 (F)', 'Vatrogasna stanica', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('FIR-02', 'ROSENBAUER Panther 6X6', 'FIRE_TRUCK', 'Int.br. PGCGB90 (F)', 'Vatrogasna stanica', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('FIR-03', 'Rosenbauer Panther 6x6', 'FIRE_TRUCK', 'Int.br. PGCGS36 (F)', 'Vatrogasna stanica', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('FLM-01', 'FIAT Fiorino', 'FOLLOW_ME', 'Int.br. PGCGK64 (F)', 'Kontrolni toranj / apron', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('FLM-02', 'OPEL', 'FOLLOW_ME', 'Int.br. PGCGU46 (F)', 'Kontrolni toranj / apron', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('AMB-01', 'Renault Master', 'AMBULANCE', 'Int.br. PGCG068 (H)', 'Zdravstvena stanica aerodroma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('AMB-02', 'Renault Master', 'AMBULANCE', 'Int.br. PGCGJ47 (H)', 'Zdravstvena stanica aerodroma', 'AVAILABLE', NULL, 'SLUZBA_PO'),
  ('SVC-10', 'VW GOLF V Aerodroma Tivat', 'SERVICE_CAR', 'Int.br. PGMN655', 'Landside parking', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('SVC-11', 'VW GOLF V Aerodroma Tivat', 'SERVICE_CAR', 'Int.br. PG CG C09', 'Landside parking', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('SVC-12', 'VW GOLF V Aerodroma Tivat', 'SERVICE_CAR', 'Int.br. PGMN967', 'Landside parking', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA'),
  ('SVC-13', 'Audi A6 Direktor ATV', 'SERVICE_CAR', 'Int.br. PG CG 440', 'Landside parking', 'AVAILABLE', NULL, 'TEHNICKA_SLUZBA')
on conflict (code) do update set
  name = excluded.name, type = excluded.type, serial_number = excluded.serial_number,
  location = excluded.location, status = excluded.status, notes = excluded.notes,
  department = excluded.department, updated_at = now();

-- ---------------------------------------------------
-- 2. ZAPOSLENI (10)
-- ---------------------------------------------------

insert into public.employees (card_id, name, department, role) values
  ('EMP-1001', 'Marko Radulović', 'Ramp', 'Operator'),
  ('EMP-1002', 'Ivana Vuković', 'Ramp', 'Operator'),
  ('EMP-1003', 'Petar Backović', 'Ramp', 'Senior Operator'),
  ('EMP-1004', 'Ana Perović', 'Maintenance', 'Tehničar - mehanika'),
  ('EMP-1005', 'Boris Jovanović', 'Operations', 'Šef službe GSE'),
  ('EMP-1006', 'Nikola Đurović', 'Fire & Rescue', 'Vatrogasac'),
  ('EMP-1007', 'Jelena Mijušković', 'Security', 'Bezbjednost'),
  ('EMP-1008', 'Stefan Kovačević', 'Medical', 'Medicinar'),
  ('EMP-1009', 'Vladimir Stanić', 'Maintenance', 'Tehničar - elektrika'),
  ('EMP-1010', 'Filip Bulatović', 'Maintenance', 'Tehničar - hidraulika')
on conflict (card_id) do update set
  name = excluded.name, department = excluded.department, role = excluded.role,
  updated_at = now();

-- ---------------------------------------------------
-- 3. KVALIFIKACIJE ZA UPRAVLJANJE OPREMOM (equipment_qualifications)
-- KRITIČNO: bez ovoga checkOutEquipment odbija SVAKO zaduživanje.
-- ---------------------------------------------------

do $$
declare
  ramp_types text[] := array['GPU','AIR_STARTER','TOW_TRACTOR','BELT_LOADER','CARGO_LOADER','STAIRS','WATER','LAVATORY','PUSHBACK','FORKLIFT','DOLLY','BUS'];
  fire_types text[] := array['FIRE_TRUCK','SERVICE_CAR'];
  security_types text[] := array['SERVICE_CAR','FOLLOW_ME'];
  medical_types text[] := array['AMBULANCE','SERVICE_CAR'];
  all_types text[] := array['GPU','AIR_STARTER','TOW_TRACTOR','BELT_LOADER','CARGO_LOADER','STAIRS','WATER','LAVATORY','PUSHBACK','FORKLIFT','DOLLY','BUS','FIRE_TRUCK','SERVICE_CAR','FOLLOW_ME','AMBULANCE'];
  valid_until date := (current_date + interval '1 year')::date;

  rec record;
  t text;
  lvl text;
begin
  for rec in
    select * from (values
      ('EMP-1001', ramp_types), ('EMP-1002', ramp_types), ('EMP-1003', ramp_types),
      ('EMP-1004', all_types), ('EMP-1005', all_types),
      ('EMP-1006', fire_types), ('EMP-1007', security_types), ('EMP-1008', medical_types),
      ('EMP-1009', all_types), ('EMP-1010', all_types)
    ) as x(card_id, types)
  loop
    lvl := case rec.card_id when 'EMP-1005' then 'INSTRUCTOR' when 'EMP-1003' then 'SENIOR' else 'OPERATOR' end;
    foreach t in array rec.types loop
      insert into public.equipment_qualifications
        (employee_id, employee_card_id, employee_name, equipment_type, qualification_level, trained_at, valid_until, certified_by)
      select e.id, e.card_id, e.name, t, lvl, current_date, valid_until, 'Šef službe GSE'
      from public.employees e where e.card_id = rec.card_id
      on conflict (employee_id, equipment_type) do update set
        qualification_level = excluded.qualification_level, valid_until = excluded.valid_until;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------
-- 4. AIRSIDE VOZAČKE DOZVOLE (driver_authorizations)
-- KRITIČNO: bez ovoga checkOutEquipment TAKOĐE odbija svako zaduživanje.
-- ---------------------------------------------------

insert into public.driver_authorizations
  (employee_card_id, employee_name, category1, category2, category3, license_number, issued_at, valid_until, issued_by, training_completed, training_date, training_expiry, active)
values
  ('EMP-1001', 'Marko Radulović', true, false, false, 'ADP-1001', current_date, (current_date + interval '1 year')::date, 'Operativna služba Aerodroma Tivat', true, current_date, (current_date + interval '1 year')::date, true),
  ('EMP-1002', 'Ivana Vuković', true, false, false, 'ADP-1002', current_date, (current_date + interval '1 year')::date, 'Operativna služba Aerodroma Tivat', true, current_date, (current_date + interval '1 year')::date, true),
  ('EMP-1003', 'Petar Backović', true, true, false, 'ADP-1003', current_date, (current_date + interval '1 year')::date, 'Operativna služba Aerodroma Tivat', true, current_date, (current_date + interval '1 year')::date, true),
  ('EMP-1004', 'Ana Perović', true, false, false, 'ADP-1004', current_date, (current_date + interval '1 year')::date, 'Operativna služba Aerodroma Tivat', true, current_date, (current_date + interval '1 year')::date, true),
  ('EMP-1005', 'Boris Jovanović', true, true, true, 'ADP-1005', current_date, (current_date + interval '1 year')::date, 'Operativna služba Aerodroma Tivat', true, current_date, (current_date + interval '1 year')::date, true),
  ('EMP-1006', 'Nikola Đurović', true, false, false, 'ADP-1006', current_date, (current_date + interval '1 year')::date, 'Operativna služba Aerodroma Tivat', true, current_date, (current_date + interval '1 year')::date, true),
  ('EMP-1007', 'Jelena Mijušković', true, false, false, 'ADP-1007', current_date, (current_date + interval '1 year')::date, 'Operativna služba Aerodroma Tivat', true, current_date, (current_date + interval '1 year')::date, true),
  ('EMP-1008', 'Stefan Kovačević', true, false, false, 'ADP-1008', current_date, (current_date + interval '1 year')::date, 'Operativna služba Aerodroma Tivat', true, current_date, (current_date + interval '1 year')::date, true),
  ('EMP-1009', 'Vladimir Stanić', true, false, false, 'ADP-1009', current_date, (current_date + interval '1 year')::date, 'Operativna služba Aerodroma Tivat', true, current_date, (current_date + interval '1 year')::date, true),
  ('EMP-1010', 'Filip Bulatović', true, false, false, 'ADP-1010', current_date, (current_date + interval '1 year')::date, 'Operativna služba Aerodroma Tivat', true, current_date, (current_date + interval '1 year')::date, true)
on conflict (employee_card_id) do update set
  category1 = excluded.category1, category2 = excluded.category2, category3 = excluded.category3,
  valid_until = excluded.valid_until, training_expiry = excluded.training_expiry, active = excluded.active;

-- ---------------------------------------------------
-- 5. KVALIFIKACIJE RADIONICE PO KATEGORIJI KVARA (maintenance_skills)
-- KRITIČNO: bez ovoga markRepaired odbija svako označavanje popravke.
-- Namjerno različite specijalnosti po radniku.
-- ---------------------------------------------------

insert into public.maintenance_skills (employee_card_id, employee_name, category, level, certified_by, valid_until) values
  ('EMP-1004', 'Ana Perović', 'MEHANIKA', 'CERTIFIED', 'Šef službe GSE', (current_date + interval '1 year')::date),
  ('EMP-1004', 'Ana Perović', 'OPSTE', 'CERTIFIED', 'Šef službe GSE', (current_date + interval '1 year')::date),
  ('EMP-1009', 'Vladimir Stanić', 'ELEKTRIKA', 'CERTIFIED', 'Šef službe GSE', (current_date + interval '1 year')::date),
  ('EMP-1009', 'Vladimir Stanić', 'OPSTE', 'CERTIFIED', 'Šef službe GSE', (current_date + interval '1 year')::date),
  ('EMP-1010', 'Filip Bulatović', 'HIDRAULIKA', 'CERTIFIED', 'Šef službe GSE', (current_date + interval '1 year')::date),
  ('EMP-1010', 'Filip Bulatović', 'MEHANIKA', 'CERTIFIED', 'Šef službe GSE', (current_date + interval '1 year')::date),
  ('EMP-1005', 'Boris Jovanović', 'MEHANIKA', 'SENIOR', 'Šef službe GSE', (current_date + interval '1 year')::date),
  ('EMP-1005', 'Boris Jovanović', 'ELEKTRIKA', 'SENIOR', 'Šef službe GSE', (current_date + interval '1 year')::date),
  ('EMP-1005', 'Boris Jovanović', 'HIDRAULIKA', 'SENIOR', 'Šef službe GSE', (current_date + interval '1 year')::date),
  ('EMP-1005', 'Boris Jovanović', 'BEZBJEDNOST', 'SENIOR', 'Šef službe GSE', (current_date + interval '1 year')::date),
  ('EMP-1005', 'Boris Jovanović', 'OPSTE', 'SENIOR', 'Šef službe GSE', (current_date + interval '1 year')::date)
on conflict (employee_card_id, category) do update set
  level = excluded.level, valid_until = excluded.valid_until;

-- ---------------------------------------------------
-- Gotovo. Provjeri rezultat:
-- select code, name, type, status from public.equipment order by type, code;
-- select count(*) from public.equipment_qualifications;
-- select count(*) from public.driver_authorizations;
-- ---------------------------------------------------
