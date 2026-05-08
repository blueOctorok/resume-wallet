-- Add structured PSP summary fields to block_driver_psp so the candidate hub
-- and career card can show real numbers (crashes, inspections, OOS) instead
-- of just "Report on file".
--
-- Populated by src/lib/process-psp-accio-webhook.ts via savePspData() using
-- the new src/lib/accio-psp-parser.ts structured output. NULL when the report
-- is still pending OR when the structured parse failed (raw XML in
-- psp_results.raw_xml remains the source of truth in that case).

ALTER TABLE block_driver_psp
  ADD COLUMN IF NOT EXISTS crash_count INTEGER,
  ADD COLUMN IF NOT EXISTS inspection_count INTEGER,
  ADD COLUMN IF NOT EXISTS oos_count INTEGER,
  ADD COLUMN IF NOT EXISTS report_summary JSONB;

COMMENT ON COLUMN block_driver_psp.crash_count IS
  'Number of FMCSA-reported crashes in the candidate''s 5-year window. Source: accio-psp-parser.';
COMMENT ON COLUMN block_driver_psp.inspection_count IS
  'Number of FMCSA-reported inspections in the candidate''s 5-year window.';
COMMENT ON COLUMN block_driver_psp.oos_count IS
  'Number of out-of-service violations across all inspections.';
COMMENT ON COLUMN block_driver_psp.report_summary IS
  'Free-form roll-up { outcome, crashCount, inspectionCount, oosCount } for fast hub/career-card rendering.';
