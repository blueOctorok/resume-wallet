-- A one-purpose ticket in a recruiter email. Opening it does not require an account.
-- The page can only ask the driver to do their own unfinished steps.
-- Service role only. The token is the credential.

CREATE TABLE IF NOT EXISTS recruiter_asks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  driver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_name TEXT NOT NULL,
  note TEXT NOT NULL,
  tasks TEXT[] NOT NULL,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  sent_tasks TEXT[],
  recruiter_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recruiter_asks_tasks_check CHECK (
    cardinality(tasks) > 0
    AND tasks <@ ARRAY['consent', 'license', 'dot']::text[]
  ),
  CONSTRAINT recruiter_asks_sent_tasks_check CHECK (
    sent_tasks IS NULL OR sent_tasks <@ ARRAY['consent', 'license', 'dot']::text[]
  )
);

CREATE INDEX IF NOT EXISTS recruiter_asks_token_idx ON recruiter_asks (token);

ALTER TABLE recruiter_asks ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE recruiter_asks IS
  'Link in an HR-to-recruiter email. The recruiter picks driver steps and Provven emails the driver. No login.';
