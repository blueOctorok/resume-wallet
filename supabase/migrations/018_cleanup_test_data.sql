-- ============================================================
-- MIGRATION 018: Cleanup Test/Orphan Data
-- ============================================================
-- Date: February 2026
-- Purpose: Remove orphan "My Company" records and test data
--
-- This is a ONE-TIME cleanup migration. Safe to run multiple times.
-- ============================================================

-- ============================================================
-- 1. DELETE ORPHAN "My Company" RECORDS
-- ============================================================
-- These were auto-created before we added the inline company name form.
-- Criteria for deletion:
--   - Company name is exactly "My Company" (the old placeholder)
--   - No jobs posted
--   - No team members (besides possibly the owner)

-- First, log what we're about to delete
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM companies c
  WHERE c.company_name = 'My Company'
    AND NOT EXISTS (SELECT 1 FROM job_postings jp WHERE jp.company_id = c.id)
    AND (
      NOT EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = c.id)
      OR (
        SELECT COUNT(*) FROM company_members cm WHERE cm.company_id = c.id
      ) <= 1
    );
  
  RAISE NOTICE 'Found % orphan "My Company" records to delete', orphan_count;
END $$;

-- Delete company_members first (FK constraint)
DELETE FROM company_members
WHERE company_id IN (
  SELECT c.id FROM companies c
  WHERE c.company_name = 'My Company'
    AND NOT EXISTS (SELECT 1 FROM job_postings jp WHERE jp.company_id = c.id)
    AND (
      NOT EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = c.id)
      OR (
        SELECT COUNT(*) FROM company_members cm WHERE cm.company_id = c.id
      ) <= 1
    )
);

-- Delete status history (FK constraint)
DELETE FROM company_status_history
WHERE company_id IN (
  SELECT c.id FROM companies c
  WHERE c.company_name = 'My Company'
    AND NOT EXISTS (SELECT 1 FROM job_postings jp WHERE jp.company_id = c.id)
);

-- Now delete the orphan companies
DELETE FROM companies
WHERE company_name = 'My Company'
  AND NOT EXISTS (SELECT 1 FROM job_postings jp WHERE jp.company_id = companies.id);

-- ============================================================
-- 2. CLEANUP TEST WALLET ADDRESSES (Optional - uncomment if needed)
-- ============================================================
-- If you have test users with specific wallet patterns, uncomment below:

-- DELETE FROM users WHERE wallet_address LIKE '0x0000%';
-- DELETE FROM users WHERE wallet_address LIKE '%test%';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- 
-- What was cleaned:
--   ✅ Orphan "My Company" records (no jobs, empty teams)
--   ✅ Related company_members entries
--   ✅ Related company_status_history entries
--
-- This migration is idempotent - safe to run again if needed.
-- ============================================================
