-- One focus-group survey per driver, keyed to their login.
-- Service role only (API checks the session, then writes). No client policies.

CREATE TABLE IF NOT EXISTS driver_surveys (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  answers       JSONB NOT NULL,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE driver_surveys IS
  'Driver focus-group survey. One row per user. Reviewed in central admin.';

ALTER TABLE driver_surveys ENABLE ROW LEVEL SECURITY;
