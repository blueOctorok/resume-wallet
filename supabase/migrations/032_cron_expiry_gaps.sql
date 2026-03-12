-- ============================================================
-- MIGRATION 032: Fill expiry cron gaps
-- ============================================================
-- Date: March 2026
--
-- Adds automated enforcement for four schema columns that already
-- had expiry semantics but no scheduled job to act on them:
--
--   1. company_members.invite_expires_at (7-day team invite tokens)
--   2. mvr_orders.expires_at             (30-day MVR result window)
--   3. candidate_requests.expires_at     (employer→driver action requests)
--   4. job_postings.expires_at           (auto-close expired postings)
--
-- Requires pg_cron (enabled in migration 028).
-- ============================================================

-- ── 1. Expire stale team-member invites ───────────────────────────────────────
-- When an employer invites a team member, the token is valid for 7 days.
-- Without this job the token stays valid indefinitely. Runs hourly alongside
-- the existing application_invites expiry job.
SELECT cron.schedule(
  'expire-team-invites',
  '5 * * * *', -- 5 minutes past every hour (offset from expire-stale-invites)
  $$
    UPDATE company_members
    SET invite_token   = NULL,
        updated_at     = NOW()
    WHERE accepted_at  IS NULL
      AND invite_expires_at IS NOT NULL
      AND invite_expires_at < NOW();
  $$
);

-- ── 2. Mark expired MVR orders ────────────────────────────────────────────────
-- MVR results are only legally valid for ~30 days. When expires_at passes the
-- order should be flagged so the employer knows they need a fresh one. Runs
-- nightly at 4 AM UTC.
SELECT cron.schedule(
  'expire-mvr-orders',
  '0 4 * * *',
  $$
    UPDATE mvr_orders
    SET status     = 'expired',
        updated_at = NOW()
    WHERE status NOT IN ('expired', 'failed', 'cancelled')
      AND expires_at IS NOT NULL
      AND expires_at < NOW();
  $$
);

-- Also nullify the mirror column on driver_profiles so has_mvr checks
-- don't linger after the underlying order expires.
SELECT cron.schedule(
  'sync-driver-mvr-expiry',
  '10 4 * * *', -- 10 minutes after expire-mvr-orders so the order rows are updated first
  $$
    UPDATE driver_profiles
    SET mvr_expires_at = NULL,
        updated_at     = NOW()
    WHERE mvr_expires_at IS NOT NULL
      AND mvr_expires_at < NOW();
  $$
);

-- ── 3. Expire stale candidate requests ───────────────────────────────────────
-- Employer sends a driver a request (e.g. "upload resume", "sign disclosure").
-- If the driver never responds and the optional expires_at window passes,
-- transition the request to 'expired' so the employer's UI reflects reality.
-- Runs nightly at 4:30 AM UTC.
SELECT cron.schedule(
  'expire-candidate-requests',
  '30 4 * * *',
  $$
    UPDATE candidate_requests
    SET status     = 'expired',
        updated_at = NOW()
    WHERE status   IN ('pending', 'viewed')
      AND expires_at IS NOT NULL
      AND expires_at < NOW();
  $$
);

-- ── 4. Auto-close expired job postings ───────────────────────────────────────
-- Job postings have an expires_at column that is never enforced. If a posting
-- passes its expiry date it should no longer accept applications. Sets
-- is_active = false; the employer can manually reopen if they want.
-- Runs nightly at 4:45 AM UTC.
SELECT cron.schedule(
  'close-expired-job-postings',
  '45 4 * * *',
  $$
    UPDATE job_postings
    SET is_active  = false,
        updated_at = NOW()
    WHERE is_active  = true
      AND expires_at IS NOT NULL
      AND expires_at < NOW();
  $$
);

-- ============================================================
-- REFERENCE: Manage these jobs with:
--
--   SELECT * FROM cron.job;
--   SELECT cron.unschedule('expire-team-invites');
--   SELECT cron.unschedule('expire-mvr-orders');
--   SELECT cron.unschedule('sync-driver-mvr-expiry');
--   SELECT cron.unschedule('expire-candidate-requests');
--   SELECT cron.unschedule('close-expired-job-postings');
-- ============================================================
