-- 040_employer_access_ai_columns.sql
-- Add AI evaluation columns to employer_access_requests for the AvA-gated access system.
-- New statuses: auto_approved, flagged, blocked (in addition to existing pending, approved, rejected).

ALTER TABLE employer_access_requests
  ADD COLUMN IF NOT EXISTS ai_decision   TEXT,
  ADD COLUMN IF NOT EXISTS ai_reason     TEXT,
  ADD COLUMN IF NOT EXISTS ai_confidence REAL;

COMMENT ON COLUMN employer_access_requests.ai_decision   IS 'AvA verdict: approve, flag, or block';
COMMENT ON COLUMN employer_access_requests.ai_reason     IS 'AvA explanation for the decision';
COMMENT ON COLUMN employer_access_requests.ai_confidence IS 'AvA confidence score 0.0–1.0';
