-- DKIM / inbound reply capture for prior-employer verification.
-- Form-path EVR stays valid for "verified on file"; Midnight prove requires dkim_valid.

ALTER TABLE employment_verification_requests
  ADD COLUMN IF NOT EXISTS pingram_tracking_id TEXT,
  ADD COLUMN IF NOT EXISTS inbound_from_email TEXT,
  ADD COLUMN IF NOT EXISTS inbound_from_domain TEXT,
  ADD COLUMN IF NOT EXISTS inbound_body_hash TEXT,
  ADD COLUMN IF NOT EXISTS inbound_rfc822 TEXT,
  ADD COLUMN IF NOT EXISTS inbound_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dkim_valid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dkim_domain TEXT;

CREATE INDEX IF NOT EXISTS idx_evr_pingram_tracking
  ON employment_verification_requests (pingram_tracking_id)
  WHERE pingram_tracking_id IS NOT NULL;

COMMENT ON COLUMN employment_verification_requests.dkim_valid IS
  'True when inbound RFC822 DKIM passed and aligned with the invited employer domain.';
