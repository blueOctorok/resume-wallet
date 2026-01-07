-- ============================================================
-- MIGRATION 006: Resume Builder Support
-- ============================================================
-- Date: January 2026
-- Purpose: Add support for built resumes (structured data storage)
-- Dependencies: 000_driver_applications_and_resumes.sql
-- 
-- This migration adds:
--   - resume_type column (distinguishes 'uploaded' from 'built' resumes)
--   - structured_data column (stores structured resume data for built resumes)
--   - source_resume_id (links built resume PDFs to original structured data)
-- ============================================================

-- ============================================================
-- 1. ADD NEW COLUMNS TO RESUMES TABLE
-- ============================================================

-- Add resume_type to distinguish uploaded PDFs from built resumes
ALTER TABLE resumes 
ADD COLUMN IF NOT EXISTS resume_type VARCHAR(20) DEFAULT 'uploaded';

-- Add structured_data for storing built resume data (JSONB)
ALTER TABLE resumes 
ADD COLUMN IF NOT EXISTS structured_data JSONB;

-- Add source_resume_id to link built resume PDFs back to their structured data
-- (when a built resume is exported to PDF and uploaded)
ALTER TABLE resumes 
ADD COLUMN IF NOT EXISTS source_resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL;

-- ============================================================
-- 2. UPDATE EXISTING RECORDS
-- ============================================================

-- Mark all existing resumes as 'uploaded' type
UPDATE resumes 
SET resume_type = 'uploaded' 
WHERE resume_type IS NULL;

-- ============================================================
-- 3. ADD INDEXES
-- ============================================================

-- Index for filtering by resume type
CREATE INDEX IF NOT EXISTS idx_resumes_resume_type 
  ON resumes(resume_type);

-- Index for querying structured data
CREATE INDEX IF NOT EXISTS idx_resumes_structured_data 
  ON resumes USING GIN (structured_data);

-- Index for finding PDF exports of built resumes
CREATE INDEX IF NOT EXISTS idx_resumes_source_resume_id 
  ON resumes(source_resume_id) 
  WHERE source_resume_id IS NOT NULL;

-- ============================================================
-- 4. ADD COMMENTS
-- ============================================================

COMMENT ON COLUMN resumes.resume_type IS 'Resume source type: uploaded (PDF upload) or built (created via builder)';
COMMENT ON COLUMN resumes.structured_data IS 'Structured resume data for built resumes (personal info, employment, skills, etc.)';
COMMENT ON COLUMN resumes.source_resume_id IS 'Links PDF exports back to their original built resume (for built resumes exported to PDF)';

-- ============================================================
-- 5. UPDATE RLS POLICIES
-- ============================================================

-- Existing RLS policies already cover all resumes regardless of type
-- No changes needed - users can create/read/update/delete their own resumes
-- whether uploaded or built
