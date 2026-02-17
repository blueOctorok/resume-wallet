-- ============================================================
-- MIGRATION 016: Generic Employer Architecture
-- ============================================================
-- Date: February 2026
-- Purpose: Make the platform role-agnostic and support multi-user employer accounts
-- 
-- What This Adds:
--   1. company_members table - Multi-user access per company
--   2. Generic job_postings - target_role + requirements JSONB
--   3. Rename driver_user_id → applicant_user_id in applications
--   4. employer_candidate_data - Annotations, documents, notes per candidate
--   5. Updated RLS policies for team access
--   6. Employer-ordered MVR support
-- ============================================================

-- ============================================================
-- 1. COMPANY MEMBERS TABLE (Multi-User Access)
-- ============================================================
-- Allows multiple users to access the same company data
-- Each user has a role that determines their permissions

CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Role determines permissions
  -- owner: Full control, can delete company, manage billing
  -- admin: Manage team, company settings, all jobs
  -- hr_manager: View all applicants, make hire decisions, compliance reports
  -- hiring_manager: Manage jobs they own, make hire decisions for their jobs
  -- recruiter: Post jobs, screen candidates, schedule interviews
  -- interviewer: View assigned candidates, add interview notes only
  -- viewer: Read-only access to dashboards and reports
  role VARCHAR(30) NOT NULL DEFAULT 'recruiter' CHECK (role IN (
    'owner',
    'admin', 
    'hr_manager',
    'hiring_manager',
    'recruiter',
    'interviewer',
    'viewer'
  )),
  
  -- For hiring_manager role - which jobs can they manage?
  -- NULL means all jobs (for admin, hr_manager, owner)
  -- Array of job_posting IDs for scoped access
  job_scope UUID[] DEFAULT NULL,
  
  -- For interviewer role - which candidates are they assigned?
  -- NULL means no restriction (for roles above interviewer)
  candidate_scope UUID[] DEFAULT NULL,
  
  -- Invitation tracking
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invite_email TEXT, -- Email invite was sent to
  invite_token UUID DEFAULT gen_random_uuid(), -- For accepting invitations
  invite_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(company_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_invite_token ON company_members(invite_token) WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_company_members_role ON company_members(role);

-- Comments
COMMENT ON TABLE company_members IS 'Multi-user access for companies. Multiple team members can access the same company data.';
COMMENT ON COLUMN company_members.role IS 'User role within the company: owner, admin, hr_manager, hiring_manager, recruiter, interviewer, viewer';
COMMENT ON COLUMN company_members.job_scope IS 'For hiring_manager: specific job_posting IDs they can manage. NULL = all jobs.';
COMMENT ON COLUMN company_members.candidate_scope IS 'For interviewer: specific candidate user IDs they can view. NULL = no restriction.';
COMMENT ON COLUMN company_members.invite_token IS 'Token for accepting invitations (valid for 7 days)';

-- ============================================================
-- 2. MIGRATE EXISTING COMPANY OWNERS TO COMPANY_MEMBERS
-- ============================================================
-- Insert existing employer_user_id as 'owner' in company_members
-- This preserves backward compatibility

INSERT INTO company_members (company_id, user_id, role, accepted_at, invited_by)
SELECT 
  c.id as company_id,
  c.employer_user_id as user_id,
  'owner' as role,
  c.created_at as accepted_at, -- They're already "accepted" since they created it
  c.employer_user_id as invited_by -- They invited themselves
FROM companies c
WHERE c.employer_user_id IS NOT NULL
ON CONFLICT (company_id, user_id) DO NOTHING;

-- ============================================================
-- 3. MAKE JOB_POSTINGS GENERIC (Role-Agnostic)
-- ============================================================
-- Add target_role and generic role_requirements JSONB
-- Keep existing driver-specific columns for backward compatibility
-- NOTE: "requirements" already exists as TEXT in migration 001, so we use "role_requirements" for JSONB

ALTER TABLE job_postings
  ADD COLUMN IF NOT EXISTS target_role VARCHAR(50) DEFAULT 'driver',
  ADD COLUMN IF NOT EXISTS role_requirements JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS salary_min INTEGER,
  ADD COLUMN IF NOT EXISTS salary_max INTEGER,
  ADD COLUMN IF NOT EXISTS remote_allowed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS department TEXT;

-- Update existing job postings to have target_role = 'driver'
UPDATE job_postings 
SET target_role = 'driver' 
WHERE target_role IS NULL;

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_job_postings_target_role ON job_postings(target_role);
CREATE INDEX IF NOT EXISTS idx_job_postings_role_requirements ON job_postings USING GIN (role_requirements);

-- Comments
COMMENT ON COLUMN job_postings.target_role IS 'Type of candidate: driver, developer, warehouse, sales, etc.';
COMMENT ON COLUMN job_postings.role_requirements IS 'Role-specific requirements as JSONB. Driver: {cdl_class, endorsements}. Developer: {skills, experience_level}. Existing TEXT "requirements" column is for free-form description.';
COMMENT ON COLUMN job_postings.department IS 'Department this job belongs to (for hiring_manager scope)';

-- ============================================================
-- 4. RENAME driver_user_id TO applicant_user_id IN APPLICATIONS
-- ============================================================
-- This makes the column name role-agnostic

-- First, rename the column
ALTER TABLE applications 
  RENAME COLUMN driver_user_id TO applicant_user_id;

-- Update the foreign key constraint name
ALTER TABLE applications 
  RENAME CONSTRAINT applications_driver_user_id_fkey TO applications_applicant_user_id_fkey;

-- Update index name
ALTER INDEX IF EXISTS idx_applications_driver RENAME TO idx_applications_applicant;

-- ============================================================
-- 5. RECREATE VIEWS WITH NEW COLUMN NAME
-- ============================================================

-- Drop and recreate complete_applications view
DROP VIEW IF EXISTS complete_applications;

CREATE VIEW complete_applications AS
SELECT 
  a.*,
  u.name as applicant_name,
  u.email as applicant_email,
  u.wallet_address as applicant_wallet,
  u.role as applicant_role,
  dp.resume_url,
  dp.cdl_class,
  dp.cdl_endorsements,
  dp.experience_years,
  jp.title as job_title,
  jp.company_id,
  jp.target_role as job_target_role,
  jp.is_external as job_is_external,
  jp.external_source as job_external_source
FROM applications a
JOIN users u ON a.applicant_user_id = u.id
LEFT JOIN driver_profiles dp ON a.applicant_user_id = dp.user_id
LEFT JOIN job_postings jp ON a.job_posting_id = jp.id;

COMMENT ON VIEW complete_applications IS 'Complete application data with applicant profile and job details joined';

-- ============================================================
-- 6. EMPLOYER CANDIDATE DATA TABLE (Annotations, Documents, Notes)
-- ============================================================
-- Stores everything an employer adds to a candidate's profile
-- Separate from the candidate's own data

CREATE TABLE IF NOT EXISTS employer_candidate_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- What type of data is this?
  data_type VARCHAR(50) NOT NULL CHECK (data_type IN (
    'note',           -- Internal notes about candidate
    'rating',         -- 1-5 star rating
    'tag',            -- Custom tags (hot candidate, backup, etc.)
    'document',       -- Uploaded documents (MVR, PSP, background check)
    'interview',      -- Interview notes and scheduling
    'assessment',     -- Skills assessment results
    'offer',          -- Offer details
    'rejection_reason' -- Why candidate was rejected
  )),
  
  -- Content (flexible JSONB based on type)
  -- note: {"text": "Great interview, strong communication", "private": true}
  -- rating: {"value": 4, "category": "overall" | "technical" | "cultural_fit"}
  -- tag: {"name": "hot-candidate", "color": "red"}
  -- document: {"type": "mvr" | "psp" | "background", "file_url": "...", "status": "pending" | "completed", "summary": {...}}
  -- interview: {"scheduled_at": "...", "interviewer_id": "...", "notes": "...", "outcome": "pass" | "fail" | "pending"}
  -- assessment: {"type": "technical" | "driving_test", "score": 85, "max_score": 100, "notes": "..."}
  -- offer: {"salary": 75000, "start_date": "...", "status": "pending" | "accepted" | "declined"}
  -- rejection_reason: {"reason": "...", "stage": "screening" | "interview" | "offer"}
  content JSONB NOT NULL,
  
  -- Visibility to candidate (dynamic toggle per item)
  visible_to_candidate BOOLEAN DEFAULT false,
  
  -- Link to specific application (optional - some data may be company-wide for candidate)
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  
  -- Who created/modified this
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employer_candidate_data_company_candidate 
  ON employer_candidate_data(company_id, candidate_user_id);
CREATE INDEX IF NOT EXISTS idx_employer_candidate_data_type 
  ON employer_candidate_data(data_type);
CREATE INDEX IF NOT EXISTS idx_employer_candidate_data_application 
  ON employer_candidate_data(application_id) WHERE application_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employer_candidate_data_visible 
  ON employer_candidate_data(visible_to_candidate) WHERE visible_to_candidate = true;

-- Comments
COMMENT ON TABLE employer_candidate_data IS 'Employer-specific data about candidates: notes, ratings, documents, interview results';
COMMENT ON COLUMN employer_candidate_data.data_type IS 'Type of data: note, rating, tag, document, interview, assessment, offer, rejection_reason';
COMMENT ON COLUMN employer_candidate_data.content IS 'JSONB content structure varies by data_type';
COMMENT ON COLUMN employer_candidate_data.visible_to_candidate IS 'If true, candidate can see this data in their profile';

-- ============================================================
-- 7. ADD EMPLOYER_USER_ID TO MVR_ORDERS
-- ============================================================
-- Employers can order MVRs for candidates (they pay for it)

ALTER TABLE mvr_orders
  ADD COLUMN IF NOT EXISTS employer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employer_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ordered_by_employer BOOLEAN DEFAULT false;

-- Index for employer-ordered MVRs
CREATE INDEX IF NOT EXISTS idx_mvr_orders_employer_user_id 
  ON mvr_orders(employer_user_id) WHERE employer_user_id IS NOT NULL;

COMMENT ON COLUMN mvr_orders.employer_user_id IS 'If MVR was ordered by employer, this is their user ID';
COMMENT ON COLUMN mvr_orders.employer_company_id IS 'Company that ordered/paid for the MVR';
COMMENT ON COLUMN mvr_orders.ordered_by_employer IS 'True if employer ordered this MVR (vs candidate self-ordered)';

-- ============================================================
-- 8. ROW LEVEL SECURITY (RLS) - COMPANY MEMBERS
-- ============================================================

ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- Users can see their own memberships
CREATE POLICY "Users can view their own company memberships"
  ON company_members FOR SELECT
  USING (user_id = auth.uid());

-- Admins and owners can see all memberships in their company
CREATE POLICY "Admins can view all company memberships"
  ON company_members FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Only owners and admins can insert new members
CREATE POLICY "Admins can invite company members"
  ON company_members FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Only owners and admins can update memberships
CREATE POLICY "Admins can update company memberships"
  ON company_members FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Only owners can delete memberships (or users can leave)
CREATE POLICY "Owners can delete company memberships"
  ON company_members FOR DELETE
  USING (
    user_id = auth.uid() OR -- Users can leave
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- ============================================================
-- 9. ROW LEVEL SECURITY (RLS) - EMPLOYER CANDIDATE DATA
-- ============================================================

ALTER TABLE employer_candidate_data ENABLE ROW LEVEL SECURITY;

-- Company members can view their company's candidate data
CREATE POLICY "Company members can view candidate data"
  ON employer_candidate_data FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Recruiters and above can insert candidate data
CREATE POLICY "Recruiters can insert candidate data"
  ON employer_candidate_data FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role IN ('owner', 'admin', 'hr_manager', 'hiring_manager', 'recruiter', 'interviewer')
    )
  );

