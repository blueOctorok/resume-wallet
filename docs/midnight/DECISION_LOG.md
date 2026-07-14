# Decision Log — Cryptography Stack

**Purpose:** capture every architectural decision made during the May 2026 strategy reset, the alternatives considered, and the rationale. Future maintainers should be able to revisit any decision and understand exactly why it was made.

Decisions are listed newest first.

---

## DEC-2026-07-001 — DOT pre-screen packet may headline "Verified" only on a live majority of issuer-backed risk fields

**Date:** 2026-07-14
**Status:** Accepted — formalizes the 2026-07-07 P3.7 direction; implements with `computeDotVerifiedCoverage` + honesty pass on legacy whole-app `VERIFIED`
**Decided by:** Owner + engineer
**Extends:** DEC-2026-05-014 (provenance gate), DEC-2026-05-004 (honesty gate), DEC-2026-05-011 (not a CRA; pre-screen ≠ 391.51 file)

### Context

P3.7 builds a portable, mostly-verified DQ **pre-screen** packet: MVR/PSP/EVR facts prefill + lock DOT fields with honest per-field badges. The product question was when the *packet* (not a single field) may carry a headline **"Verified."** Boss floated ~60% as an illustration; engineering needed a durable rule that is legally defensible in an FCRA/FMCSA context and cannot be gamed as marketing.

Separately, Base-era code still treated `driver_applications.verification_status = 'VERIFIED'` / `blockchain_tx_hash` as if the whole self-reported DOT app were issuer- or chain-verified. That overclaim collapses the provenance gate.

### Decision

1. **Majority rule (strict):** headline **"Verified"** (or "Verified pre-screen") is allowed only when `verifiedCount * 2 > totalCount` over a **defined risk-bearing denominator** (Form 1 MVR-lockable filled paths + Form 2 accident/conviction/inspection slots + issuer clean-record flags + Form 3 EVR-verified employers). Equality at 50% stays **"Partially verified."**
2. **Live computed % only.** The surfaced number is `round(100 * verifiedCount / totalCount)` from real application_data provenance — never a chosen marketing target. *60% was illustrative.*
3. **Decomposable claim.** The headline is allowed *only because* every counted slot carries an honest badge (Accio MVR/PSP, prior-employer EVR) vs self-certified. Self-reported fields (SSN, medical Qs, signature, education, untagged employment) are **never** in the verified numerator and **never** badged verified.
4. **Small print is mandatory** wherever the headline or % appears (DOT flow meter, career-card chip, employer preview). Caveat must state issuer source vs self-certified remainder.
5. **Per-fact "proven on Midnight" stays gated** by P3.6 / P3.4-B (`proof.kind === 'midnight_zk'`). Interim wording: "Verified — sourced from {CRA/prior employer}…"
6. **Legacy whole-app DOT `VERIFIED` / Base tx is not issuer verification.** UI must not present `verification_status='VERIFIED'` or `blockchain_tx_hash` (Base Sepolia) as "Verified on Blockchain" or as proof the packet is issuer-backed. Prefer complete / submitted + the live verified-% meter. The DB flag may remain as an internal "hash sealed" artifact until a later cleanup migration; it must not drive green "verified" copy.
7. **Self-reported resumes follow the same rule.** A resume PDF/builder output is never Midnight- or chain-verified. `/api/resumes/[id]/verify` is retired (410). Career-card / hub copy uses "On file," not "Verified." Trust lives on issuer-backed facts (MVR/PSP/EVR), which the resume may *display* but does not itself prove.

### Consequences

- `src/lib/dot-verified-coverage.ts` is the source of truth for % and `majorityVerified`.
- Honesty pass (2026-07-14): ApplicationSubmitted, journey DOT step, career-card on-chain strip, CareerCard DOT badge, hub document `canVerify` for DOT, DriverHub DOT CTAs.
- Resume honesty pass (2026-07-14): verify API 410; hub/career-card/DriverHub/DeveloperHub/ResumeDashboard/upload flow; projected on-chain strip empty for resumes.
- This is a **pre-screen** claim, not a substitute for the carrier's consented hire-time CRA pull (DEC-2026-05-011).

### Related

- P3.7 in `docs/midnight/EXECUTION_CHECKLIST.md`
- DEC-2026-05-004, DEC-2026-05-014, DEC-2026-05-011

---

## DEC-2026-06-005 — Data ownership is decided by "who clicks order"; driver-initiated + agency-funded is the recommended model; Pace-as-signal-reseller is a CRA trap; full review pending counsel

