-- Fixed query to check critical indexes (for duplicate checking performance)
SELECT 
  expected.tablename,
  expected.indexname,
  CASE 
    WHEN i.indexname IS NOT NULL THEN 'EXISTS ✅'
    ELSE 'MISSING ❌ - NEEDS FIX'
  END as status
FROM (
  SELECT 'resumes' as tablename, 'idx_resumes_file_hash' as indexname
  UNION ALL 
  SELECT 'driver_applications', 'idx_driver_applications_application_hash'
  UNION ALL 
  SELECT 'users', 'idx_users_wallet_address'
) expected
LEFT JOIN pg_indexes i ON 
  i.tablename = expected.tablename 
  AND i.indexname = expected.indexname
  AND i.schemaname = 'public'
ORDER BY expected.tablename;

