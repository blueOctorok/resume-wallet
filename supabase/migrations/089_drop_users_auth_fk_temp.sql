-- ============================================================
-- MIGRATION 089: ROLLBACK 088 — drop premature users.id ↔ auth.users.id FK
-- ============================================================
-- Date: 2026-05-28
-- Reason: 088 broke new-user sign-up in production.
--
-- The legacy Alchemy wallet path (`getOrCreateUserByWallet`) inserts into
-- `public.users` with a fresh UUID and NO corresponding `auth.users` row.
-- 088's FK constraint enforces references on every NEW row (NOT VALID only
-- skips checks against EXISTING rows). Result: 500 on /api/user/set-role
-- for every wallet-based first-time sign-in.
--
-- The FK is correct architecturally but premature. It will be re-added in
-- a new step (T1.12.1) AFTER T1.12 cutover, when wallet-based sign-up no
-- longer exists and every new `users` row comes from Supabase Auth.
--
-- Until then, public.users.id is a free-standing UUID. The convention
-- "users.id == auth.users.id for Supabase-Auth users" is preserved by
-- `lib/user-bootstrap.ts` (T1.3), which sets users.id = authUserId on
-- first cookie sign-in. That code-level enforcement is sufficient for
-- Phase 1 dual-mode.
-- ============================================================

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_id_fkey;

COMMENT ON TABLE public.users IS
  'Storm users. id may or may not match auth.users.id during Phase 1 dual-mode (T1.4–T1.12). FK to auth.users is intentionally NOT enforced here; it will be re-added after T1.12 cutover when wallet-based user creation is removed. See migration 088/089 history and docs/midnight/EXECUTION_CHECKLIST.md step T1.12.1.';
