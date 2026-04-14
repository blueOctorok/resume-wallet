-- Employer / pipeline views of a candidate career card (beyond share link counter)
CREATE TABLE IF NOT EXISTS career_card_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('talent_search', 'applicant_pipeline', 'share_link', 'other')),
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_card_views_candidate_viewed
  ON career_card_views (candidate_user_id, viewed_at DESC);

COMMENT ON TABLE career_card_views IS 'Append-only log when an employer opens a candidate career card (talent search, pipeline, etc.)';

ALTER TABLE career_card_views ENABLE ROW LEVEL SECURITY;

-- Candidates can read their own view events (aggregate in app with service role too)
CREATE POLICY "Candidates read own career_card_views"
  ON career_card_views FOR SELECT
  USING (
    candidate_user_id IN (
      SELECT id FROM users
      WHERE wallet_address = LOWER(current_setting('request.headers', true)::json->>'x-wallet-address')
    )
  );
