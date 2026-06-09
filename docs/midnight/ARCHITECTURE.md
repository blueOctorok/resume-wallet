# Storm Architecture — v2 (May 2026)

**This is the canonical strategic + architectural reference for Storm going forward. If anything in another doc contradicts this one, this one wins.**

Status as of **2026-05-22**: planning complete, Phase 1 has not yet started. The Sepolia + IPFS + Alchemy stack described here is **legacy** and will be retired during Phase 1.

---

## The product, in one sentence

Storm is a **portable, composable Driver Qualification (DQ) file platform** for the trucking industry, where credential verifications are eventually backed by **selective-disclosure cryptographic proofs** that competitors cannot retrofit.

The moat is *selective disclosure of verified credential facts*. The chain is the eventual implementation of that moat, not the moat itself.

---

## The strategic shift (read this first)

Storm was originally built as a "blockchain-verified" platform on Base Sepolia: documents (resumes, DOT applications) are stored on IPFS via Pinata, and their hashes are stamped on-chain through two registry contracts (`ResumeRegistry`, `ProductionDriverRegistry`). Authentication is via Alchemy Account Kit smart wallets. Payments are USDC via Base Pay. The STORM ERC-20 token sits on Base for rewards.

**This delivers ~30% of the original product vision.** The chain stamps hashes; it doesn't actually do verification work. Carriers still see whole PDFs (full disclosure, including PII). The "verified on-chain" badge is decorative — a competitor could replicate it in two weeks without using a blockchain at all.

The new direction:

1. **Web2 stack for everything user-facing.** Email/Google/magic-link sign-in via **Supabase Auth** (already paid for on Supabase Pro), Stripe payments, Supabase Storage for documents. Drop Alchemy, Base, USDC payments, IPFS/Pinata for primary storage.
2. **Selective-disclosure UX as the moat.** Carriers see verified facts (✓ clean MVR, ✓ Class A CDL with hazmat) instead of PDFs. Candidate-controlled disclosure toggles per audience.
3. **Cryptographic backbone on Midnight — active track.** Phase 2 backs the UX with **signed attestations** (JWT-style platform signatures); that shipped. Phase 3 swaps the implementation for **Midnight ZK proofs** behind the same interface. The driver is **go-to-market** — being an early *real* regulated-industry use case on Midnight while that's still novel — not waiting for a customer to demand non-repudiation (DEC-2026-06-001). Build it for real; the quality bar is absolute.

**The chain becomes invisible backend infrastructure** when Phase 3 ships. End users never *interact with* Midnight — no wallet, no seed phrase, no gas, no signing — though Storm celebrates it as the public trust story (DEC-2026-05-016). The selective-disclosure UI looks identical whether the backend is signed JWTs or ZK proofs.

---

## Phased plan

### Phase 1 — Foundation cleanup (4–6 weeks)

Status: **not started**. Detailed task breakdown lives in [`PHASE_1_PLAN.md`](./PHASE_1_PLAN.md).

What ships:

- Email / Google / magic-link auth via **Supabase Auth** (locked 2026-05-22; see DEC-2026-05-008)
- Stripe Checkout for MVR / PSP / subscription payments
- Supabase Storage for resumes and document uploads
- Removal of Alchemy Account Kit, Base RPC, USDC payment buttons, Pinata, the ResumeRegistry / ProductionDriverRegistry contracts (Sepolia), wallet-balance UI, Coinbase Onramp
- STORM token decision: drop the Base Sepolia ERC-20 deployment in Phase 1, replace user-facing rewards with off-chain "Storm Points." **Phase 3 optionality preserved**: if Phase 3 ships, STORM may be reissued as a Midnight-native shielded token (private balances + private transfers). See [`DECISION_LOG.md`](./DECISION_LOG.md) DEC-2026-05-005 for the full rationale.

What stays:

