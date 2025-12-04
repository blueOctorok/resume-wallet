# How to Verify Accio MVR Orders Are Real

## ✅ Verification Steps

### 1. **Check the Database**

Run this query in Supabase SQL Editor to see your order:

```sql
SELECT 
  id,
  accio_order_number,
  accio_suborder_number,
  status,
  dl_number,
  dl_state,
  applicant_portal_url,
  order_xml,
  created_at
FROM mvr_orders
WHERE driver_user_id = (
  SELECT id FROM users 
  WHERE wallet_address ILIKE '0x1Ac064B66497654f0103505cdDba503AcC63B287'
)
ORDER BY created_at DESC
LIMIT 1;
```

**What to look for:**
- ✅ `order_xml` should contain the full XML you sent to Accio
- ✅ `accio_order_number` should match what you generated
- ✅ `status` should be `pending`
- ✅ `applicant_portal_url` should be a Key Background URL (if Accio returned it)

### 2. **Check Server Logs**

When you order, look for these log lines:

```
[MVR ORDER] Accio API response received
[MVR ORDER] Accio response (first 500 chars): <XML>...
[MVR ORDER] Parsed response - subOrderId: ... portalUrl: ...
```

**What to verify:**
- ✅ Response should start with `<?xml` or `<XML>`
- ✅ Should contain `order` or `subOrder` elements
- ✅ Should come from `service.keybackground.com` domain

### 3. **Verify It's Accio's Real API**

**Evidence it's real:**
1. **API Endpoint**: `https://service.keybackground.com/c/p/researcherxml` - This is Accio's actual production endpoint
2. **Response Format**: Accio returns XML with their specific structure
3. **Order Number**: Accio assigns their own order/suborder IDs
4. **Portal URL**: If returned, it's a unique Key Background URL

### 4. **Wait for Webhook (Final Proof)**

The **real proof** that it's working is when Accio sends results back via webhook:

1. Accio processes your order (can take minutes to hours)
2. Accio sends results to your webhook: `/api/mvr/webhook`
3. Results are stored in `mvr_results` table
4. Driver profile is automatically updated

**Check webhook status:**
```sql
SELECT 
  mr.*,
  mo.accio_order_number,
  mo.status as order_status
FROM mvr_results mr
JOIN mvr_orders mo ON mo.id = mr.mvr_order_id
WHERE mo.driver_user_id = (
  SELECT id FROM users 
  WHERE wallet_address ILIKE '0x1Ac064B66497654f0103505cdDba503AcC63B287'
)
ORDER BY mr.received_at DESC;
```

### 5. **Test vs Production**

**Current Setup:**
- `ACCIO_MODE="TEST"` - Using test credentials
- `ACCIO_ACCOUNT="testaccount"` - Test account
- Endpoint: Real Accio API (not mocked)

**What this means:**
- ✅ You're hitting Accio's **real API endpoint**
- ✅ Using **test credentials** (provided by Accio)
- ⚠️ May return **test/sample data** instead of real MVR results
- ⚠️ May not charge you (test account)

**For Production:**
- Change `ACCIO_MODE="PROD"`
- Use production credentials from Accio
- Will process real MVRs and charge accordingly

## 🔍 Troubleshooting

### If `subOrderId` is null:
- Check the server logs for the full Accio response
- Accio's test environment might return a different format
- The order was still created successfully (just missing suborder ID)

### If `applicantPortalUrl` is null:
- This is normal - Accio may not always return it
- Portal is only needed if Accio requests additional info
- Most MVRs complete without it

### If you want to see the full response:
Check your terminal/server logs - the first 500 characters of Accio's response are now logged.

## 📊 What Success Looks Like

**Immediate (Order Placed):**
- ✅ Order stored in `mvr_orders` table
- ✅ `status = 'pending'`
- ✅ `order_xml` contains your XML
- ✅ `accio_order_number` populated

**Later (Results Received):**
- ✅ Webhook receives XML from Accio
- ✅ Results stored in `mvr_results` table
- ✅ `mvr_orders.status` changes to `completed`
- ✅ Driver profile updated with MVR data

---

**Bottom Line:** If the order was created in your database with `order_xml` populated, you successfully sent it to Accio's real API. The webhook results will be the final confirmation that it's fully working.

