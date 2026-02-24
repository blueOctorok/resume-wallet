-- ============================================================
-- Cleanup: Remove stale "My Company" placeholder records
--
-- These were created by the old /api/user/profile route which
-- auto-inserted a "My Company" row for any employer without a
-- company. Run this once in the Supabase SQL editor.
--
-- SAFE: only deletes companies with no accepted members,
-- no job postings, and no applications.
-- ============================================================

-- Preview what will be deleted first:
SELECT id, company_name, employer_user_id, created_at
FROM companies
WHERE company_name = 'My Company'
  AND NOT EXISTS (
    SELECT 1 FROM job_postings jp WHERE jp.company_id = companies.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = companies.id
      AND cm.accepted_at IS NOT NULL
  );

-- If the preview looks right, run the DELETE:
-- (Uncomment the block below to execute)

/*
DELETE FROM companies
WHERE company_name = 'My Company'
  AND NOT EXISTS (
    SELECT 1 FROM job_postings jp WHERE jp.company_id = companies.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = companies.id
      AND cm.accepted_at IS NOT NULL
  );
*/
