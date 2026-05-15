-- ============================================================
-- MIGRATION 085: Screening consent bundles (employer + candidate)
-- ============================================================
-- One row ties BG + PSP (+ CDLIS payload) for a driver under a company.
-- Used to gate employer-initiated MVR/PSP orders without re-collecting signatures.
-- SSN is app-encrypted (AES-GCM); never store plaintext.
-- ============================================================

CREATE TABLE IF NOT EXISTS screening_consent_bundles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_request_id  UUID REFERENCES candidate_requests(id) ON DELETE SET NULL,

  bgcheck_consent_id    UUID REFERENCES bgcheck_consents(id) ON DELETE SET NULL,
  psp_consent_id        UUID REFERENCES psp_consents(id) ON DELETE SET NULL,

  cdlis_signed_name     TEXT,
  cdlis_signed_at       TIMESTAMPTZ,
  cdlis_form_data       JSONB NOT NULL DEFAULT '{}'::jsonb,

  form_data             JSONB NOT NULL DEFAULT '{}'::jsonb,
  ssn_encrypted         TEXT,

  status                TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT screening_consent_bundles_status_check
    CHECK (status IN ('pending', 'complete')),

  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS screening_consent_bundles_driver_company_idx
  ON screening_consent_bundles (driver_user_id, company_id);

CREATE INDEX IF NOT EXISTS screening_consent_bundles_company_idx
  ON screening_consent_bundles (company_id);

CREATE INDEX IF NOT EXISTS screening_consent_bundles_status_idx
  ON screening_consent_bundles (company_id, status);

COMMENT ON TABLE screening_consent_bundles IS
  'Bundled FCRA + FMCSA + CDLIS consent for a driver under an employer; gates employer screening orders.';

ALTER TABLE screening_consent_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers view own screening consent bundles"
  ON screening_consent_bundles FOR SELECT
  USING (driver_user_id = auth.uid());

CREATE POLICY "Drivers insert own screening consent bundles"
  ON screening_consent_bundles FOR INSERT
  WITH CHECK (driver_user_id = auth.uid());

CREATE POLICY "Drivers update own screening consent bundles"
  ON screening_consent_bundles FOR UPDATE
  USING (driver_user_id = auth.uid());

CREATE POLICY "Employers view company screening consent bundles"
  ON screening_consent_bundles FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
