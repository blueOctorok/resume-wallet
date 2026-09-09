-- Driver chose not to send this packet. Not the same as VERIFICATION_DECLINED
-- (previous employer refused to verify).

ALTER TABLE employment_verification_requests
  DROP CONSTRAINT IF EXISTS employment_verification_requests_status_check;

ALTER TABLE employment_verification_requests
  ADD CONSTRAINT employment_verification_requests_status_check
  CHECK (status IN (
    'VERIFICATION_REQUESTED',
    'VERIFICATION_IN_PROGRESS',
    'VERIFIED',
    'PARTIALLY_VERIFIED',
    'VERIFICATION_DENIED',
    'ATTEMPTS_EXHAUSTED',
    'VERIFICATION_DECLINED',
    'DRIVER_SEND_DECLINED'
  ));

COMMENT ON CONSTRAINT employment_verification_requests_status_check ON employment_verification_requests IS
  'DRIVER_SEND_DECLINED = driver recorded they will not send this packet. VERIFICATION_DECLINED = previous employer refused.';
