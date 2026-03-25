-- Comprehensive constraint audit fix (March 2026)
--
-- Three CHECK constraints were out of sync with what the application code
-- and cron jobs actually write. This migration reconciles all of them.
--
-- 1. application_invites.type — add 'block' (composable hub outreach)
-- 2. candidate_requests.request_type — add 'block_request' (employer→candidate block requests)
-- 3. mvr_orders.status — add 'expired' (nightly cron job from migration 032)

-- ============================================================
-- 1. application_invites.type
--    Code writes 'block' | 'general'. Legacy values kept for history.
--    Also fix the DEFAULT from 'driver_dot' → 'general' since no code
--    path produces driver_dot anymore.
-- ============================================================
ALTER TABLE application_invites
  DROP CONSTRAINT IF EXISTS application_invites_type_check;

ALTER TABLE application_invites
  ADD CONSTRAINT application_invites_type_check
  CHECK (type IN ('driver_dot', 'developer_card', 'general', 'block'));

ALTER TABLE application_invites
  ALTER COLUMN type SET DEFAULT 'general';

-- ============================================================
-- 2. candidate_requests.request_type
--    CareerCardModal sends 'block_request' for composable block requests.
--    Without this, every employer "Request Resume/MVR/etc" crashes.
-- ============================================================
ALTER TABLE candidate_requests
  DROP CONSTRAINT IF EXISTS candidate_requests_request_type_check;

ALTER TABLE candidate_requests
  ADD CONSTRAINT candidate_requests_request_type_check
  CHECK (request_type IN (
    'mvr_order', 'document_upload', 'verification',
    'profile_completion', 'custom', 'block_request'
  ));

-- ============================================================
-- 3. mvr_orders.status
--    032_cron_expiry_gaps.sql writes 'expired' nightly, but the CHECK
--    from the original migration didn't include it. The cron would fail
--    silently once any MVR order passes expires_at.
-- ============================================================
ALTER TABLE mvr_orders
  DROP CONSTRAINT IF EXISTS mvr_orders_status_check;

ALTER TABLE mvr_orders
  ADD CONSTRAINT mvr_orders_status_check
  CHECK (status IN (
    'pending', 'processing', 'completed', 'failed',
    'needs_review', 'cancelled', 'expired'
  ));
