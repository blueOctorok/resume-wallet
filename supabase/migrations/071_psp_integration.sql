-- PSP (FMCSA Pre-Employment Screening / crash-inspection) orders via Accio
-- Mirrors mvr_orders / mvr_results / block_driver_mvr pattern with FCRA isolation:
--   ordered_by_company_id IS NULL → candidate-owned (may appear on career card)
--   employer orders stay company-scoped

-- Allow employer talent requests for PSP (same pipeline as mvr_order)
ALTER TABLE candidate_requests
  DROP CONSTRAINT IF EXISTS candidate_requests_request_type_check;

ALTER TABLE candidate_requests
  ADD CONSTRAINT candidate_requests_request_type_check
  CHECK (request_type IN (
    'mvr_order', 'psp_order', 'document_upload', 'verification',
    'profile_completion', 'custom', 'block_request'
  ));

-- ── psp_orders ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS psp_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  payment_tx_hash TEXT,
  accio_order_number TEXT NOT NULL,
  accio_suborder_number TEXT,
  accio_remote_order_number TEXT,
  accio_remote_suborder_number TEXT,
  dl_number TEXT NOT NULL,
  dl_state VARCHAR(2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed',
    'needs_review', 'cancelled', 'expired'
  )),
  order_xml TEXT,
  result_xml TEXT,
  ordered_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  fee_amount DECIMAL(10, 2),
  fee_currency VARCHAR(10) DEFAULT 'USD',
  error_message TEXT,
  error_code TEXT,
  ordered_by_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  ordered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ordered_by_employer BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (accio_order_number, accio_suborder_number)
);

CREATE INDEX IF NOT EXISTS idx_psp_orders_driver_user_id ON psp_orders(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_psp_orders_status ON psp_orders(status);
CREATE INDEX IF NOT EXISTS idx_psp_orders_accio_order_number ON psp_orders(accio_order_number);
CREATE INDEX IF NOT EXISTS idx_psp_orders_ordered_by_company_id ON psp_orders(ordered_by_company_id)
  WHERE ordered_by_company_id IS NOT NULL;

COMMENT ON TABLE psp_orders IS 'FMCSA PSP / crash-inspection orders via Accio; FCRA: employer rows scoped by ordered_by_company_id';

-- ── psp_results ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS psp_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psp_order_id UUID NOT NULL REFERENCES psp_orders(id) ON DELETE CASCADE,
  driver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_xml TEXT,
  parsed_data JSONB NOT NULL DEFAULT '{}',
  result_status VARCHAR(50) DEFAULT 'received' CHECK (result_status IN ('received', 'parsed', 'error')),
  received_at TIMESTAMPTZ DEFAULT NOW(),
  parsed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psp_results_psp_order_id ON psp_results(psp_order_id);
CREATE INDEX IF NOT EXISTS idx_psp_results_driver_user_id ON psp_results(driver_user_id);

-- ── block_driver_psp (hub cache; self-orders only updated by webhook) ────────
CREATE TABLE IF NOT EXISTS block_driver_psp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID,
  result_id UUID,
  expires_at TIMESTAMPTZ,
  report_status VARCHAR(50),
  last_ordered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_block_driver_psp_user_id ON block_driver_psp(user_id);
