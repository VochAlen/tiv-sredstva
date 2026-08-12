-- ============================================================================
-- 015_document_control.sql
-- Document Control System (EASA Part-145.A.65 + ISO 9001)
-- ============================================================================

-- ControlledDocument — master document register
CREATE TABLE IF NOT EXISTS controlled_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id          TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL,
  doc_type        TEXT NOT NULL,
  standard        TEXT,
  current_version TEXT DEFAULT '1.0',
  status          TEXT DEFAULT 'DRAFT',
  effective_date  TIMESTAMPTZ,
  next_review_date TIMESTAMPTZ,
  owner           TEXT NOT NULL,
  owner_card_id   TEXT,
  author          TEXT,
  approver        TEXT,
  file_url        TEXT,
  file_format     TEXT,
  file_size       INTEGER,
  location        TEXT,
  review_frequency TEXT DEFAULT 'ANNUAL',
  last_reviewed_at TIMESTAMPTZ,
  last_reviewed_by TEXT,
  distribution_list TEXT,
  classification  TEXT DEFAULT 'INTERNAL',
  keywords        TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_docs_doc_id ON controlled_documents(doc_id);
CREATE INDEX IF NOT EXISTS idx_docs_category ON controlled_documents(category);
CREATE INDEX IF NOT EXISTS idx_docs_status ON controlled_documents(status);
CREATE INDEX IF NOT EXISTS idx_docs_owner ON controlled_documents(owner);
CREATE INDEX IF NOT EXISTS idx_docs_review ON controlled_documents(next_review_date);

-- DocumentVersion — istorija verzija
CREATE TABLE IF NOT EXISTS document_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES controlled_documents(id) ON DELETE CASCADE,
  version_number  TEXT NOT NULL,
  revision_date   TIMESTAMPTZ DEFAULT now(),
  revised_by      TEXT NOT NULL,
  revised_by_card_id TEXT,
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  change_description TEXT NOT NULL,
  change_reason   TEXT,
  affected_sections TEXT,
  status          TEXT DEFAULT 'DRAFT',
  effective_date  TIMESTAMPTZ,
  file_url        TEXT,
  file_size       INTEGER,
  review_notes    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_versions_doc ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_versions_number ON document_versions(version_number);
CREATE INDEX IF NOT EXISTS idx_versions_date ON document_versions(revision_date);
CREATE INDEX IF NOT EXISTS idx_versions_status ON document_versions(status);

-- DocumentReview — pregledi
CREATE TABLE IF NOT EXISTS document_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES controlled_documents(id) ON DELETE CASCADE,
  review_type     TEXT NOT NULL,
  review_date     TIMESTAMPTZ DEFAULT now(),
  reviewer        TEXT NOT NULL,
  reviewer_card_id TEXT,
  result          TEXT NOT NULL,
  review_comments TEXT,
  changes_required TEXT,
  new_version_required BOOLEAN DEFAULT FALSE,
  action_taken    TEXT,
  completed_at    TIMESTAMPTZ,
  status          TEXT DEFAULT 'OPEN',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_doc ON document_reviews(document_id);
CREATE INDEX IF NOT EXISTS idx_reviews_date ON document_reviews(review_date);
CREATE INDEX IF NOT EXISTS idx_reviews_result ON document_reviews(result);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON document_reviews(status);

-- DocumentDistribution — distribucija
CREATE TABLE IF NOT EXISTS document_distributions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES controlled_documents(id) ON DELETE CASCADE,
  recipient_name  TEXT NOT NULL,
  recipient_role  TEXT,
  recipient_department TEXT,
  recipient_email TEXT,
  distribution_date TIMESTAMPTZ DEFAULT now(),
  distribution_method TEXT NOT NULL,
  distributed_by  TEXT NOT NULL,
  acknowledged    BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_method TEXT,
  status          TEXT DEFAULT 'DISTRIBUTED',
  version_number  TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dist_doc ON document_distributions(document_id);
CREATE INDEX IF NOT EXISTS idx_dist_recipient ON document_distributions(recipient_name);
CREATE INDEX IF NOT EXISTS idx_dist_dept ON document_distributions(recipient_department);
CREATE INDEX IF NOT EXISTS idx_dist_status ON document_distributions(status);

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE controlled_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read controlled_documents" ON controlled_documents FOR SELECT USING (true);
CREATE POLICY "Public insert controlled_documents" ON controlled_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update controlled_documents" ON controlled_documents FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete controlled_documents" ON controlled_documents FOR DELETE USING (true);

CREATE POLICY "Public read document_versions" ON document_versions FOR SELECT USING (true);
CREATE POLICY "Public insert document_versions" ON document_versions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update document_versions" ON document_versions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete document_versions" ON document_versions FOR DELETE USING (true);

CREATE POLICY "Public read document_reviews" ON document_reviews FOR SELECT USING (true);
CREATE POLICY "Public insert document_reviews" ON document_reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update document_reviews" ON document_reviews FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete document_reviews" ON document_reviews FOR DELETE USING (true);

CREATE POLICY "Public read document_distributions" ON document_distributions FOR SELECT USING (true);
CREATE POLICY "Public insert document_distributions" ON document_distributions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update document_distributions" ON document_distributions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete document_distributions" ON document_distributions FOR DELETE USING (true);

-- ============================================================================
-- Triggers
-- ============================================================================
DROP TRIGGER IF EXISTS update_controlled_documents_updated_at ON controlled_documents;
CREATE TRIGGER update_controlled_documents_updated_at BEFORE UPDATE ON controlled_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_document_versions_updated_at ON document_versions;
CREATE TRIGGER update_document_versions_updated_at BEFORE UPDATE ON document_versions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_document_reviews_updated_at ON document_reviews;
CREATE TRIGGER update_document_reviews_updated_at BEFORE UPDATE ON document_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_document_distributions_updated_at ON document_distributions;
CREATE TRIGGER update_document_distributions_updated_at BEFORE UPDATE ON document_distributions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
