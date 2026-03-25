-- Phase 3: AI job alerts — saved searches, dedupe, cron-driven notifications
-- Access: server-side via service role (API routes). No RLS policies = locked for anon/auth JWT.

CREATE TABLE IF NOT EXISTS job_alert_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label           TEXT,
  keywords        TEXT NOT NULL,
  location        TEXT,
  salary_min      INTEGER,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  min_match_score SMALLINT NOT NULL DEFAULT 72 CHECK (min_match_score >= 50 AND min_match_score <= 95),
  last_scan_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_alert_prefs_user_idx ON job_alert_preferences (user_id);
CREATE INDEX IF NOT EXISTS job_alert_prefs_active_scan_idx
  ON job_alert_preferences (is_active, last_scan_at ASC NULLS FIRST);

COMMENT ON TABLE job_alert_preferences IS
  'Candidate job alert saved searches; cron scores new Adzuna results and sends in-app notifications.';

CREATE TABLE IF NOT EXISTS job_alert_sent (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_job_id   TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_job_id)
);

CREATE INDEX IF NOT EXISTS job_alert_sent_user_idx ON job_alert_sent (user_id);

COMMENT ON TABLE job_alert_sent IS
  'Dedupe: one notification per user per external (Adzuna) job id.';

ALTER TABLE job_alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_alert_sent ENABLE ROW LEVEL SECURITY;
