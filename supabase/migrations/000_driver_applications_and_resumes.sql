-- ============================================================
-- MIGRATION 000: Foundation Tables (Users, Credentials, Cache)
-- ============================================================
-- Date: September 26, 2024 (Original deployment)
-- Purpose: Core foundation for Veree platform
-- Dependencies: None (this is the base)
-- 
-- Tables Documented:
--   0. users - Base user/authentication table
--   1. driver_applications - DOT application forms (blockchain-verified)
--   2. resumes - Driver resume uploads (blockchain-verified)
--   3. t_prefill_cache - AI extraction cache (persistent)
-- 
-- Note: This migration documents the EXISTING foundation tables.
--       These are already running in production.
-- ============================================================

-- ============================================================
-- 0. USERS TABLE (Foundation)
-- ============================================================
-- Base user table for authentication and profiles
-- All other tables reference this via user_id

CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Authentication
  wallet_address TEXT UNIQUE NOT NULL,
  email TEXT,
  
  -- Profile
  name TEXT,
  
  -- CDL Information
  cdl_number TEXT,
  cdl_state TEXT,
  cdl_class TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Allow user registration" ON users;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" 
  ON users FOR SELECT 
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile" 
  ON users FOR UPDATE 
  USING (id = auth.uid());

-- Allow user registration (anyone can insert)
CREATE POLICY "Allow user registration" 
  ON users FOR INSERT 
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE users IS 'Main users table storing driver and user profile information';
COMMENT ON COLUMN users.wallet_address IS 'Unique blockchain wallet address for authentication';
COMMENT ON COLUMN users.email IS 'User email address (optional)';
COMMENT ON COLUMN users.name IS 'User display name';
COMMENT ON COLUMN users.cdl_number IS 'Commercial Driver License number';
COMMENT ON COLUMN users.cdl_state IS 'State that issued the CDL';
COMMENT ON COLUMN users.cdl_class IS 'CDL class (A, B, C)';
COMMENT ON COLUMN users.is_active IS 'Whether the user account is active';

-- ============================================================
-- 1. DRIVER APPLICATIONS TABLE (DOT Application Forms)
-- ============================================================
-- Stores complete DOT driver application forms (Forms 1, 2, 3)
-- Blockchain-verified via IPFS and smart contracts

CREATE TABLE IF NOT EXISTS driver_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Application Content (JSONB stores all form data)
  application_data JSONB NOT NULL,
  
  -- Blockchain Verification
  application_hash TEXT, -- SHA-256 hash for verification
  ipfs_hash TEXT, -- IPFS hash from Pinata storage
  blockchain_tx_hash VARCHAR(66), -- Blockchain transaction hash
  blockchain_application_id TEXT, -- Contract application ID from ProductionDriverRegistry
  
  -- Application Progress
  current_step INTEGER DEFAULT 1, -- Which form step (1, 2, or 3)
  is_complete BOOLEAN DEFAULT FALSE,
  
  -- Verification Status
  verification_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, VERIFIED, REJECTED
  
  -- Payment Tracking
  is_paid BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 2. DRIVER APPLICATIONS - INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_driver_applications_user_id 
  ON driver_applications(user_id);

CREATE INDEX IF NOT EXISTS idx_driver_applications_created_at 
  ON driver_applications(created_at);

CREATE INDEX IF NOT EXISTS idx_driver_applications_application_hash 
  ON driver_applications(application_hash);

CREATE INDEX IF NOT EXISTS idx_driver_applications_verification_status 
  ON driver_applications(verification_status);

CREATE INDEX IF NOT EXISTS idx_driver_applications_is_paid 
  ON driver_applications(is_paid);

CREATE INDEX IF NOT EXISTS idx_driver_applications_ipfs_hash 
  ON driver_applications(ipfs_hash);

-- Prevent duplicate application hashes per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_applications_user_hash 
  ON driver_applications(user_id, application_hash) 
  WHERE application_hash IS NOT NULL;

-- ============================================================
-- 3. DRIVER APPLICATIONS - RLS POLICIES
-- ============================================================

ALTER TABLE driver_applications ENABLE ROW LEVEL SECURITY;

-- Users can view their own applications
DROP POLICY IF EXISTS "Users can view own applications" ON driver_applications;
CREATE POLICY "Users can view own applications" 
  ON driver_applications FOR SELECT 
  USING (user_id = auth.uid());

-- Users can insert their own applications
DROP POLICY IF EXISTS "Users can insert own applications" ON driver_applications;
CREATE POLICY "Users can insert own applications" 
  ON driver_applications FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- Users can update their own applications
DROP POLICY IF EXISTS "Users can update own applications" ON driver_applications;
CREATE POLICY "Users can update own applications" 
  ON driver_applications FOR UPDATE 
  USING (user_id = auth.uid());

