-- Create resumes table
CREATE TABLE resumes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_hash VARCHAR(64),                    -- SHA-256 hash for duplicate detection
  ipfs_hash TEXT NOT NULL,
  ipfs_url TEXT,                            -- Full IPFS URL
  file_size BIGINT,                         -- File size in bytes
  mime_type TEXT,                           -- File MIME type (e.g., application/pdf)
  is_public BOOLEAN DEFAULT false,
  verification_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, VERIFIED, FAILED
  is_paid BOOLEAN DEFAULT false,            -- Payment tracking
  blockchain_tx_hash VARCHAR(66),           -- Blockchain transaction hash
  blockchain_resume_id TEXT,                -- Contract resume ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_resumes_user_id ON resumes(user_id);
CREATE INDEX idx_resumes_created_at ON resumes(created_at);
CREATE INDEX idx_resumes_file_hash ON resumes(file_hash);
CREATE INDEX idx_resumes_verification_status ON resumes(verification_status);
CREATE INDEX idx_resumes_is_paid ON resumes(is_paid);

-- Add RLS (Row Level Security) policies
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own resumes
CREATE POLICY "Users can view own resumes" ON resumes
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Users can insert their own resumes
CREATE POLICY "Users can insert own resumes" ON resumes
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own resumes
CREATE POLICY "Users can update own resumes" ON resumes
  FOR UPDATE USING (user_id = auth.uid());

-- Policy: Users can delete their own resumes
CREATE POLICY "Users can delete own resumes" ON resumes
  FOR DELETE USING (user_id = auth.uid());

-- Add column comments for documentation
COMMENT ON TABLE resumes IS 'Stores resume files with blockchain verification';
COMMENT ON COLUMN resumes.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN resumes.file_hash IS 'SHA-256 hash for duplicate detection';
COMMENT ON COLUMN resumes.ipfs_hash IS 'IPFS hash from Pinata storage';
COMMENT ON COLUMN resumes.verification_status IS 'PENDING, VERIFIED, FAILED - blockchain verification status';
COMMENT ON COLUMN resumes.blockchain_resume_id IS 'Contract resume ID from ResumeRegistry';

