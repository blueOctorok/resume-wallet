-- ============================================================
-- MIGRATION 073: FMCSA PSP Disclosure & Authorization consents
-- ============================================================
-- Stores the federally mandated PSP-only disclosure (standalone).
-- request_id / company_id NULL = candidate self-order ("Self-Request").
-- consumed_at set when a self-order uses this consent row (one order per consent).
-- ============================================================

CREATE TABLE IF NOT EXISTS psp_consents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  request_id        UUID REFERENCES candidate_requests(id) ON DELETE SET NULL,
  company_id        UUID REFERENCES companies(id) ON DELETE SET NULL,
  company_name      TEXT NOT NULL,

  driver_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  signed_name       TEXT NOT NULL,
  signed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  form_version      TEXT NOT NULL DEFAULT '2016-02-11',
  form_data         JSONB NOT NULL DEFAULT '{}'::jsonb,

  consumed_at       TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE psp_consents IS
  'FMCSA-mandated PSP Disclosure & Authorization (standalone). Required before PSP orders via Accio.';

CREATE UNIQUE INDEX IF NOT EXISTS psp_consents_request_id_unique
  ON psp_consents (request_id)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS psp_consents_driver_user_id_idx
  ON psp_consents (driver_user_id);

CREATE INDEX IF NOT EXISTS psp_consents_company_id_idx
  ON psp_consents (company_id);

CREATE INDEX IF NOT EXISTS psp_consents_self_unconsumed_idx
  ON psp_consents (driver_user_id)
  WHERE request_id IS NULL AND company_id IS NULL AND consumed_at IS NULL;

ALTER TABLE psp_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers view own PSP consents"
  ON psp_consents FOR SELECT
  USING (driver_user_id = auth.uid());

CREATE POLICY "Drivers insert own PSP consents"
  ON psp_consents FOR INSERT
  WITH CHECK (driver_user_id = auth.uid());

CREATE POLICY "Employers view company PSP consents"
  ON psp_consents FOR SELECT
  USING (
    company_id IS NOT NULL
    AND company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );
