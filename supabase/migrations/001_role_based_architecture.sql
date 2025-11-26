-- ============================================================
-- MIGRATION 001: Role-Based Architecture (Driver/Employer)
-- ============================================================
-- Date: November 20, 2024
-- Purpose: Enable two-sided marketplace with driver and employer roles
-- Dependencies: Requires existing users table
-- 
-- Tables Created:
--   1. users.role (column) - Driver vs Employer distinction
--   2. companies - Employer company profiles
--   3. job_postings - Employer job listings
--   4. applications - Driver applications to jobs
-- ============================================================

-- ============================================================
-- 1. ADD ROLE COLUMN TO USERS TABLE
-- ============================================================
-- Allows users to be either 'driver' or 'employer'
-- Existing users will have NULL and be prompted on next login

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) CHECK (role IN ('driver', 'employer'));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

COMMENT ON COLUMN users.role IS 'User type: driver or employer. NULL means not yet selected.';

-- ============================================================
-- 2. COMPANIES TABLE (Employer Profiles)
-- ============================================================
-- Stores company information for employers
-- One company per employer user

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Company Info
  company_name TEXT NOT NULL,
  dot_number TEXT,
  mc_number TEXT,
  description TEXT,
  
  -- Contact
  phone TEXT,
  email TEXT,
  website TEXT,
  
  -- Address
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  
  -- Details
  company_size VARCHAR(50), -- '1-10', '11-50', '51-200', '201-500', '500+'
  industry_type TEXT[], -- ['long-haul', 'local', 'refrigerated']
  
  -- Branding
  logo_url TEXT,
  
  -- Verification
  verified BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(employer_user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_companies_employer ON companies(employer_user_id);
CREATE INDEX IF NOT EXISTS idx_companies_verified ON companies(verified);

-- Comments
COMMENT ON TABLE companies IS 'Employer company profiles - one per employer user';
COMMENT ON COLUMN companies.verified IS 'Admin-verified for legitimacy';

-- ============================================================
-- 3. JOB POSTINGS TABLE
-- ============================================================
-- Jobs posted by employers (not external aggregated jobs)

CREATE TABLE IF NOT EXISTS job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Job Details
  title TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  
  -- Location
  location_city TEXT,
  location_state TEXT,
  
  -- Job Type
  job_type VARCHAR(50), -- 'full-time', 'part-time', 'contract'
  route_type VARCHAR(50), -- 'long-haul', 'regional', 'local'
  
  -- Requirements
  experience_required VARCHAR(50), -- '0-1', '1-3', '3-5', '5+'
  cdl_class TEXT[], -- ['A', 'B', 'C']
  endorsements_required TEXT[], -- ['Hazmat', 'Tanker', 'Doubles/Triples']
  
  -- Compensation
  pay_range_min INTEGER,
  pay_range_max INTEGER,
  pay_type VARCHAR(20), -- 'hourly', 'salary', 'per-mile'
  benefits TEXT[],
  
  -- Schedule
  home_time TEXT, -- 'Daily', 'Weekly', 'Bi-weekly'
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_postings_company ON job_postings(company_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_active ON job_postings(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_job_postings_location_state ON job_postings(location_state);
CREATE INDEX IF NOT EXISTS idx_job_postings_created_at ON job_postings(created_at DESC);

-- Comments
COMMENT ON TABLE job_postings IS 'Jobs posted directly by employers on Veree';
COMMENT ON COLUMN job_postings.is_active IS 'Whether job is currently accepting applications';

-- ============================================================
-- 4. APPLICATIONS TABLE
-- ============================================================
-- Tracks driver applications to job postings

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  driver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_application_id UUID REFERENCES driver_applications(id), -- Link to DOT form
  resume_id UUID REFERENCES resumes(id), -- Link to resume
  
  -- Application Content
  cover_letter TEXT,
  
  -- Status Tracking
  status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN (
    'submitted', 
    'under_review', 
    'interview', 
    'offer', 
    'hired', 
    'rejected', 
    'withdrawn'
  )),
  
  -- Timestamps
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  -- Employer Notes
  reviewer_notes TEXT,
  
  -- Constraints
  UNIQUE(job_posting_id, driver_user_id) -- Prevent duplicate applications
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_applications_driver ON applications(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_applied_at ON applications(applied_at DESC);

-- Comments
COMMENT ON TABLE applications IS 'Driver applications to employer job postings';
COMMENT ON COLUMN applications.status IS 'Application workflow status';

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS) - COMPANIES
-- ============================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Employers can view their own company
CREATE POLICY "Employers can view their own company"
  ON companies FOR SELECT
  USING (employer_user_id = auth.uid());

-- Employers can create their own company
CREATE POLICY "Employers can create their own company"
  ON companies FOR INSERT
  WITH CHECK (employer_user_id = auth.uid());

-- Employers can update their own company
CREATE POLICY "Employers can update their own company"
  ON companies FOR UPDATE
  USING (employer_user_id = auth.uid());

-- All authenticated users can view verified companies
CREATE POLICY "All users can view verified companies"
  ON companies FOR SELECT
  USING (verified = true);

-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS) - JOB POSTINGS
-- ============================================================

ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;

-- Employers can view their own job postings
CREATE POLICY "Employers can view their own job postings"
  ON job_postings FOR SELECT
  USING (
    company_id IN (
      SELECT id FROM companies WHERE employer_user_id = auth.uid()
    )
  );

-- Employers can create job postings
CREATE POLICY "Employers can create job postings"
  ON job_postings FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE employer_user_id = auth.uid()
    )
  );

