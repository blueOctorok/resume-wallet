# Storm Foundation Reset — Execution Checklist

**This is the master tracker for the Phase 1 / 2 / 3 migration.** Tick steps off as they ship. Every AI session working on this migration starts here.

> Strategic context: `[ARCHITECTURE.md](./ARCHITECTURE.md)` · Phase 1 detail: `[PHASE_1_PLAN.md](./PHASE_1_PLAN.md)` · Pace context: `[PARTNERS.md](./PARTNERS.md)` · Decision rationale: `[DECISION_LOG.md](./DECISION_LOG.md)`

---

## Where we are (2026-05-30)

The hard part is done. Re-read this snapshot at the start of every session.

| | Track | Status |
|---|---|---|
| ✅ | **Track 1 — Auth (Alchemy → Supabase)** | **DONE & live.** Supabase is the only login. Pace works. |
| 🔨 | **Track 2 — Web3 demolition** | **← we are here.** Delete STORM, Base registries, USDC + company wallet + `@account-kit`, IPFS. |
| 🎯 | **Phase 2 — Selective disclosure** | **The actual moat.** Attestation service + carrier fact panels. Start as soon as demolition clears. |
| ⏸ | **Phase 3 — Midnight ZK** | Deferred swap behind the same `attestationService` interface. Trigger-gated. |
| ⏸ | **Payments (Stripe)** | Deferred **greenfield** add — *not* a USDC conversion (see below). Build when a paying customer exists. |

```
DONE ──► Track 2 Demolition ──► Phase 2 Attestation ──► Phase 3 Midnight (later)
                                       (the moat)         Payments (Stripe) — whenever
```

**Why this order:** the chain was never the moat — *selective disclosure of verified facts* is. Demolition removes the Web3 cruft that's pure liability now (it does nothing for real users), then Phase 2 builds the thing competitors can't copy. Midnight and Stripe are both "swap in later" — neither blocks the moat.

---

## How to use this doc

Structured for **multi-session, multi-model AI work** without losing context or breaking Pace's live employer flows.

### Starting a session
1. Read the **Where we are** snapshot above.
2. Open the next unstarted step (the first `⬜` in the active track).
3. Verify its **Pre-conditions**, then do the work. Run **Verification** before claiming done.
4. Confirm the AI loaded `.cursor/rules/strategic-direction.mdc` (alwaysApply). If not, paste it in.

