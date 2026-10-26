-- Support mail that landed in Provven. Service role only.
-- Apex support@provven.com is forwarded to support@verify.provven.com,
-- which Pingram already catches. Do not move the verify.provven.com MX.

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  parent_id UUID REFERENCES support_messages(id) ON DELETE CASCADE,
  external_id TEXT UNIQUE,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_messages_received_idx
  ON support_messages (received_at DESC);

CREATE INDEX IF NOT EXISTS support_messages_parent_idx
  ON support_messages (parent_id);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE support_messages IS
  'Support inbox. Inbound rows are mail to a Provven support address. Outbound rows are admin replies.';
