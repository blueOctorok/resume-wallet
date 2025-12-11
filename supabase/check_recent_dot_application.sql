-- Check the most recent DOT application to verify it saved correctly

SELECT 
  id,
  user_id,
  current_step,
  is_complete,
  application_hash,
  blockchain_tx_hash,
  blockchain_application_id,
  created_at,
  updated_at,
  CASE 
    WHEN application_data IS NOT NULL THEN 'HAS DATA ✅'
    ELSE 'NO DATA ❌'
  END as has_application_data,
  CASE 
    WHEN application_data->'form1' IS NOT NULL THEN 'HAS FORM1 ✅'
    ELSE 'NO FORM1'
  END as has_form1,
  CASE 
    WHEN application_data->'form2' IS NOT NULL THEN 'HAS FORM2 ✅'
    ELSE 'NO FORM2'
  END as has_form2,
  CASE 
    WHEN application_data->'form3' IS NOT NULL THEN 'HAS FORM3 ✅'
    ELSE 'NO FORM3'
  END as has_form3
FROM driver_applications
ORDER BY created_at DESC
LIMIT 5;

-- Check application_data structure for the most recent one
SELECT 
  id,
  jsonb_object_keys(application_data) as data_keys
FROM driver_applications
WHERE application_data IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;

