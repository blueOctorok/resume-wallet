-- ============================================================
-- MIGRATION 020: Talent Search & Career Cards
-- ============================================================
-- Date: February 2026
-- Purpose: Enable employer talent search and career card features
--
-- What This Adds:
--   1. Track who ordered MVRs (employer vs self)
--   2. Candidate request system (employers request docs/actions)
--   3. Application initiation tracking (applicant vs employer)
--   4. Career card materialized view for fast talent search
-- ============================================================

-- ============================================================
-- 1. MVR ORDERS - Track Employer-Ordered MVRs
-- ============================================================
-- When employer orders MVR for a candidate, results go to driver's
-- profile and are shared (huge value prop for drivers)

ALTER TABLE mvr_orders 
  ADD COLUMN IF NOT EXISTS ordered_by_company_id UUID REFERENCES companies(id),
  ADD COLUMN IF NOT EXISTS ordered_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT true;

-- Index for finding employer-ordered MVRs
CREATE INDEX IF NOT EXISTS idx_mvr_orders_ordered_by_company 
  ON mvr_orders(ordered_by_company_id) 
  WHERE ordered_by_company_id IS NOT NULL;

COMMENT ON COLUMN mvr_orders.ordered_by_company_id IS 'Company that ordered this MVR (null if driver self-ordered)';
COMMENT ON COLUMN mvr_orders.ordered_by_user_id IS 'User who placed the order (employer team member)';
COMMENT ON COLUMN mvr_orders.is_shared IS 'If true, MVR is visible on driver career card for all employers';

-- ============================================================
-- 2. CANDIDATE REQUESTS TABLE
-- ============================================================
-- Employers can request candidates to complete actions or upload docs

CREATE TABLE IF NOT EXISTS candidate_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who is making the request
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requested_by_user_id UUID REFERENCES users(id),
  
  -- Who is the request for
  candidate_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Request details
  request_type VARCHAR(50) NOT NULL CHECK (request_type IN (
    'mvr_order',           -- Employer will order MVR
    'document_upload',     -- Request candidate upload a document
    'verification',        -- Request employment verification
    'profile_completion',  -- Request candidate complete profile section
    'custom'               -- Custom request with message
  )),
  
  -- For document_upload type
  document_type VARCHAR(100),  -- 'cdl', 'medical_card', 'resume', etc.
  
  -- Message to candidate
  message TEXT,
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',    -- Request sent, awaiting action
    'viewed',     -- Candidate has seen the request
    'completed',  -- Candidate completed the action
    'declined',   -- Candidate declined
    'expired',    -- Request expired (optional TTL)
    'cancelled'   -- Employer cancelled
  )),
  
  -- Completion tracking
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_reference_id UUID,  -- ID of created document/MVR/etc
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE  -- Optional expiration
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_candidate_requests_company ON candidate_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_candidate_requests_candidate ON candidate_requests(candidate_user_id);
CREATE INDEX IF NOT EXISTS idx_candidate_requests_status ON candidate_requests(status) WHERE status = 'pending';

-- RLS
ALTER TABLE candidate_requests ENABLE ROW LEVEL SECURITY;

-- Employers can see their company's requests
CREATE POLICY candidate_requests_employer_select ON candidate_requests
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Candidates can see requests sent to them
CREATE POLICY candidate_requests_candidate_select ON candidate_requests
  FOR SELECT USING (candidate_user_id = auth.uid());

-- Employers can create requests
CREATE POLICY candidate_requests_employer_insert ON candidate_requests
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('owner', 'admin', 'hr_manager', 'hiring_manager', 'recruiter')
    )
  );

-- Candidates can update status (viewed, completed, declined)
CREATE POLICY candidate_requests_candidate_update ON candidate_requests
  FOR UPDATE USING (candidate_user_id = auth.uid())
  WITH CHECK (candidate_user_id = auth.uid());

COMMENT ON TABLE candidate_requests IS 'Employer requests to candidates for documents, verifications, or actions';

