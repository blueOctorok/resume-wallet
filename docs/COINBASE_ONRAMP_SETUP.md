# Coinbase Onramp Setup Guide

This guide explains how to set up Coinbase Onramp so users can buy USDC directly in their wallet.

## Overview

With Coinbase Onramp, users can:
- Buy USDC with credit/debit card
- Use Apple Pay or Google Pay
- Fund their wallet without leaving your app
- Skip external exchanges and transfers

## Setup Steps

### 1. Create a Coinbase Developer Account

1. Go to [Coinbase Developer Platform](https://portal.cdp.coinbase.com/)
2. Sign up (it's free)
3. Verify your email

### 2. Create an Onramp Project

1. In the CDP dashboard, create a new project
2. Copy your **Project ID** (also called `appId`)
3. Note: You initially get 25 test transactions up to $5 each

### 3. Create an API Key

1. Go to **Settings → API Keys**
2. Click **Create API Key**
3. Select **Onramp** permissions
4. Download your API key file (contains key name and private key)

### 4. Add Environment Variables

Add these to your `.env.local` file:

```bash
# Coinbase Developer Platform Onramp
# Get these from https://portal.cdp.coinbase.com/

# The API key name (looks like: "organizations/xxx/apiKeys/xxx")
CDP_API_KEY_NAME="organizations/YOUR_ORG_ID/apiKeys/YOUR_KEY_ID"

# The private key in PEM format (from downloaded key file)
# IMPORTANT: Include the full key with newlines
CDP_API_KEY_PRIVATE_KEY="-----BEGIN EC PRIVATE KEY-----
MHQCAQEEIJxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
-----END EC PRIVATE KEY-----"
```

**Important:** The private key must be in EC (elliptic curve) PEM format with newlines preserved.

### 5. Test It Out

1. Start your dev server: `npm run dev`
2. Log in with your Alchemy Smart Wallet
3. Look for the "Buy USDC" button in your wallet card
4. Click it — Coinbase Onramp should open in a popup

## How It Works

```
User clicks "Buy USDC"
    ↓
Frontend requests session token from /api/onramp/session
    ↓
Backend generates JWT with CDP credentials
    ↓
Backend requests session token from Coinbase API
    ↓
Frontend opens Coinbase Onramp popup with session token
    ↓
User completes purchase in Coinbase UI
    ↓
USDC arrives in user's Alchemy Smart Wallet on Base
```

## Troubleshooting

### "Coinbase Onramp not yet configured"

This means the CDP environment variables aren't set. Double-check:
- `CDP_API_KEY_NAME` is set correctly
- `CDP_API_KEY_PRIVATE_KEY` includes the full PEM key with headers

### "Failed to generate session token"

Check the server logs for details. Common issues:
- Invalid API key format
- Key doesn't have Onramp permissions
- Private key format is wrong (needs newlines)

### Popup Blocked

If the user's browser blocks the popup:
- The code falls back to opening in a new tab
- Users may need to allow popups for your domain

## Production Considerations

### Request Higher Limits

For production use, apply for higher limits:
1. Go to [CDP Support](https://support.cdp.coinbase.com/onramp-onboarding)
2. Request increased transaction limits

### Security

The backend API route:
- Validates wallet address format
- Includes client IP for Coinbase security validation
- Uses short-lived JWT tokens (2 minutes)
- Session tokens are one-time use

### Costs

- **Developer cost:** Free
- **User fees:** Standard Coinbase exchange fees apply
- No additional fees to you

## Files Reference

| File | Purpose |
|------|---------|
| `src/app/api/onramp/session/route.ts` | Backend session token generation |
| `src/components/BuyUSDCButton.tsx` | UI button component |
| `src/components/WalletCard.tsx` | Integration point |

## Resources

- [Coinbase Developer Platform](https://portal.cdp.coinbase.com/)
- [Onramp Documentation](https://docs.cdp.coinbase.com/onramp-&-offramp/introduction/welcome)
- [Session Token API](https://docs.cdp.coinbase.com/onramp-&-offramp/session-token-authentication)
