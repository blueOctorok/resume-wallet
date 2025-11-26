-- ============================================================
-- MIGRATION 003: MVR Integration (Accio API)
-- ============================================================
-- Date: November 25, 2025
-- Purpose: Enable Motor Vehicle Record (MVR) ordering and results storage
-- Dependencies: Requires Migrations 000, 001, and 002 to be completed
-- 
-- What This Adds:
--   1. mvr_orders table - Track MVR orders placed with Accio
--   2. mvr_results table - Store MVR results from Accio webhooks
--   3. MVR fields in driver_profiles - Cache key MVR data for quick access
--   4. Helper functions and triggers for status updates
-- ============================================================

-- ============================================================
-- 1. MVR ORDERS TABLE
-- ============================================================
-- Tracks MVR orders placed with Accio API
-- Stores order metadata, status, and raw XML payloads

CREATE TABLE IF NOT EXISTS mvr_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Driver Reference
  driver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_profile_id UUID REFERENCES driver_profiles(id) ON DELETE SET NULL,
  driver_application_id UUID REFERENCES driver_applications(id) ON DELETE SET NULL,
  
  -- Accio Order Information
  accio_order_number TEXT NOT NULL, -- Accio's order number (from placeOrder number attribute)
  accio_suborder_number TEXT, -- Accio's suborder number (for MVR subOrder)
  accio_remote_order_number TEXT, -- Accio's remote order number (from results)
  accio_remote_suborder_number TEXT, -- Accio's remote suborder number (from results)
  
  -- Order Details
  order_type VARCHAR(50) DEFAULT 'MVR', -- 'MVR', 'Employment_verification', 'fmcsa_crash_inspection'
  mvr_search_type VARCHAR(50) DEFAULT 'standard', -- 'standard', 'comprehensive', etc.
  
  -- Driver License Information (from order)
  dl_number TEXT NOT NULL,
  dl_state VARCHAR(2) NOT NULL,
  
  -- Order Status
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending',        -- Order placed, waiting for Accio
    'processing',     -- Accio is processing the order
    'completed',     -- Results received and processed
    'failed',        -- Order failed or was rejected
    'needs_review',  -- Results need manual review
    'cancelled'      -- Order was cancelled
  )),
  
  -- Order Payloads (raw XML for compliance/audit)
  order_xml TEXT, -- Full XML sent to Accio
  result_xml TEXT, -- Full XML received from Accio
  
  -- Timing
  ordered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE, -- When Accio processed it
  completed_at TIMESTAMP WITH TIME ZONE, -- When we received results
  expires_at TIMESTAMP WITH TIME ZONE, -- MVR expiration date (typically 30 days)
  
  -- Fees
  fee_amount DECIMAL(10, 2), -- Cost of the MVR order
  fee_currency VARCHAR(10) DEFAULT 'USD',
  
  -- Error Handling
  error_message TEXT,
  error_code TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(accio_order_number, accio_suborder_number) -- Prevent duplicate orders
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mvr_orders_driver_user_id 
  ON mvr_orders(driver_user_id);

CREATE INDEX IF NOT EXISTS idx_mvr_orders_driver_profile_id 
  ON mvr_orders(driver_profile_id);

CREATE INDEX IF NOT EXISTS idx_mvr_orders_status 
  ON mvr_orders(status);

CREATE INDEX IF NOT EXISTS idx_mvr_orders_ordered_at 
  ON mvr_orders(ordered_at DESC);

CREATE INDEX IF NOT EXISTS idx_mvr_orders_accio_order_number 
  ON mvr_orders(accio_order_number);

CREATE INDEX IF NOT EXISTS idx_mvr_orders_expires_at 
  ON mvr_orders(expires_at) 
  WHERE expires_at IS NOT NULL;

-- Comments
COMMENT ON TABLE mvr_orders IS 'Tracks MVR orders placed with Accio API';
COMMENT ON COLUMN mvr_orders.accio_order_number IS 'Accio order number from placeOrder number attribute';
COMMENT ON COLUMN mvr_orders.accio_suborder_number IS 'Accio suborder number for MVR subOrder';
COMMENT ON COLUMN mvr_orders.order_xml IS 'Full XML payload sent to Accio (for audit/compliance)';
COMMENT ON COLUMN mvr_orders.result_xml IS 'Full XML payload received from Accio (for audit/compliance)';
COMMENT ON COLUMN mvr_orders.expires_at IS 'MVR expiration date (typically 30 days from order date)';

-- ============================================================
-- 2. MVR RESULTS TABLE
-- ============================================================
-- Stores parsed MVR results from Accio webhooks
-- Links to mvr_orders and driver_profiles

