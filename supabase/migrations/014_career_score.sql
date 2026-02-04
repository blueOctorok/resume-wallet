-- Migration: 014_career_score.sql
-- Purpose: Add AI-generated career score to developer_profiles
-- 
-- The career_score column stores:
-- {
--   score: number (0-100),
--   grade: string ('A', 'B', 'C', 'D', 'F'),
--   breakdown: {
--     github: { score: number, factors: {...} },
--     portfolio: { score: number, factors: {...} },
--     profile: { score: number, factors: {...} }
--   },
--   suggestions: string[],
--   analyzedAt: timestamp
-- }

-- Add career_score column
ALTER TABLE developer_profiles 
ADD COLUMN IF NOT EXISTS career_score JSONB DEFAULT NULL;

-- Add GIN index for JSONB queries (more flexible than expression indexes)
CREATE INDEX IF NOT EXISTS idx_developer_profiles_career_score 
ON developer_profiles USING GIN (career_score) 
WHERE career_score IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN developer_profiles.career_score IS 'AI-generated career score with breakdown by category (GitHub, portfolio, profile). Recalculated on profile/project changes.';
