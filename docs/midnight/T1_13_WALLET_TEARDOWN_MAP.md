# T1.13 Wallet Teardown Map (read-only)

**Generated:** 2026-05-30  
**Context:** Supabase-only auth cutover (T1.12c) is live and proven end-to-end (fresh signup → onboard → screening consent → Accio MVR/PSP). T1.12.1 FK validated. This map separates **personal wallet UI (T1.13)** from **company-wallet/payment + `@account-kit` (T1.12d, deferred)** and documents what still depends on the `walletAddress` store field.

**Method:** `rg` across `src/` — no code changes.

---

## Counts summary

| Bucket | Files / hits | Notes |
|--------|--------------|-------|
| **§1 Personal wallet UI — orphan (safe T1.13 delete)** | **7 files** | Zero importers; already disconnected from live UI |
| **§1 Personal wallet UI — mount points (T1.13 polish, not delete)** | **3 files** | Still gate on `walletAddress`; need session-based gating |
| **§2 Named balance/transfer components** | **2 live** (`WalletInfo`, `TransactionHistory`) | **4 checklist names already gone** from disk (`STORMBalance`, `USDCBalance`, `SendUSDC`, `SendSTORM`) |
| **§2 Entangled consumers** | **1 file** (`CompanyWallet.tsx`) | Sole importer of both live shared components |
| **§3 T1.12d — `@account-kit` / `alchemy-sdk` direct imports** | **10 files** | Provider + payment + resume on-chain verify |
| **§3 T1.12d — company-wallet server chain** | **6 lib files + 4 API routes + 2 employer UI surfaces** | Pace employer rail + screening payment |
| **§4 `walletAddress` store consumers** | **~120 files** (grep hits) | **Cannot drop field in T1.13** |
| **§4 Client `x-wallet-address` senders (non-admin)** | **18 files** | Allowlisted legacy routes still read header |
| **§5 `/api/wallet/*`** | **2 routes — both KEEP** | Misnamed; Accio/payment **config**, not balance APIs |

---

## 1. Personal wallet UI (T1.13 — safe to delete after this map)

### 1a. Orphan components (zero importers — delete in T1.13)

| File | Line | What it does | Bucket |
|------|------|--------------|--------|
| `src/components/WalletCard.tsx` | 1–307 | Personal wallet card: address copy/show, Base Sepolia label, role switch, **Buy USDC**, dev-only admin link | **PERSONAL — orphan** |
| `src/components/BuyUSDCButton.tsx` | 1–150 | Opens Coinbase Onramp via `POST /api/onramp/session` | **PERSONAL — orphan** (only imported by `WalletCard.tsx:8`) |
| `src/components/BaseWalletConnect.tsx` | 1–143 | Legacy Base wallet connect widget | **PERSONAL — orphan** |
| `src/components/StormEarningsHistory.tsx` | 1–323 | Fetches `/api/storm/history` with `x-wallet-address` header; STORM reward history UI | **PERSONAL — orphan** |
| `src/components/wallet/ReceiveUSDC.tsx` | 1–~80 | Receive-USDC QR / address display | **PERSONAL — orphan** |
| `src/components/AlchemyAuth.tsx` | 1–~400 | Legacy Alchemy sign-in widget + `useAlchemyAuth` hook | **PERSONAL — orphan** (removed from shells at T1.12c) |
| `src/app/api/onramp/session/route.ts` | 1–~150 | Coinbase Onramp session token API | **PERSONAL — orphan** (only caller: `BuyUSDCButton.tsx:48`) |

**Checklist names already removed from disk (no action in T1.13):**

| File | Status |
|------|--------|
| `src/components/STORMBalance.tsx` | **Does not exist** — balance logic inlined in `WalletInfo.tsx` |
| `src/components/USDCBalance.tsx` | **Does not exist** |
| `src/components/wallet/SendUSDC.tsx` | **Does not exist** |
| `src/components/wallet/SendSTORM.tsx` | **Does not exist** |
| `src/components/WalletTransactions.tsx` | **Indexed but unreadable / no importers** — treat as already gone |

