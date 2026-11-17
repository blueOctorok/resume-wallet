-- A portfolio resume is stored for a print on another site.
-- Provven does not show it: not the hub, not the career card, not talent search.
-- driver, developer, and general stay the roles the site reads.

ALTER TABLE resumes DROP CONSTRAINT IF EXISTS resumes_source_role_check;

ALTER TABLE resumes
  ADD CONSTRAINT resumes_source_role_check
  CHECK (source_role = ANY (ARRAY['driver'::text, 'developer'::text, 'general'::text, 'portfolio'::text]));

COMMENT ON COLUMN resumes.source_role IS
  'driver, developer, and general are shown on Provven. portfolio is a print for another site and is not displayed.';

-- The last branch of this lateral used to take any resume when the person
-- had no CDL block and no developer profile. A portfolio row would have
-- become the career-card resume. Limit that branch to the roles Provven shows.
DO $$
DECLARE
  def text;
  old_clause text := 'OR cdl.id IS NULL AND devp.id IS NULL)';
  new_clause text := 'OR cdl.id IS NULL AND devp.id IS NULL AND (res.source_role = ANY (ARRAY[''driver''::text, ''developer''::text, ''general''::text])))';
BEGIN
  def := pg_get_viewdef('career_cards'::regclass, true);
  IF position(old_clause IN def) = 0 THEN
    RAISE EXCEPTION 'career_cards view no longer has the unfiltered resume fallback';
  END IF;
  def := replace(def, old_clause, new_clause);
  EXECUTE 'CREATE OR REPLACE VIEW career_cards AS ' || def;
END $$;
