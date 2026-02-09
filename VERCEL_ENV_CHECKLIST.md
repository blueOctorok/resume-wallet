# Vercel Environment Variables Checklist

Copy these from your `.env.local` file to Vercel:

## Public Variables (NEXT*PUBLIC*\*)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_ALCHEMY_API_KEY=
NEXT_PUBLIC_ALCHEMY_POLICY_ID=
NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS=
NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS=
NEXT_PUBLIC_PINATA_JWT=
NEXT_PUBLIC_PINATA_GATEWAY=
NEXT_PUBLIC_APP_URL=               # Production: https://stormchain.ai (no trailing slash)
NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=
```

## Private Variables (Backend only - DO NOT prefix with NEXT*PUBLIC*)

```
PRIVATE_KEY=
X402_PAYMENT_PRIVATE_KEY=          # ⚠️ CRITICAL: Controls wallet with real USDC funds
ALCHEMY_API_KEY=
ALCHEMY_BASE_MAINNET_URL=          # Required for x402 payments on Base Mainnet
ALCHEMY_BASE_SEPOLIA_URL=
SUPABASE_SERVICE_ROLE_KEY=
T_BACKEND_API_KEY=                 # AI service API key
T_BACKEND_BASE_URL=                # Usually: https://api-v3.fluxpointstudios.com
ADMIN_API_KEY=                     # For admin routes (credits, reset-wallet, etc.)
PINATA_API_KEY=
PINATA_API_SECRET=
DYNAMIC_API_TOKEN=
ACCIO_ACCOUNT=
ACCIO_USERNAME=
ACCIO_PASSWORD=
ACCIO_MODE=                        # TEST or PROD
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
```

## How to Add in Vercel:

1. Go to https://vercel.com/your-project/settings/environment-variables
2. Add each variable one by one
3. Select all environments (Production, Preview, Development)
4. Click "Save"
5. Redeploy your project

## Google OAuth (Alchemy) – Required after domain change

If Google sign-in fails with **`OauthFailedError: Opener origin not allowed`** after moving to stormchain.ai:

1. **Set app URL everywhere**
   - In **.env.local**: `NEXT_PUBLIC_APP_URL=https://stormchain.ai` (no trailing slash)
   - In **Vercel** → Project → Settings → Environment Variables: set `NEXT_PUBLIC_APP_URL` to `https://stormchain.ai` for Production (and Preview if you use it)
   - Redeploy after changing env vars.

2. **Whitelist the new domain in Alchemy**
   - Go to [Alchemy Dashboard](https://dashboard.alchemy.com/) → your app → **Account Kit** / **Authentication** (or **APIs** → Account Kit).
   - Find **Allowed origins** / **Authorized JavaScript origins** / **Redirect URIs**.
   - Add:
     - `https://stormchain.ai`
     - `https://www.stormchain.ai` (if you use www)
   - Remove or keep old veree.io entries as needed. Save.

3. **Google Cloud Console** (if you use your own OAuth client)
   - In [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → your OAuth 2.0 Client ID:
   - **Authorized JavaScript origins**: add `https://stormchain.ai` and `https://www.stormchain.ai`
   - **Authorized redirect URIs**: add whatever Alchemy or Google shows (e.g. `https://auth.alchemy.com/...` or your callback URL). Save.

Without the new origin in Alchemy (and in Google if applicable), the popup is blocked and login breaks.

## ⚠️ Security Notes:

- **X402_PAYMENT_PRIVATE_KEY**: This controls a wallet with real USDC funds. Keep it secure!
- **PRIVATE_KEY**: Deployment wallet private key - also sensitive
- **SUPABASE_SERVICE_ROLE_KEY**: Full database access - very sensitive
- **ADMIN_API_KEY**: Protects admin routes - use a strong random value

## After Adding Variables:

- Go to Deployments tab
- Click "..." on latest deployment
- Click "Redeploy"
- Wait for build to complete
- Test your app!

## Important for x402 Payments:

If you're using the x402 payment system:

1. Make sure `X402_PAYMENT_PRIVATE_KEY` is set
2. Make sure `ALCHEMY_BASE_MAINNET_URL` is set (for Base Mainnet payments)
3. Ensure the payment wallet has USDC and ETH on Base Mainnet
4. Test the payment flow after deployment
