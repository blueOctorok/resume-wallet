-- Migration 044: Retroactive documentation of storm_distributions table
-- This table was created directly in Supabase before migrations were tracked.
-- This migration ensures the schema is documented in version control.
-- Uses IF NOT EXISTS so it's safe to run on databases that already have the table.

CREATE TABLE IF NOT EXISTS storm_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  amount_storm numeric NOT NULL,
  usdc_spent numeric NOT NULL,
  payment_id uuid REFERENCES payments(id),
  payment_type text NOT NULL,
  user_type text DEFAULT 'applicant',
  rate_multiplier numeric DEFAULT 1.0,
  tx_hash text NOT NULL,
  total_distributed_before numeric,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_storm_distributions_wallet
  ON storm_distributions (wallet_address);
CREATE INDEX IF NOT EXISTS idx_storm_distributions_payment
  ON storm_distributions (payment_id);
