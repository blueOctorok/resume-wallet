-- ============================================================
-- MIGRATION 091: BACKFILL — link orphan outreach invites to users
-- who completed consent through a different path
-- ============================================================
-- Date: 2026-05-28
-- Reason: One-time data fix paired with the auto-link logic added to
--   `lib/sync-outreach-invite-status.ts` and the consent-completion
--   hook in `api/candidate/screening-consent/route.ts` shipping in the
--   same commit.
--
-- Symptom (Pace Drivers, 2026-05-28):
--   Quantez Johnson (and Micah King) appeared "Pending" on the outreach
--   kanban indefinitely, even though Pace HR was receiving consent-
--   completion emails for them. Both had Storm accounts AND completed
--   `screening_consent_bundles` for Pace — just through the Talent
--   Search → candidate-request → hub path, NOT through the outreach
--   invite token. The outreach invite stayed orphaned with
--   `used_by_user_id = NULL` and `status = 'pending'` because nothing
--   matched the email-only invite to the existing user.
--
-- Forward fix:
--   `syncOutreachInviteForDriver` now matches orphan invites by
--   `(company_id, lower(candidate_email))` and back-links them on
--   consent completion. The consent endpoint invokes the sync. The
--   employer kanban GET also runs `syncOutreachInvitesForCompany` on
--   every load, but that only iterates over already-linked drivers —
--   orphans are caught only when the driver hits the consent endpoint
--   or when this backfill runs.
--
-- This migration cleans up the two known orphans plus any others that
-- match the same shape. After this runs the kanban will show them in
-- the Completed column with today's `updated_at`.
-- ============================================================

UPDATE application_invites ai
SET
  status = 'completed',
  used_by_user_id = up.user_id,
  updated_at = NOW()
FROM user_profiles up
WHERE
  LOWER(TRIM(up.email)) = LOWER(TRIM(ai.candidate_email))
  AND ai.target_block_type = 'driver-screening-consent'
  AND ai.status IN ('pending', 'viewed', 'in_progress')
  AND ai.used_by_user_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM screening_consent_bundles scb
    WHERE scb.driver_user_id = up.user_id
      AND scb.company_id = ai.company_id
      AND scb.status = 'complete'
  );
