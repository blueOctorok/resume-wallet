# Vercel Environment Variables Checklist

Copy these from your `.env.local` file to Vercel.

## Public Variables (NEXT_PUBLIC_*)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=               # Production: https://provven.com (no trailing slash)
```

## Private Variables (Backend only — DO NOT prefix with NEXT_PUBLIC)

```
SUPABASE_SERVICE_ROLE_KEY=
AVA_BRAIN=                         # Anthropic API key for the AI assistant
ADMIN_EMAILS=                      # Comma-separated admin emails (replaces ADMIN_WALLETS)
ADMIN_API_KEY=                     # Legacy admin routes (reset-wallet, etc.)
CRON_SECRET=                       # Reconcile-screenings cron
PINGRAM_API_KEY=                   # Pingram secret key (pingram_sk_...) — email + SMS
PINGRAM_FROM_EMAIL=                # e.g. provven@verify.provven.com — MUST be a Pingram-verified domain
PINGRAM_FROM_NAME=Provven          # Display name on outbound email
# SMS: same PINGRAM_API_KEY. Paid plan ($20/mo) + Provven A2P 10DLC required for US production texts.
# No extra SMS env vars. Start A2P in Pingram dashboard (EIN, provven.com, sample msgs with STOP).
ADMIN_NOTIFICATION_EMAILS=         # Comma-separated ops alert recipients
GITHUB_CLIENT_ID=                  # GitHub OAuth app (callback: https://provven.com/api/github/callback)
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
ATTESTATION_BACKEND=midnight      # Production flipped 2026-08-13 (Preprod). Omit on Preview to stay JWT.
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

## Domain cutover — zknight.io → provven.com (2026-08-06)

Do these in order. Steps 1–3 bring the site up on the new domain; 4–7 stop auth/email/webhooks from silently breaking. (Prior domains `stormchain.ai` / `zknight.io` can stay as Vercel redirects.)

1. **Vercel → Project → Settings → Domains → Add** `provven.com` and `www.provven.com`.
   - Set `provven.com` as **Primary**; make `www` **redirect to** the apex (or vice-versa — pick one canonical host).
   - Vercel shows the exact DNS records to create.
2. **Namecheap → Domain List → provven.com → Advanced DNS.** Add what Vercel shows, typically:
   - `A` record — Host `@` → `76.76.21.21`
   - `CNAME` — Host `www` → `cname.vercel-dns.com`
   - (Alternative: switch Namecheap to Vercel's nameservers — simpler but hands all DNS to Vercel.)
   - Wait for propagation; Vercel auto-issues the SSL cert once records resolve.
3. **Vercel → Settings → Environment Variables → `NEXT_PUBLIC_APP_URL`** = `https://provven.com` (Production). This one var drives email links, Accio webhooks, share URLs, and the GitHub OAuth redirect. Then **redeploy** (env changes need a fresh build).
4. **Supabase → Authentication → URL Configuration** (critical — magic-link/Google sign-in break otherwise):
   - **Site URL** → `https://provven.com`
   - **Redirect URLs** allow-list → add `https://provven.com/**` (keep `http://localhost:3000/**` for dev). Remove old `zknight.io` / `stormchain.ai` entries once cut over.
5. **Pingram → Domains → verify `verify.provven.com`**, add the `pingram.*` SPF/DKIM/DMARC/MX records to Namecheap. Set:
   - `PINGRAM_FROM_EMAIL` = `provven@verify.provven.com`
   - `PINGRAM_FROM_NAME` = `Provven`
   If these still say `zknight@verify.zknight.io` / `ZKnight`, **every transactional email will still show the old brand** even though app code defaults to Provven (env overrides the default).
   Point Supabase Auth SMTP at `smtp.pingram.io` (Pingram dashboard has a one-click Supabase integrate).
   **Supabase Auth emails are a separate path** — magic-link / confirm / reset subjects and the From header live in **Supabase → Authentication → Email Templates** + **SMTP settings**, not in this repo. Update From to `Provven <provven@verify.provven.com>` and replace any "ZKnight" / "zknight.io" copy in those templates.
6. **Pingram SMS / A2P 10DLC (Outreach Text):** On the paid plan, start **A2P 10DLC** for brand **Provven** (legal name, EIN, address, website `https://provven.com`, privacy/terms, sample messages matching invite SMS + STOP). No Namecheap DNS for SMS. Apply DB migration `103_application_invites_sms.sql` before relying on Text in prod.
7. **GitHub OAuth App** (github.com → Settings → Developer settings → OAuth Apps): set **Authorization callback URL** → `https://provven.com/api/github/callback`. `GITHUB_CLIENT_ID`/`SECRET` unchanged.
8. **Keep zknight.io / stormchain.ai (optional):** leave them on the Vercel project as domains that **redirect to** provven.com so old links/emails don't 404.

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
