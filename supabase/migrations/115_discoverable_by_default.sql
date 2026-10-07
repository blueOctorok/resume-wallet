-- Self-serve candidates are findable. Migration 112 defaulted new sign-ups
-- off, so anyone who joined after that never appeared in employer search
-- (Pace included) until they answered the hub prompt. Nobody has opted out:
-- every hidden row has discoverable_prompt_seen_at null. Flip those, and
-- make the column default on so the next signup is in search immediately.
-- An explicit "hide me" still wins; this update skips answered rows.

ALTER TABLE users
  ALTER COLUMN discoverable_to_employers SET DEFAULT true;

UPDATE users
SET discoverable_to_employers = true
WHERE discoverable_to_employers = false
  AND role::text IS DISTINCT FROM 'employer'
  AND discoverable_prompt_seen_at IS NULL;

COMMENT ON COLUMN users.discoverable_to_employers IS
  'When true, the candidate appears in employer talent search (career_cards). Defaults on. The hub prompt and share modal can turn it off; that choice is kept.';
