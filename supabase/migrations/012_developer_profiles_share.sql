-- ============================================================
-- MIGRATION 012: Developer Profiles Share (Career Card)
-- ============================================================
-- Purpose: Add share token and settings to developer_profiles for Career Card QR
-- Mirrors driver_profiles share fields from migration 008
-- ============================================================

ALTER TABLE developer_profiles
  ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS share_settings JSONB DEFAULT '{
    "showResume": true,
    "showPortfolio": true,
    "showGitHub": true,
    "showContact": false,
    "allowConnect": true
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS share_token_created_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS share_views_count INTEGER DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_developer_profiles_share_token
  ON developer_profiles(share_token)
  WHERE share_token IS NOT NULL;

COMMENT ON COLUMN developer_profiles.share_token IS 'URL-safe token for public Career Card access';
COMMENT ON COLUMN developer_profiles.share_settings IS 'Privacy controls for Career Card visibility';
