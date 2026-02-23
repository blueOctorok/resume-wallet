-- Add email tracking to application invites
-- Tracks when invite emails are sent

ALTER TABLE application_invites 
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN application_invites.email_sent_at IS 'When the invite email was sent to the candidate';
