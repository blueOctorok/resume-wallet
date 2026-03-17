-- Migration 045: Fix search_talent() return type + exclude employers from career_cards
--
-- 1. career_cards view from 042 accidentally includes employers because its
--    WHERE clause only checks for a user_profiles name. Employers shouldn't
--    appear in talent search. We add: AND u.role IS DISTINCT FROM 'employer'.
--
-- 2. search_talent() declared role TEXT but career_cards returns VARCHAR.
--    PostgreSQL won't allow the mismatch: "structure of query does not match
--    function result type". We recreate the function with role VARCHAR.

-- ── Step 1: Recreate career_cards view excluding employers ───────────────────

DROP VIEW IF EXISTS career_cards;

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
WHERE
  (up.first_name IS NOT NULL OR up.last_name IS NOT NULL OR up.display_name IS NOT NULL)
  AND u.role IS DISTINCT FROM 'employer';

-- ── Step 2: Fix search_talent() return type ──────────────────────────────────

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
    COALESCE(cc.city, split_part(COALESCE(cc.dev_location, ''), ',', 1)) AS city,
    COALESCE(
      cc.state,
      NULLIF(TRIM(split_part(COALESCE(cc.dev_location, ''), ',', 2)), '')
    ) AS state,
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
    AND (
      p_state IS NULL
      OR cc.state = p_state
      OR TRIM(split_part(COALESCE(cc.dev_location, ''), ',', 2)) = p_state
    )
    AND (p_min_experience IS NULL OR cc.years_experience >= p_min_experience)
    AND (p_has_mvr IS NULL OR cc.has_mvr = p_has_mvr)
    AND (p_has_driver_app IS NULL OR cc.has_driver_app = p_has_driver_app)
    AND (p_endorsements IS NULL OR cc.endorsements @> p_endorsements)
    AND (p_search_text IS NULL OR (
      cc.full_name         ILIKE '%' || p_search_text || '%' OR
      cc.city              ILIKE '%' || p_search_text || '%' OR
      cc.email             ILIKE '%' || p_search_text || '%' OR
      cc.dev_location      ILIKE '%' || p_search_text || '%' OR
      cc.headline          ILIKE '%' || p_search_text || '%' OR
      cc.github_username   ILIKE '%' || p_search_text || '%'
    ))
  ORDER BY cc.completeness_score DESC, cc.member_since DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION search_talent IS 'Search for candidates with filters — used by employer talent search. Updated in 045 to match career_cards column types after 042 view rewrite.';
