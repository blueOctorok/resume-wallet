-- Migration 047: block_dev_profile table
-- Covers orphaned developer_profiles columns that had no block table in migration 046.

CREATE TABLE IF NOT EXISTS block_dev_profile (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio                 TEXT,
  years_experience    INTEGER,
  employment_history  JSONB NOT NULL DEFAULT '[]',
  job_types           TEXT[] DEFAULT '{}',
  work_styles         TEXT[] DEFAULT '{}',
  willing_to_relocate BOOLEAN DEFAULT false,
  available_for_work  BOOLEAN DEFAULT false,
  certifications      JSONB NOT NULL DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE block_dev_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all_block_dev_profile
  ON block_dev_profile FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Backfill from developer_profiles
INSERT INTO block_dev_profile (
  user_id, bio, years_experience, employment_history,
  job_types, work_styles, willing_to_relocate, available_for_work,
  certifications, created_at, updated_at
)
SELECT
  dp.user_id,
  dp.bio,
  dp.years_experience,
  COALESCE(dp.employment_history, '[]'::jsonb),
  COALESCE(dp.job_types, '{}'),
  COALESCE(dp.work_styles, '{}'),
  COALESCE(dp.willing_to_relocate, false),
  COALESCE(dp.available_for_work, false),
  COALESCE(dp.certifications, '[]'::jsonb),
  dp.created_at,
  dp.updated_at
FROM developer_profiles dp
WHERE dp.bio IS NOT NULL
   OR dp.years_experience IS NOT NULL
   OR (dp.employment_history IS NOT NULL AND dp.employment_history != '[]'::jsonb)
   OR dp.available_for_work = true
ON CONFLICT (user_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_block_dev_profile_user ON block_dev_profile(user_id);
