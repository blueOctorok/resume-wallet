-- ============================================================
-- MIGRATION 090: BACKFILL — flip consent-only outreach invites to `completed`
-- ============================================================
-- Date: 2026-05-28
-- Status: APPLIED to production, then logically reversed by migration 092.
-- Reason for reversal: This migration paired with a code change that flipped
--   `driver-screening-consent` invites to `completed` once consent was signed,
--   without requiring MVR/PSP to be run. That was wrong — Pace's mental
--   model of "completed" is "all ordered screenings came back," not "consent
--   signed." The status flip locked HR out of the Edit modal (where MVR/PSP
--   ordering happens), broke the workflow for ~14 candidates, and started a
--   premature 14-day archive timer. See migration 092 + docs/CHANGES.md
--   "HOTFIX — Outreach kanban" entry (2026-05-28) for the full postmortem.
--
-- This file is preserved verbatim for migration-history fidelity. Migration
-- 092 supersedes its effects.
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
