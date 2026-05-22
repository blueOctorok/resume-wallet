# Decision Log — Cryptography Stack

**Purpose:** capture every architectural decision made during the May 2026 strategy reset, the alternatives considered, and the rationale. Future maintainers should be able to revisit any decision and understand exactly why it was made.

Decisions are listed newest first.

---

## DEC-2026-05-001 — Web2 stack as primary, ZK as deferred upgrade

**Date:** 2026-05-22
**Status:** Accepted
**Decided by:** Boss + sole engineer

### Context

Storm was originally built as a Web3-first product on Base Sepolia: Alchemy Account Kit smart wallets for auth, USDC for payments, IPFS via Pinata for documents, two registry contracts (`ResumeRegistry`, `ProductionDriverRegistry`) for hash-stamping. STORM ERC-20 token planned as reward currency. After 6 months in development, the product delivers ~30% of the original boss vision: documents are stamped on-chain, but carriers still see full-disclosure PDFs and the "blockchain verified" badge does no real verification work.

### Decision

Move all user-facing infrastructure to Web2 (Vercel + Supabase + Stripe + Supabase Auth). Defer cryptographic verification to a Phase 3 implementation behind an `attestationService` interface. Phase 2 ships the selective-disclosure UX with simpler signed attestations.

### Alternatives considered

1. **Stay on Base + add ZK on top** — possible (RISC Zero proofs verifiable on EVM). Rejected because Base's strengths (cheap gas, EVM compatibility, smart wallets) don't matter once payments are off Base, and we lose the privacy strengths of a purpose-built privacy chain.
2. **Migrate fully to Midnight including auth and payments** — rejected because Midnight has no equivalent to Alchemy Account Kit (no smart-wallet abstraction, only Lace browser-extension wallet with seed phrases). End-user experience would degrade significantly.
3. **Multi-chain hybrid (auth on Base, proofs on Midnight)** — rejected because it doubles operational complexity for no user-visible benefit. The chain itself isn't the moat.

### Consequences

- Loses: any "Web3 product" branding angle, any USDC payment flow, any DePIN-flavored marketing.
- Gains: 30-second onboarding, Stripe payments, professional SaaS feel, drastically simpler infrastructure, optionality on which ZK chain (if any) eventually ships.
- Engineering effort: 4–6 weeks for Phase 1, 3–4 weeks for Phase 2.
- Existing users: minimal disruption — wallet-bound users get migrated to email auth in Phase 1.

---

## DEC-2026-05-002 — Midnight as Phase 3 ZK target

**Date:** 2026-05-22
**Status:** Accepted (conditional on Midnight maturity at trigger time)
**Decided by:** Sole engineer + boss approval

### Context

When Phase 3 ships (deferred until customer demand triggers it), Storm needs a privacy-preserving cryptography stack that supports selective disclosure of facts about candidate data without revealing the underlying data. Several options exist as of mid-2026.

### Decision

Target **Midnight** for Phase 3, with the option to fall back to Aztec or RISC Zero if Midnight has not matured past federated phase by Phase 3 trigger time.

### Alternatives compared

| Property | Midnight | Aztec | RISC Zero | zkSync |
|---|---|---|---|---|
| Purpose | Selective disclosure (privacy-first) | Privacy-first L2 on Ethereum | General-purpose zkVM | ZK-rollup for scaling (NOT privacy) |
| Status (May 2026) | Mainnet (federated) | Alpha network with critical vulns | Production / mature | Production / mature |
| Language | Compact (TypeScript-flavored) | Noir (Rust-flavored) | Rust | Solidity |
| Selective disclosure model | Native (`disclose()` semantics) | Native (Aztec privacy) | Built manually in zkVM | Not designed for this |
| Tooling stability | New, evolving | Major v5 upgrade pending (~July 2026) | Mature | Mature |
| Verifier infrastructure | Midnight native | Ethereum L1 + Aztec contracts | Anywhere (Bonsai cloud, EVM, etc.) | zkSync L1 |
| Maturity for production | Early (federated) | Alpha — not recommended | Production-grade | Production-grade |
| Fits Storm's use case | **Yes** | Yes (eventually) | Yes (more work) | **No** |

### Why not zkSync

