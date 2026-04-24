-- 068_career_card_lenses.sql
--
-- Career Card Lenses (Phase 1): presentation layer over one block-backed career
-- card. Blocks stay the single source of truth; lenses hold filter + emphasis +
-- optional custom summary so the same card can be re-framed per job.
--
-- Every user gets exactly one default "Full profile" lens (visible_block_types
-- NULL = show everything). All other lenses are optional and non-default.

CREATE TABLE IF NOT EXISTS public.career_card_lenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  -- NULL = show all installed blocks (Full profile). Empty array = show none
  -- (rare; allowed for edge cases but UI will never do this).
  visible_block_types text[] NULL,
  emphasized_block_types text[] NULL,
  custom_summary text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT career_card_lenses_name_nonempty CHECK (char_length(trim(name)) > 0)
);

-- Exactly one default lens per user. Lets us efficiently find "the lens to use
-- when none specified" and prevents duplicate-default drift.
CREATE UNIQUE INDEX IF NOT EXISTS ux_career_card_lenses_one_default_per_user
  ON public.career_card_lenses (user_id)
  WHERE (is_default = true);

CREATE INDEX IF NOT EXISTS idx_career_card_lenses_user_id
  ON public.career_card_lenses (user_id);

COMMENT ON TABLE public.career_card_lenses IS
  'Presentation lenses over one block-backed career card; NULL visible_block_types = full profile.';

-- Keep updated_at honest.
CREATE OR REPLACE FUNCTION public.touch_career_card_lenses_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_career_card_lenses_updated_at ON public.career_card_lenses;

CREATE TRIGGER trg_career_card_lenses_updated_at
  BEFORE UPDATE ON public.career_card_lenses
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_career_card_lenses_updated_at();

-- Backfill: every existing user gets one default lens named "Full profile".
INSERT INTO public.career_card_lenses (user_id, name, is_default, visible_block_types, emphasized_block_types, custom_summary)
SELECT u.id, 'Full profile', true, NULL, NULL, NULL
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.career_card_lenses c
  WHERE c.user_id = u.id AND c.is_default = true
);

-- New wallet users: default lens row follows the user row via trigger.
CREATE OR REPLACE FUNCTION public.ensure_default_career_card_lens_for_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.career_card_lenses (user_id, name, is_default, visible_block_types, emphasized_block_types)
  SELECT NEW.id, 'Full profile', true, NULL, NULL
  WHERE NOT EXISTS (
    SELECT 1 FROM public.career_card_lenses c WHERE c.user_id = NEW.id AND c.is_default = true
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_default_career_card_lens ON public.users;

CREATE TRIGGER trg_users_default_career_card_lens
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_default_career_card_lens_for_user();

-- Defense-in-depth RLS: table is only read/written by service-role API routes.
-- Same pattern as `external_job_requirements` + `employer_access_requests`.
ALTER TABLE public.career_card_lenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages career card lenses"
  ON public.career_card_lenses
  FOR ALL
  USING (true)
  WITH CHECK (true);
