# Email to Accio/KeyBackground: Order Still Pending

**Subject:** MVR Order #17670510585509155 - Still Pending After 30+ Minutes in PROD Mode

---

Hi [Contact Name],

I placed a new MVR order about 30 minutes ago with all the corrections you requested, but it's still showing as "pending" with no webhook callback received.

**Order Details:**

- **Order Number:** 17670510585509155
- **SubOrder Number:** 892447
- **Ordered At:** 12/29/2025 6:31 PM EST
- **Mode:** PROD (as requested)
- **Status:** Still pending (no webhook received)

**XML Configuration (Verified Correct):**

- ✅ `<mode>PROD</mode>` (both outer and inside placeOrder)
- ✅ `<portalfromapplicant>N</portalfromapplicant>`
- ✅ Webhook URL: `https://www.veree.io/api/mvr/webhook` (no double slash)
- ✅ All required fields present

**Webhook Endpoint Status:**

- ✅ Publicly accessible (verified via curl)
- ✅ Responding to GET requests
- ✅ Ready to receive POST requests from Accio

**Questions:**

1. Has Accio processed order #17670510585509155 yet?
2. Can you check Accio's logs to see if they attempted to call our webhook URL?
3. Is the webhook URL `https://www.veree.io/api/mvr/webhook` configured in Accio's system for account "testaccount"?
4. In PROD mode with test credentials, what's the expected processing time?
5. Can you manually trigger/retry the webhook for this order?

I've verified our webhook endpoint is working correctly (we successfully tested it manually with sample XML), so the issue appears to be on Accio's side - either the webhook isn't configured, or the order isn't being processed.

Thanks for your help!

[Your Name]
