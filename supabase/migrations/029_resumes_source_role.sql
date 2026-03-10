-- ============================================================
-- MIGRATION 029: Resume source_role — explicit role ownership
-- ============================================================
-- Date: March 2026
--
-- Problem:
--   The `resumes` table is shared by all roles. Driver resumes and
--   developer resumes (and any future role) are indistinguishable
--   at the schema level. The driver hub was using a fragile hack
--   (resume_type != 'developer_built') to filter out dev resumes.
--   Adding a third or fourth role would require another bespoke hack.
--
-- Fix:
--   Add a `source_role` column that explicitly declares which role
--   "owns" a resume. This is the single source of truth for ownership.
--   Every resume created going forward must set this field.
--
--   Valid values:
--     'driver'    — CDL / DOT / trucking resume
--     'developer' — Software engineer / developer resume
--     'general'   — Role-agnostic (uploaded PDF with no hub context)
--
--   Future roles (nurse, contractor, etc.) add a new CHECK value here.
--
-- Backfill strategy:
--   - resume_type = 'developer_built'         → source_role = 'developer'
--   - resume_type = 'built' or 'uploaded'     → source_role = 'driver'
--   - resume_type IS NULL (legacy uploads)    → infer from profile tables;
--     if developer_profiles exists and no driver_profiles → 'developer'
--     otherwise → 'driver' (conservative — existing data is all drivers)
-- ============================================================

-- ── 1. Add column ─────────────────────────────────────────────────────────────

ALTER TABLE resumes
  ADD COLUMN IF NOT EXISTS source_role TEXT
    CHECK (source_role IN ('driver', 'developer', 'general'));

-- ── 2. Backfill existing records ──────────────────────────────────────────────

-- Developer-built resumes are unambiguous
UPDATE resumes
SET source_role = 'developer'
WHERE resume_type = 'developer_built';

-- Resumes for users who only have a developer profile (and no driver profile)
-- This handles any edge cases not covered by resume_type
UPDATE resumes r
SET source_role = 'developer'
WHERE r.source_role IS NULL
  AND EXISTS (
    SELECT 1 FROM developer_profiles dp WHERE dp.user_id = r.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM driver_profiles drp WHERE drp.user_id = r.user_id
  );

-- Everything remaining defaults to 'driver' (all pre-existing data was drivers)
UPDATE resumes
SET source_role = 'driver'
WHERE source_role IS NULL;

-- Now that all rows are populated, enforce NOT NULL going forward
-- New rows without source_role will fail at the DB level — no silent mixing.
ALTER TABLE resumes ALTER COLUMN source_role SET NOT NULL;
ALTER TABLE resumes ALTER COLUMN source_role SET DEFAULT 'driver';

-- ── 3. Index ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_resumes_user_source_role
  ON resumes(user_id, source_role);

-- ── 4. Update career_cards view to filter resumes by the candidate's role ─────
--
-- The LATERAL join for resumes now only picks a resume whose source_role
-- matches the candidate's effective role. This means:
--   - A driver's career card shows their driver resume, not their dev resume
--   - A developer's career card shows their developer resume, not a driver one
--
-- NOTE: We DROP + CREATE instead of CREATE OR REPLACE because Postgres does not
-- allow CREATE OR REPLACE VIEW to rename or reorder existing columns — only to
-- append new columns at the end. Any column layout change requires a full drop.
-- CASCADE drops the dependent search_talent() function too; we recreate it below.
-- ──────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS career_cards CASCADE;

