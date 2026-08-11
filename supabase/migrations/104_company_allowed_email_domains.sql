-- Company email domain policy (2026-08-11 employer access hardening)
--
-- The domain boundary for team invites used to be DERIVED from companies.email —
-- a contact field doubling as a security field. It had three failure modes:
--   1. It silently vanished when the founding owner signed up with a consumer
--      inbox, because the match was skipped for public domains.
--   2. Editing company contact details moved an authorization boundary.
--   3. Several company-creation paths set no email at all, producing companies
--      with nothing to enforce.
--
-- Now it is declared: an admin types the domain when creating the company, at
-- exactly the moment they are already vetting the carrier.
--
-- Three states, deliberately distinguishable:
--   NULL  = never configured (legacy row) — public domains blocked, falls back
--           to matching companies.email
--   '{}'  = deliberately domainless — the owner vouches for each member; the
--           ONLY state where a consumer inbox may be invited
--   {...} = the invite address must be on this list

alter table companies
  add column if not exists allowed_email_domains text[];

comment on column companies.allowed_email_domains is
  'Email domains allowed for team invites (lowercase, exact match). NULL = never configured; empty array = deliberately domainless (owner vouches for each member); non-empty = allowlist. Set by Provven admin at company creation, editable by owner/admin.';

-- Backfill from the company contact address, then the designated owner address,
-- skipping consumer inboxes (which can never identify a company). Pace Drivers
-- becomes {pacedrivers.com}. Rows we can't derive stay NULL and fall back to
-- legacy behaviour until an admin sets them.
with derived as (
  select
    c.id,
    lower(split_part(coalesce(nullif(c.email, ''), c.designated_owner_email), '@', 2)) as domain
  from companies c
  where c.allowed_email_domains is null
)
update companies c
set allowed_email_domains = array[d.domain]
from derived d
where c.id = d.id
  and d.domain is not null
  and d.domain <> ''
  and d.domain not in (
    'gmail.com','googlemail.com','yahoo.com','ymail.com','rocketmail.com',
    'hotmail.com','outlook.com','live.com','msn.com','aol.com','icloud.com',
    'me.com','mac.com','protonmail.com','proton.me','pm.me','mail.com',
    'gmx.com','gmx.net','zoho.com','yandex.com','inbox.com','fastmail.com',
    'hey.com','tutanota.com'
  );
