-- Final Schema Verification - Check External Jobs Unique Index

-- Check if external jobs unique index exists
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 'EXISTS ✅ - Prevents duplicate external job imports'
    ELSE 'MISSING ⚠️ - Not critical but recommended'
  END as external_jobs_index_status,
  COALESCE(indexdef, 'N/A') as index_definition
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname = 'idx_job_postings_external_unique';

-- Final Summary Report
SELECT 
  'FINAL STATUS' as report_section,
  'RLS Enabled' as item,
  COUNT(*) FILTER (WHERE rowsecurity) || '/' || COUNT(*) as status
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename NOT LIKE 'pg_%'

UNION ALL

SELECT 
  'FINAL STATUS',
  'Tables with RLS Policies',
  COUNT(DISTINCT tablename) || ' tables'
FROM pg_policies 
WHERE schemaname = 'public'

UNION ALL

SELECT 
  'FINAL STATUS',
  'Critical Indexes',
  COUNT(*) || '/3 exist'
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname IN (
  'idx_resumes_file_hash',
  'idx_driver_applications_application_hash',
  'idx_users_wallet_address'
)

UNION ALL

SELECT 
  'FINAL STATUS',
  'Critical Unique Index',
  CASE 
    WHEN COUNT(*) > 0 THEN 'EXISTS ✅'
    ELSE 'MISSING ❌'
  END
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename = 'driver_applications'
AND indexname = 'idx_driver_applications_user_hash';

