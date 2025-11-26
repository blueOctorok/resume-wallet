# How to Run Migrations in Supabase

Follow these steps to run migrations in your Supabase instance.

## ⚠️ IMPORTANT: Current Status

**Migrations 000 and 001 are ALREADY running in your production database!**

These migrations document your existing tables. **DO NOT re-run them.**

**Only run Migration 002** (external jobs + driver profiles).

---

## 📋 Step-by-Step Instructions

### Step 1: Check What's Already Done

Your database currently has these tables (from Migrations 000 & 001):
- ✅ `users`
- ✅ `driver_applications`
- ✅ `resumes`
- ✅ `t_prefill_cache`
- ✅ `companies`
- ✅ `job_postings`
- ✅ `applications`

**You DO NOT need to run Migrations 000 or 001.**

---

### Step 2: Run Migration 002 (NEW)

This adds the "Apply with Veree" features:

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Go to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy Migration 002**
   - Open `supabase/migrations/002_external_jobs_and_driver_profiles.sql`
   - Copy the ENTIRE file contents
   - Paste into the SQL Editor

4. **Run the Migration**
   - Click "Run" (or press Ctrl/Cmd + Enter)
   - Wait for it to complete (~5-10 seconds)

5. **Verify Success**
   - You should see "Success. No rows returned" at the bottom
   - If you see any errors, **STOP** and share the error message with me

---

### Step 3: Verify Tables Were Created/Modified

Go to **Table Editor** and verify you see:

**New Tables:**
- ✅ `driver_profiles` (new)
- ✅ `application_views` (new)

**Modified Tables:**
- ✅ `job_postings` - should now have these new columns:
  - `is_external`
  - `external_source`
  - `external_job_id`
  - `redirect_url`
  - `external_data`
  
- ✅ `applications` - should now have these new columns:
  - `share_token`
  - `view_count`
  - `last_viewed_at`
  - `application_data`
  - `job_salary_min`
  - `job_salary_max`
  - `job_location`

---

### Step 4: Update Migration Status

After successfully running Migration 002:

1. Open `supabase/migrations/MIGRATION_STATUS.md`
2. Change Migration 002 status from ⏳ Pending to ✅ Completed
3. Add today's date
4. Commit the change to Git

---

## 🆘 Troubleshooting

### Error: "column already exists"
**Solution:** The migration is idempotent and uses `IF NOT EXISTS` checks. This shouldn't happen, but if it does, it's safe to ignore.

### Error: "relation does not exist"
**Problem:** You're missing tables from Migration 000 or 001.
**Solution:** Contact me - we may need to run earlier migrations first.

### Error: "must be owner of table"
**Problem:** Permission issue.
**Solution:** Make sure you're logged in as the database owner in Supabase.

---

## ✅ After Migration 002 is Complete

Your database will be ready for the "Apply with Veree" features:

1. **External Job Aggregation** - Adzuna jobs can be stored in `job_postings`
2. **Driver Profiles** - Quick application data cached for fast applies
3. **Shareable Applications** - Public links like `/application/abc123`
4. **Application Analytics** - Track when employers view applications

---

## 🔄 What NOT to Do

❌ **DO NOT** re-run Migration 000 or 001 - they're already in your database
❌ **DO NOT** manually edit tables - always use migrations
❌ **DO NOT** delete tables without backing up first

---

## 📞 Need Help?

If you encounter any issues:
1. Take a screenshot of the error
2. Note which migration you were running
3. Share with me - I'll help you fix it

**The migrations are designed to be safe and idempotent (safe to re-run), but it's always best to verify before re-running.**

