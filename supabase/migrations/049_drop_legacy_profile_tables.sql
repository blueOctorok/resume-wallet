-- Migration 049: Phase 4 — Drop legacy profile tables
--
-- After Phase 3 (migration 048 + route rewrites), no code reads from or writes
-- to driver_profiles or developer_profiles. All data now lives in block_* tables.
-- This migration drops the dead tables to finish the cleanup.
--
-- Pre-conditions (all met by migration 048):
--   - career_cards view rewritten to use block tables
--   - search_talent() rewritten to use block tables
--   - FK constraints from mvr_orders, mvr_results, driver_leads, developer_projects dropped
--   - update_driver_profile_mvr trigger dropped

-- ============================================================================
-- Step 1: Drop driver_profiles
-- ============================================================================

-- Safety: drop any remaining policies that might block the DROP
DROP POLICY IF EXISTS "Drivers can view own profile" ON driver_profiles;
DROP POLICY IF EXISTS "Drivers can update own profile" ON driver_profiles;
DROP POLICY IF EXISTS "Drivers can insert own profile" ON driver_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON driver_profiles;
DROP POLICY IF EXISTS "Service role full access" ON driver_profiles;
DROP POLICY IF EXISTS "service_role_all_driver_profiles" ON driver_profiles;

DROP TABLE IF EXISTS driver_profiles CASCADE;

-- ============================================================================
-- Step 2: Drop developer_profiles
-- ============================================================================

DROP POLICY IF EXISTS "Developers can view own profile" ON developer_profiles;
DROP POLICY IF EXISTS "Developers can update own profile" ON developer_profiles;
DROP POLICY IF EXISTS "Developers can insert own profile" ON developer_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON developer_profiles;
DROP POLICY IF EXISTS "Service role full access" ON developer_profiles;
DROP POLICY IF EXISTS "service_role_all_developer_profiles" ON developer_profiles;

DROP TABLE IF EXISTS developer_profiles CASCADE;
