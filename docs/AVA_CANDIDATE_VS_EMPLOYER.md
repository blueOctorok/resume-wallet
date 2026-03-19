# AvA: Candidate vs Employer — What We Built & What’s Next

**Summary for leadership.** AvA (our AI career assistant) is live on the **candidate** side with usage controls and USDC monetization. On the **employer** side we’ll offer AvA in a similar way but bundled into the employer **subscription**, not sold as credits.

---

## What We Implemented (Candidate Side)

### Product

- **AvA Chat** in the candidate hub: Claude-style chat that knows the user’s blocks, progress, and career context.
- **Value pitch:** “Unlike generic AI, AvA already knows your career — your blocks, your progress, your goals. Just ask.”
- **Career lane guardrails:** AvA only suggests blocks that match the candidate’s installed categories (e.g. drivers don’t get GitHub; devs don’t get CDL). Logic is **registry-driven** so new careers/blocks don’t require prompt rewrites.

### Usage & Monetization

| Tier | How it works | Model |
|------|----------------|------|
| **Free** | 10 messages/day per wallet. Resets daily (UTC). | Sonnet 4.6 |
| **Paid** | After daily limit, user buys **message credits** with USDC. Credits never expire. | Haiku 4.5 |

- **Credit packs (USDC on Base Sepolia):** Starter ($1 / 50 msgs), Standard ($3 / 200 msgs), Pro ($5 / 500 msgs).
- **Auth:** Every chat request requires the user’s wallet (`x-wallet-address`). No anonymous abuse.
- **Guardrails:** No medical/legal/financial advice; no harmful content. Otherwise conversational and helpful.

### Technical Highlights

- New **`ava_chat_usage`** table: daily free count + purchased credits per user; self-resetting daily (no cron).
- **GET/POST `/api/ai/credits`** for usage and credit purchase (POST takes `pack` + `txHash`).
- **AvaCreditModal** for USDC payment (same flow as MVR).
- **System prompt** built from the block registry so “stay in lane” and “off-limits” blocks scale with new careers.

---

## Employer Side: How It Will Differ

We will offer **AvA for employers** in a similar way (chat, context-aware, guardrails) but **pricing and packaging will be different**.

### Same Concept, Different Business Model

| Aspect | Candidate | Employer (planned) |
|--------|-----------|---------------------|
| **Access** | Per-wallet: free tier + USDC credits | **Included in employer subscription** |
| **Pricing** | Pay-per-credit packs (USDC) | No separate AvA fee; part of subscription |
| **Context** | Hub blocks, career, goals, progress | Employer context: company, jobs, candidates, hiring workflow |
| **Guardrails** | Career lanes (blocks/categories) | Employer lanes: talent search, requests, compliance, no candidate PII abuse |

### What Employer AvA Will Do (Planned)

- Answer questions about **using the platform**: talent search, candidate requests, MVR/verifications, company settings.
- Use **employer-specific context**: company name, open roles, what they’ve requested, compliance rules.
- **Stay in lane:** hiring/employer use cases only; no mixing in candidate-style blocks (e.g. “add a DOT application”).
- Same **content guardrails** (no medical/legal/financial advice, no harmful content).

### Why Subscription Instead of Credits

- Employers are **subscription** customers; adding a separate credit product would complicate billing and positioning.
- **Included AvA** supports adoption and stickiness of the employer product.
- Usage can be **fair-use** or **subscription-tier limits** (e.g. X messages/month per seat) instead of a credit store.
- If we need to limit heavy usage later, we can add **tiered message caps** (e.g. Starter 100/mo, Pro 500/mo) without introducing a separate payment flow.

### What We Reuse From Candidate AvA

- Same **auth pattern** (identify employer/user server-side; no anonymous use).
- Same **model strategy** (e.g. Sonnet for “premium” allowance, Haiku for overage if we ever add overage).
- Same **guardrail philosophy** (content + role-specific “stay in lane”) with employer-specific rules.
- **Registry / config-driven** design so new employer features can be reflected in AvA’s context and boundaries without hardcoding.

---

## Summary for Your Boss

1. **Candidate side (done):** AvA is live with 10 free messages/day, USDC credit packs for more, career-aware answers, and no cross-career confusion. Revenue from credits; design is scalable and registry-driven.
2. **Employer side (planned):** AvA will work similarly (chat + context + guardrails) but be **included in the employer subscription**, not sold as credits. Same quality and safety approach; different pricing and packaging to fit the employer product.

If you want, next step can be a short “Employer AvA — spec & subscription integration” doc (endpoints, context payload, and where it plugs into the subscription logic).
