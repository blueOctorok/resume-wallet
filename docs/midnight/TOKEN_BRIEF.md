# Token & Credential Strategy — Quick Brief

**For:** boss conversation
**Read time:** 3 minutes
**Status:** Captured for the future. Not being built right now.

---

## The one-line version

Drivers earn portable, tamper-proof credentials they actually own — and eventually earn money when carriers re-use those credentials.

---

## What "soulbound" means (in plain English)

Each verified credential becomes a card the driver owns — like a digital CDL, MVR, or DOT app card. The catch: the card is **permanently glued to that one driver**. It can't be sold, traded, or given to someone else. If you have the card, you're the person who earned it.

Same idea as a professional license or a diploma — you can show it, but you can't sell it to your friend. That's exactly what makes it valuable: a tradable credential proves nothing about who's holding it.

---

## What we'd actually ship (three things)

### 1. The career card becomes the soulbound vault

Drivers already have a career card — it's their living, shareable Storm profile. In Phase 3 we upgrade it: the career card becomes the candidate's **soulbound vault**, and each verified credential (Clean MVR, Class A CDL with Hazmat, 3 years employment verified, etc.) shows up as a soulbound card *inside* it.

Carriers click the same career-card link they're used to. Behind the scenes, every credential is now cryptographically verifiable in under a second — no PDF needed, no fresh CRA pull needed.

Drivers never see a crypto wallet. Storm holds the technical piece on their behalf. To the driver, it just looks like the career card they already have, except now it's tamper-proof and the credentials inside it are real, portable, and theirs.

### 2. Storm Points

Drivers earn Storm Points for verifying credentials, completing their DOT app, accepting placements, referring others. Carriers earn them for subscribing and sponsoring driver verifications. Both sides spend points on platform discounts — cheaper MVR pulls, premium career card features, expedited verification.

It starts as a regular database ledger. Later, if it makes sense, we move it to a private blockchain (Midnight) where the balances are encrypted by default. The user surface stays "Points" — no crypto jargon ever.

### 3. Cached-credential payback (the cool one)

Today: a driver runs an MVR. Carrier looks at them → carrier pays $35 for a fresh pull. Next carrier looks at them → another $35. Same MVR, paid for over and over. **Driver gets nothing.**

What we'd ship: when a carrier evaluates a driver who already has a recent MVR (within 30 days), they can either pull fresh ($35) **or** query the existing one ($15). If they choose the cheaper option, **the driver pockets ~$5**. Carrier saves $20. Storm earns $10. Everyone wins.

The 30-day cliff matters — beyond 30 days, MVRs are too old to use anyway, so carriers must pull fresh. We don't compromise on freshness rules.

---

## Why this is cool

- **Drivers own something portable.** Not a PDF, not a screenshot — a verified, tamper-proof card they carry between employers.
- **Drivers earn money for being prepared.** First time in this industry. Self-investment compounds instead of evaporating.
- **Carriers save money on repeat lookups.** Real arbitrage, not a sales gimmick.
- **Tenstreet / HireRight can't ship this.** Their entire business is "produce a full report, charge per pull." Soulbound credentials and re-query economics break that model on contact.
- **The crypto/Midnight community recognizes this pattern.** It's a category they've been hoping someone would build for years. Real production use case → ecosystem grants, developer attention, investor interest.

---

## The boring guardrails

- **No driver crypto wallets.** Ever. Storm handles that side.
- **Soulbound = non-transferable.** No secondary market for credentials.
- **Pace co-designs the marketplace.** When a driver came through Pace, Pace gets routed economics on every cached query for that driver. Pace's revenue is preserved by design, not retrofitted later.
- **Storm mediates every transaction.** Drivers are never selling their data directly — that would trigger FCRA regulation we want to avoid.

---

## When

| What | When |
|---|---|
| Storm Points (off-chain) | Part of Phase 1 cleanup, ~6 weeks out |
| Career card upgraded to soulbound vault + credential cards inside | After the zero-knowledge work ships (Phase 3) |
| Storm Points on Midnight (private balances) | Same window — only if usage is real |
| Cached-credential payback marketplace | Phase 4 — needs Phase 2 in production + Pace at the table |

The discipline is intentional: each phase has to stabilize before the next one is designed. Skipping ahead breaks Pace's live app.

---

## Bottom line

Drivers get a wallet of soulbound credentials they actually own. They earn money when those credentials get re-queried. Carriers save money on amortized lookups. Storm captures middle margin on a transaction nobody else in trucking offers. Pace's revenue is co-designed in, not bulldozed.

We're not building it now. We're shipping the foundation so the option exists when the timing is right.

---

For the technical view → `ARCHITECTURE.md`
For the strategic reasoning → `MOAT_THESIS.md`
For decision rationale → `DECISION_LOG.md` (DEC-2026-05-012, DEC-2026-05-013)