### 1b. `WalletInfo` — NOT personal-only

| File | Line | What it does | Bucket |
|------|------|--------------|--------|
| `src/components/WalletInfo.tsx` | 1–272 | Collapsible wallet tile: USDC (mainnet + Sepolia) + STORM balances via `alchemy-token-api` | **COMPANY rail only** — sole importer: `CompanyWallet.tsx:6,130` |

### 1c. Live mount points (personal wallet UI already removed; session gating remains)

| File | Line | What it does | T1.13 replacement |
|------|------|--------------|-------------------|
| `src/components/hub/HubAccountSection.tsx` | 13–65 | **Already refactored:** referral-only (`ReferralBanner`); comment notes personal wallet removed at T1.12 | **Keep** — no wallet UI left |
| `src/components/hub/CandidateHub.tsx` | 169 | `{walletAddress ? <HubAccountSection /> : null}` — hides referrals for users without `walletAddress` in store | Gate on **`sessionUserId`** (or `user`) instead of `walletAddress` |
| `src/components/hub/HubWorkspaceCareerCard.tsx` | 32, 56–58 | Reads `walletAddress` from store; returns `null` if missing | Already works via `auth:<uuid>` placeholder — **optional:** gate on `sessionUserId` for clarity |
| `src/components/simple/SimpleCardPanel.tsx` | 146–149 | `isGuest = !user \|\| !walletAddress` — stale-session guard | Gate on **`sessionUserId`**; remove "Connect a wallet" copy if any remains |

**Hub account section target state (T1.13 polish):** plain **Account** surface — email + sign-out + referrals. No address, no balances, no onramp. `HubAccountSection` is already 90% there; only the `walletAddress` gate in `CandidateHub` needs updating.

---

## 2. Shared balance/transfer components (entangled)

### Checklist components vs. repo reality

| Component | On disk? | Importers | Consumer tag |
|-----------|----------|-----------|--------------|
| `STORMBalance` | **No** | — | Already deleted |
| `USDCBalance` | **No** | — | Already deleted |
| `SendUSDC` | **No** | — | Already deleted |
| `SendSTORM` | **No** | — | Already deleted |
| `TransactionHistory` | **Yes** | `employer/CompanyWallet.tsx:7,141` | **(b) COMPANY/EMPLOYER — T1.12d** |
| `WalletInfo` | **Yes** | `employer/CompanyWallet.tsx:6,130` | **(b) COMPANY/EMPLOYER — T1.12d** |

### Per-component consumer table

| Shared component | Importer file | Line | Tag | Delete with |
|------------------|---------------|------|-----|-------------|
| `TransactionHistory` | `src/components/employer/CompanyWallet.tsx` | 7, 141–146 | **(b) COMPANY/EMPLOYER rail** | **T1.12d** (not T1.13) |
| `WalletInfo` | `src/components/employer/CompanyWallet.tsx` | 6, 130 | **(b) COMPANY/EMPLOYER rail** | **T1.12d** (not T1.13) |

**Conclusion:** None of the live shared balance/history components can be deleted in T1.13. The employer **Company wallet** rail is their only consumer. Balance fetching is inlined inside `WalletInfo` via `lib/alchemy-token-api.ts` (not separate `STORMBalance`/`USDCBalance` components).

---

## 3. Company-wallet / payment (T1.12d — DO NOT delete in T1.13)

### 3a. Provider mount — re-parent before removal

| File | Line | What it does | Bucket |
|------|------|--------------|--------|
| `src/app/layout.tsx` | 4, 152–157 | Mounts `<AlchemyProvider>` wrapping `<SupabaseAuthSync />` + `{children}` | **T1.12d** |
| `src/components/SupabaseAuthSync.tsx` | 1–24 | Global Supabase → Zustand bridge | **Keep — must move OUTSIDE `AlchemyProvider` before provider removal** |
| `src/components/AlchemyProvider.tsx` | 10, 18–50 | Client-only `@account-kit/react` `AlchemyAccountProvider` + React Query | **T1.12d** |

