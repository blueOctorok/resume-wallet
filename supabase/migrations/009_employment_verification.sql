-- Migration: Employment Verification System
-- Purpose: Enable future employers to verify driver's employment history with previous employers
-- 
-- Flow:
--   1. Driver submits employment history (SELF_REPORTED)
--   2. Future employer initiates verification
--   3. System contacts previous employer (up to 3 attempts)
--   4. Previous employer responds with verification answers
--   5. Results stored and shared with future employer
--
-- ============================================================

-- ===== EMPLOYMENT VERIFICATION REQUESTS =====
-- Tracks verification requests from future employers to previous employers
CREATE TABLE IF NOT EXISTS employment_verification_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Links to driver's employment history entry (from driver_profiles.employment_history)
  driver_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  employment_id TEXT NOT NULL, -- ID from the employment_history JSONB array
  
  -- The company initiating the verification (future employer)
  requesting_company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Previous employer info (from driver's employment history)
  previous_employer_name TEXT NOT NULL,
  previous_employer_email TEXT,
  previous_employer_phone TEXT,
  previous_employer_address TEXT,
  
  -- Driver's claimed employment details (snapshot at time of request)
  claimed_position TEXT NOT NULL,
  claimed_start_date DATE NOT NULL,
  claimed_end_date DATE,
  claimed_reason_for_leaving TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'VERIFICATION_REQUESTED' CHECK (status IN (
    'VERIFICATION_REQUESTED',    -- Just created, first attempt pending
    'VERIFICATION_IN_PROGRESS',  -- Attempts being made (1-3)
    'VERIFIED',                  -- Previous employer confirmed
    'PARTIALLY_VERIFIED',        -- Some details confirmed, others disputed
    'VERIFICATION_DENIED',       -- Previous employer says details are false
    'ATTEMPTS_EXHAUSTED',        -- 3 attempts made, no response
    'VERIFICATION_DECLINED'      -- Previous employer declined to verify
  )),
  
  -- Attempt tracking
  attempt_count INTEGER DEFAULT 0 CHECK (attempt_count >= 0 AND attempt_count <= 3),
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  next_attempt_at TIMESTAMP WITH TIME ZONE,
  
  -- Verification results (filled by previous employer)
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by_email TEXT, -- Email of person who verified
  verified_by_name TEXT,  -- Name of person who verified
  verified_by_title TEXT, -- Title of person who verified
  
  -- The 6 FMCSA verification questions
  dates_correct TEXT CHECK (dates_correct IN ('yes', 'no', 'partial')),
  corrected_start_date DATE,
  corrected_end_date DATE,
  
  was_terminated TEXT CHECK (was_terminated IN ('yes', 'no')),
  termination_reason TEXT,
  
  eligible_to_return TEXT CHECK (eligible_to_return IN ('yes', 'no', 'discuss')),
  return_notes TEXT,
  
  had_accident TEXT CHECK (had_accident IN ('yes', 'no')),
  accident_details TEXT,
  
  failed_clearinghouse_test TEXT CHECK (failed_clearinghouse_test IN ('yes', 'no', 'na')),
  clearinghouse_notes TEXT,
  
  random_drug_test_or_refused TEXT CHECK (random_drug_test_or_refused IN ('yes', 'no', 'na')),
  drug_test_details TEXT,
  
  -- Additional notes from previous employer
  additional_notes TEXT,
  
  -- Verification method used
  verification_method TEXT CHECK (verification_method IN ('email', 'phone', 'portal', 'fax', 'mail')),
  
  -- Secure token for previous employer to respond (no login required)
  verification_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  
  -- Blockchain recording
  blockchain_hash TEXT,
  blockchain_tx_hash TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  finalized_at TIMESTAMP WITH TIME ZONE -- Set when status becomes final (verified/denied/exhausted)
);

-- ===== VERIFICATION ATTEMPTS =====
-- Tracks each contact attempt to previous employer
CREATE TABLE IF NOT EXISTS verification_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  verification_request_id UUID REFERENCES employment_verification_requests(id) ON DELETE CASCADE NOT NULL,
  
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1 AND attempt_number <= 3),
  method TEXT NOT NULL CHECK (method IN ('email', 'phone', 'portal', 'fax', 'mail')),
  
  -- Contact details used
  contact_email TEXT,
  contact_phone TEXT,
  contact_person TEXT,
  
  -- Attempt timing
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Response tracking
  response_received BOOLEAN DEFAULT FALSE,
  responded_at TIMESTAMP WITH TIME ZONE,
  response_notes TEXT,
  
  -- For automated tracking (email opens, link clicks)
  email_opened_at TIMESTAMP WITH TIME ZONE,
  link_clicked_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== INDEXES =====

-- Fast lookup by driver
CREATE INDEX IF NOT EXISTS idx_evr_driver_id ON employment_verification_requests(driver_id);

