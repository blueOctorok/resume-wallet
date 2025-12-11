-- Check details of existing DOT applications

-- 1. View application details
SELECT 
  id,
  user_id,
  current_step,
  is_complete,
  created_at,
  updated_at,
  CASE 
    WHEN application_data IS NOT NULL THEN 'HAS DATA ✅'
    ELSE 'NO DATA ❌'
  END as has_application_data,
  CASE 
    WHEN application_hash IS NOT NULL THEN 'HAS HASH ✅'
    ELSE 'NO HASH'
  END as has_hash,
  CASE 
    WHEN blockchain_tx_hash IS NOT NULL THEN 'BLOCKCHAIN ✅'
    ELSE 'NO BLOCKCHAIN'
  END as blockchain_status
FROM driver_applications
ORDER BY created_at DESC;

-- 2. Check if application_data has content
SELECT 
  id,
  jsonb_typeof(application_data) as data_type,
  jsonb_object_keys(application_data) as data_keys
FROM driver_applications
WHERE application_data IS NOT NULL
LIMIT 1;

