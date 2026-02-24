-- ============================================================
-- Cleanup duplicate users (same wallet) — FK-safe
-- ============================================================
-- Run this BEFORE adding the unique index on users(wallet_address).
-- For each wallet with duplicates we KEEP the most recent user (by created_at)
-- and reassign all references from the older user(s) to that one, then delete.
--
-- Run in order: Step 0 (preview), then Step 1–4. Step 0 is optional.
-- ============================================================

-- Step 0 (optional): Preview duplicate wallets and which user we keep vs delete
/*
WITH duplicate_wallets AS (
  SELECT LOWER(wallet_address) AS wallet
  FROM users
  GROUP BY LOWER(wallet_address)
  HAVING COUNT(*) > 1
),
ranked AS (
  SELECT id, LOWER(wallet_address) AS wallet, created_at,
    ROW_NUMBER() OVER (PARTITION BY LOWER(wallet_address) ORDER BY created_at DESC) AS rn
  FROM users
  WHERE LOWER(wallet_address) IN (SELECT wallet FROM duplicate_wallets)
)
SELECT wallet, id, created_at,
  CASE WHEN rn = 1 THEN 'KEEP' ELSE 'DELETE' END AS action
FROM ranked
ORDER BY wallet, rn;
*/

-- ============================================================
-- Step 1: Build mapping (duplicate user id -> user id we keep)
-- ============================================================
CREATE TEMP TABLE IF NOT EXISTS user_merge_mapping (
  delete_id UUID PRIMARY KEY,
  keep_id UUID NOT NULL
);

TRUNCATE user_merge_mapping;

INSERT INTO user_merge_mapping (delete_id, keep_id)
SELECT to_delete.id AS delete_id, to_keep.id AS keep_id
FROM (
  SELECT id, LOWER(wallet_address) AS wallet,
    ROW_NUMBER() OVER (PARTITION BY LOWER(wallet_address) ORDER BY created_at DESC) AS rn
  FROM users
) to_delete
JOIN (
  SELECT id, LOWER(wallet_address) AS wallet,
    ROW_NUMBER() OVER (PARTITION BY LOWER(wallet_address) ORDER BY created_at DESC) AS rn
  FROM users
) to_keep ON to_delete.wallet = to_keep.wallet AND to_keep.rn = 1 AND to_delete.rn > 1;

-- If no duplicates, nothing to do
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM user_merge_mapping) = 0 THEN
    RAISE NOTICE 'No duplicate users found. Safe to add unique index.';
    RETURN;
  END IF;
  RAISE NOTICE 'Found % duplicate user(s) to merge', (SELECT COUNT(*) FROM user_merge_mapping);
END $$;

-- ============================================================
-- Step 2: Reassign all FKs from duplicate user -> kept user
-- ============================================================
-- Order doesn't matter for these; we only update rows that point to delete_id.

UPDATE candidate_requests cr
SET requested_by_user_id = m.keep_id
FROM user_merge_mapping m
WHERE cr.requested_by_user_id = m.delete_id;

UPDATE candidate_requests cr
SET candidate_user_id = m.keep_id
FROM user_merge_mapping m
WHERE cr.candidate_user_id = m.delete_id;

UPDATE applications a
SET applicant_user_id = m.keep_id
FROM user_merge_mapping m
WHERE a.applicant_user_id = m.delete_id;

UPDATE applications a
SET recruited_by_user_id = m.keep_id
FROM user_merge_mapping m
WHERE a.recruited_by_user_id = m.delete_id;

UPDATE company_members cm
SET user_id = m.keep_id
FROM user_merge_mapping m
WHERE cm.user_id = m.delete_id;

UPDATE company_members cm
SET invited_by = m.keep_id
FROM user_merge_mapping m
WHERE cm.invited_by = m.delete_id;

UPDATE companies c
SET employer_user_id = m.keep_id
FROM user_merge_mapping m
WHERE c.employer_user_id = m.delete_id;

UPDATE companies c
SET approved_by = m.keep_id
FROM user_merge_mapping m
WHERE c.approved_by = m.delete_id;

UPDATE companies c
SET suspended_by = m.keep_id
FROM user_merge_mapping m
WHERE c.suspended_by = m.delete_id;

UPDATE driver_applications da
SET user_id = m.keep_id
FROM user_merge_mapping m
WHERE da.user_id = m.delete_id;

