-- Pending team invites are created before the invitee has a users row.
-- 016 required user_id; employer Team already inserted null for new emails.
-- That NOT NULL is why Central Admin invite 500s for metro@… (no account yet).

alter table company_members
  alter column user_id drop not null;
