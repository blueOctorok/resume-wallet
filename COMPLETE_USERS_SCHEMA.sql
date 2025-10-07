-- Create users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT,
  cdl_number TEXT,
  cdl_state TEXT,
  cdl_class TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (id = auth.uid());

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

-- Policy: Allow user creation (for registration)
CREATE POLICY "Allow user registration" ON users
  FOR INSERT WITH CHECK (true);

-- Add column comments for documentation
COMMENT ON TABLE users IS 'Main users table storing driver and user profile information';
COMMENT ON COLUMN users.wallet_address IS 'Unique blockchain wallet address for authentication';
COMMENT ON COLUMN users.cdl_number IS 'Commercial Driver License number';
COMMENT ON COLUMN users.cdl_state IS 'State that issued the CDL';
COMMENT ON COLUMN users.cdl_class IS 'CDL class (A, B, C)';
COMMENT ON COLUMN users.is_active IS 'Whether the user account is active';