**Date:** 2026-06-22
**Status:** **Accepted for build** (2026-06-25) — engineering proceeds on driver-initiated ownership; **formal legal review still required before production/marketing claims.** Pace-as-owner is rejected. Extends DEC-2026-06-002 (driver-owned/agency-funded vault), DEC-2026-06-003 (funded-pull ingestion gated on FCRA opinion), DEC-2026-05-011 (candidate-agent; never a CRA).
**Decided by:** Owner + engineer (to be confirmed with lawyers)

### Context
Spitballing how to make verified facts portable surfaced a foundational question: who owns the MVR/PSP data, and can Pace hand it (or a zk-proof of it) to the driver or to outside carriers? Confirmed in code + live data that **all current screening data is company-private (Pace employer-pulls)**, and that the zk-proof builder currently ignores the ownership lane (it proved both test facts off Pace pulls — an FCRA-isolation leak, tracked as P3.4-A step 7).

### Decision (working)
1. **The deciding rule is "who clicks order" (the consumer of record), not who pays or stores.** Driver-initiated = driver-owned/portable. Pace-initiated = company-private. **Money does not change ownership** — Pace can sponsor a driver-initiated pull and the driver still owns it.
2. **Cryptography does not launder provenance.** A zk-proof of "clean MVR" derived from a company-private pull is still consumer-report information; the ZK wrapper does not make it shareable. Soundness and provenance are independent axes.
3. **Three models, one recommendation:**
   - **A — Driver-initiated (driver-owned), Pace-funded ✅ recommended/platform.** Low CRA risk, portable, matches the moat.
   - **B — Pace-central / driver leasing ✅ legitimate but smaller/locked-in.** Clean only as true leasing (carrier buys driver capacity from Pace, not a direct-hire decision on the driver).
   - **C — Pace resells screening-derived signals into other companies' *direct* hires ❌ CRA trap.** Makes Pace a CRA; off the table.
4. **Hybrid sweet spot:** Pace stays the operational hub (originates, funds, runs ops + relationships) while the **driver initiates/authorizes**, so the legal basis is candidate consent (Model A), not report resale (Model C). Pace stays powerful; the credential stays the driver's.
5. **The single engineering change to enable the recommended model: make the driver click "order"** (and gate proofs to driver-owned pulls, `ordered_by_company_id IS NULL`). Everything else (Pace paying, Accio pulling, ops) is unchanged.

### Consequences
- New shareable artifact: **`docs/midnight/DATA_OWNERSHIP_FCRA_MEMO.md`** (boss + lawyer facing — models, the deciding rule, the confirmed leak, and the counsel agenda). To be shared with the owner and brought to the legal meeting.
- **Gated on counsel** (same FCRA opinion as DEC-2026-06-003 / DEC-2026-05-013): driver-owned-after-agency-funding, consent design, zk-fact-vs-report distinction, DPPA redisclosure, vendor-contract permissions, the leasing line, and pre-screen positioning. Question list lives in the memo §6.
- P3.4-A step 7 (FCRA isolation gate) **✅ wired 2026-06-25** — attestation + block sync + fulfill-screening ownership. Backfill of Pace-derived test attestations still open.
- No code changed yet — direction is pending legal sign-off.

### Related
- DEC-2026-06-002, DEC-2026-06-003, DEC-2026-06-004, DEC-2026-05-011, DEC-2026-05-013
- `docs/midnight/DATA_OWNERSHIP_FCRA_MEMO.md`

---

## DEC-2026-06-004 — zkTLS as the platform provenance bet for the composed DQ file; issuer signature is a per-fact optimization; ZK facts are the cheap pre-screen tier above the full file

**Date:** 2026-06-22
**Status:** Accepted — strategic direction + zkTLS spike go/no-go framing (extends DEC-2026-06-002 Midnight-load-bearing, DEC-2026-06-003 CRA-agnostic rail, DEC-2026-05-014 provenance gate, DEC-2026-05-004 honesty gate)
**Decided by:** Owner + engineer

### Context

P3.4-A landed a **real predicate proof** for `mvr_clean_36_months` on Preprod (positive + negative smokes pass; `CIRCUITS.md` 🟡). The predicate is genuine ZK; the remaining gap is **provenance** — proving the MVR bytes fed to the circuit are real, not Storm-authored. Two paths were weighed:

1. **Issuer signature (P3.4-B, Key/Accio).** Pending vendor review (P3.4.0). Cleanest trust model — issuer's key, no middleman, small circuit. But out of our control and timeline-risky.
2. **zkTLS / web proof.** Prove "these bytes came from `host` over TLS at time T." Works with **no issuer cooperation** because Storm already receives the report over HTTPS (`reportURL` exists).

