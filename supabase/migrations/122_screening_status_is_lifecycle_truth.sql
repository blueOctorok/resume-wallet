-- ============================================================
-- MIGRATION 122: Screening status is lifecycle truth
-- ============================================================
-- Date: October 2026
--
-- Migrations 032 and 102 scheduled expire-mvr-orders / expire-psp-orders to
-- set status = 'expired' on ANY row past expires_at, including reports Accio
-- had already returned. `status` was doing two jobs: the order lifecycle, and
-- membership in the reorder lock (the partial unique index from migration 102
-- keyed on status IN ('pending','processing','completed','needs_review')).
-- Overwriting `completed` with `expired` erased the only field most readers
-- use to know a report finished, so finished reports rendered as Failed.
--
-- Measured Oct 2026, before this migration:
--   mvr_orders: 1,072 rows status='expired' with completed_at AND result_xml
--   psp_orders:   875 rows the same way
--   2 expired MVRs had no result and stay expired.
--
-- Principle (DEC-2026-10-002):
--   status     = what happened. Only an Accio outcome, or an order the vendor
--                never returned, changes it.
--   expires_at = when a fresh pull is allowed. Staleness readers use this.
--                Nothing writes status to express it.
--
-- Order matters: narrow the unique index BEFORE restoring rows. The old
-- predicate rejects a second completed driver-owned row for the same driver,
-- and many drivers have more than one finished report.
-- ============================================================

-- ── 1. The lock covers in-flight reservations only ──────────────────────────
-- The index is the atomic reservation for concurrent placements (a second
-- pending insert fails with 23505). "A report is already on file" is enforced
-- by checkRecentDuplicateOrder, which reads expires_at. A finished report
-- must not sit in this index, or it can never be re-pulled.

DROP INDEX IF EXISTS uniq_active_driver_owned_mvr;
DROP INDEX IF EXISTS uniq_active_driver_owned_psp;

CREATE UNIQUE INDEX uniq_active_driver_owned_mvr
  ON mvr_orders (driver_user_id)
  WHERE ordered_by_company_id IS NULL
    AND status IN ('pending', 'processing');

CREATE UNIQUE INDEX uniq_active_driver_owned_psp
  ON psp_orders (driver_user_id)
  WHERE ordered_by_company_id IS NULL
    AND status IN ('pending', 'processing');

-- ── 2. Expiry jobs only touch orders the vendor never finished ───────────────
-- cron.schedule() with an existing jobname replaces that job's definition.
-- `expired` now means one thing: we asked, and no result came back.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'expire-mvr-orders',
      '0 4 * * *',
      $job$
        UPDATE mvr_orders
        SET status = 'expired', updated_at = NOW()
        WHERE status IN ('pending', 'processing')
          AND expires_at IS NOT NULL
          AND expires_at < NOW();
      $job$
    );

    PERFORM cron.schedule(
      'expire-psp-orders',
      '15 4 * * *',
      $job$
        UPDATE psp_orders
        SET status = 'expired', updated_at = NOW()
        WHERE status IN ('pending', 'processing')
          AND expires_at IS NOT NULL
          AND expires_at < NOW();
      $job$
    );
  END IF;
END $$;

-- ── 3. Put the finished reports back ─────────────────────────────────────────
-- deriveScreeningStatus (src/lib/accio-result-status.ts) only returns
-- needs_review when the vendor held the report or the filledCode was
-- unrecognized, and both of those are stored as result_outcome = 'unknown'.
-- A recognized outcome (clear, hits, discrepancy, no_hits, ...) was a
-- completed report. Rows with no completed_at or no result_xml stay expired:
-- those are the genuine "never came back" cases (2 MVRs at time of writing).

UPDATE mvr_orders
SET status = CASE
      WHEN result_outcome = 'unknown' THEN 'needs_review'
      ELSE 'completed'
    END,
    updated_at = NOW()
WHERE status = 'expired'
  AND completed_at IS NOT NULL
  AND result_xml IS NOT NULL;

UPDATE psp_orders
SET status = CASE
      WHEN result_outcome = 'unknown' THEN 'needs_review'
      ELSE 'completed'
    END,
    updated_at = NOW()
WHERE status = 'expired'
  AND completed_at IS NOT NULL
  AND result_xml IS NOT NULL;
