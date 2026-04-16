-- Per-wallet (user row): when set, candidate hub walkthrough / Stormi tips modals stay off until cleared.
-- Mirrors pattern of ava_auto_welcome_* columns — server writes via admin client + wallet header.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stormi_walkthrough_dismissed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.users.stormi_walkthrough_dismissed_at IS
  'When set, candidate hub Stormi walkthrough + related tips are suppressed for this account (cross-device). Cleared when user re-enables Journey Tips.';
