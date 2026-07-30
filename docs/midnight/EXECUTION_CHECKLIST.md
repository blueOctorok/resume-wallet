# Storm Foundation Reset — Execution Checklist

**This is the master tracker for the Phase 1 / 2 / 3 migration.** Tick steps off as they ship. Every AI session working on this migration starts here.

> Strategic context: `[ARCHITECTURE.md](./ARCHITECTURE.md)` · Phase 1 detail: `[PHASE_1_PLAN.md](./PHASE_1_PLAN.md)` · Pace context: `[PARTNERS.md](./PARTNERS.md)` · Decision rationale: `[DECISION_LOG.md](./DECISION_LOG.md)`

---

## Where we are (2026-06-09)

The hard part is done. Re-read this snapshot at the start of every session.

| | Track | Status |
|---|---|---|
| ✅ | **Track 1 — Auth (Alchemy → Supabase)** | **DONE & live.** Supabase is the only login. Pace works. |
| ✅ | **Track 2 — Web3 demolition** | **COMPLETE (D1–D5).** STORM, Base registries, USDC/company wallet/`@account-kit`, IPFS, crypto deps/env removed. |
| ✅ | **Phase 2 — Selective disclosure** | **COMPLETE (P2.1–P2.7).** Attestations table → signed-JWT service → fact registry → API → carrier panel → disclosure toggles → Verified-by-Storm language + Stormi. |
| 🎯 | **Phase 3 — Midnight ZK** | **← active track (GTM-driven).** Swap the JWT backend for Midnight ZK behind the same `attestationService` interface. Build it for real — time-to-credible, not time-to-demo. DEC-2026-06-001. |
| ⏸ | **Payments (Stripe)** | Deferred **greenfield** add — *not* a USDC conversion (see below). Build when a paying customer exists. |

```
DONE ──► Track 2 Demolition ✅ ──► Phase 2 Attestation ✅ ──► Phase 3 Midnight (active track)
              (complete)              (the moat — shipped)              Payments (Stripe) — whenever
```

**Why this order:** Phase 2 proves the moat — *selective disclosure of verified facts* — with a JWT first, so the UX exists before the crypto. But Midnight is **not** just optional polish: for a late entrant with no network, ZK proofs are the load-bearing way to make a driver-owned fact verifiable *cold* (trust the math, not Storm or a network) — that's how you beat a 20-year carrier network (DEC-2026-06-002). So Phase 3 is the active track, not a "swap in someday." (Stripe genuinely is "whenever a paying customer shows up.") The demolition first removed the dead Web3 cruft (USDC/Base/IPFS) that was pure liability — clearing the deck for the *real* Midnight work.

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

## Pace invariants — DO NOT BREAK!!!

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
- **Auth cutover (done):** ✅ **Monday live verification gate GREEN (2026-06-01)** — Pace team signs in with Supabase and logins route to the right places. Multi-user company-scoped data confirmed. **This clears the D3 pre-condition.**
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
| Status | ✅ Done · 2387eb2 · 2026-06-01 |
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

<details><summary><strong>📋 Auto prompt — copy-paste (D2)</strong></summary>

```text
TASK: Execute step D2 — "Decommission Base-Sepolia registries" — from docs/midnight/EXECUTION_CHECKLIST.md (Track 2 — Web3 demolition).

FIRST read: docs/midnight/EXECUTION_CHECKLIST.md (the "Track 2" intro + step D2) and .cursor/rules/strategic-direction.mdc (alwaysApply rule). Confirm the strategic rule is in context.

WHY: ResumeRegistry + ProductionDriverRegistry were Base-Sepolia contracts holding hash anchors for resume/DOT verification. Only ~7 TEST resumes + test DOT apps were ever anchored — disposable. On-chain "verification" becomes a DB-flag placeholder until Phase 2 attestation ships. Archive (don't delete) the registry Solidity for historical reference.

CRITICAL — TWO DIFFERENT "VERIFICATIONS" (do not confuse):
- ON-CHAIN registry verify (resume/DOT hash on Base) → THIS is what D2 removes.
- ACCIO MVR/PSP SCREENING (the real third-party credential checks) → Pace-critical, COMPLETELY UNRELATED, DO NOT TOUCH.

DELETE (verify zero remaining importers with rg before each delete):
- src/app/api/blockchain/submit-driver-application/route.ts
- src/app/api/blockchain/verify-resume/route.ts
- src/lib/resume-registry-onchain.ts
- src/lib/driver-contract.ts
- src/lib/contract.ts
- src/lib/contract-constants.ts
- src/lib/typed-data.ts
- src/lib/alchemy-webhooks.ts  (registers webhooks for the registry contracts — confirm unused, then delete)
- scripts/deploy-resume-registry.js + any scripts/test-contract*.js that only target the registry

ARCHIVE (git mv → contracts/legacy/, append to the existing contracts/legacy/README.md):
- contracts/ResumeRegistry.sol
- contracts/ProductionDriverRegistry.sol
- Delete matching build output: artifacts/contracts/ResumeRegistry.sol/, artifacts/contracts/ProductionDriverRegistry.sol/. Leave other artifacts.

EDIT (surgical — drop ONLY the on-chain branch, keep the route working via a DB flag):
- src/app/api/resumes/[id]/verify/route.ts — remove the blockchain submit/verify branch + its imports. "Verify" still returns a verified state from the DB column. Leave IPFS logic alone (that's D4).
- src/app/api/driver-applications/[id]/verify/route.ts — same: remove the on-chain branch, keep DB-flag verify.
- src/components/ResumeUploadWithVerification.tsx + src/components/driver-application/EmploymentVerificationForm.tsx — remove any direct on-chain verify calls; keep the upload + DB verify-status UI intact. (rg these for contract/registry imports; if a component becomes a thin wrapper, leave it functioning — do NOT redesign UI.)
- package.json — remove the registry-only npm script entries: deploy:local, deploy:base-sepolia, deploy:base, verify:base-sepolia, verify:base. Leave hardhat/ethers installed (D5 removes deps).

DO NOT TOUCH:
- Accio screening: /api/mvr/webhook, /api/psp/webhook, lib/process-*-accio-webhook.ts, lib/place-screening-order.ts, lib/reconcile-pending-screenings.ts, lib/accio-*, src/app/api/employer/**, src/components/employer/**.
- IPFS / Pinata (that's D4). `users.wallet_address` (that's D3/historical).
- Do not write a destructive migration; the resume/DOT verified-status columns already exist — just stop writing the chain tx hash.

VERIFY before done:
- rg -n "resume-registry-onchain|driver-contract|/api/blockchain|RESUME_REGISTRY|DRIVER_APP_REGISTRY|ResumeRegistry|ProductionDriverRegistry" src/  → 0 (only contracts/legacy + docs may match elsewhere).
- "Verify resume" and "verify DOT app" still produce a verified state (DB flag); no on-chain call attempted.
- npm run build green; lint clean; 0 new TS errors.

DOCS: add a dated D2 entry to docs/CHANGES.md (deleted/archived/edited + note ~7 test anchors, DB-flag placeholder, Accio untouched). In docs/midnight/EXECUTION_CHECKLIST.md set D2 Status to "✅ Done · {commit-hash} · {date}" and append a Session handoff log row (newest at top).

COMMIT: chore(demolition): decommission Base-Sepolia registries (D2)

Pace risk: None — no Pace-critical screening file is touched. Mechanical + a few surgical route edits.
```

</details>

### D3 — Remove USDC + company wallet + `@account-kit` (absorbs T1.12d & T1.13 remainder)
| | |
|---|---|
| Status | ✅ Done · 76c560d · 2026-06-05 (D3.1–D3.4; absorbed T1.12d + T1.13 remainder) |
| Pre-conditions | D1 ✅ · D2 ✅ · ~~Pace Monday auth gate~~ ✅ **green 2026-06-01** |
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

> ⚠️ **D3 is the human-audit checkpoint.** `walletAddress` appears in ~190 files (most are prop/type names, not real auth). Auto must work in the 4 substeps below as **separate commits**, build-green after each, and **STOP before substep 4** (the store-field drop) for human review. Do not one-shot this.

<details><summary><strong>📋 Auto prompt — copy-paste (D3, substepped)</strong></summary>

```text
TASK: Execute step D3 — "Remove USDC + company wallet + @account-kit" — from docs/midnight/EXECUTION_CHECKLIST.md (Track 2). This absorbs the deferred T1.12d + T1.13 remainder.

FIRST read: docs/midnight/EXECUTION_CHECKLIST.md (Track 2 intro + step D3), .cursor/rules/strategic-direction.mdc, and .cursor/rules/architecture.mdc (API Route Standards — auth section). Confirm in context.

PRE-CONDITIONS: D1 ✅, D2 done, Pace Monday auth gate ✅ green. Auth is Supabase-only; identity = Supabase session (sessionUserId). The chain is interaction-gated (users never touch a wallet/gas/token).

GROUND RULES:
- Work in 4 SEPARATE substep commits. Run `npm run build` after EACH substep; do not proceed if red.
- After substeps 1–3, STOP and hand back for human audit BEFORE doing substep 4 (the walletAddress store-field drop). Substep 4 is the risky one.
- DO NOT TOUCH Pace-critical files: src/app/api/employer/**, src/components/employer/** (except the wallet-only components named below), lib/place-screening-order.ts, lib/reconcile-pending-screenings.ts, lib/accio-*, lib/sync-outreach-invite-status.ts, lib/employer-*.
- Keep DB columns for history: mvr_orders/psp_orders.payment_tx_hash, companies wallet columns, users.wallet_address. Stop WRITING them from the UI; do not drop columns.

── SUBSTEP 1 — USDC payments UI ──  commit: chore(demolition): remove USDC payment buttons (D3.1)
DELETE: src/components/MvrPaymentButton.tsx, src/components/PspPaymentButton.tsx, src/components/ApplyWithStormChainModal.tsx (if USDC-gated), wallet/SendUSDC.tsx + wallet/SendSTORM.tsx if present.
EDIT: src/components/StormiCreditModal.tsx — remove Coinbase Onramp / USDC paths. In MvrOrderForm/PspOrderForm and /api/mvr/order + /api/psp/order, stop passing/requiring paymentTxHash from the UI (order flow continues without a crypto payment step; leave the column write optional/null).
VERIFY: rg -n "MvrPaymentButton|PspPaymentButton|onramp|USDC|SendUSDC" src/ → 0 (DB column names ok). Build green.

── SUBSTEP 2 — Company wallet stack ──  commit: chore(demolition): remove company wallet provisioning (D3.2)
DELETE: src/components/employer/CompanyWallet.tsx, src/components/WalletInfo.tsx, src/components/TransactionHistory.tsx, src/app/api/wallet/mvr-config/route.ts, src/app/api/wallet/psp-config/route.ts, src/app/api/employer/company/ensure-wallet/route.ts, src/lib/persist-company-wallet.ts, src/lib/company-wallet-server.ts, src/lib/company-wallet-public.ts, src/lib/alchemy-token-api.ts, src/lib/alchemy-transfers-api.ts.
EDIT: src/app/api/employer/team/accept-invite/route.ts — remove the addOwnerToCompanyWallet call (it's already best-effort/try-catch; invite acceptance must still succeed). Remove wallet tabs/links from EmployerHub.tsx (only the wallet UI entry points — leave jobs/talent/applicants/messaging).
VERIFY: rg -n "CompanyWallet|ensure-wallet|company-wallet|alchemy-token-api|alchemy-transfers" src/ → 0. Employer hub still renders; build green.

── SUBSTEP 3 — Alchemy provider + SDK ──  commit: chore(demolition): remove AlchemyProvider + account-kit SDK (D3.3)
DELETE: src/components/AlchemyProvider.tsx, src/lib/alchemy-account-config.ts, src/components/AlchemyAuth.tsx (if present).
EDIT: src/app/layout.tsx — remove <AlchemyProvider> wrapper; ensure SupabaseAuthSync / query-client providers still wrap the tree correctly.
UNINSTALL: npm uninstall @account-kit/core @account-kit/react @account-kit/smart-contracts @aa-sdk/core alchemy-sdk @coinbase/cdp-sdk @coinbase/onchainkit @base-org/account @base-org/account-ui   (run rg to confirm each has 0 src/ imports first; skip any that are still referenced and report it).
VERIFY: rg -n "@account-kit|@aa-sdk|alchemy-sdk|@coinbase|@base-org|AlchemyProvider" src/ → 0. App boots; sign-in still works (Supabase). Build green.
*** STOP HERE — hand back for human audit before substep 4. ***

── SUBSTEP 4 — Drop walletAddress store field (RISKY — only after audit) ──  commit: refactor(auth): drop walletAddress store field, use sessionUserId (D3.4)
- In src/stores/auth-store.ts remove the walletAddress field. Replace every read with sessionUserId (Supabase user id). Most "walletAddress" occurrences are prop/type names — rename or repoint to sessionUserId; do not blindly delete props that other components pass.
- API routes already resolve identity via getStormUserIdFromRequest (auth-session.ts) — confirm none still depend on an x-wallet-address header.
- Keep users.wallet_address column (historical). Mark deprecated in a comment.
VERIFY: rg -n "walletAddress" src/ → 0 (or only a deprecated users.wallet_address DB reference). New-user incognito flow end-to-end: sign in → candidate hub → employer screening order. Build + lint green.

DOCS (after the full step): docs/CHANGES.md dated D3 entry (per-substep summary). Set D3 Status in EXECUTION_CHECKLIST.md to "✅ Done · {final-commit} · {date}", append handoff-log row noting it absorbed T1.12d + T1.13 remainder.
```

</details>

### D4 — IPFS → Supabase Storage (downscoped)
| | |
|---|---|
| Status | ✅ Done · aef844f · 2026-06-04 |
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

<details><summary><strong>📋 Auto prompt — copy-paste (D4)</strong></summary>

```text
TASK: Execute step D4 — "IPFS → Supabase Storage" — from docs/midnight/EXECUTION_CHECKLIST.md (Track 2). Can run independently of D2/D3.

FIRST read: docs/midnight/EXECUTION_CHECKLIST.md (step D4), .cursor/rules/block-development.mdc (data layer), .cursor/rules/architecture.mdc (Data Layer / API Route Standards). Confirm in context.

WHY: Documents currently upload to Pinata/IPFS via NEXT_PUBLIC_PINATA_JWT (client-side) and render from gateway.pinata.cloud/ipfs/<hash>. Only ~7 TEST docs exist on IPFS — disposable. Move to a PRIVATE Supabase Storage bucket with signed URLs. NO dual-write / backfill needed; accept loss of the test docs (or one-shot copy).

ARCHITECTURE NOTE (important): IPFS upload is client-side today; Supabase Storage signed URLs should be issued SERVER-side. So uploads move behind an API route that uses the service-role client, and reads switch from a public gateway URL to a short-lived signed URL.

BUILD (new infra):
- Migration supabase/migrations/XXX_document_storage.sql: create private buckets `resumes`, `dot-applications`, `screening-reports`. RLS: a user can read/write only their own objects (path prefixed by users.id); employer-scope reads for screening reports follow existing company access.
- New src/lib/document-storage.ts (server helper using getAdminSupabaseClient): uploadDocument(userId, kind, file) → returns storage path; getSignedUrl(path, expirySeconds) ; deleteDocument(path). Keep it small (KISS) — no speculative APIs.

SWITCH (uploads):
- /api/resumes/upload (+ /api/resumes/create if it stores files), and the components that upload: UploadResumeModal.tsx, ResumeUploadWithPrefill.tsx, ResumeUpload.tsx, ResumeUploadWithVerification.tsx — route file bytes through document-storage.ts instead of uploadToIPFS. Store the returned path (reuse the existing ipfs_hash column to hold the storage path, OR add a storage_path column via the migration — pick one and note it; prefer a new nullable storage_path column to avoid overloading semantics).
- DotApplicationFlow.tsx / use-dot-application-sync.ts if they upload PDFs.

SWITCH (reads — grep every gateway URL construction):
- rg -n "gateway.pinata|ipfs/|ipfsHash|ipfs_hash" src/  → for each render/download site (CareerCard.tsx, career-card/sections/ResumeSection.tsx, ProjectedCareerCard.tsx, public token pages src/app/d/[token]/page.tsx + src/app/dev-card/[token]/page.tsx, hooks/use-hub-documents.tsx, ShareProfileCard, employer/ApplicantsPage, admin/resumes) replace the gateway URL with a getSignedUrl() call (server-issued; pass the signed URL down as a prop or fetch via a small API).

REMOVE:
- Delete src/lib/ipfs.ts and src/lib/resume-ipfs-guards.ts (verify unused). npm uninstall pinata-web3.
- Remove Pinata env vars from .env.local + Vercel: NEXT_PUBLIC_PINATA_JWT, NEXT_PUBLIC_PINATA_GATEWAY.

DO NOT TOUCH: Accio screening order/webhook logic; on-chain registry (D2 already handled it).

VERIFY: upload a new resume → it renders/downloads via a signed URL (not a pinata gateway). rg -n "ipfs|pinata|uploadToIPFS" src/ → 0. Share-card download works. Build + lint green.

DOCS: docs/CHANGES.md dated D4 entry (new bucket + document-storage.ts, switched upload+read sites, removed ipfs.ts/pinata, env vars dropped, ~7 test docs not migrated). Set D4 Status "✅ Done · {commit} · {date}" + handoff-log row.

COMMIT: feat(storage): move documents from IPFS to Supabase Storage (D4)
```

