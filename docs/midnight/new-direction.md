# Strategic Direction: Storm Platform v2

> **Historical document — frozen May 2026 boss memo.** This is the original strategy reset proposal. It mentions "Clerk" as the auth provider; that was the **initial recommendation** and was later revised to **Supabase Auth** on 2026-05-22 once we factored in the Supabase Pro subscription, RLS integration, and existing `companies` model. For the current locked decisions, see [`DECISION_LOG.md`](./DECISION_LOG.md) and [`ARCHITECTURE.md`](./ARCHITECTURE.md). For atomic execution steps, see [`EXECUTION_CHECKLIST.md`](./EXECUTION_CHECKLIST.md).

**TL;DR** — The current build delivers ~30% of what you asked for. There's a way to deliver 100% of it _and_ build a moat that companies like Tenstreet and DriverFacts cannot copy without rebuilding their entire business. It requires a 10-week refactor and one architectural shift. No clients are disrupted. Pace remains the anchor customer.

---

## What you originally asked for

A platform where a driver's DOT record — applications, MVR, employment history, qualifications — is **stored in a way that's permanent, portable, and doesn't require phone calls to verify.** The driver carries their record with them. Carriers can trust it without redoing the work.

This was the right vision. It's still the right vision. We need to deliver it better than we have so far.

---

## Where we actually are

What we built so far:

- Drivers can complete DOT applications and upload MVR/PSP results.
- We hash a copy of the document on a public blockchain (Base).
- We store the actual document on a separate decentralized file system (IPFS).
- We attach a "verified" badge in the UI when this happens.

What this delivers in practice:

- **Permanence:** partial. The document only stays available as long as we keep paying our file-storage vendor (Pinata). The hash on the blockchain proves a file existed but doesn't preserve the file itself.
- **Shareability:** weak. Sharing means sending a PDF link. The carrier gets the entire document or nothing — no middle ground.
- **No phone calls:** unsolved. The carrier still has to read the PDF and decide whether to trust it. We haven't replaced the verification call, just digitized the document.
- **Differentiation:** none. The "blockchain verified" badge is marketing language. A competitor could replicate this in two weeks without using a blockchain at all.

The honest read: we built a gesture at the vision, not the vision itself. And the part of the stack that's "blockchain" isn't doing real work for our customers.

---

## What's actually possible — and the moat we've been looking for

A different class of cryptography (zero-knowledge proofs) lets a driver **prove specific facts about their record without exposing the record itself.** Not a hash of a PDF. The actual claim, mathematically verifiable.

Examples of what a carrier would see instead of an MVR PDF:

- ✓ No moving violations in last 36 months
- ✓ No DUI convictions ever
- ✓ Class A CDL with Hazmat, valid through 2028
- ✓ Verified by [licensed CRA] on [date]
- (DOB, license number, address, individual violation records — _not shown_)

The carrier knows the driver is hireable. The driver hasn't handed over PII to a stranger. **No phone calls. No PDF inspection. No trust required — just verified math.**

This isn't speculative tech. It exists today on a blockchain called Midnight (launched March 2026). It's the only blockchain in production designed specifically for this kind of selective disclosure.

---

## Why this is a structural moat — not just a feature

Our biggest competitors in trucking compliance — **Tenstreet, DriverFacts, HireRight, Foley** — are all built on a 20-year-old architecture: they are CRAs (Consumer Reporting Agencies) that produce **full-disclosure reports**. Their entire business model, their compliance posture, and their carrier relationships are structured around carriers receiving the whole document.

To match what we'd be offering, they would have to:

1. Rebuild their core platform around selective disclosure
2. Renegotiate every CRA agreement they have
3. Get every state DMV and FMCSA system to issue cryptographically structured data instead of PDFs
4. Convince thousands of carriers to accept proofs instead of paper

**They can't.** Not in a reasonable timeframe. Not without burning their own boats. This is the rare kind of moat where incumbents are _structurally prevented_ from copying us — not just slow.

The window is open right now because the technology to do this only matured in 2026. We're not late to a trend. We're early to one.

---

## What we'd change technically (the boring version)

| Today                                      | Proposed                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| Drivers log in via crypto wallet (Alchemy) | Sign in with email or Google (Clerk)                                     |
| Carriers pay for screenings in USDC        | Stripe (credit card / ACH) — what they actually want                     |
| Documents stored on IPFS via Pinata        | Stored in our database (Supabase)                                        |
| Hash-stamping on Base testnet (decorative) | Real cryptographic proofs on Midnight (load-bearing) — added when needed |
| Token rewards (STORM)                      | Off-chain "Storm Points" now; Midnight-native shielded **utility** STORM is committed roadmap after the Phase 3 slice (DEC-2026-06-002) |

**Net effect for Pace and any other carrier:** simpler onboarding for drivers, payment with normal credit cards, faster product iteration, and over time, verifiable credentials that no competitor can match.

---

## Phased plan

**Phase 1 — Foundation cleanup (4–6 weeks)**
Move to the standard SaaS stack (Stripe, Clerk, Supabase). Drop crypto wallet onboarding. Keep all existing data. Pace gets a noticeably better product immediately — drivers onboard in 30 seconds, carriers pay with a credit card, the platform feels professional rather than experimental.

**Phase 2 — Selective-disclosure UX (3–4 weeks)**
Build the carrier-facing experience that makes the moat _visible_: structured verified facts instead of PDFs. Driver-controlled toggles for what's shared with which carrier. Backed initially by signed digital attestations from us as the platform issuer.

**Phase 3 — Cryptographic backbone (active track, go-to-market driven — DEC-2026-06-001)**
Upgrade the underlying mechanism from signed attestations to Midnight zero-knowledge proofs. Same UI, stronger trust layer. The driver is being an early *real* regulated-industry use case on Midnight while that's novel — built for real, behind the same swappable `attestationService` interface. (Originally framed as deferred-until-customer-asks; that framing was retired — see DEC-2026-06-001.)

**Total: ~10 weeks of focused work for Phases 1 + 2 (both shipped). Phase 3 is the active track.**

---

## What this protects us from

- **Incumbents (Tenstreet et al.) catching up** — they can't, structurally
- **Building infrastructure no customer asked for** — Phase 3 only happens if revenue justifies it
- **Hardware/operational complexity** — entire stack runs on managed services we already use (Vercel, Supabase) plus Stripe and Clerk
- **Regulatory risk on the CRA side** — selective disclosure is a _better_ FCRA/CRA posture than re-hosting documents

---

## What I need from you

1. Approval to start Phase 1 (no crypto wallet, Stripe payments, simpler onboarding) — this is a no-regret move regardless of the rest.
2. Agreement on the moat thesis — selective disclosure as the differentiator vs. existing CRAs — so I can build Phase 2 with that frame.
3. Acknowledgement that the original "everything on blockchain" framing was right in spirit but the implementation was wrong, and we're course-correcting toward the version that actually delivers it.

The goal hasn't changed since you first hired me to build this. The architecture has gotten clearer.
