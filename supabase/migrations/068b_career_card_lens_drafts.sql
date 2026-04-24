-- 068b_career_card_lens_drafts.sql
--
-- Career Card Lenses (Phase 3): cache for Stormi-drafted lens proposals.
-- Keyed by (user_id, job_id, source) so re-clicking the same job does NOT
-- re-bill Haiku. The draft is ephemeral — once the user saves it, we create
-- a real row in `career_card_lenses` and the draft can sit in the cache
-- forever without consequence.

CREATE TABLE IF NOT EXISTS public.career_card_lens_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  job_id text NOT NULL,
  source text NOT NULL DEFAULT 'adzuna',
  -- { name, visible_block_types, emphasized_block_types, summary } exactly as
  -- Haiku returned it (or the heuristic fallback). We re-validate shape on
  -- read so a schema change never crashes a cache hit.
  draft_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT career_card_lens_drafts_unique UNIQUE (user_id, job_id, source)
);

CREATE INDEX IF NOT EXISTS idx_career_card_lens_drafts_user
  ON public.career_card_lens_drafts (user_id, created_at DESC);

COMMENT ON TABLE public.career_card_lens_drafts IS
  'Cache of Stormi-drafted lens proposals per user/job. Saving a draft creates a real career_card_lenses row; drafts can stay cached indefinitely.';

ALTER TABLE public.career_card_lens_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages lens drafts"
  ON public.career_card_lens_drafts
  FOR ALL
  USING (true)
  WITH CHECK (true);
