# Vercel Environment Variables Checklist

Copy these from your `.env.local` file to Vercel.

## Public Variables (NEXT_PUBLIC_*)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=               # Production: https://zknight.io (no trailing slash)
```

## Private Variables (Backend only — DO NOT prefix with NEXT_PUBLIC)

```
SUPABASE_SERVICE_ROLE_KEY=
AVA_BRAIN=                         # Anthropic API key for the AI assistant
ADMIN_EMAILS=                      # Comma-separated admin emails (replaces ADMIN_WALLETS)
ADMIN_API_KEY=                     # Legacy admin routes (reset-wallet, etc.)
CRON_SECRET=                       # Reconcile-screenings cron
PINGRAM_API_KEY=                   # Pingram secret key (pingram_sk_...) — email + future SMS
PINGRAM_FROM_EMAIL=                # e.g. zknight@verify.zknight.io — MUST be a Pingram-verified domain
PINGRAM_FROM_NAME=ZKnight          # Display name on outbound email
ADMIN_NOTIFICATION_EMAILS=         # Comma-separated ops alert recipients
GITHUB_CLIENT_ID=                  # GitHub OAuth app (callback: https://zknight.io/api/github/callback)
GITHUB_CLIENT_SECRET=
ACCIO_ACCOUNT=
ACCIO_USERNAME=
ACCIO_PASSWORD=
ACCIO_MODE=                        # TEST or PROD
ACCIO_API_URL=                     # Optional; has default
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
SCREENING_CONSENT_ENCRYPTION_KEY=  # FCRA consent bundle encryption
INTERNAL_API_SECRET=               # Server-to-server (referrals, etc.)
ATTESTATION_JWT_PRIVATE_KEY=        # Phase 2: HS256 secret for signed attestations (32+ chars)
ATTESTATION_ISSUER=storm           # JWT iss claim (optional; default storm)
# ATTESTATION_BACKEND=             # Optional; omit for signed JWT (Phase 2). midnight = Phase 3 only.
# MIDNIGHT_* — Phase 3 (see docs/midnight)
# STRIPE_* — add when Stripe Checkout ships
```

## Removed — delete from Vercel if still present

```
RESEND_API_KEY
RESEND_FROM_EMAIL
NEXT_PUBLIC_ALCHEMY_API_KEY
NEXT_PUBLIC_ALCHEMY_POLICY_ID
NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS
NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS
NEXT_PUBLIC_PINATA_JWT
NEXT_PUBLIC_PINATA_GATEWAY
NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID
DYNAMIC_API_TOKEN
ALCHEMY_API_KEY
ALCHEMY_POLICY_ID
COMPANY_WALLET_SERVICE_PRIVATE_KEY
NEXT_PUBLIC_COMPANY_WALLET_SERVICE_ADDRESS
PRIVATE_KEY
BASE_RPC_URL
USDC_BASE_SEPOLIA_ADDRESS
MVR_PRICE_USDC
X402_PAYMENT_PRIVATE_KEY
NEXTAUTH_SECRET
STORM_TOKEN_ADDRESS

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

## Domain cutover — stormchain.ai → zknight.io (2026-07-02)

Do these in order. Steps 1–3 bring the site up on the new domain; 4–7 stop auth/email/webhooks from silently breaking.

1. **Vercel → Project → Settings → Domains → Add** `zknight.io` and `www.zknight.io`.
   - Set `zknight.io` as **Primary**; make `www` **redirect to** the apex (or vice-versa — pick one canonical host).
   - Vercel shows the exact DNS records to create.
2. **Namecheap → Domain List → zknight.io → Advanced DNS.** Add what Vercel shows, typically:
   - `A` record — Host `@` → `76.76.21.21`
   - `CNAME` — Host `www` → `cname.vercel-dns.com`
   - (Alternative: switch Namecheap to Vercel's nameservers — simpler but hands all DNS to Vercel.)
   - Wait for propagation; Vercel auto-issues the SSL cert once records resolve.
3. **Vercel → Settings → Environment Variables → `NEXT_PUBLIC_APP_URL`** = `https://zknight.io` (Production). This one var drives email links, Accio webhooks, share URLs, and the GitHub OAuth redirect. Then **redeploy** (env changes need a fresh build).
4. **Supabase → Authentication → URL Configuration** (critical — magic-link/Google sign-in break otherwise):
   - **Site URL** → `https://zknight.io`
   - **Redirect URLs** allow-list → add `https://zknight.io/**` (keep `http://localhost:3000/**` for dev). Remove the stormchain.ai entries once cut over.
5. **Pingram → Domains → verify `verify.zknight.io`**, add the `pingram.*` SPF/DKIM/DMARC/MX records to Namecheap. Set `PINGRAM_FROM_EMAIL` / `PINGRAM_FROM_NAME`. Point Supabase Auth SMTP at `smtp.pingram.io` (Pingram dashboard has a one-click Supabase integrate).
6. **GitHub OAuth App** (github.com → Settings → Developer settings → OAuth Apps): set **Authorization callback URL** → `https://zknight.io/api/github/callback`. `GITHUB_CLIENT_ID`/`SECRET` unchanged.
7. **Keep stormchain.ai (optional):** leave it on the Vercel project as a domain that **redirects to** zknight.io so old links/emails don't 404.

> Google sign-in runs through Supabase's `/auth/v1/callback`, so the Google Cloud console redirect URI does **not** change — only the Supabase Site URL (step 4) matters.

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
