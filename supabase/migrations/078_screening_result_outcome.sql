-- Add `result_outcome` to mvr_orders + psp_orders so the UI can show
-- "Clear" vs "Hits found" vs "Pass" / "Fail" without re-parsing XML on read.
--
-- Companion to src/lib/accio-result-status.ts. Values stored:
--   'clear' | 'no_hits' | 'hits' | 'pass' | 'fail' | 'unknown' | NULL
-- NULL means the order has not finished yet (status = 'pending').

ALTER TABLE mvr_orders
  ADD COLUMN IF NOT EXISTS result_outcome TEXT;

ALTER TABLE psp_orders
  ADD COLUMN IF NOT EXISTS result_outcome TEXT;

ALTER TABLE mvr_orders
  DROP CONSTRAINT IF EXISTS mvr_orders_result_outcome_check;
ALTER TABLE mvr_orders
  ADD CONSTRAINT mvr_orders_result_outcome_check
  CHECK (result_outcome IS NULL OR result_outcome IN (
    'clear', 'no_hits', 'hits', 'pass', 'fail', 'unknown'
  ));

ALTER TABLE psp_orders
  DROP CONSTRAINT IF EXISTS psp_orders_result_outcome_check;
ALTER TABLE psp_orders
  ADD CONSTRAINT psp_orders_result_outcome_check
  CHECK (result_outcome IS NULL OR result_outcome IN (
    'clear', 'no_hits', 'hits', 'pass', 'fail', 'unknown'
  ));

-- Composite index speeds up the employer screenings panel filters
-- (status='completed' + outcome filter) and the admin "needs review" queue.
CREATE INDEX IF NOT EXISTS idx_mvr_orders_status_outcome
  ON mvr_orders(status, result_outcome);
CREATE INDEX IF NOT EXISTS idx_psp_orders_status_outcome
  ON psp_orders(status, result_outcome);

COMMENT ON COLUMN mvr_orders.result_outcome IS
  'High-level Accio result outcome derived from filledCode. See src/lib/accio-result-status.ts.';
COMMENT ON COLUMN psp_orders.result_outcome IS
  'High-level Accio result outcome derived from filledCode. See src/lib/accio-result-status.ts.';
