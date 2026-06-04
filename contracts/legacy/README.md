# Legacy Base Sepolia contracts (archived)

These Solidity sources were deployed to **Base Sepolia** during Storm's early Web3 experiment and are **no longer used in production**. They are kept here for reference only.

| Contract | Role |
|---|---|
| `StormToken.sol` | ERC-20 STORM token |
| `RewardDistributor.sol` | USDC-backed user reward pool (25M allocation) |
| `TreasuryDistributor.sol` | Treasury pool (referral + platform rewards) |
| `FounderVesting.sol` | Founder vesting schedule |
| `ResumeRegistry.sol` | On-chain hash anchor for uploaded/built resumes (~7 test anchors) |
| `ProductionDriverRegistry.sol` | On-chain hash anchor for DOT driver applications (test data only) |

**STORM disposition:** archived per [DEC-2026-05-005 Option B](docs/midnight/DECISION_LOG.md) — the Base Sepolia ERC-20 was dropped in Phase 1 demolition (step D1, 2026-05-31). STORM never reached real users. A future **Midnight-native** utility token may reuse supply/vesting *ideas* from those contracts; that work is deferred until a concrete reward model exists.

**Registry disposition:** archived per step **D2** (2026-06-01) — resume/DOT "verify" is now a **DB flag placeholder** until Phase 2 attestation ships. ~7 test resume anchors on Base Sepolia were disposable; no production Pace data was on-chain.
