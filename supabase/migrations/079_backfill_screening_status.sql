-- Backfill `status` + `result_outcome` for any mvr_orders / psp_orders rows
-- that are stuck `pending` or `needs_review` because the old webhook code
-- compared `filledCode === 'verified'` (a value Accio never sends). Re-derives
-- the correct values from `result_xml` using the same logic as
-- src/lib/accio-result-status.ts.
--
-- Idempotent — safe to re-run. Only rewrites rows whose XML actually contains
-- the expected subOrder attributes; rows with no parseable result are left
-- alone.
--
-- Companion migration: 078_screening_result_outcome.sql must run first so the
-- result_outcome column exists.

-- ── helper: derive (status, outcome) from raw subOrder attrs ────────────────
CREATE OR REPLACE FUNCTION storm_derive_screening_status(
  p_filled_status TEXT,
  p_filled_code TEXT,
  p_held_for_review TEXT
) RETURNS TABLE(status TEXT, outcome TEXT) AS $$
DECLARE
  v_status TEXT := lower(coalesce(p_filled_status, ''));
  v_code   TEXT := lower(coalesce(p_filled_code, ''));
  v_held   BOOLEAN := upper(coalesce(p_held_for_review, 'N')) = 'Y';
BEGIN
  -- Vendor explicitly failed the order
  IF v_status = 'failed' THEN
    RETURN QUERY SELECT 'failed'::TEXT,
      CASE WHEN v_code = 'unknown' THEN 'unknown'::TEXT ELSE NULL::TEXT END;
    RETURN;
  END IF;

  -- Anything that hasn't reached "filled" is still pending
  IF v_status <> '' AND v_status <> 'filled' THEN
    RETURN QUERY SELECT 'pending'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Vendor wants a human to look — keep in needs_review, surface outcome hint
  IF v_held THEN
    RETURN QUERY SELECT 'needs_review'::TEXT,
      CASE
        WHEN v_code IN ('clear', 'no hits') THEN
          CASE WHEN v_code = 'no hits' THEN 'no_hits'::TEXT ELSE 'clear'::TEXT END
        WHEN v_code IN ('hits', 'previous-positive', 'drugpositive') THEN 'hits'::TEXT
        WHEN v_code IN ('pass', 'drugnegative') THEN 'pass'::TEXT
        WHEN v_code = 'fail' THEN 'fail'::TEXT
        ELSE 'unknown'::TEXT
      END;
    RETURN;
  END IF;

  IF v_code = 'unobtainable' THEN
    RETURN QUERY SELECT 'failed'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF v_code IN ('contact mro', 'lab-reject', 'test-canceled') THEN
    RETURN QUERY SELECT 'needs_review'::TEXT, 'unknown'::TEXT;
    RETURN;
  END IF;

  IF v_code IN ('clear', 'no hits') THEN
    RETURN QUERY SELECT 'completed'::TEXT,
      CASE WHEN v_code = 'no hits' THEN 'no_hits'::TEXT ELSE 'clear'::TEXT END;
    RETURN;
  END IF;

  IF v_code IN ('hits', 'previous-positive', 'drugpositive') THEN
    RETURN QUERY SELECT 'completed'::TEXT, 'hits'::TEXT;
    RETURN;
  END IF;

  IF v_code IN ('pass', 'drugnegative') THEN
    RETURN QUERY SELECT 'completed'::TEXT, 'pass'::TEXT;
    RETURN;
  END IF;

  IF v_code = 'fail' THEN
    RETURN QUERY SELECT 'completed'::TEXT, 'fail'::TEXT;
    RETURN;
  END IF;

  -- 'unknown', '', or any code we haven't mapped → flag for human review.
  -- Better than silently stamping a candidate's report as "clear" when we
  -- actually don't know what the vendor returned.
  RETURN QUERY SELECT 'needs_review'::TEXT, 'unknown'::TEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── backfill mvr_orders ────────────────────────────────────────────────────
WITH attrs AS (
  SELECT
    o.id,
    -- Capture the full opening tag of the MVR subOrder, then pull
    -- filledStatus / filledCode / held_for_review from inside it.
    (regexp_match(o.result_xml, '<subOrder[^>]*type="MVR"[^>]*>'))[1] AS so_tag
  FROM mvr_orders o
  WHERE o.result_xml IS NOT NULL
    AND o.status IN ('pending', 'needs_review')
),
parsed AS (
  SELECT
    a.id,
    (regexp_match(a.so_tag, 'filledStatus="([^"]*)"'))[1] AS filled_status,
    (regexp_match(a.so_tag, 'filledCode="([^"]*)"')   )[1] AS filled_code,
    (regexp_match(a.so_tag, 'held_for_review="([^"]*)"'))[1] AS held_for_review
  FROM attrs a
  WHERE a.so_tag IS NOT NULL
),
derived AS (
  SELECT p.id, d.status, d.outcome
  FROM parsed p
  CROSS JOIN LATERAL storm_derive_screening_status(p.filled_status, p.filled_code, p.held_for_review) d
)
UPDATE mvr_orders o
SET status = d.status,
    result_outcome = d.outcome,
    updated_at = NOW()
FROM derived d
WHERE o.id = d.id
  AND (o.status IS DISTINCT FROM d.status OR o.result_outcome IS DISTINCT FROM d.outcome);

-- ── backfill psp_orders (FMCSA crash/inspection subOrder) ──────────────────
WITH attrs AS (
  SELECT
    o.id,
    (regexp_match(o.result_xml, '<subOrder[^>]*type="fmcsa_crash_inspection"[^>]*>'))[1] AS so_tag
  FROM psp_orders o
  WHERE o.result_xml IS NOT NULL
    AND o.status IN ('pending', 'needs_review')
),
parsed AS (
  SELECT
    a.id,
    (regexp_match(a.so_tag, 'filledStatus="([^"]*)"'))[1] AS filled_status,
    (regexp_match(a.so_tag, 'filledCode="([^"]*)"')   )[1] AS filled_code,
    (regexp_match(a.so_tag, 'held_for_review="([^"]*)"'))[1] AS held_for_review
  FROM attrs a
  WHERE a.so_tag IS NOT NULL
),
derived AS (
  SELECT p.id, d.status, d.outcome
  FROM parsed p
  CROSS JOIN LATERAL storm_derive_screening_status(p.filled_status, p.filled_code, p.held_for_review) d
)
UPDATE psp_orders o
SET status = d.status,
    result_outcome = d.outcome,
    updated_at = NOW()
FROM derived d
WHERE o.id = d.id
  AND (o.status IS DISTINCT FROM d.status OR o.result_outcome IS DISTINCT FROM d.outcome);

-- Helper function isn't needed at runtime — drop it so future schema dumps
-- stay clean. The webhook does this in TS now.
DROP FUNCTION IF EXISTS storm_derive_screening_status(TEXT, TEXT, TEXT);
