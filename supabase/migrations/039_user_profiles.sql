-- 039_user_profiles.sql
-- Unified user_profiles table for role-agnostic identity data.
-- driver_profiles and developer_profiles remain as role-specific extension tables
-- used by blocks (CDL, MVR, GitHub, etc.). This table holds the shared fields
-- that every candidate needs regardless of their profession.

CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  first_name    TEXT,
  last_name     TEXT,
  display_name  TEXT,
  email         TEXT,
  phone         TEXT,
  avatar_url    TEXT,
  headline      TEXT,  -- e.g. "CDL-A Driver", "Full Stack Dev", "Warehouse Manager"
  city          TEXT,
  state         TEXT,
  zip_code      TEXT,
  date_of_birth DATE,
  professional_summary TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE user_profiles IS
  'Role-agnostic identity data shared by all candidates. Role-specific fields live in driver_profiles / developer_profiles.';

-- Seed from existing driver_profiles (preferred source — has the most complete data)
INSERT INTO user_profiles (user_id, first_name, last_name, email, phone, avatar_url, city, state, zip_code, date_of_birth, professional_summary, created_at, updated_at)
SELECT
  dp.user_id,
  dp.first_name,
  dp.last_name,
  dp.email,
  dp.phone,
  dp.avatar_url,
  dp.city,
  dp.state,
  dp.zip_code,
  dp.date_of_birth,
  dp.professional_summary,
  dp.created_at,
  dp.updated_at
FROM driver_profiles dp
WHERE dp.first_name IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Fill in from developer_profiles for users who don't have a driver_profiles row
INSERT INTO user_profiles (user_id, first_name, last_name, display_name, email, phone, avatar_url, headline, city, state, professional_summary, created_at, updated_at)
SELECT
  dev.user_id,
  dev.first_name,
  dev.last_name,
  dev.display_name,
  dev.email,
  dev.phone,
  dev.avatar_url,
  dev.headline,
  -- developer_profiles stores location as a single text field
  SPLIT_PART(dev.location, ', ', 1),  -- city portion
  SPLIT_PART(dev.location, ', ', 2),  -- state portion
  dev.bio,
  dev.created_at,
  dev.updated_at
FROM developer_profiles dev
WHERE dev.first_name IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role / admin bypass (admin supabase client uses service role)
CREATE POLICY "Service role full access"
  ON user_profiles FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
