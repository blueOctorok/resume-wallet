-- One open outreach invite per company + block + email (phone when there is
-- no email). Open = pending / viewed / in_progress. Completed is a finished
-- ask and does not block a fresh invite.
--
-- Rows that already violated this are cancelled here, keeping the one someone
-- engaged with (in progress, then viewed, then a delivered link, then newest).
-- The cancelled cards land in Archive. Safe to re-run: the update matches
-- nothing the second time, and the indexes use IF NOT EXISTS.

WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY company_id, lower(btrim(candidate_email)), coalesce(target_block_type, '')
      ORDER BY
        CASE status WHEN 'in_progress' THEN 0 WHEN 'viewed' THEN 1 ELSE 2 END,
        CASE WHEN email_sent_at IS NOT NULL OR sms_sent_at IS NOT NULL THEN 0 ELSE 1 END,
        created_at DESC
    ) AS n
  FROM application_invites
  WHERE status IN ('pending', 'viewed', 'in_progress')
    AND candidate_email IS NOT NULL
    AND btrim(candidate_email) <> ''
)
UPDATE application_invites
SET status = 'cancelled', updated_at = now()
WHERE id IN (SELECT id FROM ranked WHERE n > 1);

CREATE UNIQUE INDEX IF NOT EXISTS application_invites_one_live_email_block
  ON application_invites (company_id, lower(btrim(candidate_email)), coalesce(target_block_type, ''))
  WHERE status IN ('pending', 'viewed', 'in_progress')
    AND candidate_email IS NOT NULL
    AND btrim(candidate_email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS application_invites_one_live_phone_block
  ON application_invites (company_id, candidate_phone, coalesce(target_block_type, ''))
  WHERE status IN ('pending', 'viewed', 'in_progress')
    AND candidate_phone IS NOT NULL
    AND (candidate_email IS NULL OR btrim(candidate_email) = '');
