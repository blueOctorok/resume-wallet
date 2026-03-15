-- ============================================================
-- MIGRATION 037: Employer Composable Hub — employer_hub_blocks
-- ============================================================
-- Date: March 2026
--
-- Context:
--   Extending the composable hub pattern to employers. Universal
--   employer features (Kanban, jobs, team, outreach) stay permanent.
--   Industry-specific tools (MVR ordering, DOT compliance, driver
--   search, compliance reports, employment verification) become
--   composable blocks that employers add based on their hiring needs.
--
-- Scoped to company_id (not user_id) so all team members in a
-- company share the same set of installed employer blocks.
-- ============================================================


-- ============================================================
-- 1. EMPLOYER_HUB_BLOCKS
-- ============================================================

CREATE TABLE IF NOT EXISTS employer_hub_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- References employer-block-registry.ts definitions.
  -- Examples: 'employer-mvr-ordering', 'employer-dot-compliance'
  block_type  TEXT NOT NULL,

  position    INTEGER NOT NULL DEFAULT 0,

  -- Optional block-level config. E.g. custom thresholds for reports.
  config      JSONB NOT NULL DEFAULT '{}',

  added_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- One instance of each block type per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_employer_hub_blocks_company_type
  ON employer_hub_blocks(company_id, block_type);

CREATE INDEX IF NOT EXISTS idx_employer_hub_blocks_company_position
  ON employer_hub_blocks(company_id, position ASC);

ALTER TABLE employer_hub_blocks ENABLE ROW LEVEL SECURITY;

-- Company members can read their company's blocks.
-- RLS uses the company_members table to check membership.
CREATE POLICY "Company members can view employer blocks"
  ON employer_hub_blocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = employer_hub_blocks.company_id
        AND company_members.user_id = auth.uid()
        AND company_members.is_active = true
    )
  );

CREATE POLICY "Company members can add employer blocks"
  ON employer_hub_blocks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = employer_hub_blocks.company_id
        AND company_members.user_id = auth.uid()
        AND company_members.is_active = true
    )
  );

CREATE POLICY "Company members can update employer blocks"
  ON employer_hub_blocks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = employer_hub_blocks.company_id
        AND company_members.user_id = auth.uid()
        AND company_members.is_active = true
    )
  );

CREATE POLICY "Company members can remove employer blocks"
  ON employer_hub_blocks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = employer_hub_blocks.company_id
        AND company_members.user_id = auth.uid()
        AND company_members.is_active = true
    )
  );

COMMENT ON TABLE employer_hub_blocks IS 'Composable employer hub: industry-specific tool blocks installed per company.';
COMMENT ON COLUMN employer_hub_blocks.block_type IS 'Block type id from employer-block-registry.ts. E.g. employer-mvr-ordering, employer-dot-compliance.';
COMMENT ON COLUMN employer_hub_blocks.position IS 'Display order (ascending) in the employer hub block grid.';


-- ============================================================
-- 2. Add hiring_categories to companies table
-- ============================================================
-- Stores what the company hires for (drivers, developers, etc.)
-- Used by the block registry to suggest relevant employer blocks.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS hiring_categories TEXT[] DEFAULT '{}';

COMMENT ON COLUMN companies.hiring_categories IS 'What this company hires for. E.g. {drivers, developers, warehouse}. Used to suggest employer blocks.';


-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
