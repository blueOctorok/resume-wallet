-- Create driver_applications table with structure matching resumes table pattern
CREATE TABLE driver_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  application_data JSONB NOT NULL,
  application_hash TEXT,                    -- SHA-256 hash for blockchain verification and duplicate detection
  ipfs_hash TEXT,                           -- IPFS hash from Pinata storage
  current_step INTEGER DEFAULT 1,
  is_complete BOOLEAN DEFAULT FALSE,
  verification_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, VERIFIED, REJECTED
  is_paid BOOLEAN DEFAULT false,            -- Payment tracking (if DOT application requires payment)
  blockchain_tx_hash VARCHAR(66),           -- Blockchain transaction hash
  blockchain_application_id TEXT,           -- Contract application ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance (matching resumes pattern)
CREATE INDEX idx_driver_applications_user_id ON driver_applications(user_id);
CREATE INDEX idx_driver_applications_created_at ON driver_applications(created_at);
CREATE INDEX idx_driver_applications_application_hash ON driver_applications(application_hash);
CREATE INDEX idx_driver_applications_verification_status ON driver_applications(verification_status);
CREATE INDEX idx_driver_applications_is_paid ON driver_applications(is_paid);
CREATE INDEX idx_driver_applications_ipfs_hash ON driver_applications(ipfs_hash);

-- Add unique constraint to prevent duplicate application hashes per user
CREATE UNIQUE INDEX idx_driver_applications_user_hash 
ON driver_applications(user_id, application_hash) 
WHERE application_hash IS NOT NULL;

-- Add RLS (Row Level Security) policies
ALTER TABLE driver_applications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own applications
CREATE POLICY "Users can view own applications" ON driver_applications
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Users can insert their own applications
CREATE POLICY "Users can insert own applications" ON driver_applications
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own applications
CREATE POLICY "Users can update own applications" ON driver_applications
  FOR UPDATE USING (user_id = auth.uid());

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_driver_applications_updated_at 
    BEFORE UPDATE ON driver_applications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add column comments for documentation
COMMENT ON COLUMN driver_applications.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN driver_applications.application_hash IS 'SHA-256 hash for blockchain verification and duplicate detection';
COMMENT ON COLUMN driver_applications.ipfs_hash IS 'IPFS hash from Pinata storage';
COMMENT ON COLUMN driver_applications.verification_status IS 'PENDING, VERIFIED, REJECTED - tracks DOT inspector verification';
COMMENT ON COLUMN driver_applications.blockchain_application_id IS 'Contract application ID from ProductionDriverRegistry';
