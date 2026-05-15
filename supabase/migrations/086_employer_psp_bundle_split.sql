-- ============================================================
-- MIGRATION 086: Employer blocks — PSP+MVR bundle → PSP + screening consent
-- ============================================================
-- Every company that could order screenings needs employer-screening-consent.
-- Companies that had the bundle get employer-psp-orders + keep MVR capability.
-- ============================================================

-- 1) Install screening consent for any company with driver screening employer blocks
INSERT INTO employer_hub_blocks (company_id, block_type, position, added_at)
SELECT DISTINCT ehb.company_id,
  'employer-screening-consent',
  COALESCE((SELECT MIN(position) - 1 FROM employer_hub_blocks i WHERE i.company_id = ehb.company_id), 0),
  NOW()
FROM employer_hub_blocks ehb
WHERE ehb.block_type IN ('employer-mvr-orders', 'employer-psp-mvr-bundle')
  AND NOT EXISTS (
    SELECT 1 FROM employer_hub_blocks x
    WHERE x.company_id = ehb.company_id AND x.block_type = 'employer-screening-consent'
  );

-- 2) Bundle → standalone PSP orders block (same row, new type)
UPDATE employer_hub_blocks
SET block_type = 'employer-psp-orders'
WHERE block_type = 'employer-psp-mvr-bundle';

-- 3) Companies that only had the bundle had implied MVR — add standalone MVR block if missing
INSERT INTO employer_hub_blocks (company_id, block_type, position, added_at)
SELECT DISTINCT ehb.company_id,
  'employer-mvr-orders',
  COALESCE((SELECT MAX(position) + 1 FROM employer_hub_blocks i WHERE i.company_id = ehb.company_id), 0),
  NOW()
FROM employer_hub_blocks ehb
WHERE ehb.block_type = 'employer-psp-orders'
  AND NOT EXISTS (
    SELECT 1 FROM employer_hub_blocks x
    WHERE x.company_id = ehb.company_id AND x.block_type = 'employer-mvr-orders'
  );
