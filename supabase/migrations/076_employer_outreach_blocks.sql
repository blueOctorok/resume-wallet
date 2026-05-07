-- ============================================================
-- MIGRATION 076: Seed employer outreach blocks for Pace Drivers
--
-- NOTE: Originally seeded `employer-talent-outreach`, which was later
-- split in migration 077. This file is kept consistent with the final
-- block IDs so a fresh install lands in the right state without the
-- intermediate rename. If 076 already ran on your DB, 077 handles the
-- migration.
--
-- Pace Drivers gets:
--   employer-resume-requests → Resume request capability
--   employer-dot-screening   → DOT Application request capability
--
-- Pace does NOT get employer-portfolio-requests (driver staffing
-- agency — no developer hiring) or PSP/MVR blocks (already seeded
-- in earlier migrations).
-- ============================================================

INSERT INTO employer_hub_blocks (company_id, block_type, position)
SELECT c.id, 'employer-resume-requests', -10
FROM companies c
WHERE c.company_name ILIKE 'Pace Drivers'
LIMIT 1
ON CONFLICT (company_id, block_type) DO NOTHING;

INSERT INTO employer_hub_blocks (company_id, block_type, position)
SELECT c.id, 'employer-dot-screening', -5
FROM companies c
WHERE c.company_name ILIKE 'Pace Drivers'
LIMIT 1
ON CONFLICT (company_id, block_type) DO NOTHING;
