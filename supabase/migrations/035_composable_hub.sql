-- ============================================================
-- MIGRATION 035: Composable Hub — hub_blocks + hub_onboarding
-- ============================================================
-- Date: March 2026
--
-- Context:
--   StormChain is moving away from role-specific hubs (DriverHub,
--   DeveloperHub) toward a single composable candidate hub. Instead
--   of a pre-filled dashboard, every candidate starts with an empty
--   hub and builds it by adding "blocks" — self-contained feature
--   units (DOT application, MVR, driver resume, portfolio, etc.).
--
--   This is the only net-new schema required for the composable hub.
--   All existing tables (driver_applications, resumes, mvr_orders,
--   developer_profiles, etc.) remain unchanged — they serve as the
--   backing data stores for their respective blocks.
--
-- Tables:
--   1. hub_blocks     — which blocks a candidate has added, in what order
--   2. hub_onboarding — mandatory context form (who they are, why here)
--                       AvA uses this to suggest which blocks to add
-- ============================================================


-- ============================================================
-- 1. HUB_BLOCKS
-- ============================================================
-- Each row is one block installed in a candidate's hub.
-- block_type references the frontend block registry (block-registry.ts).
-- position controls render order — lower numbers appear first.
-- config stores optional block-level settings (e.g. which resume
-- sections to show).
--
-- Unique constraint on (user_id, block_type): a user can only have
-- one instance of each block type. You don't add two DOT app blocks.
-- ============================================================

CREATE TABLE IF NOT EXISTS hub_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- References the block type id from the frontend block registry.
  -- Examples: 'driver-dot-application', 'driver-mvr', 'driver-resume',
  --           'developer-portfolio', 'developer-github', 'general-skills'
  block_type  TEXT NOT NULL,

  -- Controls display order in the hub (ascending). Updated on drag-drop reorder.
  position    INTEGER NOT NULL DEFAULT 0,

  -- Optional block-level config (kept minimal — blocks own their real data
  -- in their own tables). E.g. { "showSummary": true }
  config      JSONB NOT NULL DEFAULT '{}',

  added_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prevent duplicate block types per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_blocks_user_type
  ON hub_blocks(user_id, block_type);

-- Fast lookup of all blocks for a user, pre-sorted
CREATE INDEX IF NOT EXISTS idx_hub_blocks_user_position
  ON hub_blocks(user_id, position ASC);

ALTER TABLE hub_blocks ENABLE ROW LEVEL SECURITY;

-- Candidates can only see and manage their own blocks
CREATE POLICY "Candidates can view own hub blocks"
  ON hub_blocks FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Candidates can add hub blocks"
  ON hub_blocks FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Candidates can update own hub blocks"
  ON hub_blocks FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Candidates can remove hub blocks"
  ON hub_blocks FOR DELETE
  USING (user_id = auth.uid());

COMMENT ON TABLE hub_blocks IS 'Composable hub: tracks which blocks each candidate has installed and their display order.';
COMMENT ON COLUMN hub_blocks.block_type IS 'Block type id from the frontend block registry. E.g. driver-dot-application, developer-portfolio.';
COMMENT ON COLUMN hub_blocks.position IS 'Display order (ascending). Updated when user reorders via drag-and-drop.';
COMMENT ON COLUMN hub_blocks.config IS 'Block-level display config. Minimal — real data lives in domain tables (driver_applications, resumes, etc.).';


-- ============================================================
-- 2. HUB_ONBOARDING
-- ============================================================
-- One row per candidate. Stores the answers from the mandatory
-- short context form shown on first hub visit:
--   "What do you do?" (occupation)
--   "Why are you here?" (seeking_reason)
--
-- AvA reads this to suggest which block categories are relevant.
-- suggested_categories is populated by AvA after the form is
-- submitted and stored so the block picker can pre-filter.
--
-- One row per user — upsert on resubmit (users can edit context later).
-- ============================================================

CREATE TABLE IF NOT EXISTS hub_onboarding (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Free-text answers from the context form
  occupation            TEXT NOT NULL,        -- e.g. "CDL-A truck driver", "React developer"
  seeking_reason        TEXT NOT NULL,        -- e.g. "Looking for regional routes", "Building portfolio"

  -- Block category ids AvA suggested based on occupation + reason
  -- e.g. ['drivers', 'general'] or ['developers', 'general']
  suggested_categories  TEXT[] DEFAULT '{}',

  completed_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_onboarding_user
  ON hub_onboarding(user_id);

ALTER TABLE hub_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Candidates can view own onboarding"
  ON hub_onboarding FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Candidates can insert own onboarding"
  ON hub_onboarding FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Candidates can update own onboarding"
  ON hub_onboarding FOR UPDATE
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_hub_onboarding_updated_at ON hub_onboarding;
CREATE TRIGGER update_hub_onboarding_updated_at
  BEFORE UPDATE ON hub_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE hub_onboarding IS 'Mandatory context form for new candidates. AvA uses occupation + seeking_reason to suggest block categories.';
COMMENT ON COLUMN hub_onboarding.occupation IS 'Free-text: what the candidate does. E.g. CDL-A truck driver, React developer, airline pilot.';
COMMENT ON COLUMN hub_onboarding.seeking_reason IS 'Free-text: why they joined. E.g. Looking for regional routes, building a verifiable portfolio.';
COMMENT ON COLUMN hub_onboarding.suggested_categories IS 'Block category ids AvA suggested. Stored so the block picker can pre-filter on first open.';


-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- What's next (frontend):
--   - src/lib/block-registry.ts   — static block catalog + categories
--   - src/stores/hub-blocks-store.ts — Zustand store for hub blocks
--   - src/app/api/hub/blocks/      — CRUD API routes
--   - src/app/api/hub/onboarding/  — onboarding form API route
--   - src/components/app/CandidateShell.tsx
--   - src/components/hub/BlockPickerModal.tsx
--   - src/components/hub/HubOnboardingForm.tsx
-- ============================================================