- Supabase as source of truth (every `block_*` table, `user_profiles`, `companies`, `mvr_orders`, `psp_orders`, `applications`)
- Composable hub architecture (every block, the registry, `block-data.ts`, every block component)
- DOT/MVR/PSP product flows (Accio integration, screening webhooks, employer ordering)
- The career card, Stormi, Pace's existing data

End-user experience after Phase 1: standard SaaS onboarding (30s sign-up), credit-card payments, no crypto anywhere visible.

### Phase 2 — Selective-disclosure UX (3–4 weeks)

Status: **not started**.

What ships:

- Carrier-facing fact panels replacing raw document views ("✓ clean MVR" instead of MVR PDF)
- Candidate-controlled disclosure toggles per audience (which carriers see which facts)
- An `attestationService` interface that returns verifiable artifacts for facts about candidate data
- A signed-attestations implementation behind the interface (the platform digitally signs each fact; carriers verify the signature)
- A verification UI that shows "Verified by Storm on [date]" with optional technical-details expand

What does NOT ship in Phase 2:

- Real ZK proofs (deferred to Phase 3)
- Any blockchain interaction
- Any Compact contract
- Any new infrastructure beyond Vercel + Supabase + Stripe

End-user experience after Phase 2: the moat is visible to carriers. Candidates and carriers see a different product than they did pre-Phase-2 — verified facts, not documents. Mechanism is invisible.

### Phase 3 — Cryptographic backbone on Midnight (active track, GTM-driven)

Status: **active**. The trigger is **go-to-market + ecosystem** — being one of the first *real, regulated-industry* use cases on Midnight while that's still novel — not waiting for a customer to demand non-repudiation (DEC-2026-06-001). Build it end-to-end and genuine: a demo-grade or fake integration earns nothing and burns credibility. Market the vision now in "built on Midnight" framing; flip a per-fact "proven on-chain" claim only when that specific proof genuinely runs (DEC-2026-05-004 honesty guardrail retained).

What would ship:

- Compact contracts for the highest-value verification circuits (MVR clean, CDL valid, DOT compliant, employment range)
- A Midnight implementation behind the same `attestationService` interface
- Server-side proof generation (proof server runs on Cloud Run / Render / Fly — managed Docker host, not a Linux VM)
- One server-managed Midnight wallet that holds NIGHT and pays DUST for proof-submission gas
- Verification UI updated from "Verified by Storm" to "Verified on-chain" with optional explorer link

What does NOT change:

- The `attestationService` interface contract
- The selective-disclosure UI (looks identical)
- End-user authentication, payments, document storage — all stay Web2
- Pace's existing data, workflows, or product expectations

End-user experience after Phase 3: identical to Phase 2 except verification badges link to on-chain proofs. Drivers and carriers do not see Midnight, do not install a wallet, do not interact with NIGHT or DUST.

---

## The attestation service abstraction

The most important architectural decision in this plan.

### The interface

All verifiable facts about a candidate flow through a single TypeScript interface:

```typescript
// src/lib/attestation-service.ts (Phase 2 spec)

export interface AttestationService {
  /**
   * Generate a verifiable attestation that a specific fact about a candidate is true.
   * The implementation is swappable: signed JWT (Phase 2) → Midnight ZK proof (Phase 3).
   * Callers never know which.
   */
  proveFact(input: AttestationInput): Promise<Attestation>

  /**
   * Verify an attestation independently. Used by carrier-facing verification pages
   * and any third-party integrations.
   */
  verifyAttestation(attestation: Attestation): Promise<VerificationResult>
}

export interface AttestationInput {
  candidateUserId: string
  factType: FactType  // 'mvr_clean' | 'cdl_class_a' | 'dot_compliant' | etc.
  parameters?: Record<string, unknown>  // optional fact-specific params
  audienceId?: string  // optional — which carrier this attestation is scoped to
}

export interface Attestation {
  id: string
  factType: FactType
  factSummary: string  // human-readable: "Clean MVR (last 36 months)"
  disclosedFields: Record<string, unknown>  // selectively disclosed values (e.g. expiration date)
  issuedAt: string
  expiresAt?: string
  proof: ProofArtifact  // implementation-specific verifiable artifact
}

export type ProofArtifact =
  | { kind: 'signed_jwt'; jwt: string; issuer: string }       // Phase 2
  | { kind: 'midnight_zk'; txHash: string; proofId: string }  // Phase 3 (future)
```

