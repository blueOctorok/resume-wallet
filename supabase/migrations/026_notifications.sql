-- ============================================================
-- MIGRATION 026: In-App Notifications
-- ============================================================
-- Date: March 2026
-- Purpose: Persistent in-app notifications for drivers, developers,
--          and employers. Created server-side alongside emails so
--          users always have a record of important events.
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Notification type — used for icon/color rendering on the frontend
  type         TEXT        NOT NULL,
  -- CHECK kept loose on purpose so new types can be added without migrations:
  -- 'application_status' | 'candidate_request' | 'employment_verification'
  -- | 'team_invite' | 'new_application' | 'consent_signed' | 'system'

  title        TEXT        NOT NULL,
  body         TEXT        NOT NULL,

  -- Optional structured payload (e.g. applicationId, companyName, jobTitle)
  data         JSONB       NOT NULL DEFAULT '{}',

  -- Deep-link back into the app (e.g. /hub#requests)
  action_url   TEXT,

  read         BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Most queries are "get unread notifications for user, newest first"
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications(user_id, read, created_at DESC);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users view own notifications"
  ON notifications FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users WHERE lower(wallet_address) = lower(current_setting('request.jwt.claims', true)::json->>'sub')
    )
  );

-- Users can mark their own notifications read
CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (
    user_id IN (
      SELECT id FROM users WHERE lower(wallet_address) = lower(current_setting('request.jwt.claims', true)::json->>'sub')
    )
  );

COMMENT ON TABLE notifications IS
  'In-app notification records. Created server-side at the same time as emails are sent.';
