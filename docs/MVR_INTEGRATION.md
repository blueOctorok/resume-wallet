# MVR Integration with Accio API

Complete integration guide for Motor Vehicle Record (MVR) ordering and processing via Accio API.

## 📋 Overview

This integration allows drivers to order MVRs (Motor Vehicle Records) through Accio API, receive results via webhook, and automatically update their driver profiles with verified license information.

**Impact on Profile Completeness:**
- MVR adds **35 points** to profile completeness score (out of 135 total)
- Valid MVR = +20 points
- License status verified = +10 points
- Current (non-expired) MVR = +5 points
- **Total possible score increased from 100 to 135** (MVR can boost profiles significantly!)

---

## 🗄️ Database Schema

### Migration 003: MVR Integration

Run `supabase/migrations/003_mvr_integration.sql` to create:

**Tables:**
- `mvr_orders` - Tracks every MVR order placed with Accio
- `mvr_results` - Stores parsed MVR results from webhooks

**Enhanced:**
- `driver_profiles` - Added 7 MVR-related fields for quick access

See `supabase/migrations/RUN_MIGRATION_003.md` for detailed instructions.

---

## 🔧 Environment Variables

Add these to `.env.local` (and production environment):

```bash
# Accio MVR API (Key Background / Accio integration)
ACCIO_ACCOUNT="testaccount"
ACCIO_USERNAME="admin"
ACCIO_PASSWORD="demo2023"
ACCIO_MODE="TEST" # TEST for testing, PROD for production
ACCIO_API_URL="https://service.keybackground.com/c/p/researcherxml"
NEXT_PUBLIC_APP_URL="http://localhost:3000" # For webhook URL generation
```

**✅ Test Credentials Ready!** The credentials above are real test credentials provided by Accio/Key Background. You can use them immediately for testing.

**For Production:** Contact Accio to get your production credentials and change `ACCIO_MODE` to `PROD`.

---

## 🚀 API Endpoints

### 1. Order MVR

**POST** `/api/mvr/order`

Orders an MVR from Accio for a driver.

**Request Body:**
```json
{
  "walletAddress": "0x...",
  "dlNumber": "123456789",
  "dlState": "TX",
  "mvrSearchType": "standard", // optional: "standard" | "comprehensive"
  "includeFmcsaCrashInspection": false, // optional: include FMCSA crash/inspection report
  "jobState": "NY" // optional: state where job will be performed (defaults to residential state)
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "orderNumber": "1234567890",
    "subOrderNumber": "889798",
    "status": "pending",
    "orderedAt": "2025-11-25T12:00:00Z",
    "applicantPortalUrl": "https://service.keybackground.com/c/p/collect_information?guikey=n9N1xA52M3PQ7nrd0pvFakvd26q71H7o"
  }
}
```

**Important:** The `applicantPortalUrl` is returned when `SuppressApplicantPortalEmail` is enabled (default). This URL allows applicants to provide additional information if needed by Accio, but the email is suppressed so you control when/how to present it to drivers.

**How it works:**
1. Validates driver has completed DOT application (for personal info)
2. Builds Accio XML order payload
3. Sends order to Accio API
4. Parses Accio's XML response to extract subOrderID and applicantPortalURL
5. Stores order in `mvr_orders` table
6. Returns order details including portal URL

**About the Applicant Portal URL:**
- Accio returns a unique portal URL for each order
- Portal allows driver to provide additional info if needed
- Email is suppressed (you control when to show the URL)
- You can present this URL to the driver in your UI if additional info is needed
- Most MVRs complete without requiring the portal

---

### 2. Webhook Handler

**POST** `/api/mvr/webhook`

Receives MVR results from Accio (called by Accio, not directly by users).

**Request:** Raw XML body from Accio

**Response:**
```json
{
  "success": true,
  "message": "MVR result processed successfully",
  "orderNumber": "1234567890",
  "subOrderNumber": "9876543210"
}
```

**How it works:**
1. Parses XML result from Accio
2. Stores result in `mvr_results` table
3. Updates `mvr_orders` status to "completed"
4. Auto-updates `driver_profiles` with MVR data
5. Recalculates profile completeness score

**⚠️ Security:** Uses service role key to bypass RLS for webhook processing.

---

### 3. Get Order Status

**GET** `/api/mvr/status/[orderId]?walletAddress=0x...`

Gets the current status of an MVR order and its results (if available).

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "orderNumber": "1234567890",
    "subOrderNumber": "889798",
    "status": "completed",
    "orderedAt": "2025-11-25T12:00:00Z",
    "processedAt": "2025-11-25T12:05:00Z",
    "completedAt": "2025-11-25T12:10:00Z",
    "expiresAt": "2025-12-25T12:00:00Z",
    "feeAmount": 6.50,
    "applicantPortalUrl": "https://service.keybackground.com/c/p/collect_information?guikey=..."
  },
  "result": {
    "id": "uuid",
    "licenseNumber": "123456789",
    "licenseState": "TX",
    "licenseClass": "A",
    "licenseStatus": "Valid",
    "licenseExpirationDate": "2026-12-31",
    "totalPoints": 0,
    "violationCount": 0,
    "accidentCount": 0,
    "suspensionCount": 0,
    "resultStatus": "parsed",
    "receivedAt": "2025-11-25T12:10:00Z",
    "parsedAt": "2025-11-25T12:10:01Z"
  }
}
```

---

## 📦 Utility Functions

### XML Builder (`src/lib/accio-xml-builder.ts`)

Builds Accio XML order payloads:

```typescript
import { buildAccioMvrOrderXml, generateOrderNumber, generateWebhookGuid } from '@/lib/accio-xml-builder'

