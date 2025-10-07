-- Safe migration: Only adds missing indexes and policies to existing users table
-- This will NOT delete any data or drop the table

-- Add indexes if they don't exist (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Enable RLS if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate them
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Allow user registration" ON users;

-- Recreate policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Allow user registration" ON users
  FOR INSERT WITH CHECK (true);

-- Add column comments
COMMENT ON TABLE users IS 'Main users table storing driver and user profile information';
COMMENT ON COLUMN users.wallet_address IS 'Unique blockchain wallet address for authentication';
COMMENT ON COLUMN users.cdl_number IS 'Commercial Driver License number';
COMMENT ON COLUMN users.cdl_state IS 'State that issued the CDL';
COMMENT ON COLUMN users.cdl_class IS 'CDL class (A, B, C)';
COMMENT ON COLUMN users.is_active IS 'Whether the user account is active';

