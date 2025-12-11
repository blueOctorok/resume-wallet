-- ============================================================
-- VERIFY CRITICAL INDEXES AND UNIQUE CONSTRAINTS
-- ============================================================

-- 1. Check Critical Indexes (for duplicate checking performance)
SELECT 
  tablename,
  indexname,
  CASE 
    WHEN indexname IS NOT NULL THEN 'EXISTS ✅'
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
ORDER BY tablename;

-- 2. Check Unique Constraints (for duplicate prevention)
SELECT 
  conrelid::regclass::text as table_name,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE contype = 'u' 
AND conrelid::regclass::text IN (
  'driver_applications',
  'job_postings', 
  'mvr_orders'
)
ORDER BY table_name, constraint_name;

-- 3. Check Critical Unique Index (prevents duplicate submissions)
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 'EXISTS ✅ - Good!'
    ELSE 'MISSING ❌ - Need to create!'
  END as idx_driver_applications_user_hash_status
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename = 'driver_applications'
AND indexname = 'idx_driver_applications_user_hash';