> **Hard boundary:** `SupabaseAuthSync` is nested **inside** `AlchemyProvider`. Removing the provider without re-parenting `SupabaseAuthSync` to `ThemeProvider` (sibling of where provider was) will break session hydration on `/admin`, onboard, etc.

### 3b. `@account-kit` / `alchemy-sdk` direct imports

| File | Line | What it does | Bucket |
|------|------|--------------|--------|
| `src/lib/alchemy-account-config.ts` | 15–16 | `createConfig` + UI config for Account Kit | **T1.12d** |
| `src/components/AlchemyProvider.tsx` | 10–12 | `AlchemyAccountProvider`, `getAlchemyAccountConfig` | **T1.12d** |
| `src/components/AlchemyAuth.tsx` | 17–21 | `useSignerStatus`, `useUser`, `useAccount`, `useLogout` | **T1.12d orphan** — safe to delete in T1.13, but `@account-kit` stays mounted for payment |
| `src/components/MvrPaymentButton.tsx` | 12–16, 62–66, 148–162 | Smart-wallet USDC payment for MVR; fetches `/api/wallet/mvr-config` | **T1.12d** |
| `src/components/PspPaymentButton.tsx` | 12–16, 62–66, 148–162 | Same for PSP; fetches `/api/wallet/psp-config` | **T1.12d** |
| `src/components/StormiCreditModal.tsx` | 10, 39–41, 51 | USDC credit-pack payment; fetches `/api/wallet/mvr-config` | **T1.12d** |
| `src/components/ResumeUploadWithVerification.tsx` | 5, 60, 67 | On-chain resume hash via `useAccount` + `useSmartAccountClient` | **T1.12d** (legacy on-chain verify path) |
| `src/lib/company-wallet-server.ts` | 8–9 | `createMultiOwnerLightAccountAlchemyClient`, `alchemy`, `baseSepolia` | **T1.12d — Pace team wallet provisioning** |
| `src/lib/alchemy-token-api.ts` | 6 | `alchemy-sdk` — USDC/STORM balance reads | **T1.12d** (used by `WalletInfo`) |
| `src/lib/alchemy-transfers-api.ts` | — | Transfer history for `TransactionHistory` | **T1.12d** |
| `src/lib/alchemy-simulation-api.ts` | 13 | `alchemy-sdk` simulation helpers | **Orphan lib — no importers**; delete with T1.12d cleanup |
| `src/lib/erc20-gas-payment.ts` | — | ERC-20 gas payment helpers | **Orphan lib — no importers**; delete with T1.12d cleanup |

### 3c. Company-wallet server + provisioning

| File | Line | What it does | Bucket |
|------|------|--------------|--------|
| `src/lib/company-wallet-server.ts` | 71–110 | `createCompanySharedWallet`, `addOwnerToCompanyWallet`, `removeOwnerFromCompanyWallet` | **T1.12d** |
| `src/lib/persist-company-wallet.ts` | 7–67 | `persistCompanyWalletIfMissing` — DB + on-chain create | **T1.12d** |
| `src/lib/company-wallet-public.ts` | 5 | `getCompanyWalletServiceOwnerAddress` for client payment init | **T1.12d** |
| `src/lib/company-wallet-salt.ts` | — | Deterministic salt for company smart accounts | **T1.12d** |
| `src/app/api/employer/company/route.ts` | 490 | Calls `persistCompanyWalletIfMissing` on company create | **T1.12d — Pace-critical** |
| `src/app/api/employer/company/ensure-wallet/route.ts` | 94 | Ensures company wallet exists | **T1.12d — Pace-critical** |
| `src/app/api/employer/team/[memberId]/route.ts` | 5–7, 187–373 | `addOwnerToCompanyWallet` / `removeOwnerFromCompanyWallet` on team changes | **T1.12d — Pace-critical** |
| `src/app/api/employer/team/accept-invite/route.ts` | 4, 171 | Adds invitee as company wallet co-owner | **T1.12d — Pace-critical** |

