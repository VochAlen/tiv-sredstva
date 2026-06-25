-- =====================================================
-- FIX: Dozvoli radnicima (anon) upis u assignments, equipment, employees, damage_reports
-- Radnici se ne loguju - identifikuju se preko PIN-a
-- =====================================================

-- ASSIGNMENTS - dozvoli anon INSERT (radnici zadužuju/razdužuju)
DROP POLICY IF EXISTS "Assignments: authenticated insert" ON public.assignments;
CREATE POLICY "Assignments: public insert"
  ON public.assignments FOR INSERT
  WITH CHECK (true);

-- EQUIPMENT - dozvoli anon UPDATE (promjena statusa pri check-out/check-in)
DROP POLICY IF EXISTS "Equipment: authenticated update" ON public.equipment;
CREATE POLICY "Equipment: public update"
  ON public.equipment FOR UPDATE
  USING (true);

-- EMPLOYEES - dozvoli anon INSERT (kreiranje radnika pri check-out)
DROP POLICY IF EXISTS "Employees: authenticated insert" ON public.employees;
CREATE POLICY "Employees: public insert"
  ON public.employees FOR INSERT
  WITH CHECK (true);

-- DAMAGE_REPORTS - dozvoli anon INSERT (radnici prijavljuju oštećenja)
DROP POLICY IF EXISTS "Damages: authenticated insert" ON public.damage_reports;
CREATE POLICY "Damages: public insert"
  ON public.damage_reports FOR INSERT
  WITH CHECK (true);

-- EQUIPMENT_PHOTOS - dozvoli anon INSERT (radnici šalju foto dokaze)
DROP POLICY IF EXISTS "Photos: authenticated insert" ON public.equipment_photos;
CREATE POLICY "Photos: public insert"
  ON public.equipment_photos FOR INSERT
  WITH CHECK (true);

-- SHIFT_HANDOVERS - dozvoli anon INSERT (radnici predaju smjenu)
DROP POLICY IF EXISTS "ShiftHandovers: authenticated insert" ON public.shift_handovers;
CREATE POLICY "ShiftHandovers: public insert"
  ON public.shift_handovers FOR INSERT
  WITH CHECK (true);