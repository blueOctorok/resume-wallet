-- Fix: employer_access_requests status check constraint was never updated in 040
-- to include the AI-gated statuses (auto_approved, flagged, blocked).
-- Drop the old constraint and re-add with the full set.

ALTER TABLE employer_access_requests
  DROP CONSTRAINT IF EXISTS employer_access_requests_status_check;

ALTER TABLE employer_access_requests
  ADD CONSTRAINT employer_access_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'auto_approved', 'flagged', 'blocked'));
