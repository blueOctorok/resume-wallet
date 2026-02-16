# StormChain Token (STORM) — Smart Contract Design

Design for the STORM ERC20 token and distribution system on Base. Aligns with [STORMCHAIN_WHITEPAPER.md](./STORMCHAIN_WHITEPAPER.md) and [TOKEN_STRATEGY.md](./TOKEN_STRATEGY.md).

---

## Overview

| Item             | Value                                                            |
| ---------------- | ---------------------------------------------------------------- |
| **Network**      | Base only (mainnet + Base Sepolia for dev)                       |
| **Total supply** | 15,000,000 STORM (fixed at deploy, no minting thereafter)        |
| **Decimals**     | 18                                                               |
| **Security**     | OpenZeppelin contracts only; no custom auth or mint after deploy |

---

## Decimals and fractional distribution (like BTC)

STORM must support **distribution in decimals** so rewards can be fractional (e.g. 0.44 tokens per $3 USDC when the pool is nearly depleted).

- **Standard:** ERC20 with **18 decimals** (same as ETH and most tokens). One full token = `1e18` internal units.
- **Implications:**
  - Reward formula can output values like `0.44` or `6.16` STORM; the contract stores and transfers them as integer units (e.g. `440000000000000000`).
  - Backend computes rewards in human-readable form (e.g. float), then passes `amount` in wei to the distributor (e.g. via `parseUnits("0.44", 18)`).
  - No rounding down to whole tokens required; late users still receive sub-token amounts, similar to Bitcoin’s satoshi-level granularity (BTC uses 8 decimals; 18 gives more precision).
- **Contract:** No special logic needed; OpenZeppelin ERC20 uses 18 decimals by default and all transfers/balances are in wei. Distributor and vesting contracts just use the same units.

---

## Token contract (ERC20)

- **Name:** `StormChain`
- **Symbol:** `STORM`
- **Decimals:** `18`
- **Supply:** 15,000,000 × 10^18 units minted once in the constructor (or initializer if using a proxy). No `mint()` or minter role after deploy.
- **Implementation:** OpenZeppelin `ERC20`; constructor mints total supply to deployer, then deploy script moves all tokens to their destinations. Optional: OpenZeppelin `Pausable` if emergency pause is desired.

---

## Allocation at deploy (15M total)

| Allocation        | Amount (STORM) | Recipient                  |
| ----------------- | -------------- | -------------------------- |
| User rewards pool | 9,000,000      | RewardDistributor contract |
| Platform treasury | 3,000,000      | Treasury EOA/multisig      |
| DEX liquidity     | 1,000,000      | DEX liquidity EOA/multisig |
| Founder A         | 1,000,000      | VestingWallet A            |
| Founder B         | 1,000,000      | VestingWallet B            |

All amounts in the table are in “human” tokens; on-chain they are `amount * 10**18`.

---

## RewardDistributor contract

- **Purpose:** Holds the 9M user-reward pool and sends STORM to users when they earn rewards (backend computes amount from USDC spent and decay formula).
- **Holds:** 9,000,000 STORM (transferred from deployer at deploy).
- **Main function:** `distribute(address to, uint256 amount)` — transfers `amount` (in wei, 18 decimals) from the contract to `to`. Only callable by an authorized role (e.g. `REWARD_DISTRIBUTOR_ROLE`).
- **Security:** OpenZeppelin `AccessControl` for the role; `ReentrancyGuard` on `distribute`. No minting; no arbitrary token creation.
- **Decimals:** `amount` is in token wei (18 decimals), so fractional rewards (e.g. 0.44 STORM) are sent as `0.44e18`.

Reward formula and “remaining pool” tracking live off-chain; this contract only performs the approved transfer.

---

## Founder vesting

- **Mechanism:** OpenZeppelin `VestingWallet` (or equivalent), two instances.
- **Per founder:** 1,000,000 STORM (1e6 × 10^18 units), transferred from deployer to the vesting contract at deploy.
- **Schedule:** Start = deploy timestamp; cliff = 1 year (no releasable tokens); duration = 2 years after cliff (linear vest over 2 years). So: Year 1 = 0% released, Year 2 = 50% cumulative, Year 3 = 100% cumulative.
- **Decimals:** VestingWallet receives and releases token wei (18 decimals); fractional amounts can be released.

