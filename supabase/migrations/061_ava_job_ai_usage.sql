-- Phase 2: cover letter + job-match AI quotas (separate from chat daily pool)
ALTER TABLE ava_chat_usage
  ADD COLUMN IF NOT EXISTS cover_letters_daily_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS job_match_ai_daily_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS job_match_cache JSONB,
  ADD COLUMN IF NOT EXISTS job_match_cache_at TIMESTAMPTZ;

COMMENT ON COLUMN ava_chat_usage.cover_letters_daily_used IS 'Resets with daily_reset_at; free tier before credits';
COMMENT ON COLUMN ava_chat_usage.job_match_ai_daily_used IS 'Free personalized job AI runs per UTC day (0/1)';
COMMENT ON COLUMN ava_chat_usage.job_match_cache IS 'Last scored external jobs payload for GET /api/jobs/recommended';

CREATE OR REPLACE FUNCTION increment_ava_cover_letter_daily(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE ava_chat_usage
  SET cover_letters_daily_used = cover_letters_daily_used + 1,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_ava_job_match_daily(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE ava_chat_usage
  SET job_match_ai_daily_used = job_match_ai_daily_used + 1,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
