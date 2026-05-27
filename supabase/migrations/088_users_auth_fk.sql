-- ============================================================
-- MIGRATION 088: users.id ↔ auth.users.id (Phase 1 — T1.3)
-- ============================================================
-- Date: 2026-05-27
-- Purpose: Document and enforce the convention that public.users.id
--          equals auth.users.id for all Supabase Auth sign-ups.
--
-- NOT VALID: existing wallet-only rows have no auth.users row until
--           T1.9 backfill. New inserts still require a matching
--           auth.users row (enforced for rows created after this migration).
--
-- After T1.9 backfill completes:
--   ALTER TABLE public.users VALIDATE CONSTRAINT users_id_fkey;
-- ============================================================

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_id_fkey;

ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey
  FOREIGN KEY (id)
  REFERENCES auth.users (id)
  ON DELETE CASCADE
  NOT VALID;

COMMENT ON CONSTRAINT users_id_fkey ON public.users IS
  'Storm users.id must match Supabase auth.users.id. Added NOT VALID in T1.3; run VALIDATE CONSTRAINT after T1.9 auth.users backfill.';
