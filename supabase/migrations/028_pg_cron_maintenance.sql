-- ============================================================
-- MIGRATION 028: Automated Maintenance with pg_cron
-- ============================================================
-- ⚠️  REQUIRES Supabase Pro tier and pg_cron enabled in Dashboard:
--        Dashboard → Database → Extensions → enable "pg_cron"
--
-- Run this migration AFTER enabling the extension in the Supabase Dashboard.
-- Cron jobs persist in the database and survive deployments.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- 1. EXPIRE STALE INVITE LINKS
-- ============================================================
-- Runs every hour. Marks pending invites as 'expired' once
-- their expires_at has passed. Completed and cancelled invites
-- are untouched.
SELECT cron.schedule(
  'expire-stale-invites',
  '0 * * * *', -- every hour on the hour
  $$
    UPDATE application_invites
    SET status = 'expired', updated_at = NOW()
    WHERE status IN ('pending', 'viewed', 'in_progress')
      AND expires_at < NOW();
  $$
);

-- ============================================================
-- 2. CLEAN UP OLD READ NOTIFICATIONS
-- ============================================================
-- Runs nightly at 3 AM UTC. Deletes notifications that are:
--   - Already read
--   - Older than 90 days
-- Unread notifications are kept indefinitely so users can't miss them.
SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 3 * * *', -- 3 AM UTC daily
  $$
    DELETE FROM notifications
    WHERE read = true
      AND created_at < NOW() - INTERVAL '90 days';
  $$
);

-- ============================================================
-- 3. EXPIRE STALE EMPLOYMENT VERIFICATION TOKENS
-- ============================================================
-- Runs nightly at 3:30 AM UTC. Marks verification requests as
-- expired when their token window has passed and they're still
-- in an open state.
SELECT cron.schedule(
  'expire-verification-tokens',
  '30 3 * * *', -- 3:30 AM UTC daily
  $$
    UPDATE employment_verification_requests
    SET status = 'EXPIRED', updated_at = NOW()
    WHERE status IN ('VERIFICATION_REQUESTED', 'VERIFICATION_IN_PROGRESS')
      AND token_expires_at < NOW();
  $$
);

-- ============================================================
-- REFERENCE: Manage these jobs in the future with:
--
--   SELECT * FROM cron.job;                          -- list all jobs
--   SELECT cron.unschedule('expire-stale-invites');  -- remove a job
--   SELECT cron.unschedule('cleanup-old-notifications');
--   SELECT cron.unschedule('expire-verification-tokens');
-- ============================================================
