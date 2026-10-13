-- =====================================================
-- 021 - Služba (department) na opremi + mjerenja/praćenje inspekcijskih nalaza
-- =====================================================
-- Kod već koristi ove kolone (actions-adr.ts getDailyInspectionStatus,
-- actions-inspection.ts getDefectHistory, daily-inspection izvještaj), ali
-- nijedna ranija migracija ih nije kreirala. Sve je idempotentno
-- (add column if not exists) pa je bezbjedno pokrenuti više puta.
-- =====================================================

-- 1. Služba kojoj sredstvo pripada: TEHNICKA_SLUZBA | SLUZBA_PO
--    (null se u aplikaciji tretira kao TEHNICKA_SLUZBA)
alter table public.equipment
  add column if not exists department text;

alter table public.equipment
  drop constraint if exists equipment_department_check;
alter table public.equipment
  add constraint equipment_department_check
  check (department is null or department in ('TEHNICKA_SLUZBA', 'SLUZBA_PO'));

create index if not exists idx_equipment_department on public.equipment(department);

-- 2. Mjerenja i praćenje istog fizičkog nedostatka kroz više pregleda
--    (PRG.03.02 3.2.5.1)
alter table public.inspection_findings
  add column if not exists length_m numeric,
  add column if not exists max_width_cm numeric,
  add column if not exists max_depth_cm numeric,
  add column if not exists condition_rating text,
  add column if not exists tracking_group_id text;

create index if not exists idx_inspection_findings_tracking
  on public.inspection_findings(tracking_group_id);
