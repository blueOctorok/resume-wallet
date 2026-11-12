-- Driver Documents block: papers the driver uploaded (insurance, authority, registration).
-- One row per user. The files themselves live in the private driver-documents bucket.
-- Resume lines built from these files are self-reported. They are not attestations.

CREATE TABLE IF NOT EXISTS block_driver_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  documents   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

COMMENT ON TABLE block_driver_documents IS
  'Files a driver uploaded and the slots read from them. Accepted lines may appear on the resume. Not issuer-verified.';

ALTER TABLE block_driver_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'block_driver_documents'
      AND policyname = 'service_role_all_block_driver_documents'
  ) THEN
    CREATE POLICY service_role_all_block_driver_documents
      ON block_driver_documents
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'driver-documents',
  'driver-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "driver_documents_owner_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'driver-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "driver_documents_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'driver-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "driver_documents_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'driver-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "driver_documents_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'driver-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Files a company attaches to one driver (an outside DOT app, a paper application).
-- The driver has no policy on this table. Signed URLs are issued by the API.

CREATE TABLE IF NOT EXISTS employer_driver_files (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  uploaded_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  kind                TEXT NOT NULL CHECK (kind IN ('dot_application', 'application', 'other')),
  filename            TEXT NOT NULL,
  content_type        TEXT NOT NULL,
  storage_path        TEXT NOT NULL,
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employer_driver_files_company_candidate
  ON employer_driver_files (company_id, candidate_user_id, created_at DESC);

COMMENT ON TABLE employer_driver_files IS
  'Company-private files on a driver card. The candidate cannot read these rows.';

ALTER TABLE employer_driver_files ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'employer_driver_files'
      AND policyname = 'service_role_all_employer_driver_files'
  ) THEN
    CREATE POLICY service_role_all_employer_driver_files
      ON employer_driver_files
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employer-driver-files',
  'employer-driver-files',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
