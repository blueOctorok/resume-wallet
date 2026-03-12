-- ============================================================
-- MIGRATION 033: Profile Avatars
-- ============================================================
-- Date: March 2026
--
-- Adds avatar_url to driver_profiles and developer_profiles.
-- Avatars are stored separately per role so a user with both
-- a driver and developer profile can have different profile
-- photos for each identity.
--
-- Storage: images live in the Supabase Storage bucket "avatars".
-- ⚠️  Create the bucket manually in the Supabase Dashboard:
--       Storage → New bucket → Name: "avatars" → Public: true
--   Or via the JS client / REST API — cannot be created in SQL.
-- ============================================================

ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE developer_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN driver_profiles.avatar_url IS
  'Public URL of the driver''s profile photo in Supabase Storage (avatars/driver/{userId}).';

COMMENT ON COLUMN developer_profiles.avatar_url IS
  'Public URL of the developer''s profile photo in Supabase Storage (avatars/developer/{userId}).';
