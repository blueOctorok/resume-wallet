# Veree: Reference Price, Market Cap, and Distribution

_How supply, distribution, and a realistic target market cap fit together—and how to set the algorithm._

---

## The Core Idea

Before any USDC purchases and before trading exists, the token has **no market price**. What we _do_ have is:

1. **Total supply**: 15M
2. **Distribution algorithm**: Tokens = f(USDC spent) with decay. At start, ~3.33 tokens per $1 USDC (e.g. $3 spend → 10 tokens).
3. **An implied "reference value"**: If we say "10 tokens ≈ $3 value," that implies **$0.30 per token**

That **$0.30 is not a real price**—it's the number that makes our reward math consistent: _"We're giving you ~$3 worth of tokens for a $3 purchase."_ It only becomes a real price when we create a market (DEX liquidity).

The right way to set this is **backwards from a realistic market cap**.

---

## What Is "Market Cap" Before Trading?

Strictly speaking: **there is no market cap before trading.** Market cap = price × circulating supply, and without a market there is no price.

What we _can_ do is define a **target market cap at DEX launch**—i.e. "If we're successful, what’s a plausible valuation when we first list?"

That gives us:

- **Target market cap** (e.g. $1.5M)
- **Circulating supply at launch** (tokens already distributed + liquidity pool tokens, etc.)
- **Implied price** = Target market cap ÷ Supply (e.g. fully diluted: $1.5M ÷ 15M = **$0.10/token**)

We then align our **emission (how many tokens per $ spent)** with that implied price so the story is consistent.

---

## Realistic Market Cap Ranges (Pre-Trading / At Launch)

Rough benchmarks for a **utility token** with real product and revenue, but no trading yet:

| Stage                   | Description                           | Plausible FDV\* Range |
| ----------------------- | ------------------------------------- | --------------------- |
| Pre-launch / very early | Little revenue, small user base       | $500K – $1.5M         |
| Early traction          | Meaningful revenue, growing users     | $1.5M – $5M           |
| Proven product          | Strong retention, clear path to scale | $5M – $15M            |
| Category leader         | Dominant in niche, expansion          | $15M+                 |

_FDV = Fully Diluted Valuation = 15M × price per token_

**Why these ranges?**

- Comparable early-stage utility / reward tokens often sit in the low single-digit millions.
- We have real revenue (USDC) and real utility (verification, jobs), not pure speculation.
- Starting conservative ($1M–$2M FDV) is credible; we can grow from there.

**Suggested target for "successful but early":**  
**$1M – $2M FDV at DEX launch**  
→ Implied price = $1M ÷ 15M = **$0.067** or $2M ÷ 15M = **$0.133** (round to **~$0.10** for simplicity).

---

## Linking Target Price to the Distribution Algorithm

We want one consistent story:

- **"We give you roughly $X of token value per $X spent."**
- At launch, that’s Tokens are based on USDC spent (any product). Example: **~$3 USDC spent → ~$3 value in tokens.**

So:

**Target value per token** = (Target market cap ÷ 15M)  
**Tokens per $3 spend** = $3 ÷ (Target value per token)

| Target FDV | Implied Price | Tokens per $3 (to give ~$3 value) |
| ---------- | ------------- | --------------------------------- |
| $1.0M      | $0.067        | 3 ÷ 0.067 ≈ **45**                |
| $1.5M      | $0.10         | 3 ÷ 0.10 = **30**                 |
| $2.0M      | $0.133        | 3 ÷ 0.133 ≈ **22.5**              |
| $3.0M      | $0.20         | 3 ÷ 0.20 = **15**                 |
| $4.5M      | $0.30         | 3 ÷ 0.30 = **10** (current)       |

So:

- **If we want a ~$4.5M "reference" FDV**, 10 tokens per $3 is consistent (reference price $0.30).
- **If we want a more conservative ~$1.5M FDV**, we’d give **30 tokens** per $3 (reference price $0.10).

The **reference price** is the number that makes _"tokens per transaction × reference price = dollar value we want to give."_ It’s the price we’re _targeting_ at launch, not a market price today.

---

## Recommendation: Pick Target FDV, Then Set Base Reward

**Step 1 – Pick a target FDV at DEX launch**  
Example: **$1.5M** (conservative, credible for early success).

**Step 2 – Implied reference price**  
$1.5M ÷ 15M = **$0.10 per token**.

**Step 3 – Base reward per $3 USDC spent**  
"$3 value" ÷ $0.10 = **30 tokens** at the start (before decay).

So the formula would be:

```
reward = 30 × (remainingPool / totalPool)^0.7   // for $0.10 reference
```

Instead of:

```
reward = 10 × (remainingPool / totalPool)^0.7   // for $0.30 reference
```

**Trade-off:**

- **10 tokens, $0.30 reference** → More scarcity, higher implied FDV ($4.5M), fewer tokens handed out.
- **30 tokens, $0.10 reference** → More tokens per user, lower implied FDV ($1.5M), easier to hit "realistic" market cap at launch.

---

## Summary Table: Two Scenarios

| Assumption                      | Scenario A (current)  | Scenario B (conservative FDV) |
| ------------------------------- | --------------------- | ----------------------------- |
| Target FDV at launch            | $4.5M                 | $1.5M                         |
| Reference price                 | $0.30                 | $0.10                         |
| Base reward (resume $3)         | 10 tokens             | 30 tokens                     |
| "We give ~$3 value"             | 10 × $0.30 = $3 ✓     | 30 × $0.10 = $3 ✓             |
| Scarcity                        | Higher (fewer tokens) | Lower (more tokens)           |
| Ease of hitting "realistic" cap | Harder                | Easier                        |

---

## Bottom Line

1. **Before any USDC purchases and before trading, the token has no value and no real market cap.**
2. We **choose** a target market cap (e.g. $1.5M FDV) that we think is realistic if we’re successful.
3. That gives an **implied reference price** (e.g. $0.10).
4. We set **base reward** so that _tokens × reference price = target dollar value per action_ (e.g. $3 → 30 tokens at $0.10).
5. The **decay formula** (e.g. ^0.7) stays the same; only the **base reward** (10 vs 30) changes.

So: **yes—we should set the "initial fake price" (reference price) and the distribution algorithm together, by first picking a realistic target market cap for when trading begins.**

If you want to move to the conservative case (e.g. $1.5M FDV, $0.10 reference, 30 base tokens), we’d update the formula and docs accordingly.
