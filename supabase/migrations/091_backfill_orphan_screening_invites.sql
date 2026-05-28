-- ============================================================
-- MIGRATION 091: BACKFILL — link orphan outreach invites
-- ============================================================
-- Date: 2026-05-28
-- Status: APPLIED to production, then logically reversed by migration 092
--   for the status portion (back-linking the user_id was correct; flipping
--   to `completed` was wrong — those should have been `in_progress`).
-- See migration 092 + docs/CHANGES.md "HOTFIX — Outreach kanban" entry
-- (2026-05-28) for the full postmortem.
--
-- This file is preserved verbatim for migration-history fidelity.
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
