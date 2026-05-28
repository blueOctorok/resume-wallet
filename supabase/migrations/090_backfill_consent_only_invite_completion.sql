-- ============================================================
-- MIGRATION 090: BACKFILL — flip consent-only outreach invites to `completed`
-- ============================================================
-- Date: 2026-05-28
-- Reason: One-time data fix paired with the sync-outreach-invite-status.ts
-- code change shipping in the same commit.
--
-- Symptom (Pace Drivers, 2026-05-28):
--   Multiple candidates (Sean Buckner, Robert Duckett, Ernesto Fresneda,
--   Amanda Hodge, Kristopher Riley, Rontonio Porter) had completed the
--   FCRA + FMCSA + CDLIS screening consent bundle, but their outreach
--   invites in `application_invites` were still stuck on `in_progress`.
--   The kanban therefore left them in the wrong column and (combined with
--   the 50-row API limit) some fell off the board entirely.
--
-- Root cause:
--   `lib/sync-outreach-invite-status.ts` early-returned when there were
--   no MVR/PSP orders for the driver. That logic was written for the old
--   "consent + MVR/PSP together" flow. The current consent-first flow
--   collects consent, then employers decide whether to order screenings
--   separately — so consent-only candidates never satisfied the early
--   return guard and stayed `in_progress` forever.
--
-- Fix shipped in the same commit:
--   `syncOutreachInviteForDriver` now flips `driver-screening-consent`
--   invites to `completed` when a complete `screening_consent_bundles`
--   row exists for (driver_user_id, company_id) — independent of MVR/PSP.
--
-- This migration brings already-stuck production rows in line with the
-- new logic. Going forward, the sync runs on every kanban load via
-- `syncOutreachInvitesForCompany`, so we shouldn't need a periodic
-- backfill.
-- ============================================================

UPDATE application_invites ai
SET status = 'completed', updated_at = NOW()
WHERE ai.target_block_type = 'driver-screening-consent'
  AND ai.status IN ('viewed', 'in_progress')
  AND ai.used_by_user_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM screening_consent_bundles scb
    WHERE scb.driver_user_id = ai.used_by_user_id
      AND scb.company_id = ai.company_id
      AND scb.status = 'complete'
  );