---

## Smooth decay (off-chain)

- **Formula:** `tokens = (USDC_spent × baseRate) × (remaining / 9_000_000)^0.7`
- **baseRate:** ~3.33 tokens per $1 USDC at 0% distributed.
- **remaining:** 9,000,000 − total_tokens_already_distributed_from_reward_pool.
- Implemented in backend; result converted to 18-decimal wei and passed to `RewardDistributor.distribute(to, amount)`.

---

## Security summary

- **OpenZeppelin only** for ERC20, AccessControl, ReentrancyGuard, VestingWallet.
- **Fixed supply:** no mint after deploy; all 15M created once.
- **Rewards:** only the distributor contract can move the 9M pool, and only via role-restricted `distribute`.
- **Base only:** deployment and operations on Base (and Base Sepolia for testing).

---

## Implemented Files

| File | Purpose |
|------|---------|
| `contracts/StormToken.sol` | ERC20 token, 18 decimals, 15M fixed supply, Pausable |
| `contracts/RewardDistributor.sol` | Holds 9M, `distribute(to, amount)` + `distributeBatch()`, AccessControl + ReentrancyGuard |
| `contracts/FounderVesting.sol` | Custom vesting: 1yr cliff, then 2yr linear vest |
| `scripts/deploy-storm-token.js` | Deploy script: deploys all contracts and distributes 15M |

---

## Deploy Commands

```bash
# Local test (Hardhat network)
npm run deploy:storm:local

# Base Sepolia (testnet) - set PRIVATE_KEY in .env.local
npm run deploy:storm:sepolia

# Base Mainnet (production) - set PRIVATE_KEY and wallet addresses in .env.local
npm run deploy:storm:base
```

---

## Environment Variables (for production)

Set these in `.env.local` before deploying to mainnet:

```env
PRIVATE_KEY=your_deployer_private_key
TREASURY_ADDRESS=0x...
DEX_LIQUIDITY_ADDRESS=0x...
FOUNDER_A_ADDRESS=0x...
FOUNDER_B_ADDRESS=0x...
```

If not set, the deploy script uses the deployer address for testing purposes.

---

## Contract Functions

### StormToken.sol

| Function | Access | Description |
|----------|--------|-------------|
| `pause()` | Owner | Emergency pause all transfers |
| `unpause()` | Owner | Resume transfers |

### RewardDistributor.sol

| Function | Access | Description |
|----------|--------|-------------|
| `distribute(to, amount)` | DISTRIBUTOR_ROLE | Send STORM to a user (amount in wei) |
| `distributeBatch(recipients[], amounts[])` | DISTRIBUTOR_ROLE | Gas-efficient batch distribution |
| `remainingPool()` | Public (view) | Check remaining tokens in pool |
| `totalDistributed` | Public (view) | Total tokens distributed so far |
| `emergencyWithdraw(to, amount)` | DEFAULT_ADMIN_ROLE | Recovery function |

### FounderVesting.sol

| Function | Access | Description |
|----------|--------|-------------|
| `release()` | Anyone | Release vested tokens to beneficiary |
| `vestedAmount()` | Public (view) | Total tokens vested so far |
| `releasable()` | Public (view) | Tokens available to release now |
| `vestingStatus()` | Public (view) | Full vesting info (allocation, dates, etc.) |

---

## Post-Deploy Checklist

1. **Verify contracts on Basescan** (commands printed by deploy script)
2. **Add contract addresses to `.env.local`**:
   - `STORM_TOKEN_ADDRESS`
   - `REWARD_DISTRIBUTOR_ADDRESS`
3. **Grant DISTRIBUTOR_ROLE** to your backend/ops wallet if different from deployer
4. **Implement backend reward logic**: compute decay, call `distribute(user, amount)`
5. **Track `totalDistributed`** for decay formula (query from contract or track in DB)