UPDATE resumes r
SET user_id = m.keep_id
FROM user_merge_mapping m
WHERE r.user_id = m.delete_id;

UPDATE payments p
SET user_id = m.keep_id
FROM user_merge_mapping m
WHERE p.user_id = m.delete_id;

UPDATE mvr_orders mo
SET driver_user_id = m.keep_id
FROM user_merge_mapping m
WHERE mo.driver_user_id = m.delete_id;

UPDATE mvr_orders mo
SET employer_user_id = m.keep_id
FROM user_merge_mapping m
WHERE mo.employer_user_id = m.delete_id;

UPDATE mvr_orders mo
SET ordered_by_user_id = m.keep_id
FROM user_merge_mapping m
WHERE mo.ordered_by_user_id = m.delete_id;

UPDATE mvr_results mr
SET driver_user_id = m.keep_id
FROM user_merge_mapping m
WHERE mr.driver_user_id = m.delete_id;

UPDATE driver_leads dl
SET driver_user_id = m.keep_id
FROM user_merge_mapping m
WHERE dl.driver_user_id = m.delete_id;

UPDATE driver_leads dl
SET employer_user_id = m.keep_id
FROM user_merge_mapping m
WHERE dl.employer_user_id = m.delete_id;

UPDATE employer_candidate_data ecd
SET candidate_user_id = m.keep_id
FROM user_merge_mapping m
WHERE ecd.candidate_user_id = m.delete_id;

UPDATE employer_candidate_data ecd
SET created_by = m.keep_id
FROM user_merge_mapping m
WHERE ecd.created_by = m.delete_id;

UPDATE employer_candidate_data ecd
SET updated_by = m.keep_id
FROM user_merge_mapping m
WHERE ecd.updated_by = m.delete_id;

UPDATE developer_projects dp
SET user_id = m.keep_id
FROM user_merge_mapping m
WHERE dp.user_id = m.delete_id;

UPDATE application_invites ai
SET created_by_user_id = m.keep_id
FROM user_merge_mapping m
WHERE ai.created_by_user_id = m.delete_id;

UPDATE application_invites ai
SET used_by_user_id = m.keep_id
FROM user_merge_mapping m
WHERE ai.used_by_user_id = m.delete_id;

UPDATE company_status_history csh
SET changed_by = m.keep_id
FROM user_merge_mapping m
WHERE csh.changed_by = m.delete_id;

UPDATE employment_verification_requests evr
SET driver_id = m.keep_id
FROM user_merge_mapping m
WHERE evr.driver_id = m.delete_id;

UPDATE t_prefill_cache tpc
SET user_id = m.keep_id
FROM user_merge_mapping m
WHERE tpc.user_id = m.delete_id;

-- 1:1 tables: reassign only when kept user has no row; then drop duplicate's row to avoid unique violation
UPDATE driver_profiles dp
SET user_id = m.keep_id
FROM user_merge_mapping m
WHERE dp.user_id = m.delete_id
  AND NOT EXISTS (SELECT 1 FROM driver_profiles dp2 WHERE dp2.user_id = m.keep_id);

DELETE FROM driver_profiles
WHERE user_id IN (SELECT delete_id FROM user_merge_mapping);

UPDATE developer_profiles dp
SET user_id = m.keep_id
FROM user_merge_mapping m
WHERE dp.user_id = m.delete_id
  AND NOT EXISTS (SELECT 1 FROM developer_profiles dp2 WHERE dp2.user_id = m.keep_id);

DELETE FROM developer_profiles
WHERE user_id IN (SELECT delete_id FROM user_merge_mapping);

-- ============================================================
-- Step 3: Delete duplicate users
-- ============================================================
DELETE FROM users
WHERE id IN (SELECT delete_id FROM user_merge_mapping);

-- ============================================================
-- Step 4: Add unique index (one user per wallet)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS users_wallet_address_unique
ON users (LOWER(wallet_address));

-- Verify: no duplicates left
DO $$
DECLARE
  dup_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT LOWER(wallet_address) FROM users GROUP BY LOWER(wallet_address) HAVING COUNT(*) > 1
  ) t;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Still have duplicate wallets after cleanup: %', dup_count;
  END IF;
  RAISE NOTICE 'Cleanup complete. No duplicate wallets remain.';
END $$;