CREATE TABLE IF NOT EXISTS mvr_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  mvr_order_id UUID NOT NULL REFERENCES mvr_orders(id) ON DELETE CASCADE,
  driver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_profile_id UUID REFERENCES driver_profiles(id) ON DELETE SET NULL,
  
  -- License Information (from MVR)
  license_number TEXT,
  license_state VARCHAR(2),
  license_class VARCHAR(10), -- 'A', 'B', 'C', 'D' (regular), etc.
  license_status VARCHAR(50), -- 'Valid', 'Suspended', 'Revoked', 'Expired'
  license_issue_date DATE,
  license_expiration_date DATE,
  
  -- Violations & Points
  total_points INTEGER DEFAULT 0,
  violation_count INTEGER DEFAULT 0,
  
  -- Violations Detail (JSONB for flexibility)
  violations JSONB, -- Array of violation objects with date, type, points, etc.
  
  -- Accidents
  accident_count INTEGER DEFAULT 0,
  accidents JSONB, -- Array of accident objects
  
  -- Suspensions/Revocations
  suspension_count INTEGER DEFAULT 0,
  suspensions JSONB, -- Array of suspension objects
  
  -- Medical Certificate (if applicable)
  medical_cert_expiration DATE,
  medical_cert_status VARCHAR(50),
  
  -- CDL-Specific Information
  cdl_endorsements TEXT[], -- Endorsements found on MVR
  cdl_restrictions TEXT[], -- Restrictions found on MVR
  
  -- Result Status
  result_status VARCHAR(50) DEFAULT 'received' CHECK (result_status IN (
    'received',      -- Results received from Accio
    'parsed',        -- Results parsed and stored
    'reviewed',      -- Manually reviewed
    'error'          -- Error parsing results
  )),
  
  -- Parsed Data (full structured JSON from XML)
  parsed_data JSONB, -- Complete parsed MVR data structure
  
  -- Metadata
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  parsed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mvr_results_mvr_order_id 
  ON mvr_results(mvr_order_id);

CREATE INDEX IF NOT EXISTS idx_mvr_results_driver_user_id 
  ON mvr_results(driver_user_id);

CREATE INDEX IF NOT EXISTS idx_mvr_results_driver_profile_id 
  ON mvr_results(driver_profile_id);

CREATE INDEX IF NOT EXISTS idx_mvr_results_license_expiration 
  ON mvr_results(license_expiration_date) 
  WHERE license_expiration_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mvr_results_received_at 
  ON mvr_results(received_at DESC);

-- Comments
COMMENT ON TABLE mvr_results IS 'Stores parsed MVR results from Accio webhooks';
COMMENT ON COLUMN mvr_results.violations IS 'JSONB array of traffic violations with dates, types, points';
COMMENT ON COLUMN mvr_results.accidents IS 'JSONB array of accidents with dates, severity, fault';
COMMENT ON COLUMN mvr_results.suspensions IS 'JSONB array of license suspensions/revocations';
COMMENT ON COLUMN mvr_results.parsed_data IS 'Complete structured JSON parsed from Accio XML';

-- ============================================================
-- 3. EXTEND DRIVER_PROFILES TABLE (Add MVR Fields)
-- ============================================================
-- Add MVR-related fields to driver_profiles for quick access
-- These fields are cached from mvr_results for profile completeness

ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS mvr_order_id UUID REFERENCES mvr_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mvr_result_id UUID REFERENCES mvr_results(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mvr_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS mvr_license_status VARCHAR(50), -- 'Valid', 'Suspended', 'Expired'
  ADD COLUMN IF NOT EXISTS mvr_total_points INTEGER,
  ADD COLUMN IF NOT EXISTS mvr_violation_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mvr_last_ordered_at TIMESTAMP WITH TIME ZONE;

-- Index for MVR expiration queries
CREATE INDEX IF NOT EXISTS idx_driver_profiles_mvr_expires_at 
  ON driver_profiles(mvr_expires_at) 
  WHERE mvr_expires_at IS NOT NULL;

-- Comments
COMMENT ON COLUMN driver_profiles.mvr_order_id IS 'Latest MVR order reference';
COMMENT ON COLUMN driver_profiles.mvr_result_id IS 'Latest MVR result reference';
COMMENT ON COLUMN driver_profiles.mvr_expires_at IS 'When current MVR expires (typically 30 days)';
COMMENT ON COLUMN driver_profiles.mvr_license_status IS 'License status from latest MVR';
COMMENT ON COLUMN driver_profiles.mvr_total_points IS 'Total points from latest MVR';
COMMENT ON COLUMN driver_profiles.mvr_violation_count IS 'Number of violations from latest MVR';

-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS) - MVR ORDERS
-- ============================================================

ALTER TABLE mvr_orders ENABLE ROW LEVEL SECURITY;

-- Drivers can view their own MVR orders
DROP POLICY IF EXISTS "Drivers can view their own MVR orders" ON mvr_orders;
CREATE POLICY "Drivers can view their own MVR orders"
  ON mvr_orders FOR SELECT
  USING (driver_user_id = auth.uid());

-- Drivers can create their own MVR orders
DROP POLICY IF EXISTS "Drivers can create their own MVR orders" ON mvr_orders;
CREATE POLICY "Drivers can create their own MVR orders"
  ON mvr_orders FOR INSERT
  WITH CHECK (driver_user_id = auth.uid());