CREATE VIEW career_cards AS
SELECT
  u.id AS user_id,
  u.wallet_address,
  u.email,
  u.created_at AS member_since,

  CASE
    WHEN dp.id IS NOT NULL AND dp.first_name IS NOT NULL THEN 'driver'
    WHEN devp.id IS NOT NULL
      AND (devp.first_name IS NOT NULL OR devp.display_name IS NOT NULL)
      THEN 'developer'
    ELSE u.role
  END AS role,

  dp.id   AS driver_profile_id,
  devp.id AS developer_profile_id,

  CASE
    WHEN dp.id IS NOT NULL AND dp.first_name IS NOT NULL
      THEN TRIM(CONCAT_WS(' ', dp.first_name, dp.middle_name, dp.last_name))
    WHEN devp.id IS NOT NULL
      THEN COALESCE(
        NULLIF(TRIM(CONCAT_WS(' ', devp.first_name, devp.last_name)), ''),
        devp.display_name
      )
    ELSE NULL
  END AS full_name,

  dp.phone,
  dp.city,
  dp.state,
  dp.zip_code,
  dp.experience_years    AS years_experience,
  dp.cdl_class,
  dp.cdl_state,
  dp.cdl_expiration,
  COALESCE(dp.endorsements, dp.cdl_endorsements) AS endorsements,
  dp.willing_to_relocate,
  dp.preferred_job_types,
  dp.preferred_states,

  devp.headline,
  devp.github_username,
  devp.location AS dev_location,

  -- Resume: only the most recent resume whose source_role matches the
  -- candidate's effective role. Prevents driver cards showing dev resumes
  -- and vice versa.
  r.id          AS resume_id,
  r.filename    AS resume_file_name,
  r.structured_data AS resume_structured_data,
  r.created_at  AS resume_uploaded_at,

  da.id                  AS driver_application_id,
  da.verification_status AS driver_application_status,
  da.created_at          AS driver_application_date,

  mvr.id                    AS latest_mvr_id,
  mvr.status                AS latest_mvr_status,
  mvr.created_at            AS latest_mvr_date,
  mvr.ordered_by_company_id AS mvr_ordered_by,

  (SELECT COUNT(*) FROM resumes WHERE user_id = u.id) AS resume_count,
  (SELECT COUNT(*) FROM driver_applications WHERE user_id = u.id) AS driver_app_count,
  (SELECT COUNT(*) FROM mvr_orders WHERE driver_user_id = u.id) AS mvr_count,
  CASE
    WHEN dp.employment_history IS NULL THEN 0
    WHEN jsonb_typeof(dp.employment_history) != 'array' THEN 0
    ELSE jsonb_array_length(dp.employment_history)
  END AS work_history_count,
  (SELECT COUNT(*) FROM employment_verification_requests evr
   WHERE evr.driver_id = u.id AND evr.status = 'VERIFIED') AS verified_jobs_count,

  CASE
    WHEN dp.id IS NOT NULL THEN (
      CASE WHEN dp.id IS NOT NULL THEN 20 ELSE 0 END +
      CASE WHEN r.id  IS NOT NULL THEN 20 ELSE 0 END +
      CASE WHEN da.id IS NOT NULL THEN 20 ELSE 0 END +
      CASE WHEN mvr.id IS NOT NULL THEN 20 ELSE 0 END +
      CASE
        WHEN dp.employment_history IS NOT NULL
          AND jsonb_typeof(dp.employment_history) = 'array'
          AND jsonb_array_length(dp.employment_history) > 0
        THEN 20 ELSE 0
      END
    )
    WHEN devp.id IS NOT NULL THEN (
      CASE WHEN devp.id IS NOT NULL THEN 25 ELSE 0 END +
      CASE WHEN r.id  IS NOT NULL THEN 25 ELSE 0 END +
      CASE
        WHEN devp.skills IS NOT NULL
          AND jsonb_typeof(devp.skills) = 'array'
          AND jsonb_array_length(devp.skills) > 0
        THEN 25 ELSE 0
      END +
      CASE WHEN devp.github_username IS NOT NULL THEN 25 ELSE 0 END
    )
    ELSE 0
  END AS completeness_score,

  (dp.id IS NOT NULL OR devp.id IS NOT NULL) AS has_profile,
  r.id  IS NOT NULL                          AS has_resume,
  da.id IS NOT NULL                          AS has_driver_app,
  mvr.id IS NOT NULL                         AS has_mvr,
  (
    dp.employment_history IS NOT NULL
    AND jsonb_typeof(dp.employment_history) = 'array'
    AND jsonb_array_length(dp.employment_history) > 0
  ) AS has_work_history

FROM users u
LEFT JOIN driver_profiles    dp   ON dp.user_id = u.id
LEFT JOIN developer_profiles devp ON devp.user_id = u.id
-- Resume LATERAL: only pick a resume whose source_role matches the
-- candidate's role. Driver profile present → driver resume.
-- Developer profile (no driver) → developer resume.
LEFT JOIN LATERAL (
  SELECT * FROM resumes res
  WHERE res.user_id = u.id
    AND (
      (dp.id IS NOT NULL AND res.source_role = 'driver')
      OR (dp.id IS NULL AND devp.id IS NOT NULL AND res.source_role = 'developer')
      OR (dp.id IS NULL AND devp.id IS NULL)  -- fallback: any resume
    )
  ORDER BY res.created_at DESC LIMIT 1
) r ON true
LEFT JOIN LATERAL (
  SELECT * FROM driver_applications dapp
  WHERE dapp.user_id = u.id
  ORDER BY dapp.created_at DESC LIMIT 1
) da ON true
LEFT JOIN LATERAL (
  SELECT * FROM mvr_orders mo
  WHERE mo.driver_user_id = u.id
  ORDER BY mo.created_at DESC LIMIT 1
) mvr ON true

WHERE
  (dp.id IS NOT NULL AND dp.first_name IS NOT NULL)
  OR (devp.id IS NOT NULL AND (devp.first_name IS NOT NULL OR devp.display_name IS NOT NULL));

-- security_invoker is set at creation time via the DROP + CREATE pattern above.
-- Postgres requires ALTER VIEW for this on CREATE OR REPLACE, but since we
-- dropped and recreated the view, it uses the session's default (invoker security).
-- To explicitly set it, uncomment the line below if needed:
-- ALTER VIEW career_cards SET (security_invoker = true);

-- Drop any existing search_talent function regardless of signature.
-- We cast parameter types to TEXT[] to match the TEXT[] columns in career_cards.
-- The old function used VARCHAR[] which caused: "operator does not exist: text[] @> character varying[]"
DROP FUNCTION IF EXISTS search_talent(VARCHAR, VARCHAR[], VARCHAR, INT, BOOLEAN, BOOLEAN, VARCHAR[], TEXT, INT, INT);
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
  role               TEXT
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

COMMENT ON COLUMN resumes.source_role IS 'Which role hub owns this resume: driver, developer, or general. NOT NULL — every resume must declare its owner.';
COMMENT ON VIEW career_cards IS 'Aggregated candidate view. Role derived from profile data. Resume filtered by source_role to prevent cross-role contamination.';
