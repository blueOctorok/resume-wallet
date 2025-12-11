-- Verify the latest DOT application has all data saved correctly

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
    WHEN application_hash IS NOT NULL THEN 'HAS HASH ✅'
    ELSE 'NO HASH ❌'
  END as has_application_hash,
  CASE 
    WHEN blockchain_tx_hash IS NOT NULL THEN 'HAS TX HASH ✅'
    ELSE 'NO TX HASH ❌'
  END as has_blockchain_tx,
  CASE 
    WHEN application_data IS NOT NULL THEN 'HAS DATA ✅'
    ELSE 'NO DATA ❌'
  END as has_application_data
FROM driver_applications
ORDER BY created_at DESC
LIMIT 3;

