-- Carrier access form creates a company before anyone has signed in.
-- designated_owner_email is the claim token; employer_user_id is filled
-- on first login (resolve-employer-link). The original companies table
-- required employer_user_id, so the pending insert failed with a 500.
--
-- allowed_email_domains is from migration 104. This database never got
-- that column, and the access form writes it.

ALTER TABLE companies
  ALTER COLUMN employer_user_id DROP NOT NULL;

COMMENT ON COLUMN companies.employer_user_id IS
  'Owning user. NULL until the designated owner signs in and claims the company.';

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS allowed_email_domains text[];

COMMENT ON COLUMN companies.allowed_email_domains IS
  'Email domains allowed for team invites (lowercase, exact match). NULL = never configured; empty array = deliberately domainless (owner vouches for each member); non-empty = allowlist. Set by Provven admin at company creation, editable by owner/admin.';

WITH derived AS (
  SELECT
    c.id,
    lower(split_part(coalesce(nullif(c.email, ''), c.designated_owner_email), '@', 2)) AS domain
  FROM companies c
  WHERE c.allowed_email_domains IS NULL
)
UPDATE companies c
SET allowed_email_domains = array[d.domain]
FROM derived d
WHERE c.id = d.id
  AND d.domain IS NOT NULL
  AND d.domain <> ''
  AND d.domain NOT IN (
    'gmail.com','googlemail.com','yahoo.com','ymail.com','rocketmail.com',
    'hotmail.com','outlook.com','live.com','msn.com','aol.com','icloud.com',
    'me.com','mac.com','protonmail.com','proton.me','pm.me','mail.com',
    'gmx.com','gmx.net','zoho.com','yandex.com','inbox.com','fastmail.com',
    'hey.com','tutanota.com'
  );
