-- Company shared wallet (MultiOwnerLightAccount) + payment attribution
-- See src/lib/company-wallet-server.ts

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS wallet_address TEXT;

CREATE INDEX IF NOT EXISTS idx_companies_wallet_address
  ON companies (wallet_address)
  WHERE wallet_address IS NOT NULL;

COMMENT ON COLUMN companies.wallet_address IS 'MultiOwnerLightAccount address for shared company USDC/STORM; team members are on-chain owners.';

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_company_id
  ON payments (company_id)
  WHERE company_id IS NOT NULL;

COMMENT ON COLUMN payments.company_id IS 'When set, payment was made from the company shared wallet (employer flow).';

ALTER TABLE storm_distributions
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_storm_distributions_company_id
  ON storm_distributions (company_id)
  WHERE company_id IS NOT NULL;
