-- ============================================================
-- MIGRATION 110: EV consent stack (Track B legal artifacts)
-- ============================================================
-- Three versioned clickwrap artifacts around the employment-verification
-- packet (docs/EV_CONSENT_STACK.md):
--   1. ev_authorizations       — driver disclosure + authorization to route
--                                (PROVVEN-EV-DISC-AUTH-B-0.1). Hard gate on
--                                outbound send (initiate-self).
--   2. ev_share_requests       — employer per-request clickwrap
--                                (PROVVEN-EV-EMP-SHARE-REQ-0.1). Creates a
--                                pending state only; never unlocks view.
--   3. ev_share_grants         — driver Step 6 formal acknowledgment
--                                (PROVVEN-EV-SHARE-ACK-6-0.1). The ONLY thing
--                                that unlocks employer EV view. Revocable.
--   4. ev_access_log           — append-only employer view audit.
-- Each artifact stores document_version + sha256 of the exact text shown,
-- UTC timestamp, and IP / user-agent metadata as counsel directs.
-- ============================================================

-- ── 1. Driver authorization to route (PDF 1) ────────────────────────────────

CREATE TABLE IF NOT EXISTS ev_authorizations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  document_version      TEXT NOT NULL,          -- e.g. 'PROVVEN-EV-DISC-AUTH-B-0.1'
  document_sha256       TEXT NOT NULL,          -- hash of the exact text shown
  signed_name           TEXT NOT NULL,          -- typed signature from the auth paper
  disclosure_viewed_at  TIMESTAMPTZ NOT NULL,   -- Screen A fully viewed
  authorized_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- Screen B checkbox + control

  -- Prior employer(s) targeted at authorization time (name/contact snapshot).
  employer_targets      JSONB NOT NULL DEFAULT '[]'::jsonb,

  ip_address            TEXT,
  user_agent            TEXT,
  checkbox_event_id     TEXT,                   -- client control event id

  status                TEXT NOT NULL DEFAULT 'active'
    CONSTRAINT ev_authorizations_status_check
    CHECK (status IN ('active', 'withdrawn', 'superseded')),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ev_authorizations_driver_idx
  ON ev_authorizations (driver_user_id, status);

COMMENT ON TABLE ev_authorizations IS
  'Driver disclosure + authorization artifact gating outbound EV routing (Track B PDF 1).';

-- Every routed packet points at the authorization that permitted it.
ALTER TABLE employment_verification_requests
  ADD COLUMN IF NOT EXISTS ev_authorization_id UUID REFERENCES ev_authorizations(id) ON DELETE SET NULL;

-- ── 2. Employer share-request clickwrap (PDF 3) ─────────────────────────────

CREATE TABLE IF NOT EXISTS ev_share_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requesting_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Application / requisition context (required by the clickwrap — named
  -- candidate + current hiring need; no browse).
  application_context   TEXT NOT NULL,

  -- v0.1 default is proof; 'full' kept in schema for the product config toggle.
  payload_type          TEXT NOT NULL DEFAULT 'proof'
    CONSTRAINT ev_share_requests_payload_check
    CHECK (payload_type IN ('proof', 'full')),

  document_version      TEXT NOT NULL,          -- 'PROVVEN-EV-EMP-SHARE-REQ-0.1'
  document_sha256       TEXT NOT NULL,
  certified_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address            TEXT,
  user_agent            TEXT,
  checkbox_event_id     TEXT,

  status                TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT ev_share_requests_status_check
    CHECK (status IN ('pending', 'authorized', 'declined', 'revoked', 'expired')),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ev_share_requests_driver_idx
  ON ev_share_requests (driver_user_id, status);

CREATE INDEX IF NOT EXISTS ev_share_requests_company_idx
  ON ev_share_requests (company_id, driver_user_id);

COMMENT ON TABLE ev_share_requests IS
  'Employer per-request clickwrap artifact (Track B PDF 3). Creating a row only opens a pending driver-authorization state — it must never unlock EV view endpoints.';

-- ── 3. Driver Step 6 share grant (PDF 2) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS ev_share_grants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_request_id      UUID NOT NULL REFERENCES ev_share_requests(id) ON DELETE CASCADE,
  driver_user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  document_version      TEXT NOT NULL,          -- 'PROVVEN-EV-SHARE-ACK-6-0.1'
  document_sha256       TEXT NOT NULL,
  payload_type          TEXT NOT NULL DEFAULT 'proof'
    CONSTRAINT ev_share_grants_payload_check
    CHECK (payload_type IN ('proof', 'full')),

  -- Which employment_verification_requests rows this grant covers.
  ev_request_ids        JSONB NOT NULL DEFAULT '[]'::jsonb,

  acknowledged_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address            TEXT,
  user_agent            TEXT,
  checkbox_event_id     TEXT,

  -- Forward-only in-platform revocation (counsel temporary rule for v0.1).
  revoked_at            TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One grant per share request (decline never creates a grant).
CREATE UNIQUE INDEX IF NOT EXISTS ev_share_grants_request_idx
  ON ev_share_grants (share_request_id);

CREATE INDEX IF NOT EXISTS ev_share_grants_driver_idx
  ON ev_share_grants (driver_user_id);

COMMENT ON TABLE ev_share_grants IS
  'Driver Step 6 formal share acknowledgment (Track B PDF 2). Employer EV view requires a non-revoked grant — missing artifact means 403, never soft-fail open.';

-- ── 4. Append-only employer view audit ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS ev_access_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_grant_id        UUID NOT NULL REFERENCES ev_share_grants(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  viewer_user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ev_access_log_grant_idx
  ON ev_access_log (share_grant_id, viewed_at DESC);

COMMENT ON TABLE ev_access_log IS
  'Append-only audit of employer views of shared EV material.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- API routes use the admin client; RLS mirrors screening_consent_bundles for
-- any direct Supabase reads.

ALTER TABLE ev_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ev_share_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ev_share_grants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ev_access_log     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers view own ev authorizations"
  ON ev_authorizations FOR SELECT
  USING (driver_user_id = auth.uid());

CREATE POLICY "Drivers view own ev share requests"
  ON ev_share_requests FOR SELECT
  USING (driver_user_id = auth.uid());

CREATE POLICY "Employers view company ev share requests"
  ON ev_share_requests FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Drivers view own ev share grants"
  ON ev_share_grants FOR SELECT
  USING (driver_user_id = auth.uid());

CREATE POLICY "Employers view company ev share grants"
  ON ev_share_grants FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Drivers view access log for own grants"
  ON ev_access_log FOR SELECT
  USING (
    share_grant_id IN (
      SELECT id FROM ev_share_grants WHERE driver_user_id = auth.uid()
    )
  );