zkSync is a **ZK-rollup for Ethereum scaling**. It uses zero-knowledge cryptography to verify L2 transactions on L1, not to enable selective disclosure of application data. Building selective-disclosure UX on zkSync would require building the ZK proof system *on top of* zkSync — using zkSync only as L2 transaction settlement, with the actual privacy work happening at the application layer using a different stack (RISC Zero, snarkjs, etc.).

zkSync's appearance on Alchemy is a red herring — it means Alchemy supports zkSync as an EVM-style L2 endpoint, not that zkSync is a privacy chain.

**zkSync is the wrong tool for selective disclosure.** Removed from consideration.

### Why Midnight over Aztec

- **Midnight's mainnet (federated) is live.** Aztec is alpha with known critical vulnerabilities pending v5 (~July 2026). For a Phase 3 that ships in late 2026 / 2027, Midnight is more likely to be production-stable.
- **Midnight's Compact language is TypeScript-flavored.** Aztec's Noir is Rust-flavored. The team writing Storm (one engineer with TypeScript fluency) will be more productive in Compact.
- **Midnight is purpose-built for selective disclosure.** Aztec is purpose-built for "private DeFi on Ethereum" — privacy is a goal, but the design point is finance-shaped. Midnight's `disclose()` semantics align with our credential-disclosure use case more naturally.
- **Midnight is a Cardano partner chain, not Ethereum.** This is *good* for our use case — we're not trying to compose with Ethereum DeFi. Cardano's ecosystem positioning (compliance, regulated industries) actually aligns with trucking compliance.
- **Aztec's L2-on-Ethereum nature has cost implications.** Posting proof commitments to Ethereum L1 carries gas. Midnight's native economic model (DUST is metered per shielded operation, not per Ethereum gas) is more predictable for a high-volume attestation system.

### Why Midnight over RISC Zero

- **RISC Zero is a zkVM, not a chain.** It would let us prove arbitrary Rust programs and verify proofs on Ethereum or anywhere. This is *more flexible*, but flexibility is a tax for our use case. Midnight already provides the chain + economic model + verifier infrastructure as a package.
- **RISC Zero requires us to design the credential-disclosure protocol from primitives.** Midnight ships circuits and `disclose()` semantics specifically for this. Less original cryptography to author and audit.
- **RISC Zero proofs verified on EVM leak metadata.** Storm doesn't want any chain-side observers to learn anything about which candidate or which carrier is involved. Midnight's shielded-by-default model handles this; RISC-Zero-on-EVM requires careful additional design.

RISC Zero remains the **fallback choice** if Midnight has not matured past federated phase by Phase 3 trigger time. The `attestationService` interface ensures the swap is a one-line implementation change.

### Reversibility

This decision is **fully reversible** because of the `attestationService` interface (DEC-2026-05-003). If Midnight has problems at Phase 3 trigger time, swap to RISC Zero or Aztec. Phase 2 work doesn't lock us in.

---

## DEC-2026-05-003 — Attestation service interface as architectural seam

**Date:** 2026-05-22
**Status:** Accepted
**Decided by:** Sole engineer

### Context

Phase 2 ships selective-disclosure UX backed by signed JWT attestations. Phase 3 (when triggered) replaces the implementation with Midnight ZK proofs. We need an architectural seam that lets the implementation change without rewriting Phase 2 code.

### Decision

Define an `AttestationService` TypeScript interface in `src/lib/attestation-service.ts` (Phase 2). All credential-fact rendering, employer-facing verification UIs, and third-party verification endpoints call this interface. The implementation is registered once in a service registry and swappable by environment variable or build flag.

```typescript
export interface AttestationService {
  proveFact(input: AttestationInput): Promise<Attestation>
  verifyAttestation(attestation: Attestation): Promise<VerificationResult>
}
```

Phase 2 ships `signed-jwt-attestation-service.ts`. Phase 3 ships `midnight-attestation-service.ts`. The interface stays stable.

### Alternatives considered

1. **Per-fact one-off implementations** — rejected. Would require parallel rewrites in Phase 3 across every credential type.
2. **Build directly against ZK from the start** — rejected. Phase 3 is conditional and may never ship; locking in to ZK before validating the UX is wasteful.
3. **Don't abstract — assume Phase 2 is permanent** — rejected. The whole point of the strategy is *optionality* on Phase 3. Tightly coupling to JWTs would erase that.

