-- ============================================================
-- MIGRATION 019: Fix Security Definer Views
-- ============================================================
-- 
-- Purpose: Address Supabase security linter warnings by converting
-- SECURITY DEFINER views to SECURITY INVOKER views.
--
-- Problem: Views with SECURITY DEFINER execute with the permissions
-- of the view OWNER (usually a superuser), bypassing RLS policies.
-- This means users could potentially access data they shouldn't.
--
-- Solution: Set security_invoker = true on views, which makes them
-- respect the RLS policies of the QUERYING user instead.
--
-- Affected views:
--   - public.complete_applications
--   - public.complete_mvr_data
-- ============================================================

-- Fix complete_applications view
-- This view joins applications with user profiles and job postings
ALTER VIEW complete_applications SET (security_invoker = true);

-- Fix complete_mvr_data view  
-- This view joins MVR orders with results and driver info
ALTER VIEW complete_mvr_data SET (security_invoker = true);

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- 
-- What was changed:
--   ✅ complete_applications view now uses SECURITY INVOKER
--   ✅ complete_mvr_data view now uses SECURITY INVOKER
--
-- Why this matters:
--   - Views now respect RLS policies of the querying user
--   - Users can only see data they're authorized to access
--   - Supabase security linter warnings resolved
--
-- Note: If you need superuser access for specific operations,
-- consider using SECURITY DEFINER functions with explicit
-- permission checks instead of views.
-- ============================================================
