-- ============================================================
-- MIGRATION 095: BACKFILL — demote premature `in_progress`
-- screening-consent invites back to `viewed`
-- ============================================================
-- Date: 2026-06-01
-- Reason: New outreach status semantics (DEC: kanban locked 2026-06-01).
--   `in_progress` now means "consent forms fully filled out + signed"
--   (a completed screening_consent_bundles row). Previously the invite
--   flipped to `in_progress` the moment the candidate signed in during
--   onboarding — BEFORE signing any consent — via POST /api/invite/[token].
--   That premature flip is removed in code; this migration corrects the
--   rows it already created.
--
-- Rule: a driver-screening-consent invite sitting at `in_progress` with
--   NO completed consent bundle for its (driver, company) is demoted to
--   `viewed` ("engaged, not started"). We deliberately EXCLUDE any invite
--   that already has a returned MVR/PSP screening — those belong at
--   `completed` and are handled by syncOutreachInviteForDriver on the next
--   board load (and would never legitimately lack a consent bundle anyway).
--
-- Invites WITH a completed bundle correctly stay `in_progress`. Completion
-- (any MVR/PSP result returned) and consent-done → in_progress transitions
-- self-heal via syncOutreachInvitesForCompany when the employer next opens
-- the board, so they are not re-derived here.
-- ============================================================

UPDATE application_invites ai
SET status = 'viewed', updated_at = NOW()
WHERE ai.target_block_type = 'driver-screening-consent'
  AND ai.status = 'in_progress'
  -- No signed consent bundle on file for this (driver, company).
  AND NOT EXISTS (
    SELECT 1
    FROM screening_consent_bundles scb
    WHERE scb.driver_user_id = ai.used_by_user_id
      AND scb.company_id = ai.company_id
      AND scb.status = 'complete'
  )
  -- Safety: never demote an invite whose screening already came back
  -- (would belong at `completed`, not `viewed`).
  AND NOT EXISTS (
    SELECT 1 FROM mvr_orders mo
    WHERE mo.driver_user_id = ai.used_by_user_id
      AND mo.ordered_by_company_id = ai.company_id
      AND LOWER(COALESCE(mo.status, '')) IN ('completed', 'needs_review', 'failed')
  )
  AND NOT EXISTS (
    SELECT 1 FROM psp_orders po
    WHERE po.driver_user_id = ai.used_by_user_id
      AND po.ordered_by_company_id = ai.company_id
      AND LOWER(COALESCE(po.status, '')) IN ('completed', 'needs_review', 'failed')
  );
