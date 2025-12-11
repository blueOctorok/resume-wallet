-- ============================================================
-- Fix Missing Unique Constraints and Indexes
-- ============================================================

-- 1. Verify critical indexes exist (should already exist, but checking)
CREATE INDEX IF NOT EXISTS idx_resumes_file_hash ON resumes(file_hash);
CREATE INDEX IF NOT EXISTS idx_driver_applications_application_hash ON driver_applications(application_hash);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);

-- 2. Verify unique index on driver_applications exists (you confirmed it does)
-- This prevents duplicate application submissions per user
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_applications_user_hash 
--   ON driver_applications(user_id, application_hash) 
--   WHERE application_hash IS NOT NULL;

-- 3. Check if unique constraint for external jobs exists
-- This prevents duplicate external job imports
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_postings_external_unique
  ON job_postings(external_source, external_job_id)
  WHERE is_external = true;

-- Verify what we created
SELECT 
  'Indexes Created' as type,
  indexname,
  tablename
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname IN (
  'idx_resumes_file_hash',
  'idx_driver_applications_application_hash',
  'idx_users_wallet_address',
  'idx_job_postings_external_unique'
)
ORDER BY tablename, indexname;

