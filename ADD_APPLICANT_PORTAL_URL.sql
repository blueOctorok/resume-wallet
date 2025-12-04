-- Add applicant_portal_url column to mvr_orders table
-- This URL is returned by Accio when SuppressApplicantPortalEmail is used
-- The portal allows applicants to provide additional information if needed

ALTER TABLE mvr_orders 
ADD COLUMN IF NOT EXISTS applicant_portal_url TEXT;

COMMENT ON COLUMN mvr_orders.applicant_portal_url IS 'Accio applicant portal URL for additional information collection';

