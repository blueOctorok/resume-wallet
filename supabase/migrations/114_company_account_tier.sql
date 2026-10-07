-- ============================================================
-- MIGRATION 114: companies.account_tier
-- ============================================================
-- Which employer hub a company gets:
--   carrier — came to find drivers. Find Drivers / Your outreach / Messages.
--             Screening blocks are installed one at a time, when first used.
--   agency  — full suite (jobs, applicants, team, every screening block).
--
-- Before this the hub inferred "carrier" from "zero employer blocks," and the
-- hub's first load auto-installed every block. The inference flipped itself.
-- Tier is now a stored fact an admin sets.
-- ============================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS account_tier text NOT NULL DEFAULT 'carrier';

ALTER TABLE companies
  DROP CONSTRAINT IF EXISTS companies_account_tier_check;

ALTER TABLE companies
  ADD CONSTRAINT companies_account_tier_check
  CHECK (account_tier IN ('carrier', 'agency'));

COMMENT ON COLUMN companies.account_tier IS
  'carrier = Find Drivers only, blocks installed on first use; agency = full employer suite with every block preinstalled. Admin-set.';

-- ------------------------------------------------------------
-- Admin-only columns
-- ------------------------------------------------------------
-- RLS on companies is row-level: "Employers can update their own company"
-- lets an owner change ANY column of their row through PostgREST with a
-- browser session. That already covered status / verified; account_tier
-- would join the list. Postgres has no column-level RLS, so a trigger
-- refuses these columns unless the request comes from the service role
-- (API routes) or a direct connection (migrations, SQL editor), where
-- auth.role() is null.
CREATE OR REPLACE FUNCTION companies_guard_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IN ('anon', 'authenticated') THEN
    IF NEW.account_tier      IS DISTINCT FROM OLD.account_tier
    OR NEW.status            IS DISTINCT FROM OLD.status
    OR NEW.verified          IS DISTINCT FROM OLD.verified
    OR NEW.approved_by       IS DISTINCT FROM OLD.approved_by
    OR NEW.approved_at       IS DISTINCT FROM OLD.approved_at
    OR NEW.suspended_by      IS DISTINCT FROM OLD.suspended_by
    OR NEW.suspended_at      IS DISTINCT FROM OLD.suspended_at
    OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason
    OR NEW.allowed_email_domains IS DISTINCT FROM OLD.allowed_email_domains
    OR NEW.admin_notes       IS DISTINCT FROM OLD.admin_notes
    THEN
      RAISE EXCEPTION 'This company field is set by Provven admin'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS companies_guard_admin_columns ON companies;
CREATE TRIGGER companies_guard_admin_columns
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION companies_guard_admin_columns();

-- Companies provisioned by Provven admin are the full-suite customers.
-- Self-serve rows (card_funnel / homepage) stay on the default.
UPDATE companies
SET account_tier = 'agency'
WHERE signup_source = 'admin';

-- Undo the auto-provisioning for carriers. Only rows for companies that
-- never ordered anything are touched, so no paid artifact loses its block.
WITH untouched_carriers AS (
  SELECT c.id
  FROM companies c
  WHERE c.account_tier = 'carrier'
    AND NOT EXISTS (SELECT 1 FROM mvr_orders m WHERE m.ordered_by_company_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM psp_orders p WHERE p.ordered_by_company_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM screening_consent_bundles s WHERE s.company_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM ev_share_requests e WHERE e.company_id = c.id)
),
removed AS (
  DELETE FROM employer_hub_blocks b
  USING untouched_carriers u
  WHERE b.company_id = u.id
  RETURNING b.company_id, b.block_type
)
INSERT INTO employer_block_audit (company_id, block_type, action, actor_user_id, actor_kind, reason)
SELECT company_id, block_type, 'removed', NULL, 'storm_admin',
       'Migration 114: carrier tier — auto-provisioned block removed, no orders existed'
FROM removed;
