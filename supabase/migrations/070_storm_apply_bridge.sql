-- Storm Apply Bridge: candidate self-reported status + follow-up tracking
--
-- candidate_status: the candidate's own record of what happened after applying
--   (separate from the employer-controlled `status` column)
-- last_followed_up_at: used by the daily follow-up cron to know who's been
--   nudged by Stormi already

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS candidate_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_followed_up_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE applications
  DROP CONSTRAINT IF EXISTS applications_candidate_status_check;

ALTER TABLE applications
  ADD CONSTRAINT applications_candidate_status_check
  CHECK (candidate_status IS NULL OR candidate_status IN ('waiting', 'interview', 'rejected', 'offer', 'no_response'));

COMMENT ON COLUMN applications.candidate_status IS 'Self-reported outcome: waiting, interview, rejected, offer, no_response. NULL = not yet reported.';
COMMENT ON COLUMN applications.last_followed_up_at IS 'When Stormi last sent a follow-up notification for this application.';