-- ============================================================
-- 3. APPLICATIONS - Track Who Initiated
-- ============================================================
-- Applications can be created by applicants (applying to job) or
-- employers (recruiting from talent search)

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS initiated_by VARCHAR(20) DEFAULT 'applicant' 
    CHECK (initiated_by IN ('applicant', 'employer')),
  ADD COLUMN IF NOT EXISTS recruited_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS career_card_snapshot JSONB;

COMMENT ON COLUMN applications.initiated_by IS 'Who created this application: applicant (applied to job) or employer (recruited)';
COMMENT ON COLUMN applications.recruited_by_user_id IS 'If employer-initiated, which team member recruited them';
COMMENT ON COLUMN applications.career_card_snapshot IS 'Snapshot of career card data at time of application';

-- ============================================================
-- 4. CAREER CARD VIEW
-- ============================================================
-- Aggregated view of candidate data for talent search
-- This is a regular view (not materialized) for real-time data

CREATE OR REPLACE VIEW career_cards AS
SELECT 
  u.id AS user_id,
  u.wallet_address,
  u.email,
  u.role,
  u.created_at AS member_since,
  
  -- Driver profile data
  dp.id AS driver_profile_id,
  -- Construct full_name from components (may be NULL if not populated)
  TRIM(CONCAT_WS(' ', dp.first_name, dp.middle_name, dp.last_name)) AS full_name,
  dp.phone,
  dp.city,
  dp.state,
  dp.zip_code,
  dp.experience_years AS years_experience,
  dp.cdl_class,
  dp.cdl_state,
  dp.cdl_expiration,
  COALESCE(dp.endorsements, dp.cdl_endorsements) AS endorsements,
  dp.willing_to_relocate,
  dp.preferred_job_types,
  dp.preferred_states,
  
  -- Resume info
  r.id AS resume_id,
  r.filename AS resume_file_name,
  r.structured_data AS resume_structured_data,
  r.created_at AS resume_uploaded_at,
  
  -- Driver application status (DOT form)
  da.id AS driver_application_id,
  da.verification_status AS driver_application_status,
  da.created_at AS driver_application_date,
  
  -- MVR status (most recent)
  mvr.id AS latest_mvr_id,
  mvr.status AS latest_mvr_status,
  mvr.created_at AS latest_mvr_date,
  mvr.ordered_by_company_id AS mvr_ordered_by,
  
  -- Aggregated counts
  (SELECT COUNT(*) FROM resumes WHERE user_id = u.id) AS resume_count,
  (SELECT COUNT(*) FROM driver_applications WHERE user_id = u.id) AS driver_app_count,
  (SELECT COUNT(*) FROM mvr_orders WHERE driver_user_id = u.id) AS mvr_count,
  -- Work history count from JSONB array in driver_profiles (safely handle NULL/empty)
  CASE 
    WHEN dp.employment_history IS NULL THEN 0
    WHEN jsonb_typeof(dp.employment_history) != 'array' THEN 0
    ELSE jsonb_array_length(dp.employment_history)
  END AS work_history_count,
  -- Verified jobs count from employment_verification_requests
  (SELECT COUNT(*) FROM employment_verification_requests evr 
   WHERE evr.driver_id = u.id AND evr.status = 'VERIFIED') AS verified_jobs_count,
  
  -- Completeness score (0-100)
  (
    CASE WHEN dp.id IS NOT NULL THEN 20 ELSE 0 END +
    CASE WHEN r.id IS NOT NULL THEN 20 ELSE 0 END +
    CASE WHEN da.id IS NOT NULL THEN 20 ELSE 0 END +
    CASE WHEN mvr.id IS NOT NULL THEN 20 ELSE 0 END +
    CASE 
      WHEN dp.employment_history IS NOT NULL 
        AND jsonb_typeof(dp.employment_history) = 'array' 
        AND jsonb_array_length(dp.employment_history) > 0 
      THEN 20 
      ELSE 0 
    END
  ) AS completeness_score,
  
  -- Flags for quick filtering
  dp.id IS NOT NULL AS has_profile,
  r.id IS NOT NULL AS has_resume,
  da.id IS NOT NULL AS has_driver_app,
  mvr.id IS NOT NULL AS has_mvr,
  (dp.employment_history IS NOT NULL 
    AND jsonb_typeof(dp.employment_history) = 'array' 
    AND jsonb_array_length(dp.employment_history) > 0) AS has_work_history

