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
NEXT_PUBLIC_APP_URL=               # ⚠️ Update to your Vercel URL: https://your-app.vercel.app
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
T_BACKEND_BASE_URL=                # Usually: https://api-v2.fluxpointstudios.com
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

## Google OAuth Issue:

The error `OauthFailedError: Opener origin not allowed: https://veree.vercel.app` means:

- Go to Alchemy Dashboard
- Add `https://veree.vercel.app` to allowed origins
- Save and try again

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