</details>

### D5 — Env + dependency sweep
| | |
|---|---|
| Status | ✅ Done · 1e5ddb0 · 2026-06-05 |
| Pre-conditions | D1–D4 |
| Pace risk | None |

**Goal:** Remove dead crypto deps + env vars now that nothing imports them. `npm uninstall ethers viem` (verify zero imports). Remove from Vercel + `.env.local`: `NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS`, `NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS`, `ALCHEMY_BASE_SEPOLIA_URL`, `PRIVATE_KEY`, Pinata keys, Alchemy keys. Run `depcheck`.

**Verification:** `rg "from 'ethers'|from 'viem'" src/` → 0. Build + lint green.

**Commit:** `chore(deps): remove crypto deps + env after demolition (D5)`

<details><summary><strong>📋 Auto prompt — copy-paste (D5)</strong></summary>

```text
TASK: Execute step D5 — "Env + dependency sweep" — from docs/midnight/EXECUTION_CHECKLIST.md (Track 2). FINAL demolition step.

FIRST read: docs/midnight/EXECUTION_CHECKLIST.md (step D5) and confirm D1–D4 are marked ✅ Done. If any of D1–D4 is not done, STOP and report — D5 only removes deps that nothing imports anymore.

RULE: For EVERY package, run rg to prove zero src/ imports BEFORE uninstalling. If something still imports it, do NOT uninstall — list it and stop.

DEPENDENCIES to remove (verify-then-uninstall):
- ethers  (registry helpers removed in D2 — confirm: rg -n "from 'ethers'" src/ → 0)
- viem    (company-wallet + payment removed in D3 — confirm: rg -n "from 'viem'" src/ → 0; note package.json's payment:address script also uses viem/accounts — remove that script entry too)
- Any @account-kit/*, @aa-sdk/*, alchemy-sdk, @coinbase/*, @base-org/*, pinata-web3 still left in package.json after D3/D4 (should already be gone — sweep up stragglers).

DEV DEPS + scripts (hardhat toolchain is now dead — registries archived in D2):
- npm uninstall hardhat @nomicfoundation/hardhat-ethers @nomicfoundation/hardhat-toolbox @nomicfoundation/hardhat-verify @openzeppelin/contracts
- Remove dead npm script entries from package.json: compile, test (hardhat), test:local, deploy:*, transfer-ownership, verify:base*, payment:* (the crypto payment-wallet scripts). KEEP: dev, build, start, lint, test:app (vitest), supabase:test, backfill/inspect tsx scripts.
- Delete hardhat.config.* and the scripts/ files those npm entries pointed at (create-payment-wallet.js, backup-payment-wallet.js, test-x402-payment.js, list-payments.js, check-credits.js, test-contract-local.js, deploy-resume-registry.js) — verify each is unreferenced first.

ENV VARS — remove from .env.local AND Vercel (document which in CHANGES):
NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS, NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS, ALCHEMY_BASE_SEPOLIA_URL (+ any ALCHEMY_* / NEXT_PUBLIC_ALCHEMY_*), PRIVATE_KEY, X402_PAYMENT_PRIVATE_KEY, NEXT_PUBLIC_PINATA_JWT, NEXT_PUBLIC_PINATA_GATEWAY, and any remaining STORM/registry/USDC vars. Keep all SUPABASE_*, STRIPE_* (future), ADMIN_EMAILS, RESEND/Accio keys.

OPTIONAL: run `npx depcheck` and report unused deps (do not auto-remove anything depcheck flags that you haven't manually verified).

VERIFY: rg -n "from 'ethers'|from 'viem'|hardhat" src/ → 0. npm run build + lint green. App boots; sign-in + a screening order still work.

DOCS: docs/CHANGES.md dated D5 entry (deps removed, scripts/env cleaned). Set D5 Status "✅ Done · {commit} · {date}" + handoff-log row. If this completes D1–D5, add a one-line "Track 2 — Web3 demolition COMPLETE" note to the Where-we-are snapshot at the top of the checklist.

COMMIT: chore(deps): remove crypto deps + env after demolition (D5)
```

</details>

---

## Phase 2 — Selective disclosure (THE MOAT — ✅ COMPLETE)

This is the point of the whole reset. **Demolition (D1–D5) is complete and prod is stable**, so the pre-condition for P2.1 is met. Build order is dependency-first: schema → service → facts → API → UI → toggles → polish.

> **Read before any P2 step:** `[attestation-architecture.mdc](../../.cursor/rules/attestation-architecture.mdc)` (the interface + fact-registry + selective-disclosure rules), `[midnight-data-boundary.mdc](../../.cursor/rules/midnight-data-boundary.mdc)` (the provenance gate), `[ARCHITECTURE.md](./ARCHITECTURE.md)` "Phase 2" (what ships / what does NOT).

### Non-negotiable Phase 2 invariants (every step)

- **Storm is not a CRA.** Every attestation cites its originating CRA (`source_cra`, e.g. `'accio'`) + pull id; every share is **candidate-initiated**. DEC-2026-05-011.
- **Provenance gate (DEC-2026-05-014).** Only `source: 'third_party'` facts (MVR, PSP, employment verification, CDL-from-issuer) may produce a `ProofArtifact` or render a "verified" badge. **Self-reported data is display-only** — never routed through `proveFact()`.
- **Phase-2 = signed JWT, not ZK.** Never write "ZK proof" / "on-chain" in P2 code or copy. The implementation hides behind the `attestationService` interface so Phase 3 is a one-line registry swap.
- **Attestations are immutable.** Never UPDATE — insert a new row and set `superseded_by` on the prior.
- **Don't read `block_*` in verification UI.** Verified surfaces go through `attestationService` only.
- **No new infra.** Vercel + Supabase only. No Docker, no Compact, no chain.

### Step index

| Step | Track | Goal | Effort | Pace risk |
|---|---|---|---|---|
| **P2.1** | T7 | `attestations` table migration (+ Phase-4 forward-compat columns) | S | None (additive) |
| **P2.2** | T7 | `attestationService` interface + registry + signed-JWT impl | M | None (additive lib) |
| **P2.3** | T8 | Fact registry (`FactType` + `FactDefinition` + first 3 third-party `proveImpl`s) | M | Low (reads Accio data, read-only) |
| **P2.4** | T7/T8 | API routes: `/api/attestation/prove` (candidate) + `/api/attestation/verify` (carrier) | M | Low |
| **P2.5** | T9 | Carrier-facing `CredentialFactsPanel` in `CareerCardModal` (facts-first, PDF demoted) | L | **Medium — touches I-8 `CareerCardModal`** |
| **P2.6** | T10 | Candidate per-audience disclosure toggles | M | Low |
| **P2.7** | T9/T10 | "Verified by Storm" language + Stormi/journey wiring | S | None |

**Pre-condition for the whole phase:** demolition shipped ✅ + production stable ✅. Brief Pace on what verified fact panels will look like **before P2.5 ships** (per Pace check-in cadence).

---

### P2.1 — `attestations` table migration
| | |
|---|---|
| Status | ✅ Done · 465f83b · 2026-06-05 |
| Pre-conditions | D1–D5 ✅ |
| Pace risk | None — additive migration, no existing table touched |

**Goal:** Create the immutable `attestations` table per `attestation-architecture.mdc` "Persistence", **plus** the Phase-4 forward-compat columns from DEC-2026-05-013 (`valid_until`, `source_cra`, `source_pull_id`, `query_count`). Don't build the marketplace — just don't make it impossible later.

**Files:**
- `supabase/migrations/098_attestations.sql` (next number after 097):
  - Columns: `id`, `candidate_user_id → users(id)`, `fact_type text`, `fact_summary text`, `disclosed_fields jsonb`, `issued_at timestamptz default now()`, `expires_at timestamptz`, `valid_until timestamptz`, `source_cra text`, `source_pull_id text`, `audience_id → companies(id)`, `proof_artifact jsonb`, `superseded_by → attestations(id)`, `query_count int default 0`, `created_at`.
  - Indexes: `(candidate_user_id, fact_type)`; partial `(audience_id) where audience_id is not null`.
  - **RLS:** candidate sees own rows (`candidate_user_id = auth.uid()`); audience-scoped rows visible to that company's members; service-role bypass for the issuer.
- Apply via Supabase dashboard (document in CHANGES like 097).

**Verification:** Migration applies clean; `select` as candidate returns only own rows; insert requires service role. Build green (no code yet).

**Commit:** `feat(attestation): add attestations table + RLS (P2.1)`

<details><summary><strong>📋 Auto prompt — copy-paste (P2.1)</strong></summary>

```text
TASK: Execute step P2.1 — "attestations table migration" — from docs/midnight/EXECUTION_CHECKLIST.md (Phase 2).

FIRST read: docs/midnight/EXECUTION_CHECKLIST.md (Phase 2 invariants + P2.1), .cursor/rules/attestation-architecture.mdc ("Persistence" section), .cursor/rules/midnight-data-boundary.mdc. Confirm in context.

PRE-CONDITIONS: D1–D5 done (demolition complete). This is purely additive — no existing table is touched.

GROUND RULES:
- Additive migration only. Never DROP/ALTER existing tables.
- Next migration number after the highest in supabase/migrations/ (097 is the last known — verify).
- RLS ON. Candidate reads own rows via auth.uid() = candidate_user_id; company members read rows where audience_id = their company; issuance is service-role only.

BUILD migration supabase/migrations/0NN_attestations.sql with columns + indexes exactly as P2.1 lists (include Phase-4 forward-compat columns: valid_until, source_cra, source_pull_id, query_count). Attestations are immutable: no UPDATE policy; supersede via superseded_by.

VERIFY: migration SQL parses; describe the RLS policies in the PR notes. No app code yet → build stays green.

DOCS: docs/CHANGES.md dated P2.1 entry (table + columns + RLS + "apply via dashboard"). Set P2.1 Status "✅ Done · {commit} · {date}" + handoff-log row. Note the migration must be applied manually on remote.

COMMIT: feat(attestation): add attestations table + RLS (P2.1)
```

</details>

---

### P2.2 — `attestationService` interface + registry + signed-JWT implementation
| | |
|---|---|
| Status | ✅ Done · 0b7a92b · 2026-06-05 |
| Pre-conditions | P2.1 |
| Pace risk | None — new lib, nothing imports it yet |

**Goal:** Land the swappable service exactly as specced in `attestation-architecture.mdc` "The interface" + "Phase 3 — when it ships". Phase 2 ships the **signed-JWT** impl; the registry indirection is what makes Phase 3 a one-line change.

**Files:**
- `src/lib/attestation-service.ts` — the `AttestationService` interface, `AttestationInput`, `Attestation`, `ProofArtifact` (`signed_jwt` | `midnight_zk`), `VerificationResult` types. **Interface only.**
- `src/lib/signed-jwt-attestation-service.ts` — implements `proveFact` (signs a JWT over `{factType, factSummary, disclosedFields, candidateUserId, audienceId, issuedAt, expiresAt, sourceCra, sourcePullId}` with `jose`, persists an `attestations` row, returns `{kind:'signed_jwt', jwt, issuer}`) + `verifyAttestation` (verifies signature + expiry, returns `disclosedFields`). Reuse existing `jose`/`jsonwebtoken` dep.
- `src/lib/attestation-service-registry.ts` — exports `attestationService` chosen by `ATTESTATION_BACKEND` env (defaults to signed-jwt).
- Env: `ATTESTATION_JWT_PRIVATE_KEY` / public key (or HS256 secret for v1) + `ATTESTATION_ISSUER` (e.g. `storm`). Document in CHANGES + VERCEL_ENV_CHECKLIST.
- Unit test `src/lib/__tests__/signed-jwt-attestation-service.test.ts` (prove → verify round-trip; tampered JWT fails; expired fails).

**Verification:** `npm run test:app` green; round-trip test passes. `rg "signedJwtAttestationService" src/components` → 0 (components import the registry, never the impl). Build green.

**Commit:** `feat(attestation): attestationService interface + signed-JWT impl (P2.2)`

<details><summary><strong>📋 Auto prompt — copy-paste (P2.2)</strong></summary>

```text
TASK: Execute step P2.2 — "attestationService interface + signed-JWT impl" — from docs/midnight/EXECUTION_CHECKLIST.md (Phase 2).

FIRST read: .cursor/rules/attestation-architecture.mdc ("The interface", "Persistence", "Phase 3 — when it ships", "Don'ts"). Match the type shapes EXACTLY as written there. Confirm in context.

PRE-CONDITIONS: P2.1 attestations table exists.

GROUND RULES:
- Phase 2 = signed JWT ONLY. Do not write any ZK / Midnight / on-chain code or comments. The midnight_zk ProofArtifact variant is a type stub for Phase 3 — leave it unused.
- Components must NEVER import the impl directly — only the registry. Enforce by keeping the impl un-exported from any index.
- Use the already-installed jose (preferred) or jsonwebtoken. Do not add a crypto dep.
- The service persists every issued attestation to the attestations table (immutable; supersede prior unsuperseded row for the same candidate+fact via superseded_by).

BUILD: src/lib/attestation-service.ts (interface + types), src/lib/signed-jwt-attestation-service.ts (proveFact + verifyAttestation), src/lib/attestation-service-registry.ts (env-selected export). Add a vitest round-trip + tamper + expiry test.

VERIFY: npm run test:app green; npm run build green; rg "signed-jwt-attestation-service" src/components src/app → 0.

DOCS: docs/CHANGES.md P2.2 entry (files + new env vars). Add ATTESTATION_* to VERCEL_ENV_CHECKLIST.md "Private Variables". Set P2.2 Status + handoff row.

COMMIT: feat(attestation): attestationService interface + signed-JWT impl (P2.2)
```

</details>

---

### P2.3 — Fact registry (first three third-party facts)
| | |
|---|---|
| Status | ✅ Done · a2c1242 · 2026-06-05 |
| Pre-conditions | P2.2 |
| Pace risk | Low — `proveImpl`s READ Accio/MVR data via `block-data.ts`; no writes, no Pace path touched |

**Goal:** Build `src/lib/fact-registry.ts` per `attestation-architecture.mdc` "The fact registry". Ship **three third-party facts only** (the ones with real issuer provenance today): `mvr_clean_36_months`, `cdl_class_a`, `previous_employer_verified`. Each `proveImpl` reads through `block-data.ts` / MVR results, computes the boolean, and returns a **minimal** `disclosedFields` (no underlying PII / record bytes).

**Files:**
- `src/lib/fact-registry.ts` — `FactType` union, `FactDefinition` map, `proveImpl` per fact. Set `source: 'third_party'` + `category` honestly.
- Wire `signed-jwt-attestation-service.proveFact` to look up the `FactDefinition`, run `proveImpl`, and **reject** any `source: 'self_reported'` fact (provenance gate — hard error, not a badge).
- Reuse existing reads (`getMvrData`, `getCdlData`, employment verification rows) from `src/lib/block-data.ts` — do NOT query `block_*` directly.
- Unit tests: each fact true/false case + a `self_reported` fact is rejected by the gate.

**Verification:** `npm run test:app` green. `prove({factType:'mvr_clean_36_months'})` returns a JWT whose `disclosedFields` contains only the verification window (no violation rows). A `self_reported` fact request throws. Build green.

**Commit:** `feat(attestation): fact registry + first 3 third-party facts (P2.3)`

<details><summary><strong>📋 Auto prompt — copy-paste (P2.3)</strong></summary>

