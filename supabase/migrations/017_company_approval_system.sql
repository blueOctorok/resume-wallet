-- ============================================================
-- MIGRATION 017: Company Approval System
-- ============================================================
-- Date: February 2026
-- Purpose: Add admin approval workflow for employer companies
-- 
-- What This Adds:
--   1. Company status (pending/active/suspended)
--   2. Designated owner email for pre-assignment
--   3. Approval audit trail
--   4. Admin notes field
-- ============================================================

-- ============================================================
-- 1. ADD STATUS AND APPROVAL FIELDS TO COMPANIES
-- ============================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' 
    CHECK (status IN ('pending', 'active', 'suspended')),
  ADD COLUMN IF NOT EXISTS designated_owner_email TEXT,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Set existing companies to active (they're already approved implicitly)
UPDATE companies 
SET status = 'active', 
    approved_at = created_at
WHERE status IS NULL;

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_designated_owner ON companies(designated_owner_email) 
  WHERE designated_owner_email IS NOT NULL;

-- Comments
COMMENT ON COLUMN companies.status IS 'Company status: pending (awaiting approval), active (approved), suspended (disabled)';
COMMENT ON COLUMN companies.designated_owner_email IS 'Email of designated owner (for pre-created companies before owner logs in)';
COMMENT ON COLUMN companies.approved_by IS 'Admin user who approved the company';
COMMENT ON COLUMN companies.approved_at IS 'When the company was approved';
COMMENT ON COLUMN companies.suspended_by IS 'Admin user who suspended the company';
COMMENT ON COLUMN companies.suspension_reason IS 'Reason for suspension';
COMMENT ON COLUMN companies.admin_notes IS 'Internal admin notes about this company';
COMMENT ON COLUMN companies.onboarding_completed IS 'Whether company has completed setup (name, DOT, etc)';

-- ============================================================
-- 2. COMPANY APPROVAL HISTORY TABLE
-- ============================================================
-- Audit trail for all company status changes

CREATE TABLE IF NOT EXISTS company_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Status change
  previous_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  
  -- Who made the change
  changed_by UUID REFERENCES users(id),
  changed_by_type VARCHAR(20) DEFAULT 'admin' CHECK (changed_by_type IN ('admin', 'system', 'owner')),
  
  -- Details
  reason TEXT,
  notes TEXT,
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for history lookups
CREATE INDEX IF NOT EXISTS idx_company_status_history_company ON company_status_history(company_id);
CREATE INDEX IF NOT EXISTS idx_company_status_history_created ON company_status_history(created_at DESC);

-- Comments
COMMENT ON TABLE company_status_history IS 'Audit trail of company status changes (pending → active → suspended, etc.)';

-- ============================================================
-- 3. RLS FOR COMPANY STATUS HISTORY
-- ============================================================

ALTER TABLE company_status_history ENABLE ROW LEVEL SECURITY;

-- Only admins can view status history (service role bypasses RLS)
-- We don't create user-level policies since this is admin-only

-- ============================================================
-- 4. FUNCTION: Record status change
-- ============================================================

CREATE OR REPLACE FUNCTION record_company_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only record if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO company_status_history (
      company_id,
      previous_status,
      new_status,
      changed_by,
      changed_by_type,
      reason,
      notes
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      COALESCE(NEW.approved_by, NEW.suspended_by),
      'admin',
      CASE 
        WHEN NEW.status = 'suspended' THEN NEW.suspension_reason
        ELSE NULL
      END,
      NEW.admin_notes
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-record status changes
DROP TRIGGER IF EXISTS trigger_company_status_change ON companies;
CREATE TRIGGER trigger_company_status_change
  AFTER UPDATE OF status ON companies
  FOR EACH ROW
  EXECUTE FUNCTION record_company_status_change();

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- 
-- What was added:
--   ✅ companies.status (pending/active/suspended)
--   ✅ companies.designated_owner_email for pre-assignment
--   ✅ Approval audit fields (approved_by, approved_at)
--   ✅ Suspension fields (suspended_by, suspended_at, reason)
--   ✅ company_status_history table for audit trail
--   ✅ Auto-record trigger for status changes
--
-- Admin Flow:
--   1. Pre-create company with designated_owner_email
--   2. Set status = 'active' (pre-approved)
--   3. When owner logs in, they're auto-linked
--
--   OR
--
--   1. Employer self-registers, company status = 'pending'
--   2. Admin reviews in Central Admin
--   3. Admin approves → status = 'active'
--
-- ============================================================
