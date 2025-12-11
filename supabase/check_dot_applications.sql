-- Check if DOT applications are being saved to the database

-- 1. Count total applications
SELECT 
  'Total Applications' as metric,
  COUNT(*) as count
FROM driver_applications;

-- 2. Count by completion status
SELECT 
  'Applications by Status' as metric,
  is_complete,
  COUNT(*) as count
FROM driver_applications
GROUP BY is_complete
ORDER BY is_complete;

-- 3. Count by step
SELECT 
  'Applications by Step' as metric,
  current_step,
  COUNT(*) as count
FROM driver_applications
GROUP BY current_step
ORDER BY current_step;

-- 4. Recent applications (last 10)
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
  END as has_hash
FROM driver_applications
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check if any have blockchain transaction hashes
SELECT 
  'Blockchain Status' as metric,
  COUNT(*) FILTER (WHERE blockchain_tx_hash IS NOT NULL) as with_blockchain_tx,
  COUNT(*) FILTER (WHERE blockchain_tx_hash IS NULL) as without_blockchain_tx
FROM driver_applications;

