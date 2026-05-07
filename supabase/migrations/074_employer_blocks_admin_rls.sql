-- ============================================================
-- MIGRATION 074: Employer hub blocks — admin/owner RLS + audit + Pace seed
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Append-only audit log (install / remove). Service-role APIs write rows.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employer_block_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('installed', 'removed')),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('storm_admin', 'company_owner', 'company_admin')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employer_block_audit_company_created
  ON employer_block_audit(company_id, created_at DESC);

COMMENT ON TABLE employer_block_audit IS 'Append-only log of employer hub block installs/removals (compliance / ops).';

ALTER TABLE employer_block_audit ENABLE ROW LEVEL SECURITY;
-- No policies: JWT roles cannot read/write; service role (Next.js admin client) bypasses RLS.

-- ----------------------------------------------------------------
-- 2. Tighten employer_hub_blocks mutations to owner/admin only (+ legacy company owner)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Company members can add employer blocks" ON employer_hub_blocks;
DROP POLICY IF EXISTS "Company members can update employer blocks" ON employer_hub_blocks;
DROP POLICY IF EXISTS "Company members can remove employer blocks" ON employer_hub_blocks;

CREATE POLICY "Company admins can add employer blocks"
  ON employer_hub_blocks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members m
      WHERE m.company_id = employer_hub_blocks.company_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
        AND m.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = employer_hub_blocks.company_id
        AND c.employer_user_id = auth.uid()
    )
  );

CREATE POLICY "Company admins can update employer blocks"
  ON employer_hub_blocks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_members m
      WHERE m.company_id = employer_hub_blocks.company_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
        AND m.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = employer_hub_blocks.company_id
        AND c.employer_user_id = auth.uid()
    )
  );

CREATE POLICY "Company admins can remove employer blocks"
  ON employer_hub_blocks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_members m
      WHERE m.company_id = employer_hub_blocks.company_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
        AND m.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = employer_hub_blocks.company_id
        AND c.employer_user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 3. Seed Pace Drivers with MVR + PSP employer blocks (idempotent)
-- ----------------------------------------------------------------
INSERT INTO employer_hub_blocks (company_id, block_type, position)
SELECT c.id, 'employer-mvr-orders', 0
FROM companies c
WHERE c.company_name ILIKE 'Pace Drivers'
LIMIT 1
ON CONFLICT (company_id, block_type) DO NOTHING;

INSERT INTO employer_hub_blocks (company_id, block_type, position)
SELECT c.id, 'employer-psp-orders', 1
FROM companies c
WHERE c.company_name ILIKE 'Pace Drivers'
LIMIT 1
ON CONFLICT (company_id, block_type) DO NOTHING;