### 3d. Employer UI surfaces

| File | Line | What it does | Bucket |
|------|------|--------------|--------|
| `src/components/employer/CompanyWallet.tsx` | 25–152 | Company wallet rail/modal body (`WalletInfo` + `TransactionHistory`) | **T1.12d** |
| `src/components/EmployerHub.tsx` | 51, 292–293, 461–482, 794, 1305–1328 | Mounts `CompanyWalletContent`; provisioning state; mobile modal | **T1.12d** |
| `src/components/employer/CareerCardModal.tsx` | 25–26, 1095–1108 | `MvrPaymentButton` / `PspPaymentButton` with `payFromCompanyWallet` | **T1.12d** |
| `src/components/MvrOrderForm.tsx` | 7, 559 | `MvrPaymentButton` in driver MVR order flow | **T1.12d** |
| `src/components/PspOrderForm.tsx` | 7, 746 | `PspPaymentButton` | **T1.12d** |
| `src/components/stormi/StormiChatPanel.tsx` | 39, 1215 | Renders `StormiCreditModal` | **T1.12d** |
| `src/components/ApplyWithStormChainModal.tsx` | 21, 458 | Dynamic `StormiCreditModal` | **T1.12d** |
| `src/components/apply/StormApplyBridge.tsx` | 38, 480 | Dynamic `StormiCreditModal` | **T1.12d** |

---

## 4. `walletAddress` store field — what blocks dropping it

**Bridge:** `src/hooks/use-supabase-auth-sync.ts` still writes `user.address` / implied `walletAddress` as either the DB `users.wallet_address` or `auth:<uuid>` placeholder (`authOnlyWalletPlaceholder`). Comment at lines 11–17 documents this as the deliberate dual-mode bridge until the client goes fully session-based.

**Conclusion: `walletAddress` MUST NOT be dropped in T1.13.** It must stay until (1) allowlisted API routes stop reading `x-wallet-address`, and (2) client fetch keys (`hub-blocks-store`, `use-projected-career-card`, etc.) migrate to session cookie / `sessionUserId`. Expected follow-on step: **T1.13b** or post-Stripe **T1.12d+** session-key migration — not the orphan UI delete pass.

### 4a. Still-live client `x-wallet-address` senders (read `walletAddress` from store)

These files **set the header from store `walletAddress`** (or prop derived from it). Server routes behind them still read the header per T1.12b allowlist.

| File | Line | Target API / purpose | Allowlist category |
|------|------|----------------------|-------------------|
| `src/components/ProfileSetupModal.tsx` | 86 | `/api/user/profile-setup` | Create-on-write |
| `src/hooks/use-dot-application-sync.ts` | 62, 123 | `/api/driver-applications/save-progress` | Create-on-write |
| `src/components/app/DotApplicationFlow.tsx` | 132, 371, 561, 616 | DOT save/submit routes | Create-on-write |
| `src/components/ResumeUploadWithVerification.tsx` | 123, 295 | `/api/resumes/upload`, verification | Create-on-write + `@account-kit` |
| `src/components/ResumeBuilder.tsx` | 532 | `/api/resumes/create` | Create-on-write |
| `src/components/ResumeDashboard.tsx` | 122 | GET `/api/resumes` | Create-on-write |
| `src/components/app/DriverShell.tsx` | 197 | Driver hub fetch | Legacy (hub uses session on server) |
| `src/components/stormi/StormiChatPanel.tsx` | 562, 622 | `/api/ai/chat`, `/api/ai/job-talking-points` | STORMI-unlimited |
| `src/lib/ava-chat.ts` | 217–218 | `/api/ai/chat` (via hook) | STORMI-unlimited |
| `src/lib/walkthrough-ai.ts` | 71 | `/api/ai/chat` | STORMI-unlimited |
| `src/components/StormEarningsHistory.tsx` | 48 | `/api/storm/history` | Legacy wallet-keyed (**orphan UI — delete with T1.13**) |
| `src/components/ApplyWithStormChainModal.tsx` | 137 | Apply bridge API | Legacy header send |
| `src/components/apply/StormApplyBridge.tsx` | 187 | Apply bridge API | Legacy header send |
| `src/components/DriverHub.tsx` | 520 | Driver hub API | Legacy header send |
| `src/components/admin/AdminDashboardShell.tsx` | 93, 96, 120, 153 | All admin tab fetches | Admin compat header (auth is email/session) |
| `src/components/admin/tabs/*.tsx` | various | Admin list/detail routes | Admin compat header |
| `src/components/admin/modals/CreateCompanyModal.tsx` | 53 | Admin company create | Admin compat header |

