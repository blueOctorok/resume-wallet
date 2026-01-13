-- ============================================================
-- CLEANUP: Remove Duplicate MVR Payments
-- ============================================================
-- This script removes duplicate payment records that have the same tx_hash,
-- keeping only the OLDEST record for each unique tx_hash.
-- 
-- Run this in your Supabase SQL Editor to clean up existing duplicates.
-- ============================================================

-- First, let's see what duplicates exist
SELECT 
  tx_hash,
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY created_at) as payment_ids,
  array_agg(created_at ORDER BY created_at) as created_dates
FROM payments
WHERE type = 'MVR_ORDER'
GROUP BY tx_hash
HAVING COUNT(*) > 1;

-- Delete duplicates, keeping the oldest (first created) for each tx_hash
-- This uses a CTE to identify which records to keep
WITH duplicates AS (
  SELECT 
    id,
    tx_hash,
    ROW_NUMBER() OVER (PARTITION BY tx_hash ORDER BY created_at ASC) as rn
  FROM payments
  WHERE type = 'MVR_ORDER'
)
DELETE FROM payments
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Verify cleanup - this should return no rows if cleanup was successful
SELECT 
  tx_hash,
  COUNT(*) as count
FROM payments
WHERE type = 'MVR_ORDER'
GROUP BY tx_hash
HAVING COUNT(*) > 1;
