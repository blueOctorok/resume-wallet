# StormChain Token Strategy & Tokenomics

## Executive Summary

The **STORM** token is designed as a dual-purpose asset that enhances the StormChain platform without compromising user experience. **Every token earned by users is directly backed by USDC spent on the platform**—applicants earn at full rate (1x), employers at half rate (0.5x). The platform's fixed supply includes separate allocations for treasury, founders, and DEX liquidity; these are pre-allocated at launch, not generated from USDC spend, and are used for operations, referral programs, and trading liquidity.

## Core Principles

### 1. USDC-First Functionality

- **All core features require USDC payments via Base Pay**
- Resume verification: $2.99 USDC
- Premium subscriptions: $9.99/month USDC
- Employer plans: $199/month USDC
- **STORM tokens are earned rewards, not payment requirements**

### 2. USDC-Backed Earning

- **Every earned token is backed by real USDC spend.** Applicants earn at 1x rate; employers earn at 0.5x rate. No USDC spend = no earned tokens.
- **Applicants (drivers, devs) earn at full rate (1x)** — the token is community-first and rewards the people verifying their careers.
- **Employers earn at half rate (0.5x)** — they participate in the token economy but don't dominate it; this prevents corporate accumulation while still tying their tokens to real spend.
- Note: treasury, founder, and DEX allocations are pre-minted at launch and are not "earned" via USDC. See distribution section for details.

### 3. Anti-Gaming Mechanism

- **Earned tokens can ONLY come from paid USDC actions** — no free claiming, no farming.
- Prevents spam, bot farming, and Sybil attacks.
- Every earned token represents real economic activity on the platform.

### 4. Community-First Supply

- **Total supply: 50 million tokens**
- 50% goes directly to user rewards — the largest allocation by far
- 30% treasury for referrals, community programs, and partnerships
- Founders take just 6% combined (3% each)
- Generous allocations signal that this project is for the users

## Token Distribution

### Total Supply Allocation (50M tokens)

| Allocation        | Amount     | Percentage | Purpose                                                       |
| ----------------- | ---------- | ---------- | ------------------------------------------------------------- |
| User Rewards      | 25M tokens | 50%        | Earned by users through platform usage (decay formula)        |
| Platform Treasury | 17M tokens | 34%        | Referral rewards, community programs, buybacks, partnerships  |
| DEX Liquidity     | 5M tokens  | 10%        | Trading liquidity (when USDC revenue funds the pool)          |
| Founder A         | 1.5M tokens| 3%         | 3-year vest (1-year cliff + 2-year linear)                    |
| Founder B         | 1.5M tokens| 3%         | 3-year vest (1-year cliff + 2-year linear)                    |

### Smart Contract Architecture

| Contract             | Holds  | Purpose                                                                 |
| -------------------- | ------ | ----------------------------------------------------------------------- |
| StormToken (ERC20)   | —      | Fixed 50M supply, minted once at deploy                                 |
| RewardDistributor    | 25M    | User rewards via decay formula. Backend calls `distribute()` after USDC payment. |
| TreasuryDistributor  | 17M    | Fixed-amount distributions for referrals, community, partnerships (15M + 2M reserve) |
| FounderVesting (x2)  | 1.5M each | 1-year cliff, 2-year linear vest                                    |

### Founder Allocation

- **Two founders: 1.5M STORM each** (3M total), allocated from token launch.
- **1-year lock**: Founders cannot transfer tokens for the first 12 months.
- **2-year vesting after lock**: Linear unlock from end of Year 1 to end of Year 3.
- Founders hold tokens as fair reward for building the platform — at 3% each, the vast majority of tokens belong to the community.

| Year | Cumulative Unlocked | Notes                   |
| ---- | ------------------- | ----------------------- |
| 1    | 0%                  | Lock period (no access) |
| 2    | 50%                 | Linear vesting          |
| 3    | 100%                | Fully vested            |

## Token Earning Mechanics

### Smooth Decay Emission Model (Bitcoin-Inspired)

StormChain uses a **smooth decay model** for token rewards—similar to Bitcoin's diminishing block rewards, but with gradual decay instead of sudden halvings. This creates:

- **Fairness**: Early users are rewarded, but not drastically more than slightly later users
- **Scarcity**: Rewards decrease over time, creating urgency to join sooner
- **Sustainability**: The reward pool lasts across millions of transactions

### The Formula: Tokens Based on USDC Spent

Token rewards are **based on how much USDC you spend**, not on which product you buy. One rule for everything:

```
tokens = (USDC_spent × baseRate × userMultiplier) × (remainingPool / totalPool)^0.7

Where:
- USDC_spent = amount paid in USDC (any product: verification, subscription, etc.)
- baseRate = ~3.33 tokens per $1 USDC at 0% distributed (e.g. $3 spend → 10 tokens)
- totalPool = 25,000,000 (user rewards allocation)
- remainingPool = totalPool - tokensAlreadyDistributed
- userMultiplier = 1.0 for applicants, 0.5 for employers
- Exponent 0.7 = gradual decay for scarcity
```

**Examples at 0% distributed:** $3 USDC → 10 tokens; $10 USDC → ~33 tokens. Same formula applies to any future product—tokens scale with spend.

### Decay Curve (tokens per $3 USDC spent, applicant rate)

