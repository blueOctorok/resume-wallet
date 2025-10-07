-- Complete driver_applications table schema with blockchain integration
-- This is the full schema - run this to create or update the table

-- Drop existing table if you want to recreate (WARNING: This deletes all data!)
-- DROP TABLE IF EXISTS driver_applications CASCADE;

-- Create driver_applications table with enhanced structure including blockchain fields
CREATE TABLE IF NOT EXISTS driver_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,
  application_data JSONB NOT NULL,
  application_hash TEXT,  -- SHA-256 hash for blockchain verification
  ipfs_hash TEXT,  -- IPFS hash from Pinata storage
  current_step INTEGER DEFAULT 1,
  is_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_driver_applications_user_address ON driver_applications(user_address);
CREATE INDEX IF NOT EXISTS idx_driver_applications_application_hash ON driver_applications(application_hash);
CREATE INDEX IF NOT EXISTS idx_driver_applications_ipfs_hash ON driver_applications(ipfs_hash);

-- Add unique constraint to prevent duplicate application hashes per user
-- Note: Allows NULL values for existing applications without hashes
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_applications_user_hash 
ON driver_applications(user_address, application_hash) 
WHERE application_hash IS NOT NULL;

-- Add RLS (Row Level Security) policies
ALTER TABLE driver_applications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own applications" ON driver_applications;
DROP POLICY IF EXISTS "Users can insert own applications" ON driver_applications;
DROP POLICY IF EXISTS "Users can update own applications" ON driver_applications;

-- Policy: Users can only see their own applications
CREATE POLICY "Users can view own applications" ON driver_applications
  FOR SELECT USING (user_address = current_setting('request.jwt.claims')::json->>'sub');

-- Policy: Users can insert their own applications
CREATE POLICY "Users can insert own applications" ON driver_applications
  FOR INSERT WITH CHECK (user_address = current_setting('request.jwt.claims')::json->>'sub');

-- Policy: Users can update their own applications
CREATE POLICY "Users can update own applications" ON driver_applications
  FOR UPDATE USING (user_address = current_setting('request.jwt.claims')::json->>'sub');

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_driver_applications_updated_at ON driver_applications;

-- Create trigger
CREATE TRIGGER update_driver_applications_updated_at 
    BEFORE UPDATE ON driver_applications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add column comments for documentation
COMMENT ON TABLE driver_applications IS 'Stores DOT driver application data with blockchain integration';
COMMENT ON COLUMN driver_applications.user_address IS 'Wallet address of the application owner';
COMMENT ON COLUMN driver_applications.application_data IS 'Complete application form data stored as JSON';
COMMENT ON COLUMN driver_applications.application_hash IS 'SHA-256 hash of the application data for blockchain verification';
COMMENT ON COLUMN driver_applications.ipfs_hash IS 'IPFS hash from Pinata storage for decentralized data retrieval';
COMMENT ON COLUMN driver_applications.current_step IS 'Current step in the multi-step application process (1-10)';
COMMENT ON COLUMN driver_applications.is_complete IS 'Whether the application has been completed and submitted';

