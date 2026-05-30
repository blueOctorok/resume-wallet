# T1.12-pre — Alchemy → Supabase Auth Blast Radius

> **Read-only inventory** for the T1.12 cutover (`docs/midnight/EXECUTION_CHECKLIST.md`).  
> Generated: 2026-05-30 · Scope: `src/` only · No code was modified.

---

## Counts summary

| Category | Files | Hits |
|----------|------:|-----:|
| 1. Alchemy Provider / SDK | 23 | 40 |
| 2. Alchemy React hooks (surgery surface) | 11 | 78 |
| 3a. Client `x-wallet-address` senders | 92 | 238 |
| 3b. API routes that READ header | 26 | 30 |
| 3c. Lib / middleware / tests / comments | 11 | 21 |
| 4a. `walletAddress` IDENTITY reads | 87 | 374 |
| 4b. `walletAddress` COSMETIC only | 11 | 16 |
| 4c. `walletAddress` other (props/types/pass-through) | 121 | 649 |
| **Total `x-wallet-address` (3a+3b+3c)** | **126** | **289** |

---

## 1. Alchemy Provider / SDK

Imports from `@account-kit/*`, `alchemy-sdk`, provider mount in `layout.tsx`, and Alchemy config/token helpers.

| File | Line | Description |
|------|------|-------------|
| `src/app/invite/[token]/page.tsx` | 7 | Import: import { useAccount, useUser } from '@account-kit/react' |
| `src/app/invite/[token]/page.tsx` | 47 | Comment/doc reference |
| `src/app/invite/[token]/page.tsx` | 198 | Comment/doc reference |
| `src/app/layout.tsx` | 4 | Import: import AlchemyProvider from '@/components/AlchemyProvider' |
| `src/app/layout.tsx` | 151 | Alchemy provider mount/wrap |
| `src/app/layout.tsx` | 155 | Alchemy provider mount/wrap |
| `src/app/onboard/[token]/page.tsx` | 5 | Import: import { useSignerStatus, useUser, useAccount, AuthCard } from '@account-kit/rea |
| `src/app/page.tsx` | 19 | } from '@account-kit/react' |
| `src/components/AlchemyAuth.tsx` | 22 | } from '@account-kit/react' |
| `src/components/AlchemyProvider.tsx` | 10 | Import: import { AlchemyAccountProvider } from '@account-kit/react' |
| `src/components/AlchemyProvider.tsx` | 12 | Import: import { getAlchemyAccountConfig } from '@/lib/alchemy-account-config' |
| `src/components/AlchemyProvider.tsx` | 14 | Alchemy provider mount/wrap |
| `src/components/AlchemyProvider.tsx` | 18 | Alchemy provider mount/wrap |
| `src/components/AlchemyProvider.tsx` | 51 | <AlchemyAccountProvider config={config} queryClient={queryClient}> |
| `src/components/AlchemyProvider.tsx` | 53 | </AlchemyAccountProvider> |
| `src/components/MvrPaymentButton.tsx` | 16 | } from '@account-kit/react' |
| `src/components/PspPaymentButton.tsx` | 16 | } from '@account-kit/react' |
| `src/components/ResumeUploadWithVerification.tsx` | 5 | Import: import { useAccount, useSmartAccountClient } from '@account-kit/react' |
| `src/components/STORMBalance.tsx` | 9 | } from '@/lib/alchemy-token-api' |
| `src/components/StormiCreditModal.tsx` | 10 | Import: import { useSignerStatus, useSmartAccountClient, useSendCalls } from '@account-k |
| `src/components/TransactionHistory.tsx` | 14 | } from '@/lib/alchemy-transfers-api' |
| `src/components/USDCBalance.tsx` | 9 | } from '@/lib/alchemy-token-api' |
| `src/components/WalletInfo.tsx` | 10 | } from '@/lib/alchemy-token-api' |
| `src/components/admin/AdminDashboardShell.tsx` | 6 | Import: import { useAccount } from '@account-kit/react' |
| `src/components/wallet/SendSTORM.tsx` | 9 | } from '@account-kit/react' |
| `src/components/wallet/SendSTORM.tsx` | 15 | } from '@/lib/alchemy-token-api' |
| `src/components/wallet/SendSTORM.tsx` | 16 | Import: import { policyId } from '@/lib/alchemy-account-config' |
| `src/components/wallet/SendUSDC.tsx` | 9 | } from '@account-kit/react' |
| `src/components/wallet/SendUSDC.tsx` | 12 | Import: import { getUSDCBalanceSepolia } from '@/lib/alchemy-token-api' |
| `src/components/wallet/SendUSDC.tsx` | 13 | Import: import { policyId } from '@/lib/alchemy-account-config' |
| `src/hooks/use-storm-token-balance.ts` | 4 | Import: import { getSTORMBalanceSepolia, getSTORMBalanceMainnet } from '@/lib/alchemy-to |
| `src/lib/alchemy-account-config.ts` | 15 | Import: import { AlchemyAccountsUIConfig, createConfig } from '@account-kit/react' |
| `src/lib/alchemy-account-config.ts` | 16 | Import: import { alchemy, baseSepolia } from '@account-kit/infra' |
| `src/lib/alchemy-simulation-api.ts` | 13 | Import: import { Alchemy, Network } from 'alchemy-sdk' |
| `src/lib/alchemy-token-api.ts` | 6 | Import: import { Alchemy, Network } from 'alchemy-sdk' |
| `src/lib/alchemy-transfers-api.ts` | 6 | Import: import { alchemySDK } from '@/lib/alchemy-token-api' |
| `src/lib/alchemy-transfers-api.ts` | 9 | export { BASE_SEPOLIA_USDC_ADDRESS } from '@/lib/alchemy-token-api' |
| `src/lib/company-wallet-server.ts` | 8 | Import: import { createMultiOwnerLightAccountAlchemyClient } from '@account-kit/smart-co |
| `src/lib/company-wallet-server.ts` | 9 | Import: import { alchemy, baseSepolia } from '@account-kit/infra' |
| `src/lib/company-wallet-server.ts` | 54 | return createMultiOwnerLightAccountAlchemyClient({ |


---

## 2. Alchemy React hooks in components (surgery surface)

Grouped by file — hooks used per file:

| File | Hooks used |
|------|------------|
| `src/app/invite/[token]/page.tsx` | `useAccount`, `useUser` |
| `src/app/onboard/[token]/page.tsx` | `useAccount`, `useSignerStatus`, `useUser` |
| `src/app/page.tsx` | `useAccount`, `useLogout`, `useSendUserOperation`, `useSignerStatus`, `useSmartAccountClient`, `useUser` |
| `src/components/AlchemyAuth.tsx` | `useAccount`, `useLogout`, `useSignerStatus`, `useUser` |
| `src/components/MvrPaymentButton.tsx` | `useAccount`, `useSendCalls`, `useSignerStatus`, `useSmartAccountClient` |
| `src/components/PspPaymentButton.tsx` | `useAccount`, `useSendCalls`, `useSignerStatus`, `useSmartAccountClient` |
| `src/components/ResumeUploadWithVerification.tsx` | `useAccount`, `useSmartAccountClient` |
| `src/components/StormiCreditModal.tsx` | `useSendCalls`, `useSignerStatus`, `useSmartAccountClient` |
| `src/components/admin/AdminDashboardShell.tsx` | `useAccount` |
| `src/components/wallet/SendSTORM.tsx` | `useSendCalls`, `useSignerStatus`, `useSmartAccountClient` |
| `src/components/wallet/SendUSDC.tsx` | `useSendCalls`, `useSignerStatus`, `useSmartAccountClient` |

### Line-level hook hits (78 total)

| File | Line | Description |
|------|------|-------------|
| `src/app/invite/[token]/page.tsx` | 7 | Import: import { useAccount, useUser } from '@account-kit/react' |
| `src/app/invite/[token]/page.tsx` | 51 | Hook: useAccount |
| `src/app/invite/[token]/page.tsx` | 52 | Hook: useUser |
| `src/app/onboard/[token]/page.tsx` | 5 | Import: import { useSignerStatus, useUser, useAccount, AuthCard } from '@account-kit/rea |
| `src/app/onboard/[token]/page.tsx` | 47 | Hook: useSignerStatus |
| `src/app/onboard/[token]/page.tsx` | 48 | Hook: useUser |
| `src/app/onboard/[token]/page.tsx` | 49 | Hook: useAccount |
| `src/app/page.tsx` | 13 | Hook: useSendUserOperation |
| `src/app/page.tsx` | 14 | Hook: useSmartAccountClient |
| `src/app/page.tsx` | 15 | Hook: useUser |
| `src/app/page.tsx` | 16 | Hook: useAccount |
| `src/app/page.tsx` | 17 | Hook: useSignerStatus |
| `src/app/page.tsx` | 18 | Hook: useLogout |
| `src/app/page.tsx` | 62 | Hook: useSmartAccountClient |
| `src/app/page.tsx` | 65 | Hook: useSendUserOperation |
| `src/app/page.tsx` | 66 | Hook: useSignerStatus |
| `src/app/page.tsx` | 67 | Hook: useUser |
| `src/app/page.tsx` | 68 | Hook: useAccount |
| `src/app/page.tsx` | 69 | Hook: useLogout |
| `src/app/page.tsx` | 167 | Comment/doc reference |
| `src/app/page.tsx` | 168 | Comment/doc reference |
| `src/components/AlchemyAuth.tsx` | 17 | Hook: useSignerStatus |
| `src/components/AlchemyAuth.tsx` | 18 | Hook: useUser |
| `src/components/AlchemyAuth.tsx` | 20 | Hook: useAccount |
| `src/components/AlchemyAuth.tsx` | 21 | Hook: useLogout |
| `src/components/AlchemyAuth.tsx` | 58 | Hook: useSignerStatus |
| `src/components/AlchemyAuth.tsx` | 59 | Hook: useUser |
| `src/components/AlchemyAuth.tsx` | 60 | Hook: useAccount |
| `src/components/AlchemyAuth.tsx` | 61 | Hook: useLogout |
| `src/components/AlchemyAuth.tsx` | 280 | Comment/doc reference |
| `src/components/AlchemyAuth.tsx` | 397 | Hook: useSignerStatus |
| `src/components/AlchemyAuth.tsx` | 398 | Hook: useUser |
| `src/components/AlchemyAuth.tsx` | 399 | Hook: useAccount |
| `src/components/MvrPaymentButton.tsx` | 12 | Hook: useSignerStatus |
| `src/components/MvrPaymentButton.tsx` | 13 | Hook: useSmartAccountClient |
| `src/components/MvrPaymentButton.tsx` | 14 | Hook: useSendCalls |
| `src/components/MvrPaymentButton.tsx` | 15 | Hook: useAccount |
| `src/components/MvrPaymentButton.tsx` | 62 | Hook: useSignerStatus |
| `src/components/MvrPaymentButton.tsx` | 63 | Hook: useSmartAccountClient |
| `src/components/MvrPaymentButton.tsx` | 64 | Hook: useSendCalls |
| `src/components/MvrPaymentButton.tsx` | 66 | Hook: useAccount |
| `src/components/MvrPaymentButton.tsx` | 148 | Hook: useSignerStatus |
| `src/components/MvrPaymentButton.tsx` | 149 | Hook: useSmartAccountClient |
| `src/components/MvrPaymentButton.tsx` | 160 | Hook: useSendCalls |
| `src/components/MvrPaymentButton.tsx` | 162 | Hook: useAccount |
| `src/components/PspPaymentButton.tsx` | 12 | Hook: useSignerStatus |
| `src/components/PspPaymentButton.tsx` | 13 | Hook: useSmartAccountClient |
| `src/components/PspPaymentButton.tsx` | 14 | Hook: useSendCalls |
| `src/components/PspPaymentButton.tsx` | 15 | Hook: useAccount |
| `src/components/PspPaymentButton.tsx` | 62 | Hook: useSignerStatus |
| `src/components/PspPaymentButton.tsx` | 63 | Hook: useSmartAccountClient |
| `src/components/PspPaymentButton.tsx` | 64 | Hook: useSendCalls |
| `src/components/PspPaymentButton.tsx` | 66 | Hook: useAccount |
| `src/components/PspPaymentButton.tsx` | 148 | Hook: useSignerStatus |
| `src/components/PspPaymentButton.tsx` | 149 | Hook: useSmartAccountClient |
| `src/components/PspPaymentButton.tsx` | 160 | Hook: useSendCalls |
| `src/components/PspPaymentButton.tsx` | 162 | Hook: useAccount |
| `src/components/ResumeUploadWithVerification.tsx` | 5 | Import: import { useAccount, useSmartAccountClient } from '@account-kit/react' |
| `src/components/ResumeUploadWithVerification.tsx` | 60 | Hook: useAccount |
| `src/components/ResumeUploadWithVerification.tsx` | 67 | Hook: useSmartAccountClient |
| `src/components/StormiCreditModal.tsx` | 10 | Import: import { useSignerStatus, useSmartAccountClient, useSendCalls } from '@account-k |
| `src/components/StormiCreditModal.tsx` | 39 | Hook: useSignerStatus |
| `src/components/StormiCreditModal.tsx` | 40 | Hook: useSmartAccountClient |
| `src/components/StormiCreditModal.tsx` | 41 | Hook: useSendCalls |
| `src/components/admin/AdminDashboardShell.tsx` | 6 | Import: import { useAccount } from '@account-kit/react' |
| `src/components/admin/AdminDashboardShell.tsx` | 53 | Hook: useAccount |
| `src/components/wallet/SendSTORM.tsx` | 6 | Hook: useSignerStatus |
| `src/components/wallet/SendSTORM.tsx` | 7 | Hook: useSmartAccountClient |
| `src/components/wallet/SendSTORM.tsx` | 8 | Hook: useSendCalls |
| `src/components/wallet/SendSTORM.tsx` | 26 | Hook: useSignerStatus |
| `src/components/wallet/SendSTORM.tsx` | 27 | Hook: useSmartAccountClient |
| `src/components/wallet/SendSTORM.tsx` | 28 | Hook: useSendCalls |
| `src/components/wallet/SendUSDC.tsx` | 6 | Hook: useSignerStatus |
| `src/components/wallet/SendUSDC.tsx` | 7 | Hook: useSmartAccountClient |
| `src/components/wallet/SendUSDC.tsx` | 8 | Hook: useSendCalls |
| `src/components/wallet/SendUSDC.tsx` | 22 | Hook: useSignerStatus |
| `src/components/wallet/SendUSDC.tsx` | 23 | Hook: useSmartAccountClient |
| `src/components/wallet/SendUSDC.tsx` | 24 | Hook: useSendCalls |


---

## 3. Client `x-wallet-address` senders

### 3a. Client components / hooks / stores that SEND the header (238 hits, 92 files)

| File | Line | Description |
|------|------|-------------|
| `src/app/onboard/[token]/page.tsx` | 114 | Sends x-wallet-address in fetch headers (client) |
| `src/app/onboard/[token]/page.tsx` | 121 | Sends x-wallet-address in fetch headers (client) |
| `src/components/ApplyWithStormChainModal.tsx` | 111 | Sends x-wallet-address in fetch headers (client) |
| `src/components/ApplyWithStormChainModal.tsx` | 140 | References x-wallet-address header name |
| `src/components/BackgroundCheckDisclosure.tsx` | 226 | Sends x-wallet-address in fetch headers (client) |
| `src/components/BackgroundCheckDisclosure.tsx` | 256 | Sends x-wallet-address in fetch headers (client) |
| `src/components/BackgroundCheckDisclosure.tsx` | 314 | References x-wallet-address header name |
| `src/components/BackgroundCheckDisclosure.tsx` | 339 | References x-wallet-address header name |
| `src/components/CandidateRequestsSection.tsx` | 219 | Sends x-wallet-address in fetch headers (client) |
| `src/components/CandidateRequestsSection.tsx` | 250 | References x-wallet-address header name |
| `src/components/CareerCard.tsx` | 252 | Sends x-wallet-address in fetch headers (client) |
| `src/components/DeveloperHub.tsx` | 145 | Sends x-wallet-address in fetch headers (client) |
| `src/components/DeveloperHub.tsx` | 165 | Sends x-wallet-address in fetch headers (client) |
| `src/components/DeveloperHub.tsx` | 213 | Sends x-wallet-address in fetch headers (client) |
| `src/components/DeveloperHub.tsx` | 241 | Sends x-wallet-address in fetch headers (client) |
| `src/components/DeveloperResumeBuilder.tsx` | 281 | Sends x-wallet-address in fetch headers (client) |
| `src/components/DeveloperResumeBuilder.tsx` | 299 | Sends x-wallet-address in fetch headers (client) |
| `src/components/DeveloperResumeBuilder.tsx` | 314 | Sends x-wallet-address in fetch headers (client) |
| `src/components/DeveloperResumeBuilder.tsx` | 395 | References x-wallet-address header name |
| `src/components/DeveloperResumePreviewModal.tsx` | 70 | References x-wallet-address header name |
| `src/components/DeveloperResumePreviewModal.tsx` | 91 | Sends x-wallet-address in fetch headers (client) |
| `src/components/DriverHub.tsx` | 230 | References x-wallet-address header name |
| `src/components/DriverHub.tsx` | 267 | References x-wallet-address header name |
| `src/components/DriverHub.tsx` | 316 | References x-wallet-address header name |
| `src/components/DriverHub.tsx` | 388 | References x-wallet-address header name |
| `src/components/DriverHub.tsx` | 446 | References x-wallet-address header name |
| `src/components/DriverHub.tsx` | 491 | References x-wallet-address header name |
| `src/components/DriverHub.tsx` | 538 | Sends x-wallet-address in fetch headers (client) |
| `src/components/DriverHub.tsx` | 557 | Sends x-wallet-address in fetch headers (client) |
| `src/components/DriverHub.tsx` | 580 | Sends x-wallet-address in fetch headers (client) |
| `src/components/EmployerHub.tsx` | 468 | Sends x-wallet-address in fetch headers (client) |
| `src/components/EmployerHub.tsx` | 507 | References x-wallet-address header name |
| `src/components/EmployerHub.tsx` | 531 | Sends x-wallet-address in fetch headers (client) |
| `src/components/EmployerHub.tsx` | 624 | References x-wallet-address header name |
| `src/components/EmployerHub.tsx` | 657 | Sends x-wallet-address in fetch headers (client) |
| `src/components/GeneralResumeBuilder.tsx` | 209 | Sends x-wallet-address in fetch headers (client) |
| `src/components/GeneralResumeBuilder.tsx` | 231 | Sends x-wallet-address in fetch headers (client) |
| `src/components/GitHubContributionGraph.tsx` | 78 | Sends x-wallet-address in fetch headers (client) |
| `src/components/MyApplications.tsx` | 159 | References x-wallet-address header name |
| `src/components/Navigation.tsx` | 667 | References x-wallet-address header name |
| `src/components/ProfileConflictModal.tsx` | 51 | References x-wallet-address header name |
| `src/components/ProfileSetupModal.tsx` | 87 | References x-wallet-address header name |
| `src/components/PspDisclosureForm.tsx` | 221 | Sends x-wallet-address in fetch headers (client) |
| `src/components/PspDisclosureForm.tsx` | 265 | Sends x-wallet-address in fetch headers (client) |
| `src/components/PspDisclosureForm.tsx` | 364 | References x-wallet-address header name |
| `src/components/PspDisclosureForm.tsx` | 406 | References x-wallet-address header name |
| `src/components/PspOrderForm.tsx` | 83 | Sends x-wallet-address in fetch headers (client) |
| `src/components/ResumeBuilder.tsx` | 412 | Sends x-wallet-address in fetch headers (client) |
| `src/components/ResumeBuilder.tsx` | 451 | Sends x-wallet-address in fetch headers (client) |
| `src/components/ResumeBuilder.tsx` | 481 | Sends x-wallet-address in fetch headers (client) |
| `src/components/RoleSelectionModal.tsx` | 136 | Sends x-wallet-address in fetch headers (client) |
| `src/components/RoleSelectionModal.tsx` | 181 | References x-wallet-address header name |
| `src/components/ShareProfileCard.tsx` | 94 | Sends x-wallet-address in fetch headers (client) |
| `src/components/ShareProfileCard.tsx` | 110 | Sends x-wallet-address in fetch headers (client) |
| `src/components/ShareProfileCard.tsx` | 143 | Sends x-wallet-address in fetch headers (client) |
| `src/components/StormEarningsHistory.tsx` | 48 | References x-wallet-address header name |
| `src/components/StormiCreditModal.tsx` | 97 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/AdminDashboardShell.tsx` | 97 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/AdminDashboardShell.tsx` | 100 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/AdminDashboardShell.tsx` | 124 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/AdminDashboardShell.tsx` | 157 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/modals/CreateCompanyModal.tsx` | 53 | References x-wallet-address header name |
| `src/components/admin/tabs/AccessRequestsTab.tsx` | 42 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/AccessRequestsTab.tsx` | 243 | References x-wallet-address header name |
| `src/components/admin/tabs/AccessRequestsTab.tsx` | 275 | References x-wallet-address header name |
| `src/components/admin/tabs/AccessRequestsTab.tsx` | 307 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/ApplicationsTab.tsx` | 32 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/BgcheckRequestsTab.tsx` | 29 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/CandidatesTab.tsx` | 65 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/CandidatesTab.tsx` | 89 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/CompaniesTab.tsx` | 72 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/CompaniesTab.tsx` | 95 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/CompaniesTab.tsx` | 98 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/CompaniesTab.tsx` | 141 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/CompaniesTab.tsx` | 327 | References x-wallet-address header name |
| `src/components/admin/tabs/CompaniesTab.tsx` | 346 | References x-wallet-address header name |
| `src/components/admin/tabs/CompaniesTab.tsx` | 364 | References x-wallet-address header name |
| `src/components/admin/tabs/CompaniesTab.tsx` | 383 | References x-wallet-address header name |
| `src/components/admin/tabs/CompaniesTab.tsx` | 406 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/CompaniesTab.tsx` | 605 | References x-wallet-address header name |
| `src/components/admin/tabs/CompaniesTab.tsx` | 633 | References x-wallet-address header name |
| `src/components/admin/tabs/DevProfilesTab.tsx` | 29 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/DevProjectsTab.tsx` | 29 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/DotAppsTab.tsx` | 29 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/JobsTab.tsx` | 25 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/JobsTab.tsx` | 173 | References x-wallet-address header name |
| `src/components/admin/tabs/JobsTab.tsx` | 192 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/MvrTab.tsx` | 38 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/MvrTab.tsx` | 62 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/OutreachTab.tsx` | 30 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/ProfilesTab.tsx` | 29 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/PspTab.tsx` | 36 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/PspTab.tsx` | 60 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/ResumesTab.tsx` | 41 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/UsersTab.tsx` | 36 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/UsersTab.tsx` | 59 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/VerificationsTab.tsx` | 29 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/CareerCardView.tsx` | 48 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/CompanyOnboarding.tsx` | 98 | References x-wallet-address header name |
| `src/components/app/DotApplicationFlow.tsx` | 132 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/DotApplicationFlow.tsx` | 216 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/DotApplicationFlow.tsx` | 361 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/DotApplicationFlow.tsx` | 373 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/DotApplicationFlow.tsx` | 475 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/DotApplicationFlow.tsx` | 516 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/DotApplicationFlow.tsx` | 564 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/DotApplicationFlow.tsx` | 588 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/DotApplicationFlow.tsx` | 621 | References x-wallet-address header name |
| `src/components/app/DriverCareerCardSection.tsx` | 44 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/DriverShell.tsx` | 196 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/DriverShell.tsx` | 214 | References x-wallet-address header name |
| `src/components/app/DriverShell.tsx` | 268 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/ProfileSetup.tsx` | 114 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/ProfileSetup.tsx` | 172 | References x-wallet-address header name |
| `src/components/apply/StormApplyBridge.tsx` | 146 | Sends x-wallet-address in fetch headers (client) |
| `src/components/apply/StormApplyBridge.tsx` | 189 | Sends x-wallet-address in fetch headers (client) |
| `src/components/career-card/DotAppPreviewModal.tsx` | 52 | Sends x-wallet-address in fetch headers (client) |
| `src/components/career-card/DotAppPreviewModal.tsx` | 76 | Sends x-wallet-address in fetch headers (client) |
| `src/components/career-card/LensManageModal.tsx` | 141 | References x-wallet-address header name |
| `src/components/developer/GitHubPage.tsx` | 26 | Sends x-wallet-address in fetch headers (client) |
| `src/components/developer/GitHubPage.tsx` | 52 | Sends x-wallet-address in fetch headers (client) |
| `src/components/developer/PortfolioPage.tsx` | 184 | Sends x-wallet-address in fetch headers (client) |
| `src/components/developer/PortfolioPage.tsx` | 203 | Sends x-wallet-address in fetch headers (client) |
| `src/components/developer/PortfolioPage.tsx` | 229 | References x-wallet-address header name |
| `src/components/developer/PortfolioPage.tsx` | 345 | References x-wallet-address header name |
| `src/components/developer/PortfolioPage.tsx` | 369 | Sends x-wallet-address in fetch headers (client) |
| `src/components/developer/PortfolioPage.tsx` | 389 | References x-wallet-address header name |
| `src/components/employer/ApplicantKanban.tsx` | 131 | References x-wallet-address header name |
| `src/components/employer/ApplicantsPage.tsx` | 102 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/ApplicantsPage.tsx` | 128 | References x-wallet-address header name |
| `src/components/employer/ApplicantsPage.tsx` | 475 | References x-wallet-address header name |
| `src/components/employer/CandidateNotesPanel.tsx` | 74 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateNotesPanel.tsx` | 121 | References x-wallet-address header name |
| `src/components/employer/CandidateOutreach.tsx` | 426 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 443 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 478 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 558 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 588 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 612 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 635 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 668 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 713 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 751 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 793 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 982 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 2249 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 2282 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CareerCardModal.tsx` | 130 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CareerCardModal.tsx` | 198 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CareerCardModal.tsx` | 220 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CareerCardModal.tsx` | 225 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CareerCardModal.tsx` | 269 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CareerCardModal.tsx` | 283 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CareerCardModal.tsx` | 315 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CareerCardModal.tsx` | 342 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/EmployerPspMvrBundleAttestationStep.tsx` | 180 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/EmployerPspMvrBundleAttestationStep.tsx` | 201 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/EmployerPspMvrBundleAttestationStep.tsx` | 217 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/EmployerPspMvrBundleAttestationStep.tsx` | 243 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/EmployerPspMvrBundleAttestationStep.tsx` | 254 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/JobPostingForm.tsx` | 105 | References x-wallet-address header name |
| `src/components/employer/JobPostingsSection.tsx` | 402 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/JobPostingsSection.tsx` | 600 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/JobPostingsSection.tsx` | 617 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/TalentSearchPage.tsx` | 126 | References x-wallet-address header name |
| `src/components/employer/TalentSearchPage.tsx` | 175 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/TeamManagement.tsx` | 85 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/TeamManagement.tsx` | 124 | References x-wallet-address header name |
| `src/components/employer/TeamManagement.tsx` | 159 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/TeamManagement.tsx` | 180 | References x-wallet-address header name |
| `src/components/hub/CareerCardShareModal.tsx` | 128 | Sends x-wallet-address in fetch headers (client) |
| `src/components/hub/CareerCardShareModal.tsx` | 202 | Sends x-wallet-address in fetch headers (client) |
| `src/components/hub/CareerCardShareModal.tsx` | 290 | References x-wallet-address header name |
| `src/components/hub/CareerCardShareModal.tsx` | 329 | Sends x-wallet-address in fetch headers (client) |
| `src/components/hub/JobAlertsHubSection.tsx` | 70 | Sends x-wallet-address in fetch headers (client) |
| `src/components/hub/JobAlertsHubSection.tsx` | 143 | References x-wallet-address header name |
| `src/components/hub/JobAlertsHubSection.tsx` | 157 | References x-wallet-address header name |
| `src/components/hub/JobAlertsHubSection.tsx` | 181 | References x-wallet-address header name |
| `src/components/hub/JobAlertsHubSection.tsx` | 197 | Sends x-wallet-address in fetch headers (client) |
| `src/components/hub/ReferralBanner.tsx` | 33 | Sends x-wallet-address in fetch headers (client) |
| `src/components/messaging/MessageInbox.tsx` | 70 | Sends x-wallet-address in fetch headers (client) |
| `src/components/messaging/MessageThread.tsx` | 78 | Sends x-wallet-address in fetch headers (client) |
| `src/components/messaging/MessageThread.tsx` | 118 | References x-wallet-address header name |
| `src/components/messaging/MessagingButton.tsx` | 54 | References x-wallet-address header name |
| `src/components/simple/SimpleCardPanel.tsx` | 245 | References x-wallet-address header name |
| `src/components/stormi/StormiChatPanel.tsx` | 468 | Sends x-wallet-address in fetch headers (client) |
| `src/components/stormi/StormiChatPanel.tsx` | 562 | Sends x-wallet-address in fetch headers (client) |
| `src/components/stormi/StormiChatPanel.tsx` | 622 | Sends x-wallet-address in fetch headers (client) |
| `src/components/ui/AvatarUpload.tsx` | 69 | Sends x-wallet-address in fetch headers (client) |
| `src/components/ui/ModeToggle.tsx` | 52 | References x-wallet-address header name |
| `src/components/verification/CandidateEmploymentVerificationSection.tsx` | 66 | Sends x-wallet-address in fetch headers (client) |
| `src/components/verification/CandidateEmploymentVerificationSection.tsx` | 102 | References x-wallet-address header name |
| `src/components/verification/CandidateEmploymentVerificationSection.tsx` | 144 | References x-wallet-address header name |
| `src/components/verification/DeveloperEmploymentVerificationSection.tsx` | 78 | Sends x-wallet-address in fetch headers (client) |
| `src/components/verification/DeveloperEmploymentVerificationSection.tsx` | 80 | Sends x-wallet-address in fetch headers (client) |
| `src/components/verification/DeveloperEmploymentVerificationSection.tsx` | 120 | References x-wallet-address header name |
| `src/components/verification/DeveloperEmploymentVerificationSection.tsx` | 163 | References x-wallet-address header name |
| `src/components/verification/DriverEmploymentVerificationSection.tsx` | 75 | Sends x-wallet-address in fetch headers (client) |
| `src/components/verification/DriverEmploymentVerificationSection.tsx` | 77 | Sends x-wallet-address in fetch headers (client) |
| `src/components/verification/DriverEmploymentVerificationSection.tsx` | 117 | References x-wallet-address header name |
| `src/components/verification/DriverEmploymentVerificationSection.tsx` | 158 | References x-wallet-address header name |
| `src/components/verification/DriverVerificationSection.tsx` | 45 | Sends x-wallet-address in fetch headers (client) |
| `src/components/verification/DriverVerificationSection.tsx` | 73 | Sends x-wallet-address in fetch headers (client) |
| `src/components/verification/EmployerVerificationSection.tsx` | 62 | Sends x-wallet-address in fetch headers (client) |
| `src/components/verification/EmployerVerificationSection.tsx` | 90 | Sends x-wallet-address in fetch headers (client) |
| `src/components/verification/EmployerVerificationSection.tsx` | 116 | References x-wallet-address header name |
| `src/components/verification/EmployerVerificationSection.tsx` | 150 | References x-wallet-address header name |
| `src/hooks/use-dot-application-sync.ts` | 62 | References x-wallet-address header name |
| `src/hooks/use-dot-application-sync.ts` | 70 | References x-wallet-address header name |
| `src/hooks/use-dot-application-sync.ts` | 128 | References x-wallet-address header name |
| `src/hooks/use-extracted-requirements.ts` | 36 | References x-wallet-address header name |
| `src/hooks/use-hub-documents.tsx` | 108 | Sends x-wallet-address in fetch headers (client) |
| `src/hooks/use-hub-documents.tsx` | 385 | Sends x-wallet-address in fetch headers (client) |
| `src/hooks/use-hub-documents.tsx` | 444 | Sends x-wallet-address in fetch headers (client) |
| `src/hooks/use-hub-documents.tsx` | 472 | Sends x-wallet-address in fetch headers (client) |
| `src/hooks/use-pending-screening-request.ts` | 57 | Sends x-wallet-address in fetch headers (client) |
| `src/hooks/use-projected-career-card.ts` | 29 | Sends x-wallet-address in fetch headers (client) |
| `src/hooks/useEmployerScreenings.ts` | 76 | References x-wallet-address header name |
| `src/hooks/useEmployerScreenings.ts` | 82 | Sends x-wallet-address in fetch headers (client) |
| `src/hooks/useEmployerScreenings.ts` | 104 | Sends x-wallet-address in fetch headers (client) |
| `src/lib/auth-session.test.ts` | 17 | References x-wallet-address header name |
| `src/lib/ava-chat.ts` | 218 | Sends x-wallet-address in fetch headers (client) |
| `src/lib/sync-driver-hub-store.ts` | 10 | Sends x-wallet-address in fetch headers (client) |
| `src/lib/walkthrough-ai.ts` | 71 | References x-wallet-address header name |
| `src/stores/auth-store.ts` | 149 | Sends x-wallet-address in fetch headers (client) |
| `src/stores/career-card-lenses-store.ts` | 62 | References x-wallet-address header name |
| `src/stores/employer-blocks-store.ts` | 47 | Sends x-wallet-address in fetch headers (client) |
| `src/stores/employer-blocks-store.ts` | 89 | References x-wallet-address header name |
| `src/stores/employer-blocks-store.ts` | 111 | References x-wallet-address header name |
| `src/stores/hub-blocks-store.ts` | 148 | Sends x-wallet-address in fetch headers (client) |
| `src/stores/hub-blocks-store.ts` | 241 | References x-wallet-address header name |
| `src/stores/hub-blocks-store.ts` | 283 | Sends x-wallet-address in fetch headers (client) |
| `src/stores/hub-blocks-store.ts` | 306 | References x-wallet-address header name |
| `src/stores/hub-blocks-store.ts` | 336 | References x-wallet-address header name |
| `src/stores/hub-blocks-store.ts` | 365 | References x-wallet-address header name |
| `src/stores/notification-store.ts` | 43 | Sends x-wallet-address in fetch headers (client) |
| `src/stores/notification-store.ts` | 67 | Sends x-wallet-address in fetch headers (client) |
| `src/stores/notification-store.ts` | 86 | Sends x-wallet-address in fetch headers (client) |


### 3b. API routes that READ `x-wallet-address` (30 hits, 26 files)

Routes marked **wallet-only** use the header as primary auth (no `getStormUserIdFromRequest`). Others read the header secondarily (flags, legacy fallback, logging).

| File | Line | Description |
|------|------|-------------|
| `src/app/api/admin/companies/[id]/members/[memberId]/route.ts` | 22 | Reads x-wallet-address header (server) |
| `src/app/api/admin/companies/[id]/members/route.ts` | 21 | Reads x-wallet-address header (server) |
| `src/app/api/admin/employer-requests/[id]/route.ts` | 24 | Reads x-wallet-address header (server) |
| `src/app/api/admin/employer-requests/[id]/route.ts` | 268 | Reads x-wallet-address header (server) |
| `src/app/api/admin/employer-requests/route.ts` | 20 | Reads x-wallet-address header (server) |
| `src/app/api/admin/jobs/route.ts` | 17 | Reads x-wallet-address header (server) |
| `src/app/api/ai/chat/route.ts` | 181 | Reads x-wallet-address header (server) |
| `src/app/api/ai/cover-letter/route.ts` | 46 | Reads x-wallet-address header (server) |
| `src/app/api/ai/interview-prep-quiz/route.ts` | 37 | Reads x-wallet-address header (server) |
| `src/app/api/ai/job-talking-points/route.ts` | 45 | Reads x-wallet-address header (server) |
| `src/app/api/ai/parse-resume/route.ts` | 65 | Reads x-wallet-address header (server) |
| `src/app/api/career-card/route.ts` | 12 | Comment/doc reference |
| `src/app/api/developer/hub/route.ts` | 13 | Comment/doc reference |
| `src/app/api/driver-applications/save-progress/route.ts` | 44 | Comment/doc reference |
| `src/app/api/driver-applications/save-progress/route.ts` | 61 | Reads x-wallet-address header (server) |
| `src/app/api/driver/hub/route.ts` | 17 | Comment/doc reference |
| `src/app/api/driver/profile/clear-dot-progress/route.ts` | 33 | Comment/doc reference |
| `src/app/api/driver/public/[token]/route.ts` | 419 | Reads x-wallet-address header (server) |
| `src/app/api/github/sync/route.ts` | 13 | Comment/doc reference |
| `src/app/api/jobs/recommended/route.ts` | 69 | Reads x-wallet-address header (server) |
| `src/app/api/resumes/create/route.ts` | 21 | Reads x-wallet-address header (server) |
| `src/app/api/resumes/route.ts` | 163 | Reads x-wallet-address header (server) |
| `src/app/api/resumes/upload/route.ts` | 26 | Reads x-wallet-address header (server) |
| `src/app/api/resumes/upload/route.ts` | 273 | Reads x-wallet-address header (server) |
| `src/app/api/storm/history/route.ts` | 12 | Reads x-wallet-address header (server) |
| `src/app/api/user/profile-setup/route.ts` | 13 | Comment/doc reference |
| `src/app/api/user/profile-setup/route.ts` | 29 | Reads x-wallet-address header (server) |
| `src/app/api/user/profile/route.ts` | 143 | Comment/doc reference |
| `src/app/api/verification/attempt/route.ts` | 16 | Comment/doc reference |
| `src/app/api/verification/initiate/route.ts` | 16 | Comment/doc reference |


### 3c. Lib / middleware / tests / comments only (21 hits, 11 files)

| File | Line | Description |
|------|------|-------------|
| `src/app/invite/[token]/page.tsx` | 79 | References x-wallet-address header name |
| `src/components/GeneralResumeBuilder.tsx` | 315 | References x-wallet-address header name |
| `src/components/ResumeBuilder.tsx` | 539 | References x-wallet-address header name |
| `src/components/ResumeBuilder.tsx` | 577 | References x-wallet-address header name |
| `src/components/ResumeDashboard.tsx` | 122 | References x-wallet-address header name |
| `src/components/ResumeDashboard.tsx` | 212 | References x-wallet-address header name |
| `src/components/ResumeDashboard.tsx` | 432 | References x-wallet-address header name |
| `src/components/ResumeUploadWithVerification.tsx` | 124 | References x-wallet-address header name |
| `src/components/ResumeUploadWithVerification.tsx` | 170 | References x-wallet-address header name |
| `src/components/ResumeUploadWithVerification.tsx` | 298 | References x-wallet-address header name |
| `src/hooks/use-supabase-auth-sync.ts` | 68 | Comment/doc reference |
| `src/lib/admin-auth.ts` | 38 | Reads x-wallet-address header (server) |
| `src/lib/auth-session.test.ts` | 11 | Comment/doc reference |
| `src/lib/auth-session.ts` | 9 | Comment/doc reference |
| `src/lib/auth-session.ts` | 15 | Comment/doc reference |
| `src/lib/auth-session.ts` | 59 | Reads x-wallet-address header (server) |
| `src/lib/base-auth-middleware.ts` | 23 | Reads x-wallet-address header (server) |
| `src/lib/base-auth-middleware.ts` | 25 | Reads x-wallet-address header (server) |
| `src/lib/base-auth-middleware.ts` | 33 | '🔐 Auth Middleware: Using x-wallet-address fallback header' |
| `src/lib/base-auth-middleware.ts` | 37 | message: 'Fallback auth via x-wallet-address header', |
| `src/middleware.ts` | 29 | Comment/doc reference |


---

## 4. `walletAddress` / `wallet_address` identity reads

Scope: `src/components`, `src/stores`, `src/hooks` only.

**Legend:** **IDENTITY** = auth gate, fetch key, store field, effect dependency, or DB lookup. **COSMETIC** = truncated display or wallet UI copy only. **OTHER** = prop pass-through, TypeScript types, destructuring without gating.

### 4a. IDENTITY (374 hits, 87 files)

| File | Line | Description |
|------|------|-------------|
| `src/components/BaseWalletConnect.tsx` | 21 | IDENTITY: wallet stored in state |
| `src/components/BaseWalletConnect.tsx` | 40 | setWalletAddress(accounts[0]) |
| `src/components/BaseWalletConnect.tsx` | 66 | setWalletAddress(address) |
| `src/components/BaseWalletConnect.tsx` | 83 | setWalletAddress('') |
| `src/components/BuyUSDCButton.tsx` | 38 | IDENTITY: conditional gate on wallet |
| `src/components/EmployerHub.tsx` | 458 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 468 | Sends x-wallet-address in fetch headers (client) |
| `src/components/EmployerHub.tsx` | 527 | IDENTITY: conditional gate on wallet |
| `src/components/EmployerHub.tsx` | 531 | Sends x-wallet-address in fetch headers (client) |
| `src/components/EmployerHub.tsx` | 554 | IDENTITY: conditional gate on wallet |
| `src/components/EmployerHub.tsx` | 560 | IDENTITY: conditional gate on wallet |
| `src/components/EmployerHub.tsx` | 567 | IDENTITY: conditional gate on wallet |
| `src/components/EmployerHub.tsx` | 595 | IDENTITY: conditional gate on wallet |
| `src/components/EmployerHub.tsx` | 657 | Sends x-wallet-address in fetch headers (client) |
| `src/components/GitHubContributionGraph.tsx` | 78 | Sends x-wallet-address in fetch headers (client) |
| `src/components/MvrManagementModal.tsx` | 70 | IDENTITY: fetch uses wallet as auth key |
| `src/components/MvrStatusBadge.tsx` | 23 | IDENTITY: conditional gate on wallet |
| `src/components/MvrStatusBadge.tsx` | 30 | IDENTITY: fetch uses wallet as auth key |
| `src/components/MvrStatusIndicator.tsx` | 59 | IDENTITY: conditional gate on wallet |
| `src/components/MvrStatusIndicator.tsx` | 68 | IDENTITY: fetch uses wallet as auth key |
| `src/components/MvrViewModal.tsx` | 334 | IDENTITY: fetch uses wallet as auth key |
| `src/components/MvrViewModal.tsx` | 351 | IDENTITY: fetch uses wallet as auth key |
| `src/components/ResumeBuilder.tsx` | 405 | walletAddress reference (prop pass or display) |
| `src/components/ResumeBuilder.tsx` | 595 | walletAddress reference (prop pass or display) |
| `src/components/ResumeDashboard.tsx` | 227 | walletAddress reference (prop pass or display) |
| `src/components/ResumeDashboard.tsx` | 451 | walletAddress reference (prop pass or display) |
| `src/components/ResumeUpload.tsx` | 118 | walletAddress reference (prop pass or display) |
| `src/components/RoleSelectionModal.tsx` | 113 | IDENTITY: conditional gate on wallet |
| `src/components/RoleSelectionModal.tsx` | 133 | IDENTITY: conditional gate on wallet |
| `src/components/RoleSelectionModal.tsx` | 136 | Sends x-wallet-address in fetch headers (client) |
| `src/components/RoleSelectionModal.tsx` | 171 | IDENTITY: conditional gate on wallet |
| `src/components/STORMBalance.tsx` | 175 | IDENTITY: conditional gate on wallet |
| `src/components/StormEarningsHistory.tsx` | 40 | IDENTITY: conditional gate on wallet |
| `src/components/StormiCreditModal.tsx` | 97 | Sends x-wallet-address in fetch headers (client) |
| `src/components/TransactionHistory.tsx` | 45 | IDENTITY: conditional gate on wallet |
| `src/components/USDCBalance.tsx` | 35 | IDENTITY: conditional gate on wallet |
| `src/components/WalletInfo.tsx` | 56 | IDENTITY: conditional gate on wallet |
| `src/components/WalletTransactions.tsx` | 543 | COSMETIC: wallet display copy |
| `src/components/admin/AdminDashboardShell.tsx` | 55 | IDENTITY: wallet stored in state |
| `src/components/admin/AdminDashboardShell.tsx` | 64 | setWalletAddress(account.address) |
| `src/components/admin/AdminDashboardShell.tsx` | 93 | IDENTITY: conditional gate on wallet |
| `src/components/admin/AdminDashboardShell.tsx` | 97 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/AdminDashboardShell.tsx` | 100 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/AdminDashboardShell.tsx` | 122 | IDENTITY: conditional gate on wallet |
| `src/components/admin/AdminDashboardShell.tsx` | 124 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/AdminDashboardShell.tsx` | 262 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminDashboardShell.tsx` | 307 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminDashboardShell.tsx` | 469 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminResetWallet.tsx` | 21 | IDENTITY: wallet stored in state |
| `src/components/admin/AdminResetWallet.tsx` | 28 | setWalletAddress(initialWalletAddress) |
| `src/components/admin/AdminResetWallet.tsx` | 66 | setWalletAddress('') |
| `src/components/admin/AdminResetWallet.tsx` | 153 | onChange={(e) => setWalletAddress(e.target.value)} |
| `src/components/admin/tabs/AccessRequestsTab.tsx` | 39 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/AccessRequestsTab.tsx` | 42 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/AccessRequestsTab.tsx` | 243 | References x-wallet-address header name |
| `src/components/admin/tabs/AccessRequestsTab.tsx` | 275 | References x-wallet-address header name |
| `src/components/admin/tabs/AccessRequestsTab.tsx` | 307 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/ApplicationsTab.tsx` | 27 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/ApplicationsTab.tsx` | 32 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/BgcheckRequestsTab.tsx` | 24 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/BgcheckRequestsTab.tsx` | 29 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/CandidatesTab.tsx` | 54 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/CandidatesTab.tsx` | 65 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/CandidatesTab.tsx` | 85 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/CandidatesTab.tsx` | 89 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/CompaniesTab.tsx` | 68 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/CompaniesTab.tsx` | 72 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/CompaniesTab.tsx` | 90 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/CompaniesTab.tsx` | 95 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/CompaniesTab.tsx` | 98 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/CompaniesTab.tsx` | 133 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/CompaniesTab.tsx` | 141 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/CompaniesTab.tsx` | 327 | References x-wallet-address header name |
| `src/components/admin/tabs/CompaniesTab.tsx` | 346 | References x-wallet-address header name |
| `src/components/admin/tabs/CompaniesTab.tsx` | 364 | References x-wallet-address header name |
| `src/components/admin/tabs/CompaniesTab.tsx` | 383 | References x-wallet-address header name |
| `src/components/admin/tabs/CompaniesTab.tsx` | 406 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/CompaniesTab.tsx` | 600 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/CompaniesTab.tsx` | 627 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/DevProfilesTab.tsx` | 24 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/DevProfilesTab.tsx` | 29 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/DevProjectsTab.tsx` | 24 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/DevProjectsTab.tsx` | 29 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/DotAppsTab.tsx` | 24 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/DotAppsTab.tsx` | 29 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/JobsTab.tsx` | 22 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/JobsTab.tsx` | 25 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/JobsTab.tsx` | 173 | References x-wallet-address header name |
| `src/components/admin/tabs/JobsTab.tsx` | 192 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/MvrTab.tsx` | 33 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/MvrTab.tsx` | 38 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/MvrTab.tsx` | 56 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/MvrTab.tsx` | 62 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/MvrTab.tsx` | 212 | walletAddress reference (prop pass or display) |
| `src/components/admin/tabs/MvrTab.tsx` | 213 | walletAddress reference (prop pass or display) |
| `src/components/admin/tabs/OutreachTab.tsx` | 25 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/OutreachTab.tsx` | 30 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/ProfilesTab.tsx` | 24 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/ProfilesTab.tsx` | 29 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/PspTab.tsx` | 32 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/PspTab.tsx` | 36 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/PspTab.tsx` | 54 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/PspTab.tsx` | 60 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/PspTab.tsx` | 209 | walletAddress reference (prop pass or display) |
| `src/components/admin/tabs/PspTab.tsx` | 213 | walletAddress reference (prop pass or display) |
| `src/components/admin/tabs/ResumesTab.tsx` | 36 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/ResumesTab.tsx` | 41 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/UsersTab.tsx` | 31 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/UsersTab.tsx` | 36 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/UsersTab.tsx` | 54 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/UsersTab.tsx` | 59 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/tabs/VerificationsTab.tsx` | 24 | IDENTITY: conditional gate on wallet |
| `src/components/admin/tabs/VerificationsTab.tsx` | 29 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/CandidateShell.tsx` | 125 | IDENTITY: conditional gate on wallet |
| `src/components/app/CareerCardView.tsx` | 41 | IDENTITY: conditional gate on wallet |
| `src/components/app/CareerCardView.tsx` | 48 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/CompanyOnboarding.tsx` | 87 | IDENTITY: conditional gate on wallet |
| `src/components/app/DotApplicationFlow.tsx` | 184 | IDENTITY: conditional gate on wallet |
| `src/components/app/DotApplicationFlow.tsx` | 216 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/DotApplicationFlow.tsx` | 349 | IDENTITY: conditional gate on wallet |
| `src/components/app/DotApplicationFlow.tsx` | 361 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/DotApplicationFlow.tsx` | 373 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/DotApplicationFlow.tsx` | 417 | IDENTITY: conditional gate on wallet |
| `src/components/app/DotApplicationFlow.tsx` | 475 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/DotApplicationFlow.tsx` | 506 | IDENTITY: conditional gate on wallet |
| `src/components/app/DotApplicationFlow.tsx` | 516 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/DotApplicationFlow.tsx` | 564 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/DotApplicationFlow.tsx` | 588 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/DriverCareerCardSection.tsx` | 44 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/DriverShell.tsx` | 144 | IDENTITY: conditional gate on wallet |
| `src/components/app/DriverShell.tsx` | 183 | IDENTITY: conditional gate on wallet |
| `src/components/app/DriverShell.tsx` | 196 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/DriverShell.tsx` | 265 | IDENTITY: conditional gate on wallet |
| `src/components/app/DriverShell.tsx` | 268 | Sends x-wallet-address in fetch headers (client) |
| `src/components/app/ProfileSetup.tsx` | 114 | Sends x-wallet-address in fetch headers (client) |
| `src/components/career-card/CareerCardDynamicSections.tsx` | 119 | IDENTITY: conditional gate on wallet |
| `src/components/career-card/CareerCardDynamicSections.tsx` | 146 | IDENTITY: conditional gate on wallet |
| `src/components/career-card/CareerCardDynamicSections.tsx` | 165 | walletAddress reference (prop pass or display) |
| `src/components/career-card/ConstructSectionWrapper.tsx` | 70 | walletAddress reference (prop pass or display) |
| `src/components/career-card/DotAppPreviewModal.tsx` | 52 | Sends x-wallet-address in fetch headers (client) |
| `src/components/career-card/DotAppPreviewModal.tsx` | 76 | Sends x-wallet-address in fetch headers (client) |
| `src/components/career-card/LensManageModal.tsx` | 56 | IDENTITY: conditional gate on wallet |
| `src/components/career-card/LensManageModal.tsx` | 63 | IDENTITY: conditional gate on wallet |
| `src/components/career-card/LensManageModal.tsx` | 84 | IDENTITY: conditional gate on wallet |
| `src/components/career-card/LensManageModal.tsx` | 96 | IDENTITY: conditional gate on wallet |
| `src/components/career-card/LensManageModal.tsx` | 112 | IDENTITY: conditional gate on wallet |
| `src/components/career-card/LensManageModal.tsx` | 133 | IDENTITY: conditional gate on wallet |
| `src/components/driver-application/DriverDashboard.tsx` | 44 | IDENTITY: DB lookup by wallet_address |
| `src/components/driver-application/SaveProgressButton.tsx` | 35 | IDENTITY: conditional gate on wallet |
| `src/components/driver-application/SaveProgressButton.tsx` | 163 | walletAddress reference (prop pass or display) |
| `src/components/employer/ApplicantsPage.tsx` | 102 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateNotesPanel.tsx` | 74 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 426 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 443 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 455 | IDENTITY: conditional gate on wallet |
| `src/components/employer/CandidateOutreach.tsx` | 478 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 558 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 588 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 612 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 635 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 668 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 713 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 751 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 793 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 982 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 2249 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CandidateOutreach.tsx` | 2282 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CareerCardModal.tsx` | 130 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CareerCardModal.tsx` | 198 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CareerCardModal.tsx` | 220 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CareerCardModal.tsx` | 225 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CareerCardModal.tsx` | 269 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CareerCardModal.tsx` | 283 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CareerCardModal.tsx` | 315 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/CareerCardModal.tsx` | 342 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/JobPostingsSection.tsx` | 402 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/JobPostingsSection.tsx` | 600 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/JobPostingsSection.tsx` | 617 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/TalentSearchPage.tsx` | 175 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/TeamManagement.tsx` | 85 | Sends x-wallet-address in fetch headers (client) |
| `src/components/employer/TeamManagement.tsx` | 159 | Sends x-wallet-address in fetch headers (client) |
| `src/components/hub/BlockPickerModal.tsx` | 58 | IDENTITY: conditional gate on wallet |
| `src/components/hub/CandidateHub.tsx` | 91 | IDENTITY: conditional gate on wallet |
| `src/components/hub/CandidateHub.tsx` | 102 | IDENTITY: conditional gate on wallet |
| `src/components/hub/CandidateHub.tsx` | 113 | IDENTITY: conditional gate on wallet |
| `src/components/hub/CandidateHub.tsx` | 202 | IDENTITY: conditional gate on wallet |
| `src/components/hub/CareerCardShareModal.tsx` | 125 | IDENTITY: conditional gate on wallet |
| `src/components/hub/CareerCardShareModal.tsx` | 128 | Sends x-wallet-address in fetch headers (client) |
| `src/components/hub/CareerCardShareModal.tsx` | 197 | IDENTITY: conditional gate on wallet |
| `src/components/hub/CareerCardShareModal.tsx` | 202 | Sends x-wallet-address in fetch headers (client) |
| `src/components/hub/CareerCardShareModal.tsx` | 281 | walletAddress reference (prop pass or display) |
| `src/components/hub/CareerCardShareModal.tsx` | 325 | IDENTITY: conditional gate on wallet |
| `src/components/hub/CareerCardShareModal.tsx` | 329 | Sends x-wallet-address in fetch headers (client) |
| `src/components/hub/HubOnboardingForm.tsx` | 38 | IDENTITY: conditional gate on wallet |
| `src/components/hub/HubWorkspaceCareerCard.tsx` | 56 | IDENTITY: conditional gate on wallet |
| `src/components/hub/JobAlertsHubSection.tsx` | 61 | IDENTITY: conditional gate on wallet |
| `src/components/hub/JobAlertsHubSection.tsx` | 70 | Sends x-wallet-address in fetch headers (client) |
| `src/components/hub/JobAlertsHubSection.tsx` | 113 | IDENTITY: conditional gate on wallet |
| `src/components/hub/JobAlertsHubSection.tsx` | 175 | IDENTITY: conditional gate on wallet |
| `src/components/hub/JobAlertsHubSection.tsx` | 192 | IDENTITY: conditional gate on wallet |
| `src/components/hub/JobAlertsHubSection.tsx` | 197 | Sends x-wallet-address in fetch headers (client) |
| `src/components/hub/JobAlertsHubSection.tsx` | 208 | IDENTITY: conditional gate on wallet |
| `src/components/hub/ReferralBanner.tsx` | 30 | IDENTITY: conditional gate on wallet |
| `src/components/hub/ReferralBanner.tsx` | 33 | Sends x-wallet-address in fetch headers (client) |
| `src/components/hub/StormiContextModal.tsx` | 46 | IDENTITY: conditional gate on wallet |
| `src/components/hub/StormiContextModal.tsx` | 58 | IDENTITY: conditional gate on wallet |
| `src/components/messaging/MessageInbox.tsx` | 70 | Sends x-wallet-address in fetch headers (client) |
| `src/components/messaging/MessageThread.tsx` | 78 | Sends x-wallet-address in fetch headers (client) |
| `src/components/simple/SimpleCardPanel.tsx` | 238 | IDENTITY: conditional gate on wallet |
| `src/components/simple/SimpleCardPanel.tsx` | 271 | IDENTITY: conditional gate on wallet |
| `src/components/simple/SimpleCardPanel.tsx` | 351 | IDENTITY: conditional gate on wallet |
| `src/components/stormi/StormiChatPanel.tsx` | 339 | IDENTITY: conditional gate on wallet |
| `src/components/stormi/StormiChatPanel.tsx` | 357 | IDENTITY: conditional gate on wallet |
| `src/components/stormi/StormiChatPanel.tsx` | 427 | walletAddress reference (prop pass or display) |
| `src/components/stormi/StormiChatPanel.tsx` | 467 | IDENTITY: conditional gate on wallet |
| `src/components/stormi/StormiChatPanel.tsx` | 468 | Sends x-wallet-address in fetch headers (client) |
| `src/components/stormi/StormiChatPanel.tsx` | 555 | IDENTITY: conditional gate on wallet |
| `src/components/stormi/StormiChatPanel.tsx` | 562 | Sends x-wallet-address in fetch headers (client) |
| `src/components/stormi/StormiChatPanel.tsx` | 616 | IDENTITY: conditional gate on wallet |
| `src/components/stormi/StormiChatPanel.tsx` | 622 | Sends x-wallet-address in fetch headers (client) |
| `src/components/stormi/StormiChatPanel.tsx` | 983 | walletAddress reference (prop pass or display) |
| `src/components/stormi/StormiChatPanel.tsx` | 1004 | walletAddress reference (prop pass or display) |
| `src/components/ui/AvatarUpload.tsx` | 69 | Sends x-wallet-address in fetch headers (client) |
| `src/components/ui/ModeToggle.tsx` | 46 | IDENTITY: conditional gate on wallet |
| `src/components/ui/UserIdentity.tsx` | 64 | walletAddress reference (prop pass or display) |
| `src/components/ui/UserIdentity.tsx` | 94 | IDENTITY: conditional gate on wallet |
| `src/hooks/use-dot-application-sync.ts` | 25 | walletAddress reference (prop pass or display) |
| `src/hooks/use-dot-application-sync.ts` | 53 | IDENTITY: conditional gate on wallet |
| `src/hooks/use-dot-application-sync.ts` | 56 | walletAddress reference (prop pass or display) |
| `src/hooks/use-dot-application-sync.ts` | 62 | References x-wallet-address header name |
| `src/hooks/use-dot-application-sync.ts` | 70 | References x-wallet-address header name |
| `src/hooks/use-dot-application-sync.ts` | 93 | walletAddress reference (prop pass or display) |
| `src/hooks/use-dot-application-sync.ts` | 97 | IDENTITY: conditional gate on wallet |
| `src/hooks/use-dot-application-sync.ts` | 116 | walletAddress reference (prop pass or display) |
| `src/hooks/use-dot-application-sync.ts` | 128 | References x-wallet-address header name |
| `src/hooks/use-dot-application-sync.ts` | 155 | walletAddress reference (prop pass or display) |
| `src/hooks/use-dot-application-sync.ts` | 170 | IDENTITY: conditional gate on wallet |
| `src/hooks/use-dot-application-sync.ts` | 187 | walletAddress reference (prop pass or display) |
| `src/hooks/use-dot-application-sync.ts` | 191 | walletAddress reference (prop pass or display) |
| `src/hooks/use-dot-application-sync.ts` | 208 | walletAddress reference (prop pass or display) |
| `src/hooks/use-dot-application-sync.ts` | 212 | IDENTITY: conditional gate on wallet |
| `src/hooks/use-dot-application-sync.ts` | 215 | walletAddress reference (prop pass or display) |
| `src/hooks/use-extracted-requirements.ts` | 13 | walletAddress reference (prop pass or display) |
| `src/hooks/use-extracted-requirements.ts` | 20 | walletAddress reference (prop pass or display) |
| `src/hooks/use-extracted-requirements.ts` | 36 | References x-wallet-address header name |
| `src/hooks/use-extracted-requirements.ts` | 57 | walletAddress reference (prop pass or display) |
| `src/hooks/use-hub-documents.tsx` | 49 | walletAddress reference (prop pass or display) |
| `src/hooks/use-hub-documents.tsx` | 98 | IDENTITY: conditional gate on wallet |
| `src/hooks/use-hub-documents.tsx` | 108 | Sends x-wallet-address in fetch headers (client) |
| `src/hooks/use-hub-documents.tsx` | 383 | walletAddress reference (prop pass or display) |
| `src/hooks/use-hub-documents.tsx` | 385 | Sends x-wallet-address in fetch headers (client) |
| `src/hooks/use-hub-documents.tsx` | 418 | walletAddress reference (prop pass or display) |
| `src/hooks/use-hub-documents.tsx` | 437 | IDENTITY: conditional gate on wallet |
| `src/hooks/use-hub-documents.tsx` | 444 | Sends x-wallet-address in fetch headers (client) |
| `src/hooks/use-hub-documents.tsx` | 456 | walletAddress reference (prop pass or display) |
| `src/hooks/use-hub-documents.tsx` | 465 | IDENTITY: conditional gate on wallet |
| `src/hooks/use-hub-documents.tsx` | 472 | Sends x-wallet-address in fetch headers (client) |
| `src/hooks/use-hub-documents.tsx` | 479 | walletAddress reference (prop pass or display) |
| `src/hooks/use-hub-documents.tsx` | 500 | walletAddress reference (prop pass or display) |
| `src/hooks/use-hub-documents.tsx` | 506 | walletAddress reference (prop pass or display) |
| `src/hooks/use-hub-documents.tsx` | 513 | walletAddress reference (prop pass or display) |
| `src/hooks/use-hub-documents.tsx` | 537 | walletAddress reference (prop pass or display) |
| `src/hooks/use-hub-documents.tsx` | 553 | walletAddress reference (prop pass or display) |
| `src/hooks/use-pending-screening-request.ts` | 44 | walletAddress reference (prop pass or display) |
| `src/hooks/use-pending-screening-request.ts` | 49 | IDENTITY: conditional gate on wallet |
| `src/hooks/use-pending-screening-request.ts` | 57 | Sends x-wallet-address in fetch headers (client) |
| `src/hooks/use-pending-screening-request.ts` | 83 | walletAddress reference (prop pass or display) |
| `src/hooks/use-projected-career-card.ts` | 11 | walletAddress reference (prop pass or display) |
| `src/hooks/use-projected-career-card.ts` | 23 | IDENTITY: conditional gate on wallet |
| `src/hooks/use-projected-career-card.ts` | 29 | Sends x-wallet-address in fetch headers (client) |
| `src/hooks/use-projected-career-card.ts` | 39 | walletAddress reference (prop pass or display) |
| `src/hooks/use-projected-career-card.ts` | 42 | IDENTITY: conditional gate on wallet |
| `src/hooks/use-projected-career-card.ts` | 49 | walletAddress reference (prop pass or display) |
| `src/hooks/use-storm-token-balance.ts` | 11 | walletAddress reference (prop pass or display) |
| `src/hooks/use-storm-token-balance.ts` | 18 | IDENTITY: conditional gate on wallet |
| `src/hooks/use-storm-token-balance.ts` | 26 | walletAddress reference (prop pass or display) |
| `src/hooks/use-storm-token-balance.ts` | 27 | walletAddress reference (prop pass or display) |
| `src/hooks/use-storm-token-balance.ts` | 37 | walletAddress reference (prop pass or display) |
| `src/hooks/use-storm-token-balance.ts` | 44 | IDENTITY: conditional gate on wallet |
| `src/hooks/use-storm-token-balance.ts` | 47 | walletAddress reference (prop pass or display) |
| `src/hooks/use-supabase-auth-sync.ts` | 11 | Comment/doc reference |
| `src/hooks/use-supabase-auth-sync.ts` | 14 | Comment/doc reference |
| `src/hooks/use-supabase-auth-sync.ts` | 66 | walletAddress reference (prop pass or display) |
| `src/hooks/use-supabase-auth-sync.ts` | 69 | walletAddress reference (prop pass or display) |
| `src/hooks/use-supabase-auth-sync.ts` | 70 | walletAddress reference (prop pass or display) |
| `src/hooks/use-supabase-auth-sync.ts` | 71 | walletAddress reference (prop pass or display) |
| `src/hooks/useEmployerScreenings.ts` | 51 | walletAddress reference (prop pass or display) |
| `src/hooks/useEmployerScreenings.ts` | 62 | IDENTITY: conditional gate on wallet |
| `src/hooks/useEmployerScreenings.ts` | 76 | References x-wallet-address header name |
| `src/hooks/useEmployerScreenings.ts` | 82 | Sends x-wallet-address in fetch headers (client) |
| `src/hooks/useEmployerScreenings.ts` | 104 | Sends x-wallet-address in fetch headers (client) |
| `src/hooks/useEmployerScreenings.ts` | 140 | walletAddress reference (prop pass or display) |
| `src/stores/auth-store.ts` | 25 | walletAddress reference (prop pass or display) |
| `src/stores/auth-store.ts` | 59 | setWalletAddress: (address: string \| null) => void |
| `src/stores/auth-store.ts` | 77 | walletAddress reference (prop pass or display) |
| `src/stores/auth-store.ts` | 94 | walletAddress reference (prop pass or display) |
| `src/stores/auth-store.ts` | 120 | walletAddress reference (prop pass or display) |
| `src/stores/auth-store.ts` | 123 | setWalletAddress: (address) => set({ |
| `src/stores/auth-store.ts` | 124 | walletAddress reference (prop pass or display) |
| `src/stores/auth-store.ts` | 141 | walletAddress reference (prop pass or display) |
| `src/stores/auth-store.ts` | 142 | IDENTITY: conditional gate on wallet |
| `src/stores/auth-store.ts` | 143 | walletAddress reference (prop pass or display) |
| `src/stores/auth-store.ts` | 144 | walletAddress reference (prop pass or display) |
| `src/stores/auth-store.ts` | 149 | Sends x-wallet-address in fetch headers (client) |
| `src/stores/auth-store.ts` | 176 | walletAddress reference (prop pass or display) |
| `src/stores/auth-store.ts` | 211 | walletAddress reference (prop pass or display) |
| `src/stores/auth-store.ts` | 219 | walletAddress reference (prop pass or display) |
| `src/stores/career-card-lenses-store.ts` | 26 | IDENTITY: fetch uses wallet as auth key |
| `src/stores/career-card-lenses-store.ts` | 28 | walletAddress reference (prop pass or display) |
| `src/stores/career-card-lenses-store.ts` | 36 | walletAddress reference (prop pass or display) |
| `src/stores/career-card-lenses-store.ts` | 38 | walletAddress reference (prop pass or display) |
| `src/stores/career-card-lenses-store.ts` | 47 | walletAddress reference (prop pass or display) |
| `src/stores/career-card-lenses-store.ts` | 55 | walletAddress reference (prop pass or display) |
| `src/stores/career-card-lenses-store.ts` | 62 | References x-wallet-address header name |
| `src/stores/career-card-lenses-store.ts` | 82 | IDENTITY: fetch uses wallet as auth key |
| `src/stores/career-card-lenses-store.ts` | 85 | walletAddress reference (prop pass or display) |
| `src/stores/career-card-lenses-store.ts` | 101 | walletAddress reference (prop pass or display) |
| `src/stores/career-card-lenses-store.ts` | 105 | walletAddress reference (prop pass or display) |
| `src/stores/career-card-lenses-store.ts` | 116 | IDENTITY: fetch uses wallet as auth key |
| `src/stores/career-card-lenses-store.ts` | 120 | walletAddress reference (prop pass or display) |
| `src/stores/career-card-lenses-store.ts` | 121 | walletAddress reference (prop pass or display) |
| `src/stores/career-card-lenses-store.ts` | 123 | walletAddress reference (prop pass or display) |
| `src/stores/career-card-lenses-store.ts` | 127 | walletAddress reference (prop pass or display) |
| `src/stores/career-card-lenses-store.ts` | 138 | IDENTITY: fetch uses wallet as auth key |
| `src/stores/career-card-lenses-store.ts` | 142 | walletAddress reference (prop pass or display) |
| `src/stores/career-card-lenses-store.ts` | 146 | walletAddress reference (prop pass or display) |
| `src/stores/career-card-lenses-store.ts` | 154 | IDENTITY: fetch uses wallet as auth key |
| `src/stores/employer-blocks-store.ts` | 28 | IDENTITY: fetch uses wallet as auth key |
| `src/stores/employer-blocks-store.ts` | 29 | walletAddress reference (prop pass or display) |
| `src/stores/employer-blocks-store.ts` | 30 | walletAddress reference (prop pass or display) |
| `src/stores/employer-blocks-store.ts` | 43 | IDENTITY: fetch uses wallet as auth key |
| `src/stores/employer-blocks-store.ts` | 47 | Sends x-wallet-address in fetch headers (client) |
| `src/stores/employer-blocks-store.ts` | 83 | walletAddress reference (prop pass or display) |
| `src/stores/employer-blocks-store.ts` | 89 | References x-wallet-address header name |
| `src/stores/employer-blocks-store.ts` | 97 | IDENTITY: fetch uses wallet as auth key |
| `src/stores/employer-blocks-store.ts` | 105 | walletAddress reference (prop pass or display) |
| `src/stores/employer-blocks-store.ts` | 111 | References x-wallet-address header name |
| `src/stores/employer-blocks-store.ts` | 119 | IDENTITY: fetch uses wallet as auth key |
| `src/stores/hub-blocks-store.ts` | 80 | IDENTITY: fetch uses wallet as auth key |
| `src/stores/hub-blocks-store.ts` | 83 | walletAddress reference (prop pass or display) |
| `src/stores/hub-blocks-store.ts` | 84 | walletAddress reference (prop pass or display) |
| `src/stores/hub-blocks-store.ts` | 89 | walletAddress reference (prop pass or display) |
| `src/stores/hub-blocks-store.ts` | 97 | walletAddress reference (prop pass or display) |
| `src/stores/hub-blocks-store.ts` | 104 | walletAddress reference (prop pass or display) |
| `src/stores/hub-blocks-store.ts` | 144 | IDENTITY: fetch uses wallet as auth key |
| `src/stores/hub-blocks-store.ts` | 148 | Sends x-wallet-address in fetch headers (client) |
| `src/stores/hub-blocks-store.ts` | 188 | walletAddress reference (prop pass or display) |
| `src/stores/hub-blocks-store.ts` | 193 | IDENTITY: fetch uses wallet as auth key |
| `src/stores/hub-blocks-store.ts` | 198 | walletAddress reference (prop pass or display) |
| `src/stores/hub-blocks-store.ts` | 204 | walletAddress reference (prop pass or display) |
| `src/stores/hub-blocks-store.ts` | 216 | walletAddress reference (prop pass or display) |
| `src/stores/hub-blocks-store.ts` | 241 | References x-wallet-address header name |
| `src/stores/hub-blocks-store.ts` | 266 | walletAddress reference (prop pass or display) |
| `src/stores/hub-blocks-store.ts` | 283 | Sends x-wallet-address in fetch headers (client) |
| `src/stores/hub-blocks-store.ts` | 294 | walletAddress reference (prop pass or display) |
| `src/stores/hub-blocks-store.ts` | 306 | References x-wallet-address header name |
| `src/stores/hub-blocks-store.ts` | 317 | IDENTITY: fetch uses wallet as auth key |
| `src/stores/hub-blocks-store.ts` | 321 | walletAddress reference (prop pass or display) |
| `src/stores/hub-blocks-store.ts` | 336 | References x-wallet-address header name |
| `src/stores/hub-blocks-store.ts` | 359 | walletAddress reference (prop pass or display) |
| `src/stores/hub-blocks-store.ts` | 365 | References x-wallet-address header name |
| `src/stores/index.ts` | 18 | useWalletAddress, |
| `src/stores/notification-store.ts` | 21 | IDENTITY: fetch uses wallet as auth key |
| `src/stores/notification-store.ts` | 22 | walletAddress reference (prop pass or display) |
| `src/stores/notification-store.ts` | 23 | walletAddress reference (prop pass or display) |
| `src/stores/notification-store.ts` | 39 | IDENTITY: fetch uses wallet as auth key |
| `src/stores/notification-store.ts` | 43 | Sends x-wallet-address in fetch headers (client) |
| `src/stores/notification-store.ts` | 55 | walletAddress reference (prop pass or display) |
| `src/stores/notification-store.ts` | 67 | Sends x-wallet-address in fetch headers (client) |
| `src/stores/notification-store.ts` | 72 | IDENTITY: fetch uses wallet as auth key |
| `src/stores/notification-store.ts` | 76 | walletAddress reference (prop pass or display) |
| `src/stores/notification-store.ts` | 86 | Sends x-wallet-address in fetch headers (client) |
| `src/stores/notification-store.ts` | 90 | IDENTITY: fetch uses wallet as auth key |
| `src/stores/ui-store.ts` | 285 | walletAddress reference (prop pass or display) |


### 4b. COSMETIC only (16 hits, 11 files)

| File | Line | Description |
|------|------|-------------|
| `src/components/STORMBalance.tsx` | 185 | walletAddress reference (prop pass or display) |
| `src/components/STORMBalance.tsx` | 186 | walletAddress reference (prop pass or display) |
| `src/components/StormEarningsHistory.tsx` | 132 | COSMETIC: wallet display copy |
| `src/components/USDCBalance.tsx` | 45 | walletAddress reference (prop pass or display) |
| `src/components/USDCBalance.tsx` | 46 | walletAddress reference (prop pass or display) |
| `src/components/WalletInfo.tsx` | 64 | walletAddress reference (prop pass or display) |
| `src/components/WalletInfo.tsx` | 65 | walletAddress reference (prop pass or display) |
| `src/components/WalletInfo.tsx` | 66 | walletAddress reference (prop pass or display) |
| `src/components/WalletInfo.tsx` | 185 | COSMETIC: truncated wallet display |
| `src/components/WalletTransactions.tsx` | 95 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminDashboardShell.tsx` | 327 | COSMETIC: truncated wallet display |
| `src/components/admin/tabs/CompaniesTab.tsx` | 480 | COSMETIC: truncated wallet display |
| `src/components/employer/CompanyWallet.tsx` | 130 | walletAddress reference (prop pass or display) |
| `src/components/ui/UserIdentity.tsx` | 192 | COSMETIC: truncated wallet display |
| `src/components/wallet/SendSTORM.tsx` | 88 | walletAddress reference (prop pass or display) |
| `src/components/wallet/SendUSDC.tsx` | 78 | walletAddress reference (prop pass or display) |


### 4c. OTHER — prop pass / types (649 hits, 121 files)

| File | Line | Description |
|------|------|-------------|
| `src/components/ApplyWithStormChainModal.tsx` | 181 | walletAddress reference (prop pass or display) |
| `src/components/ApplyWithStormChainModal.tsx` | 462 | walletAddress reference (prop pass or display) |
| `src/components/BaseWalletConnect.tsx` | 101 | walletAddress reference (prop pass or display) |
| `src/components/BuyUSDCButton.tsx` | 18 | walletAddress reference (prop pass or display) |
| `src/components/BuyUSDCButton.tsx` | 28 | walletAddress reference (prop pass or display) |
| `src/components/BuyUSDCButton.tsx` | 51 | walletAddress reference (prop pass or display) |
| `src/components/BuyUSDCButton.tsx` | 106 | walletAddress reference (prop pass or display) |
| `src/components/CandidateHuntDesk.tsx` | 107 | walletAddress reference (prop pass or display) |
| `src/components/CandidateRequestsSection.tsx` | 671 | walletAddress reference (prop pass or display) |
| `src/components/CareerCard.tsx` | 203 | walletAddress reference (prop pass or display) |
| `src/components/CareerCard.tsx` | 216 | walletAddress reference (prop pass or display) |
| `src/components/CareerCard.tsx` | 252 | Sends x-wallet-address in fetch headers (client) |
| `src/components/DeveloperHub.tsx` | 263 | walletAddress reference (prop pass or display) |
| `src/components/DeveloperHub.tsx` | 530 | walletAddress reference (prop pass or display) |
| `src/components/DriverHub.tsx` | 604 | walletAddress reference (prop pass or display) |
| `src/components/DriverHub.tsx` | 793 | walletAddress reference (prop pass or display) |
| `src/components/DriverHub.tsx` | 1059 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 81 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 170 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 274 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 311 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 472 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 477 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 491 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 507 | References x-wallet-address header name |
| `src/components/EmployerHub.tsx` | 523 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 551 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 557 | IDENTITY: fetch uses wallet as auth key |
| `src/components/EmployerHub.tsx` | 561 | IDENTITY: fetch uses wallet as auth key |
| `src/components/EmployerHub.tsx` | 562 | IDENTITY: fetch uses wallet as auth key |
| `src/components/EmployerHub.tsx` | 569 | IDENTITY: fetch uses wallet as auth key |
| `src/components/EmployerHub.tsx` | 573 | IDENTITY: fetch uses wallet as auth key |
| `src/components/EmployerHub.tsx` | 581 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 598 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 624 | References x-wallet-address header name |
| `src/components/EmployerHub.tsx` | 809 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 938 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 951 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 1075 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 1134 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 1143 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 1151 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 1225 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 1274 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 1293 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 1305 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 1318 | walletAddress reference (prop pass or display) |
| `src/components/EmployerHub.tsx` | 1346 | walletAddress reference (prop pass or display) |
| `src/components/GitHubContributionGraph.tsx` | 14 | walletAddress reference (prop pass or display) |
| `src/components/GitHubContributionGraph.tsx` | 45 | walletAddress reference (prop pass or display) |
| `src/components/GitHubContributionGraph.tsx` | 98 | walletAddress reference (prop pass or display) |
| `src/components/GitHubContributionGraph.tsx` | 100 | walletAddress reference (prop pass or display) |
| `src/components/MvrManagementModal.tsx` | 12 | walletAddress reference (prop pass or display) |
| `src/components/MvrManagementModal.tsx` | 48 | walletAddress reference (prop pass or display) |
| `src/components/MvrManagementModal.tsx` | 60 | walletAddress reference (prop pass or display) |
| `src/components/MvrManagementModal.tsx` | 106 | walletAddress reference (prop pass or display) |
| `src/components/MvrOrderForm.tsx` | 119 | walletAddress reference (prop pass or display) |
| `src/components/MvrPaymentButton.tsx` | 7 | Comment/doc reference |
| `src/components/MvrPaymentButton.tsx` | 35 | /** When true with companyWalletAddress + companyId, USDC is sent from the shared compa... |
| `src/components/MvrPaymentButton.tsx` | 37 | companyWalletAddress?: string \| null |
| `src/components/MvrPaymentButton.tsx` | 45 | props.companyWalletAddress && |
| `src/components/MvrPaymentButton.tsx` | 67 | walletAddress reference (prop pass or display) |
| `src/components/MvrPaymentButton.tsx` | 100 | walletAddress reference (prop pass or display) |
| `src/components/MvrPaymentButton.tsx` | 101 | paidByWalletAddress: undefined, |
| `src/components/MvrPaymentButton.tsx` | 144 | companyWalletAddress, |
| `src/components/MvrPaymentButton.tsx` | 152 | companyWalletAddress && companyId |
| `src/components/MvrPaymentButton.tsx` | 154 | accountAddress: companyWalletAddress as `0x${string}`, |
| `src/components/MvrPaymentButton.tsx` | 188 | if (!config \|\| !client \|\| !companyWalletAddress \|\| !companyId) return null |
| `src/components/MvrPaymentButton.tsx` | 196 | walletAddress reference (prop pass or display) |
| `src/components/MvrPaymentButton.tsx` | 197 | paidByWalletAddress: memberWallet ?? undefined, |
| `src/components/MvrPaymentButton.tsx` | 236 | walletAddress reference (prop pass or display) |
| `src/components/MvrPaymentButton.tsx` | 237 | paidByWalletAddress, |
| `src/components/MvrPaymentButton.tsx` | 254 | walletAddress reference (prop pass or display) |
| `src/components/MvrPaymentButton.tsx` | 255 | paidByWalletAddress?: string |
| `src/components/MvrPaymentButton.tsx` | 318 | walletAddress reference (prop pass or display) |
| `src/components/MvrPaymentButton.tsx` | 321 | ...(paidByWalletAddress ? { paidByWalletAddress } : {}), |
| `src/components/MvrStatusBadge.tsx` | 8 | walletAddress reference (prop pass or display) |
| `src/components/MvrStatusBadge.tsx` | 18 | walletAddress reference (prop pass or display) |
| `src/components/MvrStatusBadge.tsx` | 55 | walletAddress reference (prop pass or display) |
| `src/components/MvrStatusIndicator.tsx` | 9 | walletAddress reference (prop pass or display) |
| `src/components/MvrStatusIndicator.tsx` | 49 | walletAddress reference (prop pass or display) |
| `src/components/MvrStatusIndicator.tsx` | 101 | walletAddress reference (prop pass or display) |
| `src/components/MvrViewModal.tsx` | 25 | walletAddress reference (prop pass or display) |
| `src/components/MvrViewModal.tsx` | 268 | walletAddress reference (prop pass or display) |
| `src/components/MvrViewModal.tsx` | 287 | walletAddress reference (prop pass or display) |
| `src/components/MvrViewModal.tsx` | 293 | walletAddress reference (prop pass or display) |
| `src/components/MvrViewModal.tsx` | 307 | walletAddress reference (prop pass or display) |
| `src/components/MvrViewModal.tsx` | 372 | walletAddress reference (prop pass or display) |
| `src/components/MyApplications.tsx` | 66 | walletAddress reference (prop pass or display) |
| `src/components/Navigation.tsx` | 75 | mvrWalletAddress?: string \| null |
| `src/components/Navigation.tsx` | 76 | walletAddress reference (prop pass or display) |
| `src/components/Navigation.tsx` | 94 | mvrWalletAddress, |
| `src/components/Navigation.tsx` | 95 | walletAddress reference (prop pass or display) |
| `src/components/Navigation.tsx` | 122 | walletAddress reference (prop pass or display) |
| `src/components/Navigation.tsx` | 221 | walletAddress reference (prop pass or display) |
| `src/components/Navigation.tsx` | 223 | walletAddress reference (prop pass or display) |
| `src/components/Navigation.tsx` | 360 | walletAddress reference (prop pass or display) |
| `src/components/Navigation.tsx` | 361 | walletAddress reference (prop pass or display) |
| `src/components/Navigation.tsx` | 397 | {isAuthenticated && userRole === 'driver' && mvrWalletAddress && ( |
| `src/components/Navigation.tsx` | 399 | walletAddress reference (prop pass or display) |
| `src/components/Navigation.tsx` | 437 | walletAddress reference (prop pass or display) |
| `src/components/Navigation.tsx` | 661 | walletAddress reference (prop pass or display) |
| `src/components/Navigation.tsx` | 667 | References x-wallet-address header name |
| `src/components/ProfileSetupModal.tsx` | 13 | walletAddress reference (prop pass or display) |
| `src/components/ProfileSetupModal.tsx` | 40 | walletAddress reference (prop pass or display) |
| `src/components/ProfileSetupModal.tsx` | 87 | References x-wallet-address header name |
| `src/components/PspOrderForm.tsx` | 148 | walletAddress reference (prop pass or display) |
| `src/components/PspPaymentButton.tsx` | 7 | Comment/doc reference |
| `src/components/PspPaymentButton.tsx` | 35 | /** When true with companyWalletAddress + companyId, USDC is sent from the shared compa... |
| `src/components/PspPaymentButton.tsx` | 37 | companyWalletAddress?: string \| null |
| `src/components/PspPaymentButton.tsx` | 45 | props.companyWalletAddress && |
| `src/components/PspPaymentButton.tsx` | 67 | walletAddress reference (prop pass or display) |
| `src/components/PspPaymentButton.tsx` | 100 | walletAddress reference (prop pass or display) |
| `src/components/PspPaymentButton.tsx` | 101 | paidByWalletAddress: undefined, |
| `src/components/PspPaymentButton.tsx` | 144 | companyWalletAddress, |
| `src/components/PspPaymentButton.tsx` | 152 | companyWalletAddress && companyId |
| `src/components/PspPaymentButton.tsx` | 154 | accountAddress: companyWalletAddress as `0x${string}`, |
| `src/components/PspPaymentButton.tsx` | 188 | if (!config \|\| !client \|\| !companyWalletAddress \|\| !companyId) return null |
| `src/components/PspPaymentButton.tsx` | 196 | walletAddress reference (prop pass or display) |
| `src/components/PspPaymentButton.tsx` | 197 | paidByWalletAddress: memberWallet ?? undefined, |
| `src/components/PspPaymentButton.tsx` | 236 | walletAddress reference (prop pass or display) |
| `src/components/PspPaymentButton.tsx` | 237 | paidByWalletAddress, |
| `src/components/PspPaymentButton.tsx` | 254 | walletAddress reference (prop pass or display) |
| `src/components/PspPaymentButton.tsx` | 255 | paidByWalletAddress?: string |
| `src/components/PspPaymentButton.tsx` | 318 | walletAddress reference (prop pass or display) |
| `src/components/PspPaymentButton.tsx` | 321 | ...(paidByWalletAddress ? { paidByWalletAddress } : {}), |
| `src/components/PspViewModal.tsx` | 23 | walletAddress reference (prop pass or display) |
| `src/components/PspViewModal.tsx` | 193 | walletAddress reference (prop pass or display) |
| `src/components/PspViewModal.tsx` | 209 | walletAddress reference (prop pass or display) |
| `src/components/PspViewModal.tsx` | 215 | walletAddress reference (prop pass or display) |
| `src/components/PspViewModal.tsx` | 233 | walletAddress reference (prop pass or display) |
| `src/components/PspViewModal.tsx` | 249 | walletAddress reference (prop pass or display) |
| `src/components/PspViewModal.tsx` | 250 | walletAddress reference (prop pass or display) |
| `src/components/ResumeBuilder.tsx` | 141 | walletAddress reference (prop pass or display) |
| `src/components/ResumeBuilder.tsx` | 510 | walletAddress reference (prop pass or display) |
| `src/components/ResumeDashboard.tsx` | 100 | walletAddress reference (prop pass or display) |
| `src/components/ResumeUpload.tsx` | 26 | walletAddress reference (prop pass or display) |
| `src/components/RoleSelectionModal.tsx` | 57 | walletAddress reference (prop pass or display) |
| `src/components/RoleSelectionModal.tsx` | 66 | walletAddress reference (prop pass or display) |
| `src/components/RoleSelectionModal.tsx` | 102 | walletAddress reference (prop pass or display) |
| `src/components/RoleSelectionModal.tsx` | 103 | walletAddress reference (prop pass or display) |
| `src/components/RoleSelectionModal.tsx` | 120 | walletAddress reference (prop pass or display) |
| `src/components/RoleSelectionModal.tsx` | 130 | walletAddress reference (prop pass or display) |
| `src/components/RoleSelectionModal.tsx` | 153 | walletAddress reference (prop pass or display) |
| `src/components/RoleSelectionModal.tsx` | 181 | References x-wallet-address header name |
| `src/components/RoleSelectionModal.tsx` | 252 | walletAddress reference (prop pass or display) |
| `src/components/RoleSelectionModal.tsx` | 255 | walletAddress reference (prop pass or display) |
| `src/components/STORMBalance.tsx` | 19 | walletAddress reference (prop pass or display) |
| `src/components/STORMBalance.tsx` | 37 | walletAddress reference (prop pass or display) |
| `src/components/STORMBalance.tsx` | 40 | walletAddress reference (prop pass or display) |
| `src/components/STORMBalance.tsx` | 118 | walletAddress reference (prop pass or display) |
| `src/components/STORMBalance.tsx` | 161 | walletAddress reference (prop pass or display) |
| `src/components/STORMBalance.tsx` | 211 | walletAddress reference (prop pass or display) |
| `src/components/STORMBalance.tsx` | 218 | walletAddress reference (prop pass or display) |
| `src/components/STORMBalance.tsx` | 304 | walletAddress reference (prop pass or display) |
| `src/components/STORMBalance.tsx` | 387 | walletAddress reference (prop pass or display) |
| `src/components/ShareProfileCard.tsx` | 42 | walletAddress reference (prop pass or display) |
| `src/components/ShareProfileCard.tsx` | 50 | walletAddress reference (prop pass or display) |
| `src/components/ShareProfileCard.tsx` | 57 | walletAddress reference (prop pass or display) |
| `src/components/ShareProfileCard.tsx` | 336 | walletAddress reference (prop pass or display) |
| `src/components/StormEarningsHistory.tsx` | 26 | walletAddress reference (prop pass or display) |
| `src/components/StormEarningsHistory.tsx` | 31 | walletAddress reference (prop pass or display) |
| `src/components/StormEarningsHistory.tsx` | 48 | References x-wallet-address header name |
| `src/components/StormEarningsHistory.tsx` | 69 | walletAddress reference (prop pass or display) |
| `src/components/StormEarningsHistory.tsx` | 142 | walletAddress reference (prop pass or display) |
| `src/components/StormiCreditModal.tsx` | 19 | walletAddress reference (prop pass or display) |
| `src/components/StormiCreditModal.tsx` | 36 | walletAddress reference (prop pass or display) |
| `src/components/StormiCreditModal.tsx` | 60 | walletAddress reference (prop pass or display) |
| `src/components/TransactionHistory.tsx` | 18 | walletAddress reference (prop pass or display) |
| `src/components/TransactionHistory.tsx` | 29 | walletAddress reference (prop pass or display) |
| `src/components/TransactionHistory.tsx` | 65 | walletAddress reference (prop pass or display) |
| `src/components/TransactionHistory.tsx` | 68 | walletAddress reference (prop pass or display) |
| `src/components/TransactionHistory.tsx` | 71 | walletAddress reference (prop pass or display) |
| `src/components/TransactionHistory.tsx` | 74 | walletAddress reference (prop pass or display) |
| `src/components/TransactionHistory.tsx` | 78 | walletAddress reference (prop pass or display) |
| `src/components/TransactionHistory.tsx` | 106 | walletAddress reference (prop pass or display) |
| `src/components/TransactionHistory.tsx` | 114 | walletAddress reference (prop pass or display) |
| `src/components/TransactionHistory.tsx` | 219 | walletAddress reference (prop pass or display) |
| `src/components/USDCBalance.tsx` | 14 | walletAddress reference (prop pass or display) |
| `src/components/USDCBalance.tsx` | 21 | walletAddress reference (prop pass or display) |
| `src/components/USDCBalance.tsx` | 63 | walletAddress reference (prop pass or display) |
| `src/components/USDCBalance.tsx` | 83 | walletAddress reference (prop pass or display) |
| `src/components/USDCBalance.tsx` | 90 | walletAddress reference (prop pass or display) |
| `src/components/UserStatusModal.tsx` | 316 | walletAddress reference (prop pass or display) |
| `src/components/UserStatusModal.tsx` | 322 | walletAddress reference (prop pass or display) |
| `src/components/UserStatusModal.tsx` | 329 | walletAddress reference (prop pass or display) |
| `src/components/UserStatusModal.tsx` | 339 | walletAddress reference (prop pass or display) |
| `src/components/UserStatusModal.tsx` | 443 | walletAddress reference (prop pass or display) |
| `src/components/UserStatusModal.tsx` | 450 | walletAddress reference (prop pass or display) |
| `src/components/UserStatusModal.tsx` | 460 | walletAddress reference (prop pass or display) |
| `src/components/UserStatusModal.tsx` | 464 | walletAddress reference (prop pass or display) |
| `src/components/UserStatusModal.tsx` | 469 | walletAddress reference (prop pass or display) |
| `src/components/WalletCard.tsx` | 281 | walletAddress reference (prop pass or display) |
| `src/components/WalletInfo.tsx` | 16 | walletAddress reference (prop pass or display) |
| `src/components/WalletInfo.tsx` | 24 | walletAddress reference (prop pass or display) |
| `src/components/WalletInfo.tsx` | 47 | walletAddress reference (prop pass or display) |
| `src/components/WalletInfo.tsx` | 99 | walletAddress reference (prop pass or display) |
| `src/components/WalletInfo.tsx` | 103 | walletAddress reference (prop pass or display) |
| `src/components/WalletInfo.tsx` | 107 | walletAddress reference (prop pass or display) |
| `src/components/WalletInfo.tsx` | 182 | walletAddress reference (prop pass or display) |
| `src/components/WalletTransactions.tsx` | 33 | walletAddress reference (prop pass or display) |
| `src/components/WalletTransactions.tsx` | 37 | walletAddress reference (prop pass or display) |
| `src/components/WalletTransactions.tsx` | 50 | walletAddress reference (prop pass or display) |
| `src/components/WalletTransactions.tsx` | 89 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminDashboardShell.tsx` | 114 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminDashboardShell.tsx` | 131 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminDashboardShell.tsx` | 135 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminDashboardShell.tsx` | 157 | Sends x-wallet-address in fetch headers (client) |
| `src/components/admin/AdminDashboardShell.tsx` | 234 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminDashboardShell.tsx` | 236 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminDashboardShell.tsx` | 251 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminResetWallet.tsx` | 7 | initialWalletAddress?: string |
| `src/components/admin/AdminResetWallet.tsx` | 14 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminResetWallet.tsx` | 19 | initialWalletAddress = '', |
| `src/components/admin/AdminResetWallet.tsx` | 29 | }, [initialWalletAddress]) |
| `src/components/admin/AdminResetWallet.tsx` | 36 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminResetWallet.tsx` | 55 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminResetWallet.tsx` | 71 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminResetWallet.tsx` | 84 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminResetWallet.tsx` | 100 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminResetWallet.tsx` | 108 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminResetWallet.tsx` | 152 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminResetWallet.tsx` | 163 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminResetWallet.tsx` | 174 | walletAddress reference (prop pass or display) |
| `src/components/admin/AdminResetWallet.tsx` | 191 | walletAddress reference (prop pass or display) |
| `src/components/admin/admin-types.ts` | 27 | walletAddress reference (prop pass or display) |
| `src/components/admin/admin-types.ts` | 55 | walletAddress reference (prop pass or display) |
| `src/components/admin/admin-types.ts` | 85 | walletAddress reference (prop pass or display) |
| `src/components/admin/admin-types.ts` | 104 | walletAddress reference (prop pass or display) |
| `src/components/admin/admin-types.ts` | 213 | walletAddress reference (prop pass or display) |
| `src/components/admin/admin-types.ts` | 220 | walletAddress reference (prop pass or display) |
| `src/components/admin/admin-types.ts` | 237 | walletAddress reference (prop pass or display) |
| `src/components/admin/admin-types.ts` | 294 | walletAddress reference (prop pass or display) |
| `src/components/admin/admin-types.ts` | 309 | walletAddress reference (prop pass or display) |
| `src/components/admin/admin-types.ts` | 320 | walletAddress reference (prop pass or display) |
| `src/components/admin/admin-types.ts` | 326 | walletAddress reference (prop pass or display) |
| `src/components/admin/modals/CreateCompanyModal.tsx` | 10 | walletAddress reference (prop pass or display) |
| `src/components/admin/modals/CreateCompanyModal.tsx` | 18 | walletAddress reference (prop pass or display) |
| `src/components/admin/modals/CreateCompanyModal.tsx` | 53 | References x-wallet-address header name |
| `src/components/admin/modals/UserDetailModal.tsx` | 73 | walletAddress reference (prop pass or display) |
| `src/components/admin/modals/UserDetailModal.tsx` | 487 | walletAddress reference (prop pass or display) |
| `src/components/admin/tabs/AccessRequestsTab.tsx` | 19 | walletAddress reference (prop pass or display) |
| `src/components/admin/tabs/AccessRequestsTab.tsx` | 53 | walletAddress reference (prop pass or display) |
| `src/components/admin/tabs/AccessRequestsTab.tsx` | 221 | walletAddress reference (prop pass or display) |
| `src/components/admin/tabs/ApplicationsTab.tsx` | 11 | walletAddress reference (prop pass or display) |
| `src/components/admin/tabs/ApplicationsTab.tsx` | 42 | walletAddress reference (prop pass or display) |
| `src/components/admin/tabs/BgcheckRequestsTab.tsx` | 11 | walletAddress reference (prop pass or display) |
| `src/components/admin/tabs/BgcheckRequestsTab.tsx` | 39 | walletAddress reference (prop pass or display) |
| `src/components/admin/tabs/CandidatesTab.tsx` | 38 | walletAddress reference (prop pass or display) |
| `src/components/admin/tabs/CandidatesTab.tsx` | 77 | walletAddress reference (prop pass or display) |

_… 399 additional hits omitted; run ripgrep on the path above for the full list._


---


## Cutover order recommendation

Remove the `x-wallet-address` fallback in `src/lib/auth-session.ts` **only after** every caller that still depends on wallet auth has been migrated. Recommended sequence (maps to T1.12a → T1.12b → T1.12c in `EXECUTION_CHECKLIST.md`):

### Phase 0 — T1.12-pre (this doc)
Read-only inventory; no code changes.

### Phase 1 — T1.12a: Middleware
- **`src/middleware.ts`** — re-include `/api/*` so Supabase session cookies refresh on API calls before client stops sending wallet headers.

### Phase 2 — T1.12b: Client + secondary server reads (must complete BEFORE dropping auth-session fallback)

**Blockers (identity-critical — change first):**

| Priority | Files | Why |
|----------|-------|-----|
| P0 | `src/app/page.tsx` | Root auth orchestration; Alchemy hooks + wallet-based profile fetch; gates entire app |
| P0 | `src/hooks/use-supabase-auth-sync.ts` | Bridge still syncs DB wallet into client `address`; must become session-only identity |
| P0 | `src/stores/auth-store.ts` | Persists `walletAddress`; profile fetch still sends header |
| P0 | All **Category 3a client fetch senders** | Every `fetch(..., { headers: { 'x-wallet-address' }})` must rely on cookie session instead |
| P0 | `src/lib/sync-driver-hub-store.ts`, `src/lib/ava-chat.ts`, `src/lib/walkthrough-ai.ts` | Lib helpers that inject wallet header from client-provided address |
| P1 | `src/components/AlchemyAuth.tsx`, `src/app/onboard/[token]/page.tsx`, `src/app/invite/[token]/page.tsx` | Alchemy AuthCard flows for invite/onboard |
| P1 | **Pace-critical employer UI**: `CandidateOutreach.tsx`, `CareerCardModal.tsx`, `EmployerHub.tsx`, `EmployerPspMvrBundleAttestationStep.tsx`, `TeamManagement.tsx`, `ApplicantsPage.tsx`, `TalentSearchPage.tsx` | High fetch volume; employer workflows |
| P1 | **Admin dashboard** (`AdminDashboardShell.tsx` + all admin tabs) | Still wallet-gated until T1.8-admin ships |
| P2 | Legacy shells: `DriverShell.tsx`, `DriverHub.tsx`, `DeveloperHub.tsx` | Frozen shells but still send wallet headers if users remain |

**API routes with wallet-only auth (no `getStormUserIdFromRequest` — migrate with T1.8-admin or before T1.12c):**

- `src/app/api/admin/jobs/route.ts`
- `src/app/api/admin/employer-requests/route.ts` + `[id]/route.ts`
- `src/app/api/admin/companies/[id]/members/route.ts` + `[memberId]/route.ts`
- `src/app/api/storm/history/route.ts` (legacy STORM ERC-20 history — candidate for deletion with Option B)
- `src/app/api/driver/public/[token]/route.ts` (optional wallet on public share — verify semantics)

**API routes with dual read (session + direct header for flags/fallback — remove header branch at T1.12b):**

- `resumes/create`, `resumes/upload`, `resumes/route.ts`
- `user/profile-setup/route.ts`
- `driver-applications/save-progress/route.ts`
- `ai/chat`, `ai/parse-resume`, `ai/cover-letter`, `ai/interview-prep-quiz`, `ai/job-talking-points`
- `jobs/recommended` (STORMI_UNLIMITED_WALLETS flag)

### Phase 3 — T1.12c: Remove Alchemy + wallet fallback (point of no return)

**Only after Phase 2 is verified on Vercel preview + Pace Monday check:**

| File | Action |
|------|--------|
| `src/app/layout.tsx` | Remove `<AlchemyProvider>` wrap |
| `src/components/AlchemyProvider.tsx` | Delete |
| `src/lib/alchemy-account-config.ts` | Delete |
| `src/app/page.tsx` | Remove all `@account-kit/react` hooks; session-only auth gate |
| Category 1 payment/wallet components | Delete or stub (MvrPaymentButton, PspPaymentButton, SendSTORM, SendUSDC, StormiCreditModal USDC path) |
| `src/lib/auth-session.ts` | Delete wallet branch (lines 58–63); Supabase-only |
| `src/lib/base-auth-middleware.ts` | Remove wallet fallback logging |
| `package.json` | Remove `@account-kit/*`, `alchemy-sdk` (separate commit; not part of T1.12-pre) |

### Safe to leave for last (T1.13 — wallet UI removal, cosmetic)

- `src/components/WalletInfo.tsx`, `STORMBalance.tsx`, `USDCBalance.tsx`, `TransactionHistory.tsx`
- `src/lib/alchemy-token-api.ts`, `alchemy-transfers-api.ts`, `alchemy-simulation-api.ts` (read-only chain queries until payments removed)
- `src/lib/company-wallet-server.ts` (employer team wallet — **separate** from user auth; Pace employer on-chain features)
- Truncated wallet display strings in nav/profile (Category 4b cosmetic)
- `src/components/admin/AdminResetWallet.tsx` (admin ops tooling)

### Verification gate before T1.12c

```bash
rg "x-wallet-address" src/components src/stores src/hooks src/lib --glob '!*.test.ts'  # → 0 senders
rg "headers.get\('x-wallet-address'\)" src/app/api  # → 0 (except webhooks/docs)
rg "@account-kit" src/  # → 0
```

Dual-door removal: delete `?wallet=1` legacy path in `page.tsx` / `DriverShell` at T1.12c alongside Alchemy removal.

