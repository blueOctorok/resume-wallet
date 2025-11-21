-- Migration: Add role-based user system and companies table
-- Date: 2024-11-20
-- Purpose: Enable driver/employer bifurcation for two-sided marketplace

-- Step 1: Add role column to users table
ALTER TABLE users 
ADD COLUMN role VARCHAR(20) CHECK (role IN ('driver', 'employer'));

-- Note: Existing users will have NULL role and will be prompted to select on next login

-- Step 2: Create companies table for employer profiles
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  dot_number TEXT, -- DOT number for motor carriers
  mc_number TEXT, -- MC number for motor carriers
  phone TEXT,
  email TEXT,
  website TEXT,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  company_size VARCHAR(50), -- e.g., '1-10', '11-50', '51-200', '201-500', '500+'
  industry_type TEXT[], -- Array of industries: e.g., ['long-haul', 'local', 'refrigerated']
  description TEXT,
  logo_url TEXT,
  verified BOOLEAN DEFAULT false, -- Admin verification for legitimacy
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one company per employer user
  UNIQUE(employer_user_id)
);

-- Step 3: Create job_postings table (foundation for future job board)
CREATE TABLE IF NOT EXISTS job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  location_city TEXT,
  location_state TEXT,
  job_type VARCHAR(50), -- e.g., 'full-time', 'part-time', 'contract'
  route_type VARCHAR(50), -- e.g., 'long-haul', 'regional', 'local'
  experience_required VARCHAR(50), -- e.g., '0-1', '1-3', '3-5', '5+'
  cdl_class TEXT[], -- Array: ['A', 'B', 'C']
  endorsements_required TEXT[], -- Array: ['Hazmat', 'Tanker', 'Doubles/Triples']
  pay_range_min INTEGER,
  pay_range_max INTEGER,
  pay_type VARCHAR(20), -- e.g., 'hourly', 'salary', 'per-mile'
  benefits TEXT[],
  home_time TEXT, -- e.g., 'Daily', 'Weekly', 'Bi-weekly'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Step 4: Create applications table to track driver applications to jobs
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  driver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_application_id UUID REFERENCES driver_applications(id), -- Link to DOT application
  resume_id UUID REFERENCES resumes(id), -- Link to resume
  status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'interview', 'offer', 'hired', 'rejected', 'withdrawn')),
  cover_letter TEXT,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewer_notes TEXT,
  
  -- Prevent duplicate applications
  UNIQUE(job_posting_id, driver_user_id)
);

-- Step 5: Create indexes for performance
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_companies_employer ON companies(employer_user_id);
CREATE INDEX idx_companies_verified ON companies(verified);
CREATE INDEX idx_job_postings_company ON job_postings(company_id);
CREATE INDEX idx_job_postings_active ON job_postings(is_active) WHERE is_active = true;
CREATE INDEX idx_applications_job ON applications(job_posting_id);
CREATE INDEX idx_applications_driver ON applications(driver_user_id);
CREATE INDEX idx_applications_status ON applications(status);

-- Step 6: Add RLS policies for companies table
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Employers can read their own company
CREATE POLICY "Employers can view their own company"
  ON companies FOR SELECT
  USING (employer_user_id = auth.uid());

-- Employers can insert their own company
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

-- Step 7: Add RLS policies for job_postings table
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;

-- Employers can manage their own job postings
CREATE POLICY "Employers can view their own job postings"
  ON job_postings FOR SELECT
  USING (
    company_id IN (
      SELECT id FROM companies WHERE employer_user_id = auth.uid()
    )
  );

CREATE POLICY "Employers can create job postings"
  ON job_postings FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE employer_user_id = auth.uid()
    )
  );

CREATE POLICY "Employers can update their own job postings"
  ON job_postings FOR UPDATE
  USING (
    company_id IN (
      SELECT id FROM companies WHERE employer_user_id = auth.uid()
    )
  );

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

-- Step 8: Add RLS policies for applications table
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

-- Step 9: Add updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_postings_updated_at
  BEFORE UPDATE ON job_postings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Migration complete!