### Consequences

- Adds one interface and one implementation file in Phase 2.
- Phase 3 (if triggered) is a clean swap, not a rewrite.
- Third-party integrations (carrier APIs, audit tools) bind to the `verifyAttestation` shape, which we control.

---

## DEC-2026-05-004 — Defer Phase 3 (Midnight) until customer-driven

**Date:** 2026-05-22
**Status:** Accepted
**Decided by:** Boss + sole engineer

### Context

Phase 3 ships actual ZK proofs on Midnight. It involves Compact contracts, a proof server (managed Docker), Midnight wallet management, and operational complexity. Phase 2 (signed attestations) already delivers the user-visible moat.

### Decision

**Do not start Phase 3 work until a customer, regulator, or investor explicitly requires cryptographic non-repudiation.** Trigger criteria to be defined formally before Phase 2 ships, but examples:

- A carrier requires proof that Storm's signatures cannot be forged by Storm itself.
- A regulator demands cryptographic guarantees about disclosure correctness.
- An investor due-diligence process requires the chain story to be live, not theoretical.
- A customer offers a contract conditional on ZK availability.

If none of these happen, Phase 3 stays deferred indefinitely. Storm operates on Phase 2 attestations forever and is fine.

### Alternatives considered

1. **Build Phase 3 immediately after Phase 2** — rejected. Speculative work; high opportunity cost; no customer demand validates it.
2. **Build Phase 3 in parallel with Phase 2** — rejected. Doubles engineering load with one engineer; risks shipping neither.
3. **Skip Phase 3 entirely, commit to JWT attestations forever** — rejected. Loses the cryptographic moat; weakens the long-term defense against incumbents who eventually figure out selective disclosure.

### Consequences

- Engineering capacity stays focused on Phase 1 + Phase 2 for the next ~10 weeks.
- The "blockchain story" for fundraising remains aspirational but credibly architected (interface + plan + chain selection).
- If the customer trigger never arrives, Storm has all the moat benefits with none of the operational complexity. This is a *good* outcome.

---

## DEC-2026-05-005 — STORM ERC-20 token: drop on Base in Phase 1, preserve Midnight reissuance optionality (Option B)

**Date:** 2026-05-22 (revised same day after confirming Midnight token capabilities; **locked 2026-05-22**)
**Status:** **Accepted (Option B)**
**Decided by:** Boss + sole engineer

### Pre-flight pick (2026-05-22)

Of the three options posed at pre-flight time:
- **Option A** — Drop STORM entirely, never revisit
- **Option B** — Drop Base STORM in Phase 1, replace with off-chain `storm_points` designed to map 1:1 to a future Midnight-native token in Phase 3 *(picked)*
- **Option C** — Keep Base STORM and run dual-chain

**Boss picked Option B.** Implementation is **not urgent** — schema + helpers are foundation work and small enough to ship as part of Track 5. UI for earning new points can wait until a real reward use case emerges; the existing Base STORM reward earnings (today: ~zero) get migrated to off-chain points and the Base contract is decommissioned.

### Context

The original tokenomics (`docs/TOKEN_STRATEGY.md`) plans STORM as an ERC-20 with fixed 50M supply on Base, USDC-backed, used for rewards. The token is currently deployed only to Sepolia (testnet), has zero real users, and is not load-bearing for any customer flow.