-- Users can update data they created
CREATE POLICY "Users can update their own candidate data"
  ON employer_candidate_data FOR UPDATE
  USING (
    created_by = auth.uid() OR
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'hr_manager')
    )
  );

-- Admins can delete candidate data
CREATE POLICY "Admins can delete candidate data"
  ON employer_candidate_data FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'hr_manager')
    )
  );

-- Candidates can view data marked visible to them
CREATE POLICY "Candidates can view visible data about themselves"
  ON employer_candidate_data FOR SELECT
  USING (
    candidate_user_id = auth.uid() AND visible_to_candidate = true
  );

-- ============================================================
-- 10. UPDATE APPLICATIONS RLS FOR TEAM ACCESS
-- ============================================================

-- Drop old employer policy that used employer_user_id
DROP POLICY IF EXISTS "Employers can view applications to their jobs" ON applications;
DROP POLICY IF EXISTS "Employers can update applications to their jobs" ON applications;

-- New policy: Company members can view applications to their company's jobs
CREATE POLICY "Company members can view applications to their jobs"
  ON applications FOR SELECT
  USING (
    job_posting_id IN (
      SELECT jp.id FROM job_postings jp
      JOIN companies c ON jp.company_id = c.id
      JOIN company_members cm ON c.id = cm.company_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
    )
  );

