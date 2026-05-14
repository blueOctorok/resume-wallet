-- Employer-side pipeline + notes on outreach invites (Jira-like board).
-- Separate from application_invites.status (candidate lifecycle: pending/viewed/...).

ALTER TABLE application_invites
  ADD COLUMN IF NOT EXISTS recruiter_status text NOT NULL DEFAULT 'not_started'
    CONSTRAINT application_invites_recruiter_status_check
    CHECK (recruiter_status IN ('not_started', 'in_progress', 'completed', 'archived'));

ALTER TABLE application_invites
  ADD COLUMN IF NOT EXISTS recruiter_notes text;

COMMENT ON COLUMN application_invites.recruiter_status IS 'Employer kanban column: not_started | in_progress | completed | archived';
COMMENT ON COLUMN application_invites.recruiter_notes IS 'Employer free-text notes on this outreach (single field, not a thread)';
