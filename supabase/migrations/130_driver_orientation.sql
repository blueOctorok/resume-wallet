-- Driver product story. A fast close is not "they learned it", so this is
-- not a single dismissed_at flag. The welcome, the five-beat story, and the
-- one-line hints on resume / jobs / messages each record their own fact.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS driver_orientation jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.users.driver_orientation IS
  'Driver orientation memory: opened the story, marked got it, welcome auto-show count and last time, one long-gap nudge, and first-time hints for resume, jobs, and messages.';
