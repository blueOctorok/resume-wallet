-- ============================================================
-- MIGRATION 002: External Job Aggregation & Driver Profiles
-- ============================================================
-- Date: November 24, 2024
-- Purpose: Enable "Apply with Veree" system with external job support
-- Dependencies: Requires Migration 000 and 001 to be completed
-- 
-- What This Adds:
--   1. External job support in job_postings table (Adzuna, Indeed, etc.)
--   2. driver_profiles table for quick application data
--   3. application_views table for engagement analytics
--   4. Helper views for easy data access
--   5. Shareable application tokens
-- ============================================================

-- ============================================================
-- 1. EXTEND JOB_POSTINGS TABLE (Add External Job Support)
-- ============================================================
-- Allows job_postings to store both internal (employer-posted) 
-- and external (aggregated from Adzuna/Indeed) jobs

-- Add new columns for external jobs
ALTER TABLE job_postings 
  ADD COLUMN IF NOT EXISTS is_external BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_source VARCHAR(50), -- 'adzuna', 'indeed', 'ziprecruiter'
  ADD COLUMN IF NOT EXISTS external_job_id TEXT, -- Job ID from external source
  ADD COLUMN IF NOT EXISTS redirect_url TEXT, -- Original job posting URL
  ADD COLUMN IF NOT EXISTS external_data JSONB; -- Full raw data from external API

-- Make company_id optional (external jobs don't have companies)
ALTER TABLE job_postings 
  ALTER COLUMN company_id DROP NOT NULL;

-- Add constraint: external jobs must have external_source
ALTER TABLE job_postings
  ADD CONSTRAINT check_external_job_has_source 
  CHECK (
    (is_external = false AND company_id IS NOT NULL) OR
    (is_external = true AND external_source IS NOT NULL)
  );

-- Indexes for external job queries
CREATE INDEX IF NOT EXISTS idx_job_postings_is_external 
  ON job_postings(is_external);

CREATE INDEX IF NOT EXISTS idx_job_postings_external_source 
  ON job_postings(external_source) 
  WHERE external_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_postings_external_job_id 
  ON job_postings(external_job_id) 
  WHERE external_job_id IS NOT NULL;

-- Unique constraint to prevent duplicate external jobs
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_postings_external_unique
  ON job_postings(external_source, external_job_id)
  WHERE is_external = true;

-- Comments
COMMENT ON COLUMN job_postings.is_external IS 'Whether job is from external aggregator (Adzuna, Indeed) vs employer-posted';
COMMENT ON COLUMN job_postings.external_source IS 'Source: adzuna, indeed, ziprecruiter, etc.';
COMMENT ON COLUMN job_postings.external_job_id IS 'Job ID from external source API';
COMMENT ON COLUMN job_postings.redirect_url IS 'Original job posting URL (for external jobs)';
COMMENT ON COLUMN job_postings.external_data IS 'Full raw JSON data from external API';

-- ============================================================
-- 2. DRIVER PROFILES TABLE (Quick Application Data)
-- ============================================================
-- Stores parsed/cached driver data for quick one-click applications
-- Auto-populated from driver_applications + resumes

CREATE TABLE IF NOT EXISTS driver_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- Resume & Documents
  resume_url TEXT,
  resume_ipfs_hash TEXT,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  
  -- DOT Application Reference
  driver_application_id UUID REFERENCES driver_applications(id) ON DELETE SET NULL,
  
  -- Parsed Application Data (from driver_applications.application_data)
  dot_application_data JSONB, -- Cached parsed data for quick access
  
  -- CDL Information (cached from users + driver_applications)
  cdl_class VARCHAR(10), -- A, B, C
  cdl_endorsements TEXT[], -- ['H', 'N', 'T', 'X']
  cdl_state VARCHAR(2),
  cdl_number TEXT,
  
  -- Experience
  experience_years INTEGER,
  total_miles_driven INTEGER,
  
  -- Job Preferences
  preferred_job_types TEXT[], -- ['OTR', 'Regional', 'Local', 'Dedicated']
  willing_to_relocate BOOLEAN DEFAULT false,
  desired_salary_min INTEGER,
  desired_salary_max INTEGER,
  preferred_states TEXT[], -- States willing to work in
  
  -- Availability
  available_start_date DATE,
  
  -- Profile Completeness (0-100 score)
  profile_completion_score INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_driver_profiles_user_id 
  ON driver_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_driver_profiles_cdl_class 
  ON driver_profiles(cdl_class);

CREATE INDEX IF NOT EXISTS idx_driver_profiles_completion_score 
  ON driver_profiles(profile_completion_score);

-- Comments
COMMENT ON TABLE driver_profiles IS 'Cached driver profile data for quick job applications';
COMMENT ON COLUMN driver_profiles.dot_application_data IS 'Cached parsed data from driver_applications for quick access';
COMMENT ON COLUMN driver_profiles.profile_completion_score IS '0-100 score based on filled fields (resume, DOT app, CDL, experience)';

-- ============================================================
-- 3. EXTEND APPLICATIONS TABLE (Add Shareable Links)
-- ============================================================
-- Add columns to support public shareable application links

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS application_data JSONB, -- Snapshot of data at submission time
  ADD COLUMN IF NOT EXISTS job_salary_min INTEGER,
  ADD COLUMN IF NOT EXISTS job_salary_max INTEGER,
  ADD COLUMN IF NOT EXISTS job_location TEXT;

-- Index for share token lookups
CREATE INDEX IF NOT EXISTS idx_applications_share_token 
  ON applications(share_token) 
  WHERE share_token IS NOT NULL;

-- Comments
COMMENT ON COLUMN applications.share_token IS 'Unique token for public shareable application links: /application/[token]';
COMMENT ON COLUMN applications.view_count IS 'Number of times application has been viewed';
COMMENT ON COLUMN applications.application_data IS 'Snapshot of driver data at time of application (immutable)';

-- ============================================================
-- 4. APPLICATION VIEWS TABLE (Engagement Analytics)
-- ============================================================
-- Track when employers view applications for analytics

CREATE TABLE IF NOT EXISTS application_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  
  -- Viewer Information
  viewer_ip TEXT,
  viewer_user_agent TEXT,
  viewer_location TEXT,
  
  -- View Details
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  time_spent_seconds INTEGER,
  
  -- What They Viewed
  sections_viewed TEXT[] -- ['resume', 'dot_application', 'work_history', 'documents']
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_application_views_application_id 
  ON application_views(application_id);

CREATE INDEX IF NOT EXISTS idx_application_views_viewed_at 
  ON application_views(viewed_at DESC);

-- Comments
COMMENT ON TABLE application_views IS 'Tracks employer engagement with applications';
COMMENT ON COLUMN application_views.time_spent_seconds IS 'How long employer viewed the application';
COMMENT ON COLUMN application_views.sections_viewed IS 'Which sections of the application were viewed';

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS) - DRIVER PROFILES
-- ============================================================