The owner's framing, accepted here: **time-to-market + control beat perfection.** Getting third parties to sign is slow and uncertain; a mathematically-real provenance proof we can ship unilaterally is a win even if its trust basis is "TLS+notary" rather than "issuer-signed." This is state-of-the-art for trucking DQ regardless of which path lands — the bar is **real, not perfect** (DEC-2026-06-001 quality bar).

### Decision

**1. zkTLS is the platform provenance bet; issuer signature is a per-fact optimization.**
The north-star deliverable is a **composed DQ file** of verifiable facts. Its verifiable spine is mostly third-party data delivered over HTTPS — MVR, PSP, **FMCSA Drug & Alcohol Clearinghouse**, **med cert via National Registry lookup**, employment verification. An issuer-signature deal covers only the rows where the CRA agrees to sign (MVR/PSP). **zkTLS covers all of them with no permission needed** — including the Clearinghouse and National Registry, which no CRA signature would ever reach. Therefore zkTLS is the load-bearing capability; Key signing is a "nice to have" for the two rows where the cleaner trust model is reachable. Per `attestations.source_cra` already being open text (DEC-2026-06-003), this is open-endedness/control, **not** a commitment to actually run multiple CRAs.

**2. Correction to "switch to any CRA for free" — provenance generalizes, parsing does not.**
zkTLS proves *transport* generically (one capability, all sources). It does **not** understand the payload. Each source has a different response shape (Accio XML, Clearinghouse JSON, DMV HTML), so each new source still needs its own parser/predicate (the equivalent of `mvr-clean-predicate.ts`). Adding a source = "no permission + write an adapter," not zero work. Still far cheaper than per-vendor signing deals.

**3. Honesty correction — name the trust basis on the artifact (DEC-2026-05-004 / -014).**
A zkTLS-backed fact is real, but its trust model is **"TLS cert + notary," not "the issuer vouched."** The per-fact claim must describe what was actually proven ("proof that this record was served by `host` over TLS on `date`, derived predicate checked in ZK") and must **not** imply the issuer cryptographically attested it. The **provenance method is recorded on the proof artifact** (invariant from the P3.4-B options work) so the verify surface renders the correct claim. Issuer-signed (🟢) and zkTLS-backed are *different* honesty tiers, both real, neither pure marketing.

