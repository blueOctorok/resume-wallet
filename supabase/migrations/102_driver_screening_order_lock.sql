-- ============================================================
-- MIGRATION 102: Driver screening order lock
-- ============================================================
-- Date: July 2026
--
-- Why: candidates (and potentially malicious actors) could place repeat
-- driver-owned MVR/PSP orders — each one a real Accio charge. The app-level
-- duplicate guard was check-then-act (Accio called BEFORE the row insert),
-- so it was both racy and status-blind (`needs_review` slipped through:
-- Ray Case placed 4 PSPs in one day). This migration makes the database
-- the source of truth: at most ONE active driver-owned order per driver
-- per kind, enforced by a partial unique index.
--
-- Ships with the reserve-then-place refactor in place-screening-order.ts:
-- the app now inserts a `pending` row BEFORE calling Accio, so this index
-- is the atomic reservation that wins races.
--
-- 1. Adds `superseded` status (duplicate cleanup — the reports are real,
--    they're just redundant; `cancelled`/`expired` would be lying).
-- 2. Converts consented company-private pulls to driver-owned
--    (DEC-2026-07-002: ownership follows the driver's signed consent bundle,
--    NOT who clicked the button or paid — Pace-funded pulls belong to the
--    driver so they surface on the career card and are shareable).
-- 3. Backfills: keeps the newest active order per driver per table, marks
--    older duplicates `superseded`.
-- 4. Partial unique indexes = the lock.
-- 5. pg_cron `expire-psp-orders` (PSP had NO expiry job — 200+ past-expiry
--    rows were still "active", which would have made the lock permanent).
--    Also re-schedules `expire-mvr-orders` to leave `superseded` rows alone
--    and unschedules `sync-driver-mvr-expiry`, which still targeted the
--    dropped `driver_profiles` table.
-- ============================================================

-- ── 1. Allow `superseded` in the status CHECK constraints ────────────────────

ALTER TABLE mvr_orders DROP CONSTRAINT IF EXISTS mvr_orders_status_check;
ALTER TABLE mvr_orders ADD CONSTRAINT mvr_orders_status_check
  CHECK (status::text = ANY (ARRAY[
    'pending', 'processing', 'completed', 'failed',
    'needs_review', 'cancelled', 'expired', 'superseded'
  ]::text[]));

ALTER TABLE psp_orders DROP CONSTRAINT IF EXISTS psp_orders_status_check;
ALTER TABLE psp_orders ADD CONSTRAINT psp_orders_status_check
  CHECK (status::text = ANY (ARRAY[
    'pending', 'processing', 'completed', 'failed',
    'needs_review', 'cancelled', 'expired', 'superseded'
  ]::text[]));

-- ── 2. Convert consented company-private pulls to driver-owned ───────────────
-- DEC-2026-07-002: the driver's signed consent bundle is the authorization —
-- who clicked or paid does not decide ownership. Historically the employer
-- screenings/order route defaulted to company-private, so Pace-funded pulls
-- never reached the candidate's career card. Convert every ACTIVE, unexpired
-- company pull that has a matching complete consent bundle. Past-expiry rows
-- stay as-is (the cron below flips them to `expired`); payments keep their
-- company_id so the funding audit trail is unchanged.
-- MUST run before the supersede backfill + unique indexes so converted rows
-- participate in dedupe instead of violating the index.

UPDATE psp_orders o
SET ordered_by_company_id = NULL,
    ordered_by_user_id = NULL,
    ordered_by_employer = false,
    updated_at = NOW()
WHERE o.ordered_by_company_id IS NOT NULL
  AND o.status IN ('pending', 'processing', 'completed', 'needs_review')
  AND (o.expires_at IS NULL OR o.expires_at > NOW())
  AND EXISTS (
    SELECT 1 FROM screening_consent_bundles b
    WHERE b.driver_user_id = o.driver_user_id
      AND b.company_id = o.ordered_by_company_id
      AND b.status = 'complete'
  );

UPDATE mvr_orders o
SET ordered_by_company_id = NULL,
    ordered_by_user_id = NULL,
    ordered_by_employer = false,
    updated_at = NOW()
WHERE o.ordered_by_company_id IS NOT NULL
  AND o.status IN ('pending', 'processing', 'completed', 'needs_review')
  AND (o.expires_at IS NULL OR o.expires_at > NOW())
  AND EXISTS (
    SELECT 1 FROM screening_consent_bundles b
    WHERE b.driver_user_id = o.driver_user_id
      AND b.company_id = o.ordered_by_company_id
      AND b.status = 'complete'
  );

-- ── 3. Backfill: mark older active driver-owned duplicates superseded ────────
-- Keep the newest (by created_at) active driver-owned order per driver
-- (converted rows from step 2 included); every older active driver-owned
-- order of the same kind becomes superseded. Remaining company-private rows
-- (no consent bundle — legacy talent-card pulls) are untouched.

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY driver_user_id
           ORDER BY created_at DESC
         ) AS rn
  FROM psp_orders
  WHERE ordered_by_company_id IS NULL
    AND status IN ('pending', 'processing', 'completed', 'needs_review')
)
UPDATE psp_orders o
SET status = 'superseded', updated_at = NOW()
FROM ranked r
WHERE o.id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY driver_user_id
           ORDER BY created_at DESC
         ) AS rn
  FROM mvr_orders
  WHERE ordered_by_company_id IS NULL
    AND status IN ('pending', 'processing', 'completed', 'needs_review')
)
UPDATE mvr_orders o
SET status = 'superseded', updated_at = NOW()
FROM ranked r
WHERE o.id = r.id AND r.rn > 1;

