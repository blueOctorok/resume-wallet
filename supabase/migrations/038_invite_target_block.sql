-- ============================================================
-- MIGRATION 038: Block-based outreach — target_block_type
-- ============================================================
-- Date: March 2026
--
-- Context:
--   Outreach invites are moving from hardcoded types (driver_dot,
--   developer_card, general) to a block-based system. Employers
--   can now target any candidate block from the registry, and
--   invitees land on StormChain with that block pre-installed.
--
--   The old `type` column remains for backward compat. New invites
--   use type='block' with target_block_type set, or type='general'.
-- ============================================================

ALTER TABLE application_invites
  ADD COLUMN IF NOT EXISTS target_block_type TEXT;

COMMENT ON COLUMN application_invites.target_block_type IS
  'Candidate block ID from block-registry.ts (e.g. driver-dot-application). When set, the invitee gets this block pre-installed and is routed to its flow. Null = general invite.';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