### Rules

- **Every credential fact carriers see goes through `attestationService.proveFact()`.** Never read directly from `block_*` tables to render a "verified" badge.
- **The implementation lives behind one import.** Phase 2 ships `signed-jwt-attestation-service.ts`. Phase 3 will ship `midnight-attestation-service.ts`. Swapping is a one-line change in the service registry.
- **Verification pages call `verifyAttestation()`, not the implementation directly.** This keeps third-party verification working across implementation swaps.
- **`disclosedFields` is the selective-disclosure surface.** Whatever ends up in `disclosedFields` is what the carrier sees. Whatever doesn't is private. Phase 2 implementation chooses fields based on carrier scope; Phase 3 enforces this cryptographically via Compact's `disclose()` semantics.

### What this protects us from

- Building Phase 2 UX that's tightly coupled to JWTs and would require a rewrite for Phase 3
- Locking in a specific cryptographic implementation before customer requirements are concrete
- Discovering halfway through Phase 3 that the UI assumes a particular proof shape

This is the same pattern good engineering uses for `PaymentProvider` (Stripe today, swap later), `AuthProvider`, `ModelProvider`. Cryptographic infrastructure follows the same rule.

---

## What lives where (data model)

**Unchanged from current architecture.** The data model is the strongest piece of Storm and survives the migration intact.

| Data | Storage | Notes |
|---|---|---|
| Identity (name, email, phone, address) | `user_profiles` | Shared across all users |
| Auth credentials (email, password hash, OAuth tokens) | Supabase Auth (`auth.users` table inside the Supabase project) | New in Phase 1; `auth.users.id` matches `users.id` so RLS policies use `auth.uid()` directly |
| CDL info | `block_driver_cdl` | Unchanged |
| Driver employment history | `block_driver_employment` | Unchanged |
| MVR data | `block_driver_mvr` + `mvr_orders` + `mvr_results` | Unchanged |
| PSP data | `block_driver_psp` + `psp_orders` + `psp_results` | Unchanged |
| DOT applications | `driver_applications` | Unchanged |
| Education / skills / references | `block_education` / `block_skills` / `block_references` | Unchanged |
| Document files (resume PDFs, uploaded docs) | Supabase Storage (Phase 1) | Currently Pinata IPFS — migrating |
| Payment records | Stripe + `stripe_*` tables (new in Phase 1) | Currently `payment_tx_hash` references Base — migrating |
| Attestations (Phase 2+) | `attestations` table (new in Phase 2) | Stores the issued artifact + audit trail |
| ZK proof tx hashes (Phase 3+) | `attestations.proof_artifact` JSONB | Only when Phase 3 ships |

**Source of truth is always Supabase.** The chain (in Phase 3) only stores proofs *about* data that lives in Supabase. **Driver data is never on-chain in any form.** This is the most-misunderstood point about ZK and worth restating: Midnight stores proofs, not data. The data stays in Supabase forever.

---

## What gets removed in Phase 1 (audit trail)

Files / dependencies to delete or replace during Phase 1:

### Auth & wallet
- `src/lib/alchemy-account-config.ts`
- `src/components/AlchemyProvider.tsx`
- `src/lib/alchemy-transfers-api.ts`
- `src/lib/alchemy-token-api.ts`
- `src/lib/alchemy-simulation-api.ts`
- `src/lib/alchemy-webhooks.ts` (keep stub if useful, but no Alchemy)
- `src/lib/base-auth-middleware.ts` (replace with auth-provider middleware)
- `x-wallet-address` header pattern across ~50 API routes (replace with session-cookie auth)