**4. Unilateral vs. cooperative — manage the relationship, not just the tech.**
Issuer signing is cooperative (clean). zkTLS is unilateral (we attest a vendor's channel without them). Defensible because Storm is the **candidate's agent** proving provenance of data the candidate **authorized us to pull** (DEC-2026-05-011) — we already legitimately receive it. But "we can prove provenance with or without you" is **leverage in the Key conversation**, whereas a surprise is a relationship cost. Don't blindside Accio. Per-target technical feasibility (TLS 1.3 session-key handling, etc.) is **not** guaranteed by "it's HTTPS" — the spike must verify each target.

**5. Product shape — ZK facts are the cheap pre-screen tier above the full DQ file (the "middle ground").**
This is the funnel, and it's already the architecture, not a new feature:
   - **ZK facts** = instant, cheap, candidate-controlled, verified yes/no answers ("clean MVR? Class A? clean PSP?") a carrier can check when *simply interested* — the "dating profile" (product-philosophy). Selective disclosure of verified facts.
   - **Full DQ file** = the consented, regulated, paid artifact pulled when the carrier is *serious about hiring* — the "background check after the match."
   - The ZK layer **increases conversion and avoids wasted pulls**; it does not replace the file.

**Compliance guardrail (do not oversell):** the ZK pre-screen **does not legally replace** the FMCSA-required DQ file. A hired driver still needs the actual records on file (49 CFR 391.51), and "clean MVR" is a point-in-time fact — **freshness pushes a fresh consented pull at hire time anyway**, which makes the ZK layer and the paid pull **complementary, not cannibalistic**. Storm stays the candidate's agent; the regulated pull still flows through the CRA (Accio) — **never disintermediate it** (DEC-2026-05-011). Position as "know before you spend," never "you don't need the background check."

### Consequences

- **zkTLS go/no-go spike is the real critical path while Key reviews** — not idle waiting. Spike must answer: (a) scheme (MPC-notary e.g. TLSNotary vs. TEE) + the notary trust assumption we'd adopt; (b) can we bind a session to *this driver's* report + prevent replay; (c) proof size/latency tolerable; (d) per-target TLS feasibility for the DQ spine (MVR, PSP, Clearinghouse, National Registry). Output: go/no-go note here. **Do not wire into the attestation pipeline until the spike clears.**
- `EXECUTION_CHECKLIST.md` P3.4-B: zkTLS framed as parallel platform track (already promoted); add the DQ-spine target list + provenance-vs-parsing split.
- Engineering invariant reaffirmed: provenance method on every proof artifact; verify surface renders the honesty tier from it.
- Key conversation: keep zkTLS as stated leverage; don't surprise Accio.

### Related

- DEC-2026-06-003 (CRA-agnostic Proof Request rail — `source_cra` open text; this extends *why* that openness matters)
- DEC-2026-06-002 (Midnight load-bearing = network-independent trust; DQ-vault positioning; "pre-qual not replacement" caveat)
- DEC-2026-06-001 (Phase 3 GTM-driven; quality bar = real, not demo-ware)
- DEC-2026-05-014 (provenance gate — issuer-agnostic by design)
- DEC-2026-05-011 (candidate-as-agent; never disintermediate the CRA / never become one)
- DEC-2026-05-004 (honesty gate — per-fact claims describe what's actually proven)

### Update 2026-06-22 — zkTLS current-state findings (spike seed) + maturity caveat

Web-search review of the zkTLS field (TLSNotary, zkPass, Reclaim, Opacity, vlayer, Primus; arXiv TLSNotary review). **zkTLS is real, funded ($40M+ VC 2025–26), and shipping** — confirmed independent of Midnight (we integrate it; Midnight does not provide it). Three architectures with different trust trades:

| Approach | Trust | Speed | Projects |
|---|---|---|---|
| MPC-TLS | Notary set not to collude with prover | Slow (~23MB/1KB req) | TLSNotary, zkPass, Opacity |
| Proxy | Inline attestor node | ~10× faster | Reclaim, vlayer |
| TEE | SGX vendor + operator | Fast | Primus |

**Honest maturity caveat — tempers this decision's "zkTLS is the platform bet" confidence for *our* use case:**
1. **Public re-verifiability vs. speed conflict.** Our pitch needs cold, publicly re-verifiable proofs. The fast MPC variant (QuickSilver/VOLE) is **designated-verifier only** — not publicly re-verifiable. Public verifiability forces the heavier/slower path.
2. **TLS 1.3 paused in TLSNotary** (1.0 targeted H2 2026). Accio + gov portals almost certainly run TLS 1.3 → leading OSS MPC option may not handle our transport today.
3. **Notary-collusion is the field's unsolved problem.** Mitigations (multi-notary, TEE+slashing, restaking) are deployed-but-degrading / theoretical / design-stage. Confirms the honesty tier: "TLS + notary," **not** "issuer vouched."
4. **Authenticated sessions + detection + ToS.** Clearinghouse / National Registry sit behind logins (harder); servers can detect/block MPC handshakes; unilateral attestation of a vendor channel is a ToS/relationship question.

**Revised stance (does not reverse the decision, right-sizes it):**
- **Issuer signature (Key/Accio) is the *faster real path* for MVR/PSP** — no notary assumption, no TLS-1.3 blocker, publicly verifiable, cooperative. "Time to market" now favors Key, not zkTLS, for the two facts we can get signed.
- **zkTLS stays the strategic generalization** for sources no one will sign — but it's at the **hard end** of the maturity curve for our needs, not a quick win. Parallel R&D, de-risk via spike.

**Sharpened spike go/no-go questions (supersede the generic ones):**
1. Can we get a **publicly re-verifiable** proof (rules out designated-verifier fast paths)?
2. Does any production lib handle **TLS 1.3** for our actual targets today?
3. What **notary trust model** would we actually adopt, and is the resulting claim honest to call "verified"?
4. One **authenticated-session** target end-to-end, or is it public-URL-only in practice?

Output remains: go/no-go note here; do not wire into the attestation pipeline until the spike clears.

---

## DEC-2026-06-003 — Multi-CRA proof rail ("Proof Requests"): candidate-mediated only; carrier-side headless proofs API rejected

**Date:** 2026-06-10
**Status:** Accepted (extends DEC-2026-06-002 positioning + funding; reinforces DEC-2026-05-011 candidate-agent posture)
**Decided by:** Owner

### Context

Pace is live, but asking the next carrier ("company X") to abandon their existing screening supplier — Checkr, DISA, Accio, anyone — to adopt Storm is a tall order, and the owner explicitly rejects the zero-sum framing. The analogy raised: in crypto, interoperability wins chains; the same applies here. The question: can Storm be a **proof rail above whichever CRA a carrier already uses**, so any company gets Midnight ZK selective-disclosure proofs without switching suppliers?

The architecture already leans this way by design: the provenance gate is issuer-agnostic (`midnight-data-boundary.mdc` — "Provenance is the gate, NOT role"), and `attestations.source_cra` is open text, not hardcoded to Accio. The ZK layer doesn't care who the issuer is — a Midnight proof attests a predicate over issuer-signed data; swap the issuer, same circuit shape. Each new CRA costs an **ingestion adapter** (their format → a `proveImpl`), not an architecture change.

### Decision

**1. The multi-CRA proof rail is committed direction — as "Proof Requests" (Phase 3c).**
Carrier-initiated, candidate-consented, CRA-agnostic:
- Carrier submits a lightweight request (driver contact + facts needed from the fact catalog). No Storm tenancy, no SDK, no CRA switch required.
- Storm contacts the driver via existing outreach machinery; driver signs the FCRA authorization + disclosure election (extends `screening_consent_bundles` + `disclosure_preferences`).
- Storm sources the record, derives the fact, proves on Midnight, cites `source_cra`.
- Carrier receives a **public verify link** backed by the on-chain proof — verifiable cold, no Storm account. Midnight's network-independent trust (DEC-2026-06-002 §3) is what makes the "headless" delivery real; a JWT-only version would still require trusting Storm's key.
- Byproduct flywheel: every fulfilled request mints a new Storm candidate with a career card + portable fact. Carriers become the candidate-acquisition channel.

**2. The candidate is the hub in every flow — "Version B" is rejected.**
A carrier-side headless API where company X batches *their* CRA reports through Storm for proofs **without the driver in the loop** is permanently rejected. It would make Storm a processor of consumer reports on behalf of the FCRA "user" (reseller/CRA territory — the posture MOAT_THESIS says collapses the moat), and it dissolves the driver-owned portable DQ file into commoditized middleware. Joins the rejected-ideas list alongside Storm-as-CRA.

**3. Ingestion sources, in risk order (mirrors DEC-2026-06-002 funding paths):**
   - **(a) Driver's-own-records, carrier-sponsored — launch path.** Driver pulls own MVR/PSP by right; requesting carrier sponsors the fee. Works under existing consent posture, any carrier, today.
   - **(b) Existing-CRA-pull ingestion (Checkr / DISA / etc.) — GATED.** Even with the driver's signature, ingesting another party's funded CRA pull is the same legal question as funded-pull-becomes-portable. **Requires the formal FCRA opinion** (DEC-2026-05-013 / DEC-2026-06-002) before build/market. One opinion covers both.

**4. Sequencing: after the Phase 3a slice verifies.** The rail is a product surface on top of a real proof backbone — do not design it on the JWT-only backend. Exception: the **public verify page** is valuable in Phase 2 form already ("Verified by Storm" + CRA citation) and upgrades in place when the backend swaps.

### Consequences

- `EXECUTION_CHECKLIST.md`: new **Phase 3c — Proof Request rail** section, sequenced after 3a with component breakdown + gates.
- `MOAT_THESIS.md` (follow-up): add carrier-side proofs API to the rejected-ideas appendix; add the interop framing ("don't ask carriers to ditch their CRA — cite it").
- Engineering invariant from day one of P3.3: `source_cra` flows through every layer (fact registry → attestation → proof artifact → verify surface). Never assume Accio.
- No special-casing any CRA or carrier in code — adapters are registry entries, same pattern as blocks.

### Related

- DEC-2026-06-002 (funding paths a/b; Midnight load-bearing = network-independent trust)
- DEC-2026-05-011 (candidate-as-agent / not a CRA — the line that separates Version A from Version B)
- DEC-2026-05-013 (cached-attestation marketplace — shares the FCRA gate)
- DEC-2026-05-014 (provenance gate — issuer-agnostic by design, which is what makes this rail cheap)

---

## DEC-2026-06-002 — Positioning lock: driver-owned / agency-funded vault; Midnight is load-bearing; token + soulbound credentials are committed roadmap

**Date:** 2026-06-09
**Status:** Accepted (positioning + funding model + blockchain role; extends DEC-2026-06-001, DEC-2026-05-011, DEC-2026-05-012, DEC-2026-05-013)
**Decided by:** Owner + engineer

### Context

Two pressures forced a sharper positioning statement than the docs had:

1. **Incumbent dread.** A Pace coworker demoed Tenstreet **Xchange** ("can't we just do this?"). Xchange is a 20-year **carrier-contributed employment-verification network** — the data is carrier-owned and network-bound, and the driver is inventory. Trying to out-Tenstreet Tenstreet on data volume / network density is unwinnable for a late entrant.
2. **Candidate-funding reality.** Drivers will **not** pay $35–70 to pull their own MVR/PSP/background speculatively. A "candidate runs and pays for their own screening" model is economically naive in trucking, where the carrier/agency always pays.

Separately, the owner — hired specifically as a blockchain dev — wants blockchain to be **load-bearing**, not decoration, and wants the **utility token + soulbound credential cards in the career card** treated as committed roadmap, not "captured, not scheduled."

### Decision

**1. Positioning: Storm is the driver-side counterpart, NOT a Tenstreet/Indeed competitor.**
Storm is the **driver-owned, portable Driver Qualification (DQ) vault** — build your verified DQ file once, selectively disclose facts forever, carry it across placements and carriers. We do **not** build an ATS, a verification network, or compete on data volume. Tenstreet owns the carrier side (network-bound, carrier-owned); Storm owns the driver side (portable, candidate-controlled). Two sides of the same transaction, not the same product.

**2. Funding model: candidate-*controlled*, agency-*funded*.**
The payer and the owner are different parties. The candidate **owns disclosure + portability**; **Pace or the carrier funds the underlying pull** (exactly how trucking works today). Two implementation paths, in risk order:
   - **(a) Driver's-own-records, agency-sponsored (lower FCRA risk, start here):** the driver obtains their *own* records by right (e.g. FMCSA PSP ~$10, state MVR), Pace **sponsors the fee**. A consumer presenting their own data is not a CRA furnishing a consumer report. Value = a portable **pre-qualification / speed** signal, not necessarily the carrier's system-of-record for an adverse action.
   - **(b) Funded-pull-becomes-portable (bigger prize, needs legal opinion):** structured *at the moment of the pull* so the driver authorizes Storm (as their agent) to retain + selectively re-disclose derived facts, with Pace funding. This is the DEC-2026-05-013 cached-attestation model and **requires a formal FCRA opinion** before build/market.
   - **Honest caveat:** a driver-furnished fact is likely a pre-qual that speeds placement and avoids wasted pulls — not a wholesale replacement for the carrier's compliance pull. Don't oversell "replaces the background check."

**3. Blockchain (Midnight) is load-bearing — for Storm's specific competitive situation.**
The abstract *defensibility* moat vs. incumbents is still selective disclosure + candidate ownership (a JWT delivers ~80% of that UX). But Storm is a **late entrant with no network**, and that's exactly where the chain earns its keep: a signed JWT requires the verifier to **trust Storm**; a Midnight ZK proof lets any carrier **trust the math** — no network membership, no reputation, no account required to verify. **Network-independent portable trust is a cryptographic property, not a UX one** — and it's the mechanism by which a late entrant overcomes a 20-year network advantage. So Midnight is not "implementation detail"; it is the load-bearing answer to "how do we win without Tenstreet's network?" Build it for real (DEC-2026-06-001 quality bar); never fake it.

**4. Utility token + soulbound credential cards: committed roadmap (with guardrails intact).**
Promoted from "captured, NOT scheduled" to **committed direction** (sequencing still gated on the real Midnight slice landing first):
   - **Soulbound credential cards in the career card** — each verified attestation rendered as a **non-transferable** SBT inside the existing career card (the vault). Soulbound to `users.id`, Storm-held anchor, candidate never sees a wallet.
   - **STORM as a Midnight-native shielded *utility* token** — surfaced as "Storm Points," pure utility (no profit-share, no governance — stays outside Howey), no driver wallet UX.
   - **Guardrails are not loosened (this is the line that keeps us out of the rejected pile):** transferable/tradeable credential NFTs, fungible tradeable credential tokens, driver-as-vendor-with-wallet, and income-share/"driver pool" tokens **remain permanently rejected** (MOAT_THESIS rejected-ideas appendix). Soulbound ≠ tradeable; utility ≠ security. If a token feature drifts toward transferability or profit-sharing, it's rejected, not roadmap.

### Consequences

- `MOAT_THESIS.md`: retire the "chain is implementation detail / we don't position as blockchain-based / Phase 3 only if a customer asks" lines; add the network-independent-trust = load-bearing framing, the Tenstreet "don't compete on network, compete on portability" section, and the agency-funded model. Not-a-CRA posture unchanged.
- `ARCHITECTURE.md` + `EXECUTION_CHECKLIST.md`: SBT + token move from "future considerations, not scheduled" to a sequenced part of the active Phase 3 arc (after the one-fact Midnight slice).
- `TOKEN_BRIEF.md`: "we're not building it now" → committed roadmap with quality bar + guardrails.
- `PARTNERS.md`: add agency-as-sponsor funding (Pace funds the pull; driver owns the portable fact).
- **Open legal question (must resolve before path (b) or any marketplace):** FCRA opinion on funded-pull-becomes-portable vs. driver's-own-records-sponsored. Start with (a).

### Related

- DEC-2026-06-001 (Phase 3 active, GTM-driven, quality bar)
- DEC-2026-05-011 (candidate-as-agent / not a CRA — unchanged, load-bearing here)
- DEC-2026-05-012 (deferred SBT + STORM — now promoted to committed by this entry)
- DEC-2026-05-013 (cached-attestation marketplace — the path (b) economic model; still needs FCRA review)
- DEC-2026-05-014 (provenance gate), DEC-2026-05-016 (celebrate the chain as narrative)
- `MOAT_THESIS.md` rejected-ideas appendix (the guardrails that keep token/SBT legitimate)

---

## DEC-2026-06-001 — Phase 3 (Midnight ZK) reframed from deferred to an active, go-to-market-driven track

**Date:** 2026-06-09
**Status:** Accepted (supersedes the *deferral timing* of DEC-2026-05-004; the honesty guardrail from that decision is retained intact)
**Decided by:** Owner

### Context

Phase 2 (selective-disclosure attestations) shipped (P2.1–P2.7). The docs gated Phase 3 on a *defensive/technical* trigger — "only when a customer, regulator, or investor requires cryptographic non-repudiation" (DEC-2026-05-004, `ARCHITECTURE.md`, `PROJECT_ROADMAP.md`). Because `strategic-direction.mdc` is an always-applied rule, every AI session read that gate and pushed back on any Midnight work, repeatedly relitigating a settled direction.

The owner's call: the stronger, time-sensitive trigger is **go-to-market + ecosystem**, not non-repudiation.

- Midnight is a new chain; being one of the first *real, regulated-industry* (trucking DQ-file) use cases is a narrative + partnership asset that only exists while it's novel. The window is finite.
- A genuine end-to-end integration can earn Midnight ecosystem support (grants, co-marketing, foundation amplification). The brand already commits to the chain story (`stormchain.ai`, DEC-2026-05-016).
- Time-to-market is a real success factor and was being treated as a cost rather than the opportunity.

### Decision

1. **Phase 3 is an active track**, driven by go-to-market/ecosystem timing — not deferred behind a non-repudiation trigger. The "do not start Phase 3" language is retired from `strategic-direction.mdc`, `ARCHITECTURE.md`, `EXECUTION_CHECKLIST.md`, and `PROJECT_ROADMAP.md`.
2. **The quality bar is absolute (Storm is not a crypto scam project).** Time-to-market means time-to-*credible*, never time-to-garbage. No demo-ware shipped as real; if a fact says "proven on Midnight," the proof must actually run and verify.
3. **These guardrails are explicitly retained, unchanged:**
   - **Honesty constraint (DEC-2026-05-004):** narrate the vision now ("built on Midnight"); claim a *per-fact* live ZK proof only when that proof genuinely runs.
   - **Interaction gate (DEC-2026-05-001):** users never touch a wallet, seed phrase, gas, or signing.
   - **Provenance gate (DEC-2026-05-014):** only third-party / issuer-signed facts are proven; self-reported data is never attested.
   - **One-line swap:** Phase 3 ships `midnight-attestation-service.ts` behind the existing `attestationService` interface; no rewrite of the carrier UI, fact registry, or `block-data.ts`.
4. **Sequencing:** keep expanding the third-party fact registry (breadth feeds future circuits) and stand up Midnight as a parallel track, starting with a thin one-fact testnet slice to de-risk the toolchain (WSL2 + Compact, proof server) before committing any public timeline.

### Consequences

- AI sessions should treat Midnight requests as "yes — here's how we do it for real." The only legitimate pushback is on shortcuts that would ship something fake.
- External dependency to verify before a public timeline: Midnight network maturity / proof-shape support.
- Stripe payments remain a separate deferred greenfield track (unchanged).

### Related

- DEC-2026-05-004 (Phase 3 deferral — superseded on timing; honesty constraint retained)
- DEC-2026-05-016 (celebrate the chain as narrative)
- DEC-2026-05-001 (interaction gate), DEC-2026-05-014 (provenance gate), DEC-2026-05-011 (candidate-agent / not-a-CRA)
- `docs/midnight/EXECUTION_CHECKLIST.md` Phase 3 section

---

## DEC-2026-05-016 — Public positioning: celebrate the chain (narrative), keep gating chain interaction (UX)

**Date:** 2026-05-30
**Status:** Accepted (revises the customer-facing language rules only; does NOT touch the provenance gate or the interaction gate)
**Decided by:** Sole engineer

### Context

The prior language rules (`.cursor/rules/strategic-direction.mdc`) suppressed *all* customer-facing mention of "blockchain," "on-chain," "Midnight," and "Web3" until Phase 3 shipped. The intent was sound — don't spook a non-crypto trucking B2B audience, and don't over-claim verification that isn't live yet. But it collapsed **three different things** into one blanket "don't say blockchain":

1. **Narrative** — talking about cryptography / Midnight as the credibility story.
2. **Interaction** — making a user touch a wallet, seed phrase, gas, or signing.
3. **Claim** — attaching a "verified / on-chain" badge to a specific fact.

The domain is **`stormchain.ai`**; the in-app product is simply **"Storm."** The engineer presents Storm publicly (tech-week talks) leaning into the blockchain story and gets strong, positive audience response. Suppressing the *narrative* leaves credibility and excitement on the table for no benefit — the thing that actually spooks non-crypto B2B buyers is being asked to *do* crypto, not *hear* about it.

### Decision

Split the blanket rule into three axes and only loosen the narrative one:

1. **Narrative — now ENCOURAGED publicly.** Storm may celebrate Midnight, zero-knowledge proofs, selective disclosure, and "blockchain" as its trust/credibility story on the marketing site, decks, and talks. The domain `stormchain.ai` leans into this on purpose. Domain ≠ product name: the URL carries the chain story, the in-app voice stays "Storm / Stormi."
2. **Interaction — gate UNCHANGED.** Users still never touch a wallet, seed phrase, signing, gas, or token UX. Web2-simplicity invariant from DEC-2026-05-001; absolute.
3. **Claim — gate UNCHANGED (provenance + honesty).**
   - Only **issuer-signed / third-party facts** (MVR, PSP, employment verification, future CDLIS) may carry a "verified / tamper-proof / on-chain" claim (DEC-2026-05-014 provenance gate + `PROJECT_ROADMAP.md` blockchain policy). **Self-reported data is NEVER "blockchain-verified."** Iron-clad; not touched here.
   - Don't claim a specific fact is *currently* ZK-proven on Midnight before Phase 3 ships. Narrate the architecture/vision in "built on / designed for" framing, not a per-fact "this MVR is proven on Midnight right now" claim, until the proof is real (DEC-2026-05-004).

### Consequences

- `strategic-direction.mdc` "Language rules" rewritten: blockchain / Midnight / on-chain / ZK / selective disclosure move from **Don't use** to an **encouraged narrative** list, with the provenance + honesty + interaction guardrails spelled out beside it.
- "Web3" stays **discouraged as a positioning term** — dated / crypto-bro coded — even though "blockchain" is now fine. Brand-taste call, not a moat rule.
- The "Users will never see Midnight" line is reworded to "Users never *interact with* the chain" — they may very well *read about* it.
- **No code changes.** Per-fact verification UI still flows through `attestationService` and still obeys the provenance gate.

### Related

- DEC-2026-05-001 (Web2 simplicity — origin of the interaction gate)
- DEC-2026-05-014 (provenance gate — the claim gate, unchanged)
- DEC-2026-05-004 (Phase 3 deferred — honesty constraint on live-proof claims)
- `docs/PROJECT_ROADMAP.md` "Blockchain policy — honest usage only" (per-fact claim rules, unchanged)

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
**Status:** Accepted (Phase 4 — still gated, but the gate is now explicit per [DEC-2026-06-002](#dec-2026-06-002): a **formal FCRA opinion** on funded-pull-becomes-portable + Pace co-design. The "candidate-controlled / agency-funded" framing in DEC-2026-06-002 is the funding model this marketplace rides on.)
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

## DEC-2026-05-012 — Phase 3b token strategy: SBT credentials + Midnight-shielded STORM

**Date:** 2026-05-27
**Status:** ✅ **Promoted to committed roadmap by [DEC-2026-06-002](#dec-2026-06-002)** (2026-06-09). No longer "deferred until a trigger" — it's the sequenced layer after the real Phase 3a Midnight slice. Guardrails below (soulbound = non-transferable, STORM = pure utility) are unchanged and non-negotiable. The "trigger conditions" framing below is historical.
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
**Status:** ⚠️ **SUPERSEDED on timing by [DEC-2026-06-001](#dec-2026-06-001--phase-3-midnight-zk-reframed-from-deferred-to-an-active-go-to-market-driven-track)** (2026-06-09). Phase 3 is now an active, go-to-market-driven track — *not* gated behind a non-repudiation trigger. **The honesty guardrail from this decision (no per-fact live-proof claim until the proof actually runs) is retained.** The deferral framing below is historical.
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

**Last updated:** 2026-05-30
