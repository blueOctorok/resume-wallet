# StormChain Token (STORM) — Whitepaper

**We make hard-to-get jobs easy.**

StormChain is a blockchain-verified hiring platform for drivers and developers. The **STORM** token is the platform's reward token: earn it by using the platform, hold it for utility and potential value.

---

## Overview

| | |
|---|---|
| **Total supply** | 50,000,000 STORM (fixed, no new minting) |
| **Reward pool** | 50% (25M) to users |
| **Treasury** | 34% (17M) for referrals, community, buybacks |
| **Starting rate** | ~10 tokens per $3 USDC spent (applicants) |
| **Model** | Smooth decay (rewards decrease as pool is used) |

---

## What is STORM?

STORM is a **bonus token** you earn when you spend USDC on the StormChain platform. The more you spend, the more tokens you earn—resume verification, premium subscriptions, or any future product all use the same rule.

Think of it like airline miles or credit card points—except STORM can be traded and may increase in value as more people use the platform.

---

## How You Earn

**Tokens are based on how much USDC you spend, not which product you buy.** One formula for everything: spend $X USDC → earn Y tokens (with decay as the pool depletes).

### Examples (at current rate, before decay)

- $3 USDC spent (applicant) → ~10 tokens
- $3 USDC spent (employer) → ~5 tokens (0.5x rate)
- Any product, any price: same rule

As more tokens are distributed, the rate decreases (smooth decay). Early spenders earn more tokens per dollar.

**Why 10 tokens per $3 with a 50M supply?** Reward rates are based on the 25M user reward pool, not the full 50M supply. The remaining 25M serves other purposes: 17M for treasury (referrals, community programs), 5M for DEX trading liquidity, and 3M for founder vesting. Keeping the earn rate tied to the reward pool means every token you earn represents real, meaningful value — not inflated numbers.

---

## Token Distribution

There will only ever be **50 million STORM tokens**. No more can be created. Allocation:

| Allocation | Amount | % | Purpose |
|------------|--------|---|---------|
| User Rewards | 25,000,000 | 50% | Earned by users through platform usage |
| Platform Treasury | 17,000,000 | 34% | Referral rewards, community programs, buybacks, partnerships |
| DEX Liquidity | 5,000,000 | 10% | Initial trading liquidity |
| Founder A (Vested) | 1,500,000 | 3% | Co-founder, 3-year vesting |
| Founder B (Vested) | 1,500,000 | 3% | Co-founder, 3-year vesting |

**User Rewards** — Both applicants and employers earn STORM when they pay in USDC. Applicants earn at full rate (1x), employers at half rate (0.5x). Distributed from the RewardDistributor smart contract.

**Platform Treasury** — 17M held in a dedicated TreasuryDistributor smart contract (15M original allocation + 2M reserve consolidated). Funds referral rewards (5 STORM per successful referral), community bonuses, buybacks, and partnerships. Treasury tokens are released for specific events—not sold arbitrarily. Zero tokens sit in any uncontrolled wallet.

**Founders** — 1.5M STORM each; 1-year lock, then 2-year vesting (see Founder Commitment below).

**DEX Liquidity** — Initial pool when trading goes live, funded by platform revenue.

---

## Referral Program

Invite friends to StormChain and both of you earn STORM tokens from the treasury.

### How It Works

1. Share your unique referral link from your hub
2. Your friend signs up using that link
3. When they complete their first paid action (e.g., resume verification), **both of you receive 2.5 STORM**

### Reward Details

| Detail | Value |
|--------|-------|
| Reward to referrer | 2.5 STORM |
| Reward to referred user | 2.5 STORM |
| Total per referral | 5.0 STORM |
| Source | Treasury (15M pool) |
| Trigger | Referred user's first paid action |

### Anti-Sybil Protections

Referral rewards are protected by multiple layers of defense:

- **Self-referral blocked** — Database constraint prevents a user from referring themselves
- **One referral per user** — Each person can only be referred once (unique constraint)
- **Paid action required** — Rewards only trigger after real USDC spend, not signup alone
- **Per-user referral cap** — Maximum 500 completed referrals per user
- **Server-side wallet resolution** — Wallet addresses are always verified from the database, never from user input
- **Internal-only claim endpoint** — Reward distribution is protected by a shared secret; external callers cannot trigger payouts
- **Atomic status transitions** — Database updates prevent race conditions and double payouts
- **Same-wallet guard** — Even if two user IDs are different, same wallet addresses are blocked

---

## Smooth Decay Rewards

Token rewards are based on **USDC spent**, with a **smooth decay**—inspired by Bitcoin, but fairer. As more tokens are distributed, the rate per dollar decreases gradually.

### The formula

```
tokens = (USDC_spent × rate × userMultiplier) × (remaining / total)^0.7
```

- **rate** ≈ 3.33 tokens per $1 USDC at start (e.g. $3 → 10 tokens for applicants)
- **userMultiplier** = 1.0 for applicants, 0.5 for employers
- **remaining** = tokens left in the 25M user-reward pool
- **total** = 25,000,000 (user reward pool only; treasury is separate)
- **Exponent 0.7** = gradual decay (no sudden halvings)

**What this means:** Applicant spends $3 USDC → ~10 tokens at the start. Employer spends $3 USDC → ~5 tokens. By the time 50% of the pool is distributed, those amounts decrease to ~6 and ~3 tokens respectively.