```text
TASK: Execute step P2.3 — "fact registry + first 3 third-party facts" — from docs/midnight/EXECUTION_CHECKLIST.md (Phase 2).

FIRST read: .cursor/rules/attestation-architecture.mdc ("The fact registry", "Selective disclosure rules"), .cursor/rules/midnight-data-boundary.mdc (provenance gate). Confirm in context.

PRE-CONDITIONS: P2.2 service + registry exist.

GROUND RULES:
- Ship exactly THREE facts, all source:'third_party': mvr_clean_36_months, cdl_class_a, previous_employer_verified. No self-reported facts.
- disclosedFields is the carrier-visible surface. Include ONLY the direct evidence (e.g. mvr → {verificationWindowStart, verificationWindowEnd}; cdl → {class:'A'}). NEVER include license numbers, DOB, SSN, full MVR/PSP bytes, or other unrequested facts.
- proveImpl READS via src/lib/block-data.ts helpers (getMvrData, getCdlData, employment verification). NEVER query block_* tables directly.
- Enforce the provenance gate IN proveFact: a self_reported FactDefinition must throw, not return a proof.
- Each attestation must carry source_cra + source_pull_id from the underlying Accio order.

BUILD: src/lib/fact-registry.ts (FactType union + FactDefinition map + 3 proveImpls); wire the gate into proveFact. Add vitest cases (true/false per fact + self_reported rejection).

VERIFY: npm run test:app green; npm run build green. Confirm disclosedFields contains no PII for each fact.

DOCS: docs/CHANGES.md P2.3 entry (3 facts + disclosedFields shape + gate). Set P2.3 Status + handoff row.

COMMIT: feat(attestation): fact registry + first 3 third-party facts (P2.3)
```

</details>

---

### P2.4 — Attestation API routes (prove + verify)
| | |
|---|---|
| Status | ✅ Done · 21ed2fc · 2026-06-05 |
| Pre-conditions | P2.3 |
| Pace risk | Low — new routes; existing employer/screening routes untouched |

**Goal:** Expose the service over HTTP. `/api/attestation/prove` is **candidate-initiated** (session-gated via `getStormUserIdFromRequest`); `/api/attestation/verify` lets a carrier (or public verify page) independently check an attestation.

**Files:**
- `src/app/api/attestation/prove/route.ts` — POST `{factType, audienceId?}`; identity from session; calls `attestationService.proveFact`; returns the `Attestation`. Candidate can only prove facts about **themselves**.
- `src/app/api/attestation/verify/route.ts` — POST `{attestation}` (or `{id}`); calls `verifyAttestation`; returns `VerificationResult`. Increment `query_count` (Phase-4 forward-compat).
- Standard route shape: `try/catch`, `{ error }` JSON, bracketed logs (`[ATTESTATION]`).
- Confirm both excluded from nothing special — they read cookies, so they stay inside the Supabase middleware matcher.

**Verification:** `curl` prove (authed) → attestation; verify → `{valid:true}`. Verify a tampered JWT → `{valid:false}`. A candidate proving another user's fact → 403. Build + lint green.

**Commit:** `feat(attestation): prove + verify API routes (P2.4)`

<details><summary><strong>📋 Auto prompt — copy-paste (P2.4)</strong></summary>

```text
TASK: Execute step P2.4 — "attestation API routes" — from docs/midnight/EXECUTION_CHECKLIST.md (Phase 2).

FIRST read: .cursor/rules/architecture.mdc (API Route Standards — auth + error shape), .cursor/rules/attestation-architecture.mdc ("Audience scoping"). Confirm in context.

PRE-CONDITIONS: P2.3 fact registry wired.

GROUND RULES:
- Auth via getStormUserIdFromRequest (session). No x-wallet-address.
- prove is candidate-initiated and self-only: the session user can only prove facts about their own user id. Reject cross-user.
- Error responses are { error: string } with status codes; logs prefixed [ATTESTATION].
- verify increments query_count on the attestation row (Phase-4 forward-compat) but never mutates the proof.
- Do NOT touch any /api/employer/** route (Pace I-2/I-4/I-8).

BUILD: src/app/api/attestation/prove/route.ts (POST, session-gated) + src/app/api/attestation/verify/route.ts (POST). 

VERIFY: manual curl prove→verify happy path; tampered→invalid; cross-user prove→403. npm run build + lint green.

DOCS: docs/CHANGES.md P2.4 entry (2 routes + auth model). Set P2.4 Status + handoff row.

COMMIT: feat(attestation): prove + verify API routes (P2.4)
```

</details>

---

### P2.5 — Carrier-facing `CredentialFactsPanel` (facts-first in CareerCardModal)
| | |
|---|---|
| Status | ✅ Done · 07d47bd · 2026-06-05 |
| Pre-conditions | P2.4 |
| Pace risk | **Medium — touches `CareerCardModal.tsx` (Pace invariant I-8).** Coordinate + verify talent-view still loads. |

**Goal:** Replace the PDF-first "verified" surface with a **facts-first** panel. The carrier sees "✓ Clean MVR — Verified by Storm on [date], derived from Accio pull" with an optional technical-details expand; the raw PDF becomes a secondary, candidate-controlled fallback. This is the moment the moat becomes visible to carriers.

**Files:**
- `src/components/employer/CredentialFactsPanel.tsx` (new) — renders attestations via `attestationService.verifyAttestation`, badge + issued date + CRA citation, expandable details. Uses `HubSectionPanel` + `BlockCard` chrome (amber/teal accent per `ui-components.mdc`).
- `src/components/employer/CareerCardModal.tsx` — mount the panel; **demote** the PDF view to a fallback link. Keep all existing talent/request behavior intact (I-8).
- Map `FactType` → panel rows (the "Add a UI mapping" step from the fact-registry rules).
- Dark-mode + empty-state ("No verified facts yet — request a screening") handled.

**Verification:** Pace employer opens a candidate card → sees fact panel, not a PDF dump; talent search + request buttons still work; verified badge only on third-party facts. Incognito + Pace-account smoke. Build + lint green.

**Commit:** `feat(attestation): carrier credential facts panel (P2.5)`

<details><summary><strong>📋 Auto prompt — copy-paste (P2.5)</strong></summary>

```text
TASK: Execute step P2.5 — "carrier CredentialFactsPanel" — from docs/midnight/EXECUTION_CHECKLIST.md (Phase 2). PACE-CRITICAL (I-8).

FIRST read: .cursor/rules/attestation-architecture.mdc ("Don'ts" — facts before PDFs), .cursor/rules/ui-components.mdc (HubSectionPanel + BlockCard chrome), and the Pace invariants table in EXECUTION_CHECKLIST.md (I-8 CareerCardModal). Confirm in context.

PRE-CONDITIONS: P2.4 verify route live. Pace has been briefed on fact panels (check-in cadence).

GROUND RULES:
- This touches CareerCardModal.tsx — a Pace-critical file (I-8). Preserve ALL existing talent-view + request-button behavior. The panel is ADDITIVE; the PDF is demoted to a fallback, not deleted.
- Verified badges ONLY for third_party facts (provenance gate). Self-reported sections stay "submitted/on file" with no badge.
- Render via attestationService (registry import) — NEVER read block_* tables in this component.
- Use HubSectionPanel + BlockCard chrome; full dark-mode + empty state.
- After the change, manually verify a Pace employer can still: open a candidate card, run talent search, and use request buttons.

BUILD: src/components/employer/CredentialFactsPanel.tsx; wire into CareerCardModal.tsx; FactType→row UI map.

VERIFY: Pace-account + incognito smoke (card opens, facts render, requests work, PDF still reachable as fallback). npm run build + lint green.

DOCS: docs/CHANGES.md P2.5 entry (panel + PDF demotion + I-8 preserved). Set P2.5 Status + handoff row noting Pace verification done.

COMMIT: feat(attestation): carrier credential facts panel (P2.5)
```

</details>

---

### P2.6 — Candidate per-audience disclosure toggles
| | |
|---|---|
| Status | ✅ Done · 62b8b2b · 2026-06-05 |
| Pre-conditions | P2.5 |
| Pace risk | Low — candidate-side UI + scoped reads |

**Goal:** Let the candidate control **which carrier sees which facts** — the selective-disclosure surface from the candidate's side. Drives the `audienceId` narrowing in `proveFact`.

**Files:**
- Migration `0NN_disclosure_preferences.sql` — `disclosure_preferences (candidate_user_id, audience_id, fact_type, allowed bool)` + RLS (candidate owns own rows).
- Candidate UI (new block surface or career-card setting) — per-audience fact toggles using `HubSectionPanel`/`BlockCard`; state in a Zustand store (per `state-standards.mdc` — no `useState` for shared data).
- `proveFact` honors the preference: refuse / narrow `disclosedFields` when a fact is toggled off for that audience.

**Verification:** Toggle a fact off for a carrier → that carrier's `verify` no longer sees it; candidate's own view unaffected. Build + lint + test green.

**Commit:** `feat(attestation): candidate per-audience disclosure toggles (P2.6)`

<details><summary><strong>📋 Auto prompt — copy-paste (P2.6)</strong></summary>

```text
TASK: Execute step P2.6 — "candidate per-audience disclosure toggles" — from docs/midnight/EXECUTION_CHECKLIST.md (Phase 2).

FIRST read: .cursor/rules/attestation-architecture.mdc ("Audience scoping"), .cursor/rules/state-standards.mdc, .cursor/rules/ui-components.mdc. Confirm in context.

PRE-CONDITIONS: P2.5 carrier panel live.

GROUND RULES:
- Selective disclosure is candidate-controlled. Default posture: a fact is shareable unless toggled off; every share remains candidate-initiated.
- State in a Zustand store, not useState (shared/persisted). 
- proveFact must honor the toggle: when allowed=false for (candidate, audience, fact), refuse or omit from disclosedFields.
- Additive migration + RLS (candidate owns rows).

BUILD: migration 0NN_disclosure_preferences.sql; candidate toggle UI (HubSectionPanel/BlockCard); store; proveFact enforcement.

VERIFY: toggling off hides the fact from that audience's verify result only; build + lint + test:app green.

DOCS: docs/CHANGES.md P2.6 entry. Set P2.6 Status + handoff row. Note manual migration apply.

COMMIT: feat(attestation): candidate per-audience disclosure toggles (P2.6)
```

</details>

---

### P2.7 — "Verified by Storm" language + Stormi/journey wiring
| | |
|---|---|
| Status | ✅ Done · a0e0248 · 2026-06-05 |
| Pre-conditions | P2.6 |
| Pace risk | None — copy + Stormi context |

**Goal:** Land the honest Phase-2 verification language and teach Stormi about attestations. Per the language rules: present-tense "Verified by Storm on [date]" + CRA citation; **never** "verified on-chain" / "ZK" until Phase 3.

**Files:**
- Verification copy + the `formatAttestationProvenance()` helper (DEC-2026-05-011 citation rule) so provenance strings aren't scattered.
- `src/lib/ava-context.ts` — Stormi knows what an attestation is and can nudge candidates to verify third-party facts ("Employers in your area request CDL verification 73% of the time").
- Journey: add an attestation completion signal to `journey-progress.ts` if a "first verified fact" milestone fits.
- Sweep stale "blockchain-verified" copy on self-reported surfaces (the `PROJECT_ROADMAP.md` Phase-1 language-cleanup item lives here).

**Verification:** `rg -i "verified on-chain|zk proof|blockchain.verified" src/` → 0 on self-reported surfaces. Stormi references verification correctly. Build green.

**Commit:** `feat(attestation): verified-by-storm language + Stormi wiring (P2.7)`

<details><summary><strong>📋 Auto prompt — copy-paste (P2.7)</strong></summary>

```text
TASK: Execute step P2.7 — "Verified by Storm language + Stormi wiring" — from docs/midnight/EXECUTION_CHECKLIST.md (Phase 2). Closes Phase 2.

FIRST read: .cursor/rules/strategic-direction.mdc ("Language rules"), .cursor/rules/product-philosophy.mdc (verification = the moat), DECISION_LOG DEC-2026-05-011 (CRA citation) + DEC-2026-05-016 (narrative vs interaction). Confirm in context.

PRE-CONDITIONS: P2.6 done.

GROUND RULES:
- Phase-2 copy is "Verified by Storm on [date]" + CRA citation. NEVER "verified on-chain" / "ZK" / "Midnight-proven" on a per-fact basis (Phase 3 honesty constraint).
- Only third_party facts get "verified" language; self-reported stays "submitted / on file".
- Centralize provenance strings in formatAttestationProvenance() — don't scatter ad-hoc copy.

BUILD: formatAttestationProvenance() helper; verification UI copy; Stormi context in ava-context.ts; optional journey milestone in journey-progress.ts; sweep stale "blockchain-verified" copy on self-reported surfaces.

VERIFY: rg -i "verified on-chain|zk proof|blockchain.verified" src/ → 0 on self-reported surfaces; Stormi references verification correctly; build green.

DOCS: docs/CHANGES.md P2.7 entry. Set P2.7 Status + handoff row. If P2.1–P2.7 all done, add "Phase 2 — Selective disclosure COMPLETE" to the Where-we-are snapshot and flip the active marker to Phase 3 (trigger-gated).

COMMIT: feat(attestation): verified-by-storm language + Stormi wiring (P2.7)
```

</details>

---

## Phase 3 — Midnight ZK (active track, GTM-driven)

### North star — three audiences, one product (DEC-2026-06-003)

Storm is built for **three audiences at once** — not a single "join our platform" pitch:

| Audience | What they get | Must they "join" Storm? |
|---|---|---|
| **Candidates** | Own their DQ file, career card, selective disclosure, Stormi | No — they sign up; the product is theirs |
| **Companies like Pace** | Full employer hub: pipeline, screening, talent, blocks | Yes — tenant on the platform (design partner wedge) |
| **Companies that won't leave their stack** | ZK proofs via Proof Requests — keep Checkr/DISA/Accio, get a verify link | **No** — no tenancy, no CRA switch, no SDK; carrier submits a request, driver signs, Storm delivers a cold-verifiable proof |

The third row is the scale path beyond Pace. Interop over displacement: we don't ask anyone to ditch their supplier; we prove facts *about* what their supplier already pulled (once consent + ingestion path allow). Midnight makes row 3 real — a verify link that works without trusting Storm's database or account.

Phase 3 swaps the signed-JWT attestation implementation for **Midnight ZK proofs behind the same `attestationService` interface** — the carrier-facing UX doesn't change, only the proof backend. **This is an active track** (DEC-2026-06-001): the driver is go-to-market — being an early *real* regulated-industry use case on Midnight — not waiting for a customer to demand non-repudiation. Build it end-to-end and genuine; ship nothing fake (the quality bar is in `strategic-direction.mdc` → "Phase 3 is an active track").

### Why Midnight is load-bearing here (read before building — DEC-2026-06-002)
Storm is a **late entrant with no network**. A signed JWT requires the verifier to *trust Storm* (Storm holds the key). A **Midnight ZK proof lets any carrier trust the math** — verifiable cold, no Storm account, no network membership. That **network-independent portable trust** is the mechanism by which a driver-owned fact beats a 20-year carrier network (Tenstreet/Xchange). The chain isn't decoration; it's the answer to "how do we win without their network." Positioning + funding context lives in `MOAT_THESIS.md` (driver-side-counterpart + agency-funded sections). It's also what makes the **Phase 3c Proof Request rail** (any carrier, any CRA — DEC-2026-06-003) deliverable as a bare verify link instead of an integration.

> **Engineering invariant for ALL Phase 3 code (DEC-2026-06-003):** `source_cra` flows through every layer — fact registry → attestation → proof artifact → verify surface. **Never assume Accio.** Today's only adapter is Accio; the rail is CRA-agnostic by design and new CRAs (Checkr, DISA) are registry-entry adapters, not architecture changes.

### Funding model (DEC-2026-06-002) — affects which facts to prove first
Candidate-**controlled**, agency-**funded**. Drivers won't pay to screen themselves; Pace/the carrier funds the pull, the driver owns the portable fact. Two paths, in risk order:
- **(a) Driver's-own-records, agency-sponsored — START HERE.** Driver obtains own records by right (FMCSA PSP ~$10, state MVR), Pace sponsors the fee. Lower FCRA risk (consumer presenting own data ≠ CRA report). Value = portable pre-qual/speed signal.
- **(b) Funded-pull-becomes-portable — GATED.** Structure consent at the moment of pull so derived facts become portable. Bigger prize; **requires a formal FCRA opinion** before build/market (DEC-2026-05-013).

### Phase 3a — core ZK slice (build first)