### Payments
- `src/components/MvrPaymentButton.tsx`
- `src/components/PspPaymentButton.tsx`
- `src/components/wallet/SendUSDC.tsx`
- `src/components/wallet/SendSTORM.tsx`
- `src/components/USDCBalance.tsx`
- `src/components/STORMBalance.tsx`
- `src/components/WalletCard.tsx`
- `src/components/TransactionHistory.tsx`
- `src/app/api/wallet/*` (payment config endpoints)
- `src/app/api/mvr/payment/route.ts` (replaced with Stripe webhook)
- Coinbase Onramp integration

### Document storage
- `src/lib/ipfs.ts` (Pinata) → replaced with Supabase Storage helpers
- All `pinata-web3` SDK usage
- `src/components/ResumeUploadWithVerification.tsx` blockchain branch

### On-chain registries (legacy, will deprecate but keep contracts in repo for archival)
- `src/lib/contract.ts` (registry addresses) — can stay as historical reference
- `src/lib/resume-registry-onchain.ts` — delete after Phase 1
- `src/lib/driver-contract.ts` — delete after Phase 1
- `src/app/api/blockchain/submit-driver-application/route.ts` — delete
- `src/app/api/blockchain/verify-resume/route.ts` — delete
- `src/app/api/resumes/[id]/verify/route.ts` blockchain branch — replace with Phase 2 attestation flow
- The Solidity contracts in `contracts/` — keep in repo for historical reference but stop deploying

### STORM token (decision: drop on Base, optional Midnight reissue in Phase 3)
- `src/components/STORMBalance.tsx` (already in payments list)
- `src/lib/storm-contract.ts`
- `src/hooks/use-storm-token-balance.ts`
- `src/components/StormiCreditModal.tsx` STORM-token branches
- `contracts/StormToken.sol`, `RewardDistributor.sol`, `TreasuryDistributor.sol`, `FounderVesting.sol` — **move to `contracts/legacy/`** (preserved as historical reference; useful if Phase 3 reissues STORM on Midnight, since the ERC-20 supply / vesting model may inform the Midnight design)
- Replace user-facing reward UI with "Storm Points" (off-chain integer column on `users` table) OR remove entirely

### Stays untouched
- Every `block_*` table and `block-data.ts` helper
- Every block component (DOT, MVR, PSP, CDL, resume, etc.)
- The career card and `ProjectedCareerCard`
- Stormi (`ava-context.ts`, `ava-chat.ts`, `ava-brain.ts`)
- Accio integration (PSP / MVR XML pipeline)
- Composable hub architecture
- Employer hub, blocks, and screening flows
- The DOT application multi-step wizard

---

## Hosting and operational footprint

### Phase 1 (Web2 cleanup)
- **Vercel** — Next.js app (unchanged)
- **Supabase** — DB + Storage + **Auth** (locked 2026-05-22; see DEC-2026-05-008)
- **Stripe** — payments
- That's it. Zero new infrastructure to manage. Zero Linux. Zero Docker. Zero blockchain. **One vendor surface for DB + Storage + Auth** is part of the simplicity dividend.

### Phase 2 (selective-disclosure UX)
- Same as Phase 1. Phase 2 adds the `attestationService` and the carrier-facing UI but ships entirely on the existing stack. Signed attestations are issued from Next.js API routes using Node's `crypto` module.

### Phase 3 (Midnight — active track)
- Adds **one managed Docker container** for the Midnight proof server (Cloud Run / Render / Fly — pick one when the slice goes up).
- Public Midnight RPC endpoint for transaction submission (no self-hosted node initially).
- One server-managed Midnight wallet seed in env vars (similar to how `PRIVATE_KEY` works today for the registry contracts).
- **Still no Linux server to maintain.** Cloud Run handles OS, runtime, restarts, scaling. Operationally identical to how we use Vercel.

