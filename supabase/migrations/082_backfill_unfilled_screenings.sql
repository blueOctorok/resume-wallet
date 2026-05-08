-- ─────────────────────────────────────────────────────────────────────────────
-- 082_backfill_unfilled_screenings.sql
--
-- Fixes a real-world bug found with Jason Peterson's PSP order: Accio returned
-- `filledStatus="unfilled"` (vendor couldn't fulfill — terminal) and our
-- mapping silently kept the order at `pending`. Three things broke:
--   1. The order showed `pending` in the hub forever.
--   2. Every Accio webhook retry sent another "report ready" email because the
--      dedup guard relies on the row transitioning out of `pending`.
--   3. The structured result was saved but never surfaced to the user.
--
-- This migration:
--   A. Replaces `storm_derive_screening_status()` (originally from 079) with
--      the corrected mapping that mirrors src/lib/accio-result-status.ts:
--      ONLY `in progress` is transient; `unfilled` is a terminal failed state.
--   B. Re-derives status/outcome for any pending mvr_orders / psp_orders rows
--      whose result_xml already contains a terminal filledStatus.
--
-- Idempotent — safe to re-run. Only touches rows whose XML actually contains
-- a terminal filledStatus; rows still genuinely processing are left alone.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A. Corrected derivation helper ──────────────────────────────────────────
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
  -- Only "in progress" is transient. The webhook handler short-circuits these
  -- before reaching here, but we double-check for safety.
  IF v_status IN ('in progress', 'inprogress') THEN
    RETURN QUERY SELECT 'pending'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Vendor explicitly failed the order
  IF v_status = 'failed' THEN
    RETURN QUERY SELECT 'failed'::TEXT,
      CASE WHEN v_code = 'unknown' THEN 'unknown'::TEXT ELSE NULL::TEXT END;
    RETURN;
  END IF;

  -- `unfilled` = "vendor was unable to fulfill". Terminal, not transient.
  -- Surface as failed/unknown so admin can adjudicate and re-order if needed.
  -- Common cause: FMCSA has no PSP records for the driver (new CDL holder,
  -- no carrier-reported events) or the source rejected the identity match.
  IF v_status = 'unfilled' THEN
    RETURN QUERY SELECT 'failed'::TEXT, 'unknown'::TEXT;
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

  -- Terminal failure codes
  IF v_code = 'unobtainable' THEN
    RETURN QUERY SELECT 'failed'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Manual review codes
  IF v_code IN ('contact mro', 'lab-reject', 'test-canceled') THEN
    RETURN QUERY SELECT 'needs_review'::TEXT, 'unknown'::TEXT;
    RETURN;
  END IF;

  -- Genuine completions
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

  -- filledStatus="filled" with no recognized code OR no status at all —
  -- flag for admin rather than silently dropping to "completed/clear".
  RETURN QUERY SELECT 'needs_review'::TEXT, 'unknown'::TEXT;
  RETURN;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── B. Backfill MVR orders stuck pending with terminal result_xml ───────────
-- Targets rows that have a result XML containing a terminal filledStatus
-- (anything other than "in progress" / empty). Pulls filledStatus / filledCode
-- / held_for_review out of the MVR subOrder open tag and runs them through the
-- corrected helper.
WITH stuck AS (
  SELECT
    o.id,
    (regexp_match(
      o.result_xml,
      '<subOrder[^>]*type=["'']MVR["''][^>]*>',
      'i'
    ))[1] AS subtag
  FROM mvr_orders o
  WHERE o.status = 'pending'
    AND o.result_xml IS NOT NULL
),
parsed AS (
  SELECT
    s.id,
    (regexp_match(s.subtag, 'filledStatus=["'']([^"'']+)["'']', 'i'))[1] AS fs,
    (regexp_match(s.subtag, 'filledCode=["'']([^"'']+)["'']', 'i'))[1] AS fc,
    (regexp_match(s.subtag, 'held_for_review=["'']([^"'']+)["'']', 'i'))[1] AS hr
  FROM stuck s
  WHERE s.subtag IS NOT NULL
),
derived AS (
  SELECT p.id, d.status, d.outcome
  FROM parsed p
  CROSS JOIN LATERAL storm_derive_screening_status(p.fs, p.fc, p.hr) d
  WHERE lower(coalesce(p.fs, '')) NOT IN ('', 'in progress', 'inprogress')
)
UPDATE mvr_orders o
SET status = d.status,
    result_outcome = d.outcome,
    completed_at = COALESCE(o.completed_at, NOW()),
    updated_at = NOW()
FROM derived d
WHERE o.id = d.id
  AND o.status = 'pending';

-- ── C. Backfill PSP orders stuck pending with terminal result_xml ──────────
-- Same approach but targets the FMCSA crash/inspection subOrder.
WITH stuck AS (
  SELECT
    o.id,
    (regexp_match(
      o.result_xml,
      '<subOrder[^>]*type=["'']fmcsa_crash_inspection["''][^>]*>',
      'i'
    ))[1] AS subtag
  FROM psp_orders o
  WHERE o.status = 'pending'
    AND o.result_xml IS NOT NULL
),
parsed AS (
  SELECT
    s.id,
    (regexp_match(s.subtag, 'filledStatus=["'']([^"'']+)["'']', 'i'))[1] AS fs,
    (regexp_match(s.subtag, 'filledCode=["'']([^"'']+)["'']', 'i'))[1] AS fc,
    (regexp_match(s.subtag, 'held_for_review=["'']([^"'']+)["'']', 'i'))[1] AS hr
  FROM stuck s
  WHERE s.subtag IS NOT NULL
),
derived AS (
  SELECT p.id, d.status, d.outcome
  FROM parsed p
  CROSS JOIN LATERAL storm_derive_screening_status(p.fs, p.fc, p.hr) d
  WHERE lower(coalesce(p.fs, '')) NOT IN ('', 'in progress', 'inprogress')
)
UPDATE psp_orders o
SET status = d.status,
    result_outcome = d.outcome,
    completed_at = COALESCE(o.completed_at, NOW()),
    updated_at = NOW()
FROM derived d
WHERE o.id = d.id
  AND o.status = 'pending';