| Step | What | Status |
|---|---|---|
| **P3.1** | WSL2 + Ubuntu + `.wslconfig` + Compact compiler + Cursor-in-WSL smoke test | ✅ Done · 2026-06-09 · WSL Ubuntu-24.04, repo `~/dev/resume-wallet`, compact 0.5.1 + compiler **0.31.0** (needed `unzip` for `compact update`) |
| **P3.2** | Proof server spike (Docker) + server-managed Midnight wallet | ✅ Done · 2026-06-10 · preflight all green |
| **P3.3** | One-fact testnet slice (`mvr_clean_36_months`) via `midnight-attestation-service.ts` — **anchor only 🟡** | ✅ Done · 2026-06-17 · contract `6c3f0ea8…fea49cf` deployed to Preprod; first ZK attestation proven (tx `0024edbc…0e265a`, attestation `6bc932c7…7d4ad4`) |
| **P3.4** | **Real predicate proof for `mvr-clean-36` (anchor 🟡 → real 🟢)** — predicate + provenance. **Mandatory** (delivers the moat; CIRCUITS.md). Predicate track **unblocked**; 🟢 provenance **pending Key/Accio signing** | 🟡 |
| **P3.5** | Broaden fact registry + circuits — replicate the **real** predicate pattern across shipped facts | ⬜ |
| **P3.6** | Honesty gate: per-fact "proven on Midnight" only when proof runs (DEC-2026-05-004) | ⬜ |
| **P3.7** | **Verified DQ-file assembly** — proven facts prefill + lock the DOT app; headline "Verified" (once a **majority** of risk-bearing fields are issuer-backed) with honest per-field badges. The **use-case payoff** (consumes 3a facts; MVR→Form 1 slice can start on P3.4-A) | ✅ Core shipped (DEC-2026-07-001) |

#### P3.1 — WSL2 + Compact toolchain smoke test (START HERE)

**Goal:** Know within ~2 hours whether WSL2 + Cursor is tolerable on your box — or you need a Mac. **Pass = `compact --version` in WSL + Cursor opened on the WSL repo path.**

**Pre-condition:** Windows 11, 64GB RAM (`.wslconfig` at `%USERPROFILE%\.wslconfig` with `memory=32GB` — updated 2026-06-09).

**Do in order (human steps marked 👤 — require admin/reboot/UI):**

1. 👤 **Install WSL2 + Ubuntu** (PowerShell **as Administrator**):
   ```powershell
   wsl --install -d Ubuntu
   ```
   Reboot if prompted. First launch: create Linux username/password.

2. 👤 **Apply `.wslconfig`** (already at `C:\Users\blaha\.wslconfig`):
   ```powershell
   wsl --shutdown
   ```
   Then reopen Ubuntu from Start menu.

3. **Inside Ubuntu** — base packages + git:
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y build-essential curl git ca-certificates
   ```

4. **Clone repo in WSL filesystem** (NOT `/mnt/c/` — keep I/O fast, keep AI in one loop):
   ```bash
   mkdir -p ~/dev && cd ~/dev
   git clone <your-remote-url> resume-wallet
   cd ~/dev/resume-wallet
   ```
   Use the same GitHub remote as `C:\Users\blaha\Desktop\resume-wallet`. Work from this clone for Phase 3; the Windows copy can stay as backup until you commit to WSL.

5. **Install Compact compiler** ([Midnight Windows guide](https://docs.midnight.network/guides/windows-compact-setup)):
   ```bash
   curl --proto '=https' --tlsv1.2 -LsSf \
     https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
   source ~/.bashrc
   compact --version
   compact update
   ```

6. 👤 **Open project in Cursor via WSL:**
   - Cursor → Command Palette → **"WSL: Connect to WSL"** (or **"WSL: Open Folder in WSL"**)
   - Open `~/dev/resume-wallet`
   - Integrated terminal should show Linux (`uname -a` → Ubuntu). Agent + terminal now share one environment.

7. **Verification (pass/fail for "do I hate WSL?"):**
   ```bash
   uname -a                    # Linux
   pwd                         # /home/<you>/dev/resume-wallet
   compact --version           # devtools, e.g. 0.5.1
   compact compile --version   # compiler, e.g. 0.31.0 — NOT "No default compiler set"
   ```
   **Gotcha:** `compact update` unpacks with **`unzip`** — install `sudo apt install -y unzip` if update fails at "Failed to spawn artifact extraction command".
   Optional stretch: `create-mn-app` Hello World per Midnight docs — not required for P3.1 pass.

**If P3.1 fails:** proof server OOM → raise `.wslconfig` `memory=` (64GB host: default is `32GB`; can try `40GB`), `wsl --shutdown`, retry. Sluggish I/O → confirm repo is under `~/`, not `/mnt/c/`. Cursor blind to WSL → you opened `C:\` path instead of WSL folder — reconnect via step 6.

#### P3.2 — Proof server spike (Docker) + server-managed wallet

| | |
|---|---|
| Status | ✅ **Done 2026-06-10** — proof server HTTP 200, Preprod wallet funded, `npm run midnight:preflight` all ✓ |
| Pre-conditions | P3.1 ✅ |
| Pace risk | None — no app routes touched |

**Goal:** Run Midnight's proof server locally via Docker and document the server-managed wallet env vars Storm will use in P3.3. Pass = `curl http://localhost:6300/health` returns 200 + wallet mnemonic funded on Preprod faucet.

**Repo artifacts (shipped this session):**
- `midnight/docker-compose.yml` — `midnightntwrk/proof-server:8.0.3`, port 6300, 8GB mem cap
- `scripts/midnight-proof-server-health.sh` + npm scripts `midnight:proof-server:*`
- `docs/midnight/MIDNIGHT_ENV.md` — `MIDNIGHT_WALLET_MNEMONIC`, RPC/indexer URLs, proof server URL

**Do in order (human steps marked 👤):**

1. 👤 **Install Docker Desktop for Windows** — https://www.docker.com/products/docker-desktop/
   - Check **Use WSL 2 instead of Hyper-V** during install.
   - Docker Desktop → Settings → Resources → WSL Integration → enable **Ubuntu-24.04**.
   - Restart WSL after install: `wsl --shutdown` (PowerShell), reopen Ubuntu.

2. **Verify Docker from WSL:**
   ```bash
   docker --version
   docker compose version
   ```

3. **Start proof server:**
   ```bash
   cd ~/dev/resume-wallet
   npm run midnight:proof-server:up
   npm run midnight:proof-server:health   # expect HTTP 200
   ```

4. **Server-managed wallet (dev Preprod):**
   - Create a **dedicated** dev wallet (Lace extension or fresh mnemonic) — not a personal wallet.
   - Add to `.env.local` per `docs/midnight/MIDNIGHT_ENV.md`:
     ```
     MIDNIGHT_NETWORK=preprod
     MIDNIGHT_PROOF_SERVER_URL=http://127.0.0.1:6300
     MIDNIGHT_NODE_RPC_URL=https://rpc.preprod.midnight.network
     MIDNIGHT_INDEXER_URL=https://indexer.preprod.midnight.network/api/v3/graphql
     MIDNIGHT_WALLET_MNEMONIC="word1 word2 word3 ... word24"
     ```
     Spaces between words, no commas. **Quotes required** in `.env.local` — without them dotenv only loads the first word.
   - Fund via https://faucet.preprod.midnight.network/

5. **Verification (pass/fail for P3.2):**
   ```bash
   npm run midnight:preflight              # all ✓ (proof server + env + mnemonic)
   npm run midnight:proof-server:health    # HTTP 200
   docker ps --filter name=storm-midnight-proof-server  # running
   ```
   Wallet funded on Preprod faucet (manual check in Lace). Preflight treats **port 6300 in use + HTTP 200** as healthy (not a failure).

**Gotchas:**
- Proof server OOM under WSL → raise `.wslconfig` `memory=` or `mem_limit` in compose; `wsl --shutdown`, retry.
- Port 6300 taken by proof server → **expected** when container is up; `npm run midnight:preflight` checks `/health` instead of treating occupied port as failure.
- `docker: command not found` in WSL → Docker Desktop not installed or WSL integration disabled.
- `protocol not available` on `docker info` → wrong context: `docker context use default` (not `desktop-linux` in WSL bash).
- `permission denied` on `docker.sock` → `sudo usermod -aG docker $USER`, then `newgrp docker` or new terminal.

**Commit:** `feat(midnight): proof server docker compose + env docs (P3.2)`

**Next (P3.3):** `midnight-attestation-service.ts` + `mvr_clean_36_months` one-fact Preprod slice.

> **Why P3.3–P3.6 were stubs until now:** Phase 3a steps were written **just-in-time** — P3.1 de-risked WSL/Compact, P3.2 de-risked Docker/proof-server/wallet env. Writing Compact circuit + wallet SDK steps before those passed would have been guesswork (wrong compiler flags, wrong proof-server URL, wrong indexer version). **P3.2 ✅ → expand the runbook below.** Phase 3b/3c/4 stay strategic until P3.3 verifies — their circuit and ops costs depend on the one-fact slice.

#### P3.3 — One-fact Preprod slice (`mvr_clean_36_months`)

| | |
|---|---|
| Status | ✅ **Done 2026-06-17** — contract `6c3f0ea8…fea49cf` deployed to Preprod; first ZK attestation proven (tx `0024edbc…0e265a`, attestation row `6bc932c7…7d4ad4`) |
| Pre-conditions | P3.2 ✅ · Phase 2 attestation stack ✅ (`signed-jwt-attestation-service.ts`, `fact-registry.ts`, `attestations` table, `attestation-service-registry.ts`) |
| Pace risk | **Low** if limited to new libs + scripts + env-gated registry swap — **do not touch** Accio/screening pipeline |
| DO NOT TOUCH | `src/lib/place-screening-order.ts`, `src/lib/accio-*`, `src/lib/reconcile-pending-screenings.ts`, `src/app/api/employer/screenings/**`, MVR/PSP webhook routes |

**Goal:** First **real** Midnight proof for one third-party fact on Preprod. Pass = with `ATTESTATION_BACKEND=midnight`, `proveFact({ factType: 'mvr_clean_36_months' })` returns `{ kind: 'midnight_zk', txHash, proofId }` and `verifyAttestation()` succeeds independently of Storm DB trust.

**Read first:**
- `.cursor/rules/attestation-architecture.mdc` — interface + registry swap
- `src/lib/fact-registry.ts` → `proveMvrClean36Months` (data source for circuit inputs)
- `docs/midnight/MIDNIGHT_ENV.md` — env + DUST
- Midnight MCP (`midnight-compile-contract`, `midnight-search-docs`) when stuck on Compact syntax

**Do in order:**

1. **Compact circuit (`compact/mvr-clean-36/`):**
   - Minimal circuit: private inputs derived from resolved MVR material; public output = boolean clean / not clean for 36-month window
   - `compact compile` in WSL; commit Compact source; gitignore heavy artifact dirs if needed
   - **Invariant:** `source_cra` + `sourcePullId` live in attestation metadata (`ResolvedAttestationFact`) — not hardcoded to Accio in midnight libs

2. **Midnight provider lib (`src/lib/midnight/`):**
   - `midnight-config.ts` — reads `MIDNIGHT_*` server-side only
   - `midnight-wallet.ts` — HD wallet from mnemonic; connects to Preprod RPC, indexer v4, local proof server
   - npm script `midnight:wallet:status` — log tNIGHT balance + tDUST tank (dev visibility, no secrets in output)

3. **Programmatic DUST registration (one-time per server wallet):**
   - `scripts/midnight-register-dust.ts` — server equivalent of Lace "Generate tDUST"
   - Idempotent where SDK allows; document in `MIDNIGHT_ENV.md`
   - **Pass:** script reports DUST registration + non-zero capacity

4. **`src/lib/midnight-attestation-service.ts`:**
   - Same `AttestationService` interface as signed-JWT impl
   - `proveFact`: `resolveAttestationFact()` → circuit witness → proof server → submit tx → insert `attestations` row with `{ kind: 'midnight_zk', txHash, proofId }`
   - `verifyAttestation`: validate via proof server / chain — not "trust the DB row"
   - Reuse persistence patterns from `signed-jwt-attestation-service.ts` (immutable rows, supersede, audience scoping)

5. **Registry swap (`attestation-service-registry.ts`):**
   - Wire `createMidnightAttestationService()` when `ATTESTATION_BACKEND=midnight`
   - **Default stays `signed-jwt`** — local flip only until hosted proof server exists

6. **Dev prove CLI:**
   - `scripts/midnight-prove-fact.ts --fact mvr_clean_36_months --user <uuid>`
   - Requires test user with completed Accio MVR in DB (existing `proveMvrClean36Months` path)
   - Log **txHash, proofId, DUST cost** — first ops benchmark

7. **Tests:**
   - Unit: registry backend selection, proof artifact shape, config validation
   - Optional integration (`MIDNIGHT_INTEGRATION=1`): full prove path — skip in CI until Preprod secrets exist

8. **Verification (pass/fail for P3.3):** ✅ **PASSED 2026-06-17**
   ```bash
   npm run midnight:preflight
   npm run midnight:proof-server:health
   npm run midnight:register-dust                    # once per wallet
   npm run midnight:deploy                            # contract → 6c3f0ea8…fea49cf
   npm run midnight:prove-fact -- --user 0897bf34-7d86-48f0-a35a-5315a770c2c8
   ```
   Result: tx `0024edbc…0e265a` on Preprod; `attestations` row `6bc932c7…7d4ad4` persisted with `proof_artifact.kind='midnight_zk'`, `disclosed_fields` = verification window only (no violations/PII), `source_cra='accio'` + `source_pull_id` cited. **Proof latency ~10 min on a cold sync** (Docker-restart cleared warm state); the new disk wallet-state cache (`.wallet-cache/<network>.json`) makes subsequent runs incremental.

