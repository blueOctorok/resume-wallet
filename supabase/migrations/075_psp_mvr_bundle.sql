-- ============================================================
-- MIGRATION 075: PSP+MVR bundle rename + employer block RLS for all members
--
-- 1. Rename employer-psp-orders → employer-psp-mvr-bundle (PSP never ordered alone)
-- 2. Loosen employer_hub_blocks RLS from owner/admin to any active company member
--    (removing a block hides UI only — paid data is always preserved)
-- ============================================================

-- ── 1. Rename block type ──────────────────────────────────────
UPDATE employer_hub_blocks
SET block_type = 'employer-psp-mvr-bundle'
WHERE block_type = 'employer-psp-orders';

UPDATE employer_block_audit
SET block_type = 'employer-psp-mvr-bundle'
WHERE block_type = 'employer-psp-orders';

-- ── 2. Loosen employer_hub_blocks RLS: any active member can manage ──
DROP POLICY IF EXISTS "Company admins can add employer blocks" ON employer_hub_blocks;
DROP POLICY IF EXISTS "Company admins can update employer blocks" ON employer_hub_blocks;
DROP POLICY IF EXISTS "Company admins can remove employer blocks" ON employer_hub_blocks;

CREATE POLICY "Company members can add employer blocks"
  ON employer_hub_blocks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members m
      WHERE m.company_id = employer_hub_blocks.company_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = employer_hub_blocks.company_id
        AND c.employer_user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can update employer blocks"
  ON employer_hub_blocks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_members m
      WHERE m.company_id = employer_hub_blocks.company_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = employer_hub_blocks.company_id
        AND c.employer_user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can remove employer blocks"
  ON employer_hub_blocks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_members m
      WHERE m.company_id = employer_hub_blocks.company_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = employer_hub_blocks.company_id
        AND c.employer_user_id = auth.uid()
    )
  );
