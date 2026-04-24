-- 062_external_job_requirements.sql
--
-- Cached LLM-extracted structured requirements for external (e.g. Adzuna) jobs.
-- Keyed by provider job id + source so `computeJobFit` can score Adzuna postings
-- with the same checklist rigor as Storm-native `role_requirements` (Phase 4+).

CREATE TABLE IF NOT EXISTS public.external_job_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL,
  source text NOT NULL,
  requirements_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  extracted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_job_requirements_job_source UNIQUE (job_id, source)
);

CREATE INDEX IF NOT EXISTS idx_external_job_requirements_job_id
  ON public.external_job_requirements (job_id);

COMMENT ON TABLE public.external_job_requirements IS
  'LLM-extracted hiring requirements for external job listings; used for deterministic fit scoring.';