### Developer environment
- **Phases 1 + 2:** native Windows works fine. Pure TypeScript / Next.js work.
- **Phase 3 (active track):** Compact compiler is Linux/Mac only. On Windows, use **WSL2 + Ubuntu** (~30 min setup) when contract work begins. Day-to-day Next.js work remains native Windows.
- **A Mac is NOT required.** WSL2 closes most of the gap. No hardware purchase needed to start.

---

## Why Midnight (Phase 3 target — active track)

Locked-in choice for Phase 3, conditional on Midnight network maturity supporting the proof shapes we need (confirm during the toolchain de-risk step).

Selection rationale and alternatives considered live in [`DECISION_LOG.md`](./DECISION_LOG.md). Summary:

- **Midnight** — purpose-built for selective disclosure. Compact language. Mainnet live (federated). **Selected.**
- **Aztec** — Ethereum L2 with Noir. Alpha network with critical vulnerabilities pending v5 (~July 2026). Reconsider if Midnight has issues.
- **RISC Zero** — mature general-purpose zkVM, EVM-verifiable. Bonsai = no Docker. Fallback if Midnight matures slowly.
- **zkSync** — wrong tool. ZK-rollup for scaling, not privacy. Do not use.

The choice is reversible: the `attestationService` interface means Phase 3 can target Midnight, Aztec, or RISC Zero without changing Phase 2 code.

---

## Phase 3 arc (sequenced) + Phase 4 (gated)

**Updated 2026-06-09 (DEC-2026-06-002).** Phase 3a (core ZK proofs), Phase 3b (soulbound credential cards in the career card), and the Midnight-native STORM utility token are now **committed direction**, sequenced — not "captured, maybe someday." Phase 4 (cached-attestation marketplace) stays **gated on a formal FCRA opinion**. Sequencing discipline still holds: each slice has to stabilize before the next is designed, and the SBT/token layers come **after** the real one-fact Midnight slice verifies (don't mint SBTs on top of a proof backbone that isn't live yet).

The guardrails below are **not** softened by promotion to committed: soulbound stays non-transferable, the token stays pure-utility, and the rejected-ideas list (transferable credential NFTs, tradeable tokens, driver-as-vendor) stays rejected (`MOAT_THESIS.md`). Soulbound ≠ tradeable; utility ≠ security.

### Phase 3b — Soulbound credential SBTs (career card becomes the vault)

After Phase 3a (core ZK proofs) ships, the natural extension is to make each verified attestation visible to the candidate as a **non-transferable Soulbound Token (SBT)** — and the natural home for them is the **career card the candidate already has**. The career card is not a separate UI; it's already the candidate's primary identity surface, already shareable via token, already projects per-audience views via lenses. Phase 3b upgrades it from a Supabase projection into a verifiable artifact.

**The two-layer model:**

| Layer | Today | Phase 3b |
|---|---|---|
| **Career card** | Read-only projection of installed blocks (`/api/career-card`, `share_token` URL, lens views) | Same UX surface, now with a Midnight-anchored cryptographic identifier proving the card is irreplicably this candidate's |
| **Credential cards** (CDL, MVR, employment, DOT) | Data inside `block_*` tables, surfaced via career card sections | Each verified attestation gets minted as an SBT that lives *inside* the career card. Lenses still control which credentials each audience sees. |

**Invariants (do not break):**

- **Soulbound to `users.id`, not to a wallet address.** Storm holds the on-chain anchor server-side. **Candidate never sees a wallet, never signs a transaction, never holds a seed phrase.**
- **Non-transferable, period.** No secondary market. No "trade your CDL" feature ever. Transferability would break verification.
- **Storm-issuable, candidate-controlled, Storm-revocable** when underlying credential lapses or fraud detected. Same posture as DEC-2026-05-011 candidate-as-agent.
- **Selective disclosure stays at the credential-card level**, layered through existing lenses. Candidate proves possession of `clean_mvr_12mo` to a specific carrier; full MVR data is never disclosed.
- **Carrier-facing URL doesn't change.** `/card/{token}` still works the same way. Phase 3b adds the cryptographic verification underneath; the access surface is unchanged.
- **Career card mints at signup**, before any credentials exist. Empty career card = soulbound shell with zero credentials inside. This preserves the rule from `product-philosophy.mdc`: "Never gate the career card behind completion."

