-- Migration 046: Block-Owned Data Tables
-- Phase 1 of Block-Owned Data Architecture.
-- Creates per-block data tables and backfills from driver_profiles / developer_profiles.
-- Old tables remain untouched — dual-write keeps them in sync during transition.

-- ============================================================================
-- DRIVER BLOCK TABLES
-- ============================================================================

-- block_driver_cdl: CDL license info (owned by driver-resume and driver-dot-application blocks)
CREATE TABLE IF NOT EXISTS block_driver_cdl (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cdl_number    TEXT,
  cdl_state     VARCHAR(2),
  cdl_class     VARCHAR(10),
  cdl_expiration DATE,
  endorsements  TEXT[] DEFAULT '{}',
  restrictions  TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- block_driver_employment: employment history (owned by driver-resume block)
CREATE TABLE IF NOT EXISTS block_driver_employment (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  history    JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- block_driver_mvr: MVR data (owned by driver-mvr block)
CREATE TABLE IF NOT EXISTS block_driver_mvr (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id         UUID,
  result_id        UUID,
  expires_at       TIMESTAMPTZ,
  license_status   VARCHAR(50),
  total_points     INTEGER DEFAULT 0,
  violation_count  INTEGER DEFAULT 0,
  violations       JSONB NOT NULL DEFAULT '[]',
  accidents        JSONB NOT NULL DEFAULT '[]',
  last_ordered_at  TIMESTAMPTZ,
  last_updated     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- block_driver_emergency: emergency contact (owned by driver-dot-application block)
CREATE TABLE IF NOT EXISTS block_driver_emergency (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_name         TEXT,
  contact_relationship TEXT,
  contact_phone        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- block_driver_experience: driving experience / equipment (owned by driver-dot-application block)
CREATE TABLE IF NOT EXISTS block_driver_experience (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ============================================================================
-- GENERAL BLOCK TABLES (shared across all roles)
-- ============================================================================

-- block_education: education entries (used by resume, dot-app, developer portfolio)
CREATE TABLE IF NOT EXISTS block_education (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entries    JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- block_skills: skills entries (used by resume, developer profile)
CREATE TABLE IF NOT EXISTS block_skills (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entries    JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- block_references: professional references (used by resume, dot-app)
CREATE TABLE IF NOT EXISTS block_references (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entries    JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ============================================================================
-- DEVELOPER BLOCK TABLES
-- ============================================================================

-- block_dev_github: GitHub integration data (owned by dev-github block)
CREATE TABLE IF NOT EXISTS block_dev_github (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username     TEXT,
  access_token TEXT,
  connected_at TIMESTAMPTZ,
  data         JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- block_dev_portfolio: developer links (owned by dev-portfolio block)
CREATE TABLE IF NOT EXISTS block_dev_portfolio (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  portfolio_url    TEXT,
  linkedin_url     TEXT,
  twitter_url      TEXT,
  personal_website TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE block_driver_cdl ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_driver_employment ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_driver_mvr ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_driver_emergency ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_driver_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_dev_github ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_dev_portfolio ENABLE ROW LEVEL SECURITY;

-- Service-role-only policies (all access goes through admin client in API routes)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'block_driver_cdl', 'block_driver_employment', 'block_driver_mvr',
    'block_driver_emergency', 'block_driver_experience',
    'block_education', 'block_skills', 'block_references',
    'block_dev_github', 'block_dev_portfolio'
  ])
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      'service_role_all_' || tbl, tbl
    );
  END LOOP;
END $$;

-- ============================================================================
-- BACKFILL FROM driver_profiles
-- ============================================================================

-- CDL data
INSERT INTO block_driver_cdl (user_id, cdl_number, cdl_state, cdl_class, cdl_expiration, endorsements, restrictions, created_at, updated_at)
SELECT
  dp.user_id,
  dp.cdl_number,
  dp.cdl_state,
  dp.cdl_class,
  dp.cdl_expiration,
  COALESCE(dp.endorsements, '{}'),
  COALESCE(dp.restrictions, '{}'),
  dp.created_at,
  dp.updated_at
FROM driver_profiles dp
WHERE dp.cdl_number IS NOT NULL OR dp.cdl_class IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Employment history
INSERT INTO block_driver_employment (user_id, history, updated_at)
SELECT
  dp.user_id,
  COALESCE(dp.employment_history, '[]'::jsonb),
  dp.updated_at
FROM driver_profiles dp
WHERE dp.employment_history IS NOT NULL AND dp.employment_history != '[]'::jsonb
ON CONFLICT (user_id) DO NOTHING;

-- MVR data
INSERT INTO block_driver_mvr (user_id, order_id, result_id, expires_at, license_status, total_points, violation_count, violations, accidents, last_ordered_at, last_updated, created_at, updated_at)
SELECT
  dp.user_id,
  dp.mvr_order_id,
  dp.mvr_result_id,
  dp.mvr_expires_at,
  dp.mvr_license_status,
  COALESCE(dp.mvr_total_points, 0),
  COALESCE(dp.mvr_violation_count, 0),
  COALESCE(dp.mvr_violations, '[]'::jsonb),
  COALESCE(dp.mvr_accidents, '[]'::jsonb),
  dp.mvr_last_ordered_at,
  dp.mvr_last_updated,
  dp.created_at,
  dp.updated_at
FROM driver_profiles dp
WHERE dp.mvr_order_id IS NOT NULL OR dp.mvr_result_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Emergency contact
INSERT INTO block_driver_emergency (user_id, contact_name, contact_relationship, contact_phone, created_at, updated_at)
SELECT
  dp.user_id,
  dp.emergency_contact_name,
  dp.emergency_contact_relationship,
  dp.emergency_contact_phone,
  dp.created_at,
  dp.updated_at
FROM driver_profiles dp
WHERE dp.emergency_contact_name IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Driving experience
INSERT INTO block_driver_experience (user_id, data, created_at, updated_at)
SELECT
  dp.user_id,
  dp.driving_experience,
  dp.created_at,
  dp.updated_at
FROM driver_profiles dp
WHERE dp.driving_experience IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Education (from driver_profiles)
INSERT INTO block_education (user_id, entries, updated_at)
SELECT
  dp.user_id,
  COALESCE(dp.education, '[]'::jsonb),
  dp.updated_at
FROM driver_profiles dp
WHERE dp.education IS NOT NULL AND dp.education != '[]'::jsonb
ON CONFLICT (user_id) DO NOTHING;

-- Skills (from driver_profiles)
INSERT INTO block_skills (user_id, entries, updated_at)
SELECT
  dp.user_id,
  COALESCE(dp.skills, '[]'::jsonb),
  dp.updated_at
FROM driver_profiles dp
WHERE dp.skills IS NOT NULL AND dp.skills != '[]'::jsonb
ON CONFLICT (user_id) DO NOTHING;

-- References
INSERT INTO block_references (user_id, entries, updated_at)
SELECT
  dp.user_id,
  COALESCE(dp.references, '[]'::jsonb),
  dp.updated_at
FROM driver_profiles dp
WHERE dp.references IS NOT NULL AND dp.references != '[]'::jsonb
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- BACKFILL FROM developer_profiles
-- ============================================================================

-- GitHub data
INSERT INTO block_dev_github (user_id, username, access_token, connected_at, data, created_at, updated_at)
SELECT
  devp.user_id,
  devp.github_username,
  devp.github_access_token,
  devp.github_connected_at,
  devp.github_data,
  devp.created_at,
  devp.updated_at
FROM developer_profiles devp
WHERE devp.github_username IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Portfolio links
INSERT INTO block_dev_portfolio (user_id, portfolio_url, linkedin_url, twitter_url, personal_website, created_at, updated_at)
SELECT
  devp.user_id,
  devp.portfolio_url,
  devp.linkedin_url,
  devp.twitter_url,
  devp.personal_website,
  devp.created_at,
  devp.updated_at
FROM developer_profiles devp
WHERE devp.portfolio_url IS NOT NULL OR devp.linkedin_url IS NOT NULL OR devp.personal_website IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Education (from developer_profiles — merge with any driver education already inserted)
INSERT INTO block_education (user_id, entries, updated_at)
SELECT
  devp.user_id,
  COALESCE(devp.education, '[]'::jsonb),
  devp.updated_at
FROM developer_profiles devp
WHERE devp.education IS NOT NULL AND devp.education != '[]'::jsonb
ON CONFLICT (user_id) DO NOTHING;

-- Skills (from developer_profiles — merge with any driver skills already inserted)
INSERT INTO block_skills (user_id, entries, updated_at)
SELECT
  devp.user_id,
  COALESCE(devp.skills, '[]'::jsonb),
  devp.updated_at
FROM developer_profiles devp
WHERE devp.skills IS NOT NULL AND devp.skills != '[]'::jsonb
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- INDEXES for common lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_block_driver_cdl_user ON block_driver_cdl(user_id);
CREATE INDEX IF NOT EXISTS idx_block_driver_employment_user ON block_driver_employment(user_id);
CREATE INDEX IF NOT EXISTS idx_block_driver_mvr_user ON block_driver_mvr(user_id);
CREATE INDEX IF NOT EXISTS idx_block_driver_emergency_user ON block_driver_emergency(user_id);
CREATE INDEX IF NOT EXISTS idx_block_driver_experience_user ON block_driver_experience(user_id);
CREATE INDEX IF NOT EXISTS idx_block_education_user ON block_education(user_id);
CREATE INDEX IF NOT EXISTS idx_block_skills_user ON block_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_block_references_user ON block_references(user_id);
CREATE INDEX IF NOT EXISTS idx_block_dev_github_user ON block_dev_github(user_id);
CREATE INDEX IF NOT EXISTS idx_block_dev_portfolio_user ON block_dev_portfolio(user_id);