**Midnight token capabilities (confirmed 2026-05-22):** Compact contracts can mint **shielded tokens** (private balances + private transfer amounts via `mintShieldedToken`) and **unshielded tokens** (public, similar to ERC-20, via `mintUnshieldedToken`). See [Midnight Compact standard library](https://docs.midnight.network/compact/standard-library/exports) and the [token transfers example](https://docs.midnight.network/examples/contracts/token-transfers). Shielded tokens are a Midnight-native primitive with no equivalent on production Ethereum-style chains (Aztec is closest but alpha; zkSync does not support this).

### Decision (tentative)

**Two-part decision:**

1. **Phase 1: drop the Base Sepolia STORM ERC-20 deployment.** Replace user-facing rewards with an off-chain `users.storm_points` integer column plus a `storm_points_ledger` audit table. Move Solidity contracts to `contracts/legacy/` for historical reference; do not deploy.
2. **Phase 3 (deferred): preserve the option to reissue STORM as a Midnight-native token** if and when a token use case emerges that justifies the cryptographic infrastructure. **Default expectation: shielded STORM**, because shielded balances align with Storm's selective-disclosure moat. Migration path: off-chain `storm_points` balances convert 1:1 to Midnight STORM at issuance.

The Phase 1 part is firm. The Phase 3 part is **optionality preserved, not commitment.** No work is done toward Midnight STORM until a use case is concrete (same trigger discipline as DEC-2026-05-004 for Phase 3 generally).

### Why preserve the Midnight optionality

Midnight's shielded-token primitive is genuinely novel and aligns with Storm's existing moat:

- **Shielded balances** mean rewards are private by default. No public balance leak. Carriers, other drivers, and external observers cannot see who has what.
- **Token-gated premium features** become possible without leaking holder balances. ("Drivers with 5,000+ STORM get priority career-card placement" is enforceable cryptographically; the balance check happens in a circuit, not against a public ledger entry.)
- **Driver-to-driver / driver-to-employer transfers** (referral bounties, attestation refresh fees) get private settlement without an off-chain layer.
- **Migration cost is low.** Off-chain `storm_points` is the canonical balance source; converting to a Midnight token at issuance time is a one-time mint + ledger snapshot.

These are reasons the option is **valuable to preserve**, not reasons to ship a Midnight token now.

### Alternatives considered

1. **Defer the Base deployment (keep contracts ready, don't deploy)** — rejected. Adds operational ambiguity ("is the token live or not?") without preserving meaningful optionality, since the Sepolia infrastructure is going away regardless.
2. **Drop forever, never revisit** — rejected for being unnecessarily restrictive. Costs nothing to preserve the Midnight option; doing so reads honestly in conversations with stakeholders who ask "what about a token?"
3. **Keep STORM on Base, separate from the ZK story** — rejected. Defeats the purpose of dropping Base/Alchemy entirely; one foot in Web3 invites marketing confusion.
4. **Mint Midnight STORM in Phase 1 alongside the off-chain points** — rejected. Phase 1 is Web2 cleanup; introducing any chain dependency contradicts the phase's goal. Midnight tokens require Phase 3 infrastructure (proof server, server-managed Midnight wallet) which is itself deferred.

### Consequences

- **Off-chain points keep all current reward mechanics functional.** No customer-facing change beyond UI label ("Storm Points" instead of "STORM token rewards").
- **`docs/TOKEN_STRATEGY.md` needs revision or archival.** Its Base-USDC-backed model is superseded; if revised, it should describe (a) current off-chain points and (b) potential Midnight reissue mechanics.
- **Phase 1 STORM removal is reversible cheaply** — issuing a fresh Midnight STORM in Phase 3 doesn't require unwinding any Phase 1 work.
- **Marketing language is cleaner now:** the public position is "Storm Points are our current reward mechanism; a Midnight-native token is on the table for the future, contingent on customer demand." Better than "we had a token, we killed it" or "we have a token, but it doesn't do anything."

### What this means for execution

- `EXECUTION_CHECKLIST.md` Track 5 still ships in Phase 1 (drop Base STORM, replace with off-chain points). No changes to the atomic steps.
- The `storm_points_ledger` schema should be designed with eventual on-chain migration in mind: every credit / debit row is a candidate for a future on-chain mint when (and if) Midnight STORM ships. This is just good schema hygiene; not extra work.
- If Phase 3 ships and a token use case emerges, write a new decision (DEC-XXXX-XX-XXX) authorizing the Midnight STORM design + issuance.

---

## DEC-2026-05-006 — Stripe as payment provider (drop USDC + Coinbase Onramp), with Pace billing deferred

**Date:** 2026-05-22 (revised 2026-05-22 to lock pre-flight detail)
**Status:** **Accepted** (locked 2026-05-22)
**Decided by:** Boss + sole engineer

### Context

Today's MVR/PSP/subscription flows accept USDC on Base via Alchemy smart wallets. Coinbase Onramp lets users buy USDC. Stripe is the standard credit-card payment provider that every employer is already used to.

### Decision

Replace all USDC payment flows with **Stripe Checkout (one-time payments)** and **Stripe Subscriptions (recurring plans)**. Drop Coinbase Onramp. Build the full billing capability — Checkout, Subscriptions, webhooks, customer portal — but **do not bill Pace immediately**. Pace continues operating during the migration without a Stripe subscription in place; their billing transition is a separate stakeholder conversation tracked under "Pace cutover" in `EXECUTION_CHECKLIST.md`. New customers / non-Pace employers use Stripe from day one.

### Why defer Pace billing

- Pace is the anchor customer; introducing a billing change mid-migration adds risk to a relationship Storm depends on.
- Stripe is being **wired**, not **enforced**. The plumbing must be production-ready so the moment Pace transitions, no engineering work is on the critical path.
- During the deferral window, Pace orders MVR/PSP via an admin-internal flow (free placement orders or invoice-after-the-fact) that does not require a Stripe customer. This is a small admin-only scope and does not affect the candidate experience.

### Alternatives considered

1. **Dual-mode (Stripe + USDC)** — rejected. Doubles maintenance burden; "USDC option" is unused by Pace and any other realistic carrier customer.
2. **Keep USDC for STORM rewards distribution** — moot if STORM is dropped (DEC-2026-05-005).
3. **Use a different processor (Paddle, Lemon Squeezy)** — Stripe is the default; no compelling reason to differ.

### Consequences

- Carriers pay with credit card / ACH like every other SaaS they use.
- Removes ~10 wallet-flavored UI components.
- `mvr_orders.payment_tx_hash` and `psp_orders.payment_tx_hash` columns become legacy; new columns `mvr_orders.stripe_session_id` / `psp_orders.stripe_session_id` take over.
- Refunds become trivial (Stripe Dashboard or API) instead of multi-sig USDC operations.

---

## DEC-2026-05-007 — Document storage: Supabase Storage replaces Pinata IPFS

**Date:** 2026-05-22
**Status:** Accepted
**Decided by:** Sole engineer

### Context

Today's resume PDFs and uploaded documents are stored on IPFS via Pinata. The IPFS hash is stamped on-chain in `ResumeRegistry`. This delivers "permanence" only as long as Storm pays Pinata's pinning fee — and even then, every retrieval depends on a Pinata gateway being live.

### Decision

Move all document storage to **Supabase Storage**. The IPFS hash + on-chain stamp become legacy; new uploads go to Supabase buckets with RLS. Phase 1 includes a one-time migration that re-uploads existing IPFS-hosted documents to Supabase.

### Alternatives considered

1. **Self-host an IPFS node** — rejected. Adds operational complexity for no user benefit.
2. **AWS S3** — possible but adds another vendor. Supabase Storage is built on S3 under the hood and stays in our existing vendor footprint.
3. **Keep Pinata, drop the on-chain stamp only** — rejected. The "permanence" claim of IPFS was always conditional on us paying Pinata — the on-chain stamp doesn't change that. Supabase Storage is honestly just-as-permanent in practice.

### Consequences

- Document URLs become Supabase signed URLs (with TTL) instead of public IPFS gateway URLs.
- Backup / disaster-recovery goes through Supabase's existing backups.
- Storage cost scales with usage on a vendor we already pay.

---

## DEC-2026-05-008 — Auth: Supabase Auth (revised from Clerk)

**Date:** 2026-05-22 (revised same day after factoring Supabase Pro cost + existing arch)
**Status:** **Accepted** (locked 2026-05-22)
**Decided by:** Boss + sole engineer

### Context

Phase 1 replaces Alchemy Account Kit with a real auth provider. Two options were viable: Clerk (specialist auth vendor) and Supabase Auth (already part of our stack via Supabase Pro). Initial recommendation favored Clerk for polished UI; reconsidered when factoring (a) Supabase Pro is already paid, (b) Storm has existing `companies` + team management code that conflicts with Clerk's `Organizations` feature, and (c) Supabase Auth's `auth.uid()` integrates natively with RLS while Clerk requires custom JWT-claim wiring.

### Decision

**Use Supabase Auth.** Build sign-in / sign-up forms using Storm's existing UI primitives (Card, Modal, Button, Input from `ui-components.mdc`) or `@supabase/auth-ui-react` if helpful. Email/password + Google OAuth + magic links as supported sign-in methods.

### Rationale

| Factor | Resolution |
|---|---|
| Cost | Supabase Auth is included in the Supabase Pro tier already paid for. Clerk would be a +$0–25/mo additional vendor cost. |
| Database integration | `auth.users.id` IS `users.id` — no email-as-join-key sync webhook needed. T1.3 in the execution checklist shrinks dramatically. |
| RLS | `auth.uid()` works natively in RLS policies. Clerk requires custom JWT claim mappings. |
| Multi-tenant | Storm has its own `companies` + team management code. Clerk's `Organizations` would conflict, not help. |
| UI polish | Storm's existing UI primitives are strong; custom auth forms are achievable with low effort. The "polished UI" advantage of Clerk is small for a team comfortable building UI. |
| Vendor surface | Single vendor (Supabase) for DB + Auth + Storage. Cleaner ops, one set of credentials. |

### Alternatives considered (and rejected)

1. **Clerk** — rejected. Polished UI doesn't outweigh the RLS + sync + vendor-count costs.
2. **NextAuth.js** — rejected. Self-hosted means more maintenance; doesn't integrate as cleanly with Supabase as Supabase Auth itself.
3. **Auth0 / Stytch / others** — rejected. Same vendor-cost objection as Clerk; no advantage.

### Consequences

- Track 1 (`EXECUTION_CHECKLIST.md`) updated: Clerk references swapped for Supabase Auth. T1.3 (user sync webhook) becomes a much smaller "ID alignment migration" since `auth.users.id` and `users.id` are the same row.
- The `users.email` field stays as a profile field, not the auth join key (Supabase Auth handles email internally).
- Existing wallet-bound users need `auth.users` rows backfilled (T1.9 still happens but as a Supabase Admin API operation, not a Clerk Backend API call).
- Sign-in UI is custom (built with Storm's UI primitives) — small additional component work versus dropping in Clerk's components.

---

## DEC-2026-05-009 — Native Windows + WSL2 (no Mac required)

**Date:** 2026-05-22
**Status:** Accepted
**Decided by:** Sole engineer

### Context

Sole engineer works on Windows. Concerns raised: Midnight's Compact compiler is Linux/Mac only; Docker for the proof server is operationally fragile.

### Decision

- **Phase 1 + 2:** native Windows. All Next.js / TypeScript / Stripe / Supabase Auth / Supabase work runs fine.
- **Phase 3 (deferred):** WSL2 + Ubuntu for Compact compiler work. ~30 minutes of one-time setup. Day-to-day code editing remains in native Windows / Cursor.
- **No Mac purchase required.** WSL2 closes the gap. Don't buy hardware for a phase that may never ship.
- **Production proof server runs on Cloud Run / Render / Fly** — managed Docker host, not a self-managed Linux VM. Operational complexity is similar to Vercel.

### Alternatives considered

1. **Buy a Mac** — rejected. Hardware spend on an option that may never exercise; WSL2 is sufficient.
2. **Rent a cloud Linux dev box** — rejected. WSL2 is local, faster, cheaper.
3. **Skip Compact / use Aztec (Noir on more platforms)** — premature; revisit only if Compact tooling is a real bottleneck when Phase 3 actually starts.

### Consequences

- Zero hardware cost.
- Some friction during Phase 3 (deferred) but tolerable.
- Cursor's filesystem visibility into WSL2 is mature; AI workflow stays intact.

---

## How to add a new decision

1. New section at the **top** of this file (newest-first).
2. Header format: `## DEC-YYYY-MM-NNN — Short description`.
3. Required fields: Date, Status (Proposed / Accepted / Rejected / Superseded), Decided by, Context, Decision, Alternatives considered, Consequences.
4. If a decision supersedes an earlier one, mark the earlier one Superseded and link forward.
5. Decisions should be small enough to be reversible. If a decision feels load-bearing, split it into sub-decisions.

---

**Last updated:** 2026-05-22
