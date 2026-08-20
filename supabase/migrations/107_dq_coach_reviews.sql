-- ============================================================
-- MIGRATION 107: dq_coach_reviews — File watcher cache
-- ============================================================
-- Hash of the DQ snapshot + last Haiku/heuristic brief.
-- Same hash → skip Anthropic. Not block data; API uses service role.
-- ============================================================

CREATE TABLE IF NOT EXISTS dq_coach_reviews (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  snapshot_hash   TEXT NOT NULL,
  review          JSONB NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE dq_coach_reviews IS
  'Cached File-tab DQ review. snapshot_hash is sha256 of the clerk snapshot; match skips Haiku.';

ALTER TABLE dq_coach_reviews ENABLE ROW LEVEL SECURITY;
