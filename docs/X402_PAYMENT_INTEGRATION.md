# x402 Payment Integration Guide

## Overview

This document explains how the Pace Drivers x402 payment integration works with the T Backend API and how to implement it in the ResumeWallet application.

## How It Works

### The API Key vs Payment Flow

**Important Understanding:**
- Your API key (`T_BACKEND_API_KEY`) is used for **authentication** - it identifies your application to the T Backend API
- The API key does **NOT** bypass payment requirements
- When you send requests with `X-Partner: pace_drivers` header, the backend **forces payment** even with a valid API key
- Payment is **per-request** and uses **USDC on Base network**

### Request Flow

1. **Client sends request** with:
   - `api-key` header: Your API key for authentication
   - `X-Partner: pace_drivers` header: Triggers payment requirement
   - Request body: Your actual API request (e.g., chat message)

2. **Backend detects partner** and forces payment:
   - Backend sees `X-Partner: pace_drivers` header
   - Backend returns **402 Payment Required** response
   - Response includes payment details (amount, recipient, chain, etc.)

3. **Client handles payment**:
   - Extract payment requirements from 402 response
   - Sign and submit USDC payment on Base network
   - Get payment proof (transaction hash)

4. **Client retries original request**:
   - Include payment proof in retry request
   - Backend verifies payment
   - Request proceeds normally

### Why 30 Days and Not Expired?

The API key you received is likely:
- A **long-lived key** (not a 30-day expiration)
- Used for **authentication only** (not payment bypass)
- Still valid because it hasn't been revoked

The "30 days" might refer to:
- A trial period for the payment integration
- A billing cycle
- Or it might just be a misunderstanding - the key itself may not expire

## Current Implementation Status

### What We Have

✅ **API Key Authentication**: Working in `src/app/api/ai/chat/route.ts`
- Sends `api-key` header with requests
- Handles basic errors (400, 401, 429, 500)

❌ **x402 Payment Handling**: Not implemented
- No handling for 402 Payment Required responses
- No payment flow integration
- No retry logic with payment proof

### What We Need

1. **Detect 402 responses** from T Backend
2. **Extract payment requirements** from 402 response body
3. **Initiate USDC payment** on Base network (using existing Base Pay integration)
4. **Retry original request** with payment proof
5. **Handle payment verification** and errors

## Implementation Options

### Option 1: Server-Side Payment Handling (Recommended)

**Pros:**
- Payment happens on backend (more secure)
- Can use service wallet for payments
- Better error handling and retry logic

**Cons:**
- Requires Base private key on server
- More complex implementation

**Implementation:**
- Modify `src/app/api/ai/chat/route.ts` to:
  1. Check for 402 responses
  2. Extract payment requirements
  3. Use viem to sign and submit USDC payment
  4. Retry request with payment proof

### Option 2: Client-Side Payment Handling

**Pros:**
- User pays directly from their wallet
- No server-side private keys needed
- Better user experience (user controls payment)

**Cons:**
- Requires wallet connection in frontend
- More complex frontend code
- Payment happens in browser

**Implementation:**
- Frontend detects 402 response
- Shows payment UI to user
- User approves payment in wallet
- Frontend retries request with payment proof

### Option 3: Hybrid Approach

**Pros:**
- Best of both worlds
- Can fallback to server-side if user wallet unavailable

**Cons:**
- Most complex implementation
- Requires both flows

## Next Steps

1. **Decide on implementation approach** (Option 1, 2, or 3)
2. **Test 402 response format** - Make a test request to see exact response structure
3. **Implement payment flow** - Use existing Base Pay integration or viem for USDC payments
4. **Add retry logic** - Retry original request with payment proof
5. **Handle edge cases** - Payment failures, timeouts, etc.

## Testing

To test the payment flow:

```bash
# Test request that should trigger 402
curl -X POST https://api-v2.fluxpointstudios.com/chat \
  -H "api-key: YOUR_API_KEY" \
  -H "X-Partner: pace_drivers" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'
```

Expected response:
```json
{
  "status": 402,
  "detail": "Payment required",
  "payment": {
    "amount": "...",
    "recipient": "...",
    "chain": "base",
    // ... other payment details
  }
}
```

## Questions to Answer

1. **Do you want to implement this payment flow?** (Yes/No)
2. **Which implementation approach?** (Server-side / Client-side / Hybrid)
3. **Who pays?** (Your service wallet / End users)
4. **Is the API key actually expiring?** (Check with team to confirm)

## References

- Pace Drivers x402 Integration Setup (provided documentation)
- Existing Base Pay integration: `src/components/BasePayButton.tsx`
- Existing USDC payment code: `src/components/MvrPaymentButton.tsx`
- T Backend API docs: `docs/T_BACKEND_API.md`

