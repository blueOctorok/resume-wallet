-- ============================================================
-- MIGRATION 076: Seed new employer outreach blocks for Pace Drivers
--
-- Two new employer blocks gate candidate outreach:
--   employer-talent-outreach → Resume + Portfolio requests
--   employer-dot-screening   → DOT Application requests
--
-- Pace Drivers needs both so their existing outreach workflows
-- continue working after the block-gating change.
-- ============================================================

INSERT INTO employer_hub_blocks (company_id, block_type, position)
SELECT c.id, 'employer-talent-outreach', -10
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
