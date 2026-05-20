-- Widen every Accio-sourced varchar column so reconcile can persist real-world responses.
--
-- We audited 106 production Accio responses (scripts/audit-accio-field-widths.mjs)
-- and found license_class hitting 105 chars and 226 distinct overflowing values:
--   "A - ANY COMBINATION OF VEHICLES WITH A GVWR OR A GROSS COMBINATION WEIGHT RATING OF 26,001 POUNDS OR MORE"
--   "COMB VEH GCWR=>26,001 LBS W/TOWED VEH(S)>10,000 LBS"
--   "PERMIT FOR COMB VEH GCWR=>26,001 LBS W/TOWED VEH(S)>10,000 LBS PLUS MOTORCYCLE"
-- license_status peaked at 48/50 chars ("B-MANDATORY SUSPENSION OR REVOCATION - SUSPENDED")
-- which is two chars from breaking us next time a state DMV adds a verbose code.
--
-- These are all vendor-controlled, state-DMV-driven free-form strings. There is
-- no product reason to truncate them and no cost difference between `text` and
-- `varchar(N)` in Postgres — `text` is the correct type. We only keep
-- varchar(2) on license_state / dl_state since those are always 2-letter state codes.
--
-- We do NOT widen our own internal status columns (mvr_orders.status,
-- psp_orders.status, *.result_status, mvr_orders.order_type, etc.) because we
-- control those string values — narrow varchar acts as a guard against
-- typos / unintended values.

BEGIN;

-- The `career_cards` view selects fee_currency from both mvr_orders and
-- psp_orders, so Postgres blocks ALTER COLUMN until the view is dropped.
-- Definition pulled via `pg_get_viewdef('career_cards', true)` so we can
-- recreate it byte-for-byte after the type changes.
DROP VIEW IF EXISTS career_cards;

ALTER TABLE mvr_results
  ALTER COLUMN license_class TYPE text,
  ALTER COLUMN license_status TYPE text,
  ALTER COLUMN medical_cert_status TYPE text;

ALTER TABLE block_driver_mvr
  ALTER COLUMN license_status TYPE text;

ALTER TABLE mvr_orders
  ALTER COLUMN fee_currency TYPE text;

ALTER TABLE psp_orders
  ALTER COLUMN fee_currency TYPE text;