-- System can update MVR orders (for webhook processing)
-- Note: This uses service_role key, not user auth
DROP POLICY IF EXISTS "Service role can update MVR orders" ON mvr_orders;
CREATE POLICY "Service role can update MVR orders"
  ON mvr_orders FOR UPDATE
  USING (true); -- Service role bypasses RLS

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS) - MVR RESULTS
-- ============================================================

ALTER TABLE mvr_results ENABLE ROW LEVEL SECURITY;

-- Drivers can view their own MVR results
DROP POLICY IF EXISTS "Drivers can view their own MVR results" ON mvr_results;
CREATE POLICY "Drivers can view their own MVR results"
  ON mvr_results FOR SELECT
  USING (driver_user_id = auth.uid());

-- System can insert MVR results (for webhook processing)
DROP POLICY IF EXISTS "Service role can insert MVR results" ON mvr_results;
CREATE POLICY "Service role can insert MVR results"
  ON mvr_results FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

-- System can update MVR results
DROP POLICY IF EXISTS "Service role can update MVR results" ON mvr_results;
CREATE POLICY "Service role can update MVR results"
  ON mvr_results FOR UPDATE
  USING (true); -- Service role bypasses RLS

-- ============================================================
-- 6. TRIGGERS - AUTO UPDATE TIMESTAMPS
-- ============================================================

-- Trigger for mvr_orders updated_at
DROP TRIGGER IF EXISTS update_mvr_orders_updated_at ON mvr_orders;
CREATE TRIGGER update_mvr_orders_updated_at
  BEFORE UPDATE ON mvr_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for mvr_results updated_at
DROP TRIGGER IF EXISTS update_mvr_results_updated_at ON mvr_results;
CREATE TRIGGER update_mvr_results_updated_at
  BEFORE UPDATE ON mvr_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7. TRIGGER - UPDATE DRIVER_PROFILES WHEN MVR COMPLETES
-- ============================================================
-- Automatically update driver_profiles when MVR results are received

CREATE OR REPLACE FUNCTION update_driver_profile_mvr()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if result_status is 'parsed' or 'reviewed'
  IF NEW.result_status IN ('parsed', 'reviewed') AND OLD.result_status != NEW.result_status THEN
    UPDATE driver_profiles
    SET
      mvr_result_id = NEW.id,
      mvr_order_id = (SELECT mvr_order_id FROM mvr_orders WHERE id = NEW.mvr_order_id),
      mvr_expires_at = (SELECT expires_at FROM mvr_orders WHERE id = NEW.mvr_order_id),
      mvr_license_status = NEW.license_status,
      mvr_total_points = NEW.total_points,
      mvr_violation_count = NEW.violation_count,
      mvr_last_ordered_at = (SELECT ordered_at FROM mvr_orders WHERE id = NEW.mvr_order_id),
      updated_at = NOW()
    WHERE id = NEW.driver_profile_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update driver_profiles when MVR results are parsed
DROP TRIGGER IF EXISTS update_driver_profile_mvr_trigger ON mvr_results;
CREATE TRIGGER update_driver_profile_mvr_trigger
  AFTER UPDATE OF result_status ON mvr_results
  FOR EACH ROW
  WHEN (NEW.result_status IN ('parsed', 'reviewed'))
  EXECUTE FUNCTION update_driver_profile_mvr();

-- ============================================================
-- 8. HELPER VIEW - COMPLETE MVR DATA
-- ============================================================
-- View that joins MVR orders and results for easy access

CREATE OR REPLACE VIEW complete_mvr_data AS
SELECT 
  mo.*,
  mr.license_number as result_license_number,
  mr.license_state as result_license_state,
  mr.license_class as result_license_class,
  mr.license_status as result_license_status,
  mr.license_expiration_date,
  mr.total_points,
  mr.violation_count,
  mr.accident_count,
  mr.suspension_count,
  mr.violations,
  mr.accidents,
  mr.suspensions,
  mr.medical_cert_expiration,
  mr.cdl_endorsements as result_cdl_endorsements,
  mr.cdl_restrictions as result_cdl_restrictions,
  mr.parsed_data,
  mr.received_at,
  mr.parsed_at,
  u.name as driver_name,
  u.email as driver_email,
  u.wallet_address as driver_wallet
FROM mvr_orders mo
LEFT JOIN mvr_results mr ON mo.id = mr.mvr_order_id
JOIN users u ON mo.driver_user_id = u.id;

COMMENT ON VIEW complete_mvr_data IS 'Complete MVR data with orders, results, and driver info joined';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- This migration adds MVR integration with Accio API.
-- 
-- What was added:
--   ✅ mvr_orders table for tracking MVR orders
--   ✅ mvr_results table for storing parsed MVR results
--   ✅ MVR fields added to driver_profiles table
--   ✅ Auto-update trigger to sync MVR data to driver_profiles
--   ✅ complete_mvr_data helper view
--   ✅ RLS policies for all new tables
--
-- Next steps:
--   1. Add Accio API credentials to environment variables
--   2. Create API routes for ordering MVRs
--   3. Create webhook endpoint for receiving results
--   4. Update profile completeness calculator to include MVR
--   5. Add UI components for MVR ordering and display
-- ============================================================

