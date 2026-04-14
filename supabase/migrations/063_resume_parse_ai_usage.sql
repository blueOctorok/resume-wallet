-- Resume AI parse quota (1 free/day like cover letters, then credits)
ALTER TABLE ava_chat_usage
  ADD COLUMN IF NOT EXISTS resume_parse_daily_used INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN ava_chat_usage.resume_parse_daily_used IS 'Resets with daily_reset_at; free AI resume parses per UTC day before credits';

CREATE OR REPLACE FUNCTION increment_ava_resume_parse_daily(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE ava_chat_usage
  SET resume_parse_daily_used = resume_parse_daily_used + 1,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
