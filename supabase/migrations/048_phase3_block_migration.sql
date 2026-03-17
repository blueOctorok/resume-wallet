-- Migration 048: Phase 3 — Complete block migration
--
-- 1. Rewrite career_cards view to use block tables instead of driver_profiles/developer_profiles
-- 2. Rewrite search_talent() to match updated view
-- 3. Drop FK constraints that reference driver_profiles/developer_profiles
-- 4. Drop the trigger that auto-updates driver_profiles from mvr_results

-- ============================================================================
-- Step 1: Drop and recreate career_cards view using block tables
-- ============================================================================

DROP VIEW IF EXISTS career_cards;

CREATE OR REPLACE VIEW career_cards AS
SELECT
  u.id AS user_id,
  u.wallet_address,
  up.email,
  u.created_at AS member_since,
  CASE
    WHEN cdl.id IS NOT NULL THEN 'driver'::varchar
    WHEN devp.id IS NOT NULL THEN 'developer'::varchar
    ELSE u.role
  END AS role,
  cdl.id AS driver_profile_id,
  devp.id AS developer_profile_id,
  TRIM(BOTH FROM CONCAT_WS(' ', up.first_name, up.last_name)) AS full_name,
  up.phone,
  up.city,
  up.state,
  up.zip_code,
  NULL::integer AS years_experience,
  cdl.cdl_class,
  cdl.cdl_state,
  cdl.cdl_expiration,
  cdl.endorsements,
  NULL::boolean AS willing_to_relocate,
  NULL::text[] AS preferred_job_types,
  NULL::text[] AS preferred_states,
  COALESCE(up.headline, devp.bio) AS headline,
  gh.username AS github_username,
  NULL::text AS dev_location,
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
    WHEN emp.history IS NULL THEN 0
    WHEN jsonb_typeof(emp.history) <> 'array' THEN 0
    ELSE jsonb_array_length(emp.history)
  END AS work_history_count,
  (SELECT count(*) FROM employment_verification_requests evr WHERE evr.driver_id = u.id AND evr.status = 'VERIFIED') AS verified_jobs_count,
  CASE
    WHEN cdl.id IS NOT NULL THEN (
      (CASE WHEN cdl.id IS NOT NULL THEN 20 ELSE 0 END) +
      (CASE WHEN r.id IS NOT NULL THEN 20 ELSE 0 END) +
      (CASE WHEN da.id IS NOT NULL THEN 20 ELSE 0 END) +
      (CASE WHEN mvr.id IS NOT NULL THEN 20 ELSE 0 END) +
      (CASE WHEN emp.history IS NOT NULL AND jsonb_typeof(emp.history) = 'array' AND jsonb_array_length(emp.history) > 0 THEN 20 ELSE 0 END)
    )
    WHEN devp.id IS NOT NULL THEN (
      (CASE WHEN devp.id IS NOT NULL THEN 25 ELSE 0 END) +
      (CASE WHEN r.id IS NOT NULL THEN 25 ELSE 0 END) +
      (CASE WHEN sk.entries IS NOT NULL AND jsonb_typeof(sk.entries) = 'array' AND jsonb_array_length(sk.entries) > 0 THEN 25 ELSE 0 END) +
      (CASE WHEN gh.username IS NOT NULL THEN 25 ELSE 0 END)
    )
    ELSE 0
  END AS completeness_score,
  (cdl.id IS NOT NULL OR devp.id IS NOT NULL) AS has_profile,
  (r.id IS NOT NULL) AS has_resume,
  (da.id IS NOT NULL) AS has_driver_app,
  (mvr.id IS NOT NULL) AS has_mvr,
  (emp.history IS NOT NULL AND jsonb_typeof(emp.history) = 'array' AND jsonb_array_length(emp.history) > 0) AS has_work_history
