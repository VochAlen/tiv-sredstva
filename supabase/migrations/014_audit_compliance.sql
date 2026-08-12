-- ============================================================================
-- 014_audit_compliance.sql
-- ADR.OPS.D.005 Compliance Monitoring + EASA Part-145.A.65 Quality System
-- ============================================================================

-- AuditProgram — godišnji plan audita
CREATE TABLE IF NOT EXISTS audit_programs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  audit_type      TEXT NOT NULL,
  audit_scope     TEXT NOT NULL,
  audit_standard  TEXT,
  planned_year    INTEGER NOT NULL,
  planned_quarter INTEGER,
  planned_date    TIMESTAMPTZ,
  actual_date     TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  lead_auditor    TEXT NOT NULL,
  lead_auditor_card_id TEXT,
  auditees        TEXT,
  status          TEXT DEFAULT 'PLANNED',
  priority        TEXT DEFAULT 'MEDIUM',
  findings_count  INTEGER DEFAULT 0,
  major_findings  INTEGER DEFAULT 0,
  minor_findings  INTEGER DEFAULT 0,
  observations    INTEGER DEFAULT 0,
  overall_result  TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_prog_year ON audit_programs(planned_year);
CREATE INDEX IF NOT EXISTS idx_audit_prog_status ON audit_programs(status);
CREATE INDEX IF NOT EXISTS idx_audit_prog_type ON audit_programs(audit_type);

