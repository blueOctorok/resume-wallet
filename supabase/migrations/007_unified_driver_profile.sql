-- Migration: Unified Driver Profile Fields
-- Purpose: Add fields to driver_profiles for bidirectional data flow between Resume Builder and DOT Application
-- This enables: Resume → Profile → DOT and DOT → Profile → Resume
--
-- NOTE: The driver_profiles table already exists from migration 002. 
-- This migration ADDS new columns for the unified profile feature.

-- ===== ADD PERSONAL INFORMATION FIELDS =====
ALTER TABLE driver_profiles 
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS middle_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS ssn_last_four TEXT;

-- ===== ADD ADDRESS FIELDS =====
ALTER TABLE driver_profiles 
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip_code TEXT;

-- ===== ADD PROFESSIONAL SUMMARY =====
ALTER TABLE driver_profiles 
  ADD COLUMN IF NOT EXISTS professional_summary TEXT;

-- ===== ADD CDL FIELDS (some may exist, using IF NOT EXISTS) =====
ALTER TABLE driver_profiles 
  ADD COLUMN IF NOT EXISTS cdl_number TEXT,
  ADD COLUMN IF NOT EXISTS cdl_expiration DATE,
  ADD COLUMN IF NOT EXISTS endorsements TEXT[],
  ADD COLUMN IF NOT EXISTS restrictions TEXT[];

-- ===== ADD EMERGENCY CONTACT =====
ALTER TABLE driver_profiles 
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

-- ===== ADD JSONB FIELDS FOR COMPLEX DATA =====
-- These store superset of fields from both Resume Builder and DOT Application

-- Employment History (superset of Resume + DOT fields)
-- Structure: [{
--   id, companyName, position, location, startDate, endDate, isCurrent,
--   responsibilities[], equipment[], milesDriven, safetyRecord,
--   reasonForLeaving, supervisorName, supervisorPhone, subjectToFMCSR, subjectToDrugTest
-- }]
ALTER TABLE driver_profiles 
  ADD COLUMN IF NOT EXISTS employment_history JSONB DEFAULT '[]'::jsonb;

-- References (superset of Resume + DOT fields)
-- Structure: [{
--   id, name, title, company, phone, email, relationship, yearsKnown
-- }]
ALTER TABLE driver_profiles 
  ADD COLUMN IF NOT EXISTS "references" JSONB DEFAULT '[]'::jsonb;

-- Education (Resume feature)
-- Structure: [{ id, school, degree, field, year, certifications[] }]
ALTER TABLE driver_profiles 
  ADD COLUMN IF NOT EXISTS education JSONB DEFAULT '[]'::jsonb;

-- Skills (Resume feature)
-- Structure: [{ id, name, category }]
ALTER TABLE driver_profiles 
  ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;

-- Driving Experience (DOT feature, useful for resume too)
-- Structure: { equipmentTypes: {...}, specialSkills: {...} }
ALTER TABLE driver_profiles 
  ADD COLUMN IF NOT EXISTS driving_experience JSONB DEFAULT '{}'::jsonb;

-- ===== ADD MVR DATA FIELDS =====
-- These are populated when user purchases an MVR
ALTER TABLE driver_profiles 
  ADD COLUMN IF NOT EXISTS mvr_violations JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mvr_accidents JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mvr_last_updated TIMESTAMP WITH TIME ZONE;

-- ===== ADD METADATA =====
ALTER TABLE driver_profiles 
  ADD COLUMN IF NOT EXISTS last_updated_from TEXT;

-- ===== ADD COMMENTS FOR DOCUMENTATION =====
COMMENT ON COLUMN driver_profiles.first_name IS 'Driver first name (shared between Resume Builder and DOT App)';
COMMENT ON COLUMN driver_profiles.middle_name IS 'Driver middle name (primarily from DOT App)';
COMMENT ON COLUMN driver_profiles.employment_history IS 'Superset of employment fields from Resume Builder + DOT Application';
COMMENT ON COLUMN driver_profiles."references" IS 'Superset of reference fields from Resume Builder + DOT Application';
COMMENT ON COLUMN driver_profiles.driving_experience IS 'Equipment types and special skills from DOT Application';
COMMENT ON COLUMN driver_profiles.last_updated_from IS 'Tracks which feature last updated: resume_builder, dot_application, mvr, uploaded_resume';

-- ===== CREATE INDEX FOR NEW COLUMNS =====
CREATE INDEX IF NOT EXISTS idx_driver_profiles_last_updated_from ON driver_profiles(last_updated_from);

-- ===== HELPER FUNCTION: Sync profile from existing resume structured_data =====
-- This can be called manually to populate profiles from existing built resumes
CREATE OR REPLACE FUNCTION sync_profile_from_resume(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_resume RECORD;
BEGIN
  -- Get the most recent built resume for this user
  SELECT structured_data 
  INTO v_resume
  FROM resumes 
  WHERE user_id = p_user_id 
    AND resume_type = 'built' 
    AND structured_data IS NOT NULL
  ORDER BY updated_at DESC
  LIMIT 1;
  
  IF v_resume IS NULL THEN
    RAISE NOTICE 'No built resume found for user %', p_user_id;
    RETURN;
  END IF;
  
  -- Update the driver profile with resume data
  UPDATE driver_profiles SET
    first_name = COALESCE(v_resume.structured_data->'personalInfo'->>'firstName', first_name),
    last_name = COALESCE(v_resume.structured_data->'personalInfo'->>'lastName', last_name),
    email = COALESCE(v_resume.structured_data->'personalInfo'->>'email', email),
    phone = COALESCE(v_resume.structured_data->'personalInfo'->>'phone', phone),
    address = COALESCE(v_resume.structured_data->'personalInfo'->>'address', address),
    city = COALESCE(v_resume.structured_data->'personalInfo'->>'city', city),
    state = COALESCE(v_resume.structured_data->'personalInfo'->>'state', state),
    zip_code = COALESCE(v_resume.structured_data->'personalInfo'->>'zipCode', zip_code),
    professional_summary = COALESCE(v_resume.structured_data->'personalInfo'->>'professionalSummary', professional_summary),
    cdl_number = COALESCE(v_resume.structured_data->'cdlInfo'->>'cdlNumber', cdl_number),
    cdl_state = COALESCE(v_resume.structured_data->'cdlInfo'->>'cdlState', cdl_state),
    cdl_class = COALESCE(v_resume.structured_data->'cdlInfo'->>'cdlClass', cdl_class),
    employment_history = COALESCE(v_resume.structured_data->'employments', employment_history),
    "references" = COALESCE(v_resume.structured_data->'references', "references"),
    education = COALESCE(v_resume.structured_data->'educations', education),
    skills = COALESCE(v_resume.structured_data->'skills', skills),
    last_updated_from = 'resume_sync',
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RAISE NOTICE 'Profile synced from resume for user %', p_user_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_profile_from_resume IS 'Syncs driver_profiles from existing resume structured_data. Call: SELECT sync_profile_from_resume(user_id);';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- 
-- What was added:
--   ✅ Personal information fields (first_name, middle_name, last_name, etc.)
--   ✅ Address fields
--   ✅ Emergency contact fields  
--   ✅ JSONB fields for complex nested data (employment_history, references, etc.)
--   ✅ MVR data fields for violations/accidents
--   ✅ last_updated_from tracking field
--   ✅ sync_profile_from_resume() helper function
--
-- Usage:
--   - Resume Builder and DOT Application now read/write to driver_profiles
--   - Data flows bidirectionally between forms
--   - MVR data populates automatically when purchased
--
-- ============================================================
