-- Fix Payments RLS Policy
-- Run this in Supabase SQL Editor if you want users to be able to view their own payments
-- Note: This is OPTIONAL - the payment API now uses service_role, so payments work without this

-- Ensure RLS is enabled
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own payments" ON payments;

-- Create the SELECT policy (allows users to view their own payments)
CREATE POLICY "Users can view their own payments"
  ON payments FOR SELECT
  USING (user_id = auth.uid());

