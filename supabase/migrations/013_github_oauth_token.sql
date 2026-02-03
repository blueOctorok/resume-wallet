-- ============================================================
-- MIGRATION 013: GitHub OAuth Token Storage
-- ============================================================
-- Purpose: Add github_access_token to developer_profiles for OAuth
-- This allows fetching private repo data with user authorization
-- ============================================================

-- Add token column (encrypted at rest by Supabase)
ALTER TABLE developer_profiles
  ADD COLUMN IF NOT EXISTS github_access_token TEXT;

-- Add index for faster lookups by username
CREATE INDEX IF NOT EXISTS idx_developer_profiles_github_connected
  ON developer_profiles(github_username)
  WHERE github_access_token IS NOT NULL;

COMMENT ON COLUMN developer_profiles.github_access_token IS 'OAuth access token for GitHub API - allows reading private repos';

-- ============================================================
-- SECURITY NOTE:
-- This token grants access to the user''s private repos.
-- - RLS policies already restrict access to owner only
-- - Token is stored encrypted at rest by Supabase
-- - Never expose this column in public API responses
-- ============================================================
