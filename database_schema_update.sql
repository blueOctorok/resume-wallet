-- Updated resumes table with all required columns for production
CREATE TABLE resumes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_hash VARCHAR(64),                    -- SHA-256 hash for duplicate detection
  ipfs_hash TEXT NOT NULL,
  ipfs_url TEXT,                           -- Full IPFS URL
  file_size BIGINT,                        -- File size in bytes
  mime_type TEXT,                          -- File MIME type (e.g., application/pdf)
  is_public BOOLEAN DEFAULT false,
  verification_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, VERIFIED, FAILED
  is_paid BOOLEAN DEFAULT false,           -- Payment tracking
  blockchain_tx_hash VARCHAR(66),          -- Blockchain transaction hash
  blockchain_resume_id TEXT,               -- Contract resume ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_resumes_user_id ON resumes(user_id);
CREATE INDEX idx_resumes_created_at ON resumes(created_at);
CREATE INDEX idx_resumes_file_hash ON resumes(file_hash);           -- For duplicate detection
CREATE INDEX idx_resumes_verification_status ON resumes(verification_status); -- For filtering
CREATE INDEX idx_resumes_is_paid ON resumes(is_paid);              -- For payment analytics

-- If you need to update an existing table, use these ALTER statements instead:
/*
ALTER TABLE resumes 
ADD COLUMN file_hash VARCHAR(64),
ADD COLUMN ipfs_url TEXT,
ADD COLUMN file_size BIGINT,
ADD COLUMN mime_type TEXT,
ADD COLUMN verification_status VARCHAR(20) DEFAULT 'PENDING',
ADD COLUMN is_paid BOOLEAN DEFAULT false,
ADD COLUMN blockchain_tx_hash VARCHAR(66),
ADD COLUMN blockchain_resume_id TEXT;

-- Add the indexes
CREATE INDEX idx_resumes_file_hash ON resumes(file_hash);
CREATE INDEX idx_resumes_verification_status ON resumes(verification_status);
CREATE INDEX idx_resumes_is_paid ON resumes(is_paid);
*/
