-- ============================================================
-- MIGRATION 096: consent_access_log — who viewed which signed
-- consent package, when. Append-only compliance trail.
-- ============================================================

CREATE TABLE IF NOT EXISTS consent_access_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id       UUID NOT NULL REFERENCES screening_consent_bundles(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  viewer_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  viewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS consent_access_log_bundle_idx
  ON consent_access_log (bundle_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS consent_access_log_company_idx
  ON consent_access_log (company_id, viewed_at DESC);

COMMENT ON TABLE consent_access_log IS
  'Append-only audit: each row = one employer view of a signed consent package.';

ALTER TABLE consent_access_log ENABLE ROW LEVEL SECURITY;

-- Employers may read their own company's access log (future admin/compliance view).
CREATE POLICY "Employers view company consent access log"
  ON consent_access_log FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
-- No INSERT/UPDATE/DELETE policies: inserts go through the service-role client.
