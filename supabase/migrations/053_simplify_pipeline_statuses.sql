-- Simplify employer application pipeline to 3 statuses: submitted, contacted, archived
-- Replaces ATS-style stages (under_review, interview, offer, hired, rejected, withdrawn)

-- Map existing rows before altering constraint
UPDATE applications SET status = 'contacted' WHERE status IN ('under_review', 'interview', 'offer');
UPDATE applications SET status = 'archived' WHERE status IN ('hired', 'rejected', 'withdrawn');

-- Replace CHECK constraint (name from 001_role_based_architecture.sql)
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications ADD CONSTRAINT applications_status_check
  CHECK (status IN ('submitted', 'contacted', 'archived'));

COMMENT ON COLUMN applications.status IS 'Employer pipeline: submitted (new), contacted (employer reached out), archived (closed / not pursuing)';
