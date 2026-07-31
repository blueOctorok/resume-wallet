# Employment Verification – Email Setup

Employment verification emails are sent via **Pingram** (`src/lib/send-verification-email.ts` → `src/lib/messaging.ts`).

## Env vars

In `.env.local` (and Vercel):

- **`PINGRAM_API_KEY`** – Pingram secret key (`pingram_sk_...`)
- **`PINGRAM_FROM_EMAIL`** – e.g. `zknight@verify.zknight.io` (must be on a Pingram-verified domain)
- **`PINGRAM_FROM_NAME`** – e.g. `ZKnight`
- **`NEXT_PUBLIC_APP_URL`** – public app URL used for verify links (production: `https://zknight.io`)

If `PINGRAM_API_KEY` is missing, send is skipped and a warning is logged; the verification request is still created.

## How to test

1. Restart `npm run dev` after changing env.
2. Trigger Verify on an employment with a previous-employer email.
3. Check terminal for `[VERIFICATION EMAIL] … via Pingram` / `[MESSAGING] Email sent`.
4. Confirm delivery in the Pingram dashboard (type `employment_verification_email`).

## Deliverability

SPF/DKIM/DMARC for `verify.zknight.io` are managed in Pingram Domains + Namecheap (`pingram.*` hosts). Corporate inboxes may still quarantine new-domain mail until allowlisted.
