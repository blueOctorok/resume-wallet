-- ============================================================
-- MIGRATION 011: Developer Profiles & Projects
-- ============================================================
-- Date: January 2026
-- Purpose: Add database support for Software Engineer role
-- Dependencies: Requires users table from migration 001
-- 
-- What This Adds:
--   1. developer_profiles table (GitHub, bio, skills, etc.)
--   2. developer_projects table (portfolio projects)
--   3. RLS policies for secure access
--   4. Indexes for performance
-- ============================================================

-- ============================================================
-- 1. DEVELOPER PROFILES TABLE
-- ============================================================
-- Core profile data for software engineers

CREATE TABLE IF NOT EXISTS developer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- Personal Info
  first_name TEXT,
  last_name TEXT,
  display_name TEXT, -- Optional display name / alias
  email TEXT,
  phone TEXT,
  location TEXT, -- City, State or "Remote"
  
  -- Professional Summary
  headline TEXT, -- e.g., "Full Stack Developer | React & Node.js"
  bio TEXT, -- Longer description
  years_experience INTEGER,
  
  -- GitHub Integration
  github_username TEXT,
  github_connected_at TIMESTAMP WITH TIME ZONE,
  github_data JSONB DEFAULT '{}'::jsonb, -- Cached GitHub API data (repos, stats, etc.)
  
  -- Links
  portfolio_url TEXT,
  linkedin_url TEXT,
  twitter_url TEXT,
  personal_website TEXT,
  
  -- Skills & Tech Stack
  skills JSONB DEFAULT '[]'::jsonb, -- [{ name: "React", category: "frontend", proficiency: "expert" }]
  
  -- Job Preferences
  job_types TEXT[], -- ['full-time', 'contract', 'freelance', 'part-time']
  work_styles TEXT[], -- ['remote', 'hybrid', 'onsite']
  willing_to_relocate BOOLEAN DEFAULT false,
  desired_salary_min INTEGER,
  desired_salary_max INTEGER,
  
  -- Availability
  available_for_work BOOLEAN DEFAULT true,
  available_from DATE,
  
  -- Education (simplified - can expand later)
  education JSONB DEFAULT '[]'::jsonb, -- [{ school, degree, field, year }]
  
  -- Certifications
  certifications JSONB DEFAULT '[]'::jsonb, -- [{ name, issuer, date, url }]
  
  -- Metadata
  profile_completeness INTEGER DEFAULT 0,
  last_updated_from TEXT, -- 'manual', 'github_sync', 'resume_upload'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_developer_profiles_user_id ON developer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_developer_profiles_github_username ON developer_profiles(github_username) WHERE github_username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_developer_profiles_available ON developer_profiles(available_for_work) WHERE available_for_work = true;
CREATE INDEX IF NOT EXISTS idx_developer_profiles_skills ON developer_profiles USING GIN (skills);

-- Comments
COMMENT ON TABLE developer_profiles IS 'Profile data for software engineers/developers';
COMMENT ON COLUMN developer_profiles.headline IS 'Short tagline like "Full Stack Developer | React & Node.js"';
COMMENT ON COLUMN developer_profiles.github_data IS 'Cached data from GitHub API: repos, languages, contribution stats';
COMMENT ON COLUMN developer_profiles.skills IS 'Array of skill objects with name, category, proficiency';

-- ============================================================
-- 2. DEVELOPER PROJECTS TABLE
-- ============================================================
-- Portfolio projects for developers