FROM users u
LEFT JOIN driver_profiles dp ON dp.user_id = u.id
LEFT JOIN LATERAL (
  SELECT * FROM resumes res WHERE res.user_id = u.id ORDER BY res.created_at DESC LIMIT 1
) r ON true
LEFT JOIN LATERAL (
  SELECT * FROM driver_applications dapp WHERE dapp.user_id = u.id ORDER BY dapp.created_at DESC LIMIT 1
) da ON true
LEFT JOIN LATERAL (
  SELECT * FROM mvr_orders mo WHERE mo.driver_user_id = u.id ORDER BY mo.created_at DESC LIMIT 1
) mvr ON true
WHERE u.role IN ('driver', 'developer');

-- Make the view respect RLS
ALTER VIEW career_cards SET (security_invoker = true);

COMMENT ON VIEW career_cards IS 'Aggregated career card data for talent search - combines profile, resume, DOT app, MVR, and work history';

-- ============================================================
-- 5. TALENT SEARCH FUNCTION
-- ============================================================
-- Efficient search with filters for employers

CREATE OR REPLACE FUNCTION search_talent(
  p_role VARCHAR DEFAULT NULL,
  p_cdl_class VARCHAR[] DEFAULT NULL,
  p_state VARCHAR DEFAULT NULL,
  p_min_experience INT DEFAULT NULL,
  p_has_mvr BOOLEAN DEFAULT NULL,
  p_has_driver_app BOOLEAN DEFAULT NULL,
  p_endorsements VARCHAR[] DEFAULT NULL,
  p_search_text TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT,
  city TEXT,
  state TEXT,
  years_experience INT,
  cdl_class VARCHAR,
  endorsements TEXT[],
  completeness_score INT,
  has_mvr BOOLEAN,
  has_driver_app BOOLEAN,
  has_resume BOOLEAN,
  verified_jobs_count BIGINT,
  member_since TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.user_id,
    cc.full_name,
    cc.email,
    cc.city,
    cc.state,
    cc.years_experience,
    cc.cdl_class,
    cc.endorsements,
    cc.completeness_score,
    cc.has_mvr,
    cc.has_driver_app,
    cc.has_resume,
    cc.verified_jobs_count,
    cc.member_since
  FROM career_cards cc
  WHERE 
    -- Role filter
    (p_role IS NULL OR cc.role = p_role)
    -- CDL class filter (any match)
    AND (p_cdl_class IS NULL OR cc.cdl_class = ANY(p_cdl_class))
    -- State filter
    AND (p_state IS NULL OR cc.state = p_state)
    -- Experience filter
    AND (p_min_experience IS NULL OR cc.years_experience >= p_min_experience)
    -- Has MVR filter
    AND (p_has_mvr IS NULL OR cc.has_mvr = p_has_mvr)
    -- Has driver app filter
    AND (p_has_driver_app IS NULL OR cc.has_driver_app = p_has_driver_app)
    -- Endorsements filter (all must match)
    AND (p_endorsements IS NULL OR cc.endorsements @> p_endorsements)
    -- Text search (name, city, email)
    AND (p_search_text IS NULL OR (
      cc.full_name ILIKE '%' || p_search_text || '%' OR
      cc.city ILIKE '%' || p_search_text || '%' OR
      cc.email ILIKE '%' || p_search_text || '%'
    ))
  ORDER BY cc.completeness_score DESC, cc.member_since DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION search_talent IS 'Search for candidates with filters - used by employer talent search';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- 
-- What was added:
--   ✅ mvr_orders.ordered_by_company_id for tracking employer orders
--   ✅ candidate_requests table for employer-to-candidate requests
--   ✅ applications.initiated_by for tracking who created application
--   ✅ career_cards view for aggregated candidate data
--   ✅ search_talent() function for efficient filtering
--
-- Employer Flow:
--   1. Use search_talent() to find candidates
--   2. View career_cards for detailed profile
--   3. Create candidate_requests for missing info
--   4. Order MVR (goes to driver's profile)
--   5. Create application with initiated_by = 'employer'
--
-- ============================================================
