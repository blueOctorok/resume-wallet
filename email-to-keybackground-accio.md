# Email to KeyBackground/Accio: Webhook Configuration

**Subject:** MVR Webhook URL Configuration - Production Ready

---

Hi [Contact Name],

We've completed testing our MVR webhook endpoint and confirmed it's working correctly. We're ready to receive MVR results from Accio in production.

## Production Webhook URL

Please configure the following webhook URL in your Accio system for our account:

```
https://www.veree.io/api/mvr/webhook
```

**Endpoint Details:**

- **Method:** POST
- **Content-Type:** application/xml
- **Expected Format:** XML with `<ScreeningResults>` root element containing `<completeOrder>` and `<subOrder>` elements

## Current Status

We have a test order currently stuck in "pending" status:

- **Order Number:** 17660726212937666
- **SubOrder Number:** 891710

This order was placed via our API on [date from your DB] but we haven't received the webhook callback yet, which suggests the webhook URL may not be configured in your system for our account.

## Testing

We've successfully tested our webhook endpoint with sample XML in the expected format, and it:

- ✅ Parses the XML correctly
- ✅ Updates order status in our database
- ✅ Stores MVR results properly
- ✅ Returns HTTP 200 success responses

**Can you please:**

1. Confirm this webhook URL is configured for our account in Accio
2. Test sending a result for order 17660726212937666 / subOrder 891710 (if available in your test environment)
3. Confirm whether Accio requires any authentication headers or query parameters when calling webhooks

## Expected XML Format

Our webhook expects Accio results in this format:

```xml
<ScreeningResults>
  <completeOrder number="[order_number]" remote_number="[remote_order_number]">
    <subOrder type="MVR"
              number="[suborder_number]"
              remote_number="[remote_suborder_number]"
              filledStatus="[status]"
              filledCode="[code]">
      <!-- MVR data here -->
    </subOrder>
  </completeOrder>
</ScreeningResults>
```

## Questions

1. Should we expect immediate webhook callbacks for orders placed in TEST mode, or only in PROD mode?
2. Are there any specific headers or authentication we should implement on our webhook endpoint?
3. How long should we expect between order placement and webhook callback in your test environment?

Please let me know once the webhook URL is configured, and we can coordinate a test if needed.

Thank you!

[Your Name]  
[Your Title]  
Veree
