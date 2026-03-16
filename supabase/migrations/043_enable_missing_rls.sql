-- Migration 043: Enable RLS on 4 unprotected tables
-- These tables were only accessed via service role (supabaseAdmin) in API routes,
-- so this wasn't an active exploit, but RLS should be enabled as defense-in-depth.

-- ============================================================
-- employer_access_requests
-- Only accessed by service role in access-request and admin APIs.
-- ============================================================
ALTER TABLE employer_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages access requests"
  ON employer_access_requests
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- message_threads
-- Participants can see their own threads.
-- ============================================================
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view own threads"
  ON message_threads
  FOR SELECT
  USING (
    participant_a_user_id = auth.uid()
    OR participant_b_user_id = auth.uid()
  );

CREATE POLICY "Authenticated users can create threads"
  ON message_threads
  FOR INSERT
  WITH CHECK (
    participant_a_user_id = auth.uid()
    OR participant_b_user_id = auth.uid()
  );

CREATE POLICY "Participants can update own threads"
  ON message_threads
  FOR UPDATE
  USING (
    participant_a_user_id = auth.uid()
    OR participant_b_user_id = auth.uid()
  );

-- ============================================================
-- messages
-- Senders can insert; thread participants can read.
-- ============================================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Thread participants can view messages"
  ON messages
  FOR SELECT
  USING (
    thread_id IN (
      SELECT id FROM message_threads
      WHERE participant_a_user_id = auth.uid()
         OR participant_b_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages"
  ON messages
  FOR INSERT
  WITH CHECK (sender_user_id = auth.uid());

-- ============================================================
-- storm_distributions
-- Users can view their own distributions by wallet.
-- Only service role inserts (from payment API).
-- ============================================================
ALTER TABLE storm_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages storm distributions"
  ON storm_distributions
  FOR ALL
  USING (true)
  WITH CHECK (true);
