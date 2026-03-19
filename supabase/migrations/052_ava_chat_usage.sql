-- ava_chat_usage: per-user daily free message tracking + purchased credits
CREATE TABLE IF NOT EXISTS ava_chat_usage (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  daily_used     INTEGER NOT NULL DEFAULT 0,
  daily_reset_at DATE NOT NULL DEFAULT CURRENT_DATE,
  credits        INTEGER NOT NULL DEFAULT 0,
  total_messages INTEGER NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ava_chat_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage (for the UI badge)
CREATE POLICY "Users can read own ava_chat_usage"
  ON ava_chat_usage FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users
      WHERE wallet_address = LOWER(current_setting('request.headers', true)::json->>'x-wallet-address')
    )
  );

-- Server (service role) bypasses RLS for all writes via getAdminSupabaseClient

-- Atomic daily increment (avoids read-then-write race conditions)
CREATE OR REPLACE FUNCTION increment_ava_daily(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE ava_chat_usage
  SET daily_used = daily_used + 1,
      total_messages = total_messages + 1,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic credit consume
CREATE OR REPLACE FUNCTION consume_ava_credit(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE ava_chat_usage
  SET credits = GREATEST(0, credits - 1),
      total_messages = total_messages + 1,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