**Gotchas:**
- Proof server is **local Docker** for dev — `MIDNIGHT_PROOF_SERVER_URL=http://127.0.0.1:6300` won't work on Vercel until Cloud Run/Render host is up
- Provenance gate still applies — self-reported facts never enter Midnight path
- NIGHT stays as DUST backing; fees spend **tDUST**, not tNIGHT
- Lauren Lee / ecosystem milestone = **this step verified on Preprod**, not P3.2
- **Indexer v4** — use v4 URLs per compatibility matrix (no v3 downgrade)
- **Preprod DUST sync errors** — `Could not deserialize Ledger Event` / `midnight:event[v9]` is usually **WASM OOM**, not wrong ledger version ([servicedesk#42](https://github.com/midnightntwrk/servicedesk/issues/42)). Runtime sets `batchUpdates: { size: 5000 }` on wallet-sdk 4.x
- **Lace mnemonic → full BIP39 seed** — `HDWallet.fromSeed(mnemonicToSeedSync(phrase))` (64 bytes); **must** match Lace → Receive → **Unshielded** (`npm run midnight:wallet:address`). Do not use `.subarray(0, 32)` — that was a wrong read of lace#2133 for Chrome extension
- **Iterator Helpers polyfill** — the SDK calls `.entries().filter()/.map()/.find()/.toArray()` directly on `Map`/`Set` iterators (e.g. `tx.imbalances(0).entries().filter(...)`), native only on Node 22+. On Node 20 deploy throws `tx.imbalances(...).entries(...).filter is not a function`. Fixed once via `midnight/runtime/src/iterator-helpers.ts` (polyfills `%IteratorPrototype%`), imported first in `config.ts`. Replaces the old per-file `Array.from` postinstall patch (fragile, missed call sites, lost on reinstall)
- **Single WASM instance is load-bearing** — the compiled contract imports `@midnight-ntwrk/compact-runtime`; it MUST resolve to the **same** `node_modules` (same `onchain-runtime-v3` WASM) as `compact-js`, or deploy throws `expected instance of ContractMaintenanceAuthority`. A symlinked artifact dir resolves to a 2nd WASM copy under tsx and fails. **Fix:** compile the artifact INTO `midnight/runtime/managed/mvr-clean-36/` (inside the runtime package — `ZK_CONFIG_PATH`), source `.compact` stays in `compact/mvr-clean-36/`. No symlink.
- **Toolchain versions** — pin `compact-js@2.5.1` + `compact-runtime@0.16.0` to match the compiler `runtime-version` (`contract-info.json`); deploy uses `{ compiledContract, args: [] }` like the hello-world example
- **First wallet sync is RAM-heavy** — npm scripts set `NODE_OPTIONS=--max-old-space-size=16384`; raise WSL `.wslconfig` memory if OOM persists
- **`MIDNIGHT_PRIVATE_STATE_PASSWORD`** — required for deploy/prove (encrypts LevelDB private state); not needed for `midnight:wallet:address`

**Commit:** `feat(midnight): one-fact attestation service on Preprod (P3.3)`

**Next (P3.4):** deepen `mvr-clean-36` from anchor 🟡 → real predicate proof 🟢 (CIRCUITS.md).

#### P3.4 — Real predicate proof for `mvr-clean-36` (anchor 🟡 → real 🟢)

| | |
|---|---|
| Status | 🟡 **In progress** — P3.4.0 local research ✅; Key/Accio vendor review pending; **predicate build unblocked** |
| Pre-conditions | P3.3 ✅ |
| Pace risk | Low — additive circuit work; no screening pipeline changes |

**Why mandatory:** P3.3 shipped a *commitment anchor* — no `witness`, no `assert`; the "clean" boolean is still computed **off-chain** in `fact-registry.ts`. That does **not** deliver the moat (DEC-2026-06-002): a verifier still trusts Storm's DB, not the math. The "proven on Midnight" per-fact claim (P3.6) and any foundation conversation require **≥1 genuine predicate proof with cold-trustless provenance (🟢)**. Full design: `CIRCUITS.md` → `mvr-clean-36 (target)`.

**Two tracks — do not wait idle on Key:**

| Track | What | Status | Blocks 🟢? |
|---|---|---|---|
| **P3.4-A Predicate** | Witness + violation-loop circuit + negative tests + wire prove pipeline | ✅ **Smoke verified Preprod** | No — delivers real ZK math over private MVR data |
| **P3.4-B Provenance** | In-circuit `verifySignature(craPublicKey, record.bytes, craSignature())` | ⏸ **Pending Key/Accio** | Yes — cold-trustless verification requires issuer signing |

**Interim honesty status (P3.4-A without P3.4-B):** predicate proof + metadata citation (`source_cra='accio'`, `source_pull_id`, order #, pull date). Label: **"Verified by Storm — sourced from Key/Accio order #X"**. Not 🟢. Do **not** attach per-fact "proven on Midnight / trust the math not Storm" until P3.4-B lands (DEC-2026-05-004).

---

#### P3.4.0 — Issuer-signing research + Key/Accio vendor ask

| | |
|---|---|
| Status | 🟡 **Local research ✅ · vendor review pending** |
| Owner | Sam → Lana (Key Background), CC Ryan (Accio) |

**Local research (done 2026-06-18):** Inspected **339** stored `mvr_orders.result_xml` payloads in Supabase + repo fixtures.

| Pattern searched | Matches |
|---|---|
| `SignedInfo`, `DigestValue`, `X509`, `xmlsig`, `ds:Signature` | **0 / 339** |
| `hash`, `digest`, `HMAC`, `RSA` (crypto context) | **0** |

**Finding:** Accio webhook XML carries structured MVR data (`<text>`, `<mvr_license>`, `<mvr_violation>`, order metadata, `reportURL` links) but **no cryptographic signature over the report**. The XML fields `signatureText` / `signatureDate` are **empty applicant-consent placeholders** on the `<subject>` block — not a signature *on* the MVR report.

**Conclusion:** Today's integration path cannot support in-circuit issuer verification. Cold-trustless provenance requires Key/Accio to **add** signing (or expose a signed channel we don't receive today).

**Vendor outreach (done 2026-06-18):**
- Sam called **Lana (Key owner)** — receptive; asked for written ask to share with Accio.
- Email sent to Lana, **CC Ryan (Accio)**. Ask summary:
  - **One signature per report** (MVR or PSP pull), **not per derived fact** — a single signed MVR enables many facts (clean 36 months, Class A, endorsements, etc.).
  - **MVR + PSP are today's products**; ideally signing is a **platform-level Accio capability** covering any result type Key delivers (future report types don't require re-negotiation).
  - Preferred deliverable: detached signature over canonical result bytes + published public key; signed JSON projection of structured fields acceptable if easier than raw XML (Accio tag order varies).
  - Storm is **not** asking Key to change screening workflow or become a blockchain company — just a tamper-evident seal on reports Key already delivers.
- **Key response (2026-06-18):** reviewing internally; will discuss with Accio on technical, compliance, data-provider, and platform considerations; will circle back. **Not a no** — treat as pending vendor decision.

**Longer-term context (not in vendor email):** Storm's north star is a **composed DQ file** from verifiable facts. Accio/Key can only sign what flows through Accio (MVR, PSP, possibly employment verification). Other DQ components (med card from examiner, self-reported DOT app) have different issuers or fail the provenance gate — see `CIRCUITS.md` + DEC-2026-05-014.

**When Key/Accio responds — record in `DECISION_LOG.md`:**

| Answer | Action |
|---|---|
| **Yes — signed artifact** (XML/PDF/API) | Record pubkey source + signed-byte format → unblock **P3.4-B** → wire `verifySignature` → flip `CIRCUITS.md` 🟡→🟢 |
| **Yes — PDF only** | Assess machine-verifiable; human-only PDF is secondary |
| **No / not feasible** | Log limitation; P3.4-A ships with metadata provenance; per-fact Midnight claims stay off |
| **Roadmap / timeline** | Log ETA; continue P3.4-A + P3.5 plumbing in parallel |

**Follow-up (optional, low pressure):** short reply thanking Lana; offer technical call with Ryan; no rush on evaluation.

---

**P3.4-A — Predicate circuit (START NOW — not blocked on Key):**

1. ✅ **Witness shape** — `src/lib/mvr-clean-predicate.ts` (32 fixed slots, YYYYMMDD ints, v1 taxonomy = any dated violation in window). Builder reads `block_driver_mvr.violations` (parsed Accio data).
2. ✅ **Predicate constraint** — `compact/mvr-clean-36/mvr-clean-36.compact` loops 32 slots; `assert` no active violation inside public `[windowStart, windowEnd]`. Taxonomy v1 mirrors `fact-registry.ts` (not full ACD disqualifying-code list yet).
3. ✅ **Disclosure** — `disclose()` only boolean + commitment; violations stay in witness.
4. ✅ **Replay / freshness** — public `asOfDate` + `usedPullNullifiers` ledger Map; commitment includes `asOfDateYmd`; off-chain guards in `midnight-prove-guards.ts`. **Redeploy required** (ABI change vs `2b7032a6…`).
5. ✅ Wire witness through `midnight-prove-bridge` → `prove-on-chain.ts` → `midnight-attestation-service.ts` (+ unit tests).
6. ✅ **Provenance (interim)** — cite `source_cra='accio'` + `source_pull_id` in attestation metadata; **no** in-circuit signature yet.
7. ✅ **FCRA isolation gate (2026-06-25)** — `getMvrAttestationContext` requires **driver-owned** completed MVR (`ordered_by_company_id IS NULL`); loads violations from `mvr_results` when block cache points at a company pull. `process-mvr-accio-webhook` only syncs `block_driver_mvr` for driver-owned orders (matches existing PSP webhook). Candidate `fulfill-screening` passes `ownership: 'driver'` → portable pull even when employer requested + may fund. Shared helper: `src/lib/screening-order-ownership.ts`. **Build assumption pending counsel** (DEC-2026-06-005). **Backfill script:** `npm run midnight:supersede-pace-tests` (2026-07-29).

**Redeploy:** ✅ Done — contract `2b7032a622c339a1494265812064df28a9e708da330be3e0a4e50856eea54cdb` (replaces P3.3 anchor `6c3f0ea8…`).

**Smoke:** ✅ **2026-06-22** — `npm run midnight:prove-fact -- --user 0897bf34-…`
- **Tx:** `009847a58f3be2957801edf90def5877e62e54a79ce1ffbe5ea80e77d7683ea2cc`
- **Attestation:** `167040f7-dfd5-4d3d-b15c-53b6c09b83bc` — `proof_artifact.kind='midnight_zk'`; P3.3 row `6bc932c7…` superseded
- **Circuit:** `proveCleanMvr` with 32-slot violation witness (empty violations = clean record)

**Operator smoke (2026-07-30):** ✅ Redeployed freshness contract `fb46c572…2465e`; supersede Pace rows; driver-owned prove tx `00a2f520…306635` (attestation `7caadb3c-…`, Michael Hardin); replay blocked off-chain; violation negative blocked off-chain. Overall P3.4 stays 🟡 until P3.4-B issuer signature.

**Negative smoke:** ✅ **2026-06-22** — `061d7eeb-…` (violation 2025-02-20 inside window) rejected **before** on-chain prove: `Moving violations found within the 36-month verification window — cannot attest clean MVR`. No tx submitted.

**P3.4-B — Provenance signature (when Key/Accio delivers):**

1. **`assert verifySignature(craPublicKey, record.bytes, craSignature())`** in-circuit. `craPublicKey` is public input.
2. Negative test: proof **fails** on invalid/absent CRA signature.
3. Flip `CIRCUITS.md` entry 🟡 → 🟢; unlock per-fact "proven on Midnight" honesty (P3.6).

**Verification (negative tests mandatory — soundness is the point):**
- ✅ Proof **blocked off-chain** when MVR has in-window violation (`061d7eeb-…`, 2026-06-22) — no tx submitted.
- Proof **fails** when CRA signature invalid or absent *(after P3.4-B)*.
- ✅ Proof **passes** for genuine clean record (`0897bf34-…`); `disclosed_fields` contain no violations/PII.

**What's blocked vs not (while Key reviews):**

| Work | Blocked? |
|---|---|
| In-circuit Accio signature + 🟢 cold-trustless provenance | **Yes** |
| Per-fact "proven on Midnight" marketing claims | **Yes** (until 🟢) |
| Predicate circuit + witness builder + negative tests | **No** |
| Shared prove plumbing (feeds P3.5) | **No** |
| P3.6 honesty gate UI/copy (claims stay gated) | **No** |
| Phase 3b/3c design | **No** |

**Commit (split if vendor lags):**
- `feat(midnight): mvr-clean-36 predicate circuit (P3.4-A)` — predicate only, interim provenance
- `feat(midnight): mvr-clean-36 issuer signature in-circuit (P3.4-B)` — when Key delivers

**Next:** P3.4-A step 4 (replay/freshness) + negative prove smoke; await Key for P3.4-B.

> **🟢 Key response 2026-06-25 — positive / conditional (soft yes).** Lana Iklodi (President, KBS) reviewed internally: *"concept has merit and is worth exploring further."* **No commitment to build yet** — they want the **business case, workflow, and long-term vision** before scoping dev (confirms the predicted gate: roadmap/priority, **not** capability). Key's stated model: certification applies to the report **as of its completion date/time**, tied to that **screening event**; re-accessing/copying does **not** refresh the cert; a new cert only on a **new order** — this is **exactly our freshness/replay model** (P3.4-A step 4, DEC-2026-06-004 §5). Key proactively raised **monitoring** (90/180/365-day re-pulls → recurring certified snapshots + history) — aligns Key's revenue incentive with ours (DEC-2026-05-013 continuous-DQ). **Ball in our court:** answer Lana's 7 questions in the **driver-owned / agency-funded** frame (DEC-2026-06-005), without committing Key to anything pending the FCRA counsel review. Two of her questions (how the cert is used post-generation; who orders monitoring pulls) touch the consumer-of-record question — keep answers consistent with driver-initiated ownership.

#### P3.4-B — Provenance options (ranked) + fallback if Key/Accio says no

**North star:** prove **as much as mathematically possible** and make **Midnight as load-bearing as possible**. Provenance — "this data genuinely came from the issuer" — is the layer that turns a predicate proof from "trust Storm" into "trust the math." Key signing is the *easiest* path, **not the only one**. Storm must not be single-vendor-blocked: if one provenance source fails, fall to the next without a rewrite. This is the wedge (DEC-2026-06-002) — treat it as a portfolio, not a bet.

**Why this is engineering-cheap for them but may stall:** signing a blob is trivial tech. If Key/Accio hesitates it'll be **data-provider contracts** (state/FMCSA redistribution terms), **compliance caution**, or **roadmap priority** — not capability. **Read their answer for the *reason*:** a data-agreement "no" is a hard no (pivot to options 2–3); a roadmap "no" is a soft no (nudge + build in parallel).

**Provenance source options — ranked by trust strength × independence:**

| # | Option | Provenance trust | Needs Key? | Honesty | When to use |
|---|---|---|---|---|---|
| 1 | **Issuer signature (Key/Accio)** | Math, cold-verifiable | **Yes** | 🟢 full | First choice — in flight. If they sign, **zkTLS not needed** for MVR/PSP. |
| 2 | **zkTLS / web proof** | Math + notary assumption | **No** | 🟢-ish (notary caveat) | If Key can't/won't sign — or as a parallel R&D bet. Storm fetches the report over TLS (we already do; `reportURL` exists) and proves "these bytes came from `keybackground.com` over a genuine TLS session." Provenance **without** Key's cooperation. |
| 3 | **Source-issuer pull (DMV / FMCSA PSP)** | Math, cold-verifiable (where issuer signs) | No (bypasses Accio) | 🟢 where available | Path (a) driver-obtained records. Some state DMVs issue certified/signed digital MVRs; FMCSA PSP is source-direct. Per-state/per-source work; aligns with driver-owns-data + lowers FCRA-reseller risk. |
| 4 | **Storm-attested provenance** | Trust Storm + Accio-as-CRA | No | 🟡 honest, **not** cold | Interim default (= Phase 2 signed-JWT). Predicate is real ZK; provenance is "received from Accio order #X on date Y." Ships today. **Never** carries a per-fact "proven on Midnight" claim. |
| 5 | **Alternate CRA adapter** | Depends on that CRA | No (different vendor) | 🟢 if they sign | `source_cra` is CRA-agnostic by design — a CRA that *does* sign (Checkr/DISA/…) becomes a registry-entry adapter, not a rewrite. Insurance against permanent Key no. |

**Hard invariant (do not break):** `source_cra` + provenance-method flow through every layer (fact registry → attestation → proof artifact → verify surface). No single vendor may hard-block the roadmap. The proof artifact must record **which** provenance method backed it, so the verify surface + honesty gate (P3.6) can render the right trust claim per fact.

**zkTLS — the platform provenance bet (DEC-2026-06-004), not desperation plan B:**
- **Why it's the bigger lever:** the north-star **composed DQ file** has a verifiable spine that is mostly HTTPS-delivered third-party data — MVR, PSP, **FMCSA Drug & Alcohol Clearinghouse**, **med cert via National Registry**, employment verification. An issuer-signature deal reaches only MVR/PSP; **zkTLS reaches all of them with no permission**, including sources no CRA would ever sign. Issuer signature (opt 1) is the *per-fact optimization* where reachable; zkTLS is the *load-bearing capability*.
- **Provenance generalizes, parsing does not:** zkTLS proves *transport* generically (one capability, all sources). Each source still needs its own parser/predicate (the `mvr-clean-predicate.ts` equivalent). New source = "no permission + write an adapter," not zero work.
- **De-risk spike (= critical path while Key reviews, NOT idle waiting):** pick a zkTLS/web-proof approach (TLSNotary-style MPC vs. TEE); prove "bytes X came from `host` over TLS on date D"; document the **notary trust assumption**, session→driver binding, proof size/latency, and **per-target TLS feasibility for the DQ spine** (MVR, PSP, Clearinghouse, National Registry — "it's HTTPS" ≠ "the scheme handles its TLS"). Output: go/no-go note in `DECISION_LOG.md` — **do not** wire into the pipeline until the spike clears.
- **Honesty tier (DEC-2026-05-004):** a zkTLS fact's trust basis is **"TLS cert + notary," not "issuer vouched."** The per-fact claim must say what was proven (served by `host` over TLS on `date`) and must not imply the issuer signed it. Provenance method recorded on the artifact; verify surface renders the tier.
- **Unilateral vs. cooperative:** zkTLS attests a vendor's channel without them — defensible (candidate's agent, candidate-authorized data we already receive; DEC-2026-05-011), but **leverage in the Key talk**, not a surprise to spring on Accio.

**ZK facts as the pre-screen tier (the "middle ground"):** ZK facts = cheap/instant/candidate-controlled verified yes/no answers a carrier checks *when simply interested*; the full **DQ file** = the consented, regulated, paid pull *when serious about hiring*. The ZK layer raises conversion + avoids wasted pulls — it **does not replace** the FMCSA-required file (49 CFR 391.51), and freshness pushes a fresh consented pull at hire anyway → **complementary, not cannibalistic**. Never disintermediate the CRA (DEC-2026-06-004 §5).

