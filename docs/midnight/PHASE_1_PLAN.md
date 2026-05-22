# Phase 1 — Foundation Cleanup

**Goal:** Replace the crypto-shaped layer (Alchemy auth, USDC payments, IPFS storage, Sepolia registries, STORM token) with a standard SaaS stack (**Supabase Auth**, Stripe, Supabase Storage). Drop nothing the customer cares about. Ship a noticeably better Pace experience.

**Estimated duration:** 4–6 weeks of focused work.

**Pre-condition:** Boss approval to proceed ✅ (2026-05-22). No clients are disrupted; no on-chain data is critical to preserve.

**Post-condition:** Storm runs entirely on **Vercel + Supabase (DB + Storage + Auth) + Stripe**. Zero crypto in user-facing flows. Existing data, blocks, Stormi, employer hub, and Accio screening flows all work unchanged.

> **Atomic implementation:** This doc describes Phase 1 strategically. Per-step execution lives in [`EXECUTION_CHECKLIST.md`](./EXECUTION_CHECKLIST.md), which has been updated to reflect Supabase Auth (locked 2026-05-22) and is the source of truth for AI-driven implementation.

> Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) first for the broader context. This doc is the implementation plan.

---

## Pre-flight decisions

All three pre-flight decisions resolved **2026-05-22**. Full rationale in [`DECISION_LOG.md`](./DECISION_LOG.md). Summary:

### 1. Auth provider → **Supabase Auth** ✅ (DEC-2026-05-008)

Locked: **Supabase Auth**, not Clerk.

Why: Storm is already on Supabase Pro (auth included at no extra cost). `auth.users.id` lives in the same Postgres instance as `users.id` and we make them equal — so every RLS policy can use `auth.uid()` directly, with no email-keyed sync webhook. One vendor surface for DB + Storage + Auth.

Implementation outline (see EXECUTION_CHECKLIST T1.1–T1.13):
- Use `@supabase/ssr` for cookie-based sessions in App Router.
- Sign-in / sign-up UI built with Storm's existing `@/components/ui` primitives (Card, Button, Input). Email/password + Google OAuth + magic links.
- New users: `auth.users.id` = `users.id` by convention; `ensureUserRow()` helper upserts the Storm-side row on first sign-in.
- Existing users: backfill via `supabase.auth.admin.createUser({ id: existingUserId, email })` so the IDs line up.
- During transition: dual-mode `getStormUserIdFromRequest()` tries the Supabase session first, falls back to `x-wallet-address` until cutover.

### 2. STORM token disposition → **Option B: drop on Base, off-chain points, Midnight reissue optional in Phase 3** ✅ (DEC-2026-05-005)

Locked: **drop the Base Sepolia STORM ERC-20 in Phase 1** and replace user-facing rewards with off-chain `users.storm_points`. The `storm_points_ledger` schema is designed so each row is a candidate for a future on-chain mint **if** Phase 3 ships a Midnight-native STORM (likely shielded). No commitment to Midnight STORM — just optionality preserved.

Implementation note: implementation is **not urgent** — the schema is foundation-only in Phase 1. UI for new earning use cases waits for a real reward concept; the existing on-chain STORM earnings (today: ~zero) get migrated to off-chain points and the Base contract is decommissioned.

Schema:
- `users.storm_points` (BIGINT, default 0)
- `storm_points_ledger` (id UUID, timestamp, user_id, delta BIGINT, reason text, source text) — append-only audit trail
- `STORMBalance` UI replaced with "Storm Points: 1,234"

### 3. Stripe payment shape → **One-time Checkout + Subscriptions; Pace billing deferred** ✅ (DEC-2026-05-006)

Locked: **build the full Stripe capability** — Checkout (one-time), Subscriptions, webhooks, customer portal — but **do not bill Pace immediately**. Pace continues operating during the migration without a Stripe subscription. New / non-Pace customers use Stripe from day one.

