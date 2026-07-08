-- Accio MVR filledCode="discrepancy" was unmapped in accio-result-status.ts,
-- so completed reports (violations + identity mismatch) were stored as
-- needs_review / unknown ("Pending review"). Key Background shows
-- "COMPLETE - discrepancy". Add the outcome + backfill existing rows.

ALTER TABLE mvr_orders
  DROP CONSTRAINT IF EXISTS mvr_orders_result_outcome_check;
ALTER TABLE mvr_orders
  ADD CONSTRAINT mvr_orders_result_outcome_check
  CHECK (result_outcome IS NULL OR result_outcome IN (
    'clear', 'no_hits', 'hits', 'discrepancy', 'pass', 'fail', 'unknown'
  ));

ALTER TABLE psp_orders
  DROP CONSTRAINT IF EXISTS psp_orders_result_outcome_check;
ALTER TABLE psp_orders
  ADD CONSTRAINT psp_orders_result_outcome_check
  CHECK (result_outcome IS NULL OR result_outcome IN (
    'clear', 'no_hits', 'hits', 'discrepancy', 'pass', 'fail', 'unknown'
  ));

-- Re-derive status/outcome for any MVR whose XML says discrepancy but DB still
-- shows needs_review/unknown (Rivera-style mismatch + violation reports).
UPDATE mvr_orders o
SET
  status = 'completed',
  result_outcome = 'discrepancy',
  updated_at = NOW()
WHERE o.result_xml IS NOT NULL
  AND o.result_xml ~* 'filledCode=["'']discrepancy["'']'
  AND (
    o.result_outcome IS DISTINCT FROM 'discrepancy'
    OR o.status IN ('pending', 'needs_review')
  );
