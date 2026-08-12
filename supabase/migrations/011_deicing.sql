-- ============================================================================
-- 011_deicing.sql — De-icing / Anti-icing Records (ICAO Annex 3, ISO 11076)
-- ============================================================================

-- DeicingFluid — inventar tečnosti (Type I/II/III/IV)
CREATE TABLE IF NOT EXISTS deicing_fluids (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fluid_type      TEXT NOT NULL, -- TYPE_I | TYPE_II | TYPE_III | TYPE_IV
  brand_name      TEXT NOT NULL,
  manufacturer    TEXT,
  batch_number    TEXT NOT NULL,
  quantity_liters DOUBLE PRECISION NOT NULL,
  unit_price      DOUBLE PRECISION,
  concentration   TEXT, -- 50/50 | 75/25 | 100/0
  expiry_date     TIMESTAMPTZ,
  received_at     TIMESTAMPTZ DEFAULT now(),
  storage_location TEXT,
  safety_data_sheet TEXT,
  notes           TEXT,
  is_expired      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deicing_fluids_type ON deicing_fluids(fluid_type);
CREATE INDEX IF NOT EXISTS idx_deicing_fluids_batch ON deicing_fluids(batch_number);
CREATE INDEX IF NOT EXISTS idx_deicing_fluids_expiry ON deicing_fluids(expiry_date);

-- DeicingRecord — operacija de-icing / anti-icing na avionu
CREATE TABLE IF NOT EXISTS deicing_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_number   TEXT,
  aircraft_reg    TEXT,
  aircraft_type   TEXT,
  stand_position  TEXT,
  operation_type  TEXT NOT NULL, -- DEICING | ANTI_ICING | BOTH
  fluid_type      TEXT NOT NULL, -- TYPE_I | TYPE_II | TYPE_III | TYPE_IV
  concentration   TEXT, -- 50/50 | 75/25 | 100/0
  fluid_batch_number TEXT,
  fluid_used_liters DOUBLE PRECISION NOT NULL,
  application_start TIMESTAMPTZ NOT NULL,
  application_end   TIMESTAMPTZ,
  duration_minutes  INTEGER,
  oat             DOUBLE PRECISION NOT NULL,
  precipitation   TEXT, -- NONE | SNOW | LIGHT_FREEZING_RAIN | FREEZING_DRIZZLE | RAIN_COLD_SOAK | FREEZING_FOG | COLD_SOAK
  precipitation_intensity TEXT, -- LIGHT | MODERATE | HEAVY
  wind_speed      DOUBLE PRECISION,
  wind_direction  INTEGER,
  dew_point       DOUBLE PRECISION,
  visibility      DOUBLE PRECISION,
  holdover_time_minutes INTEGER,
  hot_table_ref   TEXT,
  equipment_code  TEXT,
  operator_name   TEXT,
  operator_card_id TEXT,
  shift           TEXT,
  inspection_result TEXT, -- CLEAN | CONTAMINATED | PARTIAL
  post_check_by   TEXT,
  reapplication_required BOOLEAN DEFAULT FALSE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deicing_records_start ON deicing_records(application_start);
CREATE INDEX IF NOT EXISTS idx_deicing_records_flight ON deicing_records(flight_number);
CREATE INDEX IF NOT EXISTS idx_deicing_records_aircraft ON deicing_records(aircraft_reg);
CREATE INDEX IF NOT EXISTS idx_deicing_records_equipment ON deicing_records(equipment_code);
CREATE INDEX IF NOT EXISTS idx_deicing_records_fluid ON deicing_records(fluid_type);

-- DeicingFluidDisposal — disposal records (environmental compliance)
CREATE TABLE IF NOT EXISTS deicing_fluid_disposal (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disposal_date   TIMESTAMPTZ DEFAULT now(),
  fluid_type      TEXT NOT NULL,
  batch_number    TEXT,
  quantity_liters DOUBLE PRECISION NOT NULL,
  disposal_method TEXT NOT NULL, -- RECYCLED | INCINERATED | TREATMENT_PLANT | COLLECTED_BY_VENDOR
  vendor_name     TEXT,
  vendor_license  TEXT,
  manifest_number TEXT,
  disposal_cost   DOUBLE PRECISION,
  location        TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deicing_disposal_date ON deicing_fluid_disposal(disposal_date);
CREATE INDEX IF NOT EXISTS idx_deicing_disposal_type ON deicing_fluid_disposal(fluid_type);
CREATE INDEX IF NOT EXISTS idx_deicing_disposal_batch ON deicing_fluid_disposal(batch_number);

-- ============================================================================
-- Row Level Security
-- ============================================================================
-- Napomena: WITH CHECK se može koristiti samo na INSERT i UPDATE.
-- SELECT i DELETE koriste samo USING klauzulu.

ALTER TABLE deicing_fluids ENABLE ROW LEVEL SECURITY;
ALTER TABLE deicing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE deicing_fluid_disposal ENABLE ROW LEVEL SECURITY;

-- Public read (radnici na platformi treba da vide stanje tečnosti)
CREATE POLICY "Public read deicing_fluids" ON deicing_fluids FOR SELECT USING (true);
CREATE POLICY "Public read deicing_records" ON deicing_records FOR SELECT USING (true);
CREATE POLICY "Public read deicing_disposal" ON deicing_fluid_disposal FOR SELECT USING (true);

-- Public insert (radnici sa PIN-om mogu unositi operacije)
CREATE POLICY "Public insert deicing_fluids" ON deicing_fluids FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert deicing_records" ON deicing_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert deicing_disposal" ON deicing_fluid_disposal FOR INSERT WITH CHECK (true);

-- Public update (admin/inženjer ažurira)
CREATE POLICY "Public update deicing_fluids" ON deicing_fluids FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public update deicing_records" ON deicing_records FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public update deicing_disposal" ON deicing_fluid_disposal FOR UPDATE USING (true) WITH CHECK (true);

-- Public delete
CREATE POLICY "Public delete deicing_fluids" ON deicing_fluids FOR DELETE USING (true);
CREATE POLICY "Public delete deicing_records" ON deicing_records FOR DELETE USING (true);
CREATE POLICY "Public delete deicing_disposal" ON deicing_fluid_disposal FOR DELETE USING (true);

-- ============================================================================
-- Updated_at triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_deicing_fluids_updated_at ON deicing_fluids;
CREATE TRIGGER update_deicing_fluids_updated_at BEFORE UPDATE ON deicing_fluids FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deicing_records_updated_at ON deicing_records;
CREATE TRIGGER update_deicing_records_updated_at BEFORE UPDATE ON deicing_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deicing_disposal_updated_at ON deicing_fluid_disposal;
CREATE TRIGGER update_deicing_disposal_updated_at BEFORE UPDATE ON deicing_fluid_disposal FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Seed: primjer deicing vozila (ako ne postoji)
-- Napomena: equipment tabela (iz 001_initial_schema.sql) ima kolone:
--   id (UUID!), code, name, type, serial_number, location, status, notes, created_at, updated_at
-- Ne postoji "manufacturer", "model", "current_hours", "current_km" kolona.
-- Takođe, type CHECK constraint ne uključuje 'DEICER'.
-- Zato ovdje koristimo type='OTHER' i podatke stavljamo u notes.
-- ID mora biti UUID — koristimo gen_random_uuid() unutar INSERT-a.
-- ============================================================================

INSERT INTO equipment (id, code, name, type, status, location, serial_number, notes, created_at, updated_at)
SELECT 'a1b2c3d4-0001-4000-8000-000000000001', 'GSE-DEI-001', 'De-icing Truck 1', 'OTHER', 'AVAILABLE', 'Hangar 1', 'VST-2024-001', 'De-icing truck Vestergaard Elephant Beta — 8000L tank', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM equipment WHERE code = 'GSE-DEI-001');

INSERT INTO equipment (id, code, name, type, status, location, serial_number, notes, created_at, updated_at)
SELECT 'a1b2c3d4-0001-4000-8000-000000000002', 'GSE-DEI-002', 'De-icing Truck 2', 'OTHER', 'AVAILABLE', 'Hangar 1', 'BCH-2024-002', 'De-icing truck Bucher CityCat S2 — 6000L tank', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM equipment WHERE code = 'GSE-DEI-002');

-- ============================================================================
-- Seed: primjer tečnosti (ako je prazno)
-- ============================================================================
INSERT INTO deicing_fluids (id, fluid_type, brand_name, manufacturer, batch_number, quantity_liters, unit_price, concentration, expiry_date, storage_location, notes, created_at, updated_at)
SELECT 'a1b2c3d4-0001-4000-8000-000000000010', 'TYPE_I', 'Kilfrost ABC-I', 'Kilfrost', 'KIL-2025-A001', 1000, 3.50, '100/0', '2027-03-31', 'Skladište B - Polica 1', 'Type I fluid — za de-icing', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM deicing_fluids WHERE batch_number = 'KIL-2025-A001');

INSERT INTO deicing_fluids (id, fluid_type, brand_name, manufacturer, batch_number, quantity_liters, unit_price, concentration, expiry_date, storage_location, notes, created_at, updated_at)
SELECT 'a1b2c3d4-0001-4000-8000-000000000011', 'TYPE_IV', 'Clariant Safewing MP IV Launch', 'Clariant', 'CLA-2025-B042', 500, 12.80, '100/0', '2027-09-30', 'Skladište B - Polica 2', 'Type IV anti-icing fluid', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM deicing_fluids WHERE batch_number = 'CLA-2025-B042');