const xml = buildAccioMvrOrderXml({
  firstName: "John",
  middleName: "B", // optional
  lastName: "Doe",
  email: "john@example.com",
  phone: "555-555-5555", // optional (defaults to 555-555-5555 if missing)
  ssn: "1234", // Last 4 digits only
  dob: "1987-06-01",
  gender: "M", // optional: M/F/U (defaults to U)
  race: "U", // optional (defaults to U for Unknown)
  address: "123 Main St",
  city: "Austin",
  state: "TX", // residential state
  zip: "78701",
  jobState: "NY", // optional: state where job will be performed (defaults to residential state)
  dlNumber: "123456789",
  dlState: "TX",
  orderNumber: generateOrderNumber(),
  mvrSearchType: "standard", // optional: standard or comprehensive
  suppressApplicantEmail: true, // optional: prevent Accio from emailing applicant (defaults to true)
  includeFmcsaCrashInspection: false, // optional: include FMCSA crash/inspection report (defaults to false)
  webhookUrl: "https://yourapp.com/api/mvr/webhook",
  webhookGuid: generateWebhookGuid()
})
```

**New Fields Explained:**
- `gender`: Driver's gender (M = Male, F = Female, U = Unknown). Defaults to 'U'.
- `race`: Driver's race code. Defaults to 'U' (Unknown) for privacy.
- `jobState`: State where the driving job will be performed. Defaults to residential state if not provided.
- `suppressApplicantEmail`: When true (default), prevents Accio from sending portal emails to applicants. We handle all driver communication.
- `includeFmcsaCrashInspection`: When true, orders an additional FMCSA crash/inspection report alongside the MVR.

### XML Parser (`src/lib/accio-xml-parser.ts`)

Parses Accio XML results:

```typescript
import { parseAccioMvrResult, mvrResultToJsonb } from '@/lib/accio-xml-parser'

const parsed = parseAccioMvrResult(xmlString)
const jsonb = mvrResultToJsonb(parsed) // For database storage
```

---

## 📊 Profile Completeness Integration

MVR data is automatically included in profile completeness calculations:

**New Category: MVR Verification (35 points)**
- MVR Verified: 20 points
- License Status Verified: 10 points
- Current (Non-Expired) MVR: 5 points

**Updated Score Calculation:**
- Old max: 100 points
- New max: 135 points (with MVR)

**Automatic Updates:**
- When MVR results are received, profile completeness is automatically recalculated
- MVR data syncs to `driver_profiles` table via database trigger

---

## 🔄 Complete Flow

1. **Driver orders MVR:**
   ```
   POST /api/mvr/order
   → Validates driver has DOT application
   → Builds Accio XML
   → Sends to Accio API
   → Stores in mvr_orders (status: "pending")
   ```

2. **Accio processes order:**
   ```
   Accio receives order
   → Processes MVR request
   → Sends results to webhook URL
   ```

3. **Webhook receives results:**
   ```
   POST /api/mvr/webhook
   → Parses XML result
   → Stores in mvr_results
   → Updates mvr_orders (status: "completed")
   → Updates driver_profiles
   → Recalculates profile completeness
   ```

4. **Driver views status:**
   ```
   GET /api/mvr/status/[orderId]
   → Returns order status and results
   ```

---

## 🛡️ Security Considerations

1. **SSN Handling:**
   - Only last 4 digits stored in XML order
   - Full SSN never stored in database
   - SSN extracted from DOT application (already stored securely)

2. **Webhook Security:**
   - Uses service role key to bypass RLS
   - Validates order exists before processing
   - Idempotent (safe to re-process same result)

3. **RLS Policies:**
   - Drivers can only view their own MVR orders/results
   - Service role can insert/update for webhook processing

---

## 🧪 Testing

### Test Order Flow:

1. **Complete DOT application** (required for personal info)
2. **Order MVR:**
   ```bash
   curl -X POST http://localhost:3000/api/mvr/order \
     -H "Content-Type: application/json" \
     -d '{
       "walletAddress": "0x...",
       "dlNumber": "123456789",
       "dlState": "TX"
     }'
   ```

3. **Check status:**
   ```bash
   curl "http://localhost:3000/api/mvr/status/[orderId]?walletAddress=0x..."
   ```

### Test Webhook (Manual):

1. Get sample XML from Accio documentation
2. Send to webhook:
   ```bash
   curl -X POST http://localhost:3000/api/mvr/webhook \
     -H "Content-Type: application/xml" \
     --data-binary "@sample-result.xml"
   ```

---

## 🐛 Troubleshooting

### Error: "Missing Accio credentials"
**Solution:** Add all Accio environment variables to `.env.local`

### Error: "User not found"
**Solution:** Make sure driver has completed DOT application first

### Error: "MVR order not found" (webhook)
**Solution:** Verify order number matches what was stored in database

### Error: "Failed to parse XML"
**Solution:** Check XML format matches Accio schema. May need to enhance parser.

---

## 📝 Next Steps

1. **Configure Accio Credentials:**
   - Get actual Accio API credentials
   - Add to `.env.local` and production environment
   - Configure webhook URL in Accio dashboard

2. **Test Integration:**
   - Place test MVR order
   - Verify webhook receives results
   - Check profile completeness updates

3. **Build UI Components:**
   - MVR ordering button/component
   - MVR status display
   - MVR results viewer

4. **Enhance XML Parser:**
   - Current parser uses basic regex
   - Consider using `xml2js` or `fast-xml-parser` for production
   - Add more detailed violation/accident parsing

---

## 📚 Related Documentation

- `supabase/migrations/003_mvr_integration.sql` - Database schema
- `supabase/migrations/RUN_MIGRATION_003.md` - Migration instructions
- `docs/CHANGES.md` - Project change log
- `src/lib/profile-completeness.ts` - Profile score calculator

---

**Status:** ✅ Backend integration complete - Ready for UI components!

