-- 069_application_lens_snapshot.sql
--
-- Career Card Lenses (Phase 4): snapshot the lens used at submit time so the
-- employer always sees the framing the candidate intended. If the candidate
-- later renames/deletes the lens, the submitted application is unaffected.
--
-- `ON DELETE SET NULL` instead of CASCADE — losing the lens row should NOT
-- wipe the application; the UI just falls back to "(lens unavailable)".

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS lens_id_snapshot uuid
    REFERENCES public.career_card_lenses (id) ON DELETE SET NULL;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS lens_name_snapshot text;

CREATE INDEX IF NOT EXISTS idx_applications_lens_id_snapshot
  ON public.applications (lens_id_snapshot);

COMMENT ON COLUMN public.applications.lens_id_snapshot IS
  'Career Card Lens in effect when this application was submitted. Read-only once set.';
COMMENT ON COLUMN public.applications.lens_name_snapshot IS
  'Denormalized lens name at submit time so employer UI stays stable if the lens is later renamed or deleted.';
