-- ============================================================
-- MIGRATION 092: REVERT — flip consent-only "completed" invites
-- back to in_progress, link any orphan invites
-- ============================================================
-- Date: 2026-05-28
-- Reason: Corrects an over-eager auto-complete shipped earlier in the
--   day. The previous fix (sync-outreach-invite-status.ts) flipped
--   driver-screening-consent invites to `completed` when consent was
--   signed, regardless of whether MVR/PSP had been ordered. That broke
--   Pace's workflow:
--
--     - "Completed" status locks the card from edits (canAct check in
--       OutreachCandidateCard.tsx), so HR could not check the
--       MVR/PSP boxes to run the actual screenings.
--     - "Completed" also starts the 14-day archive timer, so candidates
--       Pace had not yet screened would silently disappear.
--
--   Pace's mental model: completed = "all ordered screenings came
--   back," not "consent signed." Consent-signed-no-orders should stay
--   in_progress so HR has an active to-do queue.
--
-- This migration re-applies the ORIGINAL sync rule:
--
--   An invite is `completed` iff at least one MVR or PSP order exists
--   for (driver, company) AND every such order has reached a terminal
--   status (completed / needs_review / failed). Anything else with a
--   completed consent bundle goes back to `in_progress`.
--
-- This rule is symmetric with what `syncOutreachInviteForDriver` does
-- now, so re-running this migration is idempotent and matches the
-- code's current behavior.
--
-- Replaces never-applied migrations 090 and 091 (deleted in the same
-- commit since they were data fixes for a code path that no longer
-- exists).
-- ============================================================

-- 1. Re-apply the sync rule to every currently-`completed`
--    driver-screening-consent invite. Flip anything that does NOT
--    satisfy "≥1 order exists AND every order is terminal" back to
--    in_progress.
WITH order_state AS (
  SELECT
    ai.id,
    -- Total orders (MVR + PSP) for this (driver, company)
    (
      (SELECT COUNT(*) FROM mvr_orders mo
       WHERE mo.driver_user_id = ai.used_by_user_id
         AND mo.ordered_by_company_id = ai.company_id)
    + (SELECT COUNT(*) FROM psp_orders po
       WHERE po.driver_user_id = ai.used_by_user_id
         AND po.ordered_by_company_id = ai.company_id)
    ) AS total_orders,
    -- Non-terminal orders (still pending)
    (
      (SELECT COUNT(*) FROM mvr_orders mo
       WHERE mo.driver_user_id = ai.used_by_user_id
         AND mo.ordered_by_company_id = ai.company_id
         AND LOWER(COALESCE(mo.status, '')) NOT IN ('completed', 'needs_review', 'failed'))
    + (SELECT COUNT(*) FROM psp_orders po
       WHERE po.driver_user_id = ai.used_by_user_id
         AND po.ordered_by_company_id = ai.company_id
         AND LOWER(COALESCE(po.status, '')) NOT IN ('completed', 'needs_review', 'failed'))
    ) AS pending_orders
  FROM application_invites ai
  WHERE ai.target_block_type = 'driver-screening-consent'
    AND ai.status = 'completed'
    AND ai.used_by_user_id IS NOT NULL
)
UPDATE application_invites ai
SET status = 'in_progress', updated_at = NOW()
FROM order_state os
WHERE ai.id = os.id
  -- Flip back unless the row passes the original sync rule.
  AND NOT (os.total_orders > 0 AND os.pending_orders = 0);

-- 2. Back-link orphan invites whose driver completed consent through
--    another path (Quantez Johnson, Micah King). Status becomes
--    in_progress so Pace can still order MVR/PSP.
UPDATE application_invites ai
SET
  status = 'in_progress',
  used_by_user_id = up.user_id,
  updated_at = NOW()
FROM user_profiles up
WHERE
  LOWER(TRIM(up.email)) = LOWER(TRIM(ai.candidate_email))
  AND ai.target_block_type = 'driver-screening-consent'
  AND ai.status IN ('pending', 'viewed')
  AND ai.used_by_user_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM screening_consent_bundles scb
    WHERE scb.driver_user_id = up.user_id
      AND scb.company_id = ai.company_id
      AND scb.status = 'complete'
  );
