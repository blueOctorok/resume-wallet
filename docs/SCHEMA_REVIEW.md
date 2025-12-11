# Supabase Schema Review

## ✅ **Overall Assessment: Schema Looks Good**

The schema matches your migrations and appears correct. Here are the findings:

---

## ✅ **What's Correct**

### **1. All Tables Present**
- ✅ `users` - Base user table
- ✅ `driver_applications` - DOT applications
- ✅ `resumes` - Resume uploads
- ✅ `driver_profiles` - Driver profile cache
- ✅ `companies` - Employer companies
- ✅ `job_postings` - Job listings (internal + external)
- ✅ `applications` - Driver applications to jobs
- ✅ `application_views` - Analytics
- ✅ `mvr_orders` - MVR order tracking
- ✅ `mvr_results` - MVR result storage
- ✅ `payments` - Payment tracking
- ✅ `t_prefill_cache` - AI extraction cache

### **2. Foreign Keys Look Correct**
- ✅ All foreign keys reference correct tables
- ✅ Relationships are properly defined

### **3. Columns Match Migrations**
- ✅ `users.role` present (from migration 001)
- ✅ `job_postings` has external job columns (from migration 002)
- ✅ `applications` has share_token, view_count (from migration 002)
- ✅ `driver_profiles` has MVR fields (from migration 003)
- ✅ `mvr_orders` has all required fields (including `applicant_portal_url`)

---

## ⚠️ **Potential Issues Found**

### **1. Missing Unique Constraints**

**Critical Missing Constraint:**
- `driver_applications(user_id, application_hash)` - Should be unique to prevent duplicate submissions
  - Migration 000 defines: `CREATE UNIQUE INDEX ... ON driver_applications(user_id, application_hash)`
  - **Impact:** Without this, users could submit duplicate applications with same hash

**Other Constraints (Check if they exist):**
- `job_postings(external_source, external_job_id)` - Should be unique for external jobs
- `mvr_orders(accio_order_number, accio_suborder_number)` - Should be unique

**Fix:**
```sql
-- Verify these unique constraints exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_applications_user_hash 
  ON driver_applications(user_id, application_hash) 
  WHERE application_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_postings_external_unique
  ON job_postings(external_source, external_job_id)
  WHERE is_external = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mvr_orders_accio_unique
  ON mvr_orders(accio_order_number, accio_suborder_number);
```

---

### **2. Missing Indexes (Performance)**

**Critical for Query Performance:**
- `resumes.file_hash` - Used for duplicate checks (MUST be indexed)
- `driver_applications.application_hash` - Used for duplicate checks (MUST be indexed)
- `users.wallet_address` - Used for all user lookups (MUST be indexed)

**Recommended Indexes:**
```sql
-- Verify these indexes exist
CREATE INDEX IF NOT EXISTS idx_resumes_file_hash ON resumes(file_hash);
CREATE INDEX IF NOT EXISTS idx_driver_applications_application_hash ON driver_applications(application_hash);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
```

---

### **3. Foreign Key Cascade Behavior**

**Check ON DELETE Behavior:**

Your schema shows foreign keys but not the cascade behavior. Verify these match migrations:

- `driver_applications.user_id` - Should be `ON DELETE CASCADE`
- `resumes.user_id` - Should be `ON DELETE CASCADE`
- `applications.driver_user_id` - Should be `ON DELETE CASCADE`
- `mvr_results.mvr_order_id` - Should be `ON DELETE CASCADE`

**If missing, fix:**
```sql
-- These should already be set from migrations, but verify
ALTER TABLE driver_applications 
  DROP CONSTRAINT IF EXISTS driver_applications_user_id_fkey,
  ADD CONSTRAINT driver_applications_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

---

### **4. Missing NOT NULL Constraints**

**Potential Issue:**
- `resumes.ipfs_hash` is `NOT NULL` ✅ (correct)
- `driver_applications.user_id` is nullable - **Check if this is intentional**
  - If all applications must have a user, this should be `NOT NULL`

**Check:**
```sql
-- If user_id should always exist:
ALTER TABLE driver_applications 
  ALTER COLUMN user_id SET NOT NULL;
```

---

### **5. Missing Applicant Portal URL in Migration**

**Observation:**
- `mvr_orders.applicant_portal_url` exists in your schema
- This field is not in migration 003

**Action Needed:**
- If this is a new field, add it to a new migration
- If it was added manually, document it

---

## 🔍 **Missing from Schema Dump**

The schema dump you provided doesn't show (but should exist):

1. **Indexes** - These should exist from migrations:
   - `idx_resumes_file_hash`
   - `idx_driver_applications_application_hash`
   - `idx_users_wallet_address`
   - And many others...

2. **RLS Status** - Can't tell if RLS is enabled
   - Should be enabled on all tables
   - Check with: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`

3. **RLS Policies** - Policies should exist
   - Check with: `SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';`

4. **Triggers** - Auto-update triggers should exist
   - Check with: `SELECT * FROM pg_trigger WHERE tgname LIKE '%updated_at%';`

---

## ✅ **Recommendations**

### **Immediate Actions:**

1. **Verify Unique Constraints:**
   ```sql
   SELECT 
     conname, 
     conrelid::regclass, 
     contype,
     pg_get_constraintdef(oid) 
   FROM pg_constraint 
   WHERE contype = 'u' 
   AND conrelid::regclass::text LIKE 'driver_applications';
   ```

2. **Verify Critical Indexes:**
   ```sql
   SELECT 
     indexname, 
     tablename, 
     indexdef 
   FROM pg_indexes 
   WHERE schemaname = 'public' 
   AND tablename IN ('resumes', 'driver_applications', 'users')
   ORDER BY tablename, indexname;
   ```

3. **Check RLS Status:**
   ```sql
   SELECT 
     tablename, 
     rowsecurity as rls_enabled 
   FROM pg_tables 
   WHERE schemaname = 'public' 
   ORDER BY tablename;
   ```

4. **Run Migration 004:**
   - Enable RLS on all tables
   - Verify all policies exist

---

## 📋 **Summary**

### **Schema Structure: ✅ CORRECT**
- All tables present
- Foreign keys correct
- Columns match migrations

### **Constraints: ⚠️ NEEDS VERIFICATION**
- Unique constraints may be missing (critical for duplicate prevention)
- Check if indexes exist (critical for performance)

### **RLS: ⚠️ UNKNOWN**
- Schema dump doesn't show RLS status
- Run migration 004 to enable
- Verify policies exist

### **Overall: ✅ GOOD with verification needed**

The schema structure is correct. Verify:
1. Unique constraints exist (especially `driver_applications(user_id, application_hash)`)
2. Critical indexes exist (especially `resumes.file_hash`)
3. RLS is enabled (run migration 004)

