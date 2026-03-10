-- ============================================================
-- SCRIPT: Cleanup Test / Orphan Data
-- ============================================================
-- ⚠️  NOT A SCHEMA MIGRATION — do NOT run via Supabase migration pipeline.
-- ⚠️  Run manually in the Supabase SQL editor when you need to purge test data.
-- ⚠️  This script DELETES rows. Always review before running in production.
--
-- Originally created: February 2026
-- Purpose: Remove orphan "My Company" placeholder records created before
--          the inline company name form was added.
-- ============================================================

-- ============================================================
-- 1. DELETE ORPHAN "My Company" RECORDS
-- ============================================================
-- Criteria for deletion:
--   - Company name is exactly "My Company" (the old placeholder)
--   - No jobs posted
--   - No team members (besides possibly the owner)

-- First, preview what will be deleted — run this SELECT alone to verify.
SELECT c.id, c.company_name, c.created_at
FROM companies c
WHERE c.company_name = 'My Company'
  AND NOT EXISTS (SELECT 1 FROM job_postings jp WHERE jp.company_id = c.id)
  AND (
    NOT EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = c.id)
    OR (SELECT COUNT(*) FROM company_members cm WHERE cm.company_id = c.id) <= 1
  );

-- Delete company_members first (FK constraint)
DELETE FROM company_members
WHERE company_id IN (
  SELECT c.id FROM companies c
  WHERE c.company_name = 'My Company'
    AND NOT EXISTS (SELECT 1 FROM job_postings jp WHERE jp.company_id = c.id)
    AND (
      NOT EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = c.id)
      OR (SELECT COUNT(*) FROM company_members cm WHERE cm.company_id = c.id) <= 1
    )
);

-- Delete status history (FK constraint)
DELETE FROM company_status_history
WHERE company_id IN (
  SELECT c.id FROM companies c
  WHERE c.company_name = 'My Company'
    AND NOT EXISTS (SELECT 1 FROM job_postings jp WHERE jp.company_id = c.id)
);

-- Delete the orphan companies
DELETE FROM companies
WHERE company_name = 'My Company'
  AND NOT EXISTS (SELECT 1 FROM job_postings jp WHERE jp.company_id = companies.id);

-- ============================================================
-- 2. CLEANUP SPECIFIC TEST WALLET (optional — uncomment + edit)
-- ============================================================
-- Use this if you need to wipe a specific wallet's data during testing.
-- Replace the wallet address below before running.

-- DELETE FROM users WHERE lower(wallet_address) = lower('0xYOUR_TEST_WALLET_HERE');