FROM users u
LEFT JOIN user_profiles up ON up.user_id = u.id
LEFT JOIN block_driver_cdl cdl ON cdl.user_id = u.id
LEFT JOIN block_driver_employment emp ON emp.user_id = u.id
LEFT JOIN block_dev_profile devp ON devp.user_id = u.id
LEFT JOIN block_dev_github gh ON gh.user_id = u.id
LEFT JOIN block_skills sk ON sk.user_id = u.id
LEFT JOIN LATERAL (
  SELECT res.*
  FROM resumes res
  WHERE res.user_id = u.id
    AND (
      (cdl.id IS NOT NULL AND res.source_role = 'driver')
      OR (cdl.id IS NULL AND devp.id IS NOT NULL AND res.source_role = 'developer')
      OR (cdl.id IS NULL AND devp.id IS NULL)
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
WHERE
  (up.first_name IS NOT NULL OR up.last_name IS NOT NULL OR up.display_name IS NOT NULL)
  AND u.role IS DISTINCT FROM 'employer';

-- ============================================================================
-- Step 2: Recreate search_talent() to match new view
-- ============================================================================

DROP FUNCTION IF EXISTS search_talent(TEXT, TEXT[], TEXT, INT, BOOLEAN, BOOLEAN, TEXT[], TEXT, INT, INT);

CREATE OR REPLACE FUNCTION search_talent(
  p_role           TEXT     DEFAULT NULL,
  p_cdl_class      TEXT[]   DEFAULT NULL,
  p_state          TEXT     DEFAULT NULL,
  p_min_experience INT      DEFAULT NULL,
  p_has_mvr        BOOLEAN  DEFAULT NULL,
  p_has_driver_app BOOLEAN  DEFAULT NULL,
  p_endorsements   TEXT[]   DEFAULT NULL,
  p_search_text    TEXT     DEFAULT NULL,
  p_limit          INT      DEFAULT 50,
  p_offset         INT      DEFAULT 0
)
RETURNS TABLE (
  user_id            UUID,
  full_name          TEXT,
  email              TEXT,
  city               TEXT,
  state              TEXT,
  years_experience   INT,
  cdl_class          VARCHAR,
  endorsements       TEXT[],
  completeness_score INT,
  has_mvr            BOOLEAN,
  has_driver_app     BOOLEAN,
  has_resume         BOOLEAN,
  verified_jobs_count BIGINT,
  member_since       TIMESTAMP WITH TIME ZONE,
  role               VARCHAR
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.user_id,
    cc.full_name,
    cc.email,
    cc.city,
    cc.state,
    cc.years_experience,
    cc.cdl_class,
    cc.endorsements,
    cc.completeness_score,
    cc.has_mvr,
    cc.has_driver_app,
    cc.has_resume,
    cc.verified_jobs_count,
    cc.member_since,
    cc.role
  FROM career_cards cc
  WHERE
    (p_role IS NULL OR cc.role = p_role)
    AND (p_cdl_class IS NULL OR cc.cdl_class = ANY(p_cdl_class))
    AND (p_state IS NULL OR cc.state = p_state)
    AND (p_min_experience IS NULL OR cc.years_experience >= p_min_experience)
    AND (p_has_mvr IS NULL OR cc.has_mvr = p_has_mvr)
    AND (p_has_driver_app IS NULL OR cc.has_driver_app = p_has_driver_app)
    AND (p_endorsements IS NULL OR cc.endorsements @> p_endorsements)
    AND (p_search_text IS NULL OR (
      cc.full_name         ILIKE '%' || p_search_text || '%' OR
      cc.city              ILIKE '%' || p_search_text || '%' OR
      cc.email             ILIKE '%' || p_search_text || '%' OR
      cc.headline          ILIKE '%' || p_search_text || '%' OR
      cc.github_username   ILIKE '%' || p_search_text || '%'
    ))
  ORDER BY cc.completeness_score DESC, cc.member_since DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION search_talent IS 'Search for candidates with filters — uses block tables via career_cards view. Updated in 048 to remove driver_profiles/developer_profiles dependency.';

-- ============================================================================
-- Step 3: Drop FK constraints referencing driver_profiles / developer_profiles
-- ============================================================================

-- mvr_orders.driver_profile_id FK
ALTER TABLE mvr_orders DROP CONSTRAINT IF EXISTS mvr_orders_driver_profile_id_fkey;

-- mvr_results.driver_profile_id FK
ALTER TABLE mvr_results DROP CONSTRAINT IF EXISTS mvr_results_driver_profile_id_fkey;

-- driver_leads.driver_profile_id FK
ALTER TABLE driver_leads DROP CONSTRAINT IF EXISTS driver_leads_driver_profile_id_fkey;

-- developer_projects.developer_profile_id FK
ALTER TABLE developer_projects DROP CONSTRAINT IF EXISTS developer_projects_developer_profile_id_fkey;

-- ============================================================================
-- Step 4: Drop the trigger that auto-updates driver_profiles from mvr_results
-- ============================================================================

DROP TRIGGER IF EXISTS update_driver_profile_mvr_trigger ON mvr_results;
DROP FUNCTION IF EXISTS update_driver_profile_mvr();
