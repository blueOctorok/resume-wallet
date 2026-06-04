-- D4: Supabase Storage for candidate documents (replaces Pinata/IPFS)
-- ~7 test IPFS docs are not migrated; new uploads use storage_path.

ALTER TABLE resumes
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

ALTER TABLE resumes
  ALTER COLUMN ipfs_hash DROP NOT NULL;

ALTER TABLE driver_applications
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

CREATE INDEX IF NOT EXISTS idx_resumes_storage_path ON resumes (storage_path);
CREATE INDEX IF NOT EXISTS idx_driver_applications_storage_path ON driver_applications (storage_path);

COMMENT ON COLUMN resumes.storage_path IS 'Private Supabase Storage object path (bucket: resumes), e.g. {user_id}/{uuid}-file.pdf';
COMMENT ON COLUMN driver_applications.storage_path IS 'Private Supabase Storage object path (bucket: dot-applications)';

-- Private buckets (signed URLs issued server-side)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'resumes',
    'resumes',
    false,
    5242880,
    ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]::text[]
  ),
  (
    'dot-applications',
    'dot-applications',
    false,
    10485760,
    ARRAY['application/pdf']::text[]
  ),
  (
    'screening-reports',
    'screening-reports',
    false,
    20971520,
    ARRAY['application/pdf', 'application/xml', 'text/xml']::text[]
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS: users read/write objects under their own {user_id}/ prefix
CREATE POLICY "resumes_owner_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "resumes_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "resumes_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "resumes_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "dot_apps_owner_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'dot-applications' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "dot_apps_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'dot-applications' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "dot_apps_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'dot-applications' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "dot_apps_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'dot-applications' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "screening_reports_owner_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'screening-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "screening_reports_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'screening-reports' AND (storage.foldername(name))[1] = auth.uid()::text);
