# x402 Payment Setup Guide

## Overview

This guide explains how to set up automatic payment handling for the Pace Drivers x402 integration. When the T Backend API returns a 402 Payment Required response, the service will automatically pay using USDC on Base Mainnet.

## How It Works

1. **Request Flow**: Your app sends requests to T Backend with `X-Partner: pace_drivers` header
2. **Payment Trigger**: Backend returns 402 Payment Required with payment details
3. **Automatic Payment**: Service wallet automatically sends USDC payment on Base Mainnet
4. **Retry**: Original request is retried with payment proof
5. **Response**: User gets their AI response as normal

## Setup Instructions

### 1. Configure Payment Wallet

You need a wallet with USDC on Base Mainnet. Your boss should fund this wallet.

**Option A: Use Existing PRIVATE_KEY**
- If you already have `PRIVATE_KEY` in `.env.local` with USDC, it will be used automatically

**Option B: Dedicated Payment Wallet (Recommended)**
- Create a new wallet specifically for payments
- Add to `.env.local`:
  ```bash
  X402_PAYMENT_PRIVATE_KEY="0xYourPrivateKeyHere"
  ```

### 2. Fund the Wallet

The payment wallet needs:
- **USDC on Base Mainnet** - For paying the AI service
- **Base ETH** - For gas fees (minimal, usually < $0.01 per transaction)

**To get USDC on Base Mainnet:**
1. Bridge USDC from another chain (e.g., Ethereum) using [Base Bridge](https://bridge.base.org)
2. Or buy USDC directly on Base using a DEX like Uniswap

**To get Base ETH:**
1. Bridge ETH from Ethereum mainnet
2. Or buy ETH on Base

### 3. Verify Configuration

Check that these environment variables are set:

```bash
# Required
T_BACKEND_API_KEY="your-api-key"
T_BACKEND_BASE_URL="https://api-v2.fluxpointstudios.com"

# Payment wallet (one of these)
X402_PAYMENT_PRIVATE_KEY="0x..." # Preferred: dedicated wallet
# OR
PRIVATE_KEY="0x..." # Fallback: existing wallet

# RPC URL (for Base Mainnet)
ALCHEMY_BASE_MAINNET_URL="https://base-mainnet.g.alchemy.com/v2/YOUR_KEY"
# OR
BASE_RPC_URL="https://mainnet.base.org"
```

### 4. Test the Integration

Make a test request to verify payment flow:

```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, test payment flow"}'
```

**Expected behavior:**
1. First request triggers 402 Payment Required
2. Service automatically pays USDC
3. Request is retried with payment proof
4. You receive the AI response

## Monitoring

### Check Payment Wallet Balance

You can check the payment wallet balance using:

```typescript
// In your code
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const client = createPublicClient({
  chain: base,
  transport: http(process.env.ALCHEMY_BASE_MAINNET_URL),
})

// Check USDC balance
const balance = await client.readContract({
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
  abi: [/* ERC20 ABI */],
  functionName: 'balanceOf',
  args: [walletAddress],
})
```

### View Payment Transactions

All payments are on-chain, so you can view them on:
- [BaseScan](https://basescan.org) - Search by wallet address
- Transaction hashes are logged in the server console

## Cost Estimation

- **Per-request cost**: Varies based on token usage (check 402 response for exact amount)
- **Gas fees**: ~$0.001-0.01 per payment transaction
- **Total**: Usually < $0.10 per AI request

## Troubleshooting

### Error: "X402_PAYMENT_PRIVATE_KEY or PRIVATE_KEY not configured"
- **Solution**: Add one of these to `.env.local`

### Error: "Insufficient USDC balance"
- **Solution**: Fund the payment wallet with more USDC on Base Mainnet

### Error: "Payment completed but request failed"
- **Solution**: Check T Backend API status, payment was successful but API request failed

### Payment succeeds but no response
- **Solution**: Check server logs for retry errors, may need to contact T Backend team

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit private keys** - Keep `.env.local` in `.gitignore`
2. **Use dedicated wallet** - Don't use your main wallet for payments
3. **Monitor balance** - Set up alerts for low balance
4. **Limit wallet funding** - Only fund what you need for expected usage
5. **Rotate keys** - If a key is compromised, rotate immediately

## Next Steps

1. ✅ Configure payment wallet
2. ✅ Fund with USDC on Base Mainnet
3. ✅ Test payment flow
4. ✅ Monitor balance and transactions
5. ✅ Set up alerts for low balance

## Support

If you encounter issues:
1. Check server logs for detailed error messages
2. Verify wallet has sufficient USDC balance
3. Confirm Base Mainnet RPC is accessible
4. Contact T Backend team if payment succeeds but requests fail

