-- ============================================================
-- MIGRATION 004: Enable RLS on All Tables (IMMEDIATE)
-- ============================================================
-- Run this NOW to enable RLS on all tables
-- Safe because all server operations use service role (bypasses RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE mvr_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE mvr_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE t_prefill_cache ENABLE ROW LEVEL SECURITY;

-- Add missing RLS policies for tables that need them

-- Payments table policies
DROP POLICY IF EXISTS "Users can view their own payments" ON payments;
CREATE POLICY "Users can view their own payments"
  ON payments FOR SELECT
  USING (user_id = auth.uid());

-- t_prefill_cache table policies
DROP POLICY IF EXISTS "Users can view their own cache entries" ON t_prefill_cache;
CREATE POLICY "Users can view their own cache entries"
  ON t_prefill_cache FOR SELECT
  USING (user_id = auth.uid());

-- Verify RLS is enabled
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

