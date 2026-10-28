-- Driver accepts a DKIM-signed employment reply onto the resume.
-- The timestamp is the accept. Clearing it takes the proof off the resume.
-- A portal form reply never sets this; DKIM is checked again at accept time.

ALTER TABLE employment_verification_requests
  ADD COLUMN IF NOT EXISTS resume_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN employment_verification_requests.resume_accepted_at IS
  'Set when the driver puts a DKIM-valid reply on the resume. Null means it stays off the resume.';