-- Audit — pojedinačni audit
CREATE TABLE IF NOT EXISTS audits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id        TEXT UNIQUE NOT NULL,
  program_id      UUID REFERENCES audit_programs(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  audit_type      TEXT NOT NULL,
  audit_scope     TEXT NOT NULL,
  audit_standard  TEXT,
  description     TEXT,
  scheduled_date  TIMESTAMPTZ NOT NULL,
  start_date      TIMESTAMPTZ,
  end_date        TIMESTAMPTZ,
  report_date     TIMESTAMPTZ,
  lead_auditor    TEXT NOT NULL,
  lead_auditor_card_id TEXT,
  audit_team      TEXT,
  auditee_organization TEXT,
  auditee_contact TEXT,
  auditee_areas   TEXT,
  status          TEXT DEFAULT 'SCHEDULED',
  overall_result  TEXT,
  summary         TEXT,
  recommendations TEXT,
  report_url      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audits_scheduled ON audits(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
CREATE INDEX IF NOT EXISTS idx_audits_type ON audits(audit_type);

-- AuditFinding — nalazi audita
CREATE TABLE IF NOT EXISTS audit_findings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id      TEXT UNIQUE NOT NULL,
  audit_id        UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  classification  TEXT NOT NULL,
  category        TEXT NOT NULL,
  finding_type    TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  criteria        TEXT,
  evidence        TEXT,
  area            TEXT,
  process         TEXT,
  root_cause      TEXT,
  immediate_action TEXT,
  preventive_action TEXT,
  corrective_action TEXT,
  status          TEXT DEFAULT 'OPEN',
  assigned_to     TEXT,
  due_date        TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  closed_by       TEXT,
  verification_result TEXT,
  verified_by     TEXT,
  verified_at     TIMESTAMPTZ,
  risk_level      TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_findings_audit ON audit_findings(audit_id);
CREATE INDEX IF NOT EXISTS idx_findings_class ON audit_findings(classification);
CREATE INDEX IF NOT EXISTS idx_findings_status ON audit_findings(status);
CREATE INDEX IF NOT EXISTS idx_findings_cat ON audit_findings(category);

-- CAPA — Corrective and Preventive Action
CREATE TABLE IF NOT EXISTS capas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capa_id         TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  type            TEXT NOT NULL,
  source          TEXT NOT NULL,
  source_ref      TEXT,
  finding_id      TEXT,
  problem_statement TEXT NOT NULL,
  root_cause_analysis TEXT,
  root_cause      TEXT,
  corrective_action TEXT,
  preventive_action TEXT,
  action_plan     TEXT,
  assigned_to     TEXT NOT NULL,
  assigned_to_card_id TEXT,
  due_date        TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ,
  status          TEXT DEFAULT 'OPEN',
  implementation_evidence TEXT,
  verification_method TEXT,
  verification_result TEXT,
  verified_by     TEXT,
  verified_at     TIMESTAMPTZ,
  estimated_cost  DOUBLE PRECISION,
  actual_cost     DOUBLE PRECISION,
  progress_notes  TEXT,
  closure_notes   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_capas_status ON capas(status);
CREATE INDEX IF NOT EXISTS idx_capas_type ON capas(type);
CREATE INDEX IF NOT EXISTS idx_capas_source ON capas(source);
CREATE INDEX IF NOT EXISTS idx_capas_due ON capas(due_date);

-- ComplianceItem — Compliance Matrix
CREATE TABLE IF NOT EXISTS compliance_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         TEXT UNIQUE NOT NULL,
  regulation      TEXT NOT NULL,
  requirement     TEXT NOT NULL,
  requirement_text TEXT,
  category        TEXT NOT NULL,
  internal_doc    TEXT,
  doc_location    TEXT,
  doc_version     TEXT,
  doc_owner       TEXT,
  evidence_type   TEXT,
  evidence_ref    TEXT,
  evidence_description TEXT,
  last_verified   TIMESTAMPTZ,
  verified_by     TEXT,
  status          TEXT DEFAULT 'COMPLIANT',
  risk_level      TEXT,
  gap_description TEXT,
  corrective_action TEXT,
  next_review_date TIMESTAMPTZ,
  review_frequency TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compliance_reg ON compliance_items(regulation);
CREATE INDEX IF NOT EXISTS idx_compliance_status ON compliance_items(status);
CREATE INDEX IF NOT EXISTS idx_compliance_cat ON compliance_items(category);

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE audit_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE capas ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read audit_programs" ON audit_programs FOR SELECT USING (true);
CREATE POLICY "Public insert audit_programs" ON audit_programs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update audit_programs" ON audit_programs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete audit_programs" ON audit_programs FOR DELETE USING (true);

CREATE POLICY "Public read audits" ON audits FOR SELECT USING (true);
CREATE POLICY "Public insert audits" ON audits FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update audits" ON audits FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete audits" ON audits FOR DELETE USING (true);

CREATE POLICY "Public read audit_findings" ON audit_findings FOR SELECT USING (true);
CREATE POLICY "Public insert audit_findings" ON audit_findings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update audit_findings" ON audit_findings FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete audit_findings" ON audit_findings FOR DELETE USING (true);

CREATE POLICY "Public read capas" ON capas FOR SELECT USING (true);
CREATE POLICY "Public insert capas" ON capas FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update capas" ON capas FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete capas" ON capas FOR DELETE USING (true);

CREATE POLICY "Public read compliance_items" ON compliance_items FOR SELECT USING (true);
CREATE POLICY "Public insert compliance_items" ON compliance_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update compliance_items" ON compliance_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete compliance_items" ON compliance_items FOR DELETE USING (true);

-- ============================================================================
-- Triggers
-- ============================================================================
DROP TRIGGER IF EXISTS update_audit_programs_updated_at ON audit_programs;
CREATE TRIGGER update_audit_programs_updated_at BEFORE UPDATE ON audit_programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_audits_updated_at ON audits;
CREATE TRIGGER update_audits_updated_at BEFORE UPDATE ON audits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_audit_findings_updated_at ON audit_findings;
CREATE TRIGGER update_audit_findings_updated_at BEFORE UPDATE ON audit_findings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_capas_updated_at ON capas;
CREATE TRIGGER update_capas_updated_at BEFORE UPDATE ON capas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_compliance_items_updated_at ON compliance_items;
CREATE TRIGGER update_compliance_items_updated_at BEFORE UPDATE ON compliance_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
