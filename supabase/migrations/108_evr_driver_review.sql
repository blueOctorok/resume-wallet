-- Driver review / share / hide on returned EVs.
-- Original replies stay; a correction is a new row pointing at correction_of.

ALTER TABLE employment_verification_requests
  ADD COLUMN IF NOT EXISTS driver_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS driver_share_consent TEXT,
  ADD COLUMN IF NOT EXISTS driver_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS correction_of UUID REFERENCES employment_verification_requests(id);

ALTER TABLE employment_verification_requests
  DROP CONSTRAINT IF EXISTS evr_driver_share_consent_check;

ALTER TABLE employment_verification_requests
  ADD CONSTRAINT evr_driver_share_consent_check
  CHECK (driver_share_consent IS NULL OR driver_share_consent IN ('share', 'hold'));

COMMENT ON COLUMN employment_verification_requests.driver_share_consent IS
  'share = show on career card; hold = stored but not shared. Null until the driver reviews.';
COMMENT ON COLUMN employment_verification_requests.driver_hidden IS
  'Driver hid this packet (older EVs). Hidden rows never appear on the career card.';
COMMENT ON COLUMN employment_verification_requests.correction_of IS
  'If set, this request is a follow-up correction. The original row is never overwritten.';
