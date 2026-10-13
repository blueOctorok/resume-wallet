-- Phase 2 outreach touches: a scripted call or text sits between email 2 and
-- email 3. Those rows share verification_attempts but must not consume one of
-- the three emails (attempt_count stays 0–3). attempt_number is just the
-- timeline order, so the old "max 3" check has to go.

ALTER TABLE verification_attempts
  DROP CONSTRAINT IF EXISTS verification_attempts_attempt_number_check;

ALTER TABLE verification_attempts
  ADD CONSTRAINT verification_attempts_attempt_number_check
  CHECK (attempt_number >= 1);

ALTER TABLE verification_attempts
  DROP CONSTRAINT IF EXISTS verification_attempts_method_check;

ALTER TABLE verification_attempts
  ADD CONSTRAINT verification_attempts_method_check
  CHECK (method IN ('email', 'phone', 'portal', 'fax', 'mail', 'sms'));

ALTER TABLE employment_verification_requests
  ADD COLUMN IF NOT EXISTS previous_employer_phone_type TEXT,
  ADD COLUMN IF NOT EXISTS voice_opt_out BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_touch_at TIMESTAMPTZ;

ALTER TABLE employment_verification_requests
  DROP CONSTRAINT IF EXISTS employment_verification_requests_phone_type_check;

ALTER TABLE employment_verification_requests
  ADD CONSTRAINT employment_verification_requests_phone_type_check
  CHECK (previous_employer_phone_type IS NULL OR previous_employer_phone_type IN ('office', 'mobile'));

COMMENT ON COLUMN employment_verification_requests.previous_employer_phone_type IS
  'office gets a scripted call; mobile gets SMS. Null is treated as office so an unknown line is never texted.';
COMMENT ON COLUMN employment_verification_requests.last_touch_at IS
  'When the one day-5 call or text went out. Null means the touch has not happened.';
