-- ============================================================
-- MIGRATION 021: Application Invites (Integration Surface)
-- ============================================================
-- Enables companies to create shareable links for candidates to
-- fill out DOT applications in StormChain. Company-agnostic design
-- supports any employer, not just specific partners.
--
-- Use case: Admin creates invite → gets link → sends to candidate
-- → candidate completes application → admin downloads PDF for ATS
-- ============================================================

-- 1. APPLICATION INVITES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS application_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who created the invite
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- The shareable token (URL-safe, unique)
  token VARCHAR(64) UNIQUE NOT NULL,
  
  -- Optional: Pre-fill candidate info for tracking
  candidate_email VARCHAR(255),
  candidate_name VARCHAR(255),
  
  -- Optional: Tie to a specific job posting
  job_posting_id UUID REFERENCES job_postings(id) ON DELETE SET NULL,
  
  -- Custom message to show candidate
  welcome_message TEXT,
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending' NOT NULL 
    CHECK (status IN ('pending', 'viewed', 'in_progress', 'completed', 'expired', 'cancelled')),
  
  -- When invite was used
  used_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  
  -- The resulting application (if completed)
  driver_application_id UUID REFERENCES driver_applications(id) ON DELETE SET NULL,
  
  -- View tracking
  view_count INT DEFAULT 0,
  last_viewed_at TIMESTAMP WITH TIME ZONE,
  
  -- Lifecycle
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_application_invites_company 
  ON application_invites(company_id);
CREATE INDEX IF NOT EXISTS idx_application_invites_token 
  ON application_invites(token);
CREATE INDEX IF NOT EXISTS idx_application_invites_status 
  ON application_invites(status) WHERE status IN ('pending', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_application_invites_created_by 
  ON application_invites(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_application_invites_candidate_email 
  ON application_invites(candidate_email) WHERE candidate_email IS NOT NULL;

-- Comments
COMMENT ON TABLE application_invites IS 'Shareable links for candidates to fill DOT applications - part of integration surface';
COMMENT ON COLUMN application_invites.token IS 'URL-safe token for /apply/[token] route';
COMMENT ON COLUMN application_invites.status IS 'pending=not used, viewed=opened, in_progress=started app, completed=finished, expired/cancelled=inactive';
COMMENT ON COLUMN application_invites.welcome_message IS 'Optional custom message shown to candidate on landing page';

-- 2. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE application_invites ENABLE ROW LEVEL SECURITY;

-- Employers can see their company's invites
CREATE POLICY application_invites_employer_select ON application_invites
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Employers can create invites for their company
CREATE POLICY application_invites_employer_insert ON application_invites
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('owner', 'admin', 'hr_manager', 'hiring_manager', 'recruiter')
    )
  );

-- Employers can update their company's invites (cancel, etc.)
CREATE POLICY application_invites_employer_update ON application_invites
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM company_members 
      WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('owner', 'admin', 'hr_manager', 'hiring_manager', 'recruiter')
    )
  );

-- Public can read invites by token (for the /apply/[token] page)
-- This is handled via service role in API, not direct RLS

-- 3. UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_application_invites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_application_invites_updated_at ON application_invites;
CREATE TRIGGER update_application_invites_updated_at
  BEFORE UPDATE ON application_invites
  FOR EACH ROW
  EXECUTE FUNCTION update_application_invites_updated_at();

-- 4. HELPER FUNCTION: Generate URL-safe token
-- ============================================================

CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS VARCHAR(64) AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result VARCHAR(64) := '';
  i INT;
BEGIN
  FOR i IN 1..32 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_invite_token IS 'Generates a 32-char URL-safe token for application invites';

-- ============================================================
-- SUMMARY
-- ============================================================
-- This migration creates the foundation for the integration surface:
--
-- ✅ application_invites table - stores shareable invite links
-- ✅ RLS policies - company-scoped access control
-- ✅ Token generation - URL-safe random tokens
--
-- Next steps (in code):
-- - POST /api/employer/invites - create invite
-- - GET /api/employer/invites - list company invites
-- - GET /api/invite/[token] - public route to validate invite
-- - /apply/[token] page - candidate landing page
-- ============================================================
