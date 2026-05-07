-- ============================================================
-- MIGRATION 077: Split employer-talent-outreach into 1:1 blocks
--
-- Why: The original `employer-talent-outreach` block gated BOTH resume
-- AND portfolio requests with one employer block. That broke the
-- "installed blocks mirror outreach options" contract — a driver
-- staffing employer like Pace would install talent-outreach for
-- resumes and unintentionally see "Portfolio" (a developer concept)
-- in their candidate outreach dropdown.
--
-- Now each candidate-requestable block has its own employer block:
--   employer-resume-requests    → Resume request (universal)
--   employer-portfolio-requests → Portfolio request (developer-focused)
--   employer-dot-screening      → DOT App request (drivers, unchanged)
--   employer-mvr-orders         → MVR (unchanged)
--   employer-psp-mvr-bundle     → MVR + PSP (unchanged)
--
-- Idempotent strategy:
--   1. Drop talent-outreach rows for companies that ALREADY have
--      resume-requests installed (avoids unique-constraint collision
--      if the new block was installed via the UI before this ran).
--   2. Rename remaining talent-outreach rows → resume-requests.
--   3. Same two-step pattern on the audit table.
--
-- Resume is the universal default; Portfolio is opt-in per company.
-- Driver-focused companies (Pace) stay driver-pure.
-- ============================================================

-- Step 1: hub_blocks ───────────────────────────────────────────────────────

DELETE FROM employer_hub_blocks
WHERE block_type = 'employer-talent-outreach'
  AND company_id IN (
    SELECT company_id
    FROM employer_hub_blocks
    WHERE block_type = 'employer-resume-requests'
  );

UPDATE employer_hub_blocks
SET block_type = 'employer-resume-requests'
WHERE block_type = 'employer-talent-outreach';

-- Step 2: audit trail ─────────────────────────────────────────────────────
-- The audit table is append-only history; we rename instead of delete so
-- the timeline of installs/removals reads consistently against the new
-- block ID.

UPDATE employer_block_audit
SET block_type = 'employer-resume-requests'
WHERE block_type = 'employer-talent-outreach';

-- Step 3: Remove employer-resume-requests entirely ────────────────────────
-- storm-resume is a core block auto-installed on every candidate's hub,
-- so requesting it is redundant. No employer block should gate it.

DELETE FROM employer_hub_blocks
WHERE block_type = 'employer-resume-requests';

-- Keep audit rows — they're historical records of install/remove actions.
-- The block just won't appear in the registry anymore.
