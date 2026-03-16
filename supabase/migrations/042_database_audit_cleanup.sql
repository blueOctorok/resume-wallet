-- Migration 042: Database Audit Cleanup
-- Drops dead tables, views, columns, and indexes identified during the full audit.
-- Also rewrites career_cards view to use user_profiles for identity,
-- migrates users.name → user_profiles.display_name, moves date_of_birth to user_profiles,
-- and drops the users.name column.
--
-- IMPORTANT: career_cards must be dropped FIRST because it depends on columns
-- (dp.first_name, dp.city, dp.state, etc.) that we drop later. PostgreSQL will
-- refuse to drop a column that a view references.

-- ============================================================
-- STEP 1: Drop ALL views that depend on columns we're about to drop.
-- career_cards references dp.first_name, dp.city, dp.state, dp.zip_code,
-- dp.phone, devp.first_name, devp.display_name, u.email (via users).
-- complete_applications and complete_mvr_data reference users.name.
-- ============================================================
DROP VIEW IF EXISTS career_cards;
DROP VIEW IF EXISTS complete_applications;
DROP VIEW IF EXISTS complete_mvr_data;

-- ============================================================
-- STEP 2: Drop dead table
-- ============================================================
DROP TABLE IF EXISTS t_prefill_cache;

-- ============================================================
-- STEP 3: Migrate users.name → user_profiles.display_name
-- Copies name into user_profiles for any user that has a name
-- but doesn't yet have a display_name in user_profiles.
-- ============================================================
INSERT INTO user_profiles (user_id, display_name)
SELECT u.id, u.name
FROM users u
WHERE u.name IS NOT NULL
  AND u.name != ''
  AND NOT EXISTS (
    SELECT 1 FROM user_profiles up WHERE up.user_id = u.id
  )
ON CONFLICT (user_id) DO NOTHING;

UPDATE user_profiles
SET display_name = u.name
FROM users u
WHERE user_profiles.user_id = u.id
  AND user_profiles.display_name IS NULL
  AND u.name IS NOT NULL
  AND u.name != '';

-- ============================================================
-- STEP 4: Add date_of_birth to user_profiles (moved from driver_profiles)
-- ============================================================
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS date_of_birth date;

UPDATE user_profiles
SET date_of_birth = dp.date_of_birth
FROM driver_profiles dp
WHERE user_profiles.user_id = dp.user_id
  AND user_profiles.date_of_birth IS NULL
  AND dp.date_of_birth IS NOT NULL;

-- ============================================================
-- STEP 5: Drop dead columns from users
-- ============================================================
ALTER TABLE users DROP COLUMN IF EXISTS cdl_number;
ALTER TABLE users DROP COLUMN IF EXISTS cdl_state;
ALTER TABLE users DROP COLUMN IF EXISTS cdl_class;
ALTER TABLE users DROP COLUMN IF EXISTS name;

-- ============================================================
-- STEP 6: Drop dead columns from driver_profiles
-- ============================================================
ALTER TABLE driver_profiles DROP COLUMN IF EXISTS first_name;
ALTER TABLE driver_profiles DROP COLUMN IF EXISTS last_name;
ALTER TABLE driver_profiles DROP COLUMN IF EXISTS middle_name;
ALTER TABLE driver_profiles DROP COLUMN IF EXISTS email;
ALTER TABLE driver_profiles DROP COLUMN IF EXISTS phone;
ALTER TABLE driver_profiles DROP COLUMN IF EXISTS city;
ALTER TABLE driver_profiles DROP COLUMN IF EXISTS state;
ALTER TABLE driver_profiles DROP COLUMN IF EXISTS address;
ALTER TABLE driver_profiles DROP COLUMN IF EXISTS zip_code;
ALTER TABLE driver_profiles DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE driver_profiles DROP COLUMN IF EXISTS date_of_birth;

-- ============================================================
-- STEP 7: Drop dead columns from developer_profiles
-- ============================================================
ALTER TABLE developer_profiles DROP COLUMN IF EXISTS first_name;
ALTER TABLE developer_profiles DROP COLUMN IF EXISTS last_name;
ALTER TABLE developer_profiles DROP COLUMN IF EXISTS email;
ALTER TABLE developer_profiles DROP COLUMN IF EXISTS phone;
ALTER TABLE developer_profiles DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE developer_profiles DROP COLUMN IF EXISTS career_score;

-- ============================================================
-- STEP 8: Drop dead column from companies
-- ============================================================
ALTER TABLE companies DROP COLUMN IF EXISTS hiring_categories;

-- ============================================================
-- STEP 9: Drop redundant indexes
-- ============================================================
DROP INDEX IF EXISTS idx_application_invites_token;
DROP INDEX IF EXISTS idx_developer_profiles_career_score;

