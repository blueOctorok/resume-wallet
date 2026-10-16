-- One row per notice we have already sent, so the daily resume job does not
-- text the same driver about the same CDL date every morning.
-- A new expiration date is a new fingerprint and can be sent again.
-- Service role only. Drivers read the in-app notification, not this table.

CREATE TABLE IF NOT EXISTS driver_keep_current_notices (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('resume_ready', 'cdl_expired')),
  fingerprint TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, kind, fingerprint)
);

ALTER TABLE driver_keep_current_notices ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE driver_keep_current_notices IS
  'Dedup for resume-ready and expired-CDL email/SMS. fingerprint is "ready" or the CDL expiration date (YYYY-MM-DD).';