Three paid actions today, all currently USDC:
- MVR purchase (employer pays for candidate's MVR)
- PSP purchase (employer pays for candidate's PSP)
- Subscription / verification fees ($2.99 verify, $9.99/mo, $199/mo employer plan)

Stripe shape:
- **MVR / PSP:** one-time Stripe Checkout sessions. Webhook on `checkout.session.completed` triggers the existing `placeScreeningOrder` flow (which today is gated on `payment_tx_hash` from Base — replace with `stripe_session_id`).
- **Subscriptions:** Stripe Subscriptions with `payment_method_types=['card', 'us_bank_account']`. Webhook updates `users.subscription_status` / `companies.subscription_status`.
- **Onboarding:** SetupIntent for saving payment methods on the company record so MVR / PSP can be one-click.
- **Pace deferral:** Pace orders MVR/PSP via an admin-internal "free placement" path until the boss separately onboards them to Stripe billing in a later, scoped step.

`mvr_orders.payment_id` and `psp_orders.payment_id` already exist as text columns — they become Stripe session IDs. The `payment_tx_hash` columns become nullable / deprecated.

---

## Task breakdown

Tasks are grouped by sub-area. Each task lists files touched, rough effort, and dependencies. Effort sizes:

- **S** = 0.5–1 day
- **M** = 1–3 days
- **L** = 3–5 days
- **XL** = 1–2 weeks

### Track 1 — Auth swap (week 1–2)

| Task | Effort | Notes |
|---|---|---|
| ~~Pick auth provider~~ | — | ✅ resolved 2026-05-22: Supabase Auth (DEC-2026-05-008) |
| Configure Supabase Auth providers in dashboard | S | Email/password + Google OAuth + magic links. Set Site URL + redirect URLs. |
| Install `@supabase/ssr` + middleware shell | S | Cookie-refresh middleware per Supabase Next.js App Router pattern. Public-route matcher excludes webhooks + cron. |
| ID alignment migration (`users.id` ↔ `auth.users.id`) | S | Foreign key + `ensureUserRow()` helper. **No webhook needed** — same Postgres instance. |
| Replace `x-wallet-address` header with `getStormUserIdFromRequest()` across API routes | L | ~115 routes touched in 4 batches (read / write / employer / admin+misc). Dual-mode helper tries Supabase session first, falls back to wallet header. |
| Update `useAuthStore` to read Supabase session | M | Add `sessionUserId` from `supabase.auth.getUser()`; keep `walletAddress` until T1.13 cutover. |
| Backfill existing wallet-bound users | M | One-time script: `supabase.auth.admin.createUser({ id: existingUserId, email })` for each `users` row missing an `auth.users` row. |
| Build sign-in / sign-up UI | M | Custom forms using Storm's `@/components/ui` primitives. Email/password + Google + magic link. `/auth/callback` route exchanges the code for a session. |
| Cutover + AlchemyProvider removal | M | Email Pace + existing users to set new password. Wait 24–48h. Delete `AlchemyProvider`, `@account-kit/*`, wallet fallback. |
| Wallet UI removal | M | Delete `WalletCard`, `STORMBalance`, `USDCBalance`, `TransactionHistory`, `SendUSDC`, `SendSTORM`, `Coinbase Onramp` integration. |
| Test all sign-in / sign-out / role-routing flows | M | Manual QA + Pace stakeholder sign-off. |

**Track 1 total: ~2 weeks**

### Track 2 — Stripe payments (week 2–3, parallel with Track 1 wrap-up)

| Task | Effort | Notes |
|---|---|---|
| Stripe account + dashboard setup | S | Live + test keys in env |
| `lib/stripe.ts` server helper (typed Stripe client) | S | Standard pattern |
| Stripe webhook endpoint (`/api/stripe/webhook`) | M | Handle `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_succeeded` |
| MVR Stripe Checkout flow | M | Replace `MvrPaymentButton` with redirect-to-checkout. On success webhook → existing `placeScreeningOrder` |
| PSP Stripe Checkout flow | M | Same shape as MVR |
| Subscription Checkout for employer plans | M | $199/mo subscriptions; `companies.stripe_customer_id` + `stripe_subscription_id` |
| Replace `payment_tx_hash` references with `stripe_session_id` | L | ~20 places: payment buttons, screening order placement, admin views, employer billing UI |
| Saved payment methods (SetupIntent) | M | Optional but improves UX — one-click MVR after first payment |
| Stripe customer portal integration | S | Self-service plan changes / cancellations |
| Refund handling | S | `charge.refunded` webhook → mark order refunded |
| Replace `/api/wallet/mvr-config` and `/api/wallet/psp-config` with `/api/stripe/checkout-config` | S | Returns Stripe Checkout URL instead of USDC contract address |

**Track 2 total: ~2 weeks**

### Track 3 — Document storage migration (week 3, parallel)

| Task | Effort | Notes |
|---|---|---|
| Set up Supabase Storage buckets | S | `resumes`, `dot-applications`, `screening-reports` (with RLS) |
| `lib/document-storage.ts` server helpers | M | `uploadDocument(userId, kind, file)`, `getDocumentUrl(id)`, `deleteDocument(id)` |
| Replace `lib/ipfs.ts` Pinata calls | L | All resume/document upload paths |
| Migration: Pinata IPFS → Supabase Storage for existing docs | M | One-time script. For each `resumes.ipfs_hash`, fetch from Pinata gateway, re-upload to Supabase, update `resumes.storage_path` |
| Remove `pinata-web3` SDK and Pinata env vars | S | Clean up `package.json` and Vercel env |
| Update share-card / public-card download links | S | Use Supabase signed URLs instead of IPFS gateway URLs |

**Track 3 total: ~1 week**

### Track 4 — On-chain registry decommission (week 3–4)

| Task | Effort | Notes |
|---|---|---|
| Audit existing Sepolia records | S | Count of registered resumes / DOT apps. If small, ignore. If material, archive metadata to a `legacy_chain_records` Supabase table for posterity |
| Delete `resume-registry-onchain.ts`, `driver-contract.ts` | S | Unused after Phase 1 |
| Delete `/api/blockchain/submit-driver-application/route.ts` | S | |
| Delete `/api/blockchain/verify-resume/route.ts` | S | |
| Refactor `/api/resumes/[id]/verify/route.ts` | M | Remove blockchain branch entirely. Verification becomes a database flag (Phase 1 placeholder) — Phase 2 replaces with attestation flow |
| Remove `ResumeUploadWithVerification.tsx` blockchain branch | S | Use `ResumeUpload.tsx` only |
| Stop deploying contracts (no script changes — just don't run them) | S | Move `contracts/` deploy scripts to `contracts/legacy/` |
| Remove `ethers` dependency if no longer used | S | Check imports |
| Remove `NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS`, `NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS`, `ALCHEMY_BASE_SEPOLIA_URL`, `PRIVATE_KEY` env vars | S | Clean up Vercel env |

**Track 4 total: ~2–3 days**

### Track 5 — STORM token drop (week 4)

(Skip this track if "defer" is chosen instead of "drop.")

| Task | Effort | Notes |
|---|---|---|
| Migration: add `users.storm_points` BIGINT default 0 | S | |
| Migration: create `storm_points_ledger` table | S | Append-only audit log |
| `lib/storm-points.ts` helpers | M | `creditPoints(userId, delta, reason)`, `getBalance(userId)`, `getLedger(userId)` |
| Replace STORM token earning logic | M | Wherever `RewardDistributor.distribute()` was called server-side, replace with `creditPoints()` |
| Replace `STORMBalance` UI | S | Simple "X Storm Points" display |
| Remove `useStormTokenBalance`, `storm-contract.ts`, `StormBalance` API endpoints | S | |
| Move STORM contracts to `contracts/legacy/` | S | Archived, not deployed |

**Track 5 total: ~3 days**

### Track 6 — Cleanup, polish, ship (week 5–6)

| Task | Effort | Notes |
|---|---|---|
| End-to-end QA on all candidate flows | M | Sign up → fill DOT app → upload resume → request screening |
| End-to-end QA on all employer flows | M | Sign up → install blocks → order MVR → review results → request from candidate |
| Update `package.json` — remove unused deps (`@account-kit/*`, `pinata-web3`, `ethers`, `viem` if not needed) | S | |
| Update environment variable docs | S | Remove crypto vars, add Stripe + auth provider vars |
| Update `docs/SETUP.md`, `docs/DEPLOYMENT.md` | M | Reflect new stack |
| Update homepage copy | M | Remove "blockchain" / "wallet" language; emphasize professional SaaS |
| Update `docs/CHANGES.md` with Phase 1 entries as they ship | Ongoing | |
| Pace migration check-in | S | Confirm Pace's existing data + workflows still work |
| Production deploy | S | |

**Track 6 total: ~1 week**

---

## Order of operations

Tracks run mostly in parallel but with a critical sequencing:

1. **Week 1:** Track 1 (auth swap) starts. Decision on auth provider made on day 1.
2. **Week 2:** Track 1 completes; Track 2 (Stripe) starts. Track 3 (storage) can start in parallel.
3. **Week 3:** Tracks 2 + 3 complete. Track 4 (registry decommission) starts.
4. **Week 4:** Track 4 completes. Track 5 (STORM drop) starts.
5. **Week 5–6:** Track 6 (QA, polish, ship).

The reason auth must lead: Stripe webhooks need a session-aware way to identify users. Storage uploads need authenticated user context. Both are downstream of auth.

---

## Migration risks and mitigations

| Risk | Mitigation |
|---|---|
| Existing users lose access during auth swap | Pre-create their auth-provider accounts using existing email; send "we updated our login system, click here to set a password" email |
| Existing payment records break references | Keep `payment_tx_hash` column nullable; add `stripe_session_id` alongside. Both can coexist during transition |
| IPFS-hosted documents disappear when Pinata is dropped | Mass migrate documents to Supabase Storage *before* removing Pinata SDK; verify each by fetching the new URL |
| Webhook order race conditions during Stripe rollout | Idempotency keys on every webhook handler. Use Stripe's `idempotency_key` on creates |
| Sepolia legacy data lookups break in admin panel | Add a read-only `legacy_chain_records` view; admin sees historical data, no live blockchain calls |
| Pace surprised by changes | Boss conversation before Phase 1 starts. Clear communication: "Pace's data is unchanged, the product just feels more professional." |

---

## Success criteria

Phase 1 is "done" when all of these are true:

- [ ] A new user can sign up with Google in under 30 seconds, no wallet step
- [ ] An employer can pay for an MVR with a credit card via Stripe Checkout
- [ ] All existing Pace candidates and employers can sign in and see their existing data
- [ ] No `ethers`, `@account-kit/*`, `pinata-web3`, or `viem` imports remain in production code paths (legacy contract files in `contracts/` are OK)
- [ ] The codebase has zero references to `walletAddress` as auth input (replaced with session-based `userId`)
- [ ] Stripe webhooks handle MVR / PSP / subscription flows end-to-end
- [ ] Document upload + retrieval works via Supabase Storage with no IPFS dependency
- [ ] Vercel env has zero crypto-related variables (`NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS`, `PRIVATE_KEY`, `ALCHEMY_*`, etc., all removed)
- [ ] `docs/CHANGES.md` documents the cutover with file-by-file change log
- [ ] Pace stakeholder confirms the product still works for their use cases

When Phase 1 ships, [`PHASE_2_PLAN.md`](./PHASE_2_PLAN.md) gets written and Phase 2 starts. Until then, do not pre-build Phase 2 features into Phase 1 — keep scope tight.

---

## What Phase 1 explicitly does NOT do

- No selective-disclosure UI (Phase 2)
- No `attestationService` interface (Phase 2)
- No Midnight integration (Phase 3, deferred)
- No Compact contracts (Phase 3, deferred)
- No proof server (Phase 3, deferred)
- No Cloud Run / Render / Fly.io setup (Phase 3, deferred)

Anything ZK-flavored is out of scope. Phase 1 is "make the product feel like a real SaaS." That's it.

---

**Last updated:** 2026-05-22
**Status:** Pre-Phase-1 (planning complete)
**Owner:** Engineering (sole)