-- Fast lookup by requesting company
CREATE INDEX IF NOT EXISTS idx_evr_requesting_company ON employment_verification_requests(requesting_company_id);

-- Find pending verifications
CREATE INDEX IF NOT EXISTS idx_evr_status ON employment_verification_requests(status);

-- Find verifications needing next attempt
CREATE INDEX IF NOT EXISTS idx_evr_next_attempt ON employment_verification_requests(next_attempt_at) 
  WHERE status IN ('VERIFICATION_REQUESTED', 'VERIFICATION_IN_PROGRESS');

-- Token lookup for previous employer responses
CREATE INDEX IF NOT EXISTS idx_evr_token ON employment_verification_requests(verification_token);

-- Attempt lookup
CREATE INDEX IF NOT EXISTS idx_va_request ON verification_attempts(verification_request_id);

-- ===== ROW LEVEL SECURITY =====

ALTER TABLE employment_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_attempts ENABLE ROW LEVEL SECURITY;

-- Drivers can see verification requests about their employment
CREATE POLICY "Drivers can view their verification requests" ON employment_verification_requests
  FOR SELECT USING (driver_id = auth.uid());

-- Employers can see/manage verifications they initiated
-- Note: companies.employer_user_id links company to user (one company per employer)
CREATE POLICY "Employers can view verifications they requested" ON employment_verification_requests
  FOR SELECT USING (
    requesting_company_id IN (
      SELECT id FROM companies WHERE employer_user_id = auth.uid()
    )
  );

CREATE POLICY "Employers can insert verification requests" ON employment_verification_requests
  FOR INSERT WITH CHECK (
    requesting_company_id IN (
      SELECT id FROM companies WHERE employer_user_id = auth.uid()
    )
  );

CREATE POLICY "Employers can update their verification requests" ON employment_verification_requests
  FOR UPDATE USING (
    requesting_company_id IN (
      SELECT id FROM companies WHERE employer_user_id = auth.uid()
    )
  );

