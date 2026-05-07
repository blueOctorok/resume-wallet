-- ============================================================
-- MIGRATION 075: Rename employer-psp-orders → employer-psp-mvr-bundle
--
-- Business rule: PSP is never ordered without MVR. The bundle block
-- grants both capabilities; standalone employer-mvr-orders remains
-- for companies that only need MVR.
-- ============================================================

UPDATE employer_hub_blocks
SET block_type = 'employer-psp-mvr-bundle'
WHERE block_type = 'employer-psp-orders';

UPDATE employer_block_audit
SET block_type = 'employer-psp-mvr-bundle'
WHERE block_type = 'employer-psp-orders';
