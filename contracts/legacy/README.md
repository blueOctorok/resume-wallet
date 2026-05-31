# Legacy Base Sepolia contracts (archived)

These Solidity sources were deployed to **Base Sepolia** during Storm's early Web3 experiment and are **no longer used in production**. They are kept here for reference only.

| Contract | Role |
|---|---|
| `StormToken.sol` | ERC-20 STORM token |
| `RewardDistributor.sol` | USDC-backed user reward pool (25M allocation) |
| `TreasuryDistributor.sol` | Treasury pool (referral + platform rewards) |
| `FounderVesting.sol` | Founder vesting schedule |

**Disposition:** archived per [DEC-2026-05-005 Option B](docs/midnight/DECISION_LOG.md) — the Base Sepolia ERC-20 was dropped in Phase 1 demolition (step D1, 2026-05-31). STORM never reached real users. A future **Midnight-native** utility token may reuse supply/vesting *ideas* from these contracts; that work is deferred until a concrete reward model exists.

**Not in this folder:** `ResumeRegistry.sol` and `ProductionDriverRegistry.sol` remain in `contracts/` until step D2 (registry decommission).
