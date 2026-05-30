-- ============================================================
-- MIGRATION 093: Clean up pre-cutover orphan public.users rows (Phase 1 — T1.12.1-pre)
-- ============================================================
-- Date: 2026-05-30
-- Purpose: Remove every public.users row that has NO matching auth.users row,
--          plus its child data, so 094 can add users_id_fkey as a fully
--          VALIDATED constraint (the T1.9 backfill missed these rows).
--
-- Context (verified 2026-05-30 against prod, 167 users):
--   - 14 orphans total. All are test/abandoned WALLET accounts created before
--     the T1.12c auth cutover — they have no auth.users row and wallet login is
--     gone, so they can never authenticate again.
--   - NONE own a company (companies.employer_user_id has 0 orphan rows) and there
--     are NO mvr_orders/payments among them, so no paid artifacts are destroyed.
--   - Includes 1 spurious duplicate of Pace owner s.blaha (cbe37aa1, 0 child rows)
--     minted by the getOrCreateUserByWallet placeholder bug (fixed in code 2026-05-30)
--     and 2 metro@pacedrivers.com test-employee rows (owner confirmed unimportant).
--   - The Pace OWNER s.blaha@pacedrivers.com (5f49469b) is correctly aligned and
--     is NOT an orphan — untouched here.
--
-- Idempotent / portable: the orphan set is computed by LEFT JOIN, so on a fresh
-- DB (or after this runs once) it matches nothing and the migration is a no-op.
-- No enforced FKs reference public.users, so child rows are removed explicitly.
-- ============================================================

BEGIN;

WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM application_invites WHERE candidate_user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM candidate_requests WHERE candidate_user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM career_card_views WHERE candidate_user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM employer_candidate_data WHERE candidate_user_id IN (SELECT id FROM o) OR created_by IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM ava_chat_usage WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM block_dev_github WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM block_dev_portfolio WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM block_dev_profile WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM block_driver_cdl WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM block_driver_emergency WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM block_driver_employment WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM block_driver_experience WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM block_driver_mvr WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM block_driver_psp WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM block_education WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM block_references WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM block_skills WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM career_card_lens_drafts WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM career_card_lenses WHERE user_id IN (SELECT id FROM o);
-- NOTE: career_cards is a read-only VIEW over users + user_profiles + block_* tables.
-- Its rows disappear automatically once the underlying users/block rows are deleted,
-- so there is intentionally no DELETE FROM career_cards here (would error: not updatable).
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM company_members WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM developer_projects WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM driver_applications WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM driver_leads WHERE employer_user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM hub_blocks WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM hub_onboarding WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM job_alert_preferences WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM job_alert_sent WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM messages WHERE sender_user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM mvr_orders WHERE employer_user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM notifications WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM payments WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM resumes WHERE user_id IN (SELECT id FROM o);
WITH o AS (SELECT u.id FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL)
DELETE FROM user_profiles WHERE user_id IN (SELECT id FROM o);

-- Finally, the orphan users themselves (deleted LAST so the JOIN above stays valid).
DELETE FROM public.users u
USING (
  SELECT u2.id FROM public.users u2 LEFT JOIN auth.users a ON a.id = u2.id WHERE a.id IS NULL
) orph
WHERE u.id = orph.id;

-- Safety assertion: refuse to commit unless every remaining users row has an auth row.
DO $$
DECLARE remaining int;
BEGIN
  SELECT count(*) INTO remaining
  FROM public.users u LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL;
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'Orphan cleanup incomplete: % public.users rows still have no auth.users row', remaining;
  END IF;
END $$;

COMMIT;