### Decay curve (tokens per $3 USDC spent by applicants)

| Tokens distributed | % of pool used | Tokens per $3 USDC |
|--------------------|----------------|---------------------|
| 0 | 0% | **10.00** |
| 2,500,000 | 10% | 9.28 |
| 7,500,000 | 30% | 7.76 |
| 12,500,000 | 50% | 6.16 |
| 17,500,000 | 70% | 4.36 |
| 22,500,000 | 90% | 2.04 |
| 24,750,000 | 99% | 0.36 |

*Employers receive half these amounts at the same distribution levels.*

---

## Early Adopter Advantage

The first users earn the most tokens. As more people join, the reward amounts gradually decrease. This rewards early believers and creates urgency to join sooner—but it's **fair**: the first user and the hundredth user earn nearly the same amount.

**Potential upside:** Tokens have no market price until trading is enabled. Once the platform launches DEX liquidity, early token holders could see significant value if the platform grows successfully.

---

## How Token Value Works

**Before trading is enabled:** Tokens accumulate in your wallet but have no market price. They're like reward points waiting to be redeemed.

**When trading launches:** The platform uses revenue to create a liquidity pool. This establishes the first real price, and market supply/demand takes over from there.

**Revenue-backed model:** Unlike speculative tokens, STORM liquidity is funded by actual platform revenue. Every user-earned token represents real economic activity on the platform.

---

## Who Earns STORM?

**Everyone who pays in USDC earns STORM.** Both applicants and employers participate in the token economy, but at different rates to keep the token community-first.

| User Type | Rate | Example ($3 USDC at start) |
|-----------|------|----------------------------|
| **Applicants** | 1.0x (full rate) | ~10 tokens |
| **Employers** | 0.5x (half rate) | ~5 tokens |

### Why differentiated rates?

- **Applicants get full rate** — The token belongs to job seekers. They're the community.
- **Employers get half rate** — They participate and benefit, but don't dominate the token supply.
- **Every token is backed** — Both rates represent real USDC economic activity.

### Why include employers?

Employers are the primary revenue source. Excluding them from rewards while they fund the platform's growth doesn't make economic sense. The half rate prevents corporate accumulation while still rewarding real economic activity.

---

## For Employers

Employers **earn STORM at 0.5x the applicant rate** when they pay for platform services. You always **pay in USDC**, and STORM tokens are distributed as a bonus.

When token utility is live, employers who **hold STORM** in their wallet get **lower USDC transaction costs** on the platform (e.g. plans, bulk verification). You never pay in STORM—just hold it to qualify for the discount.

**Why this matters for employers:**

- Pay in USDC, earn STORM as a bonus (at half the applicant rate)
- Hold STORM to get lower USDC fees on plans and bulk verification
- Half rate keeps the token community-first while still rewarding your spending
- Governance voting may exclude employer-held tokens to preserve applicant voice

---

## Founder Commitment

The two founders each receive **1.5 million STORM tokens**. To show commitment, these tokens are locked and vest over time:

| Year | Cumulative unlocked | Status |
|------|---------------------|--------|
| 1 | 0% | Locked |
| 2 | 50% | Partial |
| 3 | 100% | Vested |

- **Year 1:** Full lock—no transfers
- **Year 2:** First half vests
- **Year 3:** Fully vested

This aligns founder interests with long-term platform success.

---

## Token Utility

| Use | Description |
|-----|-------------|
| **Hold** | Accumulate tokens before trading goes live |
| **Use** | Pay for subscriptions at a discount (e.g. 10% off) |
| **Trade** | Once trading is enabled, sell or buy on DEXs |
| **Vote** | Have a say in future platform features (governance) |

---

## Anti-Gaming Protection

Every STORM token represents real economic activity. Our anti-abuse mechanisms ensure fair distribution:

- **Tokens require real USDC payments** — No free claiming or bot farming
- **Smooth decay creates scarcity** — Rewards decrease with each transaction
- **Revenue-backed value** — Liquidity funded by actual platform revenue
- **Referral sybil protection** — Self-referral blocked at DB level, one referral per user, per-user caps, wallet-verified payouts
- **Server-side validation** — Reward endpoints are internal-only with cryptographic verification

---

## Smart Contract Architecture

| Contract | Purpose |
|----------|---------|
| **StormToken** (ERC-20) | Fixed 50M supply, standard ERC-20 with no mint function |
| **RewardDistributor** | Holds 25M user-reward pool, role-based distribution with decay |
| **TreasuryDistributor** | Holds 17M treasury (15M + 2M reserve), role-based distribution for referrals and programs |
| **FounderVesting** | 1.5M per founder, 1-year cliff + 2-year linear vesting |

All contracts use OpenZeppelin's AccessControl and ReentrancyGuard. Distribution functions are restricted to addresses with the DISTRIBUTOR_ROLE.

---

## Important Notes

- STORM is a **bonus reward**, not a requirement. The platform works fine without it.
- Tokens have **no market price** until trading is enabled.
- Token prices can go up or down once trading begins. This is not financial advice.
- You don't need to understand crypto to use the platform. STORM is just a bonus.

---

## Contact

Questions? **support@stormchain.ai**

---

*StormChain — We make hard-to-get jobs easy. Drivers. Developers. One platform. Verified.*
