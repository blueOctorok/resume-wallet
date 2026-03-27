-- Allow employment_verification_requests for general (non-driver/dev-specific) resume work history.
-- Candidate hub merges driver block employment, dev profile jobs, and general resume employments.

ALTER TABLE employment_verification_requests
  DROP CONSTRAINT IF EXISTS employment_verification_requests_applicant_type_check;

ALTER TABLE employment_verification_requests
  ADD CONSTRAINT employment_verification_requests_applicant_type_check
  CHECK (applicant_type IN ('driver', 'developer', 'general'));

COMMENT ON COLUMN employment_verification_requests.applicant_type IS
  'driver | developer | general — routes display and legacy initiate-self APIs; employment_id may be composite (e.g. general:uuid) for candidate-initiated requests.';
