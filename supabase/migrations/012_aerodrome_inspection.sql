-- ============================================================================
-- 012_aerodrome_inspection.sql
-- ADR.OPS.B.005 + ICAO Annex 14 — Aerodrome Daily Inspection
-- ============================================================================

-- AerodromeInspection — dnevna inspekcija aerodroma
CREATE TABLE IF NOT EXISTS aerodrome_inspections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_type TEXT NOT NULL, -- RUNWAY | TAXIWAY | APRON | MOVEMENT_AREA_JOINT
  inspection_date TIMESTAMPTZ NOT NULL,
  performed_by    TEXT NOT NULL,
  performed_by_card_id TEXT,
  shift           TEXT,
  runway_code     TEXT,
  taxiway_code    TEXT,
  apron_area      TEXT,
  weather_conditions TEXT,
  visibility      DOUBLE PRECISION,
  runway_condition TEXT,
  status          TEXT NOT NULL, -- COMPLETED | WITH_FINDINGS | CRITICAL | ABORTED
  findings_count  INTEGER DEFAULT 0,
  critical_count  INTEGER DEFAULT 0,
  runway_surface  TEXT,
  runway_markings TEXT,
  runway_lights   TEXT,
  papi_lights     TEXT,
  wind_direction_indicators TEXT,
  taxiway_surface TEXT,
  taxiway_signs   TEXT,
  taxiway_lights  TEXT,
  gse_parking     TEXT,
  fod_check       TEXT,
  markings        TEXT,
  fueling_area    TEXT,
  drainage_system TEXT,
  perimeter_fence TEXT,
  wildlife_activity TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aero_insp_date ON aerodrome_inspections(inspection_date);
CREATE INDEX IF NOT EXISTS idx_aero_insp_type ON aerodrome_inspections(inspection_type);
CREATE INDEX IF NOT EXISTS idx_aero_insp_status ON aerodrome_inspections(status);

-- InspectionFinding — nalazi sa fotografijama i koordinatama
CREATE TABLE IF NOT EXISTS inspection_findings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id   UUID NOT NULL REFERENCES aerodrome_inspections(id) ON DELETE CASCADE,
  category        TEXT NOT NULL, -- FOD | PAVEMENT_DAMAGE | MARKINGS | LIGHTING | WILDLIFE | DRAINAGE | GSE_PARKING | SIGNAGE | OTHER
  severity        TEXT NOT NULL, -- LOW | MEDIUM | HIGH | CRITICAL
  description     TEXT NOT NULL,
  location        TEXT,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  photo_url       TEXT,
  action_required TEXT,
  action_taken    TEXT,
  status          TEXT DEFAULT 'OPEN', -- OPEN | IN_PROGRESS | RESOLVED | DEFERRED
  resolved_at     TIMESTAMPTZ,
  resolved_by     TEXT,
  notam_generated BOOLEAN DEFAULT FALSE,
  notam_number    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_findings_insp ON inspection_findings(inspection_id);
CREATE INDEX IF NOT EXISTS idx_findings_cat ON inspection_findings(category);
CREATE INDEX IF NOT EXISTS idx_findings_sev ON inspection_findings(severity);
CREATE INDEX IF NOT EXISTS idx_findings_status ON inspection_findings(status);

-- Notam
CREATE TABLE IF NOT EXISTS notams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notam_number    TEXT UNIQUE NOT NULL,
  series          TEXT NOT NULL,
  qualifier       TEXT NOT NULL, -- NOTAMN | NOTAMR | NOTAMC
  ref_notam_number TEXT,
  fir             TEXT DEFAULT 'LYBA',
  aerodrome       TEXT DEFAULT 'LYTV',
  subject         TEXT,
  condition       TEXT,
  purpose         TEXT,
  scope           TEXT,
  traffic         TEXT,
  lower_limit     INTEGER,
  upper_limit     INTEGER,
  coordinates     TEXT,
  radius          DOUBLE PRECISION,
  text            TEXT NOT NULL,
  created_from_finding_id UUID,
  created_from_inspection_id UUID,
  status          TEXT DEFAULT 'ACTIVE',
  valid_from      TIMESTAMPTZ DEFAULT now(),
  valid_to        TIMESTAMPTZ,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notams_number ON notams(notam_number);
CREATE INDEX IF NOT EXISTS idx_notams_aerodrome ON notams(aerodrome);
CREATE INDEX IF NOT EXISTS idx_notams_status ON notams(status);

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE aerodrome_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read aero_inspections" ON aerodrome_inspections FOR SELECT USING (true);
CREATE POLICY "Public insert aero_inspections" ON aerodrome_inspections FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update aero_inspections" ON aerodrome_inspections FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete aero_inspections" ON aerodrome_inspections FOR DELETE USING (true);

CREATE POLICY "Public read findings" ON inspection_findings FOR SELECT USING (true);
CREATE POLICY "Public insert findings" ON inspection_findings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update findings" ON inspection_findings FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete findings" ON inspection_findings FOR DELETE USING (true);

CREATE POLICY "Public read notams" ON notams FOR SELECT USING (true);
CREATE POLICY "Public insert notams" ON notams FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update notams" ON notams FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete notams" ON notams FOR DELETE USING (true);

-- ============================================================================
-- Updated_at triggers
-- ============================================================================
DROP TRIGGER IF EXISTS update_aero_inspections_updated_at ON aerodrome_inspections;
CREATE TRIGGER update_aero_inspections_updated_at BEFORE UPDATE ON aerodrome_inspections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inspection_findings_updated_at ON inspection_findings;
CREATE TRIGGER update_inspection_findings_updated_at BEFORE UPDATE ON inspection_findings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notams_updated_at ON notams;
CREATE TRIGGER update_notams_updated_at BEFORE UPDATE ON notams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