**Open design questions (don't need answers until trigger condition met):**

- One SBT layer (only credential cards) vs. two (career card itself also minted)? Lean toward one: career card is a logical container; only individual credentials are minted on-chain. Lower complexity, same UX outcome.
- Renewals: each new MVR / annual review = new credential SBT, supersedes the prior. Default lens views show only most recent. Old SBTs remain on-chain for audit trail (matches FMCSA "annual review" expectations from DQ file Item 6).
- "Verified Storm career card" badge vs. simply showing verified credential SBTs inside it. Probably the latter — the badge becomes the *count* of verified SBTs visible, not a separate signifier.

**Why this is structurally elegant:** the career card already exists, already feels owned by the candidate, already shows up to carriers as the primary identity surface. We're not building a new credential vault — we're upgrading what already has the right shape.

**Sequencing (committed, DEC-2026-06-002):** begin design once Phase 3a is in production with at least one carrier consuming attestations. This is the *next* layer, not a maybe.
**Estimated effort:** 1–2 weeks of UI work on top of Phase 3a output (lower than originally estimated because career card UI surface already exists).

### Phase 3b — STORM as Midnight-native shielded utility token

Reissue option preserved in DEC-2026-05-005 Option B. The shape if/when it ships:

- **Shielded by default** on Midnight — driver balances are private; their pay-per-credential history isn't visible on-chain.
- **Earned by drivers** for verifying credentials, completing DOT app, accepting placements, referring drivers.
- **Earned by carriers** for subscribing, sponsoring driver verifications.
- **Spent on platform discounts** — reduced MVR pulls, premium career card features, expedited verification, premium talent search.
- **No profit-sharing, no governance over Storm corp** — pure utility, designed to stay outside the Howey test.
- **UX label: "Storm Points."** The on-chain token is the implementation; the surface is points. Candidates and carriers never need a wallet.

**Sequencing (committed, DEC-2026-06-002):** Phase 3a + 3b SBT layer in production. Storm Points run off-chain today (DEC-005 Option B); reissuing on Midnight is a substrate change to a working system, not a new product. Stays pure-utility (no profit-share, no governance) to remain outside the Howey test.

### Phase 4 — Cached-attestation marketplace (driver economic compounding)

When a driver self-funds an MVR, the resulting verified attestation can be re-queried by multiple carriers within its 30-day freshness window. Today every carrier pays for a fresh pull. The Phase 4 model routes some of that economic value back to the driver:

- Carrier UI surfaces two paths: **Fresh pull** (~$35 via Accio + Storm margin) or **Recent attestation query** (~$15, available only if pulled within 30 days, only with driver's selective-disclosure consent).
- Recent-attestation revenue split: **driver receives ~$5, Storm keeps ~$10**. Carrier saves ~$20.
- **Storm mediates every transaction** — driver is never a vendor, no FCRA "consumer-report-resale" exposure, no Lace wallet, no driver-side crypto UX. Driver receives Storm Points or cash payout via existing rails (Stripe Connect, ACH).
- **Pace co-design required** before any rollout. When a candidate was sourced through Pace, Pace gets routed economics on cached pulls. This is a feature Pace explicitly enables for their drivers, not a default behavior.
- **Hard 30-day cliff.** After 30 days, only fresh-pull path is available. Maintains MVR currency requirements (FMCSA + carrier policy).

**Why we're uniquely positioned:** previous Web3 "credential marketplace" attempts failed because buyers didn't trust the verifications. Phase 2 (signed JWT) and Phase 3a (ZK proofs) both solve that trust problem. The marketplace economics get to ride on top of real verification.

**Trigger conditions to start design:**
1. Phase 2 in production with N drivers and M carriers (concrete numbers TBD when we get there)
2. Pace stakeholder explicitly engaged as co-designer
3. FCRA legal review (DEC-2026-05-011 trigger conditions) completed

**Why this fits the philosophy:** drivers who self-invest in verification compound economically. Carriers save money on amortized pulls. Storm captures middle margin. Pace's revenue is preserved through routed economics. Selective disclosure remains the moat — driver still chooses which facts to reveal per query.

### Rejected ideas (do not revisit without reading the rejection reasoning)

The following ideas have been deliberately rejected. They are captured in [`MOAT_THESIS.md`](./MOAT_THESIS.md) "Rejected feature ideas" appendix with full reasoning. Future sessions should not propose them without re-reading why they were rejected:

- Tokenized DQ files as transferable NFTs
- Tradeable / fungible credential tokens
- Driver-as-vendor-of-own-data with Lace wallet UX
- Income-share agreement tokens against driver future earnings
- "Verified driver pool" tokens (fractional ownership of drivers)
- Storm becoming a Consumer Reporting Agency (DEC-2026-05-011)

---

## What this is NOT

To prevent confusion in future sessions:

- **NOT a multi-chain product.** No bridges, no cross-chain anything. One chain is involved (Midnight, Phase 3+). Users never see it.
- **NOT a "Web3 hiring app"** in the dated, crypto-bro sense — no feed, no speculation, no wallet UX. But the cryptography is **not** hidden either: Storm celebrates Midnight / zero-knowledge / selective disclosure as its public credibility narrative (`stormchain.ai`, DEC-2026-05-016), and the chain is **load-bearing** for network-independent portable trust (DEC-2026-06-002). The positioning is "verified, driver-owned credentials, built on Midnight" — honest about the tech, never faking a per-fact proof before it runs.
- **NOT abandoning Pace.** Pace is the anchor customer. Phase 1 ships them a *better* product (Stripe payments, faster onboarding). Phase 2 makes the moat visible to them. Phase 3 deepens it cryptographically when Pace's customers (large carriers) demand it.
- **NOT putting driver data on chain.** Ever. The chain only ever stores proofs *about* data. Data stays in Supabase.
- **NOT a token-first project.** STORM ERC-20 is dropped on Base in Phase 1; user-facing rewards run as off-chain Storm Points today. A Midnight-native shielded **utility** STORM is committed roadmap (DEC-2026-06-002, sequenced after the SBT layer) — but the platform is built around verified driver-owned credentials, and the token serves that, not the other way around. Pure utility only (no profit-share, no governance); the moat leads, the token follows.
- **NOT a "candidate owns their data" maximalist platform.** The product is "candidate controls disclosure." Data custody stays with Storm — same as today, same as Stripe holds payment data, same as Supabase Auth holds session credentials.

---

## Talking points for non-technical audiences

For boss conversations, pitch decks, sales calls. The language to use:

- **"Verified facts, not documents."** Carriers see "✓ clean MVR, ✓ Class A with hazmat" — they don't see the underlying PII.
- **"Mathematically verifiable."** Cryptographic, not "we promise it's true."
- **"Permanent, portable, no phone calls."** What the boss originally asked for. Selective disclosure delivers all three plus privacy.
- **"Structurally moated against Tenstreet, HireRight, DriverFacts."** They are CRAs that produce full-disclosure reports. Retrofitting selective disclosure would require rebuilding their platform and renegotiating every agreement they have. They cannot copy this in a reasonable timeframe.
- **"FCRA-friendly posture."** Storm becomes a *prover* of facts about regulated reports, not a *re-host* of them. Better legal posture than the current "we host MVR PDFs" model.

Avoid in non-technical contexts: zero-knowledge proofs, ZK, blockchain, Midnight, Compact, NIGHT/DUST, Cardano, Layer 2. These belong in technical documentation and engineering conversations only.

---

## Open questions / things to revisit

- ~~**Auth provider choice (Clerk vs. Supabase Auth):**~~ ✅ resolved 2026-05-22 → **Supabase Auth** (DEC-2026-05-008). Sign-in UI is custom-built with Storm's existing UI primitives.
- **STORM token decision (Base drop, Midnight reissue criteria):** Phase 1 default is drop on Base, replace with off-chain "Storm Points." Open: define the criteria that would trigger a Phase 3 Midnight reissue (e.g., "drivers ask for transferable rewards," "carriers want to pay attestation refresh fees in-platform," "investor demand for token-driven economics").
- **Phase 3 trigger:** What specifically constitutes "customer demand for cryptographic non-repudiation"? Define the trigger criteria before Phase 2 ships so Phase 3 doesn't get triggered by speculation.
- **Annual MVR review (Item 6 of DQ file, per `PROJECT_ROADMAP.md`):** how does this interact with attestation expiration? Probably: each MVR generates a new attestation that supersedes the old. Worth specifying in Phase 2 design.
- **Migration plan for existing on-chain records:** A handful of users (mostly internal testing) have records on Sepolia. Decision: archive the contract data to Supabase, abandon the contracts. No live customer data depends on the chain.

---

## External Midnight references (for AI sessions doing Phase 3 work)

- **Docs root:** [`https://docs.midnight.network/`](https://docs.midnight.network/)
- **Full docs index (LLM-friendly):** [`https://docs.midnight.network/llms.txt`](https://docs.midnight.network/llms.txt) — a single 154 KB / 1600+ line index of every Midnight documentation page. Use this to discover specific pages, then fetch on-demand. **Do not load this whole index into context every session — fetch the specific pages you need.**
- **Token primitives example:** [`https://docs.midnight.network/examples/contracts/token-transfers`](https://docs.midnight.network/examples/contracts/token-transfers) — reference for shielded + unshielded token mint / transfer / burn (relevant to DEC-2026-05-005 Midnight STORM optionality).
- **Compact stdlib reference:** [`https://docs.midnight.network/compact/standard-library/exports`](https://docs.midnight.network/compact/standard-library/exports) — `mintShieldedToken`, `mintUnshieldedToken`, `disclose`, `tokenType`, etc.
- **Midnight MCP server (AI-assisted Compact dev):** Midnight publishes an MCP server with indexed knowledge of 102 Midnight repos, real Compact compiler validation, and version-aware syntax references. **Worth installing in Cursor before Phase 3 starts.** See the docs index above under `ai-tools/midnight-mcp-ai-assisted-development`.

These are fetched on-demand by AI sessions, not preloaded. Phase 1 + 2 sessions don't need any of this; Phase 3 sessions read selectively as needed.

---

## Document map

| Doc | Purpose |
|---|---|
| [`EXECUTION_CHECKLIST.md`](./EXECUTION_CHECKLIST.md) | **The migration tracker.** Atomic AI-session-sized steps with Pace invariants, dual-mode strategy, rollback playbook, and session-handoff log. Every migration session opens this first. |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) (this file) | Master strategic + architectural reference |
| [`PHASE_1_PLAN.md`](./PHASE_1_PLAN.md) | High-level Phase 1 task breakdown by track (atomic steps live in `EXECUTION_CHECKLIST.md`) |
| [`MOAT_THESIS.md`](./MOAT_THESIS.md) | The moat reasoning, structured for non-engineering audiences |
| [`PARTNERS.md`](./PARTNERS.md) | How Storm strengthens Pace specifically and stays open to other agencies / carriers |
| [`DECISION_LOG.md`](./DECISION_LOG.md) | Why Midnight, why not Aztec / RISC Zero / zkSync |
| [`new-direction.md`](./new-direction.md) | Original boss memo (kept for historical reference) |
| `.cursor/rules/strategic-direction.mdc` | Always-applied rule that summarizes this for every session |
| `.cursor/rules/attestation-architecture.mdc` | Rule for working on verification / credential code |

---

**Last updated:** 2026-05-22
**Owner:** Engineering (sole)
**Phase status:** Pre-Phase-1 (planning complete, no code changes started)
