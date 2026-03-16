-- 041_employer_access_name_fields.sql
-- Adds first_name and last_name columns to employer_access_requests.
-- The access request form now collects these separately instead of a single "name" field.
-- The existing "name" column is kept for backward compatibility (stores full name).

ALTER TABLE employer_access_requests
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;
