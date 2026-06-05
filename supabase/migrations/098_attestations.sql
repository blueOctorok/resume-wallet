-- ============================================================
-- MIGRATION 098: attestations — Phase 2 selective-disclosure store
-- ============================================================
-- P2.1: Immutable signed-fact artifacts (JWT now, ZK swap later).
-- Append-only from the client; supersede via superseded_by (service role).
-- Phase-4 forward-compat: valid_until, source_cra, source_pull_id, query_count.
-- Apply via Supabase dashboard on remote (same as 097).
-- ============================================================

CREATE TABLE IF NOT EXISTS attestations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fact_type         TEXT NOT NULL,
  fact_summary      TEXT NOT NULL,
  disclosed_fields  JSONB NOT NULL DEFAULT '{}'::jsonb,
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ,
  -- Phase-4 cached-attestation marketplace (DEC-2026-05-013): freshness cliff
  valid_until       TIMESTAMPTZ,
  source_cra        TEXT,
  source_pull_id    TEXT,
  audience_id       UUID REFERENCES companies(id) ON DELETE SET NULL,
  proof_artifact    JSONB NOT NULL,
  superseded_by     UUID REFERENCES attestations(id) ON DELETE SET NULL,
  query_count       INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hot path: latest attestation per candidate + fact type
CREATE INDEX IF NOT EXISTS attestations_candidate_idx
  ON attestations (candidate_user_id, fact_type);

-- Current (unsuperseded) rows only — proveFact cache reads
CREATE INDEX IF NOT EXISTS attestations_candidate_current_idx
  ON attestations (candidate_user_id, fact_type)
  WHERE superseded_by IS NULL;

-- Audience-scoped carrier reads
CREATE INDEX IF NOT EXISTS attestations_audience_idx
  ON attestations (audience_id)
  WHERE audience_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS attestations_issued_at_idx
  ON attestations (issued_at DESC);

COMMENT ON TABLE attestations IS
  'Immutable selective-disclosure artifacts. Phase 2: signed JWT in proof_artifact. Never UPDATE from clients — supersede by inserting a new row and linking via superseded_by (service role).';

COMMENT ON COLUMN attestations.disclosed_fields IS
  'Selectively-disclosed fact surface shown to the audience — not the underlying record bytes.';

COMMENT ON COLUMN attestations.proof_artifact IS
  'Verifiable artifact: Phase 2 {kind: signed_jwt, jwt, issuer}; Phase 3 {kind: midnight_zk, txHash, proofId}.';

COMMENT ON COLUMN attestations.valid_until IS
  'Phase-4 forward-compat: freshness window for cached re-query marketplace (e.g. MVR valid_until = pull + 30d).';

COMMENT ON COLUMN attestations.source_cra IS
  'Originating CRA/vendor (e.g. accio). Storm is not the CRA — provenance citation only.';

COMMENT ON COLUMN attestations.source_pull_id IS
  'Vendor order / pull id tying this attestation to a specific third-party screening.';

COMMENT ON COLUMN attestations.query_count IS
  'Phase-4 forward-compat: how many times verifyAttestation was called for this row.';

COMMENT ON COLUMN attestations.superseded_by IS
  'When set, this row is replaced by the attestation with this id. Set by service role only.';

ALTER TABLE attestations ENABLE ROW LEVEL SECURITY;

-- Candidates read every attestation issued about themselves (audit + disclosure UI).
CREATE POLICY "Candidates read own attestations"
  ON attestations FOR SELECT
  USING (candidate_user_id = auth.uid());

-- Company members read attestations scoped to their employer audience.
CREATE POLICY "Employers read audience-scoped attestations"
  ON attestations FOR SELECT
  USING (
    audience_id IS NOT NULL
    AND audience_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- No INSERT / UPDATE / DELETE policies for authenticated users.
-- Issuance, supersede (superseded_by), and query_count bumps use service-role client.