-- Company members with appropriate roles can update applications
CREATE POLICY "Company members can update applications to their jobs"
  ON applications FOR UPDATE
  USING (
    job_posting_id IN (
      SELECT jp.id FROM job_postings jp
      JOIN companies c ON jp.company_id = c.id
      JOIN company_members cm ON c.id = cm.company_id
      WHERE cm.user_id = auth.uid() 
        AND cm.is_active = true
        AND cm.role IN ('owner', 'admin', 'hr_manager', 'hiring_manager', 'recruiter')
    )
  );

-- ============================================================
-- 11. UPDATE EMPLOYMENT VERIFICATION RLS FOR TEAM ACCESS
-- ============================================================

-- Drop old policy
DROP POLICY IF EXISTS "Employers can view verifications they requested" ON employment_verification_requests;
DROP POLICY IF EXISTS "Employers can insert verification requests" ON employment_verification_requests;
DROP POLICY IF EXISTS "Employers can update their verification requests" ON employment_verification_requests;

-- New policies using company_members
CREATE POLICY "Company members can view verifications they requested"
  ON employment_verification_requests FOR SELECT
  USING (
    requesting_company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Company members can insert verification requests"
  ON employment_verification_requests FOR INSERT
  WITH CHECK (
    requesting_company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid() 
        AND is_active = true
        AND role IN ('owner', 'admin', 'hr_manager', 'hiring_manager', 'recruiter')
    )
  );

