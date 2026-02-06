-- ============================================================
-- MIGRATION 015: Applicant-Initiated Employment Verification
-- ============================================================
-- Date: February 2026
-- Purpose: Allow applicants (drivers & developers) to request 
--          employment verification themselves, not just employers
-- 
-- What This Changes:
--   1. Add initiated_by column to track who started the verification
--   2. Make requesting_company_id nullable (no company for self-initiated)
--   3. Add applicant_type to distinguish driver vs developer verifications
--   4. Add employment_history to developer_profiles (mirrors driver_profiles)
--   5. Update constraints and add new index
-- ============================================================

-- ============================================================
-- 1. ADD COLUMNS TO employment_verification_requests
-- ============================================================

-- Who initiated the verification: applicant did it themselves, or an employer requested it
ALTER TABLE employment_verification_requests
  ADD COLUMN IF NOT EXISTS initiated_by TEXT DEFAULT 'employer' 
  CHECK (initiated_by IN ('applicant', 'employer'));

-- What type of applicant: driver or developer (for routing/display)
ALTER TABLE employment_verification_requests
  ADD COLUMN IF NOT EXISTS applicant_type TEXT DEFAULT 'driver'
  CHECK (applicant_type IN ('driver', 'developer'));

-- Make requesting_company_id nullable (self-initiated has no company yet)
ALTER TABLE employment_verification_requests
  ALTER COLUMN requesting_company_id DROP NOT NULL;

-- Add constraint: if employer-initiated, must have company; if self-initiated, company is optional
-- (We drop and recreate to handle the case where constraint might already exist)
ALTER TABLE employment_verification_requests
  DROP CONSTRAINT IF EXISTS check_initiated_by_company;

ALTER TABLE employment_verification_requests
  ADD CONSTRAINT check_initiated_by_company CHECK (
    (initiated_by = 'employer' AND requesting_company_id IS NOT NULL) OR
    (initiated_by = 'applicant')
  );

-- Index for finding self-initiated verifications
CREATE INDEX IF NOT EXISTS idx_evr_initiated_by 
  ON employment_verification_requests(initiated_by);

-- Index for finding by applicant type
CREATE INDEX IF NOT EXISTS idx_evr_applicant_type 
  ON employment_verification_requests(applicant_type);

-- Update existing rows to have correct defaults
UPDATE employment_verification_requests 
SET initiated_by = 'employer', applicant_type = 'driver'
WHERE initiated_by IS NULL;

-- ============================================================
-- 2. ADD employment_history TO developer_profiles
-- ============================================================
-- Mirrors the structure in driver_profiles for consistency

ALTER TABLE developer_profiles
  ADD COLUMN IF NOT EXISTS employment_history JSONB DEFAULT '[]'::jsonb;

-- Comment explaining the structure
COMMENT ON COLUMN developer_profiles.employment_history IS 
  'Employment history array: [{ id, companyName, position, startDate, endDate, location, supervisorName, supervisorEmail, supervisorPhone, reasonForLeaving, description }]';

-- Index for searching employment history
CREATE INDEX IF NOT EXISTS idx_developer_profiles_employment_history 
  ON developer_profiles USING GIN (employment_history);

-- ============================================================
-- 3. UPDATE RLS POLICIES
-- ============================================================
-- Allow applicants to create verification requests for themselves

-- Drop existing insert policy if it exists
DROP POLICY IF EXISTS "Employers can insert verification requests" ON employment_verification_requests;

-- New policy: employers can insert, OR users can insert for their own employments
CREATE POLICY "Users can insert verification requests" ON employment_verification_requests
  FOR INSERT WITH CHECK (
    -- Employer initiating for a driver
    (initiated_by = 'employer' AND requesting_company_id IN (
      SELECT id FROM companies WHERE employer_user_id = auth.uid()
    ))
    OR
    -- Applicant self-initiating (driver_id must be their own user id)
    (initiated_by = 'applicant' AND driver_id = auth.uid())
  );

-- ============================================================
-- 4. COMMENTS
-- ============================================================

COMMENT ON COLUMN employment_verification_requests.initiated_by IS 
  'Who started the verification: applicant (self-service) or employer (company request)';

COMMENT ON COLUMN employment_verification_requests.applicant_type IS 
  'Type of applicant: driver or developer. Used for routing to correct profile.';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- 
-- What was added/changed:
--   ✅ initiated_by column (applicant | employer)
--   ✅ applicant_type column (driver | developer)
--   ✅ requesting_company_id now nullable
--   ✅ Constraint ensuring employer-initiated has company
--   ✅ employment_history added to developer_profiles
--   ✅ Updated RLS policy for self-initiated requests
--   ✅ New indexes for performance
--
-- Usage:
--   - Applicant-initiated: initiated_by='applicant', requesting_company_id=NULL
--   - Employer-initiated: initiated_by='employer', requesting_company_id=<company_uuid>
--
-- ============================================================
