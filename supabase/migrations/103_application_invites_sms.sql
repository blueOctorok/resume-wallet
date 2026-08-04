-- SMS tracking for application invites (Pingram outreach Text)
-- Email-only invites remain valid; phone is optional.

ALTER TABLE application_invites
  ADD COLUMN IF NOT EXISTS candidate_phone text;

ALTER TABLE application_invites
  ADD COLUMN IF NOT EXISTS sms_sent_at timestamptz;

COMMENT ON COLUMN application_invites.candidate_phone IS 'E.164 candidate phone for invite SMS (optional)';
COMMENT ON COLUMN application_invites.sms_sent_at IS 'When the invite SMS was last sent via Pingram';
