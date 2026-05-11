-- ─────────────────────────────────────────────────────────────────────────────
-- 083_recover_wrongly_matched_psp.sql
--
-- One-shot recovery for the "wrongful-matching" bug. Background:
--
--   A legitimate, fresh PSP order (id starting `fc7936ec`) was placed for a
--   new candidate after we'd cut over to prod Accio credentials. Accio later
--   replayed a stale webhook from the OLD `testaccount` context with
--   filledStatus="unfilled". Our PSP webhook handler at the time had a
--   state-only fallback that grabbed the most recent pending PSP order in
--   Ohio — which happened to be this brand-new order — and stamped it with
--   the stale `unfilled` status, AND overwrote its accio_remote_order_number
--   with the testaccount's remote ID. From that point on, every real Accio
--   postback for this order silently failed to match (and the order showed
--   "Failed" to the user even though Key/Pace had the data ready).
--
-- This migration recovers that one corrupted order so the user can resume.
-- The screening-webhook-match.ts hardening (and the screening-validation.ts
-- preflight checks) shipped in the same change make the bug class impossible
-- to recur — see those files for the full story.
--
-- Recovery strategy (per row):
--   1. Reset status to `pending` and clear result_outcome / result_xml /
--      processed_at / completed_at so the order behaves like a fresh placement.
--   2. Null out the corrupted accio_remote_order_number /
--      accio_remote_suborder_number so the next legitimate Accio postback
--      can either match by remote ID (when the next webhook arrives) or via
--      the strict DL+state recovery path in screening-webhook-match.ts.
--   3. Delete any `psp_results` row attached to the order — those rows hold
--      the bogus testaccount XML and would otherwise show through to the user.
--
-- Idempotent: only touches rows that still bear the corruption signature
-- (status='failed' AND result_outcome='unknown' AND result_xml LIKE
-- '%unfilled%'). Once recovery succeeds the WHERE clause stops matching, so
-- re-running the migration is a no-op.
-- ─────────────────────────────────────────────────────────────────────────────

-- A. Recover the corrupted PSP order(s).
WITH corrupted AS (
  SELECT id, accio_order_number
  FROM psp_orders
  WHERE id::text LIKE 'fc7936ec%'
    AND status = 'failed'
    AND result_outcome = 'unknown'
    AND result_xml ILIKE '%unfilled%'
)
UPDATE psp_orders
SET
  status = 'pending',
  result_outcome = NULL,
  accio_remote_order_number = NULL,
  accio_remote_suborder_number = NULL,
  result_xml = NULL,
  processed_at = NULL,
  completed_at = NULL
WHERE id IN (SELECT id FROM corrupted);

-- B. Drop the bogus testaccount result row(s) attached to those orders.
DELETE FROM psp_results
WHERE psp_order_id IN (
  SELECT id FROM psp_orders WHERE id::text LIKE 'fc7936ec%'
);

-- C. Recover the bundled MVR sibling, if it caught the same corruption.
--    PSP+MVR bundles share the `accio_order_number` so we use that to find
--    the paired MVR row without a foreign key.
UPDATE mvr_orders
SET
  status = 'pending',
  result_outcome = NULL,
  accio_remote_order_number = NULL,
  accio_remote_suborder_number = NULL,
  result_xml = NULL,
  processed_at = NULL,
  completed_at = NULL
WHERE accio_order_number IN (
  SELECT accio_order_number FROM psp_orders WHERE id::text LIKE 'fc7936ec%'
)
AND status = 'failed'
AND result_outcome = 'unknown'
AND result_xml ILIKE '%unfilled%';

-- D. Drop any matching MVR results row.
DELETE FROM mvr_results
WHERE mvr_order_id IN (
  SELECT id FROM mvr_orders
  WHERE accio_order_number IN (
    SELECT accio_order_number FROM psp_orders WHERE id::text LIKE 'fc7936ec%'
  )
);
