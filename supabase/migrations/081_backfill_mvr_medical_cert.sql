-- Clear bogus medical_cert_* rows in mvr_results.
--
-- Background: prior to May 2026 the Accio MVR text-block parser ran an
-- unscoped /Status:\s*([A-Z]+)/ regex against the entire report text. On
-- Class D (non-CDL) drivers — whose actual medical section says "NOT
-- CERTIFIED" with empty Issue/Expiration — the regex grabbed the LICENSE
-- section's "Status: VALID" and labeled it the medical certificate status.
-- The license expiration date was similarly misattributed as the med cert
-- expiration.
--
-- The parser is now scoped (src/lib/accio-xml-parser.ts) and the modal/PDF
-- gate on hasValidMedicalCert(), but existing rows still contain the bogus
-- values. This migration cleans them up in three independent passes so each
-- diagnosis is logged separately:
--
--   1. medical_cert_status that's actually a license status word
--      ("VALID" / "SUSPENDED" / "REVOKED" / "CANCELLED" / "EXPIRED")
--   2. medical_cert_expiration that exactly equals license_expiration_date
--      for the same row (the misattribution fingerprint)
--   3. medical_cert_status that's a known "no med card" sentinel like
--      "NOT CERTIFIED" / "NONE" / "N/A" — these aren't bugs, but they're
--      also not a real cert, and storing them as if they were one confuses
--      the UI gate. Safer to NULL them out.
--
-- All three passes only touch rows where the bug is unambiguous. Real
-- "CERTIFIED" / "EXEMPT" rows from CDL drivers are left alone.

BEGIN;

-- Pass 1: clear license-status words that leaked into medical_cert_status.
-- Real Accio med cert values are CERTIFIED / EXEMPT / NOT CERTIFIED — never
-- VALID/SUSPENDED/etc. So if we see one of those, it's the bug.
UPDATE mvr_results
SET medical_cert_status = NULL
WHERE UPPER(TRIM(medical_cert_status)) IN (
  'VALID',
  'SUSPENDED',
  'REVOKED',
  'CANCELLED',
  'CANCELED',
  'EXPIRED',
  'INACTIVE',
  'ACTIVE'
);

-- Pass 2: clear medical_cert_expiration where it exactly equals the row's
-- own license_expiration_date. That's the smoking-gun fingerprint of the
-- license-date being misattributed as the med cert date. Both columns are
-- typed `date` so we compare directly.
UPDATE mvr_results
SET medical_cert_expiration = NULL
WHERE medical_cert_expiration IS NOT NULL
  AND license_expiration_date IS NOT NULL
  AND medical_cert_expiration = license_expiration_date;

-- Pass 3: NULL out "no med cert on file" sentinels so the UI gate (which now
-- uses an allow-list of real med cert vocab) treats them uniformly as "no
-- med card." These weren't strictly bugs — they reflected real Accio
-- responses for non-CDL drivers — but downstream code is cleaner if absence
-- is represented by NULL than by a sentinel string.
UPDATE mvr_results
SET medical_cert_status = NULL
WHERE UPPER(TRIM(medical_cert_status)) IN (
  'NOT CERTIFIED',
  'NOT REQUIRED',
  'NONE',
  'N/A',
  'NA',
  'UNKNOWN'
);

COMMIT;
