-- Step 1: Verify RLS is ENABLED on all tables
-- This should show all tables with 'ENABLED' status
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN 'ENABLED'
    ELSE 'DISABLED - NEEDS FIX'
  END as rls_status
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename NOT LIKE 'pg_%'
ORDER BY 
  CASE WHEN rowsecurity THEN 0 ELSE 1 END,
  tablename;

-- Step 2: Check if critical indexes exist (for duplicate checking performance)
SELECT 
  tablename,
  indexname,
  CASE 
    WHEN indexname IS NOT NULL THEN 'EXISTS'
    ELSE 'MISSING - NEEDS FIX'
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

-- Step 3: Check unique constraints (for duplicate prevention)
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

-- Step 4: Check if the critical unique index exists
-- This prevents duplicate application submissions
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 'EXISTS - Good!'
    ELSE 'MISSING - Need to create!'
  END as idx_driver_applications_user_hash_status
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename = 'driver_applications'
AND indexname = 'idx_driver_applications_user_hash';