### Ending a session (handoff protocol)
1. **Commit** with the step's prescribed message (or `wip:` if mid-step).
2. **Update this doc:** Status → ✅ Done · commit hash · date (or 🟡 with what's done / next / gotchas).
3. **Update `docs/CHANGES.md`** if user-visible.
4. **Append a row to the [Session handoff log](#session-handoff-log).**
5. **No undocumented mid-flight refactors** — if you find new work, add a step, don't fold it into the commit.

### Model selection (rough)

| Work type | Model |
|---|---|
| Greenfield, complex multi-file refactors, architecture | Strongest available (Claude Opus / GPT-5.5) |
| Mechanical refactors / deletes | Mid-tier (Sonnet / Composer 2.5) |
| Doc + copy edits | Cheap (Composer 2.5 fast) |
| Anything touching Pace's employer paths | Strongest available — no shortcuts |

When something breaks → [Rollback playbook](#rollback-playbook).

---

## Pace invariants — DO NOT BREAK

These flows must work continuously. If a step risks breaking any, it ships dual-mode (old + new both work) with cutover as a separate explicit step.

| #        | Invariant                                                                                                                                       | Files / paths                                                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I-1**  | Pace employer can sign in (any auth path)                                                                                                       | sign-in flow in `app/page.tsx`, `/sign-in`, `/auth/callback`                                                                                             |
| **I-2**  | Pace employer hub loads (block list, candidate pipeline, screening list)                                                                        | `/api/employer/hub`, `/api/employer/hub/blocks`, `/api/employer/applicants`, `/api/employer/screenings`                                                  |
| **I-3**  | Pace can install / use employer blocks                                                                                                          | `employer-screening-consent`, `employer-mvr-orders`, `employer-psp-orders` (per `employer-block-registry.ts`); routes `/api/employer/hub/blocks/`*       |
| **I-4**  | Pace can place MVR/PSP orders (any payment method)                                                                                              | `/api/employer/screenings/order`, `/api/employer/mvr/order`, `/api/employer/psp/order`, `lib/place-screening-order.ts`                                   |
| **I-5**  | Accio webhooks deliver and process MVR/PSP completions                                                                                          | `/api/mvr/webhook`, `/api/psp/webhook`, `lib/process-mvr-accio-webhook.ts`, `lib/accio-psp-webhook.ts`                                                   |
| **I-6**  | Reconcile cron runs and pulls stuck Accio orders                                                                                                | `/api/cron/reconcile-screenings`, `lib/reconcile-pending-screenings.ts` (uses `CRON_SECRET`)                                                              |
| **I-7**  | Pace outreach invites work (email send + kanban)                                                                                                | `/api/employer/invites`, `/api/employer/invites/send-email`, `lib/sync-outreach-invite-status.ts`, `CandidateOutreach.tsx`                               |
| **I-8**  | Pace can view candidate career cards (talent search + modal)                                                                                    | `/api/employer/talent/search`, `/api/employer/talent/[userId]`, `CareerCardModal.tsx`                                                                    |
| **I-9**  | Pace's existing data is untouched: every `mvr_orders`, `psp_orders`, `employer_hub_blocks`, `application_invites`, `candidate_status` row stays | All migrations must be additive (new columns, never DROP) until full cutover                                                                             |
| **I-10** | Existing employer notifications and emails fire correctly                                                                                       | `lib/notify-employer-candidate-action.ts`, `lib/send-admin-notification.ts`                                                                              |

### Pace-critical files — extra caution

When touching any of these, double-verify the change preserves I-1 through I-10:

- `src/app/api/employer/**/*` (28 routes)
- `src/lib/place-screening-order.ts`
- `src/lib/reconcile-pending-screenings.ts`
- `src/lib/accio-xml-builder.ts`
- `src/lib/process-mvr-accio-webhook.ts`
- `src/lib/accio-psp-webhook.ts`
- `src/lib/sync-outreach-invite-status.ts`
- `src/components/employer/**/*`
- `src/lib/employer-block-registry.ts`
- `src/lib/employer-company-access.ts`

### Pace check-in cadence
- **Auth cutover (done):** confirm Pace team can sign in with Supabase — **Monday live verification gate** (multi-user: owner + Nick + Jared see the same Jason Peterson orders).
- **After demolition (Track 2):** confirm Pace hub + screening flows still load with all crypto removed.
- **Before Phase 2 carrier panels ship:** brief Pace on what verified fact panels will look like.
- **If/when Stripe lands:** confirm Pace's free-placement path is untouched before enforcing any billing.

---

## Hard-won release rules

Two prod outages during the auth track (2026-05-28: middleware cookie-API break, FK break) taught these. They still apply to demolition.

- **Every step is revert-safe.** Demolition deletes are individually revertable (`git revert HEAD` → Vercel redeploys). Don't stack two unrelated deletions into one push — keep regressions bisectable.
- **Mandatory new-user incognito gate.** Both outages only hit *new* users; an existing logged-in session sailed past them. Before declaring any deploy good: open incognito, sign up as a brand-new user, load the affected surface. Testing your own session is **not** sufficient.
- **Migrations stay additive.** Never `DROP`/`CHANGE TYPE` on live data in one shot. If a column must go, do it in a separate commit days after the code stops reading it.
- **Migration-history hygiene.** Migrations are append-only and reflect what actually ran in prod. If one shipped and was reversed, don't delete the file — add a corrective migration and note it on the original (see 090/091 → 092, 2026-05-28).

---

## Pre-flight decisions (all locked 2026-05-22)

| #        | Decision                | Picked |
| -------- | ----------------------- | ------ |
| **P0.1** | Auth provider           | **Supabase Auth** (not Clerk) — native `auth.uid()` for RLS; `auth.users.id` IS `users.id`. DEC-2026-05-008 |
| **P0.2** | STORM token disposition | **Option B** — drop Base Sepolia ERC-20; off-chain `storm_points` ledger preserved as a future Midnight-native mapping. Implementation **not urgent**. DEC-2026-05-005 |
| **P0.3** | Stripe payment shape    | **One-time Checkout + Subscriptions**, deferred. Pace billing waived at cutover. DEC-2026-05-006 |

Locked in `[DECISION_LOG.md](./DECISION_LOG.md)`.

---

## Track 1 — Auth swap (Alchemy → Supabase Auth) ✅ DONE

Replaced Alchemy Account-Kit smart-wallet auth with **Supabase Auth** (Google OAuth + email OTP, passwordless). ~115 API routes migrated from the `x-wallet-address` header to session-based `getStormUserIdFromRequest`. Ran dual-mode, then cut over. **Supabase is now the only login and Pace is live on it.**

| Step | What shipped | Status |
|---|---|---|
| T1.1 | Supabase providers — Google OAuth (published) + email OTP via Resend SMTP | ✅ |
| T1.2 | `@supabase/ssr` + root `middleware.ts` (cookie session refresh) | ✅ |
| T1.3 / T1.12.1 | `users.id` = `auth.users.id` alignment; FK re-added & **validated** (mig 093 + 094) | ✅ |
| T1.4 | `auth-session.ts` — `getStormUserIdFromRequest` session helper | ✅ |
| T1.5–T1.8 | ~115 routes migrated off `x-wallet-address` (candidate read/write, employer, AI) | ✅ |
| T1.8-admin | Central admin re-gated by **`ADMIN_EMAILS`** off the Supabase session (replaced `ADMIN_WALLETS`) | ✅ |
| T1.9 | Backfill `auth.users` rows for existing wallet-bound users | ✅ |
| T1.10 | `useAuthStore` reads the Supabase session (`SupabaseAuthSync` mounted in `layout.tsx`) | ✅ |
| T1.11 | Passwordless sign-in / sign-up UI (Google + OTP); `/sign-up` → `/sign-in` | ✅ |
| T1.12 b/c/.1 | Cutover: Supabase-only login; dropped the wallet fallback in `auth-session.ts`; client header cleanup | ✅ |
| T1.13 (partial) | Deleted 9 orphan personal-wallet UI files; mount gates → `sessionUserId` | ✅ |

### Track 1 leftovers — folded elsewhere
- **T1.12d** (remove `@account-kit` + company wallet stack) and the **T1.13 remainder** (drop the `walletAddress` store field + `wallet/SendUSDC`/`SendSTORM` orphans) are **not separate auth work** — they're the same Web3 teardown. They now live in **Track 2 → D3**.
- **T1.14 passkeys** — ⏸ deferred polish. OTP + Google already cover passwordless. Add WebAuthn later (needs a `@supabase/supabase-js` bump); not blocking anything.

> ⚠️ **Prod TODO:** set `ADMIN_EMAILS` in Vercel production (currently only in `.env.local`).

---

## Track 2 — Web3 demolition (← active)

Delete everything crypto-shaped that does nothing for real users. Verified safe by DB audit (2026-05-30):
- STORM token: **never reached a real user.**
- Base Sepolia registries: only **7 test resumes** + test DOT apps on-chain — disposable.
- MVR/PSP results: **entirely in Postgres** (`result_xml`), never on-chain.
- IPFS: only the same 7 test resumes; **Midnight is a proof layer, not a doc store**, so Supabase Storage replaces IPFS regardless of the chain decision.

**Order:** STORM and registries first (zero real-user impact), then the entangled USDC/company-wallet/`@account-kit` teardown, then IPFS → Storage, then the env/dep sweep. Each `D` step is revert-safe on its own.

### D1 — Drop STORM token (Base ERC-20)
| | |
|---|---|
| Status | ✅ Done · cd2e06f · 2026-05-31 |
| Pre-conditions | none |
| Pace risk | None |

**Goal:** Remove all STORM ERC-20 client code and APIs. STORM never shipped to a real user, so **skip building `storm_points`** for now — add it only when a real reward concept exists (P0.2 Option B keeps that door open).

**Files:** delete `useStormTokenBalance` / `use-storm-token-balance`, `lib/storm-contract.ts`, `/api/storm/distribute` (+ any STORM mint/distribute routes), `RewardDistributor` calls. Archive `StormToken.sol` / `RewardDistributor.sol` / `TreasuryDistributor.sol` / `FounderVesting.sol` → `contracts/legacy/`. (`STORMBalance` UI was already removed in T1.12c.)

**Verification:** `rg -i "storm.?token|RewardDistributor|storm/distribute" src/` → 0. Build green.

**Commit:** `chore(demolition): drop STORM ERC-20 token + distribute APIs (D1)`

### D2 — Decommission Base-Sepolia registries
| | |
|---|---|
| Status | ⬜ Not started |
| Pre-conditions | none |
| Pace risk | None (test data only) |

**Goal:** Remove the on-chain resume/DOT registry path. Verification becomes a **DB-flag placeholder** until Phase 2 attestation ships — the route still exists, the chain branch is gone. (The 7 test resumes on-chain are disposable; note the count in `DECISION_LOG.md` and skip any archive table.)

**Files:**
- Refactor `src/app/api/resumes/[id]/verify/route.ts` — drop the blockchain branch (DB flag instead).
- Delete `/api/blockchain/submit-driver-application/route.ts`, `/api/blockchain/verify-resume/route.ts`.
- Delete chain helpers: `lib/resume-registry-onchain.ts`, `lib/driver-contract.ts`, `lib/contract.ts`, `lib/contract-constants.ts`, `lib/typed-data.ts` (verify unused first).
- Archive `contracts/` (registry `.sol` + deploy scripts) → `contracts/legacy/` with a README.

**Verification:** "Verify" still yields a verified state via DB flag; no on-chain call. `rg "blockchain|RESUME_REGISTRY|DRIVER_APP" src/` → only legacy/archived.

**Commit:** `chore(demolition): decommission Base-Sepolia registries (D2)`

### D3 — Remove USDC + company wallet + `@account-kit` (absorbs T1.12d & T1.13 remainder)
| | |
|---|---|
| Status | ⬜ Not started |
| Pre-conditions | D1, D2 · **Pace Monday auth gate green** |
| Estimated session size | **L — split into substeps** |
| Pace risk | **Medium** — company-wallet code sits near employer flows; verify I-1/I-2/I-4 after each substep |

**Goal:** Tear out the last crypto interaction layer: USDC payment buttons, the company-wallet provisioning stack, the Alchemy provider/SDK, and the now-vestigial `walletAddress` store field. This is the long-deferred **T1.12d + T1.13 remainder** combined.

**Files (substep it):**
- **Payments UI:** delete `MvrPaymentButton`, `PspPaymentButton`, any Coinbase Onramp / USDC paths in `StormiCreditModal`. Keep `mvr_orders.payment_tx_hash` columns nullable for legacy display; stop calling the `paymentTxHash` param from the UI.
- **Company wallet:** delete `CompanyWallet` / `WalletInfo` / `TransactionHistory`, `/api/wallet/*-config`, company-wallet provisioning/server helpers. Verify `accept-invite`'s `addOwnerToCompanyWallet` is already best-effort (try/catch) and remove it.
- **Provider/SDK:** remove `AlchemyProvider`, re-parent `SupabaseAuthSync` if needed, `npm uninstall @account-kit/* @alchemy/aa-* alchemy-sdk`. Delete now-orphaned `AlchemyAuth.tsx`, `wallet/SendUSDC.tsx`, `wallet/SendSTORM.tsx`.
- **Store:** drop the `walletAddress` field from `useAuthStore` (the big one — ~120 consumers; auth users use the `auth:<uuid>` placeholder, migrated users had `0x…`). Replace identity reads with `sessionUserId`. Mark `users.wallet_address` deprecated (keep column for history).

**Verification:** `rg "@account-kit|AlchemyProvider|walletAddress" src/` → 0 (or only `users.wallet_address` DB references). New-user incognito: sign in → hub → employer screening order all work. Build green.

**Commit:** `chore(demolition): remove USDC + company wallet + account-kit (D3)`

### D4 — IPFS → Supabase Storage (downscoped)
| | |
|---|---|
| Status | ⬜ Not started |
| Pre-conditions | none (can run parallel with D1/D2) |
| Pace risk | Low — only 7 test docs on IPFS |

**Goal:** Move document storage off Pinata/IPFS to Supabase Storage. Because only test docs exist on IPFS, **no careful dual-write/backfill is needed** — create the bucket, cut new uploads + reads over, accept loss of the 7 test docs (or one-shot copy them).

**Files:**
- Migration: `resumes` + `dot-applications` + `screening-reports` private buckets, RLS by `users.id` / employer scope.
- New `lib/document-storage.ts`: `uploadDocument(userId, kind, file)`, `getSignedUrl(path, expiry)`, `deleteDocument(path)`.
- Switch upload routes (`/api/resumes/upload`, `UploadResumeModal`, `ResumeUploadWithPrefill`) and every IPFS-gateway URL (`gateway.pinata.cloud/ipfs/...`, share/public cards) to Storage + signed URLs.
- Delete `lib/ipfs.ts`; `npm uninstall pinata-web3`; remove Pinata env vars.

**Verification:** New upload → renders via signed URL; `rg "ipfs|pinata" src/` → 0. Share card download works.

**Commit:** `feat(storage): move documents from IPFS to Supabase Storage (D4)`

### D5 — Env + dependency sweep
| | |
|---|---|
| Status | ⬜ Not started |
| Pre-conditions | D1–D4 |
| Pace risk | None |

**Goal:** Remove dead crypto deps + env vars now that nothing imports them. `npm uninstall ethers viem` (verify zero imports). Remove from Vercel + `.env.local`: `NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS`, `NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS`, `ALCHEMY_BASE_SEPOLIA_URL`, `PRIVATE_KEY`, Pinata keys, Alchemy keys. Run `depcheck`.

**Verification:** `rg "from 'ethers'|from 'viem'" src/` → 0. Build + lint green.

**Commit:** `chore(deps): remove crypto deps + env after demolition (D5)`

---

## Phase 2 — Selective disclosure (THE MOAT — next after demolition)

This is the point of the whole reset. Atomic steps get written when demolition clears; high-level tracks:

| Track | Goal | Effort |
| ----- | ---- | ------ |
| **T7**  | `attestationService` interface + `attestations` table + signed-JWT implementation | 1 week |
| **T8**  | Fact registry (`FactType` enum + `FactDefinition` map per `[attestation-architecture.mdc](../../.cursor/rules/attestation-architecture.mdc)`) | 1 week |
| **T9**  | Carrier-facing fact panels (replace PDF-first verification UI on the career-card modal) | 1 week |
| **T10** | Candidate disclosure toggles (per-audience disclosure preferences) | 1 week |

**Pre-condition for T7:** demolition shipped + production stable.

**T7 schema hygiene (forward-compat for the Phase 4 cached-attestation marketplace, DEC-2026-05-013):** the `attestations` table must include `issued_at`, `valid_until` (e.g. MVR + 30 days), `source_cra` (e.g. `'accio'`), `source_pull_id` (Accio order ID), and a query-count column. Don't build the marketplace; just don't make it impossible.

> **Storm is not a CRA** — every attestation must cite its originating CRA, every share is candidate-initiated. See `strategic-direction.mdc` + DEC-2026-05-011.

---

## Phase 3 — Midnight ZK (deferred swap)

Phase 3 swaps the signed-JWT attestation implementation for **Midnight ZK proofs behind the same `attestationService` interface** — the carrier-facing UX doesn't change, only the proof backend. Atomic steps get written when the trigger fires (a customer explicitly requires non-repudiation). **Do not start Phase 3 until the trigger is concrete.** Trigger criteria: `[ARCHITECTURE.md](./ARCHITECTURE.md)`.

### Phase 3b / Phase 4 future considerations (captured, NOT scheduled)
- **Phase 3b SBT credentials** — soulbound representation of Phase 3a attestations (DEC-2026-05-012)
- **Phase 3b STORM-on-Midnight reissue** — shielded utility token (DEC-2026-05-005 Option B + DEC-2026-05-012)
- **Phase 4 cached-attestation marketplace** — driver economic compounding via Storm-mediated cached re-queries (DEC-2026-05-013)

Each has explicit trigger conditions in its decision-log entry. **Do not add atomic steps until triggers fire.** Engineering view: `[ARCHITECTURE.md](./ARCHITECTURE.md)` "Future considerations". Boss-facing: `[TOKEN_BRIEF.md](./TOKEN_BRIEF.md)`.

---

## Payments (Stripe) — deferred greenfield (NOT a USDC conversion)

> **Reframed 2026-05-30.** The old plan modeled this as a 10-step USDC→Stripe *migration* (dual-write, preserve `payment_tx_hash`, careful cutover). That machinery only existed to convert a live crypto payment system. We're **deleting** USDC in D3 and Pace is **waived** (free admin placement — proven by Jason Peterson's order). So Stripe is no longer a migration — it's a small **greenfield add, whenever a paying non-Pace customer shows up.**

**When triggered, build (no dual-mode, no `payment_tx_hash` preservation, no cutover dance):**
1. Stripe account + SDK; customer-id column on `companies`; webhook signing secret.
2. One webhook endpoint (`/api/stripe/webhook`) — exclude from the Supabase middleware matcher (reads body, not cookies).
3. **Checkout (one-time)** for MVR / PSP — gate `place-screening-order` behind a paid session for non-waived companies.
4. **Subscription Checkout** for employer plans + customer portal.
5. Refund handler.

**Invariant:** Pace's free-placement path stays untouched; never enforce billing on Pace at cutover (DEC-2026-05-006). The full one-time + subscription shape is the locked decision; this just lands later than everything else.

---

## Rollback playbook

When something breaks, follow this order:

### Level 1 — Revert the commit
```
git revert HEAD
git push
```
Vercel auto-redeploys. Safe at any time — every step is revert-safe or additive.

### Level 2 — Roll back a cutover
If a cutover-class step broke prod: revert the cutover commit, confirm the prior path still works, diagnose, re-attempt in a follow-up.

### Level 3 — Database rollback
Phase 1/2 migrations are **always additive** (new columns, never DROP/CHANGE TYPE on live data). Revert is safe:
```
supabase migration repair {migration_name} --status reverted
```
If a migration accidentally DROPped/CHANGEd data, restore from Supabase point-in-time backup. Don't write destructive migrations — drop columns in a separate commit days later.

### Level 4 — Pace emergency
If Pace is fully blocked:
1. **Roll back to the last known good commit** even if it loses a day's progress.
2. Email Pace stakeholder immediately: what broke, when it'll be fixed, the workaround.
3. Open a `BLOCKER` entry at the top of this doc with status, owner, ETA.
4. Don't forward-fix without verifying the rollback restored their flows.

---

## Session handoff log

Every AI session appends one entry here. Newest at top.

| Date | Step(s) | Model | Commit | Notes |
| --- | --- | --- | --- | --- |
| 2026-05-31 | D1 — drop STORM ERC-20 token + distribute/referral payout | Claude Opus 4.8 | cd2e06f | **Deleted:** `storm-rewards.ts` (+ test), `storm-contract.ts`, `/api/storm/distribute`, `/api/storm/history`, `/api/referrals/claim`, `scripts/deploy-storm-token.js`. **Archived → `contracts/legacy/`:** `StormToken`, `RewardDistributor`, `TreasuryDistributor`, `FounderVesting` (+ README). **Stripped:** `triggerStormReward` from legacy USDC `mvr/payment` + `psp/payment`; StormChainView unwired from shells + homepage (file kept for future Midnight token); `PageType` `'stormchain'` removed. **Referrals:** tracking-only — payout route deleted; UI/Stormi/journey copy neutralized (no "earn 2.5 STORM"). **Preserved:** `StormTokenMark` brand logo; `referrals` table + anti-sybil in set-role; no `storm_points` schema. `npm run build` green. **Next:** D2 (Base registry decommission). |
| 2026-05-30 | Checklist restructure (auth → DONE table; demolition track; Stripe reframed) | Claude Opus 4.8 | pending user commit | Collapsed Track 1's 14 steps into a DONE table + leftovers note (T1.12d & T1.13-remainder folded into new **D3**; T1.14 passkeys marked deferred). Replaced old Tracks 2–6 with **Track 2 — Web3 demolition (D1–D5)**: D1 STORM drop (skip `storm_points` until a real reward exists), D2 Base registry decommission (verify→DB-flag placeholder), D3 USDC+company-wallet+`@account-kit`+`walletAddress` teardown (L, Pace-medium, gated on Monday auth check), D4 IPFS→Storage (downscoped — only 7 test docs), D5 env/dep sweep. **Stripe reframed** from 10-step USDC conversion → deferred greenfield (per user: conversion is overkill, Pace waived). Phase 2 promoted as "the moat, next." Phase 3 = deferred swap behind same interface. Preserved verbatim: Pace invariants, critical files, rollback playbook, this log. Doc cut ~roughly in half. **Next:** D1 or D2 (both zero real-user risk), then Pace Monday gate before D3. |
| 2026-05-30 | T1.13-partial — orphan personal wallet UI dead code delete     | Claude Opus 4.8 | 8c23bec                   | **Deleted 9 zero-importer files:** `WalletCard`, `BuyUSDCButton`, `BaseWalletConnect`, `StormEarningsHistory`, `wallet/ReceiveUSDC`, `AlchemyAuth`, `api/onramp/session`, `alchemy-simulation-api`, `erc20-gas-payment`. **Gate fixes:** `CandidateHub` `HubAccountSection` → `sessionUserId`; `SimpleCardPanel` `isGuest` → `sessionUserId`. **Untouched (T1.12d):** `@account-kit`, `CompanyWallet`/`WalletInfo`/`TransactionHistory`, payment buttons, `/api/wallet/*-config`, `walletAddress` store. Teardown map: `T1_13_WALLET_TEARDOWN_MAP.md`. `npm run build` green · lint clean. **Note:** `wallet/SendUSDC.tsx` + `SendSTORM.tsx` still on disk (orphans) — out of scope this pass. **Next:** Pace Monday gate · T1.12d (Stripe decision) · full T1.13 (`walletAddress` drop). |
| 2026-05-30 | T1.8-admin — email-gated central admin (replaces ADMIN_WALLETS) | Claude Opus 4.8 | pending user commit       | **Admin now gated by email off the Supabase session, not wallet.** `requireAdmin` rewritten **async**: `createServerSupabase().auth.getUser()` → `isAdminEmail(email)` vs **`ADMIN_EMAILS`** (env: replaced `ADMIN_WALLETS` w/ `blahasam@gmail.com,jaypat1224@gmail.com`); returns `{authorized,userId,email,error}`; dropped `isAdminWallet`/`getAdminWallets`. All **33** callers gained `await` (scripted, idempotent, script deleted); audit/log `auth.walletAddress`→`auth.email`. **5 inline-`ADMIN_WALLETS` routes** (`employer-requests`[+`/[id]`], `jobs`, `companies/[id]/members`[+`/[memberId]`]) folded onto `requireAdmin`. Audit `actorUserId`/`reviewed_by`/`approved_by` use `auth.userId` (dropped wallet→id lookups + `resolveActorUserId`). Per-row badge/warning → `isAdminEmail(email)`. `AdminDashboardShell` shows email, copy/comment updated. **Why now:** post-T1.12c, new email signups get `auth:<uuid>` that can't be in a wallet allowlist → no new admin possible; the 2 working admins only survived on migrated DB wallets, 3rd (metro) deleted in 093. `npm run build` green · IDE lint clean · `rg ADMIN_WALLETS\|isAdminWallet`=0 in code. **Follow-up:** strip 41 now-ignored `x-wallet-address` sends in 18 admin UI files (no-op). **Prod:** set `ADMIN_EMAILS` in Vercel. |
| 2026-05-30 | T1.12b — strip vestigial client x-wallet-address headers       | Claude Opus 4.8 | ff8e396                   | Removed `x-wallet-address` from ~56 client files where target routes use `getStormUserIdFromRequest` only (employer hub, notifications, messaging, hub blocks, career-card, verification, etc.). **Kept** on allowlist: `admin/**`, `/api/storm/history`, create-on-write (`resumes/create|upload`, GET `/api/resumes`, `save-progress`, `profile-setup`), STORMI-unlimited AI routes + `ava-chat`/`walkthrough-ai`. `walletAddress` store fields untouched (T1.13). `npm run build` green. Also includes migration 093 `career_cards` view fix. **Next: T1.12d** (provider/SDK teardown) or Pace Monday manual gate. |
| 2026-05-30 | T1.12.1 — orphan-prevention fix + FK re-added (✅ applied) | Claude Opus 4.8 | pending user commit       | **✅ T1.12.1 DONE.** Migrations 093 (orphan cleanup) + 094 (validated FK) applied via dashboard; `users_id_fkey convalidated=true`, 153 users / 0 orphans, Pace owner + 3 members intact. (Hit a `career_cards`-is-a-view error mid-093 — removed that DELETE since the view derives from base tables; `BEGIN/COMMIT` rolled the first attempt back cleanly, so no partial deletes.) **Ran the T1.12.1 hard gate via Supabase MCP → 14 orphan `public.users` rows (no `auth.users`).** **Root cause fixed in code:** `getOrCreateUserByWallet` given an `auth:<uuid>` placeholder was INSERTing a fresh-UUID row (orphan) instead of resolving by `id=<uuid>`; now routes through new `getOrCreateAuthUserById` (pins `id` to the auth uuid, race-safe upsert). Gated to `auth:` placeholders only — `0x…` path unchanged; protects all 13 callers. Build green. **Owner decided** delete legacy null-email orphans + metro test rows → authored **093** (transactional cleanup of 14 orphans across 36 user-ref columns; asserts 0 before COMMIT) + **094** (VALIDATED FK, fails loudly on any orphan). **Pace owner `s.blaha` aligned (fine Monday); no orphan owns a company; no mvr_orders/payments among them.** **Did NOT** drop `walletAddress` (T1.13 — blocked on T1.12b) or bump supabase-js (T1.14 passkeys — post-cutover). **Next (manual, dashboard):** run 093 → re-run gate (=0) → run 094. Then Auto T1.12b. |
| 2026-05-30 | T1.12c — Supabase-only auth cutover (scoped)                   | Claude Opus 4.8 | pending user commit           | **Made Supabase the only login** (SDK/provider intentionally **kept mounted** — company-wallet/payment is its own epic, T1.12d). `/sign-in`+`/auth/callback` honor a same-origin `next` (open-redirect guarded; `?wallet=1` link removed). **`page.tsx` rewritten Supabase-only:** deleted the 6 `@account-kit` hooks, the Alchemy session-sync effect, the 1.5s timer, the `didExplicitLogoutRef` logic, and the `?wallet=1` dual-door; `sessionSettled = supabaseSessionChecked`; logout = `supabase.auth.signOut()`. **`DriverShell`** lost `AlchemyAuth` + `onAuthSuccess` (+ the personal `WalletTransactions` on the resume page). **`onboard/[token]` + `invite/[token]`** now redirect unauthed users to `/sign-in?next=` and resume setup from the session (wallet resolved like `useSupabaseAuthSync`: DB wallet or `auth:<uuid>`); verified `accept-invite`'s on-chain `addOwnerToCompanyWallet` is best-effort (try/catch). **`AdminDashboardShell`** now reads `useWalletAddress()` from the persisted store (boss DB wallet ∈ `ADMIN_WALLETS`, so `requireAdmin` still works; proper allowlist = future T1.8-admin). **Point of no return: dropped the `x-wallet-address` fallback from `auth-session.ts`** → session-only (tests rewritten, 3 pass). **Personal wallet UI removed:** `UserStatusModal`→plain account modal, nav STORM pill gone, `HubAccountSection`→referrals only, `EmployerHub` personal `STORMBalance` gone; **deleted** `STORMBalance`/`USDCBalance`/`wallet/SendUSDC`/`wallet/SendSTORM`/`WalletTransactions`/`use-storm-token-balance` (+ orphaned `navStormPillClass`). `npm run build` green. `AlchemyAuth.tsx` now orphaned (→T1.12d). **Manual gate still pending:** real OTP/Google → hub, invite round-trip, admin load, waived screening order (Pace Monday). **Next: T1.12b** (Auto-safe client header cleanup) then **T1.12d** (provider/SDK + company-wallet teardown). |
| 2026-05-30 | T1.12-pre inventory + T1.12a middleware                        | Claude Opus 4.8 | pending user commit           | **T1.12-pre:** produced `docs/midnight/T1_12_BLAST_RADIUS.md` (read-only) — full Alchemy/wallet touchpoint map. Counts: **@account-kit/SDK** 23 files, **Alchemy hooks** 11 files (heaviest `page.tsx` w/ 6 hooks), **client `x-wallet-address` senders** 92 files, **API readers** 26, **`walletAddress` identity reads** 87 files. Wallet-only API routes flagged (5 admin + `storm/history` + `driver/public/[token]`). **T1.12a (shipped):** `src/middleware.ts` matcher now **includes `/api/*`** for Supabase cookie refresh, but **excludes** the Accio webhook entrypoints (`api/webhooks/*`, `api/mvr/webhook`, `api/psp/webhook`) + `api/github/callback` — `updateSession` only reads cookies (never the body), so Pace XML callbacks are unchanged. No Stripe webhook exists yet. Matcher regex validated vs sample paths; lint clean; `next.config` already `ignoreBuildErrors`. **Next: T1.12b** (migrate 92 client senders off wallet header → cookie session) **then T1.12c** (remove Alchemy SDK + delete wallet fallback in `auth-session.ts`) — both premium + Pace-coordinated + Vercel preview. |
| 2026-05-30 | T1.11c closeout (+ passwordless pivot, live fixes)             | Claude Opus 4.8 | pending user commit           | **T1.11 marked ✅ Done (a+b+c).** Reconciled the spec to what shipped: **passwordless Google + email OTP** (no passwords; `/sign-up` → redirect). Folded in three live-testing fixes: (1) migrated-wallet **role lookup** by session id in `/api/user/profile`; (2) **`/sign-in`↔`/` redirect loop** fixed via `supabaseSessionChecked` + `!sessionUserId` guard; (3) **prod OTP flicker** fixed via hard-nav (`window.location.assign`). Dashboard config done: **Resend SMTP**, **OTP `{{ .Token }}` template**, **Google OAuth published to prod** (verified with a real non-test user). Middleware `/api/*` re-include stays owned by **T1.12**. Rewrote T1.12 into sub-steps (pre/a/b/c) — point of no return + `page.tsx` is built on account-kit hooks (surgery, not a mechanical Auto delete). **Next: T1.12-pre inventory (Auto), then T1.12a middleware (premium, Pace-coordinated).** |
| 2026-05-29 | T1.8 (partial: AI + misc)                                      | Claude Opus 4.8 | pending user commit           | Done ahead of T1.7 (employer held for Pace). Migrated **9 AI routes** (`cover-letter`, `parse-resume`, `chat`, `draft-lens`, `job-talking-points`, `interview-prep-quiz`, `extract-job-requirements`, `social-posts`, `credits` POST) + **`applications/status`** PATCH to `getStormUserIdFromRequest`. Preserved `STORMI_UNLIMITED_WALLETS` flag (separate header read, not auth) in 5 AI routes; `ai/chat` adds a `role` lookup; `extract-job-requirements` dropped its unused user lookup. **Admin routes DEFERRED** to a dedicated admin-auth step — they use `ADMIN_WALLETS` env allowlist (`isAdmin(wallet)`), not per-user resolution, so the helper swap is the wrong tool (lockout risk). Build green · lint clean · 0 new type errors. T1.8 status → 🟡 Partial. **Next: T1.7 (employer, needs user go-ahead + Mon Pace test) OR T1.9 backfill.** |
| 2026-05-29 | Alchemy CORS hotfix + T1.6                                     | Claude Opus 4.8 | pending user commit           | **(1) Prod login hotfix (not a T-step):** Alchemy tightened CORS on the bare `base-sepolia.g.alchemy.com/v2` node endpoint — its `Authorization: Bearer` preflight now 401s with no `Access-Control-Allow-Origin`, breaking `eth_getCode` → infinite retry storm → "exceeded concurrent requests." Fix: split transport in `alchemy-account-config.ts` (signer keeps `apiKey`; node RPC routes through key-in-path `nodeRpcUrl` which passes CORS) + 15s retry-storm watchdog in `AlchemyAuth.tsx`. **Verified in real browser from prod origin**: key-in-path → 200, bare+Bearer → `Failed to fetch`. NOT caused by our T-steps (broke with no deploy). **(2) T1.6:** migrated ~45 candidate write routes (+ straggler GETs) to `getStormUserIdFromRequest` via 4 parallel sub-batches + manual sweep. 3 patterns (lookup-only / create-on-write fallback / extra-columns). `saveDriverApplicationClient` got optional `resolvedUserId`. Employer verification routes → T1.7; admin+AI → T1.8; legacy (storm/history, USDC pay, set-role) skipped. Build green · lint clean · 0 new type errors. **Next: T1.7 (employer routes — Pace-critical).** |
| 2026-05-29 | T1.5 + deploy-sequencing doc                                   | Claude Opus 4.8 | pending user commit           | Migrated **22 candidate read (GET) routes** to `getStormUserIdFromRequest` in 4 sub-batches (career-card cluster, driver, developer/general/resumes, notifications/messages/jobs/candidate, storm/referrals/user/ai/hub). Mixed-method files: GET only (writes → T1.6). Deferred: `lenses/[id]`, `applications/status`, `user/profile` (no GET / write-only); **skipped** `storm/history` (legacy wallet-keyed STORM, Option-B removal target). `jobs/recommended` still reads wallet header for `STORMI_UNLIMITED_WALLETS` (flag T1.8). Null-auth standardized to `401 {error:'Authentication required'}` (was `400` on two hub routes). Middleware `/api/*` matcher **deliberately left excluded** until T1.11 (sessions dormant pre-cutover). Lint clean · tsc 0 new errors · build green. Also added the **"Deploy sequencing & release gates"** section (two-speed plumbing-vs-cutover, incognito new-user gate, T1.12 backfill SQL gate). **Next: T1.6 (candidate write routes).** |
| 2026-05-28 | T1.3 rollback (089)                                            | Claude Opus 4.7 | applied to prod via dashboard | **Second prod outage from T1 deploy.** New users hitting `/api/user/set-role` → 500 immediately after Alchemy OTP. Cause: 088's FK enforces every new INSERT (NOT VALID only skips existing rows), and the legacy wallet path generates `users.id` UUIDs with no `auth.users` row. Fix: migration 089 drops the FK. Bootstrap helper from T1.3 stays — it'll do code-level enforcement for Supabase-Auth users. Re-added T1.12.1 to put the FK back AFTER cutover. Added pre-deploy verification rule: NOT VALID does not make a FK additive. |
| 2026-05-28 | T1.4                                                           | Claude Opus 4.7 | pending user commit           | `src/lib/auth-session.ts` + 5 unit tests (all passing). Public `getStormUserIdFromRequest` + testable internal `resolveStormUserId(request, { supabaseSession, supabaseAdmin })` with explicit-deps shape so tests don't need `vi.mock`. Supabase session wins; wallet header fallback; null when neither resolves. Pure additive — nothing imports it yet. **Safe to deploy alone (Category A).** Next: T1.5 in batches. |
| 2026-05-28 | T1.2 hotfix                                                    | Claude Opus 4.7 | pending user commit           | **Prod outage post-T1 deploy.** Users hit "Internal Server Error" / Alchemy `code:16` on OTP submit. Cause: `@supabase/ssr` 0.10.3 dropped the deprecated `get/set/remove` cookies API; `utils/supabase/middleware.ts` was still using it and threw on every request → all page loads 500'd. Migrated middleware + server client to `getAll/setAll`, wrapped middleware in try/catch with env-var guard, excluded `/api/`* from the matcher (Phase 1 dual-mode uses `x-wallet-address`; re-include at T1.5). Build green. T1.2 stays ✅ Done. |
| 2026-05-27 | T1.3                                                           | Composer        | pending user commit           | `088_users_auth_fk.sql` (FK NOT VALID); `user-bootstrap.ts` + tests. `auth:{uuid}` placeholder for auth-only rows until wallet column nullable. Apply migration on remote manually. **Next: T1.4.** |
| 2026-05-23 | T1.2                                                           | Composer        | pending user commit           | Root `src/middleware.ts`; `@supabase/ssr` ^0.10.3; `lib/supabase-`* re-exports. Build OK. T1.1 still 🟡 (Google OAuth incomplete). |
| 2026-05-22 | Pre-flight P0.1–P0.3 + Track 1 rewrite (Clerk → Supabase Auth) | Claude Opus 4.7 | n/a (docs only)               | All three pre-flight decisions resolved. Track 1 rewritten throughout: T1.1 dashboard config (no Clerk account), T1.2 `@supabase/ssr` install, T1.3 collapsed from "user-sync webhook" to "ID alignment migration" because `auth.users.id` IS `users.id`, T1.4 Supabase-first session helper, T1.9 backfill via `supabase.auth.admin.createUser`, T1.11 custom forms with Storm UI primitives. Net: Track 1 shrinks slightly + becomes simpler (no svix, no email-as-join-key). Pace-critical files still untouched. |
| 2026-05-22 | doc-creation (this file)                                       | Claude Opus 4.7 | n/a                           | Initial checklist authored. Phase 1 not yet started. Pre-flight decisions still pending. |

---

## Open questions / things to revisit

- ~~**Auth provider final pick**~~ — ✅ Supabase Auth (DEC-2026-05-008)
- ~~**STORM token fate**~~ — ✅ Option B (DEC-2026-05-005)
- ~~**Stripe shape**~~ — ✅ Checkout + Subscriptions, deferred (DEC-2026-05-006)
- **`users.wallet_address` after D3** — drop the column or keep for history? Default: keep, mark deprecated in `block-development.mdc`.
- **Existing share tokens** — public share URLs (`/card/[token]`, `/d/*`, `/dev-card/*`, `/c/*`, `/onboard/*`) work without auth; D4 must keep them working via signed URLs, and the middleware matcher must keep them in the public path list.
- **Pace billing onboarding** — when does Pace move off free placement onto Stripe? Out of scope here (DEC-2026-05-006).

---

**Document conventions:**
- Status icons: ⬜ Not started · 🟡 In progress · ✅ Done · ❌ Blocked · ⏸ Deferred
- Step IDs are stable (a step keeps its ID even if reordered)
- Commit messages follow the prescribed format so `git log --oneline` doubles as the migration audit trail
- Date format: ISO `YYYY-MM-DD`

**Last updated:** 2026-05-30