| Tokens Distributed | % of Pool Used | Tokens per $3 USDC |
| ------------------ | -------------- | ------------------ |
| 0                  | 0%             | **10.00 tokens**   |
| 1,250,000          | 5%             | 9.64 tokens        |
| 2,500,000          | 10%            | 9.28 tokens        |
| 5,000,000          | 20%            | 8.54 tokens        |
| 7,500,000          | 30%            | 7.76 tokens        |
| 12,500,000         | 50%            | 6.16 tokens        |
| 17,500,000         | 70%            | 4.36 tokens        |
| 20,000,000         | 80%            | 3.30 tokens        |
| 22,500,000         | 90%            | 2.04 tokens        |
| 24,000,000         | 96%            | 1.10 tokens        |
| 24,750,000         | 99%            | 0.36 tokens        |

### Employer Earning (Half Rate)

When employers pay USDC, they **earn STORM tokens at 0.5x the applicant rate** via the same decay formula. The half rate keeps the token community-first while still rewarding real employer spend.

When token utility is live, employers who **hold STORM** in their wallet get **lower USDC transaction costs**. They never pay in STORM—only in USDC. Holding keeps supply tighter.

## Referral Program

### How It Works

Every candidate has a unique referral link on their hub. When a new user signs up via `?ref=CODE` and completes their first paid action:

- **Referrer earns 2.5 STORM** from the treasury
- **Referred user earns 2.5 STORM** from the treasury
- **Total cost per referral: 5 STORM** from TreasuryDistributor

### Treasury Runway

At 5 STORM per successful referral, the 17M treasury supports:
- **3,400,000 successful referrals** before treasury is used solely for referrals
- In practice, treasury also funds community programs and partnerships, so actual referral capacity depends on allocation decisions

### Referral Flow

```
User A shares link → User B signs up via ?ref=CODE →
User B completes first paid action →
TreasuryDistributor sends 2.5 STORM to A and 2.5 STORM to B
```

Referral rewards are one-time per referred user. A referrer can refer unlimited people.

### AvA Integration

AvA (the AI career assistant) contextually suggests referrals:
- After milestone completion: "Know someone who'd benefit? Share your referral link."
- When users ask about earning STORM: mentions referrals alongside paid actions
- Non-pushy — only when contextually relevant

## Treasury Allocation (17M — TreasuryDistributor Contract)

The 17M treasury (15M original allocation + 2M reserve consolidated) is held in a dedicated `TreasuryDistributor` smart contract (same security model as `RewardDistributor`). It is **not** a simple wallet — distributions require `DISTRIBUTOR_ROLE` authorization. Zero tokens sit in any uncontrolled wallet.

Treasury funds are used for:

- **Referral rewards** — 2.5 STORM to each party on successful referral
- **Community programs** — bonuses, driver-of-the-month, surprise rewards
- **Buybacks** — supporting token value during major dips
- **Partnerships** — strategic ecosystem collaborations
- **Platform runway** — operational flexibility

Treasury tokens are only released when a specific event triggers them. They are not sold arbitrarily.

## DEX Trading Strategy

### DEX Liquidity (5M allocation)

The 5M DEX allocation is reserved for when the platform has accumulated enough USDC revenue to provide meaningful liquidity. There is **no direct token sale** — users will acquire STORM by:

1. **Earning** through paid platform actions (decay formula)
2. **Earning** through referrals (treasury distribution)
3. **Buying** on DEX when trading opens (swap, not sale)

### Why DEX Only (No Direct Sale)

- No regulatory gray area — standard token swaps on a DEX
- Price is market-driven (supply/demand)
- Platform doesn't set the price — the market does
- Revenue-backed liquidity provides a price floor

### Revenue-Backed Model

This is a **revenue-backed token**:

- Every earned token (from the 25M user rewards pool) represents real USDC spend
- Treasury and DEX are fixed allocations — not generated from USDC
- DEX liquidity is funded by actual platform revenue
- Not speculation-driven or VC-funded

## Token Utility & Features

### Platform Benefits

- **Candidates**: Use tokens for subscription discounts
- **Employers**: Hold STORM to get lower USDC transaction costs
- **Priority support**: Token holders get enhanced customer service
- **Governance rights**: Vote on platform features and updates
- **Exclusive access**: Early access to new features

## Financial Projections

### Market Cap Scenarios (50M supply)

| Token Price | Market Cap | Notes                  |
| ----------- | ---------- | ---------------------- |
| $0.10       | $5M        | Early DEX launch       |
| $1.00       | $50M       | Established user base  |
| $5.00       | $250M      | Strong platform growth |
| $20.00      | $1B        | Major market adoption  |

_Actual price determined by market at DEX launch, backed by platform revenue._

## Launch Strategy

### Phase 1: Internal Accumulation (Current)

- **No DEX trading available**
- Users earn tokens through platform usage and referrals
- Build organic supply through real activity
- Platform accumulates USDC revenue
- Focus on product development without speculation noise

### Phase 2: DEX Launch (Future)

- **Platform provides initial liquidity** from accumulated revenue
- Proven utility before speculation begins
- Real user base ready to trade
- Controlled price discovery
- Treasury management for stability

## Anti-Spam Protection

- **Every earned token requires real USDC expenditure**
- **Referral tokens require a referred user to complete a paid action** — no farming referral codes
- No free claiming or farming possible
- Sustainable token distribution tied to revenue
- Scarcity from day one

---

_StormChain token combines sustainable platform economics with community-first design. 50% of supply goes to user rewards, 30% to community treasury, and founders take just 6%. Early users earn the most through smooth decay, referrals reward network growth, and the treasury ensures long-term program funding._