### 4b. Fetch keys / identity gating (no header, but still require `walletAddress`)

| File | Line | What it does | Bucket |
|------|------|--------------|--------|
| `src/stores/hub-blocks-store.ts` | 80–350 | All hub mutations keyed by `walletAddress` param | **Fetch key — blocks field drop** |
| `src/stores/career-card-lenses-store.ts` | 26–152 | Lens CRUD keyed by `walletAddress` | **Fetch key — blocks field drop** |
| `src/hooks/use-projected-career-card.ts` | 11–47 | `/api/career-card` fetch gated on `walletAddress` | **Fetch key — blocks field drop** |
| `src/lib/sync-driver-hub-store.ts` | 7 | `syncDriverHubFromApi(walletAddress)` | **Fetch key — blocks field drop** |
| `src/hooks/use-hub-documents.tsx` | 49–548 | Hub documents + verify actions | **Fetch key — blocks field drop** |
| `src/components/hub/CandidateHub.tsx` | 64, 160, 169, 191 | Hub sections, Stormi, account gate | **Gating + props** |
| `src/components/simple/SimpleCardPanel.tsx` | 146–584 | Guest guard + career card + Stormi | **Gating + props** |
| `src/stores/notification-store.ts` | — | Notification fetch keyed by wallet | **Fetch key** |
| `src/components/hub/ReferralBanner.tsx` | 22 | Referral link uses wallet-derived id | **Feature key** |
| `src/app/onboard/[token]/page.tsx` | 107–182 | Setup POST bodies include `walletAddress` | **Onboard compat** (uses `auth:<uuid>`) |
| `src/components/Navigation.tsx` | 213–653 | NotificationBell, MvrStatusBadge props | **Display + feature props** |
| `src/components/ui/UserIdentity.tsx` | 11–16, 37–39 | Optional `showWallet` — truncates address | **Cosmetic display** |
| `src/components/admin/tabs/MvrTab.tsx` | 110, 212–213 | Displays wallet in admin tables | **Cosmetic display (admin)** |

### 4c. Cosmetic / display-only (safe to stop showing wallet, but field still needed elsewhere)

Admin tab wallet columns (`MvrTab`, `DotAppsTab`, `ResumesTab`, `ProfilesTab`, `CandidatesTab`), `UserIdentity` `showWallet`, employer-facing wallet columns in API responses — these can switch to **email / user id** in a UI polish pass without deleting the store field.

---

## 5. `/api/wallet/*` — KEEP vs DELETE

| File | Line | What it does | Verdict |
|------|------|--------------|---------|
| `src/app/api/wallet/mvr-config/route.ts` | 1–52 | Returns USDC treasury address, decimals, `MVR_PRICE_USDC` for **frontend payment encoding** | **KEEP — Pace-critical screening config** (misnamed path). Callers: `MvrPaymentButton.tsx:78,174`, `StormiCreditModal.tsx:51` |
| `src/app/api/wallet/psp-config/route.ts` | 1–42 | Same shape for PSP price env | **KEEP — Pace-critical screening config**. Callers: `PspPaymentButton.tsx:78,174` |

**Related (not under `/api/wallet/`):**

| File | Verdict |
|------|---------|
| `src/app/api/onramp/session/route.ts` | **DELETE with T1.13** — Coinbase onramp for personal wallet only; orphan after `BuyUSDCButton` removal |

