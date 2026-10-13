-- =====================================================
-- 016: Security hardening - uklanjanje javnih (anon) RLS politika
-- sa tabela koje su namijenjene ISKLJUČIVO prijavljenom osoblju.
--
-- NALAZ: migracije 011-015 (deicing, aerodrome_inspection, sms,
-- audit_compliance, document_control) su kreirane sa
-- "USING (true)" / "WITH CHECK (true)" politikama koje dozvoljavaju
-- BILO KOME sa javnim (anon) Supabase ključem - koji se isporučuje u
-- svakom klijentskom JS bundle-u - da čita, mijenja i BRIŠE sve
-- zapise direktno preko Supabase REST API-ja, mimo Next.js aplikacije
-- i mimo svih requireAuth()/getCurrentUser() provjera u server akcijama.
--
-- Pogođeno: SMS hazardi i korektivne mjere, audit nalazi i CAPA,
-- kontrolisana dokumentacija, aerodromske inspekcije/NOTAM-i, deicing
-- zapisi. Sve ove server akcije (src/lib/actions-sms.ts,
-- actions-audit.ts, actions-document-control.ts, actions-inspection.ts,
-- actions-deicing.ts) VEĆ zahtijevaju prijavljenog korisnika, pa je
-- bezbjedno ograničiti RLS na "authenticated" - ništa se ne gubi od
-- funkcionalnosti, zatvara se rupa koja zaobilazi aplikaciju.
--
-- Ovo je isti bezbjednosni obrazac koji je ranije primijenjen na
-- equipment/assignments/damage_reports tabele.
-- =====================================================

-- ---------- DEICING ----------
DROP POLICY IF EXISTS "Public read deicing_fluids" ON deicing_fluids;
DROP POLICY IF EXISTS "Public insert deicing_fluids" ON deicing_fluids;
DROP POLICY IF EXISTS "Public update deicing_fluids" ON deicing_fluids;
DROP POLICY IF EXISTS "Public delete deicing_fluids" ON deicing_fluids;
DROP POLICY IF EXISTS "Public read deicing_records" ON deicing_records;
DROP POLICY IF EXISTS "Public insert deicing_records" ON deicing_records;
DROP POLICY IF EXISTS "Public update deicing_records" ON deicing_records;
DROP POLICY IF EXISTS "Public delete deicing_records" ON deicing_records;
DROP POLICY IF EXISTS "Public read deicing_disposal" ON deicing_fluid_disposal;
DROP POLICY IF EXISTS "Public insert deicing_disposal" ON deicing_fluid_disposal;
DROP POLICY IF EXISTS "Public update deicing_disposal" ON deicing_fluid_disposal;
DROP POLICY IF EXISTS "Public delete deicing_disposal" ON deicing_fluid_disposal;

CREATE POLICY "Authenticated all deicing_fluids" ON deicing_fluids
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated all deicing_records" ON deicing_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated all deicing_disposal" ON deicing_fluid_disposal
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- AERODROME INSPECTIONS / NOTAM ----------
DROP POLICY IF EXISTS "Public read aero_inspections" ON aerodrome_inspections;
DROP POLICY IF EXISTS "Public insert aero_inspections" ON aerodrome_inspections;
DROP POLICY IF EXISTS "Public update aero_inspections" ON aerodrome_inspections;
DROP POLICY IF EXISTS "Public delete aero_inspections" ON aerodrome_inspections;
DROP POLICY IF EXISTS "Public read findings" ON inspection_findings;
DROP POLICY IF EXISTS "Public insert findings" ON inspection_findings;
DROP POLICY IF EXISTS "Public update findings" ON inspection_findings;
DROP POLICY IF EXISTS "Public delete findings" ON inspection_findings;
DROP POLICY IF EXISTS "Public read notams" ON notams;
DROP POLICY IF EXISTS "Public insert notams" ON notams;
DROP POLICY IF EXISTS "Public update notams" ON notams;
DROP POLICY IF EXISTS "Public delete notams" ON notams;

CREATE POLICY "Authenticated all aero_inspections" ON aerodrome_inspections
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated all findings" ON inspection_findings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated all notams" ON notams
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- SMS (Safety Management System) ----------
DROP POLICY IF EXISTS "Public read sms_hazards" ON sms_hazards;
DROP POLICY IF EXISTS "Public insert sms_hazards" ON sms_hazards;
DROP POLICY IF EXISTS "Public update sms_hazards" ON sms_hazards;
DROP POLICY IF EXISTS "Public delete sms_hazards" ON sms_hazards;
DROP POLICY IF EXISTS "Public read sms_spis" ON sms_spis;
DROP POLICY IF EXISTS "Public insert sms_spis" ON sms_spis;
DROP POLICY IF EXISTS "Public update sms_spis" ON sms_spis;
DROP POLICY IF EXISTS "Public delete sms_spis" ON sms_spis;
DROP POLICY IF EXISTS "Public read sms_spts" ON sms_spts;
DROP POLICY IF EXISTS "Public insert sms_spts" ON sms_spts;
DROP POLICY IF EXISTS "Public update sms_spts" ON sms_spts;
DROP POLICY IF EXISTS "Public delete sms_spts" ON sms_spts;
DROP POLICY IF EXISTS "Public read sms_actions" ON sms_safety_actions;
DROP POLICY IF EXISTS "Public insert sms_actions" ON sms_safety_actions;
DROP POLICY IF EXISTS "Public update sms_actions" ON sms_safety_actions;
DROP POLICY IF EXISTS "Public delete sms_actions" ON sms_safety_actions;

