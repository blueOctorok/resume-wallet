# x402 Payment Flow - How It Actually Works

## ❌ Common Misconception

**WRONG**: "The backend checks our wallet and automatically takes USDC"

## ✅ How It Actually Works

**CORRECT**: "We send a USDC payment transaction for each request, and the backend verifies it"

## The Real Flow

### Step-by-Step Process

1. **You make a request** → Your app calls `/api/ai/chat`
2. **Backend says "pay me"** → Returns 402 Payment Required with:
   - Amount needed (e.g., "0.01 USDC")
   - Recipient address (their wallet)
   - Payment ID (for tracking)
3. **Your service sends payment** → Our code:
   - Creates a USDC transfer transaction
   - Signs it with your private key
   - Sends it to Base Mainnet blockchain
   - Waits for confirmation
4. **You retry with proof** → Send the original request again with:
   - Payment transaction hash (proof you paid)
5. **Backend verifies** → Backend checks the blockchain:
   - Looks up the transaction hash
   - Verifies it's a valid USDC transfer
   - Confirms it went to their wallet
   - Processes your original request
6. **You get response** → AI response comes back normally

## Key Points

### 🔄 Each Request = New Payment

- **Every AI request** that triggers 402 requires a **new payment transaction**
- The backend doesn't "check your balance" - you must **actively send** each payment
- Payments are **on-chain transactions** - visible on BaseScan

### 💰 Wallet Funding

The wallet needs to be funded because:
- We need USDC to **send** in each payment transaction
- We need Base ETH for **gas fees** (to send the transaction)
- The backend doesn't "withdraw" - we **push** payments to them

### 🔍 Backend Verification

The backend verifies payments by:
1. Reading the transaction hash you provide
2. Looking it up on Base Mainnet blockchain
3. Confirming it's a valid USDC transfer to their address
4. Checking the amount matches what they requested

## Example Flow

```
Request 1:
  You → Backend: "Chat message"
  Backend → You: 402 Payment Required (need 0.01 USDC)
  You → Blockchain: Send 0.01 USDC to backend wallet (tx: 0xabc...)
  You → Backend: "Chat message" + payment proof (0xabc...)
  Backend → You: "AI response"

Request 2:
  You → Backend: "Another message"
  Backend → You: 402 Payment Required (need 0.01 USDC)
  You → Blockchain: Send 0.01 USDC to backend wallet (tx: 0xdef...)
  You → Backend: "Another message" + payment proof (0xdef...)
  Backend → You: "AI response"
```

## Why Fund the Wallet?

You fund the wallet so that:
- ✅ We have USDC available to send in payment transactions
- ✅ We have Base ETH to pay gas fees
- ✅ Payments can be sent automatically without manual intervention

## What Happens If Wallet Runs Out?

If the wallet runs out of USDC:
- ❌ Payment transaction will fail
- ❌ Request will fail with "Insufficient USDC balance"
- ❌ No AI response will be returned
- ✅ You'll need to fund the wallet again

## Monitoring

You can monitor payments by:
- **Transaction hashes** - Each payment has a unique hash logged in server
- **BaseScan** - View all transactions from your payment wallet
- **Balance checks** - Monitor USDC balance to know when to refill

## Summary

- ✅ **We DO send payments** - Each 402 response triggers a new USDC transaction
- ✅ **Backend verifies** - They check the blockchain to confirm payment
- ✅ **Wallet must be funded** - So we can send payments when needed
- ❌ **Backend does NOT withdraw** - We push payments, they don't pull

The wallet is like a "payment account" - you fund it, and we use it to send payments when needed. The backend never touches your wallet directly.

