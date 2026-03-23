-- One-time AvA auto-welcome per account (candidate hub vs employer hub), cross-device.
-- Set by /api/ai/chat when an auto-welcome request completes (success, duplicate short-circuit, or 402).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ava_auto_welcome_candidate_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS ava_auto_welcome_employer_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.users.ava_auto_welcome_candidate_at IS 'Set when candidate hub auto-welcome flow finished (AI reply, duplicate skip, or out-of-credits).';
COMMENT ON COLUMN public.users.ava_auto_welcome_employer_at IS 'Set when employer hub auto-welcome flow finished (AI reply, duplicate skip, or out-of-credits).';