CREATE POLICY "Authenticated all sms_hazards" ON sms_hazards
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated all sms_spis" ON sms_spis
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated all sms_spts" ON sms_spts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated all sms_actions" ON sms_safety_actions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- AUDIT / COMPLIANCE / CAPA ----------
DROP POLICY IF EXISTS "Public read audit_programs" ON audit_programs;
DROP POLICY IF EXISTS "Public insert audit_programs" ON audit_programs;
DROP POLICY IF EXISTS "Public update audit_programs" ON audit_programs;
DROP POLICY IF EXISTS "Public delete audit_programs" ON audit_programs;
DROP POLICY IF EXISTS "Public read audits" ON audits;
DROP POLICY IF EXISTS "Public insert audits" ON audits;
DROP POLICY IF EXISTS "Public update audits" ON audits;
DROP POLICY IF EXISTS "Public delete audits" ON audits;
DROP POLICY IF EXISTS "Public read audit_findings" ON audit_findings;
DROP POLICY IF EXISTS "Public insert audit_findings" ON audit_findings;
DROP POLICY IF EXISTS "Public update audit_findings" ON audit_findings;
DROP POLICY IF EXISTS "Public delete audit_findings" ON audit_findings;
DROP POLICY IF EXISTS "Public read capas" ON capas;
DROP POLICY IF EXISTS "Public insert capas" ON capas;
DROP POLICY IF EXISTS "Public update capas" ON capas;
DROP POLICY IF EXISTS "Public delete capas" ON capas;
DROP POLICY IF EXISTS "Public read compliance_items" ON compliance_items;
DROP POLICY IF EXISTS "Public insert compliance_items" ON compliance_items;
DROP POLICY IF EXISTS "Public update compliance_items" ON compliance_items;
DROP POLICY IF EXISTS "Public delete compliance_items" ON compliance_items;

CREATE POLICY "Authenticated all audit_programs" ON audit_programs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated all audits" ON audits
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated all audit_findings" ON audit_findings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated all capas" ON capas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated all compliance_items" ON compliance_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- DOCUMENT CONTROL ----------
DROP POLICY IF EXISTS "Public read controlled_documents" ON controlled_documents;
DROP POLICY IF EXISTS "Public insert controlled_documents" ON controlled_documents;
DROP POLICY IF EXISTS "Public update controlled_documents" ON controlled_documents;
DROP POLICY IF EXISTS "Public delete controlled_documents" ON controlled_documents;
DROP POLICY IF EXISTS "Public read document_versions" ON document_versions;
DROP POLICY IF EXISTS "Public insert document_versions" ON document_versions;
DROP POLICY IF EXISTS "Public update document_versions" ON document_versions;
DROP POLICY IF EXISTS "Public delete document_versions" ON document_versions;
DROP POLICY IF EXISTS "Public read document_reviews" ON document_reviews;
DROP POLICY IF EXISTS "Public insert document_reviews" ON document_reviews;
DROP POLICY IF EXISTS "Public update document_reviews" ON document_reviews;
DROP POLICY IF EXISTS "Public delete document_reviews" ON document_reviews;
DROP POLICY IF EXISTS "Public read document_distributions" ON document_distributions;
DROP POLICY IF EXISTS "Public insert document_distributions" ON document_distributions;
DROP POLICY IF EXISTS "Public update document_distributions" ON document_distributions;
DROP POLICY IF EXISTS "Public delete document_distributions" ON document_distributions;

CREATE POLICY "Authenticated all controlled_documents" ON controlled_documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated all document_versions" ON document_versions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated all document_reviews" ON document_reviews
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated all document_distributions" ON document_distributions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- NAPOMENA: RLSPOLICY.sql (equipment/assignments/employees/damage_reports/
-- photos/shift_handovers) NIJE dirana ovom migracijom - taj "public insert"
-- obrazac je namjeran (radnici na terenu zadužuju/razdužuju opremu bez
-- login-a preko telefona), ali bi dugoročno trebalo zamijeniti SECURITY
-- DEFINER funkcijama (fn_check_out_equipment / fn_check_in_equipment)
-- kako bi se izbjegao direktan anon INSERT/UPDATE pristup tabelama - vidi
-- preporuku u pratećem izvještaju.
