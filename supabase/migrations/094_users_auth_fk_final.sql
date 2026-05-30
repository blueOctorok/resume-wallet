-- ============================================================
-- MIGRATION 094: Re-add users.id ↔ auth.users.id FK — VALIDATED (Phase 1 — T1.12.1)
-- ============================================================
-- Date: 2026-05-30
-- Purpose: Re-introduce the FK that 088 added prematurely and 089 rolled back.
--          Now safe because:
--            1. T1.12c removed wallet-based login — every NEW public.users row
--               comes from Supabase Auth with id = auth.users.id (ensureUserRow).
--            2. getOrCreateUserByWallet no longer mints fresh-UUID rows for
--               `auth:<uuid>` placeholders (code fix 2026-05-30) — it resolves by id.
--            3. Migration 093 removed the 14 legacy orphan rows.
--
-- Unlike 088 this is added WITHOUT `NOT VALID`: Postgres validates every existing
-- row at ADD time, so this statement FAILS LOUDLY if any orphan remains (run 093
-- first). That hard failure is the safety net — it cannot half-apply.
--
-- PRE-FLIGHT (must return 0 before running this file):
--   SELECT count(*) FROM public.users u
--   LEFT JOIN auth.users a ON a.id = u.id WHERE a.id IS NULL;
-- ============================================================

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_id_fkey;

ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey
  FOREIGN KEY (id)
  REFERENCES auth.users (id)
  ON DELETE CASCADE;  -- validated immediately; every row must satisfy

COMMENT ON CONSTRAINT users_id_fkey ON public.users IS
  'Storm users.id = Supabase auth.users.id. Re-added VALIDATED in T1.12.1 (2026-05-30) after the wallet path was retired and orphans cleaned (migration 093). See 088/089 history.';

COMMENT ON TABLE public.users IS
  'Storm users. id = auth.users.id, enforced by users_id_fkey (T1.12.1). Rows are created by lib/user-bootstrap.ts ensureUserRow on first Supabase sign-in.';