-- Employers can update their own job postings
CREATE POLICY "Employers can update their own job postings"
  ON job_postings FOR UPDATE
  USING (
    company_id IN (
      SELECT id FROM companies WHERE employer_user_id = auth.uid()
    )
  );

-- Employers can delete their own job postings
CREATE POLICY "Employers can delete their own job postings"
  ON job_postings FOR DELETE
  USING (
    company_id IN (
      SELECT id FROM companies WHERE employer_user_id = auth.uid()
    )
  );

-- All authenticated users can view active job postings
CREATE POLICY "All users can view active job postings"
  ON job_postings FOR SELECT
  USING (is_active = true);

-- ============================================================
-- 7. ROW LEVEL SECURITY (RLS) - APPLICATIONS
-- ============================================================

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Drivers can view their own applications
CREATE POLICY "Drivers can view their own applications"
  ON applications FOR SELECT
  USING (driver_user_id = auth.uid());

-- Drivers can create their own applications
CREATE POLICY "Drivers can create their own applications"
  ON applications FOR INSERT
  WITH CHECK (driver_user_id = auth.uid());

-- Drivers can update their own applications (e.g., withdraw)
CREATE POLICY "Drivers can update their own applications"
  ON applications FOR UPDATE
  USING (driver_user_id = auth.uid());

-- Employers can view applications to their job postings
CREATE POLICY "Employers can view applications to their jobs"
  ON applications FOR SELECT
  USING (
    job_posting_id IN (
      SELECT jp.id FROM job_postings jp
      JOIN companies c ON jp.company_id = c.id
      WHERE c.employer_user_id = auth.uid()
    )
  );

-- Employers can update application status
CREATE POLICY "Employers can update applications to their jobs"
  ON applications FOR UPDATE
  USING (
    job_posting_id IN (
      SELECT jp.id FROM job_postings jp
      JOIN companies c ON jp.company_id = c.id
      WHERE c.employer_user_id = auth.uid()
    )
  );

-- ============================================================
-- 8. TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for companies
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for job_postings
DROP TRIGGER IF EXISTS update_job_postings_updated_at ON job_postings;
CREATE TRIGGER update_job_postings_updated_at
  BEFORE UPDATE ON job_postings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for applications
DROP TRIGGER IF EXISTS update_applications_updated_at ON applications;
CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- Next steps:
--   1. Run migration 002 for external job aggregation
--   2. Configure API routes for role selection
--   3. Build employer and driver dashboards
-- ============================================================

