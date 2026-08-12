-- ============================================================================
-- 013_sms.sql — Safety Management System (ICAO Annex 19, EASA M.GEN.205)
-- ============================================================================

-- Hazard Identification Log
CREATE TABLE IF NOT EXISTS sms_hazards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard_id       TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  category        TEXT NOT NULL, -- OPERATIONAL | TECHNICAL | ENVIRONMENTAL | HUMAN | ORGANIZATIONAL | EXTERNAL
  source          TEXT NOT NULL, -- INSPECTION | INCIDENT | AUDIT | EMPLOYEE | OTHER
  location        TEXT,
  reported_by     TEXT NOT NULL,
  reported_by_card_id TEXT,
  reported_at     TIMESTAMPTZ DEFAULT now(),
  initial_probability INTEGER NOT NULL, -- 1-5
  initial_severity INTEGER NOT NULL, -- 1-5
  initial_risk_level TEXT NOT NULL, -- LOW | MEDIUM | HIGH | CRITICAL
  status          TEXT DEFAULT 'OPEN',
  assigned_to     TEXT,
  due_date        TIMESTAMPTZ,
  mitigation      TEXT,
  residual_probability INTEGER,
  residual_severity INTEGER,
  residual_risk_level TEXT,
  alarp_justification TEXT,
  alarp_reviewed_at TIMESTAMPTZ,
  alarp_reviewed_by TEXT,
  action_plan_id  TEXT,
  closed_at       TIMESTAMPTZ,
  closed_by       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sms_hazards_id ON sms_hazards(hazard_id);
CREATE INDEX IF NOT EXISTS idx_sms_hazards_cat ON sms_hazards(category);
CREATE INDEX IF NOT EXISTS idx_sms_hazards_status ON sms_hazards(status);
CREATE INDEX IF NOT EXISTS idx_sms_hazards_risk ON sms_hazards(initial_risk_level);

-- SPI — Safety Performance Indicators
CREATE TABLE IF NOT EXISTS sms_spis (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spi_id          TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL, -- OUTPUT | PROCESS | LEADING | LAGGING
  unit            TEXT NOT NULL,
  frequency       TEXT NOT NULL, -- MONTHLY | QUARTERLY | ANNUALLY
  target_value    DOUBLE PRECISION NOT NULL,
  alert_level     DOUBLE PRECISION NOT NULL,
  tolerable_limit DOUBLE PRECISION NOT NULL,
  current_value   DOUBLE PRECISION,
  current_period  TEXT,
  trend           TEXT, -- IMPROVING | STABLE | WORSENING
  status          TEXT DEFAULT 'GREEN',
  last_updated    TIMESTAMPTZ DEFAULT now(),
  spt_id          TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sms_spis_id ON sms_spis(spi_id);
CREATE INDEX IF NOT EXISTS idx_sms_spis_status ON sms_spis(status);

-- SPT — Safety Performance Targets
CREATE TABLE IF NOT EXISTS sms_spts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spt_id          TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL,
  baseline_value  DOUBLE PRECISION NOT NULL,
  target_value    DOUBLE PRECISION NOT NULL,
  current_value   DOUBLE PRECISION,
  unit            TEXT NOT NULL,
  start_date      TIMESTAMPTZ NOT NULL,
  target_date     TIMESTAMPTZ NOT NULL,
  status          TEXT DEFAULT 'ON_TRACK',
  progress_percent DOUBLE PRECISION DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sms_spts_status ON sms_spts(status);
CREATE INDEX IF NOT EXISTS idx_sms_spts_date ON sms_spts(target_date);

-- Safety Action Plan
CREATE TABLE IF NOT EXISTS sms_safety_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id       TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  category        TEXT NOT NULL, -- CORRECTIVE | PREVENTIVE | MITIGATION | IMPROVEMENT
  priority        TEXT NOT NULL, -- LOW | MEDIUM | HIGH | CRITICAL
  hazard_id       TEXT,
  spi_id          TEXT,
  spt_id          TEXT,
  assigned_to     TEXT NOT NULL,
  assigned_to_card_id TEXT,
  due_date        TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ,
  status          TEXT DEFAULT 'OPEN',
  estimated_cost  DOUBLE PRECISION,
  actual_cost     DOUBLE PRECISION,
  progress_notes  TEXT,
  verification_result TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sms_actions_status ON sms_safety_actions(status);
CREATE INDEX IF NOT EXISTS idx_sms_actions_priority ON sms_safety_actions(priority);
CREATE INDEX IF NOT EXISTS idx_sms_actions_due ON sms_safety_actions(due_date);

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE sms_hazards ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_spis ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_spts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_safety_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read sms_hazards" ON sms_hazards FOR SELECT USING (true);
CREATE POLICY "Public insert sms_hazards" ON sms_hazards FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update sms_hazards" ON sms_hazards FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete sms_hazards" ON sms_hazards FOR DELETE USING (true);

CREATE POLICY "Public read sms_spis" ON sms_spis FOR SELECT USING (true);
CREATE POLICY "Public insert sms_spis" ON sms_spis FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update sms_spis" ON sms_spis FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete sms_spis" ON sms_spis FOR DELETE USING (true);

CREATE POLICY "Public read sms_spts" ON sms_spts FOR SELECT USING (true);
CREATE POLICY "Public insert sms_spts" ON sms_spts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update sms_spts" ON sms_spts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete sms_spts" ON sms_spts FOR DELETE USING (true);

CREATE POLICY "Public read sms_actions" ON sms_safety_actions FOR SELECT USING (true);
CREATE POLICY "Public insert sms_actions" ON sms_safety_actions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update sms_actions" ON sms_safety_actions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete sms_actions" ON sms_safety_actions FOR DELETE USING (true);

-- ============================================================================
-- Triggers
-- ============================================================================
DROP TRIGGER IF EXISTS update_sms_hazards_updated_at ON sms_hazards;
CREATE TRIGGER update_sms_hazards_updated_at BEFORE UPDATE ON sms_hazards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sms_spis_updated_at ON sms_spis;
CREATE TRIGGER update_sms_spis_updated_at BEFORE UPDATE ON sms_spis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sms_spts_updated_at ON sms_spts;
CREATE TRIGGER update_sms_spts_updated_at BEFORE UPDATE ON sms_spts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sms_actions_updated_at ON sms_safety_actions;
CREATE TRIGGER update_sms_actions_updated_at BEFORE UPDATE ON sms_safety_actions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
