-- Migration: Add extracted_data column to existing resumes table
-- Run this in Supabase SQL Editor to add caching for AI-extracted data

-- Add the new column
ALTER TABLE resumes 
ADD COLUMN IF NOT EXISTS extracted_data JSONB;

-- Add index for performance when querying by IPFS hash (if not exists)
CREATE INDEX IF NOT EXISTS idx_resumes_ipfs_hash ON resumes(ipfs_hash);

-- Add column comment
COMMENT ON COLUMN resumes.extracted_data IS 'Cached AI-extracted form data (form1Data, form2Data, form3Data) to avoid re-processing duplicates';

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'resumes' 
ORDER BY ordinal_position;

