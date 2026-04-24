-- 067_ui_mode_preference.sql
--
-- Adds `users.ui_mode_preference` so a candidate's chosen chrome (Simple mode
-- vs Hub workspace) is portable across devices. Client still keeps a
-- localStorage copy for instant UX; this column is the server source of truth
-- read at hub load and written on every ModeToggle flip.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ui_mode_preference text
    NOT NULL DEFAULT 'simple'
    CHECK (ui_mode_preference IN ('simple', 'hub'));

COMMENT ON COLUMN public.users.ui_mode_preference IS
  'Candidate UI chrome: simple (job-first split view) or hub (composable workspace). Default simple for new users.';
