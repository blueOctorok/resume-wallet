-- 099: One screening result row per order (MVR + PSP idempotency)
--
-- Root cause: concurrent Accio webhooks / reconcile replays could INSERT when
-- maybeSingle() saw 0 rows (race) or errored on 2+ rows (duplicate spiral).
--
-- This migration:
--   1. Aborts if hub cache points at a duplicate result we'd delete (Pace safety)
--   2. Deletes duplicate mvr_results / psp_results (keeps newest per order)
--   3. Adds UNIQUE indexes so upsert onConflict works
--
-- Apply via Supabase dashboard. Safe to run after Phase A Step 0 gates pass.
-- Steps 1–2 in docs/SUPABASE_CLEANUP_PHASE_A.md are superseded by this file.

-- ── Pace / hub safety gate ───────────────────────────────────────────────────

DO $$
DECLARE
  block_refs bigint;
BEGIN
  WITH ranked AS (
    SELECT id, mvr_order_id,
      row_number() OVER (
        PARTITION BY mvr_order_id
        ORDER BY parsed_at DESC NULLS LAST, received_at DESC NULLS LAST,
                 created_at DESC NULLS LAST, id DESC
      ) AS rn
    FROM mvr_results
  ),
  to_delete AS (SELECT id FROM ranked WHERE rn > 1)
  SELECT count(*) INTO block_refs
  FROM block_driver_mvr
  WHERE result_id IN (SELECT id FROM to_delete);

  IF block_refs > 0 THEN
    RAISE EXCEPTION
      '099 aborted: % block_driver_mvr rows reference duplicate mvr_results — repoint first',
      block_refs;
  END IF;
END $$;

-- ── Dedupe MVR results (keep canonical row per order) ────────────────────────

WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY mvr_order_id
      ORDER BY parsed_at DESC NULLS LAST, received_at DESC NULLS LAST,
               created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM mvr_results
)
DELETE FROM mvr_results
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ── Dedupe PSP results ───────────────────────────────────────────────────────

WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY psp_order_id
      ORDER BY parsed_at DESC NULLS LAST, received_at DESC NULLS LAST,
               created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM psp_results
)
DELETE FROM psp_results
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ── Enforce 1:1 order → result (enables upsert onConflict) ──────────────────

CREATE UNIQUE INDEX IF NOT EXISTS mvr_results_mvr_order_id_unique
  ON mvr_results (mvr_order_id);

CREATE UNIQUE INDEX IF NOT EXISTS psp_results_psp_order_id_unique
  ON psp_results (psp_order_id);

COMMENT ON INDEX mvr_results_mvr_order_id_unique IS
  'One parsed MVR result per Accio order — webhook upserts on mvr_order_id';

COMMENT ON INDEX psp_results_psp_order_id_unique IS
  'One parsed PSP result per Accio order — webhook upserts on psp_order_id';