CREATE TABLE IF NOT EXISTS developer_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  developer_profile_id UUID REFERENCES developer_profiles(id) ON DELETE CASCADE,
  
  -- Project Info
  title TEXT NOT NULL,
  description TEXT, -- Short description (1-2 sentences)
  long_description TEXT, -- Detailed description (optional)
  
  -- Tech Stack
  tech_stack TEXT[], -- ['React', 'Node.js', 'PostgreSQL', 'AWS']
  
  -- Links
  live_url TEXT, -- Deployed project URL
  repo_url TEXT, -- GitHub/GitLab repo URL
  demo_video_url TEXT, -- YouTube/Loom demo link
  
  -- Media
  thumbnail_url TEXT, -- Main project image
  screenshots JSONB DEFAULT '[]'::jsonb, -- [{ url, caption }]
  
  -- Project Details
  role TEXT, -- 'solo', 'lead', 'contributor', 'team'
  team_size INTEGER,
  start_date DATE,
  end_date DATE, -- NULL if ongoing
  is_ongoing BOOLEAN DEFAULT false,
  
  -- Visibility
  is_featured BOOLEAN DEFAULT false, -- Show on Career Card
  is_public BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0, -- For sorting
  
  -- GitHub Integration (if repo_url is GitHub)
  github_repo_data JSONB, -- Cached repo data: stars, forks, languages
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_developer_projects_user_id ON developer_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_developer_projects_profile_id ON developer_projects(developer_profile_id);
CREATE INDEX IF NOT EXISTS idx_developer_projects_featured ON developer_projects(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_developer_projects_public ON developer_projects(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_developer_projects_tech_stack ON developer_projects USING GIN (tech_stack);

-- Comments
COMMENT ON TABLE developer_projects IS 'Portfolio projects for software engineers';
COMMENT ON COLUMN developer_projects.is_featured IS 'Featured projects appear on the Career Card';
COMMENT ON COLUMN developer_projects.tech_stack IS 'Array of technologies used in the project';
COMMENT ON COLUMN developer_projects.role IS 'Developer role: solo, lead, contributor, team';

-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS
ALTER TABLE developer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE developer_projects ENABLE ROW LEVEL SECURITY;

-- Developer Profiles: Users can only access their own profile
CREATE POLICY developer_profiles_select ON developer_profiles
  FOR SELECT USING (
    user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'employer')
  );

CREATE POLICY developer_profiles_insert ON developer_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY developer_profiles_update ON developer_profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY developer_profiles_delete ON developer_profiles
  FOR DELETE USING (user_id = auth.uid());

-- Developer Projects: Users can manage their own, employers can view public
CREATE POLICY developer_projects_select ON developer_projects
  FOR SELECT USING (
    user_id = auth.uid() OR 
    (is_public = true AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'employer'))
  );

CREATE POLICY developer_projects_insert ON developer_projects
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY developer_projects_update ON developer_projects
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY developer_projects_delete ON developer_projects
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- 4. TRIGGERS FOR UPDATED_AT
-- ============================================================

-- Auto-update updated_at on developer_profiles
CREATE OR REPLACE FUNCTION update_developer_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_developer_profiles_updated_at
  BEFORE UPDATE ON developer_profiles
  FOR EACH ROW EXECUTE FUNCTION update_developer_profiles_updated_at();

-- Auto-update updated_at on developer_projects
CREATE OR REPLACE FUNCTION update_developer_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_developer_projects_updated_at
  BEFORE UPDATE ON developer_projects
  FOR EACH ROW EXECUTE FUNCTION update_developer_projects_updated_at();

-- ============================================================
-- 5. AUTO-CREATE PROFILE ON USER ROLE CHANGE
-- ============================================================
-- When a user selects 'developer' role, create their profile

CREATE OR REPLACE FUNCTION create_developer_profile_on_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create profile if role changed to 'developer' and profile doesn't exist
  IF NEW.role = 'developer' AND (OLD.role IS NULL OR OLD.role != 'developer') THEN
    INSERT INTO developer_profiles (user_id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trigger_create_developer_profile ON users;

CREATE TRIGGER trigger_create_developer_profile
  AFTER UPDATE OF role ON users
  FOR EACH ROW EXECUTE FUNCTION create_developer_profile_on_role();

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- 
-- What was added:
--   ✅ developer_profiles table with personal info, GitHub, skills, preferences
--   ✅ developer_projects table for portfolio projects
--   ✅ RLS policies for secure access
--   ✅ Triggers for updated_at timestamps
--   ✅ Auto-create profile when user selects developer role
--   ✅ Indexes for performance
--
-- Tables:
--   - developer_profiles: Core profile data
--   - developer_projects: Portfolio projects
--
-- To run:
--   1. Go to Supabase Dashboard → SQL Editor
--   2. Paste this entire file
--   3. Click "Run"
--
-- ============================================================