-- ============================================================
-- 4. DRIVER APPLICATIONS - TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
DROP TRIGGER IF EXISTS update_driver_applications_updated_at ON driver_applications;
CREATE TRIGGER update_driver_applications_updated_at 
  BEFORE UPDATE ON driver_applications 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. DRIVER APPLICATIONS - COMMENTS
-- ============================================================

COMMENT ON TABLE driver_applications IS 'DOT application forms with blockchain verification';
COMMENT ON COLUMN driver_applications.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN driver_applications.application_data IS 'Complete form data from Forms 1, 2, 3 in JSONB format';
COMMENT ON COLUMN driver_applications.application_hash IS 'SHA-256 hash for blockchain verification and duplicate detection';
COMMENT ON COLUMN driver_applications.ipfs_hash IS 'IPFS hash from Pinata storage';
COMMENT ON COLUMN driver_applications.verification_status IS 'PENDING, VERIFIED, REJECTED - tracks DOT inspector verification';
COMMENT ON COLUMN driver_applications.blockchain_application_id IS 'Contract application ID from ProductionDriverRegistry';
COMMENT ON COLUMN driver_applications.current_step IS 'Current form step: 1, 2, or 3';
COMMENT ON COLUMN driver_applications.is_complete IS 'Whether all three forms are completed';

-- ============================================================
-- 6. RESUMES TABLE (Driver Resume Uploads)
-- ============================================================
-- Stores resume file uploads with blockchain verification
-- Supports AI extraction of form data

CREATE TABLE IF NOT EXISTS resumes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- File Information
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size BIGINT, -- File size in bytes
  mime_type TEXT, -- e.g., application/pdf
  
  -- Blockchain Verification
  file_hash VARCHAR(64), -- SHA-256 hash for duplicate detection
  ipfs_hash TEXT NOT NULL, -- IPFS hash from Pinata
  ipfs_url TEXT, -- Full IPFS URL
  blockchain_tx_hash VARCHAR(66), -- Blockchain transaction hash
  blockchain_resume_id TEXT, -- Contract resume ID from ResumeRegistry
  
  -- Verification Status
  verification_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, VERIFIED, FAILED
  
  -- Payment Tracking
  is_paid BOOLEAN DEFAULT false,
  
  -- AI Extraction
  extracted_data JSONB, -- Cached AI-extracted form data (form1, form2, form3)
  
  -- Visibility
  is_public BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 7. RESUMES - INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_resumes_user_id 
  ON resumes(user_id);

CREATE INDEX IF NOT EXISTS idx_resumes_created_at 
  ON resumes(created_at);

CREATE INDEX IF NOT EXISTS idx_resumes_file_hash 
  ON resumes(file_hash);

CREATE INDEX IF NOT EXISTS idx_resumes_ipfs_hash 
  ON resumes(ipfs_hash);

CREATE INDEX IF NOT EXISTS idx_resumes_verification_status 
  ON resumes(verification_status);

CREATE INDEX IF NOT EXISTS idx_resumes_is_paid 
  ON resumes(is_paid);

-- ============================================================
-- 8. RESUMES - RLS POLICIES
-- ============================================================

ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

-- Users can view their own resumes
DROP POLICY IF EXISTS "Users can view own resumes" ON resumes;
CREATE POLICY "Users can view own resumes" 
  ON resumes FOR SELECT 
  USING (user_id = auth.uid());

-- Users can insert their own resumes
DROP POLICY IF EXISTS "Users can insert own resumes" ON resumes;
CREATE POLICY "Users can insert own resumes" 
  ON resumes FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- Users can update their own resumes
DROP POLICY IF EXISTS "Users can update own resumes" ON resumes;
CREATE POLICY "Users can update own resumes" 
  ON resumes FOR UPDATE 
  USING (user_id = auth.uid());

-- Users can delete their own resumes
DROP POLICY IF EXISTS "Users can delete own resumes" ON resumes;
CREATE POLICY "Users can delete own resumes" 
  ON resumes FOR DELETE 
  USING (user_id = auth.uid());

-- ============================================================
-- 9. RESUMES - COMMENTS
-- ============================================================

COMMENT ON TABLE resumes IS 'Stores resume files with blockchain verification';
COMMENT ON COLUMN resumes.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN resumes.title IS 'User-provided resume title';
COMMENT ON COLUMN resumes.file_hash IS 'SHA-256 hash for duplicate detection';
COMMENT ON COLUMN resumes.ipfs_hash IS 'IPFS hash from Pinata storage';
COMMENT ON COLUMN resumes.ipfs_url IS 'Full IPFS URL for file access';
COMMENT ON COLUMN resumes.verification_status IS 'PENDING, VERIFIED, FAILED - blockchain verification status';
COMMENT ON COLUMN resumes.blockchain_resume_id IS 'Contract resume ID from ResumeRegistry';
COMMENT ON COLUMN resumes.extracted_data IS 'Cached AI-extracted form data (form1Data, form2Data, form3Data) to avoid re-processing duplicates';
COMMENT ON COLUMN resumes.is_public IS 'Whether resume is publicly accessible';

