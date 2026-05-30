# Decision Log — Cryptography Stack

**Purpose:** capture every architectural decision made during the May 2026 strategy reset, the alternatives considered, and the rationale. Future maintainers should be able to revisit any decision and understand exactly why it was made.

Decisions are listed newest first.

---

## DEC-2026-05-015 — Sideline the developer vertical (hide, don't convert)

**Date:** 2026-05-29
**Status:** Accepted
**Decided by:** Sole engineer

### Context

T1.6 surfaced how many API routes exist (~115). Much of it is **parallel role stacks** — `driver/*`, `developer/*`, `general/*` each mirror profile / resume / share / verification / avatar / hub / career-card. The developer vertical (dev blocks, `developer/*` routes, `github/*`, `dev-card/[token]`, `block_dev_*` tables, `DeveloperShell`) duplicates the driver vertical but **cannot use the Midnight moat** — developers have no regulated, third-party-signed credential equivalent (see DEC-2026-05-014). GitHub data is public/self-reported.

### Decision

**Sideline developers — hide, don't convert, don't delete (yet).**

1. The app stays **open-ended**: anyone can sign up and build a career card. No driver-only hardcoding.
2. **Stop investing** in the developer vertical. No new dev blocks/features.
3. **Hide** developer blocks from the picker/suggestions so new users don't add them; `DeveloperShell` stays frozen (already legacy per `architecture.mdc`).
4. **Do not spend migration effort converting dev code** (auth, attestation, etc.). It rides along passively.
5. **Deliberate deletion is a SEPARATE, post-Phase-1-auth cleanup track** — the `block-development.mdc` removal checklist is long (registry, shell, journey map, My Files, career card, projected card, illustrations, `block_dev_*` tables, `dev-card`). Deleting mid-auth-migration is churn-on-churn; don't.

### Consequences

- Route/feature surface stops growing on the dev side immediately; real reduction comes later via the dedicated removal track + Phase 1 legacy-blockchain removal.
- Existing dev users/data are untouched until the deliberate removal pass.

### Related