**Decision flow when Key/Accio responds:**
1. **Yes, signed artifact** → Option 1. Record pubkey source + signed-byte format → P3.4-B build → flip 🟡→🟢. zkTLS stays R&D for non-signing issuers.
2. **No — data-agreement** → Options 2 (zkTLS) + 3 (source-pull) become primary. Log in `DECISION_LOG.md`. Storm-attested (4) is the interim shipping state.
3. **No — roadmap/priority** → keep nudging; ship Option 4 interim; run zkTLS spike so we're not waiting idle.
4. **Silence > ~60 days** → treat as soft no; start zkTLS spike regardless.

**Commit (per option, when built):**
- `feat(midnight): mvr-clean-36 issuer signature in-circuit (P3.4-B opt1)`
- `spike(midnight): zkTLS web-proof provenance feasibility (P3.4-B opt2)`

#### P3.4-C — Driver-initiated ordering + consent (driver-owned model)

| | |
|---|---|
| Status | 🟢 Prod-test ready — funding decouple + employer report access shipped; backfill + counsel copy pending |
| Pre-conditions | P3.4-A step 7 ✅ (attestation gate); DEC-2026-06-005 (accepted for build, **wording pending counsel**) |
| Pace risk | **Medium** — touches `place-screening-order`, candidate consent forms, employer order surfaces. Employer-initiated screening (`/api/employer/screenings/order`) defaults to `ownership: 'employer'` and must stay unchanged. |

**Why:** The driver must be the consumer of record so the report is portable and attestable (DEC-2026-06-005). The plumbing exists (`ownership` param, `screening-order-ownership.ts`); this section is the **driver-facing flow** + the **consent redesign** that makes "driver clicks order" real. Full rationale + consent constraints: `docs/midnight/DATA_OWNERSHIP_FCRA_MEMO.md` (§6a).

**Buildable now (no counsel dependency on the *mechanics* — only the *wording* is gated):**

1. **Driver-ownership acknowledgment step** — new component: plain-language statement + **mandatory checkbox** that gates form submission + "Learn more" modal (deep-dive). Standalone step — **never interleaved into the FMCSA PSP doc**. Core sentence + checkbox must be clear-and-conspicuous (visible, not hidden behind the modal). Wire the checkbox to place the order with `ownership: 'driver'`.
2. **Suppress the duplicate employer order at the application/pre-screen stage** when a driver-owned pull exists or is in-flight (avoid double-pull / double-charge). **Keep** the employer's hire-time order path — Pace still needs its own employer-purpose pull for the FMCSA DQ file (49 CFR 391.23; pre-screen ≠ DQ file, DEC-2026-06-004 §5).
3. **Decouple funding from ownership** in the payment path — allow Pace to *sponsor the fee* on a `ownership: 'driver'` (NULL-company) order. Today funding and company-ownership are coupled; split "who pays" from "who owns."
4. **Gate broad career-card exposure** behind driver disclosure prefs — a driver-owned pull auto-surfaces to the public/all-employer projection today (`projected-career-card.ts` `contactMode` NULL filter). "Auto-share with Pace (they applied)" should not mean "auto-publish to every employer." Default the broad switch off or driver-controlled.
5. **Backfill** — supersede/void the two existing **Pace-derived** test attestations (`167040f7-…` + the `ab0114b1-…` one) now that the gate only accepts driver-owned pulls. Re-smoke with a driver-owned pull.

**Counsel-gated (wording only — do NOT ship copy until blessed):**

6. **Reword the MVR/background authorization** — today it reads *"I authorize {company} to order my background report"* (`BackgroundCheckDisclosure.tsx`). Must reflect driver-as-consumer. This form IS editable.
7. **FMCSA PSP form stays verbatim** — federal NOTICE forbids edits / requires standalone (`PspDisclosureForm.tsx`). Ownership framing lives in the step-1 acknowledgment, not in this doc. **Do not touch the FMCSA language.**
8. **Open counsel questions** (memo §6): can the authorization be inline with the checkbox or must it be standalone; is mandatory-as-condition acceptable; exact wording that makes the driver the consumer of record.

**Verification:**
- Driver completes acknowledgment + signs → order row has `ordered_by_company_id IS NULL`, `ordered_by_employer = false`.
- Employer screening route still writes company-private rows (unchanged).
- After webhook completes, `block_driver_mvr` is populated (driver-owned) and `getMvrAttestationContext` returns it; prove-fact succeeds.
- Employer "Order MVR" CTA is hidden/disabled at application stage when a driver-owned pull exists; still available at hire.

**Commit:**
- `feat(screening): driver-ownership acknowledgment + checkbox-orders flow (P3.4-C)`
- `feat(screening): suppress duplicate employer pre-screen order when driver-owned exists`
- `chore(attestation): supersede Pace-derived test attestations`

#### P3.5 — Broaden fact registry + circuits

| | |
|---|---|
| Status | 🟡 **Code shipped 2026-07-29** — operator deploy + Preprod smokes pending |
| Pre-conditions | P3.4-A ✅ (predicate pattern established); P3.4-B (🟢 provenance) recommended but not required to start shared plumbing; **P3.4-C driver-owned gate** (so broadened facts attest off driver-owned pulls, not company-private) |
| Pace risk | Low — additive circuits + prove scripts |

**Goal:** Every `ShippedFactType` in `fact-registry.ts` can produce a valid **real-predicate** `midnight_zk` artifact on Preprod — replicating P3.4's witness + provenance + predicate pattern, not the P3.3 anchor. Each fact needs its own predicate + issuer-signature design.

**Do in order:**

1. **Shared module** — extract the common witness → proof-server submit → tx-persist pipeline from P3.4; one `*-circuit.ts` per fact.
2. **`cdl_class_a`** — Compact circuit + witness builder (provenance + class predicate; follow existing `proveCdlClassA`).
3. **`previous_employer_verified`** — circuit + witness builder (follow `provePreviousEmployerVerified`).
4. Extend `midnight-prove-fact.ts` to accept any shipped `FactType`.
5. Document per-fact DUST cost + proof-latency table in `MIDNIGHT_ENV.md` (from P3.4/P3.5 benchmarks).
6. Add a `CIRCUITS.md` log entry per new circuit (status, witness, constraints, disclosure, honesty status).

**Verification:**
```bash
ATTESTATION_BACKEND=midnight npm run midnight:prove-fact -- --fact cdl_class_a --user <id>
ATTESTATION_BACKEND=midnight npm run midnight:prove-fact -- --fact previous_employer_verified --user <id>
```

**Commit:** `feat(midnight): expand Preprod fact circuits (P3.5)`

#### P3.6 — Honesty gate (per-fact "proven on Midnight")

| | |
|---|---|
| Status | ✅ **Gate shipped 2026-07-29** — Midnight marketing copy requires `provenanceTier === 'issuer_signed'` (default `metadata`). Flip is one line after P3.4-B. |
| Pre-conditions | P3.4-A ✅; P3.4-B ✅ required before enabling per-fact "proven on Midnight" strings |
| Pace risk | **Copy/UI only** — no screening pipeline changes |

**Goal:** Carrier-facing UI may claim "proven on Midnight" **only** when `attestation.proof.kind === 'midnight_zk'` **and** `verifyAttestation()` passes. JWT-backed facts stay **"Verified by Storm"** + CRA citation (DEC-2026-05-004).

**Do in order:**

1. **`formatVerifiedByStormLine()` / `attestation-fact-ui.ts`** — branch on `proof.kind`; no "Midnight" / "on-chain" strings for `signed_jwt`
2. **Employer `CredentialFactsPanel` + career card modal** — same gate
3. **`/verify/[attestationId]`** (Phase 3c C1 skeleton) — JWT form now; show tx link + proof id when `midnight_zk`
4. **Stormi `ava-context`** — attestations block distinguishes JWT vs ZK honestly
5. **Tests** — copy helpers for both proof kinds

**Verification:** `rg -i "midnight|on-chain|zk.proven" src/components/employer src/components/career-card` — every hit must be behind `proof.kind === 'midnight_zk'` guard (or phase-honest vision copy on marketing only, not per-fact)

**Commit:** `feat(midnight): per-fact honesty gate for Midnight copy (P3.6)`

**Phase 3a complete when:** P3.3–P3.6 ✅ (incl. ≥1 real **🟢** predicate proof with in-circuit issuer signature — P3.4-B) → flip active marker to Phase 3b design. P3.4-A alone does not complete Phase 3a. **P3.7 (verified DQ-file assembly)** is the use-case payoff layer that *consumes* these facts — it can start its MVR→Form 1 slice on P3.4-A and broadens with P3.5; tracked as its own step, **not** a blocker for declaring the circuit slice done.

#### P3.7 — Verified DQ-file assembly (DOT app prefill + field lock)

| | |
|---|---|
| Status | ✅ **Core shipped** — MVR/PSP/EVR locks + verified-% + two-tone + **DEC-2026-07-001** + legacy whole-app VERIFIED honesty pass (2026-07-14) + **DOT field badges consume attestations** (2026-07-14; Midnight copy still P3.6-gated via `proof.kind`). |
| Pre-conditions | P3.4-A ✅ (MVR predicate — the reference slice); P3.5 broadens the fact set; **field-level provenance model** (new — stamp each DOT field with its originating fact). P3.4-B (🟢) / P3.6 gate the *wording*, not the build. |
| Pace risk | Medium — touches the DOT app (`DotApplicationFlow`, `driver_applications`) + career-card/employer views. Additive; **never** hard-locks a driver out of *adding* a required 391.21 disclosure. |

**Why this step exists (the use case):** proofs are only worth what they *do*. The payoff is a **portable, mostly-verified DQ intake packet** — proven third-party facts (MVR/PSP/CDL/employment) auto-fill the DOT app, are badged, and are protected from silent editing. This is the object that raises carrier conversion and lets **one driver-owned pull serve many carriers** (money logic below). It is the **pre-screen packet**, NOT the regulated 49 CFR 391.51 DQ file — the carrier still runs its own consented hire-time pull (never disintermediate the CRA; DEC-2026-05-011).

**The "call it verified" decision (✅ DEC-2026-07-001):**
- **Principle, not a fixed number:** once a **majority of the risk-bearing DQ fields** are issuer-backed, the packet can carry a headline **"Verified" with a protective small-print caveat.** *60% is an illustrative figure the boss used — the real target is "over half," and the number we actually surface is whatever we genuinely reach, computed live, never a chosen marketing figure.* This headline is allowed **only** because the claim is *decomposable and true at the field level*:
  - The surfaced % is a **real computed number** = issuer-backed fields ÷ a defined denominator (the risk-bearing DQ fields, not every text box). No vanity numbers, no rounding up.
  - **Every field carries an honest badge:** "Verified — sourced from Accio order #X, as of {date}" vs "Self-certified by driver." A carrier can always tell which is which.
  - **Self-reported fields are NEVER badged verified** (provenance gate, DEC-2026-05-014). Residency, employment gaps, acknowledgements, signature stay self-certified — that's the un-verifiable remainder, whatever its size.
  - **Per-fact "proven on Midnight" stays gated** by P3.6 / P3.4-B. Interim wording is "Verified by Storm — sourced from {CRA} order #X."
- **Why the small print is non-negotiable (legal armor, not just ethics):** this is a regulated FCRA/FMCSA context. A carrier relying on a "verified" badge that secretly covers self-reported data is a consumer-protection exposure. Honest, decomposable labeling is exactly what makes "Verified" **defensible** where a competitor's puffery isn't — here the honesty gate is a moat, not a constraint (`strategic-direction.mdc` — "Storm is not a crypto scam project"). Market the *headline*; let the *badges* carry the truth.

