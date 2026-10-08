-- Driver license photos + the barcode read taken from the back of the card.
-- The images are "on file." They are not a DMV record and are not attested.

CREATE TABLE IF NOT EXISTS block_driver_license (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  front_storage_path  TEXT,
  back_storage_path   TEXT,
  -- unread: no back image yet. read: PDF417 decoded. failed: image saved, barcode did not decode.
  barcode_status      TEXT NOT NULL DEFAULT 'unread'
    CHECK (barcode_status IN ('unread', 'read', 'failed')),
  parsed_fields       JSONB,
  confirmed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

COMMENT ON TABLE block_driver_license IS
  'Front/back license images and the fields read from the card. Display-only until a state-record pull confirms them.';

ALTER TABLE block_driver_license ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'block_driver_license'
      AND policyname = 'service_role_all_block_driver_license'
  ) THEN
    CREATE POLICY service_role_all_block_driver_license
      ON block_driver_license
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'license-images',
  'license-images',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "license_images_owner_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'license-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "license_images_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'license-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "license_images_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'license-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "license_images_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'license-images' AND (storage.foldername(name))[1] = auth.uid()::text);