-- Verification attempts follow same rules as requests
CREATE POLICY "Users can view verification attempts" ON verification_attempts
  FOR SELECT USING (
    verification_request_id IN (
      SELECT id FROM employment_verification_requests 
      WHERE driver_id = auth.uid() OR requesting_company_id IN (
        SELECT id FROM companies WHERE employer_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Employers can insert verification attempts" ON verification_attempts
  FOR INSERT WITH CHECK (
    verification_request_id IN (
      SELECT id FROM employment_verification_requests 
      WHERE requesting_company_id IN (
        SELECT id FROM companies WHERE employer_user_id = auth.uid()
      )
    )
  );

-- ===== TRIGGER: AUTO-UPDATE updated_at =====

CREATE OR REPLACE FUNCTION update_verification_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_evr_updated_at
  BEFORE UPDATE ON employment_verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_verification_timestamp();

-- ===== FUNCTION: Record verification attempt =====

CREATE OR REPLACE FUNCTION record_verification_attempt(
  p_request_id UUID,
  p_method TEXT,
  p_contact_email TEXT DEFAULT NULL,
  p_contact_phone TEXT DEFAULT NULL,
  p_contact_person TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_current_count INTEGER;
  v_attempt_id UUID;
BEGIN
  -- Get current attempt count
  SELECT attempt_count INTO v_current_count
  FROM employment_verification_requests
  WHERE id = p_request_id;
  
  IF v_current_count >= 3 THEN
    RAISE EXCEPTION 'Maximum attempts (3) already reached for this verification';
  END IF;
  
  -- Insert the attempt
  INSERT INTO verification_attempts (
    verification_request_id,
    attempt_number,
    method,
    contact_email,
    contact_phone,
    contact_person
  ) VALUES (
    p_request_id,
    v_current_count + 1,
    p_method,
    p_contact_email,
    p_contact_phone,
    p_contact_person
  ) RETURNING id INTO v_attempt_id;
  
  -- Update the request
  UPDATE employment_verification_requests
  SET 
    attempt_count = v_current_count + 1,
    last_attempt_at = NOW(),
    next_attempt_at = CASE 
      WHEN v_current_count + 1 < 3 THEN NOW() + INTERVAL '3 days'
      ELSE NULL
    END,
    status = CASE
      WHEN status = 'VERIFICATION_REQUESTED' THEN 'VERIFICATION_IN_PROGRESS'
      ELSE status
    END
  WHERE id = p_request_id;
  
  RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql;

-- ===== FUNCTION: Mark attempts exhausted =====
-- Called by cron job or manually when 3 attempts have been made with no response

CREATE OR REPLACE FUNCTION mark_verification_exhausted(p_request_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT attempt_count INTO v_count
  FROM employment_verification_requests
  WHERE id = p_request_id AND status = 'VERIFICATION_IN_PROGRESS';
  
  IF v_count IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF v_count >= 3 THEN
    UPDATE employment_verification_requests
    SET 
      status = 'ATTEMPTS_EXHAUSTED',
      finalized_at = NOW(),
      next_attempt_at = NULL
    WHERE id = p_request_id;
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ===== FUNCTION: Submit verification response =====
-- Called when previous employer responds via token

CREATE OR REPLACE FUNCTION submit_verification_response(
  p_token UUID,
  p_verifier_email TEXT,
  p_verifier_name TEXT,
  p_verifier_title TEXT,
  p_dates_correct TEXT,
  p_corrected_start DATE DEFAULT NULL,
  p_corrected_end DATE DEFAULT NULL,
  p_was_terminated TEXT DEFAULT NULL,
  p_termination_reason TEXT DEFAULT NULL,
  p_eligible_to_return TEXT DEFAULT NULL,
  p_return_notes TEXT DEFAULT NULL,
  p_had_accident TEXT DEFAULT NULL,
  p_accident_details TEXT DEFAULT NULL,
  p_failed_clearinghouse TEXT DEFAULT NULL,
  p_clearinghouse_notes TEXT DEFAULT NULL,
  p_drug_test_or_refused TEXT DEFAULT NULL,
  p_drug_test_details TEXT DEFAULT NULL,
  p_additional_notes TEXT DEFAULT NULL,
  p_action TEXT DEFAULT 'verify' -- 'verify', 'deny', 'decline'
)
RETURNS JSON AS $$
DECLARE
  v_request RECORD;
  v_status TEXT;
BEGIN
  -- Find the request by token
  SELECT * INTO v_request
  FROM employment_verification_requests
  WHERE verification_token = p_token
    AND token_expires_at > NOW()
    AND status IN ('VERIFICATION_REQUESTED', 'VERIFICATION_IN_PROGRESS');
  
  IF v_request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired verification token');
  END IF;
  
  -- Determine final status
  v_status := CASE p_action
    WHEN 'verify' THEN 
      CASE WHEN p_dates_correct = 'partial' THEN 'PARTIALLY_VERIFIED' ELSE 'VERIFIED' END
    WHEN 'deny' THEN 'VERIFICATION_DENIED'
    WHEN 'decline' THEN 'VERIFICATION_DECLINED'
    ELSE 'VERIFIED'
  END;
  
  -- Update the request with verification data
  UPDATE employment_verification_requests
  SET
    status = v_status,
    verified_at = NOW(),
    verified_by_email = p_verifier_email,
    verified_by_name = p_verifier_name,
    verified_by_title = p_verifier_title,
    dates_correct = p_dates_correct,
    corrected_start_date = p_corrected_start,
    corrected_end_date = p_corrected_end,
    was_terminated = p_was_terminated,
    termination_reason = p_termination_reason,
    eligible_to_return = p_eligible_to_return,
    return_notes = p_return_notes,
    had_accident = p_had_accident,
    accident_details = p_accident_details,
    failed_clearinghouse_test = p_failed_clearinghouse,
    clearinghouse_notes = p_clearinghouse_notes,
    random_drug_test_or_refused = p_drug_test_or_refused,
    drug_test_details = p_drug_test_details,
    additional_notes = p_additional_notes,
    verification_method = 'portal',
    finalized_at = NOW(),
    next_attempt_at = NULL
  WHERE id = v_request.id;
  
  -- Mark the last attempt as responded
  UPDATE verification_attempts
  SET 
    response_received = TRUE,
    responded_at = NOW()
  WHERE verification_request_id = v_request.id
    AND attempt_number = v_request.attempt_count;
  
  RETURN json_build_object(
    'success', true, 
    'status', v_status,
    'requestId', v_request.id
  );
END;
$$ LANGUAGE plpgsql;

-- ===== COMMENTS =====

COMMENT ON TABLE employment_verification_requests IS 'Tracks employment verification requests from future employers to previous employers';
COMMENT ON TABLE verification_attempts IS 'Tracks individual contact attempts for each verification request';
COMMENT ON COLUMN employment_verification_requests.verification_token IS 'Secure token allowing previous employer to respond without logging in';
COMMENT ON COLUMN employment_verification_requests.attempt_count IS 'Number of contact attempts made (max 3)';
COMMENT ON FUNCTION record_verification_attempt IS 'Records a new verification attempt, updates counters, and schedules next attempt';
COMMENT ON FUNCTION mark_verification_exhausted IS 'Marks verification as exhausted after 3 failed attempts';
COMMENT ON FUNCTION submit_verification_response IS 'Allows previous employer to submit verification response via token';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- 
-- What was created:
--   ✅ employment_verification_requests table
--   ✅ verification_attempts table
--   ✅ Indexes for fast queries
--   ✅ RLS policies for security
--   ✅ Helper functions for verification workflow
--   ✅ Token-based response system for previous employers
--
-- Usage:
--   1. Future employer calls API to initiate verification
--   2. System creates request and sends first attempt
--   3. Previous employer responds via token link
--   4. Results stored and shared with future employer
--
-- ============================================================
