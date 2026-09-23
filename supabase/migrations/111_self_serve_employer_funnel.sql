-- ============================================================
-- MIGRATION 111: Self-serve employer funnel + employer terms acceptance
-- ============================================================
-- A shared career card can start an employer account (status stays pending
-- until admin approves). signup_source distinguishes those rows from
-- admin-created companies. origin_share_token is the card that brought them
-- in — pending mode shows that one public card, nothing else.
--
-- company_terms_acceptances records the Employment Verification schedule
-- (PROVVEN-EMP-TERMS-EV-0.1). One owner/admin acceptance covers the company.
-- A version bump requires a new row.
-- ============================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS origin_share_token TEXT,
  ADD COLUMN IF NOT EXISTS signup_source TEXT NOT NULL DEFAULT 'admin';

ALTER TABLE companies
  DROP CONSTRAINT IF EXISTS companies_signup_source_check;

ALTER TABLE companies
  ADD CONSTRAINT companies_signup_source_check
  CHECK (signup_source IN ('admin', 'card_funnel'));

CREATE TABLE IF NOT EXISTS company_terms_acceptances (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Null when the acceptance is recorded at signup, before an auth user exists.
  accepted_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_email       TEXT,
  document_version     TEXT NOT NULL,
  document_sha256      TEXT NOT NULL,
  accepted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address           TEXT,
  user_agent           TEXT
);

CREATE INDEX IF NOT EXISTS company_terms_acceptances_company_idx
  ON company_terms_acceptances (company_id, document_version);

ALTER TABLE company_terms_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view terms acceptances"
  ON company_terms_acceptances FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
