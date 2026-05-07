-- ============================================================
-- MIGRATION 076: Seed employer outreach blocks for Pace Drivers
--
-- Pace Drivers gets:
--   employer-dot-screening → DOT Application request capability
--
-- Resume is NOT seeded as an employer block — storm-resume is a
-- core block auto-installed on every candidate's hub, so there's
-- nothing to "request." PSP/MVR blocks were already seeded in
-- earlier migrations.
-- ============================================================

INSERT INTO employer_hub_blocks (company_id, block_type, position)
SELECT c.id, 'employer-dot-screening', -5
FROM companies c
WHERE c.company_name ILIKE 'Pace Drivers'
LIMIT 1
ON CONFLICT (company_id, block_type) DO NOTHING;