- DEC-2026-05-014 (provenance gate — why devs can't use the moat)
- `.cursor/rules/block-development.mdc` (removal checklist for the eventual deletion)

---

## DEC-2026-05-014 — Product identity: "an app that proves issuer-signed content"; provenance gates attestation

**Date:** 2026-05-29
**Status:** Accepted (foundational — supersedes ambiguity in prior "verified" language)
**Decided by:** Sole engineer

### Context

While reasoning about route sprawl and what Storm actually is, the core question crystallized: *what can a ZK proof actually prove?* A ZK credential proof does not prove a fact is **true** — it proves you hold a credential **signed by an issuer** and that a predicate over it holds, without revealing the contents. **Truth is inherited from the issuer's signature; the math launders the issuer's trust, it does not create it.** Therefore a self-reported claim — which has no external issuer — cannot be made trustworthy by ZK. Proving "the candidate asserted X" (signed by the candidate) is worthless.

### Decision

**Storm is an app that proves issuer-signed content.** This is the product identity; build around it.

1. **Provenance gate:** a fact is attestable / Midnight-eligible **only if it originates from a third-party issuer** (CRA / regulator / external authority whose signature anchors it). **Self-reported data is display-only — never attested, never a "verified" badge, never on-chain.**
2. **Gate on provenance, not role.** No `if (driver)` for attestation eligibility. Today the issuer-signed set is driver screening blocks (MVR/PSP/CDL/employment-verification); that's incidental. A future nursing-license API becomes attestable automatically under the same gate.
3. **App stays open-ended.** Anyone builds a career card from self-reported blocks; only issuer-attested facts light up the verified / Midnight path. ZK is driver-only *for the foreseeable future* purely because that's where the third-party issuers are today.
4. **"Verified" must cite the issuer** (e.g. "derived from MVR pulled by Accio on YYYY-MM-DD"). Never "trust us."

### Consequences

- New rule authored: `.cursor/rules/midnight-data-boundary.mdc` (the enforceable gate).
- `attestation-architecture.mdc` reinforced: `FactType.source === 'self_reported'` facts are display-only and must never produce a `ProofArtifact`.
- Reinforces the candidate-as-agent / not-a-CRA posture (DEC-2026-05-011): Storm proves *third-party facts the candidate chose to disclose*, it does not originate or vouch for claims.

### Related

- DEC-2026-05-011 (candidate-agent posture, cite originating CRA)
- DEC-2026-05-015 (devs sidelined — they have no issuer-signed data)
- `.cursor/rules/midnight-data-boundary.mdc`, `.cursor/rules/attestation-architecture.mdc`

---

## DEC-2026-05-013 — Driver credential monetization: Storm-mediated cached-attestation marketplace, deferred to Phase 4

**Date:** 2026-05-27
**Status:** Accepted (deferred — design begins only when trigger conditions met)
**Decided by:** Sole engineer

### Context

Drivers today absorb the friction of credential verification (forms, screenings, follow-ups) but do not capture economic value when carriers later evaluate them. Each carrier pays $30–70 to pull a fresh MVR for the same driver, repeatedly, even if a recent verified MVR already exists. The asymmetry is structural and routes value to CRAs (Accio) and Storm — never back to the driver who did the underlying work.

A naive "drivers sell credential access via Lace wallet" framing was considered and rejected (see [`MOAT_THESIS.md`](./MOAT_THESIS.md) rejected-features appendix). The steel-manned version preserves the driver-economic-compounding insight while solving the regulatory, UX, and partner-conflict problems.

### Decision

When trigger conditions are met (see below), Phase 4 will introduce a **Storm-mediated cached-attestation marketplace**:

1. Driver self-funds MVR / PSP. Verified attestation issued; SBT minted server-side under Storm's management. **No driver wallet.**
2. Carrier evaluating driver sees two transparent paths in the UI:
   - **Fresh pull** (~$35 via Accio + Storm margin) — full new MVR.
   - **Recent attestation query** (~$15) — re-query existing cached attestation, available only if pulled within 30 days and only with driver's selective-disclosure consent.
3. Recent-attestation revenue split: **driver $5, Storm $10, carrier saves $20.**
4. Storm mediates every transaction. Driver is never a vendor. No FCRA consumer-report-resale exposure. Driver payout via Storm Points, Stripe Connect, or ACH — never crypto UX.
5. **Pace co-design required.** When a candidate was sourced through Pace, Pace receives routed economics on cached queries. Pace explicitly enables this for their driver pool; not a default behavior across all carriers.
6. **Hard 30-day freshness cliff.** Beyond 30 days, only fresh-pull path is available. Maintains FMCSA + carrier-policy MVR currency requirements.

### Alternatives considered

1. **Drivers-as-vendors with Lace wallet, direct payment from carriers.** Rejected — wallet UX breaks Web2 simplicity rule, FCRA driver-as-vendor posture is murky, disintermediates Pace, adverse selection collapses marketplace. Captured in `MOAT_THESIS.md` rejected appendix.
2. **Free transferable credentials (no marketplace).** Rejected — transferability breaks verification. See rejected-features appendix.
3. **Storm-mediated marketplace (chosen).** Solves wallet UX (Storm holds anchor), FCRA exposure (Storm mediates), Pace conflict (routed economics + Pace gating), staleness (30-day cliff), trust (Phase 2 / 3a verification underneath).
4. **Sponsored verification model (carrier pre-pays driver's MVR for first-look exclusivity).** Considered as a complement, not replacement. May ship alongside cached-attestation marketplace as a second economic surface.

### Trigger conditions to begin design

All three required:

1. **Phase 2 in production** with measurable carrier and driver adoption (concrete numbers TBD).
2. **Pace stakeholder explicitly engaged** as co-designer of routed economics and gating policy.
3. **FCRA legal review complete** per DEC-2026-05-011 trigger conditions.

### Consequences

- Captured as architectural future direction without committing engineering work.
- Phase 2 attestation design must include schema fields needed for Phase 4 (issued-at, freshness window, query history) — small additive cost now, large rework cost later if missed.
- Pace conversation about cached-attestation economics becomes a Phase 2-completion deliverable, not a Phase 1 deliverable.
- Future-you must NOT begin Phase 4 design before all three trigger conditions are met. The temptation to ship the "killer feature" early absorbs Phase 1 / 2 engineering time and breaks Pace stability.

### Related documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) "Future considerations (Phase 3b / Phase 4)" section — engineering view
- [`MOAT_THESIS.md`](./MOAT_THESIS.md) "Rejected feature ideas" appendix — why driver-as-vendor was rejected
- [`TOKEN_BRIEF.md`](./TOKEN_BRIEF.md) — boss-facing summary of the combined SBT + STORM + marketplace narrative
- [`PARTNERS.md`](./PARTNERS.md) — Pace co-design requirement origin

---

## DEC-2026-05-012 — Future Phase 3b token strategy: SBT credentials + Midnight-shielded STORM, deferred

**Date:** 2026-05-27
**Status:** Accepted (deferred — design begins only when trigger conditions met)
**Decided by:** Sole engineer

### Context

DEC-2026-05-005 Option B preserved the option to reissue STORM as a Midnight-native token in Phase 3 if a token use case justifies it. Separate to that, the broader identity ecosystem (W3C Verifiable Credentials, Soulbound Tokens) provides a mature pattern for representing verified credentials as candidate-controlled, non-transferable artifacts. Both ideas surfaced together while exploring how Storm could appeal to the Midnight ecosystem and crypto community without compromising the candidate-as-agent moat.

### Decision

Two complementary additions to the Phase 3 roadmap, both **deferred until trigger conditions met**:

**Phase 3b-A: Soulbound credential SBTs, with the career card as the vault.** Each verified attestation is represented as a non-transferable token bound to the candidate's `users.id` (NOT to a wallet address). Storm holds the on-chain anchor server-side; candidate never sees a wallet, signs a transaction, or holds a seed phrase. Selective disclosure layered on top via existing career-card lenses.

**Implementation note (added 2026-05-28):** the career card the candidate already has IS the vault UX. We do not build a separate "credential vault" surface. Phase 3b upgrades the career card from a Supabase projection into a verifiable artifact, with each credential SBT (CDL, MVR, employment, DOT) appearing inside it. Career card mints at signup so it exists for empty/in-progress users (preserves `product-philosophy.mdc` "never gate the career card behind completion" rule). Carrier-facing `/card/{token}` URL behavior is unchanged; cryptographic verification is added underneath. Lower estimated effort than originally scoped (~1–2 weeks of UI work) because the career card surface already exists. Full design lives in `ARCHITECTURE.md` "Future considerations" → Phase 3b SBT section.

**Phase 3b-B: STORM reissued as Midnight-native shielded utility token.** Pure utility (no profit-sharing, no governance over Storm corp). Earned by candidates and carriers through platform activity; spent on platform discounts. Shielded by default on Midnight (private balances). Surface label remains "Storm Points" — the on-chain token is implementation, not UX.

### Alternatives considered

1. **Don't ship token features at all.** Rejected — the SBT layer is essentially a UX wrapper around what Phase 3a already produces; cost is small, identity-ecosystem appeal is high.
2. **Ship transferable credential tokens.** Rejected — transferability breaks verification. See `MOAT_THESIS.md` rejected appendix.
3. **Ship STORM as governance / profit-sharing token.** Rejected — Howey-test exposure, regulatory burden disproportionate to the benefit.
4. **Ship STORM with public balances.** Rejected — driver pay-per-credential history would be on-chain; unacceptable privacy posture. Shielded is non-negotiable.
5. **Ship SBT + STORM (chosen, deferred).** Strengthens identity-ecosystem positioning, gives Midnight Foundation a real production use case, preserves all candidate-control invariants.

### Trigger conditions to begin design

For SBT layer: **Phase 3a in production** with at least one carrier consuming attestations.
For STORM reissue: **Phase 3a + SBT layer in production**, AND a measurable token use case (e.g., off-chain Storm Points adoption shows users want transferability or cross-app utility).

### Consequences

- No engineering work scheduled. Captured in `ARCHITECTURE.md` "Future considerations" section.
- Phase 1 off-chain Storm Points (DEC-005 Option B) implementation must use a schema that allows future Midnight migration without data loss. Document this constraint when implementing.
- Midnight Foundation contact (DEC-2026-05-010) is **not** to be re-engaged about these features until Phase 2 is in production. Avoid pitching ambitious roadmaps; pitch working code.
- Crypto community / Midnight ecosystem positioning becomes a Phase 3b-era marketing track, not a Phase 1 / 2 priority.

### Related documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) "Future considerations (Phase 3b / Phase 4)" — engineering view
- [`TOKEN_BRIEF.md`](./TOKEN_BRIEF.md) — boss-facing summary
- DEC-2026-05-005 — STORM disposition (Phase 1 drop, Phase 3 reissue optionality)
- DEC-2026-05-010 — Midnight Foundation contact discipline

---

## DEC-2026-05-011 — Storm legal posture: candidate's agent, NOT a CRA

**Date:** 2026-05-27
**Status:** Accepted (strategic decision; legal posture to be ratified by counsel at trigger conditions below)
**Decided by:** Sole engineer

### Context

Phase 2 ships signed JWT attestations like "✓ clean MVR · signed by Storm." Under FCRA's broad definition, that JWT probably qualifies as a consumer report — information bearing on a consumer's character / personal characteristics shared with a third party for employment purposes. Storm therefore has to choose a legal posture for handling consumer-information exchange. The instinctive answer ("Storm should become a CRA so we can pull data directly") would collapse the moat.

### Decision

**Storm operates as the candidate's agent, not as a Consumer Reporting Agency.**

Mechanism:
1. Candidate authenticates to Storm.
2. Accio (or any future CRA backend) pulls the underlying MVR / PSP / employment-verification with the candidate's FCRA-required authorization. **Accio remains the regulated CRA** of record for the underlying report.
3. Candidate consents to a specific derived fact being shared with a specific carrier.
4. Storm produces and delivers the fact (Phase 2 signed JWT, Phase 3 Midnight ZK proof) **on behalf of the consumer to the consumer's authorized recipient**.

The carrier receives the fact via candidate-authorized disclosure under FCRA's consumer-authorization regime, **not** as a Storm-issued consumer report.

### Alternatives considered

1. **Storm registers as a specialty CRA.** Rejected. Adopting a CRA's operational shape (full-disclosure reports, per-pull pricing, state-DMV contracts, FCRA dispute infrastructure) converges Storm with Tenstreet / HireRight / DriverFacts / Foley — the incumbents we are structurally moated against. Storm would be a CRA with a slightly nicer UI competing against 25 years of incumbent state-DMV relationships. Loses on every axis.
2. **Storm operates as an FCRA reseller of Accio's output.** Rejected as a primary posture. Well-trodden legally but reduces Storm to "Accio with extra steps" — no architectural room for the candidate-side disclosure UX that is the moat. Reseller rules also still treat Storm as part of the report-delivery chain, which mismatches the candidate-agent UX.
3. **Storm-as-candidate-agent (chosen).** Storm is the consumer's tool, not the user's tool. Selective-disclosure shares are candidate-initiated, candidate-authorized, candidate-revocable. Carriers receive facts via consumer authorization, not via report delivery. Structurally compatible with the existing composable-hub product philosophy ("every block has the candidate as the actor").

### Operational rules (engineering-binding)

- **Keep Accio (or any future CRA) as the data-pull layer.** Do not disintermediate. Their CRA stack handles the regulated relationship with state DMVs / FMCSA and absorbs the FCRA dispute load.
- **Every screening order requires explicit consumer authorization.** Already enforced via `screening_consent_bundles` and the FCRA + FMCSA + CDLIS package — load-bearing for this posture; do not loosen.
- **Every selective-disclosure share is candidate-initiated.** Stormi can recommend, but the consumer authorizes. Carriers cannot pull facts without a candidate-granted disclosure.
- **Storm-produced attestations cite the originating CRA explicitly.** Format example: "✓ Clean MVR · derived from MVR pulled by Accio on YYYY-MM-DD · shared with {Carrier} by {Candidate} on YYYY-MM-DD." This makes chain of custody auditable and keeps Storm's role visible as derivation/disclosure agent, not report producer.
- **Never special-case any single carrier or CRA in code.** Generic configuration only (consistent with `.cursor/rules/strategic-direction.mdc` partner rules).

### Trigger conditions for formal counsel review

The candidate-agent posture is the right strategic choice now. Formal FCRA legal review is warranted when **either** condition holds:

1. **Pace (or any anchor customer) commits to Storm-issued attestations as their default DQ delivery format**, such that carriers receiving placements from that customer treat Storm attestations as primary verification documentation.
2. **Storm crosses ~10,000 verified drivers, OR starts producing attestations for non-Pace direct carriers at scale.** Volume + direct-to-carrier delivery both raise the regulatory bar.

At trigger time, counsel review should produce: (a) a formal opinion that the candidate-agent posture is FCRA-defensible at our scale, (b) consent and disclosure language that survives discovery, and (c) updated `screening_consent_bundles` content if needed.

### Consequences

- **Moat preserved.** Storm's structural advantage over incumbent CRAs depends on not being one of them. This decision protects that.
- **Architectural alignment maintained.** The composable-hub philosophy ("candidate-owned, candidate-controlled") becomes the legal posture, not just a UX claim.
- **Accio relationship is load-bearing.** If Accio terminates or fails, Storm needs an alternative CRA backend. Worth tracking as a vendor-concentration risk separately, but not a reason to become a CRA ourselves.
- **No immediate engineering work.** This decision changes nothing about the current sprint; it codifies the strategic posture that informs every future engineering and product decision.
- **Future Phase 2 / Phase 3 attestation copy must follow the citation rule** above. When implementing, make this a formatting helper (`formatAttestationProvenance()`) rather than scattering ad-hoc strings across components.

### Related documents

- [`MOAT_THESIS.md`](./MOAT_THESIS.md) — "Storm is not a CRA" section captures the customer-facing reasoning
- [`PARTNERS.md`](./PARTNERS.md) — Pace as design partner; never special-case Pace
- `.cursor/rules/attestation-architecture.mdc` — engineering rules for attestation code (reinforced by this decision)
- `.cursor/rules/product-philosophy.mdc` — candidate-owned identity (the philosophical root of this posture)

---

## DEC-2026-05-010 — Initial Midnight Foundation contact established

**Date:** 2026-05-23 (outreach) / 2026-05-25 (reply received)
**Status:** Informational (relationship note, no architectural change)
**Decided by:** Sole engineer
**Contact:** Lauren Lee, Director of Developer Relations, Midnight Foundation (reply email on file)

### Context

After locking the Phase 1 pre-flight decisions (DEC-2026-05-005, -006, -008) and confirming Midnight as the Phase 3 ZK target (DEC-2026-05-002, deferred per DEC-2026-05-004), sent an informal intro email to the Midnight Foundation. Goal was relationship-opening only — no ask, no public commitment, no marketing claim.

Email framing: Storm's selective-disclosure DQ-file thesis, Midnight named as the chosen Phase 3 implementation behind our `attestationService` interface, explicit mention that Compact code is months out and that we are not public about chain plans. The full email draft template lives in chat-session history; if reuse is needed, regenerate from this decision's framing.

### Outcome

Lauren Lee replied two days later with a personal, non-templated message:

- Acknowledged the architectural fit specifically (witness + `disclose()` pattern, staged JWT-then-ZK abstraction).
- Provided **public-only** resources: developer hub, docs, Hello World walkthrough, preprod testnet, Discord (`#dev-chat`), Midnight Forum.
- Honored the "keep informal" request — explicitly said "I'll keep this quiet on our side."
- Held the door open for future re-engagement: replying in the same email thread routes to "whoever is most useful, without making it a thing."
- Wished us luck on Phase 1 — i.e. matched our tempo, did not try to pull us into Compact work prematurely.

This is the best version of the outcome the outreach was designed for: a named, director-level contact at the foundation, with an open thread, zero obligations, and zero public visibility.

### Re-engagement triggers (deliberate)

Do **not** ping Lauren for things that belong in Discord (commodity questions, syntax help, devnet issues). Reserve the email thread for executive-level moments:

1. **Phase 2 ships** and the selective-disclosure UX is live with real candidate / carrier traffic.
2. **A customer requires cryptographic non-repudiation** (the Phase 3 trigger from DEC-2026-05-004).
3. **Specific commercial moments**: investor diligence asking about chain partnerships, conference where in-person makes sense, a Pace-driven request for ZK-backed verification.

Roughly 3–4 touchpoints expected over 12–24 months. If we exceed that frequency, we are over-spending the relationship.

### Discipline notes

- **No public mention.** Do not tweet, post in Storm channels, or mention to investors / boss as a "partnership" — it is a private relationship, not a marketing asset. Lauren's "I'll keep this quiet" is matched on our side.
- **Lurk in Discord under real handle** — when we surface later as "Storm building selective disclosure for trucking," prior name recognition is leverage.
- **Hello World walkthrough is a weekend / low-priority activity** — not a Phase 1 critical path item. Compact familiarity is a Phase 2 / 3 prerequisite, not a Phase 1 prerequisite. Resist letting it bleed into T1.x work.
- **Midnight commitment scope is unchanged.** Our product (Phases 1–2) does not depend on Midnight; the relationship is leverage for *when* Phase 3 happens, not *whether* it happens. If Midnight stagnates or pivots, the `attestationService` seam still allows substrate change at the cost of a Phase 3 sub-track only.

### Consequences

- **Phase 3 starts with a warm contact instead of a cold email** when (and if) it triggers.
- **Discovery channel exists** for Compact / Midnight technical questions (Discord) without burning the executive contact.
- **No timeline, no architectural change, no public commitment.** Storm's roadmap and code are unchanged.
- Should Lauren change roles or leave the foundation, the email thread + this entry preserve enough context that re-introduction to a successor is straightforward.

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
