-- ============================================================
-- MIGRATION 005: MVR Payment Integration
-- ============================================================
-- Date: December 2024
-- Purpose: Link USDC payments to MVR orders
-- Dependencies: Requires Migration 003 (mvr_integration) and 000 (payments table)
-- 
-- What This Adds:
--   1. payment_id column to mvr_orders - Links to payments table
--   2. payment_tx_hash column to mvr_orders - Direct reference for validation
-- ============================================================

-- Add payment reference to mvr_orders
ALTER TABLE mvr_orders
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_tx_hash VARCHAR(66);

-- Index for payment lookups
CREATE INDEX IF NOT EXISTS idx_mvr_orders_payment_id 
  ON mvr_orders(payment_id)
  WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mvr_orders_payment_tx_hash 
  ON mvr_orders(payment_tx_hash)
  WHERE payment_tx_hash IS NOT NULL;

-- Comments
COMMENT ON COLUMN mvr_orders.payment_id IS 'Reference to payments table for this MVR order';
COMMENT ON COLUMN mvr_orders.payment_tx_hash IS 'Direct blockchain transaction hash of the USDC payment';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- This migration enables payment tracking for MVR orders.
-- 
-- Next steps:
--   1. Update order API to require payment validation
--   2. Integrate payment button into order form
--   3. Record payment in payments table before creating order
-- ============================================================

