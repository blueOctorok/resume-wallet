# How to Run Migration 003: MVR Integration

This guide will walk you through running Migration 003 to add MVR (Motor Vehicle Record) integration to your database.

## 📋 What This Migration Adds

Migration 003 creates the database structure needed for MVR integration with Accio API:

### New Tables:
- **`mvr_orders`** - Tracks MVR orders placed with Accio
  - Stores order numbers, status, driver info, raw XML payloads
  - Tracks fees, expiration dates, error messages
  
- **`mvr_results`** - Stores parsed MVR results from Accio webhooks
  - License information, violations, accidents, suspensions
  - CDL endorsements, medical certificate data
  - Full parsed JSONB structure

### Modified Tables:
- **`driver_profiles`** - Adds MVR-related fields:
  - `mvr_order_id` - Latest MVR order reference
  - `mvr_result_id` - Latest MVR result reference
  - `mvr_expires_at` - When current MVR expires
  - `mvr_license_status` - License status from latest MVR
  - `mvr_total_points` - Total points from latest MVR
  - `mvr_violation_count` - Number of violations
  - `mvr_last_ordered_at` - Last time MVR was ordered

### Helper Features:
- **`complete_mvr_data` view** - Joins orders, results, and driver info
- **Auto-update trigger** - Syncs MVR data to `driver_profiles` automatically
- **RLS policies** - Secure access control for all MVR data

---

## 🚀 Step-by-Step Instructions

### Step 1: Verify Prerequisites

Make sure you've already run Migrations 000, 001, and 002. Your database should have:
- ✅ `users` table
- ✅ `driver_applications` table
- ✅ `driver_profiles` table (from Migration 002)
- ✅ `companies`, `job_postings`, `applications` tables

**If you haven't run Migration 002 yet, do that first!**

---

### Step 2: Open Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New Query"** button

---

### Step 3: Copy Migration 003

1. Open the file: `supabase/migrations/003_mvr_integration.sql`
2. **Copy the ENTIRE file contents** (Ctrl/Cmd + A, then Ctrl/Cmd + C)
3. Paste into the Supabase SQL Editor

---

### Step 4: Run the Migration

1. Click the **"Run"** button (or press `Ctrl/Cmd + Enter`)
2. Wait for it to complete (~10-15 seconds)
3. You should see: **"Success. No rows returned"** at the bottom

**⚠️ If you see any errors, STOP and share the error message!**

---

### Step 5: Verify Tables Were Created

Go to **Table Editor** in Supabase and verify you see:

**New Tables:**
- ✅ `mvr_orders` (should have ~20 columns)
- ✅ `mvr_results` (should have ~25 columns)

**Modified Tables:**
- ✅ `driver_profiles` - should now have these new columns:
  - `mvr_order_id`
  - `mvr_result_id`
  - `mvr_expires_at`
  - `mvr_license_status`
  - `mvr_total_points`
  - `mvr_violation_count`
  - `mvr_last_ordered_at`

**New View:**
- ✅ `complete_mvr_data` (in Database → Views)

---

### Step 6: Update Migration Status

After successfully running Migration 003:

1. Open `supabase/migrations/MIGRATION_STATUS.md`
2. Change Migration 003 status from ⏳ Pending to ✅ Completed
3. Add today's date
4. Commit the change to Git

---

## 🆘 Troubleshooting

### Error: "column already exists"
**Solution:** The migration uses `IF NOT EXISTS` checks, so this shouldn't happen. If it does, it's safe to ignore - the column already exists.

### Error: "relation does not exist" (driver_profiles)
**Problem:** You haven't run Migration 002 yet.
**Solution:** Run Migration 002 first (`002_external_jobs_and_driver_profiles.sql`).

### Error: "must be owner of table"
**Problem:** Permission issue.
**Solution:** Make sure you're logged in as the database owner in Supabase Dashboard.

### Error: "function update_updated_at_column() does not exist"
**Problem:** Missing function from Migration 001.
**Solution:** Make sure Migration 001 has been run. The function should exist in your database.

---

## ✅ After Migration 003 is Complete

Your database will be ready for MVR integration:

1. **MVR Ordering** - API routes can create orders in `mvr_orders` table
2. **Webhook Processing** - Results can be stored in `mvr_results` table
3. **Profile Sync** - MVR data automatically syncs to `driver_profiles`
4. **Profile Completeness** - MVR data can boost profile completion scores

---

## 🔄 What NOT to Do

❌ **DO NOT** re-run Migration 003 if it already succeeded
❌ **DO NOT** manually edit tables - always use migrations
❌ **DO NOT** delete MVR tables without backing up first

---

## 📞 Need Help?

If you encounter any issues:

1. Take a screenshot of the error message
2. Note which step you were on
3. Share with me - I'll help you fix it

**The migration is designed to be safe and idempotent (safe to re-run), but it's always best to verify before re-running.**

---

## 🎯 Next Steps After Migration

Once Migration 003 is complete, you'll need to:

1. **Add Accio API credentials** to environment variables:
   - `ACCIO_ACCOUNT` - Your Accio account name
   - `ACCIO_USERNAME` - Your Accio username
   - `ACCIO_PASSWORD` - Your Accio password
   - `ACCIO_MODE` - 'PROD' or 'TEST'
   - `ACCIO_API_URL` - Accio API endpoint URL

2. **Create API routes** for:
   - `POST /api/mvr/order` - Place MVR order
   - `POST /api/mvr/webhook` - Receive results from Accio
   - `GET /api/mvr/status/:orderId` - Check order status

3. **Update profile completeness calculator** to include MVR data

4. **Add UI components** for:
   - MVR ordering button
   - MVR status display
   - MVR results viewer

---

**Migration 003 is ready to run! Follow the steps above to add MVR integration to your database.** 🚀