CREATE POLICY "Company members can update their verification requests"
  ON employment_verification_requests FOR UPDATE
  USING (
    requesting_company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid() 
        AND is_active = true
        AND role IN ('owner', 'admin', 'hr_manager', 'hiring_manager', 'recruiter')
    )
  );

-- ============================================================
-- 12. TRIGGERS FOR UPDATED_AT
-- ============================================================

-- Trigger for company_members updated_at
CREATE OR REPLACE FUNCTION update_company_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_company_members_updated_at ON company_members;
CREATE TRIGGER trigger_company_members_updated_at
  BEFORE UPDATE ON company_members
  FOR EACH ROW EXECUTE FUNCTION update_company_members_updated_at();

-- Trigger for employer_candidate_data updated_at
CREATE OR REPLACE FUNCTION update_employer_candidate_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_employer_candidate_data_updated_at ON employer_candidate_data;
CREATE TRIGGER trigger_employer_candidate_data_updated_at
  BEFORE UPDATE ON employer_candidate_data
  FOR EACH ROW EXECUTE FUNCTION update_employer_candidate_data_updated_at();

-- ============================================================
-- 13. HELPER FUNCTION: Get User's Company Access
-- ============================================================
-- Returns all companies a user has access to with their role

CREATE OR REPLACE FUNCTION get_user_company_access(p_user_id UUID)
RETURNS TABLE (
  company_id UUID,
  company_name TEXT,
  user_role VARCHAR(30),
  is_owner BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as company_id,
    c.company_name,
    cm.role as user_role,
    (cm.role = 'owner') as is_owner
  FROM company_members cm
  JOIN companies c ON cm.company_id = c.id
  WHERE cm.user_id = p_user_id AND cm.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_company_access IS 'Returns all companies a user has access to with their role';

-- ============================================================
-- 14. HELPER FUNCTION: Check Permission
-- ============================================================
-- Check if user has specific permission in a company

CREATE OR REPLACE FUNCTION check_company_permission(
  p_user_id UUID,
  p_company_id UUID,
  p_required_roles VARCHAR(30)[]
)
RETURNS BOOLEAN AS $$
DECLARE
  v_role VARCHAR(30);
BEGIN
  SELECT role INTO v_role
  FROM company_members
  WHERE user_id = p_user_id 
    AND company_id = p_company_id 
    AND is_active = true;
  
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN v_role = ANY(p_required_roles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_company_permission IS 'Check if user has required role in a company. Usage: check_company_permission(user_id, company_id, ARRAY[''owner'', ''admin''])';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- 
-- What was added:
--   ✅ company_members table for multi-user company access
--   ✅ Migrated existing company owners to company_members
--   ✅ Generic job_postings with target_role and requirements JSONB
--   ✅ Renamed driver_user_id → applicant_user_id in applications
--   ✅ employer_candidate_data table for annotations/documents
--   ✅ MVR orders can now be employer-ordered
--   ✅ Updated RLS policies for team-based access
--   ✅ Helper functions for permission checking
--
-- Employer Roles:
--   - owner: Full control, can delete company
--   - admin: Manage team, company settings
--   - hr_manager: All hiring access, compliance
--   - hiring_manager: Manage jobs in scope
--   - recruiter: Post jobs, screen candidates
--   - interviewer: View assigned candidates only
--   - viewer: Read-only access
--
-- Breaking Changes:
--   - applications.driver_user_id renamed to applicant_user_id
--   - API routes need updating to use new column name
--   - complete_applications view recreated
--
-- ============================================================