-- Recreate career_cards verbatim (definition exported via pg_get_viewdef).
CREATE VIEW career_cards AS
SELECT u.id AS user_id,
    u.wallet_address,
    up.email,
    u.created_at AS member_since,
        CASE
            WHEN cdl.id IS NOT NULL THEN 'driver'::character varying
            WHEN devp.id IS NOT NULL THEN 'developer'::character varying
            ELSE u.role
        END AS role,
    cdl.id AS driver_profile_id,
    devp.id AS developer_profile_id,
    TRIM(BOTH FROM concat_ws(' '::text, up.first_name, up.last_name)) AS full_name,
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
    ( SELECT count(*) AS count
           FROM resumes
          WHERE resumes.user_id = u.id) AS resume_count,
    ( SELECT count(*) AS count
           FROM driver_applications
          WHERE driver_applications.user_id = u.id) AS driver_app_count,
    ( SELECT count(*) AS count
           FROM mvr_orders
          WHERE mvr_orders.driver_user_id = u.id AND mvr_orders.ordered_by_company_id IS NULL) AS mvr_count,
    ( SELECT count(*) AS count
           FROM psp_orders
          WHERE psp_orders.driver_user_id = u.id AND psp_orders.ordered_by_company_id IS NULL) AS psp_count,
        CASE
            WHEN emp.history IS NULL THEN 0
            WHEN jsonb_typeof(emp.history) <> 'array'::text THEN 0
            ELSE jsonb_array_length(emp.history)
        END AS work_history_count,
    ( SELECT count(*) AS count
           FROM employment_verification_requests evr
          WHERE evr.driver_id = u.id AND (evr.status = ANY (ARRAY['VERIFIED'::text, 'PARTIALLY_VERIFIED'::text]))) AS verified_jobs_count,
        CASE
            WHEN cdl.id IS NOT NULL THEN
            CASE
                WHEN cdl.id IS NOT NULL THEN 20
                ELSE 0
            END +
            CASE
                WHEN r.id IS NOT NULL THEN 20
                ELSE 0
            END +
            CASE
                WHEN da.id IS NOT NULL THEN 20
                ELSE 0
            END +
            CASE
                WHEN mvr.id IS NOT NULL THEN 20
                ELSE 0
            END +
            CASE
                WHEN psp.id IS NOT NULL THEN 20
                ELSE 0
            END +
            CASE
                WHEN emp.history IS NOT NULL AND jsonb_typeof(emp.history) = 'array'::text AND jsonb_array_length(emp.history) > 0 THEN 20
                ELSE 0
            END
            WHEN devp.id IS NOT NULL THEN
            CASE
                WHEN devp.id IS NOT NULL THEN 25
                ELSE 0
            END +
            CASE
                WHEN r.id IS NOT NULL THEN 25
                ELSE 0
            END +
            CASE
                WHEN sk.entries IS NOT NULL AND jsonb_typeof(sk.entries) = 'array'::text AND jsonb_array_length(sk.entries) > 0 THEN 25
                ELSE 0
            END +
            CASE
                WHEN gh.username IS NOT NULL THEN 25
                ELSE 0
            END
            ELSE 0
        END AS completeness_score,
    cdl.id IS NOT NULL OR devp.id IS NOT NULL AS has_profile,
    r.id IS NOT NULL AS has_resume,
    da.id IS NOT NULL AS has_driver_app,
    mvr.id IS NOT NULL AS has_mvr,
    psp.id IS NOT NULL AS has_psp,
    emp.history IS NOT NULL AND jsonb_typeof(emp.history) = 'array'::text AND jsonb_array_length(emp.history) > 0 AS has_work_history
   FROM users u
     LEFT JOIN user_profiles up ON up.user_id = u.id
     LEFT JOIN block_driver_cdl cdl ON cdl.user_id = u.id
     LEFT JOIN block_driver_employment emp ON emp.user_id = u.id
     LEFT JOIN block_dev_profile devp ON devp.user_id = u.id
     LEFT JOIN block_dev_github gh ON gh.user_id = u.id
     LEFT JOIN block_skills sk ON sk.user_id = u.id
     LEFT JOIN LATERAL ( SELECT res.id,
            res.user_id,
            res.title,
            res.filename,
            res.file_hash,
            res.ipfs_hash,
            res.ipfs_url,
            res.file_size,
            res.mime_type,
            res.is_public,
            res.verification_status,
            res.is_paid,
            res.blockchain_tx_hash,
            res.blockchain_resume_id,
            res.extracted_data,
            res.created_at,
            res.resume_type,
            res.structured_data,
            res.source_resume_id,
            res.source_role
           FROM resumes res
          WHERE res.user_id = u.id AND (cdl.id IS NOT NULL AND res.source_role = 'driver'::text OR cdl.id IS NULL AND devp.id IS NOT NULL AND res.source_role = 'developer'::text OR cdl.id IS NULL AND devp.id IS NULL)
          ORDER BY res.created_at DESC
         LIMIT 1) r ON true
     LEFT JOIN LATERAL ( SELECT dapp.id,
            dapp.user_id,
            dapp.application_data,
            dapp.application_hash,
            dapp.ipfs_hash,
            dapp.current_step,
            dapp.is_complete,
            dapp.verification_status,
            dapp.is_paid,
            dapp.blockchain_tx_hash,
            dapp.blockchain_application_id,
            dapp.created_at,
            dapp.updated_at
           FROM driver_applications dapp
          WHERE dapp.user_id = u.id
          ORDER BY dapp.created_at DESC
         LIMIT 1) da ON true
     LEFT JOIN LATERAL ( SELECT mo.id,
            mo.driver_user_id,
            mo.driver_profile_id,
            mo.driver_application_id,
            mo.accio_order_number,
            mo.accio_suborder_number,
            mo.accio_remote_order_number,
            mo.accio_remote_suborder_number,
            mo.order_type,
            mo.mvr_search_type,
            mo.dl_number,
            mo.dl_state,
            mo.status,
            mo.order_xml,
            mo.result_xml,
            mo.ordered_at,
            mo.processed_at,
            mo.completed_at,
            mo.expires_at,
            mo.fee_amount,
            mo.fee_currency,
            mo.error_message,
            mo.error_code,
            mo.created_at,
            mo.updated_at,
            mo.applicant_portal_url,
            mo.payment_id,
            mo.payment_tx_hash,
            mo.employer_user_id,
            mo.employer_company_id,
            mo.ordered_by_employer,
            mo.ordered_by_company_id,
            mo.ordered_by_user_id,
            mo.is_shared
           FROM mvr_orders mo
          WHERE mo.driver_user_id = u.id AND mo.ordered_by_company_id IS NULL
          ORDER BY mo.created_at DESC
         LIMIT 1) mvr ON true
     LEFT JOIN LATERAL ( SELECT po.id,
            po.driver_user_id,
            po.payment_id,
            po.payment_tx_hash,
            po.accio_order_number,
            po.accio_suborder_number,
            po.accio_remote_order_number,
            po.accio_remote_suborder_number,
            po.dl_number,
            po.dl_state,
            po.status,
            po.order_xml,
            po.result_xml,
            po.ordered_at,
            po.processed_at,
            po.completed_at,
            po.expires_at,
            po.fee_amount,
            po.fee_currency,
            po.error_message,
            po.error_code,
            po.ordered_by_company_id,
            po.ordered_by_user_id,
            po.ordered_by_employer,
            po.created_at,
            po.updated_at
           FROM psp_orders po
          WHERE po.driver_user_id = u.id AND po.ordered_by_company_id IS NULL
          ORDER BY po.created_at DESC
         LIMIT 1) psp ON true
  WHERE (up.first_name IS NOT NULL OR up.last_name IS NOT NULL OR up.display_name IS NOT NULL)
    AND u.role::text IS DISTINCT FROM 'employer'::text;

COMMIT;