-- ============================================================
-- 10. T_PREFILL_CACHE TABLE (AI Extraction Cache)
-- ============================================================
-- Persistent cache for T Backend AI extraction results
-- Survives resume deletions (useful for testing/admin resets)
-- Added to fix T Backend cache lock issues

CREATE TABLE IF NOT EXISTS t_prefill_cache (
  -- Primary cache key (T Backend's file_id for guaranteed uniqueness)
  cache_key TEXT PRIMARY KEY,
  
  -- Extracted form data
  payload JSONB NOT NULL, -- {form1Data, form2Data, form3Data, stats, metadata}
  
  -- Reference fields for lookups
  ipfs_hash TEXT NOT NULL, -- IPFS CID of the resume
  file_id TEXT NOT NULL, -- T Backend's file_id
  file_hash TEXT, -- SHA-256 hash of original file content
  
  -- User reference (optional, for potential cleanup)
  user_id UUID,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 11. T_PREFILL_CACHE - INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_t_prefill_cache_ipfs_hash 
  ON t_prefill_cache(ipfs_hash);

CREATE INDEX IF NOT EXISTS idx_t_prefill_cache_file_id 
  ON t_prefill_cache(file_id);

CREATE INDEX IF NOT EXISTS idx_t_prefill_cache_file_hash 
  ON t_prefill_cache(file_hash);

CREATE INDEX IF NOT EXISTS idx_t_prefill_cache_user_id 
  ON t_prefill_cache(user_id);

-- ============================================================
-- 12. T_PREFILL_CACHE - TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_t_prefill_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_t_prefill_cache_updated_at ON t_prefill_cache;
CREATE TRIGGER set_t_prefill_cache_updated_at
  BEFORE UPDATE ON t_prefill_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_t_prefill_cache_updated_at();

-- ============================================================
-- 13. T_PREFILL_CACHE - COMMENTS
-- ============================================================

COMMENT ON TABLE t_prefill_cache IS 'Persistent cache for T Backend AI prefill results. Survives resume deletions.';
COMMENT ON COLUMN t_prefill_cache.cache_key IS 'Primary key: T Backend file_id (unique per file content)';
COMMENT ON COLUMN t_prefill_cache.payload IS 'Extracted data: {form1Data, form2Data, form3Data, stats, metadata}';
COMMENT ON COLUMN t_prefill_cache.ipfs_hash IS 'IPFS CID for resume file (multiple uploads of same file = same hash)';
COMMENT ON COLUMN t_prefill_cache.file_id IS 'T Backend internal file ID (matches cache_key)';
COMMENT ON COLUMN t_prefill_cache.file_hash IS 'SHA-256 hash of original file content for deduplication';
COMMENT ON COLUMN t_prefill_cache.user_id IS 'Optional user reference for potential cleanup operations';

-- ============================================================
-- 14. PAYMENTS TABLE (USDC Payment Tracking)
-- ============================================================
-- Tracks USDC payments for resume verification and DOT applications

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Payment Details
  type VARCHAR NOT NULL, -- 'resume_verification', 'dot_application', etc.
  amount_usdc NUMERIC NOT NULL,
  
  -- Blockchain Transaction
  tx_hash VARCHAR, -- Blockchain transaction hash
  
  -- Status
  status VARCHAR DEFAULT 'PENDING', -- 'PENDING', 'COMPLETED', 'FAILED'
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- Comments
COMMENT ON TABLE payments IS 'USDC payment tracking for resume verification and DOT applications';
COMMENT ON COLUMN payments.type IS 'Payment type: resume_verification, dot_application, etc.';
COMMENT ON COLUMN payments.amount_usdc IS 'Payment amount in USDC';
COMMENT ON COLUMN payments.tx_hash IS 'Blockchain transaction hash';
COMMENT ON COLUMN payments.status IS 'PENDING, COMPLETED, FAILED';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- This migration documents the existing foundation tables.
-- Already running in production since September 2024.
--
-- Tables documented:
--   ✅ users - Base user/authentication table
--   ✅ driver_applications - DOT forms with blockchain verification
--   ✅ resumes - Resume uploads with blockchain verification
--   ✅ t_prefill_cache - AI extraction cache (survives deletions)
--   ✅ payments - USDC payment tracking
-- ============================================================

