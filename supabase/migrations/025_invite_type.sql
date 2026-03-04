-- Migration 025: Add outreach type and email tracking to application_invites
-- Supports three invite types:
--   driver_dot     — invite a driver to complete their DOT application
--   developer_card — invite a developer to set up their career card
--   general        — generic StormChain onboarding (person picks their role)

ALTER TABLE application_invites
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'driver_dot'
  CHECK (type IN ('driver_dot', 'developer_card', 'general'));

ALTER TABLE application_invites
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN application_invites.type IS 
  'Outreach type: driver_dot = DOT application, developer_card = career card setup, general = open onboarding';

COMMENT ON COLUMN application_invites.email_sent_at IS
  'Timestamp when the invite email was last sent (null = never sent)';
