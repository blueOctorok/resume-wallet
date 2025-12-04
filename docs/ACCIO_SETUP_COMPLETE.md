# Accio MVR Integration - Setup Complete! ✅

Your Accio MVR integration is now fully configured and ready to test with **live test credentials**.

---

## ✅ What's Ready

### 1. **Live Test Credentials Configured**
```bash
ACCIO_ACCOUNT="testaccount"
ACCIO_USERNAME="admin"
ACCIO_PASSWORD="demo2023"
ACCIO_MODE="TEST"
ACCIO_API_URL="https://service.keybackground.com/c/p/researcherxml"
```

✅ Already in your `.env.local` - ready to use!

### 2. **Updated XML Format**
- Matches Accio's latest production schema
- Includes all required fields: gender, race, jobstate
- Supports FMCSA crash/inspection reports
- Applicant portal email suppressed (you control communication)

### 3. **Applicant Portal URL Handling**
- Accio returns a unique portal URL with each order
- Portal allows drivers to provide additional info if needed
- You control when/how to present it (no automated emails)
- URL stored in database and returned in API responses

---

## 🚀 Quick Start

### Step 1: Run Database Migration

Add the `applicant_portal_url` column:

```bash
# Using psql or Supabase SQL Editor
psql -h your-supabase-host -U postgres -d postgres -f ADD_APPLICANT_PORTAL_URL.sql

# Or run this SQL directly in Supabase SQL Editor:
ALTER TABLE mvr_orders 
ADD COLUMN IF NOT EXISTS applicant_portal_url TEXT;

COMMENT ON COLUMN mvr_orders.applicant_portal_url IS 'Accio applicant portal URL for additional information collection';
```

### Step 2: Test MVR Order

```bash
# Order an MVR for a driver
curl -X POST http://localhost:3000/api/mvr/order \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x...",
    "dlNumber": "12345678",
    "dlState": "TX"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "orderNumber": "1733174400001234",
    "subOrderNumber": "889798",
    "status": "pending",
    "orderedAt": "2025-12-02T...",
    "applicantPortalUrl": "https://service.keybackground.com/c/p/collect_information?guikey=..."
  }
}
```

### Step 3: Check Order Status

```bash
curl "http://localhost:3000/api/mvr/status/{orderId}?walletAddress=0x..."
```

---

## 📊 What Happens When You Order

```
1. Driver clicks "Order MVR"
   ↓
2. Backend builds XML with latest format
   ↓
3. POST to Accio API endpoint
   ↓
4. Accio returns:
   - Order ID
   - SubOrder ID  
   - Applicant Portal URL
   ↓
5. Stored in mvr_orders table
   ↓
6. Portal URL returned to frontend (you decide when to show it)
   ↓
7. Accio processes MVR (webhook will receive results)
   ↓
8. Results auto-update driver_profiles
```

---

## 🎯 Key Features

### 1. **SuppressApplicantPortalEmail**
- **Default:** `true` (enabled)
- **What it does:** Prevents Accio from sending emails to drivers
- **Why:** You control all driver communication through your app
- **The portal URL is still generated** - you just decide when to show it

### 2. **FMCSA Crash/Inspection Reports** (Optional)
```bash
curl -X POST http://localhost:3000/api/mvr/order \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x...",
    "dlNumber": "12345678",
    "dlState": "TX",
    "includeFmcsaCrashInspection": true
  }'
```

### 3. **Job State Support**
If driver lives in CA but job is in TX:
```bash
{
  "walletAddress": "0x...",
  "dlNumber": "12345678",
  "dlState": "CA",
  "jobState": "TX"
}
```

---

## 📋 Testing Checklist

- [ ] Run `ADD_APPLICANT_PORTAL_URL.sql` migration
- [ ] Ensure driver has completed DOT application (provides personal info)
- [ ] Test ordering MVR via `/api/mvr/order`
- [ ] Verify response includes `applicantPortalUrl`
- [ ] Check `mvr_orders` table has the order stored
- [ ] Test status endpoint `/api/mvr/status/[orderId]`
- [ ] Wait for Accio webhook with results (test or real)
- [ ] Verify driver profile updates with MVR data

---

## 🎓 Understanding the Applicant Portal

### What is it?
A secure web page where drivers can provide additional information if Accio needs it.

### When is it needed?
- Most MVRs complete **without** needing the portal
- Occasionally Accio may need driver to confirm something
- Portal allows them to upload documents, verify info, etc.

### How to use it?
1. Order returns portal URL
2. Store it (it's in the database)
3. If MVR status is "needs_review" or similar, show driver the link
4. Otherwise, you can ignore it

### Why suppress the email?
- **Better UX:** Driver stays in your app
- **Control:** You decide when/if to show the portal
- **Branding:** No confusion from third-party emails

---

## 🔐 Production Credentials

When ready for production:

1. **Contact Accio/Key Background** for production credentials
2. Update `.env.local` (and production env):
```bash
ACCIO_ACCOUNT="your_production_account"
ACCIO_USERNAME="your_production_username"
ACCIO_PASSWORD="your_production_password"
ACCIO_MODE="PROD"
```
3. Keep the same API URL (it supports both test and prod modes)

---

## 📚 Documentation

- `docs/MVR_INTEGRATION.md` - Complete integration guide
- `docs/ACCIO_XML_EXAMPLE.md` - XML format examples
- `docs/CHANGES.md` - Change log
- `ADD_APPLICANT_PORTAL_URL.sql` - Database migration

---

## 🆘 Troubleshooting

### Order fails with "User not found"
➡️ Driver must complete DOT application first (provides personal info)

### No applicant portal URL in response
➡️ Check Accio's XML response in logs - may be a parsing issue

### Wrong XML format
➡️ See `docs/ACCIO_XML_EXAMPLE.md` for exact format

### Webhook not receiving results
➡️ Verify `NEXT_PUBLIC_APP_URL` is set correctly
➡️ Configure webhook URL in Accio dashboard

---

## ✨ Next Steps

1. **Run the database migration** ✅
2. **Test with the live credentials** ✅
3. **Build UI components:**
   - "Order MVR" button
   - MVR status display
   - Portal URL link (conditional)
4. **Monitor webhook for results**
5. **Get production credentials when ready**

---

**You're all set to test!** 🚀

The integration is complete, credentials are configured, and the API is ready to hit Accio's real test environment.