-- ── 4. The lock: one active driver-owned order per driver per kind ───────────
-- Partial unique index — INSERT of a second active driver-owned order fails
-- with 23505, which the app surfaces as a friendly 409. Terminal statuses
-- (failed / cancelled / expired / superseded) fall out of the index, so
-- re-ordering after a failure or after the 30-day expiry works naturally.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_driver_owned_psp
  ON psp_orders (driver_user_id)
  WHERE ordered_by_company_id IS NULL
    AND status IN ('pending', 'processing', 'completed', 'needs_review');

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_driver_owned_mvr
  ON mvr_orders (driver_user_id)
  WHERE ordered_by_company_id IS NULL
    AND status IN ('pending', 'processing', 'completed', 'needs_review');

-- ── 5. Expiry jobs (pg_cron) ──────────────────────────────────────────────────
-- PSP orders never expired (migration 032 only covered MVR), so the lock
-- above would never self-release. Mirror the MVR job. Also re-schedule the
-- MVR job to skip `superseded`, and drop the dead driver_profiles sync.
-- cron.schedule() with an existing jobname replaces that job's definition.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'expire-psp-orders',
      '15 4 * * *', -- 4:15 AM UTC nightly (offset from expire-mvr-orders)
      $job$
        UPDATE psp_orders
        SET status = 'expired', updated_at = NOW()
        WHERE status NOT IN ('expired', 'failed', 'cancelled', 'superseded')
          AND expires_at IS NOT NULL
          AND expires_at < NOW();
      $job$
    );

    PERFORM cron.schedule(
      'expire-mvr-orders',
      '0 4 * * *',
      $job$
        UPDATE mvr_orders
        SET status = 'expired', updated_at = NOW()
        WHERE status NOT IN ('expired', 'failed', 'cancelled', 'superseded')
          AND expires_at IS NOT NULL
          AND expires_at < NOW();
      $job$
    );

    -- driver_profiles was dropped (see block-development rules) — this job
    -- has been failing silently ever since.
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-driver-mvr-expiry') THEN
      PERFORM cron.unschedule('sync-driver-mvr-expiry');
    END IF;
  END IF;
END $$;