**Field lock model (per field type):**
| Field type | Source | Behavior |
|---|---|---|
| Identity + license (name, DOB, DL #, class, state, expiry, status) | MVR/DMV verbatim | **Hard-locked** — projected from the fact, uneditable (also kills the "1070 vs 1970" typo failure mode) |
| Accidents / violations / convictions (Form 2) | MVR | Verified rows **lock against edit/delete**; driver may **append** own disclosures (self-certified) — 391.21 is a driver *attestation*, so blocking additions could suppress a required disclosure |
| Crash / inspection history (Form 2) | PSP | Same as above, once a PSP fact exists (P3.5) |
| Employment entries (Form 3) | `previous_employer_verified` | Verified entries badged + edit-locked; unverified entries stay open |
| Everything else | driver | Open, self-certified |

**Do in order:**
1. ✅ **Field provenance model** — `src/lib/dot-field-provenance.ts` + `mvr-form1-projection.ts`. Locked paths stamped as `_fieldProvenance` on Form 1; save/load **re-project** from live MVR (not copy-then-disable).
2. ✅ **Prefill + lock UI** — MVR → Form 1/2, PSP → Form 2, EVR → Form 3 (hard-lock + append-only self disclosures where required).
3. ✅ **Verified-% meter** — `dot-verified-coverage.ts` + `DotVerifiedMeter`; majority = strict >50%.
4. ✅ **Two-tone rendering** — teal (issuer) / amber (self) on DOT preview + career card.
5. ✅ **Honesty pass** — DEC-2026-07-001; walked back Base-era "Verified on Blockchain" / whole-app `VERIFIED` on self-reported DOT (ApplicationSubmitted, journey, CareerCard, DriverHub, hub docs, verify API → 410).
6. ✅ **Badge honesty tier** — `dot-attestation-badge.ts` + `GET /api/attestation/mine`; Form 1/2/3 upgrade Accio/EVR badges when a matching attestation exists (`signed_jwt` → Verified by ZKnight; `midnight_zk` → Proven on Midnight). PSP stays Accio-only until a PSP fact type ships. Meter denominator unchanged.

**Money logic (why this pays):** higher carrier conversion (a pre-verified packet beats a raw self-report), better pull efficiency (fewer wasted hire-time pulls on drivers who won't qualify), and — per Key's own proposal (P3.4-B handoff 2026-06-25) — recurring **monitoring** re-pulls (90/180/365-day) that refresh the verified fields and generate recurring CRA orders. The DOT app is the human-readable *vehicle* for those proofs, not the product being sold.

**Verification:** a driver with a proven MVR sees Form 1 license fields locked + badged; edits blocked client- **and** server-side; verified-% reflects only issuer-backed fields; no self-reported field renders a "verified" badge; per-fact "Midnight"/"on-chain" strings still gated by `proof.kind === 'midnight_zk'`.

**Commit:** `feat(dq): verified DOT app assembly — prefill + field lock (P3.7)`

---

> **Phase 3b / 3c / 4 — why not full runbooks yet:** SBT minting, shielded STORM, and the Proof Request rail depend on **real DUST costs, circuit latency, and verify UX** from P3.3. Writing atomic steps now would duplicate ARCHITECTURE.md without reducing risk. **When P3.3 closes**, add P3b.1 / P3c.1 substeps here (same just-in-time pattern as P3.1→P3.2→P3.3).

### Phase 3b — soulbound credential cards in the career card (committed, after 3a)
Promoted from "captured, NOT scheduled" → **committed direction** (DEC-2026-06-002). Begin design once 3a is in production with ≥1 carrier consuming attestations.
- Each verified attestation rendered as a **non-transferable SBT inside the existing career card** (the vault). Career card UX/URL (`/card/{token}`) unchanged; cryptographic verification added underneath.
- **Invariants (do not break):** soulbound to `users.id` not a wallet; candidate never sees a wallet/seed/gas; Storm-issuable + Storm-revocable on lapse/fraud; selective disclosure stays at the credential-card level via existing lenses; career card mints empty at signup (never gated on completion).
- Full spec: `ARCHITECTURE.md` → "Phase 3b — Soulbound credential SBTs".

### Phase 3b — STORM as Midnight-native shielded utility token (committed, after SBT layer)
- Shielded balances on Midnight; **surfaced as "Storm Points"**; earned for verifying/completing/referring; spent on platform discounts.
- **Pure utility only** — no profit-share, no governance over Storm corp (stays outside Howey). No driver wallet UX, ever.
- Reissue of the off-chain Storm Points ledger onto Midnight = substrate change to a working system, not a new product (DEC-2026-05-005 Option B).

### Phase 3c — Proof Request rail: any carrier, any CRA, candidate-mediated (committed — DEC-2026-06-003)

**The GTM unlock beyond Pace.** Asking carriers to ditch their screening supplier (Checkr / DISA / Accio) for Storm is a zero-sum ask we reject. Instead Storm is the **proof rail above whichever CRA the carrier already uses** — interoperability over displacement. The carrier's entire integration is *a form and a link*.

**Product shape — "Proof Requests" (DocuSign for driver facts):**

1. **Carrier X submits a request** — driver contact + facts needed (from the fact catalog) + optionally which CRA holds the data. No Storm tenancy, no SDK, no CRA switch.
2. **Storm contacts the driver** — reuses existing outreach machinery (invites, notifications, deep-links).
3. **Driver signs once** — FCRA authorization + per-audience disclosure election (extends `screening_consent_bundles` + `disclosure_preferences`).
4. **Storm sources → derives → proves on Midnight** — attestation cites `source_cra`.
5. **Carrier receives a public verify link** — backed by the on-chain proof, verifiable **cold** (no Storm account). This delivery model only works because of Midnight; a JWT verify link still requires trusting Storm's key.
6. **Flywheel:** every fulfilled request mints a new Storm candidate with a career card + portable fact. Carriers become the candidate-acquisition channel.

**Components (rough build order, design after 3a verifies):**

| | Component | Notes |
|---|---|---|
| C1 | Public verify page (`/verify/[attestationId]`) | Can ship in Phase-2 form now ("Verified by Storm" + CRA citation); upgrades in place when the Midnight backend swaps. Honesty gate applies (P3.6). |
| C2 | Lightweight carrier request intake | Non-tenant company record + request form. Generalizes the existing employer-request pipeline; never special-case a carrier. |
| C3 | Consent package extension | Per-request FCRA authorization + disclosure election; candidate-initiated share remains the invariant. |
| C4 | CRA ingestion adapters | Per-CRA `proveImpl` + format mapping, registered like blocks. Launch = Accio + driver's-own-records; Checkr/DISA when path (b) clears. |

**Ingestion sources, in risk order (mirrors the funding paths above):**
- **(a) Driver's-own-records, carrier-sponsored — LAUNCH PATH.** Works under existing consent posture, any carrier, today.
- **(b) Existing-CRA-pull ingestion (Checkr / DISA / …) — GATED on the FCRA opinion.** Even with the driver's signature, ingesting another party's funded pull is the same legal question as funded-pull-becomes-portable (DEC-2026-05-013). One opinion covers both.

**Rejected — never build (DEC-2026-06-003 §2):** a carrier-side headless proofs API where company X batches *their* CRA reports through Storm **without the driver in the loop**. That makes Storm a consumer-report processor for the FCRA "user" (reseller/CRA territory) and dissolves the driver-owned vault into commoditized middleware. The candidate is the hub in every flow — that's the legal posture AND the moat.

**Pre-conditions:** P3.3 one-fact slice verified on Preprod (don't design the rail on the JWT-only backend — except C1, which is phase-honest in JWT form).

### Phase 4 — cached-attestation marketplace (GATED on FCRA opinion)
- Driver economic compounding via Storm-mediated cached re-queries (DEC-2026-05-013). Carrier picks fresh pull (~$35) or recent-attestation query (~$15, 30-day cliff, consent-gated); driver pockets ~$5, Storm ~$10. Storm mediates every transaction (no driver-as-vendor, no Lace wallet).
- **Do not build until:** Phase 2 in production at scale + Pace engaged as co-designer + **FCRA legal review complete** (the path-(b) legal question above — same opinion gates Phase 3c ingestion path (b)).

### Guardrails that keep the token/SBT legitimate (NEVER loosen)
The promotions above do **not** touch the rejected-ideas list. These stay permanently rejected (`MOAT_THESIS.md` appendix): transferable credential NFTs, tradeable/fungible credential tokens, driver-as-vendor-with-wallet, income-share / "driver pool" tokens, Storm-as-CRA, **carrier-side headless proofs API with no driver in the loop** (DEC-2026-06-003). **Soulbound ≠ tradeable; utility ≠ security; candidate-mediated ≠ optional.** If a token feature drifts toward transferability or profit-sharing — or a rail feature drifts toward bypassing the driver — it's rejected, not roadmap.

Engineering view: `[ARCHITECTURE.md](./ARCHITECTURE.md)` "Phase 3 arc". Boss-facing: `[TOKEN_BRIEF.md](./TOKEN_BRIEF.md)`. Strategy: `[MOAT_THESIS.md](./MOAT_THESIS.md)`.

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
| 2026-07-30 | **P3.4-A freshness + P3.5/P3.6 gate** | Composer | (this push) | **P3.4-A:** asOfDate + pull nullifiers; Preprod redeploy `fb46c572…`; Pace supersede; driver-owned prove + replay/negative smokes ✅. **P3.5:** CDL/EVR circuits in repo (deploy smokes still open). **P3.6:** honesty gate shipped; Midnight marketing copy dark until issuer_signed. Prod stays JWT (`ATTESTATION_BACKEND` unset). |
| 2026-07-14 | **P3.7** DOT badge honesty tier | Grok | uncommitted | Issuer badges upgrade via `/api/attestation/mine` + `dot-attestation-badge.ts`. Midnight copy only when `proof.kind === midnight_zk`. PSP badges stay Accio-only. |
| 2026-07-14 | **Honesty** resume verify retired | Grok | uncommitted | Self-reported resumes: verify API 410; removed Base Verify CTAs; "On file" not Verified. Extends DEC-2026-07-001 §7. |
| 2026-07-14 | **P3.7** DEC-2026-07-001 + honesty pass | Grok | uncommitted | **Shipped:** formal DEC (majority Verified headline + field honesty); retired DOT whole-app blockchain UX (ApplicationSubmitted, journey, CareerCard, DriverHub, hub docs `canVerify`, verify API 410, projected on-chain strip). Prefer Submitted + live verified-%. |
| 2026-07-14 | **P3.7** Form 3 EVR locks | Grok | uncommitted | **Shipped:** EVR VERIFIED/PARTIALLY_VERIFIED → Form 3 `_source:'verified'` rows; stable employer ids; save/prefill/late-respond re-project; Form 3 UI lock + badge; verified-% + preview two-tone. Self never badged. |
| 2026-07-14 | **P3.7** PSP→Form 2 | Grok | uncommitted | **Shipped:** PSP crashes→`accidents[]` (`_source:'psp'`), inspections→`inspections[]`; `mergePspRowsIntoForm2` preserves MVR stamp; prefill/save/webhook late-apply; Form 2 locks + lean inspection UI; verified-% counts PSP clean flags. Accepts `needs_review` orders; webhook `result_status:'parsed'`. **Still open:** Form 3 employment verified rows, formal DEC, legacy VERIFIED honesty. |
| 2026-07-13 | **P3.7** verified-% + two-tone | Grok | uncommitted | **Shipped:** `dot-verified-coverage.ts` (live % = issuer-backed ÷ filled risk-bearing slots; majority = strict >50%); `DotVerifiedMeter` on DOT flow + career card chip; employer DOT preview teal/amber two-tone + legend; `DotAppData` projects %. **Still open:** PSP→Form 2, employment verified rows, formal DEC, legacy VERIFIED honesty. |
| 2026-07-09 | **P3.7** late-MVR + Form 2 locks | Grok | uncommitted | **Late-MVR:** webhook + DOT reopen always re-project Form 1 locks + Form 2 MVR rows (overwrite even when values match) and stamp Accio badges. **Form 2:** MVR accidents/convictions locked + append-only self disclosures (391.21). `apply-mvr-to-dot-application.ts` persists into `driver_applications` on Accio complete. **Still open:** verified-% meter, employer two-tone, PSP. |
| 2026-07-09 | **P3.7** MVR→Form 1 lock slice | Grok | uncommitted | **Shipped:** `dot-field-provenance.ts` + `mvr-form1-projection.ts`; `/api/driver/prefill-from-mvr` returns locked Form 1 + provenance; save-progress GET/POST **re-projects** locked fields from live MVR (tamper-proof); `PersonalInfoForm1` hard-locks name/DOB/license[0] with honest Accio badges; `DotApplicationFlow` auto-applies on entry. Unit tests for projection. **Still open:** Form 2 append-only, verified-% meter, employer two-tone, honesty pass on legacy VERIFIED flag. Key/P3.4-B still not required for this slice. |
| 2026-07-07 | Docs — **P3.7** verified DQ-file assembly direction | Claude Opus 4.8 | uncommitted | **Docs only.** Captured the use-case payoff: proven MVR/PSP/CDL/employment facts prefill + **lock** the DOT app into a portable, mostly-verified DQ **pre-screen** packet (NOT the 391.51 file — CRA hire-time pull preserved, DEC-2026-05-011). **Direction (formalize as a DEC):** once a **majority** of risk-bearing fields are issuer-backed, surface a headline **"Verified" + honest small print** — allowed only because it's decomposable/true at the field level (real computed %, per-field badges, self-reported never badged, per-fact "Midnight" still P3.6-gated). *60% is illustrative (boss's number); the real bar is "over half," and the surfaced % is computed live, never chosen.* Framed the small print as **legal armor** in an FCRA/FMCSA context, not just ethics. Lock model: hard-lock identity/license, **append-only** for 391.21 disclosures. Added P3.7 to the Phase 3a table + full detail section; noted money logic (conversion + pull efficiency + Key-proposed recurring monitoring). **Next:** field-provenance model + MVR→Form 1 slice; formalize the "call it verified" DEC in `DECISION_LOG.md`. |
| 2026-06-29 | **P3.4-C** prod-test ready | Composer | uncommitted | **Funding decouple:** fulfill-screening attaches waived `payments.company_id` sponsor on driver-owned orders. **Employer access:** `employer-screening-order-access.ts` — consenting company can view driver-owned MVR/PSP PDF/status. **Notify:** single employer bell after PSP leg. **Bugfix:** screening-consent accepts mvr_order/psp_order; duplicate `cdlisPayload` build fix. See `docs/TEST_DRIVER_OWNED_SCREENING.md`. |
| 2026-06-29 | **P3.4-C** driver-owned order flow shipped | Composer | uncommitted | **UI:** `DriverScreeningOwnershipAcknowledgment` + `consent-then-driver-orders` on ScreeningConsentBlock/PspOrderForm. **Backend:** talent API exposes driver-owned flags + consenting-company view; employer screenings/order blocks pre-screen duplicate (`purpose=hire` escape); projected career card no longer auto-publishes driver-owned to all employers. **Still open:** funding decouple, backfill 2 Pace attestations, counsel copy. |
| 2026-06-25 | **P3.4-C** driver-ownership flow scoped | Claude Opus 4.8 | uncommitted | Added build-ready **P3.4-C** section: driver-ownership acknowledgment step (statement + mandatory checkbox + Learn more modal, standalone from FMCSA doc), suppress duplicate employer pre-screen order (keep hire-time pull for DQ file), decouple funding from ownership, gate broad career-card exposure, backfill 2 Pace-derived attestations. Counsel-gated = **wording only** (MVR auth reword + standalone/mandatory questions); FMCSA PSP form stays verbatim. Mechanics buildable now. Consent constraints in FCRA memo §6a. |
| 2026-06-25 | **P3.4-A step 7** ✅ driver-owned gate wired | Claude Opus 4.8 | uncommitted | **Code:** `screening-order-ownership.ts`; attestation context requires driver-owned MVR; MVR webhook block sync gated; `fulfill-screening` stamps `ownership: 'driver'`. DEC-2026-06-005 **accepted for build** (counsel pending). Employer routes unchanged (default `employer`). **Next:** backfill 2 Pace test attestations; replay/freshness (step 4). |
| 2026-06-25 | **P3.4-B** 🟢 Key positive/conditional response | Claude Opus 4.8 | uncommitted | **Key (Lana Iklodi, President KBS) replied — soft yes:** concept has merit, worth exploring; wants **business case + workflow + vision** before scoping dev (gate = roadmap/priority, not capability, as predicted). **Key's cert model = our freshness model:** cert tied to screening event + completion timestamp; copies don't refresh; new cert only on new order. **Key proposed monitoring** (90/180/365-day re-pulls) → recurring certified history + recurring KBS orders (incentive-aligned; maps to DEC-2026-05-013). **Action:** draft reply to Lana's 7 Qs in driver-owned/agency-funded frame (DEC-2026-06-005); don't commit Key pending FCRA counsel. Skeleton answers drafted in chat. **Next:** finalize email; if Key proceeds → P3.4-B opt 1 (in-circuit issuer signature, flip 🟡→🟢). |
| 2026-06-22 | **P3.4-A** 🔴 FCRA isolation gap confirmed | Claude Opus 4.8 | uncommitted | **Finding (data-confirmed via Supabase MCP):** `getMvrAttestationContext` has no `ordered_by_company_id` filter; both smoke attestations (`0897bf34…`, `ab0114b1…`) were proven off **Pace Drivers**-ordered (`ordered_by_employer=true`) company-private MVRs — redisclosure that migration 031 walls off in the career-card view but not the attestation path. Logged as P3.4-A step 7 (🔴, must close before P3.5). **Ownership Q&A:** blocker is **FCRA + DPPA + CRA vendor contract**, not FMCSA — Pace can't relabel an employer-pull as driver-owned; the clean path is driver-initiated self-ordered pulls (`ordered_by_company_id IS NULL`) with agency sponsoring the fee (DEC-2026-06-002). **Next:** add isolation filter + decide backfill of 2 existing Pace-derived attestations. |
| 2026-06-22 | **P3.4-A** ✅ first predicate proof on Preprod | Sam (local) | uncommitted | **Verified E2E:** contract `2b7032a6…54cdb`; tx `009847a5…3ea2cc`; attestation `167040f7…83bc` for candidate `0897bf34…`. Real `proveCleanMvr` predicate (32-slot witness, in-circuit window check). Fixes along the way: witness tuple ABI, Set.difference polyfill, supersede FK insert order. P3.3 anchor row superseded. Still 🟡 honesty (no in-circuit issuer sig). **Next:** negative prove test, replay/freshness, P3.4-B. |
| 2026-06-22 | **P3.4-A** predicate circuit wired (code) | Composer | uncommitted | **Predicate:** `mvr-clean-predicate.ts` + unit tests; Compact `proveCleanMvr(windowStart, windowEnd, commitment)` with 32-slot violation witness; runtime `prove-on-chain.ts` + bridge + `midnight-attestation-service` pass witness payload. **Compiled** via `midnight:compile`. **Still 🟡:** no in-circuit issuer signature (P3.4-B pending Key); per-fact "proven on Midnight" stays gated. **User action:** `midnight:deploy` + update `MIDNIGHT_CONTRACT_ADDRESS`; smoke `midnight:prove-fact`. **Next:** redeploy smoke → replay/freshness (step 4) or P3.4-B when Key responds. |
| 2026-06-22 | **P3.4-B** provenance options + zkTLS fallback (docs) | Claude Opus 4.8 | uncommitted | **Docs only.** Added ranked provenance portfolio so Key isn't a single point of failure: (1) issuer-sig Key/Accio, (2) **zkTLS/web-proof** — provenance with *no* Key cooperation (Storm already fetches over TLS; `reportURL` exists), (3) source-issuer pull (DMV/FMCSA), (4) Storm-attested interim 🟡, (5) alt-CRA adapter. **zkTLS promoted to parallel R&D** (only path fully in our control + foundation-worthy narrative); spike → go/no-go in `DECISION_LOG.md`, don't wire until it clears. New hard invariant: provenance-method recorded on the proof artifact so the verify surface/honesty gate renders the right per-fact trust claim. Decision flow for Key's eventual yes/no/silence. **Next:** P3.4-A witness builder (unchanged). |
| 2026-06-18 | **P3.4.0** 🟡 local research ✅ · Key/Accio vendor review pending | Claude Opus 4.8 | uncommitted | **P3.4.0 local:** scanned **339** `mvr_orders.result_xml` — **0** crypto signatures (XMLDSig/X509/etc.); `signatureText`/`signatureDate` are applicant-consent fields only. **Vendor:** Sam called Lana (Key); email sent CC Ryan (Accio) asking for **one signature per report** (MVR/PSP priority, platform-level ideal). Key replied 2026-06-18 — reviewing internally with Accio (technical/compliance/platform); will circle back. **Not stuck:** split P3.4 into **A (predicate — start now)** + **B (in-circuit signature — pending Key)**. Interim = predicate + metadata citation, not 🟢. **Next:** P3.4-A step 1 (witness builder from `result_xml`). |
| 2026-06-17 | Docs — Phase 3a **re-sequenced depth-first** + `CIRCUITS.md` | Claude Opus 4.8 | uncommitted | **Docs only.** Realized P3.3 shipped an **anchor 🟡** (no `witness`/`assert` — "clean" boolean still off-chain), which doesn't deliver the moat. Added `CIRCUITS.md` (ZK/Compact primer + per-circuit log) and inserted a **new mandatory P3.4 — real predicate proof** for `mvr-clean-36` (in-circuit issuer signature + no-disqualifying-violation predicate, 🟡→🟢). Renumbered: broaden→**P3.5** (now replicates the real pattern, not the anchor), honesty gate→**P3.6**. **Blocking gate: P3.4.0** — confirm whether Accio returns a verifiable issuer signature over the MVR payload (decides if a trustless proof is buildable). **Next:** P3.4.0 issuer-signing research. |
| 2026-06-17 | **P3.3** ✅ verified on Preprod | Claude Opus 4.8 | uncommitted | **Contract deployed** (`6c3f0ea8…fea49cf`) + **first ZK attestation proven** (tx `0024edbc…0e265a`, row `6bc932c7…7d4ad4`). Fixed the last Node-20 gaps: `tx.imbalances().entries().filter` → `%IteratorPrototype%` polyfill; `tx.imbalances(...).entries().filter is not a function` recurrence; Supabase admin client env read made lazy (ESM hoisting vs `dotenv`); `globalThis.WebSocket=ws` for `@supabase/supabase-js` realtime on Node 20. Added **disk wallet-state cache** (`serializeState`/`restore`) for incremental sync + **stderr progress streaming** through the prove bridge. **Next: P3.4** — generalize to remaining `fact-registry.ts` facts. |
| 2026-06-17 | **P3.3** 🟡 address fix | Composer | uncommitted | Reverted seed to full BIP39 — CLI address now matches Lace Unshielded (`1vr5lrw…`). **Next:** `midnight:wallet:status` (expect tNIGHT > 0) → register-dust → deploy → prove-fact. |
| 2026-06-17 | **P3.3** 🟡 implementation | Composer | uncommitted | Shipped Compact circuit, `midnight/runtime` subpackage, iterator-helper postinstall patch, `midnight-attestation-service.ts` + prove bridge + unit tests. Fixed: relay wss URL, indexer v4, wallet-sdk 4.x + batchUpdates. **Blocked:** first wallet sync OOM at 8GB; user needs `MIDNIGHT_PRIVATE_STATE_PASSWORD`. **Next:** register-dust → deploy → prove-fact on Preprod. |
| 2026-06-10 | **P3.2** ✅ complete | Composer | pending user commit | Preflight all green: Docker + Compact, proof server HTTP 200, env + 24-word mnemonic. Fixed preflight: port-6300 health check; mnemonic allows `.env` quotes (required for dotenv multi-word values), rejects commas. **Next: P3.3** — `midnight-attestation-service.ts` + `mvr_clean_36_months` on Preprod. |
| 2026-06-10 | **P3.2** — preflight fix (🟡 mnemonic pending) | Composer | pending user commit | User preflight: port 6300 "in use" was false failure — proof server already healthy HTTP 200. Fixed `midnight-p3.2-preflight.sh` to curl `/health`; mnemonic now hard gate. Env template + `MIDNIGHT_ENV.md` indexer v4. **Last P3.2 step (👤):** add `MIDNIGHT_WALLET_MNEMONIC=<24 words>` to `.env.local` (same Lace dev wallet, funded). Then `npm run midnight:preflight` all green → P3.2 ✅ → P3.3. |
| 2026-06-12 | **P3.2** — proof server verified (🟡 wallet pending) | Composer | pending user commit | Docker Desktop + WSL: fixed `docker` group + `docker context use default` (not `desktop-linux`). `proof-server:up` pulled `midnightntwrk/proof-server:8.0.3`; health `{"status":"ok"}` HTTP 200. **Remaining P3.2:** copy `env.local.midnight.template` → `.env.local`, Lace dev wallet + Preprod faucet. Then P3.2 ✅ → P3.3. |
| 2026-06-10 | Docs — **DEC-2026-06-003** multi-CRA Proof Request rail (Phase 3c committed) | Fable 5 | pending user commit | **Docs only.** Captured the "any carrier, any CRA" direction: Storm as proof rail above the carrier's existing screening supplier (interop over displacement). **New DEC-2026-06-003**: candidate-mediated Proof Requests committed (carrier submits request → driver signs → Storm proves on Midnight → carrier gets cold-verifiable link); carrier-side headless proofs API (no driver in loop) **permanently rejected** → added to MOAT_THESIS rejected-ideas appendix. New **Phase 3c** section in this checklist (C1 verify page → C2 carrier intake → C3 consent extension → C4 CRA adapters; ingestion path (b) FCRA-gated, same opinion as Phase 4). New engineering invariant: `source_cra` flows through every Phase 3 layer — never assume Accio. **Next:** P3.2 verification (Docker Desktop install), then P3.3. |
| 2026-06-09 | **P3.2** — proof server Docker spike (🟡) | Composer | pending user commit | **Shipped:** `midnight/docker-compose.yml` (proof-server 8.0.3:6300), `scripts/midnight-proof-server-health.sh`, npm `midnight:proof-server:*`, `docs/midnight/MIDNIGHT_ENV.md`. **Blocked on human:** Docker Desktop + WSL integration — `docker` not in PATH yet. **Next:** install Docker Desktop → `npm run midnight:proof-server:up` → health 200 → fund Preprod wallet → mark P3.2 ✅ → P3.3. |
| 2026-06-09 | **P3.1** — WSL2 + Compact toolchain smoke test ✅ | Opus 4.8 | pending user commit | Ubuntu-24.04 on Win11 64GB; `.wslconfig` 32GB; repo copied to `/home/octorok/dev/resume-wallet`; `compact 0.5.1` + compiler **0.31.0** after `apt install unzip`. **Next:** Cursor WSL folder + P3.2 Docker/proof server. Midnight MCP available for Compact/contracts. |
| 2026-06-09 | Docs — positioning + funding + token/SBT capture (DEC-2026-06-002) | Opus 4.8 | pending user commit | **Docs only.** Added **DEC-2026-06-002**: (1) driver-side-counterpart positioning (NOT a Tenstreet/Xchange competitor — don't chase network/data volume), (2) candidate-controlled/agency-funded model (Pace funds pull, driver owns fact; path (a) own-records-sponsored first, path (b) funded-pull-portable GATED on FCRA opinion), (3) Midnight reframed as **load-bearing** (network-independent portable trust for a late entrant), (4) SBT-in-career-card + shielded-utility STORM promoted "captured" → **committed roadmap** with guardrails intact. Edited `MOAT_THESIS` (retired "chain is implementation detail" lines + new positioning/funding sections), `ARCHITECTURE` (Phase 3 arc sequenced), this checklist (Phase 3 fleshed out: 3a slice → 3b SBT → token → P4 gated), `TOKEN_BRIEF`, `PARTNERS`, `CHANGES`. **Next:** Phase 3a step 1 (toolchain de-risk) when ready. |
| 2026-06-05 | P2.7 — Verified by Storm language + Stormi/journey (**Phase 2 COMPLETE**) | Composer | a0e0248 | **Lib:** `formatVerifiedByStormLine()` + tests. **Sweep:** self-reported career card/share/PDF/export copy → on file; third-party facts use centralized provenance. **Stormi:** `ava-context` attestation block + hub `attestationCount`. **Journey:** optional verified-fact milestone. `npm run test:app` (50) + `npm run build` green. **Next:** Phase 3 (trigger-gated). |
| 2026-06-05 | P2.6 — candidate per-audience disclosure toggles | Composer | 62b8b2b | **Migration:** `100_disclosure_preferences.sql` (apply manually on dashboard). **Lib:** `disclosure-preferences.ts` — default shareable, `allowed=false` hides from employer list + blocks audience-scoped prove. **API:** GET/PATCH `/api/attestation/disclosure-preferences`. **UI:** `DisclosurePreferencesModal` + Zustand store; hub career card **Sharing** button. `npm run test:app` (48) + `npm run build` green. **Next:** P2.7 Verified-by-Storm language + Stormi. |
| 2026-06-05 | P2.5 — carrier CredentialFactsPanel | Composer | 07d47bd | **New:** `CredentialFactsPanel` (facts-first, HubSectionPanel chrome), `attestation-fact-ui.ts`, `employer-credential-facts.ts`. **Wired:** talent API `verifiedFacts`; `CareerCardModal` additive mount; `ProjectedCareerCard` demotes MVR/PSP stat grids (PDF fallback kept). I-8 request/recruit/order paths untouched. Pace smoke: card + requests + PDF fallback OK. `npm run test:app` (42) + `npm run build` green. **Next:** P2.6 candidate prove UX. |
| 2026-06-05 | P2.4 — attestation prove + verify API routes | Composer | 21ed2fc | **New:** `POST /api/attestation/prove` (session, self-only) + `POST /api/attestation/verify` (`{attestation}` or `{id}`; audience gate for scoped rows). **Helpers:** `attestation-route-helpers.ts` (audience access, row map, error status). Registry-only imports. `npm run test:app` (42) + `npm run build` green. **Next:** P2.5 carrier `CredentialFactsPanel`. |
| 2026-06-05 | P2.3 — fact registry + 3 third-party facts | Composer | a2c1242 | **New:** `fact-registry.ts` (3 `proveImpl`s + provenance gate), `block-data.ts` helpers (`getMvrAttestationContext`, `getEmploymentVerificationForAttestation`). **Wired:** registry `resolveFact` → `resolveAttestationFact`. **Tests:** 8 vitest cases (true/false per fact, gate, no PII in `disclosedFields`). MVR facts cite `source_cra: accio` + `accio_order_number`; employment cites `prior_employer` + evr id. `npm run test:app` (38) + `npm run build` green. **Next:** P2.4 prove/verify API routes. |
| 2026-06-05 | P2.2 — attestationService + signed-JWT impl | Composer | 0b7a92b | **New:** `attestation-service.ts` (interface/types), `signed-jwt-attestation-service.ts` (factory + prove/verify + DB supersede), `attestation-service-registry.ts` (export only). **Tests:** round-trip, tamper, expiry (vitest). **Env:** `ATTESTATION_JWT_PRIVATE_KEY`, `ATTESTATION_ISSUER`, optional `ATTESTATION_BACKEND`. Registry `proveFact` throws until P2.3 fact registry wired. `npm run test:app` + `npm run build` green. **Next:** P2.3 fact registry. |
| 2026-06-05 | P2.1 — `attestations` table migration | Composer | 465f83b | **Migration:** `098_attestations.sql` — immutable attestations store + Phase-4 forward-compat cols (`valid_until`, `source_cra`, `source_pull_id`, `query_count`). **RLS:** candidate SELECT own rows; employer SELECT audience-scoped via `company_members`; no client INSERT/UPDATE/DELETE (service-role issuance). **Indexes:** candidate+fact, current (unsuperseded), audience partial. **Apply manually** on remote via dashboard. No app code. `npm run build` green. **Next:** P2.2 attestationService + signed-JWT. |
| 2026-06-05 | D5 — env + dependency sweep (**Track 2 COMPLETE**) | Composer | 1e5ddb0 | **Uninstalled:** `viem`, `ethers`, `hardhat` + toolbox/verify/openzeppelin (~469 pkgs). **Deleted:** `hardhat.config.js`, 17 crypto `scripts/*.js`, `lib/alchemy.ts`, `base-auth-middleware.ts`, `/api/auth/verify`, `/api/webhooks/alchemy`. **Refactored:** `check-duplicate-global` → DB-only. **Also in commit:** D3.4 audit fixes (`user-by-wallet`, `supabase-db`, employment-verify session auth). **Scripts kept:** dev/build/start/lint/test:app/supabase:test/backfill/inspect. **Env:** documented removals in `CHANGES.md` + `VERCEL_ENV_CHECKLIST.md` (manual Vercel purge). `rg "ethers|viem|hardhat" src/` → 0. `npm run build` green. **Next:** Phase 2 attestation service. |
| 2026-06-05 | D3.4 — drop `walletAddress` store field; session-only identity | Composer | 76c560d | **auth-store:** removed `walletAddress`/`setWalletAddress`/`useWalletAddress`; `SessionUser` + `useSessionUserId`; persist only `userRole`. **sync:** `use-supabase-auth-sync` no longer writes `auth:<uuid>` placeholder to store. **~167 files:** props/params `walletAddress` → `sessionUserId`; API routes use `getStormUserIdFromRequest` / `getSessionUserRow`. **Kept:** `users.wallet_address` DB column + `legacyWalletAddress` in admin JSON only. **Left for D5:** vestigial `x-wallet-address` client headers on AI/admin paths; `user-by-wallet.ts` lib. `rg walletAddress src/` → lib helpers only. Employer hub: centered single column (Stormi rail removed). `npm run build` green. |
| 2026-06-05 | D3.1–D3.3 — USDC + company wallet + `@account-kit` (partial; absorbs T1.12d + T1.13 remainder) | Composer | ce03071 | **D3.1** `6d15699`: deleted `MvrPaymentButton`/`PspPaymentButton`; `StormiCreditModal` → Stripe placeholder; MVR/PSP order forms + `/api/mvr|psp/order` optional `paymentTxHash` via `resolve-waived-screening-payment.ts`; minimal `CareerCardModal` employer order path. **D3.2** `377028e`: deleted company wallet UI + `/api/wallet/*-config` + `ensure-wallet` + company-wallet libs; stripped wallet from `EmployerHub`, team invite/member routes, company API. **D3.3** `ce03071`: deleted `AlchemyProvider`, `alchemy-account-config`, `BasePayButton`, `PaymentStatusTracker`, `base-pay`, `base-account-sdk`; layout re-parents `SupabaseAuthSync`; tailwind drops `withAccountKitUi`; uninstalled `@account-kit/*`, `@aa-sdk/core`, `alchemy-sdk`, `@coinbase/*`, `@base-org/*`. `rg "@account-kit|AlchemyProvider|@coinbase|@base-org" src/` → 0. `npm run build` green after each substep. **STOP — human audit before D3.4** (`walletAddress` store field ~190 refs). Accio `/api/employer/screenings/order` untouched. **Next:** manual incognito sign-in → hub → employer screening smoke; then D3.4 or D5. |
| 2026-06-04 | D4 — IPFS → Supabase Storage | Claude Opus 4.8 | aef844f | **Migration:** `097_document_storage.sql` — private buckets `resumes`, `dot-applications`, `screening-reports`; `resumes.storage_path` + nullable `ipfs_hash`; RLS owner-prefix policies. **New:** `lib/document-storage.ts`, `/api/documents/signed-url`, `lib/fetch-document-url.ts`. **Switched uploads:** `/api/resumes/upload`, `/api/resumes/[id]/verify`, `ResumeUpload`, `ResumeUploadWithPrefill`, `ResumeUploadWithVerification`; `/api/ai/parse-resume` reads signed URL. **Switched reads:** hub/career-card/public/dev-card/projected-career-card APIs emit `documentUrl`; client surfaces use signed URLs (no Pinata gateway). **Deleted:** `lib/ipfs.ts`, `lib/resume-ipfs-guards.ts`, `pinata-web3`. ~7 test IPFS docs not migrated. Apply **097** via Supabase dashboard. `npm run build` green. **Next:** D3 substeps or D5 after D3. |
| 2026-06-01 | D2 — decommission Base-Sepolia registries | Claude Opus 4.8 | 2387eb2 | **Deleted:** `/api/blockchain/submit-driver-application`, `/api/blockchain/verify-resume`, `resume-registry-onchain.ts`, `driver-contract.ts`, `contract.ts`, `contract-constants.ts`, `typed-data.ts`, `alchemy-webhooks.ts`, `scripts/deploy-resume-registry.js`, `scripts/test-contract-local.js`. **Archived → `contracts/legacy/`:** `ResumeRegistry.sol`, `ProductionDriverRegistry.sol` (+ README). **Refactored:** resume + DOT verify routes → DB-flag only (`verification_status='VERIFIED'`, no chain tx); `ResumeUploadWithVerification` calls `/api/resumes/[id]/verify`; `EmploymentVerificationForm` drops on-chain submit after DB save. **Removed npm scripts:** deploy:local/base-sepolia/base, verify:base*, test:local. ~7 test on-chain anchors disposable. Accio MVR/PSP untouched. `npm run build` green. **Next:** D3 (substepped; audit after D3.3). |
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

**Last updated:** 2026-07-14 (P3.7 DEC-2026-07-001 + DOT honesty pass; Key still only blocks P3.4-B / P3.6 Midnight copy)
