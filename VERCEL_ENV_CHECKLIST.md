# Vercel Environment Variables Checklist

Copy these from your `.env.local` file to Vercel.

## Public Variables (NEXT_PUBLIC_*)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=               # Production: https://stormchain.ai (no trailing slash)
```

## Private Variables (Backend only — DO NOT prefix with NEXT_PUBLIC)

```
SUPABASE_SERVICE_ROLE_KEY=
AVA_BRAIN=                         # Anthropic API key for Stormi
ADMIN_EMAILS=                      # Comma-separated admin emails (replaces ADMIN_WALLETS)
ADMIN_API_KEY=                     # Legacy admin routes (reset-wallet, etc.)
CRON_SECRET=                       # Reconcile-screenings cron
RESEND_API_KEY=                    # Transactional email
ACCIO_ACCOUNT=
ACCIO_USERNAME=
ACCIO_PASSWORD=
ACCIO_MODE=                        # TEST or PROD
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
# STRIPE_* — add when Stripe Checkout ships (Phase 1 payments track)
```

## Removed after Track 2 demolition (D5) — delete from Vercel if still present

```
NEXT_PUBLIC_ALCHEMY_API_KEY
NEXT_PUBLIC_ALCHEMY_POLICY_ID
NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS
NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS
NEXT_PUBLIC_PINATA_JWT
NEXT_PUBLIC_PINATA_GATEWAY
NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID
PRIVATE_KEY
X402_PAYMENT_PRIVATE_KEY
ALCHEMY_API_KEY
ALCHEMY_BASE_MAINNET_URL
ALCHEMY_BASE_SEPOLIA_URL
ALCHEMY_AUTH_TOKEN
ALCHEMY_WEBHOOK_SIGNING_KEY
PINATA_API_KEY
PINATA_API_SECRET
DYNAMIC_API_TOKEN
```

## How to Add in Vercel

1. Go to https://vercel.com/your-project/settings/environment-variables
2. Add each variable one by one
3. Select all environments (Production, Preview, Development)
4. Click "Save"
5. Redeploy your project

## Security Notes

- **SUPABASE_SERVICE_ROLE_KEY**: Full database access — very sensitive
- **ADMIN_API_KEY**: Protects legacy admin routes — use a strong random value
- **ACCIO_***: CRA screening credentials — treat as production secrets

## After Changing Variables

- Go to Deployments tab → Redeploy latest
- Smoke test: incognito sign-in → candidate hub → employer screening order
