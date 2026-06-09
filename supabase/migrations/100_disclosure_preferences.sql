-- ============================================================
-- MIGRATION 100: disclosure_preferences — P2.6 selective disclosure
-- ============================================================
-- Candidate-controlled per-audience fact sharing. Default: shareable (no row).
-- Rows with allowed = false hide a fact from that employer's verify/list path.
-- Apply via Supabase dashboard on remote (same as 098/099).
-- ============================================================

CREATE TABLE IF NOT EXISTS disclosure_preferences (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  audience_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fact_type           TEXT NOT NULL,
  allowed             BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (candidate_user_id, audience_id, fact_type)
);

CREATE INDEX IF NOT EXISTS disclosure_preferences_candidate_idx
  ON disclosure_preferences (candidate_user_id);

CREATE INDEX IF NOT EXISTS disclosure_preferences_audience_idx
  ON disclosure_preferences (candidate_user_id, audience_id);

COMMENT ON TABLE disclosure_preferences IS
  'Candidate per-employer fact sharing toggles. Absence of a row means allowed (default shareable). allowed=false hides attestations from that audience.';

ALTER TABLE disclosure_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Candidates manage own disclosure preferences"
  ON disclosure_preferences FOR ALL
  USING (candidate_user_id = auth.uid())
  WITH CHECK (candidate_user_id = auth.uid());

-- Service role (proveFact enforcement, employer list filtering) bypasses RLS.
