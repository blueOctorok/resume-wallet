-- License scans keep the barcode fields only.
-- Supabase refuses DELETE on storage.objects (storage.protect_delete).
-- The picture files are removed with the Storage API, not this statement.

UPDATE block_driver_license
SET front_storage_path = NULL,
    back_storage_path = NULL,
    updated_at = now()
WHERE front_storage_path IS NOT NULL
   OR back_storage_path IS NOT NULL;

COMMENT ON TABLE block_driver_license IS
  'Fields read from the license barcode. No photos. Not a state record and not a Midnight proof.';
