-- ============================================================
-- MIGRATION 010: Remove CHECK constraint from users.role
-- ============================================================
-- Purpose: Allow any role value (driver, developer, employer, future roles)
-- Validation now happens in API (/api/user/set-role) instead of DB
-- This gives flexibility to add new roles without migrations
-- ============================================================

-- Drop existing CHECK on users.role (common name: users_role_check)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Drop any other CHECK constraints on users that reference 'role'
-- (in case the constraint has a different auto-generated name)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'users' AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- No new CHECK added — validation is in the API
-- Valid roles (as of Jan 2026): driver, developer, employer
-- To add a new role: update /api/user/set-role allowed list + UI

COMMENT ON COLUMN users.role IS 'User type (driver, developer, employer, etc.). Validated by API, not DB constraint. NULL = not yet selected.';