> **Do not** interpret EXECUTION_CHECKLIST "Delete `src/app/api/wallet/*`" literally — both existing routes are **payment configuration for Accio screening**, not wallet-balance APIs. Rename to `/api/screening/mvr-config` etc. is optional polish for T1.12d / Stripe migration.

---

## Recommended T1.13 cut list

### Safe to delete now (personal-only, no company-rail or live header dependency)

| File | Reason safe |
|------|-------------|
| `src/components/WalletCard.tsx` | Zero importers |
| `src/components/BuyUSDCButton.tsx` | Only used by `WalletCard` |
| `src/components/BaseWalletConnect.tsx` | Zero importers |
| `src/components/StormEarningsHistory.tsx` | Zero importers; `/api/storm/history` route stays for now |
| `src/components/wallet/ReceiveUSDC.tsx` | Zero importers |
| `src/components/AlchemyAuth.tsx` | Zero importers; shells use Supabase sign-in |
| `src/app/api/onramp/session/route.ts` | Only used by `BuyUSDCButton` |
| `src/lib/alchemy-simulation-api.ts` | Zero importers (optional same PR) |
| `src/lib/erc20-gas-payment.ts` | Zero importers (optional same PR) |

### Mount-point replacements (same T1.13 PR — no file delete)

| Location | Change |
|----------|--------|
| `CandidateHub.tsx:169` | `{sessionUserId ? <HubAccountSection /> : null}` (or `user`) instead of `walletAddress` |
| `SimpleCardPanel.tsx:149` | `isGuest = !user \|\| !sessionUserId` — drop wallet wording in empty states |
| `HubAccountSection` | Optionally add email + sign-out row (account info without wallet chrome) |

### Explicit DEFERRED to T1.12d (with reason)

| Item | Reason |
|------|--------|
| `AlchemyProvider` + `@account-kit/*` + `alchemy-sdk` packages | Payment buttons + company wallet + resume on-chain verify still mounted |
| `MvrPaymentButton`, `PspPaymentButton`, `StormiCreditModal` | USDC smart-wallet payment path until Stripe replaces it |
| `employer/CompanyWallet.tsx`, `WalletInfo`, `TransactionHistory` | Employer company-wallet rail — only consumer of balance/history UI |
| `company-wallet-server.ts`, `persist-company-wallet.ts`, team wallet API routes | Pace team co-owner provisioning on-chain |
| `ResumeUploadWithVerification.tsx` `@account-kit` hooks | On-chain resume registry path (Phase 1 legacy) |
| `/api/wallet/mvr-config`, `/api/wallet/psp-config` | Accio screening payment config — **KEEP** |
| `useAuthStore.walletAddress` field | ~120 consumers + allowlisted `x-wallet-address` senders; bridge via `useSupabaseAuthSync` |
| `lib/alchemy-token-api.ts`, `lib/alchemy-transfers-api.ts`, `lib/alchemy-account-config.ts` | Used by company wallet + payment stack |

### T1.12d pre-flight (before `@account-kit` removal)

1. Re-parent `SupabaseAuthSync` out of `AlchemyProvider` in `layout.tsx`.
2. Boss decision: Stripe-only → kill company wallets? (see EXECUTION_CHECKLIST T1.12d gate.)
3. Replace or inert payment buttons in employer screening flows without breaking Pace MVR/PSP order path until Stripe ships.

---

## Verification commands (post-T1.13 orphan delete)

```bash
# Personal wallet components gone
rg "WalletCard|BuyUSDCButton|BaseWalletConnect|StormEarningsHistory|ReceiveUSDC|AlchemyAuth" src/

# Company rail still intact
rg "CompanyWallet|WalletInfo|TransactionHistory" src/components/employer/

# @account-kit still present until T1.12d (expected non-zero)
rg "AlchemyProvider|@account-kit" src/

# Screening config untouched
rg "/api/wallet/(mvr|psp)-config" src/

npm run build && npm run lint
```
