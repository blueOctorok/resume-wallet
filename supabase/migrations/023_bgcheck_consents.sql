-- ============================================================
-- MIGRATION 023: Background Check Consents
-- ============================================================
-- Date: March 2026
-- Purpose: Store FCRA-required signed authorizations from drivers
--          before an employer can order a background check / MVR.
-- ============================================================

CREATE TABLE IF NOT EXISTS bgcheck_consents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The candidate_requests entry this consent fulfills
  request_id        UUID NOT NULL REFERENCES candidate_requests(id) ON DELETE CASCADE,

  -- The employer company that requested the background check
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_name      TEXT NOT NULL,

  -- The driver who signed
  driver_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Signature fields
  signed_name       TEXT NOT NULL,
  signed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Snapshot of personal info shown on the form at time of signing
  form_data         JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one consent per request (prevent duplicate submissions)
CREATE UNIQUE INDEX IF NOT EXISTS bgcheck_consents_request_id_key
  ON bgcheck_consents(request_id);

-- Lookup by driver
CREATE INDEX IF NOT EXISTS bgcheck_consents_driver_user_id_idx
  ON bgcheck_consents(driver_user_id);

-- Lookup by company
CREATE INDEX IF NOT EXISTS bgcheck_consents_company_id_idx
  ON bgcheck_consents(company_id);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE bgcheck_consents ENABLE ROW LEVEL SECURITY;

-- Drivers can view their own consents
CREATE POLICY "Drivers view own consents"
  ON bgcheck_consents FOR SELECT
  USING (driver_user_id = auth.uid());

-- Drivers can insert their own consents
CREATE POLICY "Drivers insert own consents"
  ON bgcheck_consents FOR INSERT
  WITH CHECK (driver_user_id = auth.uid());

-- Employers (company members) can view consents for their company
CREATE POLICY "Employers view company consents"
  ON bgcheck_consents FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

COMMENT ON TABLE bgcheck_consents IS
  'Stores driver-signed FCRA Background Check Disclosure & Authorization records. Required before an employer can order a background check.';