ALTER TABLE driver_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view their own driver profile" ON driver_profiles;
CREATE POLICY "Users can view their own driver profile"
  ON driver_profiles FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert their own driver profile" ON driver_profiles;
CREATE POLICY "Users can insert their own driver profile"
  ON driver_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update their own driver profile" ON driver_profiles;
CREATE POLICY "Users can update their own driver profile"
  ON driver_profiles FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS) - APPLICATION VIEWS
-- ============================================================

ALTER TABLE application_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert application views (for tracking)
DROP POLICY IF EXISTS "Anyone can insert application views" ON application_views;
CREATE POLICY "Anyone can insert application views"
  ON application_views FOR INSERT
  WITH CHECK (true);

-- Only application owners can view their analytics
DROP POLICY IF EXISTS "Users can view their application analytics" ON application_views;
CREATE POLICY "Users can view their application analytics"
  ON application_views FOR SELECT
  USING (
    application_id IN (
      SELECT id FROM applications WHERE driver_user_id = auth.uid()
    )
  );

-- ============================================================
-- 7. TRIGGERS - AUTO INCREMENT VIEW COUNT
-- ============================================================

-- Function to increment view count when application is viewed
CREATE OR REPLACE FUNCTION increment_application_views()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE applications
  SET 
    view_count = view_count + 1,
    last_viewed_at = NEW.viewed_at
  WHERE id = NEW.application_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-increment view count
DROP TRIGGER IF EXISTS increment_application_views_trigger ON application_views;
CREATE TRIGGER increment_application_views_trigger
  AFTER INSERT ON application_views
  FOR EACH ROW
  EXECUTE FUNCTION increment_application_views();

-- ============================================================
-- 8. TRIGGERS - AUTO UPDATE TIMESTAMPS
-- ============================================================

-- Trigger for driver_profiles updated_at
DROP TRIGGER IF EXISTS update_driver_profiles_updated_at ON driver_profiles;
CREATE TRIGGER update_driver_profiles_updated_at
  BEFORE UPDATE ON driver_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 9. HELPER VIEWS - COMPLETE APPLICATIONS
-- ============================================================
-- View that joins all application-related data for easy access

CREATE OR REPLACE VIEW complete_applications AS
SELECT 
  a.*,
  u.name as driver_name,
  u.email as driver_email,
  u.wallet_address as driver_wallet,
  dp.resume_url,
  dp.cdl_class,
  dp.cdl_endorsements,
  dp.experience_years,
  jp.title as job_title,
  jp.company_id,
  jp.is_external as job_is_external,
  jp.external_source as job_external_source
FROM applications a
JOIN users u ON a.driver_user_id = u.id
LEFT JOIN driver_profiles dp ON a.driver_user_id = dp.user_id
LEFT JOIN job_postings jp ON a.job_posting_id = jp.id;

COMMENT ON VIEW complete_applications IS 'Complete application data with driver profile and job details joined';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- This migration adds external job support and driver profiles.
-- 
-- What was added:
--   ✅ External job columns to job_postings table
--   ✅ driver_profiles table for quick applications
--   ✅ Shareable link support in applications table
--   ✅ application_views table for analytics
--   ✅ Auto-increment view counter trigger
--   ✅ complete_applications helper view
--   ✅ RLS policies for all new tables
--
-- Next steps:
--   1. Update API routes to use new schema
--   2. Test "Apply with Veree" flow
--   3. Verify shareable application links work
-- ============================================================

