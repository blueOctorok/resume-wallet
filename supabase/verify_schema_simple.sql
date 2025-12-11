-- Simple Schema Verification - Run each section separately if needed

-- 1. Check if critical indexes exist
SELECT 
  tablename,
  indexname,
  'EXISTS' as status
FROM pg_indexes 
WHERE schemaname = 'public' 
AND (
  (tablename = 'resumes' AND indexname = 'idx_resumes_file_hash')
  OR (tablename = 'driver_applications' AND indexname = 'idx_driver_applications_application_hash')
  OR (tablename = 'users' AND indexname = 'idx_users_wallet_address')
)
ORDER BY tablename;

-- 2. Check RLS status on all tables
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN 'ENABLED'
    ELSE 'DISABLED'
  END as rls_status
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;

-- 3. Check unique constraints on critical tables
SELECT 
  conrelid::regclass::text as table_name,
  conname as constraint_name
FROM pg_constraint 
WHERE contype = 'u' 
AND conrelid::regclass::text IN ('driver_applications', 'job_postings', 'mvr_orders')
ORDER BY table_name;

-- 4. Check RLS policies count per table
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

