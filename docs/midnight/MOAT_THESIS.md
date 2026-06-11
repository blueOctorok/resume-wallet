# The Moat Thesis

**Audience:** boss, investors, sales conversations, internal alignment. Engineering decisions trace back to this.

**Core claim:** Selective disclosure of verified DQ-file facts is a structural moat against existing trucking compliance vendors. They cannot retrofit it without rebuilding their core platform and renegotiating every CRA / carrier agreement they have. The window for Storm to occupy this category is open *now* because the underlying technology only matured in early 2026.

---

## What "selective disclosure" means in plain English

Today, when a carrier wants to confirm a driver is hireable, they receive the **whole report**:

- An MVR PDF showing every license number, address change, every individual violation back to year X
- An employment-verification packet showing every previous employer, every gap, every detail
- A DOT application packet with full PII

The carrier needs *one piece of information* — "is this person hireable" — but receives *all of it*. The driver hands over their entire history to make a hiring decision.

Selective disclosure flips that. Instead of a PDF, the carrier sees:

- ✓ No moving violations in the last 36 months
- ✓ No DUI ever
- ✓ Class A CDL with hazmat endorsement, valid through 2028
- ✓ Verified by a licensed CRA on 2026-04-15

The DOB, license number, address, individual violation records, employer names — none of it is shown unless the driver explicitly chooses to share it for a specific role. The carrier has *exactly enough information to hire* and nothing more.

This isn't us removing fields from a PDF and calling it private. It's a mathematical proof that the underlying data has the property the carrier needs, computed from data the carrier never sees. The carrier *cannot* recover the underlying data — even with infinite compute — because the cryptography doesn't reveal it.

---

## Why this is a moat (and not just a feature)

A moat has to satisfy two conditions: **valuable to customers** and **hard for competitors to copy**. Selective disclosure satisfies both, and the "hard to copy" part is structural rather than just slow.

### Why it's valuable to customers

Three audiences benefit, all in different ways:

**Drivers** — they stop handing over their entire driving history every time they job-hop. Every interaction with a carrier today is a privacy concession. Selective disclosure restores their ability to share *only* what's needed for *that specific role*. This is dignity-as-feature, and drivers feel the difference immediately.

**Carriers** — their FCRA compliance posture improves. Today carriers handle full-disclosure reports, which means they handle PII they don't strictly need. Each PII byte in their possession is a liability. Receiving "✓ clean MVR" instead of an MVR PDF means less PII to secure, less to leak, less to retain, less to dispose of. **Better data hygiene with less effort.**

**Regulators** (FMCSA, FCRA enforcement) — Storm's posture is *better* than the incumbents'. Storm becomes a *prover of facts* about regulated reports, not a *re-host* of them. This is the legal posture FCRA always wanted from data brokers but never got.

### Why competitors can't copy it

Storm's biggest competitors in trucking compliance are **Tenstreet, DriverFacts, HireRight, and Foley**. All four are CRAs (Consumer Reporting Agencies) operating on the same 20-year-old architecture: produce a full-disclosure report, deliver it as a PDF, charge per pull.

For any of them to match selective disclosure, they would have to:

1. **Rebuild their core platform.** Their entire data model assumes "report" as the unit. Selective disclosure requires "fact" as the unit. This is a multi-year refactor of their primary product.
2. **Renegotiate every CRA agreement they have.** Their contracts with state DMVs, FMCSA, and carriers are structured around delivering whole reports. Selective disclosure requires new contractual language about what facts can be derived, signed, and shared without delivering the underlying report.
3. **Get every state DMV and FMCSA system to issue cryptographically structured data instead of PDFs.** This is a federal-level coordination problem. State DMVs are not motivated to change their issuance format because Tenstreet asks them to.
4. **Convince thousands of carriers to accept proofs instead of paper.** Carriers' internal compliance processes are built around storing PDFs. Switching to fact-based proofs requires retraining compliance staff and updating every internal audit procedure.

Each of these takes years individually. Doing all four in parallel without losing existing customers is essentially impossible — they would have to **burn their own boats**: cannibalize their full-disclosure business model to chase a new one. CRAs are notoriously bad at burning boats because their revenue is recurring and predictable, and disrupting their own customers is professionally suicidal.

This is the rare flavor of moat where incumbents are **structurally prevented** from copying — not just slow.

### What about new entrants?

A startup could in principle build the same thing. Storm's defenses against that:

