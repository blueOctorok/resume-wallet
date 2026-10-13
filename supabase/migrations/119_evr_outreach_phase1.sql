-- 119: Employment-verification outreach, Phase 1
--
-- Why: the driver-initiated EV email is a single channel with manual resends
-- and no visibility into whether it even reached an inbox. Phase 1 makes the
-- outreach observable and self-driving:
--   * per-attempt delivery state from Pingram webhooks (delivered / opened /
--     clicked / bounced) so the driver sees what happened, not just "sent"
--   * contact research state so packets without an employer address stop
--     parking forever at attempt 0
--   * an explicit exhausted timestamp so the good-faith attempt record has a
--     defensible end date (49 CFR 391.23(c)(2) documentation)
--
-- No new tables. Everything hangs off the existing EVR request + attempt rows.

-- ── verification_attempts: delivery tracking ────────────────────────────────

ALTER TABLE verification_attempts
  ADD COLUMN IF NOT EXISTS provider_tracking_id TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'sent'
    CHECK (delivery_status IN ('sent', 'delivered', 'opened', 'clicked', 'failed')),
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_code TEXT,
  -- Who or what triggered the send. 'cron' is the automated cadence.
  ADD COLUMN IF NOT EXISTS triggered_by TEXT NOT NULL DEFAULT 'driver'
    CHECK (triggered_by IN ('driver', 'cron', 'admin'));

-- Pingram webhooks carry only the trackingId; this is the lookup path.
CREATE INDEX IF NOT EXISTS idx_verification_attempts_tracking
  ON verification_attempts (provider_tracking_id)
  WHERE provider_tracking_id IS NOT NULL;

-- ── employment_verification_requests: research + exhaustion ─────────────────

ALTER TABLE employment_verification_requests
  ADD COLUMN IF NOT EXISTS contact_research_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (contact_research_status IN ('not_requested', 'pending', 'found', 'not_found')),
  -- What research found (FMCSA carrier record, candidate emails). Shape is
  -- owned by src/lib/evr-contact-research.ts — kept JSONB so a new source
  -- does not need a migration.
  ADD COLUMN IF NOT EXISTS contact_research JSONB,
  ADD COLUMN IF NOT EXISTS outreach_exhausted_at TIMESTAMPTZ;

-- The cadence cron selects on (status, next_attempt_at).
CREATE INDEX IF NOT EXISTS idx_evr_requests_next_attempt
  ON employment_verification_requests (next_attempt_at)
  WHERE status IN ('VERIFICATION_REQUESTED', 'VERIFICATION_IN_PROGRESS');

COMMENT ON COLUMN verification_attempts.delivery_status IS
  'Pingram delivery state for email attempts: sent → delivered → opened → clicked, or failed (bounce).';
COMMENT ON COLUMN employment_verification_requests.contact_research_status IS
  'Phase 1 contact research: pending = needs a contact, found = candidates stored in contact_research, not_found = research ran empty.';
COMMENT ON COLUMN employment_verification_requests.outreach_exhausted_at IS
  'When the automated cadence gave up. Anchors the good-faith attempt record.';
