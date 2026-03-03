-- ============================================================
-- MIGRATION 024: Fix career_cards role filter
-- ============================================================
-- Problem: career_cards filtered `WHERE u.role IN ('driver', 'developer')`
-- This meant that if a dev/admin wallet switches to 'employer' role for testing,
-- their driver data disappears from talent search.
--
-- In production, a person IS a driver candidate if they have a driver_profiles
-- record with real data — regardless of what role they're currently logged in as.
-- Fix: include anyone with a driver_profiles record that has a first_name.
-- ============================================================

CREATE OR REPLACE VIEW career_cards AS
SELECT 
  u.id AS user_id,
  u.wallet_address,
  u.email,
  u.role,
  u.created_at AS member_since,
  
  -- Driver profile data
  dp.id AS driver_profile_id,
  TRIM(CONCAT_WS(' ', dp.first_name, dp.middle_name, dp.last_name)) AS full_name,
  dp.phone,
  dp.city,
  dp.state,
  dp.zip_code,
  dp.experience_years AS years_experience,
  dp.cdl_class,
  dp.cdl_state,
  dp.cdl_expiration,
  COALESCE(dp.endorsements, dp.cdl_endorsements) AS endorsements,
  dp.willing_to_relocate,
  dp.preferred_job_types,
  dp.preferred_states,
  
  -- Resume info
  r.id AS resume_id,
  r.filename AS resume_file_name,
  r.structured_data AS resume_structured_data,
  r.created_at AS resume_uploaded_at,
  
  -- Driver application status (DOT form)
  da.id AS driver_application_id,
  da.verification_status AS driver_application_status,
  da.created_at AS driver_application_date,
  
  -- MVR status (most recent)
  mvr.id AS latest_mvr_id,
  mvr.status AS latest_mvr_status,
  mvr.created_at AS latest_mvr_date,
  mvr.ordered_by_company_id AS mvr_ordered_by,
  
  -- Aggregated counts
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
  
  -- Completeness score (0-100)
  (
    CASE WHEN dp.id IS NOT NULL THEN 20 ELSE 0 END +
    CASE WHEN r.id IS NOT NULL THEN 20 ELSE 0 END +
    CASE WHEN da.id IS NOT NULL THEN 20 ELSE 0 END +
    CASE WHEN mvr.id IS NOT NULL THEN 20 ELSE 0 END +
    CASE 
      WHEN dp.employment_history IS NOT NULL 
        AND jsonb_typeof(dp.employment_history) = 'array' 
        AND jsonb_array_length(dp.employment_history) > 0 
      THEN 20 
      ELSE 0 
    END
  ) AS completeness_score,
  
  -- Flags for quick filtering
  dp.id IS NOT NULL AS has_profile,
  r.id IS NOT NULL AS has_resume,
  da.id IS NOT NULL AS has_driver_app,
  mvr.id IS NOT NULL AS has_mvr,
  (dp.employment_history IS NOT NULL 
    AND jsonb_typeof(dp.employment_history) = 'array' 
    AND jsonb_array_length(dp.employment_history) > 0) AS has_work_history

FROM users u
LEFT JOIN driver_profiles dp ON dp.user_id = u.id
LEFT JOIN LATERAL (
  SELECT * FROM resumes res WHERE res.user_id = u.id ORDER BY res.created_at DESC LIMIT 1
) r ON true
LEFT JOIN LATERAL (
  SELECT * FROM driver_applications dapp WHERE dapp.user_id = u.id ORDER BY dapp.created_at DESC LIMIT 1
) da ON true
LEFT JOIN LATERAL (
  SELECT * FROM mvr_orders mo WHERE mo.driver_user_id = u.id ORDER BY mo.created_at DESC LIMIT 1
) mvr ON true
-- Show users who are drivers/developers, OR who have a populated driver profile
-- (handles role-switching during dev and future multi-role scenarios)
WHERE u.role IN ('driver', 'developer')
   OR (dp.id IS NOT NULL AND dp.first_name IS NOT NULL);

-- Preserve security_invoker setting
ALTER VIEW career_cards SET (security_invoker = true);
