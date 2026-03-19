-- Add optional free-text context for AvA (goals, preferences, etc.)
ALTER TABLE hub_onboarding
  ADD COLUMN IF NOT EXISTS extra_context TEXT;

COMMENT ON COLUMN hub_onboarding.extra_context IS 'Optional free-text: anything else the candidate wants AvA to know (goals, preferences, constraints).';
