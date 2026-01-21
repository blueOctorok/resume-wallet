-- Migration: Driver Share Profile (Veree Card)
-- Purpose: Enable drivers to share their verified credentials via QR code
-- This enables: Driver generates QR → Employer scans → Views verified profile
--
-- Tables Modified:
--   driver_profiles: Add share_token, share_settings
-- Tables Created:
--   driver_leads: Track employer connections from QR scans

-- ============================================================
-- 1. ADD SHARE FIELDS TO DRIVER_PROFILES
-- ============================================================

-- share_token: Unique URL-safe token for public profile access
-- Using gen_random_uuid() but could also use a shorter nanoid-style token
ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS share_settings JSONB DEFAULT '{
    "showResume": true,
    "showDotApp": true,
    "showMvr": true,
    "showContact": false,
    "allowConnect": true
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS share_token_created_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS share_views_count INTEGER DEFAULT 0;

-- Index for fast token lookups (this is the public access pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_profiles_share_token 
  ON driver_profiles(share_token) 
  WHERE share_token IS NOT NULL;

-- Comments
COMMENT ON COLUMN driver_profiles.share_token IS 'URL-safe token for public profile access (Veree Card)';
COMMENT ON COLUMN driver_profiles.share_settings IS 'Privacy controls: which sections are visible on public profile';
COMMENT ON COLUMN driver_profiles.share_token_created_at IS 'When the current share token was generated';
COMMENT ON COLUMN driver_profiles.share_views_count IS 'Total number of times public profile has been viewed';

-- ============================================================
-- 2. DRIVER_LEADS TABLE (Employer Connections)
-- ============================================================
-- When an employer scans a driver's QR and clicks "Connect", a lead is created
-- This is the "digital handshake" at job fairs

CREATE TABLE IF NOT EXISTS driver_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The driver whose profile was viewed
  driver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_profile_id UUID REFERENCES driver_profiles(id) ON DELETE SET NULL,
  
  -- The employer who connected (nullable if not logged in)
  employer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  
  -- Connection context
  source TEXT DEFAULT 'qr_scan', -- 'qr_scan', 'profile_view', 'job_fair', etc.
  event_name TEXT, -- Optional: "2024 Columbus Trucking Expo"
  notes TEXT, -- Employer can add notes about the driver
  
  -- Contact info (for anonymous employers who aren't registered)
  employer_name TEXT,
  employer_email TEXT,
  employer_phone TEXT,
  employer_company_name TEXT,
  
  -- Status
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'interviewing', 'hired', 'archived')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  contacted_at TIMESTAMP WITH TIME ZONE,
  
  -- Prevent duplicate leads from same employer
  UNIQUE(driver_user_id, employer_user_id) -- One lead per employer-driver pair (if logged in)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_driver_leads_driver ON driver_leads(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_driver_leads_employer ON driver_leads(employer_user_id) WHERE employer_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_driver_leads_company ON driver_leads(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_driver_leads_status ON driver_leads(status);
CREATE INDEX IF NOT EXISTS idx_driver_leads_created_at ON driver_leads(created_at DESC);

-- Comments
COMMENT ON TABLE driver_leads IS 'Employer connections from QR scans and profile views - the digital handshake';
COMMENT ON COLUMN driver_leads.source IS 'How the connection was made: qr_scan, profile_view, job_fair';
COMMENT ON COLUMN driver_leads.event_name IS 'Optional job fair or event name for context';

-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE driver_leads ENABLE ROW LEVEL SECURITY;

-- Drivers can view leads where they are the driver
CREATE POLICY "Drivers can view their own leads"
  ON driver_leads FOR SELECT
  USING (driver_user_id = auth.uid());

-- Employers can view leads they created
CREATE POLICY "Employers can view leads they created"
  ON driver_leads FOR SELECT
  USING (employer_user_id = auth.uid());

-- Anyone can create a lead (employer connects with driver)
CREATE POLICY "Anyone can create leads"
  ON driver_leads FOR INSERT
  WITH CHECK (true);

-- Employers can update their own leads
CREATE POLICY "Employers can update their own leads"
  ON driver_leads FOR UPDATE
  USING (employer_user_id = auth.uid());

-- Drivers can update leads (e.g., mark as contacted)
CREATE POLICY "Drivers can update their own leads"
  ON driver_leads FOR UPDATE
  USING (driver_user_id = auth.uid());

-- ============================================================
-- 4. HELPER FUNCTION: Generate Share Token
-- ============================================================
-- Generates a URL-safe random token (shorter than UUID for nicer URLs)

CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  -- Generate 12 character token (62^12 = 3.2 × 10^21 combinations)
  FOR i IN 1..12 LOOP
    result := result || substr(chars, floor(random() * 62 + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_share_token IS 'Generates a 12-character URL-safe random token for public profile sharing';

-- ============================================================
-- 5. TRIGGER: Auto-increment view count
-- ============================================================
-- This would be called via API, but having the function ready

CREATE OR REPLACE FUNCTION increment_share_views(p_share_token TEXT)
RETURNS void AS $$
BEGIN
  UPDATE driver_profiles 
  SET share_views_count = COALESCE(share_views_count, 0) + 1
  WHERE share_token = p_share_token;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_share_views IS 'Increments the view count for a shared profile';

-- ============================================================
-- 6. UPDATED_AT TRIGGER FOR DRIVER_LEADS
-- ============================================================

CREATE TRIGGER update_driver_leads_updated_at
  BEFORE UPDATE ON driver_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- 
-- What was added:
--   ✅ share_token column on driver_profiles (unique, URL-safe)
--   ✅ share_settings JSONB for privacy controls
--   ✅ share_views_count for analytics
--   ✅ driver_leads table for employer connections
--   ✅ generate_share_token() helper function
--   ✅ RLS policies for secure access
--
-- Usage:
--   1. Driver generates token: UPDATE driver_profiles SET share_token = generate_share_token() WHERE user_id = ?
--   2. QR code encodes: https://veree.app/d/{share_token}
--   3. Employer scans → views public profile
--   4. Employer clicks "Connect" → creates driver_lead record
--   5. Driver sees new lead in their hub
--
-- ============================================================
