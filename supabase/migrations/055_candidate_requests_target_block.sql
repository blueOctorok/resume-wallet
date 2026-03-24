-- Add target_block_type to candidate_requests so we can track which block
-- was requested and look up pending requests by block ID.
ALTER TABLE candidate_requests
  ADD COLUMN IF NOT EXISTS target_block_type text;

-- Index for fast lookup of pending requests per block type
CREATE INDEX IF NOT EXISTS idx_candidate_requests_target_block
  ON candidate_requests (candidate_user_id, target_block_type)
  WHERE status IN ('pending', 'viewed');
