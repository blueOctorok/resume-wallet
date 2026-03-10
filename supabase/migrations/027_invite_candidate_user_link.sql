-- ============================================================
-- MIGRATION 027: Link invites to existing StormChain profiles
-- ============================================================
-- When an employer selects an existing StormChain profile while
-- creating an outreach invite, we store the candidate's user_id.
-- This is what makes in-app notifications work for the candidate —
-- without a user_id, we can only send email (to non-members).
-- ============================================================

ALTER TABLE application_invites
ADD COLUMN IF NOT EXISTS candidate_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN application_invites.candidate_user_id IS
  'Set when the employer links the invite to an existing StormChain profile.
   Enables in-app notifications. NULL means the invite targets someone not yet on the platform.';