- **First-mover access to Pace.** Pace is a strategic anchor customer. They are not just paying — they're shaping the product. Once Pace is using Storm-issued attestations as their default DQ delivery format, switching to a competitor means re-onboarding every driver in their pool. Pace's customers (the carriers Pace places drivers with) become accustomed to receiving Storm verifications. Replacing that is operationally costly.
- **Verified-credentials network effect.** Each driver added to Storm produces verified facts that carriers trust. The product gets better as more drivers verify. A late-arriving competitor would launch with zero verified drivers and ask carriers to trust them — Storm has months / years of accumulated trust by then.
- **Cryptographic agility + first-real-use-case timing.** Storm builds the real Midnight backbone now (Phase 3 active, DEC-2026-06-001) — not as speculative capital burn, but because being an early *genuine* regulated-industry use case on a young chain is itself a moat (ecosystem support, narrative, partnership). A late competitor would have to match both the verified-driver network *and* a credible on-chain integration. The `attestationService` interface keeps us swap-able (Midnight → Aztec → RISC Zero) without rewriting product code.

---

## Positioning: the driver-side counterpart, not a Tenstreet competitor (DEC-2026-06-002)

The instinctive fear is "Tenstreet has 20 years and vast data — how do we compete?" The answer is **we don't compete on their axis.** Tenstreet's **Xchange** is a carrier-contributed **employment-verification network** ([their framing](https://www.tenstreet.com/blog/driver-recruiting/introduction-to-xchange)): carriers feed each other verification responses, accumulated since 2006. That network is their moat — and it is **carrier-owned, network-bound, and treats the driver as inventory.** You cannot replicate it, and you shouldn't try.

| | Tenstreet (Xchange) | Storm |
|---|---|---|
| Customer | The carrier | The driver (sold *through* agencies like Pace) |
| Data ownership | Carrier-contributed, locked to the network | Driver-owned, portable |
| Trust source | Network membership | Cryptographic proof + cited CRA |
| Driver's role | Inventory (can dispute, not own) | Owner + discloser |

These are not the same company competing — they are **two sides of the same transaction.** Storm builds the thing Tenstreet structurally *can't* without inverting its business: the driver's own verified, portable credential vault. Concrete rules this implies:

- **Don't build an ATS or a verification network.** Don't chase data volume.
- **Storm's strong facts are CRA-sourced** (MVR, CDL class, PSP) — where the issuer is a third party (DMV/FMCSA via Accio), so Tenstreet has no special advantage. **Don't fight on `previous_employer_verified` via cold-emailing employers** — that's the exact problem Xchange's network already solved.
- **Midnight is the equalizer:** a proven, driver-owned fact works for *any* carrier (on Tenstreet or not), because the trust is in the proof, not the network. That's how a late entrant routes around 20 years of network density.
- **Interop, not dependency:** the long-game is Storm-verified facts flowing *into* a carrier's ATS (Tenstreet included) as the driver-side feeder — never building *on* Tenstreet's API as a data source (that makes Storm a feature, not a company).

## Funding model: candidate-controlled, agency-funded (DEC-2026-06-002)

The honest economic constraint: **drivers will not pay to screen themselves speculatively.** In trucking the carrier/agency always pays. This does **not** break candidate-ownership — because **the payer and the owner are different parties.** "Candidate-owned" means the driver controls *disclosure and portability*, not that they swiped the card.

- **Pace (or a carrier) funds the pull; the driver owns the resulting portable fact.**
- **Start with the lower-risk path:** the driver obtains their *own* records by right (FMCSA PSP ~$10, state MVR), Pace **sponsors the fee**. A consumer presenting their own data is not a CRA furnishing a consumer report. Value = a portable **pre-qualification / speed** signal — get qualified drivers to the front of the line, stop wasting pulls on drivers who won't pass.
- **The bigger prize (funded-pull-becomes-portable via consent at the moment of pull) needs a formal FCRA opinion** before build/market (DEC-2026-05-013).
- **Honest caveat:** a driver-furnished fact is likely a pre-qual that speeds placement, not a wholesale replacement for the carrier's compliance pull. Don't oversell "replaces the background check."

## Why this couldn't have been built before 2026

The privacy-preserving cryptography that makes this practical only matured this year:

- **Midnight** went mainnet (federated) in March 2026.
- **Aztec** is still in alpha as of mid-2026.
- **RISC Zero** is mature but EVM-flavored, which carries privacy compromises (recursive proofs verified by EVM contracts leak metadata that pure-privacy chains don't).
- **General-purpose ZK SDKs** (`snarkjs`, `circom`) existed earlier but were research-grade — not something you ship to production with confidence.

Any earlier and the underlying cryptography would have been a research project, not a product. Any later and someone else builds the trucking-vertical version first.

The window opened in 2026 and is open *now*. Every quarter we delay shipping selective disclosure is a quarter another vertical-focused entrant could occupy this category instead.

---

## Storm is not a CRA — and that's the point

**Storm will not register as a Consumer Reporting Agency.** This is a strategic, not a regulatory, decision and it's the structural reason the moat holds.

### Why "become a CRA" is the wrong instinct

It's tempting to think Storm should become a CRA so we can pull MVR / PSP / employment-verification data directly from state DMVs and FMCSA without Accio (or any other CRA) in the middle. Better margin, full control, direct relationships with the data sources. **This instinct is wrong, and following it would kill the moat.**

A CRA's economic model is "produce full-disclosure reports, charge per pull." Their data formats, their state DMV contracts, their FMCSA agreements, their carrier integrations — every single one is structured around delivering whole reports. That's why Tenstreet / HireRight / DriverFacts / Foley **cannot** ship selective disclosure: the entire revenue base depends on the report being the unit of sale.

If Storm registers as a CRA, we adopt the same operational shape and converge with the incumbents we are trying to disrupt. We would be a CRA with a slightly nicer UI competing against Tenstreet's 25-year head start on state DMV agreements, FCRA dispute infrastructure, and carrier contracts. That's a fight Storm loses.

### The FCRA nuance worth understanding

Phase 2's signed JWT attestation ("✓ clean MVR · signed by Storm") **probably qualifies as a consumer report under FCRA's broad definition** — it is information bearing on a consumer's character / personal characteristics being communicated to a third party for employment purposes.

That doesn't force Storm to be a CRA. It forces Storm to choose a **legal posture** that handles consumer-information exchange without becoming one. Three real options exist:

| Posture | What Storm is legally | Trade-off |
|---|---|---|
| **CRA (specialty)** | Direct producer of consumer reports under FCRA | Unlocks direct DMV / FMCSA access eventually; **kills the moat** |
| **Reseller** | Resells Accio's CRA output, governed by FCRA reseller rules | Well-trodden, simple, but Storm becomes "Accio with extra steps" |
| **Candidate's agent** | Tool the candidate uses to derive and share facts about their own consumer report | **Storm becomes a structurally different legal animal** |

### Storm's chosen posture: candidate's agent

Mechanism:

1. The candidate authenticates to Storm (Supabase Auth, after Phase 1 cutover).
2. Accio (or any future CRA backend) pulls the underlying MVR / PSP / employment-verification data on the candidate's behalf, with the candidate's FCRA-required authorization. Accio remains the regulated CRA. Accio holds the state-DMV agreements, takes the dispute load, and is the FCRA "consumer reporting agency" of record for the underlying report.
3. The candidate consents to a specific fact being **derived** from their report (`clean_mvr_12mo = true`) and **shared with a specific carrier**.
4. Storm produces and delivers that fact (Phase 2: signed JWT; Phase 3: Midnight ZK proof) **on behalf of the consumer to the consumer's authorized recipient**.

The carrier receives the fact through the candidate's authorized disclosure, not through a Storm-issued consumer report. **That's permissible disclosure under FCRA's consumer-authorization regime, not CRA activity.**

### Why this posture is structurally aligned with the existing product

Storm is already shaped like a candidate-side platform:

- Every block in the composable hub has the **candidate as the actor**.
- The candidate installs blocks, the candidate authorizes verifications, the candidate shares the career card.
- `.cursor/rules/product-philosophy.mdc` codifies "candidate-owned career identity" as the product thesis.

Selective disclosure (Phase 2 UX, Phase 3 cryptography) is just the explicit, granular, enforceable version of what Storm has been since day one. **Becoming a CRA would invert this entire architecture** — Storm would start acting on behalf of the carrier (the FCRA "user") instead of the candidate (the FCRA "consumer"). That breaks the product philosophy and the moat at the same time.

### Operational consequences

The candidate-agent posture has concrete implications for engineering:

- **Keep Accio (or any future CRA) as the data-pull layer.** Don't disintermediate. Their CRA stack is a 10-year moat we don't want to rebuild. Accio takes the FCRA dispute load; we deliver disclosure UX on top.
- **Every screening order is initiated with explicit consumer authorization.** This is already enforced via `screening_consent_bundles` and the FCRA + FMCSA + CDLIS package. Don't loosen this — it's load-bearing for the legal posture.
- **Every selective-disclosure share is candidate-initiated.** Stormi can recommend, but the consumer authorizes the share. Carriers cannot pull facts without a candidate-initiated grant.
- **Storm-produced attestations explicitly cite the originating CRA.** "✓ Clean MVR · derived from MVR pulled by Accio on 2026-04-15 · shared with Pace Drivers by Sarah J. on 2026-04-20." This makes the chain of custody explicit and keeps Storm's role as derivation/disclosure agent — not consumer-report producer — visible.

### When to revisit this with counsel

The candidate-agent posture is the right strategic choice now. Two trigger conditions warrant a formal FCRA legal review:

1. **Pace (or another anchor customer) commits to Storm-issued attestations as their default DQ delivery format** — i.e. carriers Pace places drivers with start receiving Storm attestations as the primary verification. At that scale, the candidate-agent legal theory needs documentation that survives discovery.
2. **Storm crosses ~10,000 verified drivers or starts producing attestations for non-Pace direct carriers at scale.** Volume and direct-to-carrier delivery both raise the regulatory bar.

Until then: **stay non-CRA, keep Accio as the regulated CRA layer, position every Storm-produced attestation as a candidate-authorized disclosure of a fact derived from a CRA-pulled report.**

### One-line version

> **CRAs sell reports about consumers. Storm sells consumers a way to share facts about themselves.** Different products, different legal exposure, different moats. Becoming a CRA collapses all three distinctions.

---

## Is the chain the moat? Two true statements that aren't contradictory

This was previously answered "no, the chain is implementation detail." That undersold it. The honest, more precise answer (DEC-2026-06-002):

**Statement 1 — The *defensibility* moat vs. incumbents is selective disclosure + candidate ownership.** A signed JWT already delivers ~80% of that *UX*. Tenstreet/HireRight can't copy it without burning their CRA model — that's the structural lock, and it doesn't strictly require a blockchain.

**Statement 2 — Midnight is *load-bearing* for Storm's specific competitive situation: a late entrant with no network.** This is where "the chain is just implementation detail" breaks down. A JWT requires the verifier to **trust Storm** (Storm holds the signing key; Storm could forge it). A late entrant hasn't *earned* that trust and has no 20-year network to lend it. A **Midnight ZK proof lets any carrier trust the math instead** — verifiable cold, with no Storm account, no network membership, no reputation required. **Network-independent portable trust is a cryptographic property, not a UX one** — and it is precisely the mechanism by which a late entrant overcomes a two-decade network advantage like Xchange's.

So: the chain is not the *abstract* moat, but it **is the load-bearing answer to "how does Storm win without Tenstreet's network?"** That makes it core product, not decoration. Build it for real (DEC-2026-06-001 quality bar); a fake or demo-grade integration earns nothing and burns credibility.

The order still matters — UX first (Phase 2 signed attestations, shipped), then the real Midnight backbone (Phase 3, active track) — but Phase 3 is no longer "only if a customer asks." The driver is go-to-market + ecosystem: being an early *real* regulated-industry use case on Midnight while that window is open (DEC-2026-06-001).

**Positioning, accordingly:** Storm leans into the blockchain story publicly (`stormchain.ai`, DEC-2026-05-016) — it celebrates Midnight / zero-knowledge / selective disclosure as the credibility narrative. The guardrail is honesty, not silence: narrate "built on Midnight" now; attach a per-fact "proven on-chain" claim only when that proof genuinely runs. Users still never *interact with* the chain (no wallet, no gas).

---

## Pricing implication

Selective disclosure changes what we can charge for, and how the carrier values it.

Today's CRAs charge per-pull for whole reports ($30–70 per MVR, etc.). The pricing is set by the cost of pulling the report from the source.

Storm can charge for *fact attestations* — and the carrier perceives more value because each attestation is exactly what they need, with less PII liability. That justifies different pricing structures:

- **Per-attestation pulls** for one-off hiring decisions (similar pricing to traditional MVR pulls)
- **Subscription access** for carriers placing many drivers, where each new driver's attestations are bundled into the subscription
- **DQ-file-as-API** pricing where carriers pay for ongoing access to a candidate's verified facts (with candidate consent)

The pricing model still works without ZK (Phase 2's signed attestations are pricable on the same axes). Phase 3's ZK upgrade adds a premium tier for customers who require cryptographic non-repudiation.

---

## Risks to the thesis

Honest catalog of where this could be wrong:

| Risk | Severity | Mitigation |
|---|---|---|
| Carriers don't actually want fewer documents — they want all the data and a "verified" badge | Medium | Pace as design partner; if Pace pushes back on fact-only delivery, Phase 2 ships an "expand to full report" affordance |
| Regulators (FMCSA, state DMVs) require full-report delivery for compliance | Medium | Storm becomes a *parallel* delivery path, not a replacement; carriers can fall back to full reports for regulatory submissions |
| Competitors do successfully retrofit selective disclosure faster than expected | Low–Medium | Network-effect moat (Pace's pool of verified drivers) creates additional defense beyond technical differentiation |
| Midnight (or any ZK chain) doesn't mature into production-grade infra by the time Phase 3 ships | Low (we can swap to Aztec or RISC Zero behind the same `attestationService` interface) | Documented in [`DECISION_LOG.md`](./DECISION_LOG.md) |
| The moat is real but the market is too small | Low (trucking compliance is multi-billion-dollar) | Selective disclosure is a primitive that generalizes beyond trucking. Same architecture serves nursing, healthcare, finance compliance |
| Drivers don't care about disclosure controls and never use them | Medium | Drivers benefit from "fewer phone calls / faster placements" even if they ignore the toggles. The disclosure mechanic is structurally beneficial whether or not drivers actively use it |

---

## What this means for product decisions

Every product decision should be evaluated against the moat:

- **Does this make selective disclosure more visible to carriers?** → Higher priority.
- **Does this make signed attestations swappable for ZK proofs later?** → Don't take shortcuts; respect the `attestationService` interface.
- **Does this generalize to other regulated industries?** → Consider; don't over-invest in trucking-only abstractions if a small additional effort generalizes them.
- **Does this lean on the blockchain story?** → Keep, and tell it honestly. Midnight is load-bearing for network-independent portable trust (DEC-2026-06-002) and a public credibility narrative (DEC-2026-05-016). The guardrail is honesty (no per-fact "proven on-chain" claim before the proof runs) and interaction-invisibility (no wallet/gas for users) — not silence.
- **Does this make Pace's life easier this week?** → High priority regardless. Pace pays the bills, and Pace's success makes the moat real.

---

## One-paragraph version (for emails / pitch decks)

Storm is the **driver-owned, portable DQ vault**: drivers build verified credentials once and selectively disclose facts ("✓ clean MVR, ✓ Class A with hazmat") to any carrier — instead of handing over full-disclosure PDFs full of PII the carrier doesn't need. Drivers control disclosure; agencies like Pace fund the pulls. Existing trucking-compliance vendors (Tenstreet/Xchange, HireRight, DriverFacts) own the *carrier* side — network-bound, carrier-owned, driver-as-inventory — and can't copy the driver-owned side without inverting their CRA business model. Storm builds the UX on off-the-shelf SaaS (Vercel, Supabase, Stripe) and the **real cryptographic backbone on Midnight** (active track) — because for a late entrant with no network, ZK proofs are the load-bearing way to make a driver-owned fact verifiable *cold*, by trusting the math instead of a network. The window is open now because the cryptography only matured in 2026. The first vertical-focused team to ship driver-owned, network-independent verified credentials in trucking owns the category.

---

## Rejected feature ideas (and why)

This section exists so future-you, future collaborators, and future AI sessions can recognize when a "killer feature" instinct is actually a moat-collapsing trap. Each rejected idea here was a real proposal worth taking seriously — and each has a structural reason it doesn't work for Storm.

**Pattern recognition rule:** when evaluating a new feature, run two checks before designing:
1. **Category check** — is the use case in the same legal/ownership/economic category as the asset it's being applied to? (DQ file ≠ real estate; credentials ≠ securities.) A category error invalidates everything else.
2. **Moat-direction check** — does this strengthen the existing moat or pull Storm toward becoming a competitor? If it pulls toward CRA-shaped resale infrastructure, transferable-credential markets, or full-disclosure delivery, **reject**.

### Tokenized DQ files as transferable NFTs

**Proposal:** Issue each driver's DQ file as an NFT they own.
**Rejected because:** Transferability breaks candidate ownership. A creditor could seize an NFT'd DQ file. A failed business could sell one in liquidation. Once transferable, the file stops being the candidate's — which collapses the candidate-ownership thesis from `product-philosophy.mdc`.

### Tradeable or fungible credential tokens

**Proposal:** Make credentials tradeable on a secondary market.
**Rejected because:** A secondary market for credentials creates fraud incentives — buyers who don't have the underlying qualification purchase proofs of it. The verification stops verifying the holder. Whatever liquidity it generates comes at the cost of the trust layer that makes Storm's product valuable.

### Driver-as-vendor of own consumer report (with Lace wallet)

**Proposal:** Drivers hold credentials in Lace wallet, sell access to carriers directly for crypto payment.
**Rejected because:** (1) Driver wallet UX (seed phrases, gas, signing) breaks the rule that drivers never see crypto. (2) FCRA driver-as-vendor posture is murkier than candidate-as-agent (DEC-2026-05-011). (3) Adverse selection — only drivers with clean records sell access — collapses the marketplace within a quarter. (4) Disintermediates Pace, undermining the partner promise in `PARTNERS.md`.
**The legitimate version of this insight (Storm-mediated cached-attestation marketplace) is captured as Phase 4 in [`ARCHITECTURE.md`](./ARCHITECTURE.md). It preserves the driver economic-compounding insight while routing all transactions through Storm and keeping driver UX wallet-free.**

### Income-share agreements / labor capacity tokens

**Proposal:** Drivers tokenize a percentage of future earnings, sell upfront for capital.
**Rejected because:** This is debt bondage / indentured servitude territory. 13th Amendment exposure, FLSA violations, anti-trafficking concerns. **Do not propose this in any form ever.**

### "Verified driver pool" tokens (fractional ownership of drivers)

**Proposal:** Carriers buy fractional ownership of pre-verified driver pools.
**Rejected because:** Tokenizing humans as inventory is illegal (anti-trafficking, ADA, FLSA) and morally indefensible. **Do not propose this in any form ever.**

### Storm registers as a Consumer Reporting Agency

**Proposal:** Storm becomes a CRA so we can pull MVR / PSP / employment-verification directly without Accio.
**Rejected because:** Adopting a CRA's operational shape (full-disclosure reports, per-pull pricing, state-DMV contracts, FCRA dispute infrastructure) converges Storm with Tenstreet / HireRight / DriverFacts — the incumbents we are structurally moated against. Becoming a CRA collapses the moat. See full reasoning in DEC-2026-05-011.

### Carrier-side headless proofs API (driver not in the loop)

**Proposal:** A carrier batches *their* existing CRA reports (Checkr / DISA / Accio output) through Storm's Midnight layer and gets ZK proofs back — no driver contact, no consent flow, pure B2B infrastructure.
**Rejected because:** (1) Storm would be processing consumer reports on behalf of the FCRA "user" (the carrier) — reseller/CRA territory, the same posture collapse as Storm-as-CRA. (2) Without the driver as hub, there is no driver-owned portable DQ file — Storm becomes commoditized middleware that any vendor can replicate. (3) It arms incumbent CRAs with our differentiator if extended to them.
**The legitimate version of this insight is the candidate-mediated Proof Request rail (DEC-2026-06-003, Phase 3c):** any carrier, any CRA, but the driver signs the authorization and owns the resulting portable fact. Interop over displacement — carriers keep their supplier; Storm cites it in `source_cra`.

### One-line takeaway

> **Generate ideas freely. Then run the category check and the moat-direction check before designing. Most "killer features" survive both. The ones that don't are captured here so we don't repeat the instinct.**

---

**Last updated:** 2026-06-10 (DEC-2026-06-003: rejected-ideas appendix gains "carrier-side headless proofs API"; the legitimate version is the candidate-mediated Proof Request rail, Phase 3c. Earlier: 2026-06-09 DEC-2026-06-002 chain-is-load-bearing + positioning; 2026-05-27 "Storm is not a CRA" + appendix — see `DECISION_LOG.md` DEC-2026-05-011/012/013, DEC-2026-06-001/002/003)
**Source conversations:** see `docs/midnight/new-direction.md` for the original boss memo
