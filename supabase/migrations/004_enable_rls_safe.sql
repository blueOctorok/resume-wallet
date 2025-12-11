-- ============================================================
-- MIGRATION 004: Enable RLS Safely for Production
-- ============================================================
-- Date: [Current Date]
-- Purpose: Enable Row Level Security on all tables for production security
-- Dependencies: Requires all previous migrations (000-003)
-- 
-- IMPORTANT NOTES:
--   1. This migration assumes server-side operations use service role key (admin client)
--   2. RLS policies use auth.uid() which requires Supabase Auth
--   3. Since we use Alchemy wallet auth, client-side direct DB access may be limited
--   4. All API routes should use admin client (service role) to bypass RLS
-- 
-- SAFETY: This migration enables RLS but all server operations bypass it via service role
-- ============================================================

-- ============================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================
-- Enable RLS on all public tables that have policies defined

-- Users table (has policies defined in migration 000)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Driver applications (has policies defined in migration 000)
-- Note: Already has ALTER TABLE ... ENABLE ROW LEVEL SECURITY in migration, but ensuring it's enabled
ALTER TABLE driver_applications ENABLE ROW LEVEL SECURITY;

-- Resumes (has policies defined in migration 000)
-- Note: Already has ALTER TABLE ... ENABLE ROW LEVEL SECURITY in migration, but ensuring it's enabled
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

-- Companies (has policies defined in migration 001)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Job postings (has policies defined in migration 001)
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;

-- Applications (has policies defined in migration 001)
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Driver profiles (has policies defined in migration 002)
ALTER TABLE driver_profiles ENABLE ROW LEVEL SECURITY;

-- Application views (has policies defined in migration 002)
ALTER TABLE application_views ENABLE ROW LEVEL SECURITY;

-- MVR orders (has policies defined in migration 003)
ALTER TABLE mvr_orders ENABLE ROW LEVEL SECURITY;

-- MVR results (has policies defined in migration 003)
ALTER TABLE mvr_results ENABLE ROW LEVEL SECURITY;

-- Payments table (needs RLS - no policies defined yet, add basic policy)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policy for payments (users can view their own payments)
CREATE POLICY IF NOT EXISTS "Users can view their own payments"
  ON payments FOR SELECT
  USING (user_id = auth.uid());

-- t_prefill_cache table (needs RLS - no policies defined yet)
ALTER TABLE t_prefill_cache ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policy for t_prefill_cache (users can view their own cache entries)
CREATE POLICY IF NOT EXISTS "Users can view their own cache entries"
  ON t_prefill_cache FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- 2. VERIFY ALL POLICIES EXIST
-- ============================================================
-- This section documents what policies should exist

/*
POLICIES THAT SHOULD EXIST (from previous migrations):

users:
  - "Users can view own profile"
  - "Users can update own profile"
  - "Allow user registration"

driver_applications:
  - "Users can view own applications"
  - "Users can insert own applications"
  - "Users can update own applications"

resumes:
  - "Users can view own resumes"
  - "Users can insert own resumes"
  - "Users can update own resumes"
  - "Users can delete own resumes"

companies:
  - "Employers can view their own company"
  - "Employers can create their own company"
  - "Employers can update their own company"
  - "All users can view verified companies"

job_postings:
  - "Employers can view their own job postings"
  - "Employers can create job postings"
  - "Employers can update their own job postings"
  - "Employers can delete their own job postings"
  - "All users can view active job postings"

applications:
  - "Drivers can view their own applications"
  - "Drivers can create their own applications"
  - "Drivers can update their own applications"
  - "Employers can view applications to their jobs"
  - "Employers can update applications to their jobs"

driver_profiles:
  - "Users can view their own driver profile"
  - "Users can insert their own driver profile"
  - "Users can update their own driver profile"

application_views:
  - "Anyone can insert application views"
  - "Users can view their application analytics"

mvr_orders:
  - "Drivers can view their own MVR orders"
  - "Drivers can create their own MVR orders"
  - "Service role can update MVR orders"

mvr_results:
  - "Drivers can view their own MVR results"
  - "Service role can insert MVR results"
  - "Service role can update MVR results"
*/

-- ============================================================
-- 3. IMPORTANT: Alchemy Auth vs Supabase Auth
-- ============================================================
/*
CRITICAL UNDERSTANDING:

We use Alchemy Smart Wallets for authentication (wallet-based, not Supabase Auth).
This means:
  - auth.uid() in RLS policies will be NULL for client requests
  - RLS policies won't work for direct client-side DB access
  - This is EXPECTED and SAFE

WHY IT'S SAFE:

1. Server-Side Operations Use Service Role:
   - All API routes use getAdminSupabaseClient() (service role key)
   - Service role bypasses RLS completely (by design)
   - Example: /api/resumes/upload, /api/driver-applications/*, etc.

2. Client-Side Access Goes Through API Routes:
   - No direct client-side DB queries
   - All data access goes through Next.js API routes
   - API routes validate wallet addresses server-side

3. RLS Still Provides Security:
   - Blocks unauthorized direct DB access attempts
   - Defense in depth against SQL injection via direct DB access
   - Prevents accidental exposure of direct DB queries

4. Current Architecture is Correct:
   ✅ Server-side: Service role (bypasses RLS, validates wallet addresses)
   ✅ Client-side: API routes only (validated server-side)
   ✅ RLS: Enabled for defense in depth

FUTURE ENHANCEMENT (if needed):
  - Could create custom RLS functions using wallet_address
  - Would require PostgreSQL functions that check wallet_address
  - Not necessary with current architecture (all access via API routes)
*/

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- After running this migration:
--   1. Verify all tables have RLS enabled (check Supabase dashboard)
--   2. Test API routes (should work - they use service role)
--   3. Verify client-side direct DB access is blocked (expected behavior)
--   4. Monitor for any issues in production
-- ============================================================

