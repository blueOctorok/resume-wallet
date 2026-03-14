-- 036: Unified share token on users table
--
-- Previously, share tokens lived on driver_profiles and developer_profiles.
-- With the composable hub, every candidate (regardless of role) needs a share
-- token. We store it on the users table so it's role-agnostic.

-- Add columns to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS share_settings JSONB DEFAULT '{"showContact": false, "allowConnect": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS share_token_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS share_views_count INTEGER DEFAULT 0;

-- Copy existing driver share tokens (only where they exist)
UPDATE users u
SET
  share_token = dp.share_token,
  share_settings = COALESCE(dp.share_settings, '{"showContact": false, "allowConnect": true}'::jsonb),
  share_token_created_at = dp.share_token_created_at,
  share_views_count = COALESCE(dp.share_views_count, 0)
FROM driver_profiles dp
WHERE dp.user_id = u.id
  AND dp.share_token IS NOT NULL
  AND u.share_token IS NULL;

-- Copy existing developer share tokens (only where user doesn't already have one from driver)
UPDATE users u
SET
  share_token = devp.share_token,
  share_settings = COALESCE(devp.share_settings, '{"showContact": false, "allowConnect": true}'::jsonb),
  share_token_created_at = devp.share_token_created_at,
  share_views_count = COALESCE(devp.share_views_count, 0)
FROM developer_profiles devp
WHERE devp.user_id = u.id
  AND devp.share_token IS NOT NULL
  AND u.share_token IS NULL;

-- Index for token lookups on public card page
CREATE INDEX IF NOT EXISTS idx_users_share_token ON users (share_token) WHERE share_token IS NOT NULL;