-- ============================================================
-- STEP 10: Recreate career_cards view using user_profiles for identity.
-- (Dropped in Step 1 to unblock column drops above.)
-- ============================================================
CREATE OR REPLACE VIEW career_cards AS
SELECT
  u.id AS user_id,
  u.wallet_address,
  up.email,
  u.created_at AS member_since,
  CASE
    WHEN dp.id IS NOT NULL THEN 'driver'::varchar
    WHEN devp.id IS NOT NULL THEN 'developer'::varchar
    ELSE u.role
  END AS role,
  dp.id AS driver_profile_id,
  devp.id AS developer_profile_id,
  TRIM(BOTH FROM CONCAT_WS(' ', up.first_name, up.last_name)) AS full_name,
  up.phone,
  up.city,
  up.state,
  up.zip_code,
  dp.experience_years AS years_experience,
  dp.cdl_class,
  dp.cdl_state,
  dp.cdl_expiration,
  COALESCE(dp.endorsements, dp.cdl_endorsements) AS endorsements,
  dp.willing_to_relocate,
  dp.preferred_job_types,
  dp.preferred_states,
  COALESCE(up.headline, devp.headline) AS headline,
  devp.github_username,
  devp.location AS dev_location,
  r.id AS resume_id,
  r.filename AS resume_file_name,
  r.structured_data AS resume_structured_data,
  r.created_at AS resume_uploaded_at,
  da.id AS driver_application_id,
  da.verification_status AS driver_application_status,
  da.created_at AS driver_application_date,
  mvr.id AS latest_mvr_id,
  mvr.status AS latest_mvr_status,
  mvr.created_at AS latest_mvr_date,
  mvr.ordered_by_company_id AS mvr_ordered_by,
  (SELECT count(*) FROM resumes WHERE resumes.user_id = u.id) AS resume_count,
  (SELECT count(*) FROM driver_applications WHERE driver_applications.user_id = u.id) AS driver_app_count,
  (SELECT count(*) FROM mvr_orders WHERE mvr_orders.driver_user_id = u.id AND mvr_orders.ordered_by_company_id IS NULL) AS mvr_count,
  CASE
    WHEN dp.employment_history IS NULL THEN 0
    WHEN jsonb_typeof(dp.employment_history) <> 'array' THEN 0
    ELSE jsonb_array_length(dp.employment_history)
  END AS work_history_count,
  (SELECT count(*) FROM employment_verification_requests evr WHERE evr.driver_id = u.id AND evr.status = 'VERIFIED') AS verified_jobs_count,
  CASE
    WHEN dp.id IS NOT NULL THEN (
      (CASE WHEN dp.id IS NOT NULL THEN 20 ELSE 0 END) +
      (CASE WHEN r.id IS NOT NULL THEN 20 ELSE 0 END) +
      (CASE WHEN da.id IS NOT NULL THEN 20 ELSE 0 END) +
      (CASE WHEN mvr.id IS NOT NULL THEN 20 ELSE 0 END) +
      (CASE WHEN dp.employment_history IS NOT NULL AND jsonb_typeof(dp.employment_history) = 'array' AND jsonb_array_length(dp.employment_history) > 0 THEN 20 ELSE 0 END)
    )
    WHEN devp.id IS NOT NULL THEN (
      (CASE WHEN devp.id IS NOT NULL THEN 25 ELSE 0 END) +
      (CASE WHEN r.id IS NOT NULL THEN 25 ELSE 0 END) +
      (CASE WHEN devp.skills IS NOT NULL AND jsonb_typeof(devp.skills) = 'array' AND jsonb_array_length(devp.skills) > 0 THEN 25 ELSE 0 END) +
      (CASE WHEN devp.github_username IS NOT NULL THEN 25 ELSE 0 END)
    )
    ELSE 0
  END AS completeness_score,
  (dp.id IS NOT NULL OR devp.id IS NOT NULL) AS has_profile,
  (r.id IS NOT NULL) AS has_resume,
  (da.id IS NOT NULL) AS has_driver_app,
  (mvr.id IS NOT NULL) AS has_mvr,
  (dp.employment_history IS NOT NULL AND jsonb_typeof(dp.employment_history) = 'array' AND jsonb_array_length(dp.employment_history) > 0) AS has_work_history
FROM users u
LEFT JOIN user_profiles up ON up.user_id = u.id
LEFT JOIN driver_profiles dp ON dp.user_id = u.id
LEFT JOIN developer_profiles devp ON devp.user_id = u.id
LEFT JOIN LATERAL (
  SELECT res.*
  FROM resumes res
  WHERE res.user_id = u.id
    AND (
      (dp.id IS NOT NULL AND res.source_role = 'driver')
      OR (dp.id IS NULL AND devp.id IS NOT NULL AND res.source_role = 'developer')
      OR (dp.id IS NULL AND devp.id IS NULL)
    )
  ORDER BY res.created_at DESC
  LIMIT 1
) r ON true
LEFT JOIN LATERAL (
  SELECT dapp.*
  FROM driver_applications dapp
  WHERE dapp.user_id = u.id
  ORDER BY dapp.created_at DESC
  LIMIT 1
) da ON true
LEFT JOIN LATERAL (
  SELECT mo.*
  FROM mvr_orders mo
  WHERE mo.driver_user_id = u.id AND mo.ordered_by_company_id IS NULL
  ORDER BY mo.created_at DESC
  LIMIT 1
) mvr ON true
WHERE up.first_name IS NOT NULL OR up.last_name IS NOT NULL OR up.display_name IS NOT NULL;
