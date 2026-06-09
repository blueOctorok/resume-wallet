# Storm — Project Roadmap

## Foundation Reset (May 2026 — top priority)

> **Read this first.** A late-May 2026 strategy review concluded that Storm's user-facing infrastructure (Alchemy smart wallets, USDC payments, IPFS, on-chain registries, STORM ERC-20) is decorative — it adds operational complexity without delivering a real moat. The new direction puts a Web2 stack underneath the product and delivers cryptographic verification as a real, swappable backend behind a stable interface — signed JWTs first (Phase 2, shipped), Midnight ZK next (Phase 3, active track per DEC-2026-06-001). **Full strategic + architectural context lives in [`docs/midnight/ARCHITECTURE.md`](midnight/ARCHITECTURE.md). The moat thesis is in [`docs/midnight/MOAT_THESIS.md`](midnight/MOAT_THESIS.md). Decision rationale is in [`docs/midnight/DECISION_LOG.md`](midnight/DECISION_LOG.md).**

The Foundation Reset's first arc is **complete**: Phase 1 (Web2 cleanup), Web3 demolition, and the selective-disclosure moat (Phase 2) have all shipped. The highest-priority track is now **Phase 3 — building the Midnight ZK backbone for real** (go-to-market driven, DEC-2026-06-001). DQ File Completion (below) continues in parallel.

**Where we are (2026-06-09):** the auth swap is **done and live** (Supabase is the only login, Pace works on it), **Web3 demolition is complete** (D1–D5), and the **selective-disclosure moat (Phase 2) has shipped** (P2.1–P2.7). The active work is **Phase 3 — building the Midnight ZK backbone for real** — now a go-to-market-driven track, plus ongoing third-party fact-registry breadth. Stripe stays a deferred swap-in-later track.

| Track | Goal | Status |
|---|---|---|
| **Auth swap (Alchemy → Supabase)** | Email/Google passwordless login; ~115 API routes off `x-wallet-address`; admin gated by `ADMIN_EMAILS`. | ✅ **DONE & live** |
| **Web3 demolition** | Delete STORM ERC-20, Base-Sepolia registries, USDC + company wallet + `@account-kit`, and move documents IPFS → Supabase Storage. | ✅ **DONE (D1–D5)** |
| **Phase 2 — Selective-disclosure UX** | Carrier-facing fact panels (✓ clean MVR, ✓ Class A with hazmat) instead of PDFs. Candidate disclosure toggles per audience. Backed by signed JWT attestations behind `attestationService` interface. **This is the moat.** | ✅ **SHIPPED (P2.1–P2.7)** |
| **Phase 3 — Midnight ZK backbone** | Swap signed-JWT implementation for Midnight ZK proofs behind the *same* `attestationService` interface. Optionally reissue STORM as a Midnight-native shielded token if a token use case emerges. Users still never *interact with* Midnight. | 🎯 **Active track — go-to-market driven (DEC-2026-06-001)** |
| **Payments (Stripe)** | Greenfield Checkout (one-time) + Subscriptions, added **when a paying non-Pace customer exists**. *Not* a USDC→Stripe conversion — USDC is being deleted in demolition, so there's nothing to migrate. | ⏸ **Deferred** |

### Pre-flight decisions (resolved 2026-05-22)

- **Auth provider:** ✅ **Supabase Auth** (DEC-2026-05-008) — already paid for on Supabase Pro; native `auth.uid()` for RLS; one vendor surface. Custom sign-in UI built with Storm's `@/components/ui` primitives. **Shipped.**
- **STORM token:** ✅ **Option B** (DEC-2026-05-005) — drop Base Sepolia ERC-20, preserve optionality to reissue as a Midnight-native shielded token in Phase 3. The off-chain `storm_points` ledger is **deferred until a real reward concept exists** (STORM never reached a real user, so there's nothing to migrate now).
- **Payment shape:** ✅ **Stripe Checkout (one-time) + Subscriptions** (DEC-2026-05-006) — locked shape, but now a **deferred greenfield add, not a USDC conversion**. Pace stays on free admin placement; billing is enforced only for new/non-Pace customers when Stripe lands.

Atomic per-step execution: [`docs/midnight/EXECUTION_CHECKLIST.md`](midnight/EXECUTION_CHECKLIST.md) (auth track collapsed to a DONE table; active work is the demolition `D1–D5` steps). Strategic-level breakdown: [`docs/midnight/PHASE_1_PLAN.md`](midnight/PHASE_1_PLAN.md).

### Phase 3 is active — go-to-market driven (DEC-2026-06-001)

Phase 3 was previously gated behind a *defensive* trigger (a customer/regulator/investor demanding non-repudiation). That framing is retired. The real, time-sensitive driver is **go-to-market + ecosystem**: being one of the first *real, regulated-industry* use cases on Midnight while that's still novel — a narrative + partnership asset (grants, co-marketing, foundation amplification) that only exists in a finite window.

The old defensive triggers are still *bonus* accelerants if they happen (a carrier wanting unforgeable proof, a regulator, an investor, a ZK-conditional contract) — but none of them is required to justify the work anymore.

**The quality bar is the gate now, not the trigger.** Storm is not a crypto scam project: time-to-market means time-to-*credible*, never time-to-garbage. Ship nothing fake — if a fact says "proven on Midnight," the proof must actually run. Narrate the vision now ("built on Midnight"); attach a per-fact live-proof claim only when that proof genuinely runs (DEC-2026-05-004 honesty guardrail retained). Users still never *interact with* the chain (DEC-2026-05-001), and only third-party facts are ever proven (DEC-2026-05-014). Full quality bar: `.cursor/rules/strategic-direction.mdc` → "Phase 3 is an active track."

### What survives every phase

- Supabase as source of truth (every `block_*` table, `user_profiles`, `companies`, `mvr_orders`, `psp_orders`, `applications`, `driver_applications`)
- Composable hub architecture (registry, `block-data.ts`, every block component, every shell)
- Accio integration (PSP / MVR XML pipeline, webhooks, reconcile)
- DOT application wizard, bidirectional mapper, PDF export
- Stormi context, prompts, journey
- Career card, projected card, lenses
- Employer hub, blocks, screenings, applicant pipeline, audit trail

The Foundation Reset is *substitution* (Web3 stack → Web2 stack), not *rewrite*. Product surface stays intact.

---

## Strategic Direction (May 2026)

> The blockchain policy and product framing in this section remain correct under the Foundation Reset. The Foundation Reset adds *implementation* details (Phase 1/2/3) but does not change *what Storm is*.

### What Storm IS

Storm is a **portable, composable DQ (Driver Qualification) file platform**. Drivers build their compliance file once and take it everywhere. Staffing agencies and carriers receive pre-assembled, partially-verified DQ files instead of starting from scratch with every driver.

**Employer-focused first, candidate second.** Revenue and product decisions prioritize what staffing agencies (Pace Drivers) and carriers need. Candidates benefit because a better DQ file = faster placement = more job opportunities.

### The three product layers

| Layer | Audience | Purpose |
|-------|----------|---------|
| **DQ File** | Carriers & staffing agencies | Complete federal compliance package — DOT app, MVR, employment verifications, medical cert, road test cert, ELDT, annual certifications. The actual product that saves carriers 2-4 weeks of onboarding. |
| **Career Card** | Employers discovering candidates | Live verified profile behind a QR code / link. What employers see when they want more than a resume. Trust layer showing verification status. |
| **Resume PDF** | External job sites & ATSs | Distribution vehicle. A normal resume that speaks every ATS's language, with a QR code + link back to the career card. The Trojan horse that gets Storm into the hiring pipeline. |

### Blockchain policy — honest usage only

> **Narrative vs. claim (DEC-2026-05-016, 2026-05-30):** Storm now *celebrates* blockchain / Midnight / zero-knowledge as its public credibility story (the domain is `stormchain.ai`). That loosening applies to the **narrative** only. The **per-fact claim** rules below are unchanged and iron-clad: a "verified / on-chain" badge still attaches only to issuer-signed third-party facts, never to self-reported data — and users still never touch a wallet.

Blockchain is an immutable timestamp ledger. It proves data existed at a time and hasn't been altered. It does NOT make data true.

**Use blockchain ONLY when all three conditions are met:**
1. Data came from a **third-party source** (not the candidate)
2. There's a **real incentive** for someone to alter the result after the fact
3. An employer needs to **independently verify** the result without trusting Storm

| Blockchain YES | Blockchain NO |
|----------------|---------------|
| MVR results (Accio/DMV pull) | Resume PDF (self-reported) |
| Employment verification answers (previous employer responses) | DOT application form (self-reported) |
| Future: CDLIS CDL lookup results | Self-reported CDL info |
| Future: FMCSA Clearinghouse query results | Education, skills, references |
| Future: PSP crash/inspection data | Any candidate-entered data |

**Language rules:**
- NEVER say "blockchain-verified" for self-reported data
- Say "third-party verified, tamper-proof on-chain" for MVR + employment verification
- Say "on-file" or "submitted" for DOT app, resume, certificates
- The pitch: "Storm can't edit your MVR results even if we wanted to. Here's the proof."

### CRA compliance — the iron-clad rule

Storm is NOT a Consumer Reporting Agency (CRA). To stay that way:

| Who ordered the report | Who can see it | Goes on career card? | Storm API serves it? |
|------------------------|---------------|---------------------|---------------------|
| **Driver self-orders** (driver pays) | Driver + anyone driver shares with | ✅ Yes | ✅ Yes (driver authorizes) |
| **Employer orders** (employer pays) | That employer ONLY | ❌ Never | ❌ Never |

**If an employer (Pace, a carrier, anyone) orders an MVR, PSP, or any background check on a driver, that report is scoped to that employer permanently.** It cannot appear on the driver's career card, cannot be shown to other employers, and cannot be served through any Storm API to third parties. Violating this makes Storm a CRA under FCRA.

The driver's portable DQ file only contains **driver-owned** data: self-ordered MVR, self-initiated employment verifications, their DOT app, their uploaded certificates.

### The DQ file — what's required (49 CFR 391.51)

| # | DQ Component | CFR | Storm status | Effort remaining |
|---|---|---|---|---|
| 1 | Employment Application | §391.21 | ✅ **Done** | Full 3-form DOT app wizard, PDF export, bidirectional mapper |
| 2 | Motor Vehicle Record | §391.23 | ✅ **Done** | Accio/KeyBackground integration, real state DMV pull. **Pipeline overhaul (May 2026):** centralized Accio `filledCode` mapping ([`accio-result-status.ts`](../src/lib/accio-result-status.ts)), full-SSN orders, webhook-base-URL hardening, `result_outcome` column + outcome chips across UI, **server-rendered Storm-branded PDF** ([`MvrReportPdf.tsx`](../src/lib/pdf/MvrReportPdf.tsx)). Backfill migration `079` re-derives status for existing rows. **Fail-fast pipeline (May 2026):** [`screening-validation.ts`](../src/lib/screening-validation.ts) rejects bad DL / state / DOB / SSN / duplicate orders before Accio is called; [`screening-webhook-match.ts`](../src/lib/screening-webhook-match.ts) replaces the dangerous state-only webhook fallback with strict ID precedence + DL+state recovery; [`ScreeningFailureBanner`](../src/components/ui/ScreeningFailureBanner.tsx) gives users a clear "re-order with corrected info" path. |
| 3 | Previous Employer Safety Performance History | §391.23 | ✅ **Done** | 3-attempt email outreach, token portal, 6 FMCSA questions |
| 3b | FMCSA PSP (crash / inspection) via Accio | §391.23 | ✅ **Done** | Standalone `driver-psp` block, orders + webhook; **FMCSA PSP Disclosure & Authorization** (`psp_consents` + `PspDisclosureForm`) before live orders; **structured XML parser** ([`accio-psp-parser.ts`](../src/lib/accio-psp-parser.ts)) extracts crash / inspection / OOS counts, plus raw `<text>` fallback. Webhook + UI use **`accio-result-status.ts`** outcome mapping (no more `needs_review` for clean reports). **Server-side branded PDF** via `@react-pdf/renderer` ([`PspReportPdf.tsx`](../src/lib/pdf/PspReportPdf.tsx)). **Employer-side:** company installs **`employer-screening-consent`** (one three-instrument consent package per candidate), **`employer-psp-orders`** for PSP, **`employer-mvr-orders`** for MVR-only; paid orders fire from **`/api/employer/screenings/order`** after the bundle is complete; **central admin** manages installs + **`employer_block_audit`** trail |
| 4 | Road Test Certificate or CDL Equivalent | §391.31/33 | 🔲 **Upload needed** | File upload + metadata (examiner, date, vehicle, result) |
| 5 | Medical Examiner's Certificate | §391.43 | 🔲 **Upload needed** | File upload + metadata (examiner, registry ID, expiration) |
| 6 | Annual MVR Review | §391.25 | 🔲 **Build** | Re-order MVR annually + reviewer signature |
| 7 | Annual Certificate of Violations | §391.27 | 🔲 **Build** | Simple annual form (driver self-certifies) |
| 8 | SPE Certificate | §391.49 | 🔲 **Upload** | Conditional — only if driver has a waiver |
| 9 | Medical Variance Documentation | §391.41(b) | 🔲 **Upload** | Conditional — only if driver has exemption |
| 10 | ELDT Certificate | §380.503 | 🔲 **Upload** | Conditional — CDLs issued after Feb 2022 |

Items 1-3 (the hard ones) are done. Items 4-10 are document uploads and simple forms.

### Revenue model

| Service | Who pays | Price range |
|---------|----------|-------------|
| DQ file access (driver-owned data) | Carrier or agency | $50-100 per pull |
| Fresh MVR pull (facilitated) | Carrier or agency (or driver) | $30-50 |
| Employment verification (new outreach) | Carrier or agency | $25-50 per employer |
| Driver self-orders MVR | Driver | $20-40 |
| Annual DQ file renewal (fresh MVR + certs) | Driver or carrier | $30-50/year |
| Stormi AI credits | Driver | $1-5 packs |
| ~~STORM token rewards~~ → Storm Points | Platform (engagement) | **Foundation Reset (May 2026):** STORM ERC-20 dropped. Replaced with off-chain `users.storm_points` ledger if user-facing rewards return. See [`docs/midnight/DECISION_LOG.md`](midnight/DECISION_LOG.md) DEC-2026-05-005. |

### Long-term vision: Storm as the DQ file API

Once enough drivers have complete DQ files in Storm:
- Carriers/agencies hit Storm API to pull a driver's DQ file (with driver consent)
- Driver gets notification → approves access → carrier receives complete compliance package
- Fresh MVR can be facilitated on demand (Storm orders through Accio, result goes to carrier)
- Storm becomes the **Plaid of DQ files** — the infrastructure layer that connects verified driver data to hiring systems

### Competitive positioning

| What Storm IS | What Storm is NOT |
|---------------|-------------------|
| Portable DQ file builder | A job board competing with Indeed |
| Verification layer (MVR, employment, future CDLIS) | "Blockchain-verified resumes" (marketing that falls apart) |
| Staffing agency compliance tool | A LinkedIn clone with a feed |
| Resume generator with career card QR link | A career card that replaces resumes |
| Fill-once DOT app (TurboTax for DQ files) | A mass-apply automation tool |

### Pace Drivers as the wedge — open to the ecosystem

> Full reasoning, including the four operational pains and how selective-disclosure attestations address each, lives in [`docs/midnight/PARTNERS.md`](midnight/PARTNERS.md). Read that for the strategic context.

Pace is the **wedge, not the lock-in.** Pace is the initial customer and the design partner whose workflow shapes feature defaults. Other recruiting agencies and direct carriers come onto Storm's employer side using the same blocks (`employer-screening-consent`, `employer-mvr-orders`, `employer-psp-orders`). There is no Pace-specific code path, and there must never be one.

**Why Pace specifically benefits** (full version in [`PARTNERS.md`](midnight/PARTNERS.md)):

- **Re-screening drops to zero on repeat drivers.** Pace's pre-screen produces attestations once; every subsequent carrier accepts the same attestations. Per-placement screening cost trends to zero on repeat drivers; margin and throughput rise.
- **Placement timelines compress from weeks to days.** Carriers accept Pace's pre-screen attestations natively; the duplicative screening loop disappears.
- **Match quality up, 90-day attrition down.** Carriers publish requirements as attestation requests; mismatches surface before interviews are scheduled.
- **Communication gap closes without recruiter cost.** Stormi handles status updates; recruiters keep doing the high-value human work.
- **Pace's verified-driver pool compounds.** Every driver they place builds a permanent network asset Pace's competitors can't replicate.

**Why the ecosystem benefits at the same time:**

- **Driver portability.** Attestations belong to the driver, not the agency. A Pace-placed driver who later goes to a direct carrier doesn't re-screen.
- **No per-agency code paths.** `employer_hub_blocks` is company-scoped (per [`block-development.mdc`](../.cursor/rules/block-development.mdc)). Any agency or carrier installs the same blocks, gets the same capabilities.
- **Pricing is shaped by customer type, not by name.** Recruiting agencies, direct carriers, and large fleets each get appropriate pricing; Pace doesn't get favored economic status.

**The product principle that follows:** every employer-side feature must either strengthen Pace *and* the ecosystem, or it's the wrong feature. A feature that locks drivers to Pace, special-cases Pace in code, or assumes Pace is the only employer is an anti-pattern.

The original three-bullet wedge story still holds — Pace onboards drivers → drivers build DQ files → carriers trust Pace placements more → Pace closes faster → more drivers join. The Foundation Reset (above) makes the *carrier trust* step structural rather than reputational: carriers trust because the facts are verified, not because Pace says so.

### DOT app "fill once, use everywhere"

The DOT employment application's value is **portability**, not verification. A driver fills out the federal 3-form application once in Storm and uses it for every carrier. Storm already has:
- Full 3-form wizard (`DotApplicationFlow`) with all FMCSA-required fields
- Bidirectional profile ↔ form mappers (`dot-form-mapper.ts`)
- PDF export (`/api/driver-applications/[id]/export-pdf`)
- AI prefill from resume upload
- MVR data auto-fills accident/violation sections

**Next:** PDF export needs to match standard DOT form layout that carriers expect (not a Storm-branded document).

### Resume as distribution vehicle

The resume is NOT the product — it's the distribution mechanism for the career card.

- Storm generates a professional resume PDF from career card block data
- Every resume has a QR code + link to the full career card at the bottom
- Candidate uploads this resume to Indeed, ZipRecruiter, company ATSs — it works everywhere
- Employer opens resume, sees QR → lands on career card → sees verified DQ file
- For Storm-native employers (Pace), they skip the resume and go straight to the DQ file

Current state: `career-card-pdf.ts` generates a 2-page PDF (visual page + ATS text) with QR code. Needs rework to output a standard resume format instead of a "career card export."

---

## 🚧 Next Up — DQ File Completion (May–June 2026)

> **Coordination with Foundation Reset:** These are **product-feature** phases (DQ file content). The **Foundation Reset** above is **infrastructure** phases (Web2 stack, attestations). They run in parallel. DQ-File-Completion-Phase-1 (language cleanup) reinforces Foundation-Reset-Phase-1 (UI no longer says "blockchain-verified"). DQ-File-Completion-Phase-10 (IPFS PDF archival) is **superseded** by Foundation-Reset-Phase-2 (attestation-backed verification — see below).

| Track | Status | Notes |
|-------|--------|-------|
| **Phase 1 — Language cleanup** | 🔲 Todo | Remove "blockchain-verified" from self-reported data UI. Rebrand resume/DOT verification status labels. Update meta tags, homepage copy, Stormi prompts. **Aligns with Foundation Reset Phase 1.** |
| **Phase 2 — Document upload blocks** | 🔲 Todo | Medical cert, road test cert, ELDT cert, SPE cert, medical variance — each a small block with file upload + metadata fields. |
| **Phase 3 — Annual compliance forms** | 🔲 Todo | Annual certificate of violations (simple form). Annual MVR review trigger (re-order via Accio + reviewer field). |
| **Phase 4 — DOT app PDF format** | 🔲 Todo | Rework export to match standard DOT form layout carriers expect. |
| **Phase 5 — Resume PDF rework** | 🔲 Todo | Generate a real resume (not career card export) from block data, with QR code footer linking to career card. |
| **Phase 6 — Agency dashboard** | 🔲 Todo | Pace-specific view: multi-candidate compliance status, DQ file completeness per driver, share links for carriers. |
| **Phase 7 — CDL verification API** | 🔲 Future | Investigate Accio/SambaSafety CDLIS lookup. Turns self-reported CDL into confirmed CDL. |
| **Phase 8 — FMCSA Clearinghouse** | 🔲 Future | Requires employer credentials. Facilitate query through Pace's Clearinghouse account. |
| **Phase 9 — DQ file API** | 🔲 Future | External API for carriers to pull driver-owned DQ files with consent. The long-term product. **Will use `AttestationService` interface from Foundation Reset Phase 2 for all returned facts.** |
| **Phase 10 — IPFS / on-chain PDF archival** | ⛔ **Superseded** | Originally planned to upload finalized MVR + PSP PDFs to IPFS and anchor CIDs on-chain. **Foundation Reset (May 2026) supersedes this.** Phase 2 attestations deliver the same trust guarantee (third-party verifiable, tamper-proof) without IPFS or Pinata, and Phase 3 (deferred) replaces the signature with a Midnight ZK proof when customer demand justifies it. PDFs stay in Supabase Storage; verification happens via `attestationService.verifyAttestation()`. |

---

## ✅ Completed Work (reference)

### 🌉 **Storm Apply Bridge — career card for external jobs** (May 2026 — Done)

**Product principle:** The career card must travel with every application — even external ones. The bridge modal is the missing link between "I built a verified identity" and "I actually used it to apply."

| Track | Status | Notes |
|-------|--------|-------|
| **StormApplyBridge modal** | ✅ Done | `Modal panelShape="block"`; share URL copy, resume download, AI cover letter, screener answers, go-apply + record in one click. |
| **Screener answers lib** | ✅ Done | `deriveScreenerAnswers()` extracts name, email, phone, location, career card URL, occupation, years of experience, skills, CDL data from `ProjectedCareerCard`. |
| **Wire into panels** | ✅ Done | `SimpleJobDetailPanel`, `SimpleCardPanel`, `StormiChatPanel` all route external job applies through the bridge. |
| **Candidate status tracking** | ✅ Done | `candidate_status` column (waiting / interview / rejected / offer / no_response) + PATCH API + UI controls in My Applications. |
| **Stormi follow-ups** | ✅ Done | Daily cron nudges after 7 days; `application_follow_up` notification type; `update_application_status` Stormi chat tool. |
| **Phase 2 — Browser extension** | 🔲 Deferred | Collect `applications.redirect_url` data to identify top 5 destination ATSs, then build autofill extension. |

---

## 🎂 **Hub-as-Card — Workspace hub = the career card** (April 2026 — Done)

**Product principle:** The card is the cake; everything else is icing. Workspace is **self-driven** identity building (no job target), distinct from Guided Mode’s job-first flow. Users always see the live projected card and launch block pages from it; verifications reflect immediately from `/api/career-card` refetches.

| Track | Status | Notes |
|-------|--------|-------|
| **Phase 1 — Subtraction + inbox + account** | ✅ Done | Removed profile title card, insights strip, hub walkthrough on load, sticky `HubSidebar` from hub page (sidebar retained for `StormiJourneyGuide`), mobile FAB. `HubInboxSection` tabs: job alerts, employer requests, applications CTA. `HubAccountSection`: foldable STORM + USDC + referral. |
| **Phase 2 — Card as canvas** | ✅ Done | `HubWorkspaceCareerCard` + `useProjectedCareerCard`; block hive + DnD reorder UI removed (picker + card order remain). Edit profile → `showProfileSetup`; refresh icon refetches card. |
| **Phase 3 — Stormi right column** | ✅ Done | `lg:grid-cols-[1fr_22rem]`; sticky Ask Stormi aside; mobile stacks main column first. |
| **Phase 4 — Account in My Hub dropdown** | 🔲 Deferred | Plan optional — ship collapsible Account card first; revisit if still noisy. |

---

## 🛠️ **Construct on the card + mandatory STORM resume** (April 2026 — Done)

**Product principle:** The career card in Construct is the **workshop** — each section carries verify / delete / edit affordances (mini vault tile + actions) without a parallel “Block files” list. In Apply, the card reads as an **employer preview** except the **resume**, which stays editable in flow. `storm-resume` is **core** (always installed, never in the picker, first on the card). PDF download buttons are removed from candidate-facing previews; generation code remains for admin/fallback.

| Track | Status | Notes |
|-------|--------|-------|
| **Resume as core** | ✅ Done | Registry `coreBlock` / `hiddenFromBlockPicker`; hub store auto-install + non-removable; placeholder section when no DB row. |
| **ConstructSectionWrapper + `useHubDocuments`** | ✅ Done | Extracted former My Files fetch/verify/delete/modals; hub workspace card runs `mode='construct'`. |
| **Remove My Files hub section** | ✅ Done | `CandidateHub` slimmer column; prefs `hubBlockFilesExpanded` removed. |
| **Apply ↔ Construct transitions** | ✅ Done | `selfSectionNav`, `returnToApply`, `openPickerAfterHub`, `ReturnToApplyBanner`. |
| **PDF UI removal** | ✅ Done | Modals + `ResumeSection` + legacy `DriverHub` preview; optional `onDownload` on driver modal. |
| **Onboarding + initial mode fix** | ✅ Done | `fetchHubData` + `HubOnboardingForm` lifted to `CandidateShell` so both Apply and Construct modes get hub data + onboarding. |
| **Construct UX polish** | ✅ Done | Mobile tab bar hidden on desktop (CSS specificity fix); block removal via `removeBlock` in `ConstructSectionWrapper` (replaces artifact-level delete); persistent "Add block" dashed button at card bottom. |
| **Card pagination + reorder + Stormi** | ✅ Done | `config.cardPage` + `PATCH /api/hub/blocks/[id]/config`; per-page lens; `CareerCardDynamicSections` (Construct DnD + page breaks; Apply/employer/public flip + dots + swipe); `computeReorderSuggestion` in Apply Stormi strip. |

### 💡 Future: Paginated career card

Shipped baseline (above). Optional later: stronger 3D flip, per-job saved orders, analytics on which page employers read.

---

## 🚪 **Guided Everywhere — homepage v2 + single job-discovery surface** (April 2026 — Done)

**Product principle:** The homepage's job is to point at the product, not retell it. Once Guided Mode (`SimpleModeShell`) could handle a guest, there was no reason to keep two job-browsing surfaces — and a working product page that visitors can poke at converts better than any hero copy. Indeed-style lazy auth: browse free, sign in to act. See **`docs/CHANGES.md`** (Guided Everywhere — homepage v2, single job-discovery surface, lazy auth) for the full rationale.

| Track | Status | Notes |
|-------|--------|-------|
| **Homepage rewrite — 5 sections, ~500 lines** | ✅ Done | Hero / Build Mode / Stormi / The Hub / Employers + Bottom CTA. Order matches user behavior: Build Mode anchors (lazy users live there), Hub is the graduation path, employers come last. Tone discipline: positive case only, no competitor name-drops, no "not a chatbot" framing. Cut: second `VaultShowcase`, problem band, standalone job-search band, icon row, `ava` references, standalone token band. (Down from 1,142 lines.) |
| **Delete `JobListings.tsx`** | ✅ Done | Legacy 3-tab guest browser removed. Driver / Developer / Candidate shells now route `currentPage === 'jobs'` (or its equivalents) to `SimpleModeShell` instead. The `'jobs'` `PageType` string is retained for backward compatibility with notification deep-links and frozen legacy shells, but no route handler accepts it anymore. |
| **Indeed-style lazy auth in `SimpleModeShell`** | ✅ Done | Guests browse the blended job feed, open jobs, and read postings without signing in. `SimpleCardPanel` shows a `GuestStormiHint` + career card teaser ("Your career card lives here. Sign in to start building it block by block."). `SimpleJobDetailPanel` gates apply / save → "Sign in to apply"; fit-coverage UI hides for guests (no card to compute against). `StormiNextStepCard` doesn't render for guests; the static hint carries the role. |
| **Page-level guest routing** | ✅ Done | `page.tsx` introduces a transient `showGuidedMode` flag (Indeed-style). Navigation's guest "Browse jobs" button calls a new `onBrowseGuided` prop that flips the flag → `SimpleModeShell` renders directly with `walletAddress=null`. The flag auto-clears when a wallet connects, so authenticated users always follow the standard `useUIModeStore` flow. |
| **Future: track guest → sign-in conversion** | 🔲 Future | Once analytics are wired, log "guest opened job → guest hit apply gate → guest signed in" funnel to validate the lazy-auth thesis. |

---

## 🪞 **Career Card Lenses — one card, many framings** (April 2026 — Phases 1–4 Complete)

**Product principle:** Blocks are the truth, lenses are the rendering. A user can tailor how their career card is framed per job without maintaining duplicate resumes — update a block once, every lens refreshes. Stormi picks the right lens silently by default; advanced users get full control without ever being forced into a flow. See **`docs/CHANGES.md`** (Career Card Lenses — one card, many framings) for the full rationale.

| Phase | Status | Notes |
|-------|--------|-------|
| **P1 — Data + projection plumbing** | ✅ Done | Migrations `068_career_card_lenses.sql` + `068b_career_card_lens_drafts.sql`; `career-card-lenses.ts` server helpers (ensure/list/get, soft-6/hard-10 caps, `applyLensOrderAndFilter`); `buildProjectedCareerCard(lensId)` filters + reorders + overrides summary; `/api/career-card/lenses` full CRUD; `/api/career-card` + `/api/career-card/pdf` accept `?lens=` |
| **P2 — Store + subtle chip + manage modal** | ✅ Done | `career-card-lenses-store`; `activeLensId` / `lastAutoPickedLensId` / `overrideAutoPick` on `simple-mode-store`; subtle `{lens} · switch` chip on `ProjectedCareerCard`; `LensPickerPopover`; `LensManageModal` (rename / delete+undo / create blank / share link) with soft 6 / hard 10 caps |
| **P3 — Stormi picks + drafts lenses** | ✅ Done | `pickBestLens` in `job-fit.ts` (per-lens `computeJobFit`, margin-aware); `SimpleCardPanel` silent auto-switch + "Switched · undo" chip; `StormiNextStepCard` secondary "Let Stormi tailor" / primary "tailor for this role" branches; `/api/ai/draft-lens` (Haiku + `career_card_lens_drafts` cache per user/job) |
| **P4 — Apply snapshot + public share + employer view** | ✅ Done | Migration `069_application_lens_snapshot.sql` (`lens_id_snapshot`, `lens_name_snapshot`); `/api/applications/submit` validates lens + nulls out block-specific fields the lens hides; `ApplyWithStormChainModal` fetches with `?lens=` and submits with `lensId` + guardrail comment; `use-selected-job-sync` mirrors `?lens=` only on user override; employer `ApplicantsPage` shows read-only `"{lens} framing"` badge |
| **Pattern-detection lens creation** | 🔲 Future | Ambient "you've viewed 5 logistics jobs — saved a lens" signal (Phase 3+) |
| **Industry lens templates** | 🔲 Future | Out of scope until usage justifies |

---

## 🧭 **Simple Mode — job-first guided experience** (April 2026 — Phases 0–6 Complete)

**Product principle:** Two chromes over one engine. "Guided" (Simple) is job-first onboarding for the 80% who want a quick win; "Workspace" (Hub) is the feature-dense view for returning power users. Both render over the same stores and primitives — no forked state, no parallel features. See **`docs/CHANGES.md`** (Simple Mode — job-first guided experience) for the full change log.

| Phase | Status | Notes |
|-------|--------|-------|
| **P0 — Foundation** | ✅ Done | `useUIModeStore` + persist; migration `067_ui_mode_preference`; `isSimpleModeEnabled()`; `ModeToggle`; `CandidateShell` branching |
| **P1 — SimpleModeShell layout** | ✅ Done | `SimpleModeShell` grid, `simple-mode-store`, `useJobSearch` extracted, `useSelectedJobSync` (`?selected=…`), rail / detail / card / sliver / sheet |
| **P2 — Contextual card** | ✅ Done | `computeJobFit` (deterministic %); `ProjectedCareerCard` `ghostSections` + `recentlyInstalledBlockIds`; `animate-card-settle` / `ghost-pulse` keyframes |
| **P3 — Stormi co-pilot** | ✅ Done | `buildCandidateSimpleModeSystemPrompt` tone bands; `suggest_alternate_jobs` tool; per-job thread persistence; `adzuna-smart-defaults` |
| **P4 — LLM-extracted fit scoring** | ✅ Done | `/api/ai/extract-job-requirements` (Haiku + cache); migration `062_external_job_requirements`; `useExtractedRequirements`; `ExternalRequirement` integrated into `computeJobFit` |
| **P5 — Adzuna taming** | ✅ Done | Filter chips (salary floor / job type / remote) in `simple-mode-store`; server cap `MAX_RESULTS_PER_PAGE=30`; `salary_min` + `job_type` passthrough; first-run empty state w/ trending shortcuts |
| **P6 — Graduation + polish** | ✅ Done | Graduation banner (≥3 blocks); `showStormiWalkthrough` gated on `!isSimpleModeEnabled()`; `ModeToggle` flips chrome without navigation |
| **P7 — Stormi-led UX + chrome consistency** | ✅ Done | `StormiNextStepCard` (proactive "do this next"); reworked `SimpleCardPanel` (Stormi top / card middle / collapsed chat bottom); all Simple Mode surfaces now on `HubSectionPanel + BlockCard variant='embed'`; `ui-components.mdc` "In-App Panels" rule promoted to top-level |
| **Split layout polish + right-col overhaul** | ✅ Done | Stormi → compact inline strip; career card rendered directly (no wrapper); right column widened; rail denser; job detail readable type + `max-w-[72ch]` (`CHANGES.md` — Guided mode right-column overhaul) |
| **Remove chat from Guided Mode** | ✅ Done | Stormi chat (collapsed bar + drawer + `StormiChatPanel`) removed entirely from `SimpleCardPanel`. `StormiNextStepCard` branches now route to Workspace for deeper help instead of opening a chat. Clear separation: Guided = coach-driven, Workspace = self-directed |
| **Mobile animated tab bar** | ✅ Done | `<md`: `MobileTabBar` (Jobs/Job/Card) with pop-up active item + SVG notch border + `env(safe-area-inset-bottom)`. Supersedes tabbed sheet approach (Safari URL bar conflicts). Sliver/sheet retained for iPad portrait only (`md–lg`). (`CHANGES.md` — animated tab bar) |
| **Homepage split-view demo** | 🔲 Next | Static preview of Guided mode on the unauthenticated landing page — own design pass |
| **Score telemetry** | 🔲 Future | Track fit-score → apply-conversion to tune the `matched / missing` vocabulary |

## ⚡ **Moat acceleration plan** (April 2026)

| Track | Status | Notes |
|-------|--------|-------|
| **P1 — AI resume parse → blocks** | ✅ Done | `/api/ai/parse-resume`, `saveExtractedResumeData`, upload flow + Stormi bridge message on apply |
| **P2 — Real verify + card trust UI** | ✅ Done | `verify-resume` on-chain; projected + legacy card tx links; strength meter + verification strip; tier badges |
| **P3 — Career card views + insights** | ✅ Done | `career_card_views` + employer log; hub insights strip; `HubContext` engagement fields for Stormi |
| **P4 — Stormi nudges + auto-welcome** | ✅ Done | `StormiNudgeBanner`; candidate auto-welcome in `StormiChatPanel`; richer hub context (visits, incomplete blocks, verified counts) |
| **Career card — itemized verification strips** | ✅ Done | `ProjectedCareerCard` data adds **`onChainCredentials`** + **`employerConfirmations`** (`career-card.ts`, `buildProjectedCareerCard`); UI lists each on-chain credential with **Base Sepolia** link + date, each employer confirmation with company / role / claimed range + **Confirmed** date; **Show all** when more than three rows. See **`docs/CHANGES.md`** (Moat acceleration). |

## **Composable Career Card — platform surfaces** (April 2026)

| Track | Status | Notes |
|-------|--------|-------|
| **P1 — Dynamic OG + metadata** | ✅ Done | `/card/[token]/opengraph-image`, `layout.tsx` `generateMetadata`, `loadCareerCardByShareToken` (no view bump) |
| **P2a — Career Card PDF** | ✅ Done | `/api/career-card/pdf`, `career-card-pdf.ts`, QR + ATS page |
| **P2b — Embed + oEmbed** | ✅ Done | `/card/[token]/embed`, `CareerCardEmbed`, `/api/oembed`, CSP `frame-ancestors *` |
| **P2c — Social image (1200²)** | ✅ Done | `/card/[token]/social-image` |
| **P3a — Email signature PNG** | ✅ Done | `/card/[token]/signature` |
| **P3b — README badge SVG** | ✅ Done | `/card/[token]/badge` |
| **Share modal shell** | ✅ Done | `CareerCardShareModal` + `Modal` `panelShape="block"` use the same **block-picker** card chrome (`rounded-xl border`, `bg-gray-800/40` / white); overflow uses **`.scrollbar-none`** in `globals.css` (scroll works, no bar). |
| **Hub profile share CTA** | ✅ Done | `CandidateHub` `CareerCardMiniPreview`: **View card** + **Share** split row (same idea as sidebar `MiniCareerCard`). |
| **P4 — Chrome extension** | 🔲 Future | `docs/CAREER_CARD_PLATFORM_INJECTION.md` — separate repo / Web Store |

## 🧭 **Candidate hub — refresh & navigation** (March 2026)

| Item | Status | Notes |
|------|--------|-------|
| **Unified LoadingScreen** | ✅ Done | Teal/violet orbits, storm icon, full-page + compact modes; replaces teal splash + generic spinner |
| Obvious **Refresh hub** control | ✅ Done | **Inside** `HubProfileHeader` vault: **centered** **`primary`** **Refresh hub** + short helper line (`border-t` strip); re-fetches hub + `refreshKey` for **My Files** |
| **Collapsible hub sections** | ✅ Done | **Your blocks** + **Block files** (chevron in `BlockCard` header when relevant); state in persisted **`usePreferencesStore`** — **Stormi** not collapsible |
| Browser / OS **back** vs shell | ✅ Done | `useCandidateShellHistory` + `navigateToHub()` — cannot remove system back UI; history is synced so back returns to hub when possible |
| Nav **hub row spacing** | ✅ Done | Container widened `max-w-2xl` → `max-w-4xl` in `VaultHorizontalVaultShell`; hub row changed from CSS grid to `flex flex-wrap` — all 5 controls on one row at 1024px+, graceful wrap below |
| Nav **horizontal vault bar** | ✅ Done | `NavVaultShell` → shared [`VaultHorizontalVaultShell`](src/components/ui/VaultHorizontalVaultShell.tsx) (`layout='nav'`) + `VAULT_CLIP_HORIZONTAL`: rim, frost/tile texture, conic/sheen/strip (same family as wordmark + hub); clip on **decorative layer only** so hub dropdown isn’t cut off; removed `.nav-shell-shape` breathe keyframes |
| Hub **profile header** vault | ✅ Done | `HubProfileHeader` uses **`VaultHorizontalVaultShell` `layout='panel'`** (full width, `VaultLightFrostTexture` tile variant) instead of **`Card` elevated** — matches nav vault language |
| Hub **Job alerts / Referral / Employer requests / STORM** panels | ✅ Done | Same **vault shell + `BlockCard` embed** as My Files; distinct **`accent`** presets (**sky / violet / indigo / amber**) in `vault-accent-presets.ts` |
| **Career card** vault shell | ✅ Done | `ProjectedCareerCard` + `CareerCard` wrapped in **`VaultHorizontalVaultShell`** (nav width vs full modal width); hero / ambient blob / inset panels unchanged |
| **Stormi hub welcome (AI + wallet opt-out)** | ✅ Done | `users.stormi_walkthrough_dismissed_at` + GET/PATCH hub/profile; walkthrough every hub load unless opted out; **Journey Tips** (candidates) toggles DB flag; driver/dev still use `preferences-store` for `JourneyModal` (`CHANGES.md`) |
| Hub **Your blocks** panel | ✅ Done | **`BlockCard`** (+ **`headerActions`**) wraps hive — same shell as block pages; **dashed `EmptyVaultSlot`** for unused grid cells |
| **Light mode readability** (canvas vs cards) | ✅ Done | Cooler light **body** gradient; **solid white** `Card` / hub rails / hex faces with **slate** borders + neutral shadows; less teal-on-white glow; nav chips aligned (`globals.css`, `Card`, `HubSidebar`, `CandidateHub` hive, `navigation-styles`) |
| **Theme hydration** | ✅ Done | `ThemeProvider` no longer reads `localStorage` in `useState` initializer — SSR + first paint stay `light`, then `useEffect` applies saved theme; fixes `LoadingScreen` / `useTheme` mismatch when default is dark |
| **Light background mood** | ✅ Done | `StormBackground`: **bubbles** + atmosphere + **vault canvas** (`VaultLightFrostTexture` canvas / `VaultDarkCanvasTexture`); dark **no** cloud/rain/lightning — same bubble language as light |
| **Light canvas polish** | ✅ Done | **`--storm-accent`** + **`--storm-accent-rgb`**; **layered `body`** (specular gloss + blooms); **`.storm-light-panel`** = LoadingScreen card DNA; full-page **vault frost** via `StormBackground`; nav / hub / resume scrollbar **unified teal**; **Card** elevated glossy light |
| **Block Hive tiles** | ✅ Done | Unified **light** chrome (slate ring, inner gradient, specular line); **slate** titles + colored accent bar; larger type; **Coming soon** state; tooltips; hover shadow stack (`CandidateHub` `BlockTile`) |
| **Hub block tiles (“vault”)** | ✅ Done | Chamfered credential silhouette, gradient rim, twin-ring sigil, foot strip — CSS grid layout (center + ring); shared with `HomePage` `VaultShowcase` (`HubBlockVault.tsx`) |
| **Dark UI = LoadingScreen DNA** | ✅ Done | **`--storm-*` CSS vars**, body blooms, **`.storm-glass-panel`**, nav/scroll/cards/`StormBackground`/`StormTokenMark`/hive hex aligned to loader aesthetic |
| **Appearances** (`light`, `paper`, `dark`, `ink`) | ✅ Done | **Icy light**, **`paper`** (newsprint zinc), **`dark`** (Galactic void — teal/violet), **`ink`** (Quiet ink — monochrome dark). Schema v4 adds `ink`; v3 drops `sepia` / `business` → `light`; **`ThemePicker`** four options; `toggleTheme` restores last light (`light`/`paper`) and last dark (`dark`/`ink`) |
| **Brand lockup + favicon** | ✅ Done | **`StormChainWordmark`** in **nav + whitepaper + homepage** (`size="display"` larger than whitepaper `hero`); **`favicon.svg`** (rings + lightning) |

## 💼 **Stormi hiring tools + saved jobs** (March 2026)

**Product principle:** **Anyone** can build a Career Card and use prep — no gate. **Focus** (features, copy, Stormi’s default guidance) stays on **hiring + early-career / new-role signal** (verified card, search, apply, prep). We do **not** position as a “grow in your current job” platform or full-life career OS — narrow emphasis, not exclusion of builders who are not searching yet.

| Item | Status | Notes |
|------|--------|-------|
| In-chat **interview prep** (MCQ + feedback) | ✅ Done | For **new-role** interviews; ethical practice only; `/api/ai/interview-prep-quiz`; `interviewPrep` on `ChatMessage` |
| **JD talking points** modal | ✅ Done | Application / new-role framing; `/api/ai/job-talking-points`; cover-letter usage pool |
| **Saved jobs** tab + star (list + reco) | ✅ Done | `useSavedJobsStore` persist; `JobListings` Saved tab; hub links to jobs + Stormi panel |
| **Hunt Desk** (shortlist mini-app) | ✅ Done | `hunt-desk` page: 3-lane drag staging + links; same store as stars; premium Stormi row TBD |
| **Applications hub** first-class | 🔲 Next | Polish `MyApplications` + shell story (APIs exist) |
| Follow-up draft assist | 🔲 Future | User-edited drafts only |
| Match “why” everywhere | 🔲 Partial | Reco already has `matchReason`; extend if score shown elsewhere |
| General “current job” coaching | ⛔ Not planned | Keeps brand sharp vs hiring competitors |

## 🏢 **Employer Side Simplification** (March 2026 — Phase 1 Done)

| Feature | Status | Description |
|---------|--------|-------------|
| Scope decision doc | ✅ Done | `docs/EMPLOYER_PLAN.md` |
| Employer cursor rule | ✅ Done | `.cursor/rules/employer-architecture.mdc` |
| Migration 053 | ✅ Done | `applications.status` → submitted / contacted / archived |
| Pipeline → 3 columns | ✅ Done | Kanban, hub, APIs, My Applications, admin tab, Applicants page |
| Remove FindDriversPage | ✅ Done | Shell + types; `TalentSearchPage` + `blockTypes` API filter |
| Remove ReportsPage | ✅ Done | Reports + analytics API + components removed |
| Remove dead code | ✅ Done | `ApplicationInvites.tsx`, driver-data, applications export routes (invites API kept for CandidateOutreach) |
| Remove EmployerVerificationSection | ✅ Done | Removed from `EmployerHub` |
| Talent Search: registry filters | ✅ Done | Category + `getBlocksByCategory` checkboxes → `blockTypes` param |
| Polish job posting flow | 🔲 Todo | UX pass |
| Subscription system | 🔲 Todo | Free tier limits + Pro USDC |
| Stormi for employers | ✅ Done | Shared `StormiChatPanel` on employer hub; `buildEmployerStormiSystemPrompt` + `employerContext`; `/api/ai/chat` `audience: employer` + role gate |
| Sponsored job posts | 🔲 Future | Visibility boost |
| Candidate match scoring | 🔲 Future | AvA + blocks |
| **Career Card Easy Apply + AvA chat memory** | **✅ Done** | **External job apply uses `/api/career-card` (not driver profile); submit snapshot includes `installed_block_types` + profile fields; server-side eligibility before job row insert. AvA `/api/ai/chat` accepts `conversationHistory` (multi-turn).** |
| **Phase 2 — AI cover letter + job recommendations** | **✅ Done** | **`POST /api/ai/cover-letter` (3 free/day + credits). `GET /api/jobs/recommended` (1 free AI/day + cache; `force=1` = 1 credit). Migration `061_ava_job_ai_usage.sql`. External jobs tab UI + shared `adzuna-server`.** |
| **Phase 3 — AI job alerts** | **✅ Done** | **Hub saved searches + daily cron `/api/cron/job-alerts` + in-app notifications. Plus candidate AvA chat tools: `search_ranked_jobs` + `save_job_alert`; chat UI shows ranked job cards → new-tab listing + Apply with Career Card modal.** |
| **Public guest job browse + homepage (AvA pitch)** | **✅ Done** | **Unauthenticated users: nav Home / Browse jobs; `JobListings` `publicBrowseMode` (Storm employers tab + external search, connect CTA for apply). HomePage hero + AvA bento + pre-wallet job search band.** |

## 💬 **AvA Chat Monetization** (March 2026 — Complete)

| Feature | Status | Description |
|---------|--------|-------------|
| `ava_chat_usage` table | ✅ Done | Per-user daily free counter + purchased credits. Self-resetting on first request of each new day |
| Daily free tier (10/day) | ✅ Done | 10 messages/day per wallet, powered by Sonnet 4.6 |
| Paid credits (Haiku 4.5) | ✅ Done | After daily limit, use purchased credits. Model switches to Haiku 4.5 (25x cheaper) |
| USDC credit packs | ✅ Done | Starter ($1/50msg), Standard ($3/200msg), Pro ($5/500msg) via Base Sepolia USDC |
| Auth gate | ✅ Done | `x-wallet-address` required on all chat requests — no anonymous abuse |
| Usage badge in UI | ✅ Done | "7/10 free today" or "200 credits" badge in AvA chat header |
| Out-of-credits UX | ✅ Done | Inline refill prompt + disabled input when daily limit hit and no credits |
| StormiCreditModal | ✅ Done | USDC payment modal (same pattern as MvrPaymentButton) |
| Dynamic career lanes | ✅ Done | System prompt auto-derives lane boundaries from block registry — scales to any future career category |
| Content guardrails | ✅ Done | No medical/legal/financial advice; all other topics allowed |
| Context-advantage pitch | ✅ Done | Welcome copy emphasizes "AvA already knows your career" vs generic AI |
| Credits API | ✅ Done | GET /api/ai/credits (usage), POST /api/ai/credits (purchase with txHash) |

## 🛡️ **Referral Anti-Sybil Hardening** (March 2026 — Complete)

| Feature | Status | Description |
|---------|--------|-------------|
| Internal-only claim endpoint | ✅ Done | `/api/referrals/claim` protected by `INTERNAL_API_SECRET` header — external callers get 403 |
| DB-resolved wallets | ✅ Done | Wallet addresses always looked up from `users` table, never trusted from request body |
| Atomic claim transitions | ✅ Done | Update-where on `status = 'signed_up'` prevents race condition double payouts |
| Self-referral DB constraint | ✅ Done | `CHECK (referrer_id != referred_user_id)` in migration 050 |
| One-referral-per-user constraint | ✅ Done | `UNIQUE (referred_user_id)` prevents double-dipping |
| Same-wallet guard | ✅ Done | Blocks payouts when two user IDs share the same wallet address |
| Per-user referral cap | ✅ Done | Max 500 completed referrals per user, returns 429 when exceeded |
| Rollback on failure | ✅ Done | Distribution failures revert status to `signed_up` for retry |
| Whitepaper referral section | ✅ Done | `StormChainView.tsx` — dedicated Referral Program section with how-it-works and protections |
| Standalone whitepaper rewrite | ✅ Done | `STORMCHAIN_WHITEPAPER.md` — full rewrite for 50M supply, referral program, smart contract architecture |

## ⛈️ **50M Tokenomics + Referral System** (March 2026 — Complete)

| Feature | Status | Description |
|---------|--------|-------------|
| 50M Token Supply | ✅ Done | StormToken.sol updated from 15M to 50M fixed supply |
| TreasuryDistributor contract | ✅ Done | New smart contract for treasury distributions (referrals, community) |
| Deploy script rewrite | ✅ Done | 5-contract deploy: Token, RewardDist (25M), TreasuryDist (15M), 2x Vesting (1.5M each), DEX (5M) |
| Backend contract layer | ✅ Done | storm-contract.ts + storm-rewards.ts updated for 50M/25M/15M pools |
| Referral system DB | ✅ Done | Migration 050: referrals table with code, status, RLS |
| Referral API | ✅ Done | GET /api/referrals (code + stats), POST /api/referrals/claim (treasury payout) |
| Referral signup hook | ✅ Done | ?ref=CODE captured in page.tsx → auth store → set-role links referral |
| Referral reward trigger | ✅ Done | First paid action by referred user triggers 2.5 + 2.5 STORM from treasury |
| ReferralBanner | ✅ Done | Hub component with copy link + stats |
| Employer outreach cleanup | ✅ Done | Removed "General Onboarding" — employer outreach is block-specific only |
| AvA referral intelligence | ✅ Done | System prompt updated with referral knowledge and contextual prompts |
| Journey referral step | ✅ Done | Optional "Share Referral Link" step after first block installed |
| StormChainView UI | ✅ Done | All distribution bars, table, stat cards, decay curve updated for 50M |
| TOKEN_STRATEGY.md | ✅ Done | Full rewrite for 50M supply, referral program, TreasuryDistributor |

## 🧱 **Composable Hub Refactor** (March 2026 — In Progress)

The platform is transitioning from role-specific hubs (DriverHub, DeveloperHub)
to a single composable candidate hub. Candidates start with an empty hub and
build it by adding blocks. Role selection simplified to `candidate` vs `employer`.
The career card becomes a pure read-only projection of the hub.

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 — Foundation | ✅ Done | Migration 035, block registry, hub-blocks-store, types |
| Phase 2 — API routes | ✅ Done | CRUD for hub_blocks + hub_onboarding endpoints |
| Phase 3 — Onboarding form | ✅ Done | Mandatory "who you are" context form + AvA integration |
| Phase 4 — Block picker modal | ✅ Done | Categorized catalog with click-to-add (drag deferred to 4b) |
| Phase 5 — CandidateShell | ✅ Done | Replaces DriverShell + DeveloperShell, renders blocks |
| Phase 6 — Port existing blocks | ✅ Done | Block cards clickable → navigate to existing components |
| Hub profile layout | ✅ Done | Profile header, quick stats, career card CTA, STORM footer |
| Phase 7 — Career card projection | ✅ Done | Career card rebuilt as a read-only renderer over hub blocks |
| Phase 8 — Role selection update | ✅ Done | Simplify modal to candidate vs employer |
| iPhone Home Screen Hub | ✅ Done | 2-col tile grid with jiggle-mode editing, long-press, status badges |
| Premium Glass Tiles | ✅ Done | Glassmorphic tiles with per-block colors, illustrations, Atropos 3D tilt |
| Hub layout pass | ✅ Done | Career Card banner + on-chain verification bar, removed old stats |
| Hub career / job path | ✅ Done | Single **vault** rail (no outer rounded shell): `PathGuidance` + `CareerPathSteps` + explore / mini cards; candidate `HubSidebar` + employer `EmployerPathSidebar`; `useEmployerHiringPathStore`; Stormi drawer role-aware; mobile FABs |
| Outreach auto-install + deep-link | ✅ Done | Fixed `?onboard=` deep-link mismatch; talent requests auto-install `targetBlockType` + `actionUrl` on notification; recruit creates in-app notification; `REQUEST_BLOCK_MAP`; new architecture rule §12 |
| Employer Composable Hub Phase 1 | ✅ Done | Hybrid employer hub: permanent core + composable industry blocks, generic company setup |
| Employer Composable Hub Phase 2 | ✅ Done | Role-agnostic polish: data-driven driver detection, 3-tier role badges, block-conditional quick actions, legacy cleanup |
| Employer Composable Hub Phase 3 — Full Gating | ✅ Done | ALL candidate outreach gated behind employer blocks (`requiredEmployerBlocks` on `BlockDefinition`). True 1:1 mapping: `employer-portfolio-requests` → Portfolio, `employer-dot-screening` → DOT App, `employer-mvr-orders` → MVR, `employer-psp-mvr-bundle` → PSP + MVR. Resume removed from outreach (core block, always installed). Invite flow creates `candidate_requests` for screening blocks so FCRA disclosure fires. Migrations `076`–`077`. **Employer-initiated MVR** renders disclosure inline + auto-submits Accio after signing. **Employer PSP+MVR bundle** is a **three-step** flow (FCRA → FMCSA → CDLIS written consent + vendor SSN) before `POST /api/candidate/fulfill-screening`; CDLIS answers merge into `psp_consents.form_data` via `PATCH /api/psp/consent/:consentId` (see `docs/employer-screenings/cdlis-written-consent.md`). |
| Generic Block-Based Outreach | ✅ Done | Outreach reworked from hardcoded invite types to block-aware system with deep-linking |
| **Employer outreach kanban + notes + vault split** | **✅ Done** | **`recruiter_notes` on `application_invites`; Active tab = 4-column kanban by real invite status (`pending`/`viewed`/`in_progress`/`completed`); stale completed (14d, `updatedAt`) + cancelled/expired → **Archive** tab; compact cards + modal detail; Files vault = Completed vs Processing. Migration `084` (`recruiter_status` retained for API compat).** |
| **Screening rescue: DL-name guard + kanban attention** | **✅ Done** | **Prevention:** `validateScreeningOrderInput` + new `checkDlNumberIsNotName` reject DL numbers that match the candidate's name (server + client-side guards in `BackgroundCheckDisclosure` + `PspDisclosureForm`) — closes the "Isaiah Martin" failure where Accio silently accepts garbage and the order hangs forever. **Rescue:** new pure module [`outreach-attention.ts`](../src/lib/outreach-attention.ts) derives a "needs attention" signal from the existing `mvr_orders` / `psp_orders` rows (kinds: `order_failed`, `order_error`, `dl_looks_like_name`, `stuck_pending`). Kanban tile gets a red dot/ring + tooltip; flagged cards float to the top of their column; detail modal shows a Stormi-violet reason panel and a one-click **Resend consent** primary button that mints a fresh invite (same target block, same candidate, rescue welcome message) and auto-emails. `/api/employer/screenings` now also returns `dl_number`, `error_code`, `error_message`, `processed_at`. |
| Role-Agnostic Hub Refactor | ✅ Done | Unified `user_profiles` table, stripped all driver/dev assumptions from permanent hub UI, block-conditional data enrichment API |
| AI-Gated Employer Access | ✅ Done | AvA evaluates employer signup requests in real-time: auto-approve, flag for review, or block. Renamed MotorCarrierOnboarding → CompanyOnboarding. Fixed driver_profiles → user_profiles in team invite. |
| Admin Dashboard Audit Refactor | ✅ Done | Split ~4000-line monolith into ~20 focused components (shell + 15 tabs + 3 modals). Updated sidebar labels ("Driver Blocks" / "Developer Blocks"), role badges, resume labels, column headers. Added `user_profiles` to admin users & resumes APIs. |
| Employer Onboarding Rework | ✅ Done | AI-powered company name matching, domain-verified auto-join, first/last name collection, removed hiring categories. Pending review UI shows specific reasons. **May 2026:** access-request uses **role radio presets** (no vague textarea); auto-approved companies set **`onboarding_completed: true`** so users are not sent to a second duplicate form; **`POST /api/employer/company`** runs the **same Stormi eval** as access-request (block / flag / fuzzy match + domain join) before any company row is created. |
| Central Admin Full Audit | ✅ Done | Fixed: silent audit insert failures (migration timing), admin wallet delete guard (now allows force-delete), 9 admin APIs updated to use `user_profiles` as primary name source, `devProfile.full_name` → computed from first/last/display_name. |
| **Unified Identity Migration** | **✅ Done** | **~30 files migrated across 6 phases. All identity reads (name, avatar, email, phone, location) now exclusively use `user_profiles`. Role-specific tables retain only role data (CDL, GitHub, skills, etc.). Write paths stripped of identity. Avatar uploads write to `user_profiles`. Zero remaining role-table identity reads in codebase.** |
| **Full Database Audit & Cleanup** | **✅ Done** | **Audited all 32+ tables via Supabase MCP. Dropped 1 dead table (`t_prefill_cache`), 2 dead views, 20+ dead identity columns from `users`/`driver_profiles`/`developer_profiles`/`companies`, 2 redundant indexes. Rewrote `career_cards` view for `user_profiles`. Enabled RLS on 4 unprotected tables. Dropped `users.name` (data migrated to `user_profiles.display_name`). Moved `date_of_birth` to `user_profiles`. Created retroactive `storm_distributions` migration. Updated ~30 code files.** |
| **Block-Owned Data — Phase 1** | **✅ Done** | **Created 10 block-owned data tables (migration 046) with backfill from `driver_profiles`/`developer_profiles`. Built `src/lib/block-data.ts` typed access layer with per-table read/write functions and composite cross-block readers. Added dual-write to `/api/driver/profile` PUT. Documented table ownership in `BlockDefinition.dataTables` and `.cursor/rules/block-development.mdc`.** |
| **Block-Owned Data — Phase 2** | **✅ Done** | **Switched ALL reads (~40 API routes) from `driver_profiles`/`developer_profiles` to block tables. Created migration 047 (`block_dev_profile` for orphaned dev columns). Added dual-writes to MVR webhook, developer profile PUT, GitHub callback, dev quick-setup. Standardized share data on `users` table.** |
| **Block-Owned Data — Phase 3** | **✅ Done** | **Switched ALL writes (~20 API routes) to block tables. Migration 048: rewrote `career_cards` view + `search_talent()`, dropped FK constraints, removed trigger. Fixed share token bug (writes to `users`). Fixed identity prefill (merges from `user_profiles`). Removed dual-write sync functions.** |
| **Block-Owned Data — Phase 4** | **✅ Done** | **Migration 049: dropped `driver_profiles` and `developer_profiles` tables. Removed dead code (`DriverProfileRow`, `rowToProfile`, `profileToRow`). Cleaned ~20 stale comments. Updated cursor rule. Complete — no legacy profile tables remain.** |
| **general-resume block** | **✅ Done** | **Universal professional resume (`source_role: general`) for non-driver/non-dev candidates — Indeed-style hub block with builder, My Files, on-chain verify, career card section, employer Request Resume, outreach `?onboard=general-resume`, journey step. Replaces `general-skills` / `general-work-history`. Migration `060_hub_blocks_general_resume.sql`.** |

---

## 🏗️ **Architecture Refactor — All 5 Phases Complete** (February 2026)

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Done | State stabilization — single source of truth via Zustand |
| Phase 2 | ✅ Done | Break up monolith — `page.tsx` from 3,032 → ~310 lines |
| Phase 3 | ✅ Done | Shared UI primitives (`Button`, `Card`, `cn()`) |
| Phase 4 | ✅ Done | Component-level data refresh (no full page reload needed) |
| Phase 5 | ✅ Done | Error boundaries around all role shells |

**Next priorities:** Expand `Button`/`Card` usage across all existing components to eliminate repetitive inline Tailwind. Add `SWR` or React Query for auto-revalidation of hub data.

---

## 🏢 **Motor Carrier Employer Onboarding** (March 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| MotorCarrierOnboarding component | ✅ Done | Blocking full-screen form for new company owners |
| `POST /api/employer/company` route | ✅ Done | Creates company + owner membership, sets `onboarding_completed = true` |
| EmployerShell gate | ✅ Done | Routes to `MotorCarrierOnboarding` when `currentPage === 'company-setup'` |
| Hub API `onboarding_completed` | ✅ Done | Hub now returns `onboardingCompleted` in company payload |
| EmployerHub gate checks | ✅ Done | Two cases: no company OR incomplete onboarding (owner only) → redirect to setup |

**Next priorities for employer flow:**
- Auto-populate `employingCarrier` in driver DOT apps when employer sends invite or views a submitted application
- Allow owner to edit Motor Carrier profile from the hub settings

---

## 🤖 **AvA Journey Guide** (February 2026)

**Evolution:** Replaced the old chat-based TAssistant with a visual progress tracker. AvA is now a journey guide, not a chatbot.

| Feature | Status | Description |
|---------|--------|-------------|
| Progress Calculator | ✅ Done | Consolidated progress calculation for all 3 roles (`journey-progress.ts`) |
| Journey Store | ✅ Done | Guide state management with localStorage persistence |
| Floating Button | ✅ Done | Bottom-right summon button with progress badge and pulse animation |
| Journey Guide Panel | ✅ Done | Sliding panel with progress bar, step checklist, next actions |
| Keyboard Shortcuts | ✅ Done | Press `?` or `Cmd+/` to open guide |
| Auto-Welcome | ✅ Done | Auto-opens on first login for new users |
| Nav Help Button | ✅ Done | "AvA Journey Guide" option in hub dropdown |
| TAssistant Removal | ✅ Done | Deleted old chat sidebar (1978 lines) |

**Role-Specific Journeys:**

- **Driver:** Wallet → Resume → DOT App → Profile (80%+) → MVR → Apply to Jobs
- **Employer:** Wallet → Company Profile → Post Job → Review Applicants → Verifications
- **Developer:** Wallet → Add Projects → Build Resume → Connect GitHub → Career Score → Apply

**Future enhancements:**
- Database sync for preferences (cross-device consistency)
- Animated progress celebrations
- Role-specific AvA character variants
- Analytics on journey completion rates

---

## 🚀 **Two-Sided Marketplace: Driver & Employer Platform** (November 20, 2025)

### Architecture Overview

Storm is architected as a **two-sided marketplace** connecting drivers with employers. The platform has distinct experiences for each user type:

```
┌─────────────────────────────────────────────────────────┐
│                  STORMCHAIN PLATFORM                    │
├──────────────────────┬──────────────────────────────────┤
│   DRIVER SIDE        │      EMPLOYER SIDE               │
├──────────────────────┼──────────────────────────────────┤
│ • Resume Upload      │ • Company Profile                │
│ • DOT Applications   │ • Job Postings                   │
│ • DQ File Building   │ • Applicant Review               │
│ • Job Search         │ • Credential Verification        │
│ • AvA Assistant      │ • Hiring Pipeline                │
│ • Application Track  │ • Talent Search                  │
└──────────────────────┴──────────────────────────────────┘
```

### Current Implementation Status

#### ✅ **Phase 1: Foundation (COMPLETE)**

**Role Selection & Routing:**

- Role selection modal on first login (driver/employer choice)
- Database schema with `role` column and `companies`, `job_postings`, `applications` tables
- Role-based navigation (drivers see Resume/DOT, employers see dashboard)
- API endpoints for role management and profile fetching

**Driver Experience (Fully Built):**

- ✅ **Driver Hub** - Unified dashboard accessible from login
  - Profile completeness score with smart hints
  - All resumes, DOT apps, MVR records, job applications in one view
  - Quick stats cards, detail modals, payment history
  - **Self-service employment verification (NEW!)** - drivers can proactively verify their employment
- ✅ Resume upload with blockchain verification
- ✅ **Resume builder** - Create professional driver resumes
- ✅ **Auto-resume generation (NEW!)** - When DOT app completes and no resume exists, prompt to auto-create one from DOT data
- ✅ DOT application forms (3-step wizard)
- ✅ AvA AI assistant for form guidance
- ✅ Form data persistence and prefill
- ✅ Blockchain submission and verification
- ✅ Transaction history and wallet management
- ✅ **Applicant-Initiated Verification** - verify employment before employers ask

**Employer Experience:**

- ✅ Employer Hub - Unified dashboard for employers
  - All received applications at a glance
  - Applicant cards with driver info, MVR status, resume preview
  - Status management (submitted, reviewing, interviewing, hired)
  - **Employment verification management (NEW!)**
- ✅ Company profile setup
- ✅ Job posting creation
- ✅ Applicant review interface
- ✅ **Employment Verification System (NEW!)**
  - Initiate verification from driver profiles
  - Track contact attempts (up to 3 per request)
  - View 6 FMCSA verification question results
  - Previous employer portal (token-based, no login required)

---

### Roadmap: Employer Features

#### ✅ **Phase 2: Company Profiles (COMPLETE)**

**Company Setup** (✅ Implemented):

- Multi-step company profile wizard
- Basic info: Company name, DOT/MC numbers
- Contact details: Phone, email, website
- Location: Address, operating regions
- Fleet details: Company size
- Industry type array

**What's New in Migration 016:**

- ✅ **Multi-user access** via `company_members` table
- ✅ **7 role levels** (owner → viewer)
- ✅ **Invitation system** with secure tokens

---

#### ✅ **Phase 3: Job Posting System (COMPLETE)**

**Job Creation** (✅ Implemented):

- Full job posting CRUD
- Role-agnostic via `target_role` column (driver, developer, warehouse, etc.)
- Generic `requirements` JSONB field for role-specific requirements
- Location, pay range, benefits, home time
- Active/inactive status

**What's New in Migration 016:**

- ✅ **`target_role` column** - Jobs can target any role, not just drivers
- ✅ **`role_requirements` JSONB** - Flexible requirements per role type (existing `requirements` TEXT is for descriptions)
- ✅ **`department` column** - For hiring manager scope

---

#### ✅ **Phase 4: Generic Employer Architecture (COMPLETE - February 2026)**

**Multi-user company access and role-agnostic job postings now implemented!**

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPANY TEAM ACCESS                       │
├─────────────────────────────────────────────────────────────┤
│  OWNER     │ Full control, billing, delete company          │
│  ADMIN     │ Manage team, settings, all jobs                │
│  HR_MANAGER│ All hiring access, compliance                  │
│  HIRING_MGR│ Manage jobs in scope                           │
│  RECRUITER │ Post jobs, screen candidates                   │
│  INTERVIEWER│ View assigned candidates, add notes           │
│  VIEWER    │ Read-only dashboards                           │
└─────────────────────────────────────────────────────────────┘
```

**What's New:**

- **`company_members` table** - Multiple users per company with role-based permissions
- **Generic job postings** - `target_role` (driver/developer/warehouse/etc) + `role_requirements` JSONB
- **`employer_candidate_data` table** - Employers can add notes, ratings, documents, interview data
- **Visibility toggle** - Each annotation can be made visible/hidden from candidate
- **Employer-ordered MVRs** - Track who ordered an MVR (candidate vs employer)
- **Updated RLS** - Team-based access instead of single owner

**Migration:** `016_generic_employer_architecture.sql`

---

#### ✅ **Phase 5: Company Approval System (COMPLETE - February 2026)**

**Admin-controlled employer onboarding and verification now implemented!**

```
┌─────────────────────────────────────────────────────────────┐
│                  COMPANY STATUS WORKFLOW                     │
├─────────────────────────────────────────────────────────────┤
│  PENDING   → Company created, awaiting admin approval       │
│  ACTIVE    → Approved, full employer features enabled       │
│  SUSPENDED → Disabled by admin (violation, fraud, etc.)     │
└─────────────────────────────────────────────────────────────┘
```

**What's New:**

- **Company status system** - `pending`, `active`, `suspended` states
- **Pre-created companies** - Admins can set up companies before owners log in
- **Designated owner email** - Auto-link owners when they sign up
- **Smart role assignment** - Checks for pre-created companies and invites before creating new
- **Central Admin** - Companies tab in admin dashboard with approval workflow
- **Audit trail** - `company_status_history` table tracks all status changes

**Admin Workflows:**

1. **Pre-create for known client** - Admin creates company with designated owner email, owner auto-linked on login
2. **Self-service with approval** - Employer signs up, company created as "pending", admin reviews and approves

**Migration:** `017_company_approval_system.sql`

---

#### ✅ **Phase 6: Employer Onboarding UX & Admin Refactor (COMPLETE - February 2026)**

**Improved employer signup flow and admin dashboard for better data quality and usability.**

**Inline Company Registration:**

When a user selects "Employer" role, they now see an inline form:
- Company Name (required) - Must be at least 2 characters
- DOT Number (optional) - Can be added later
- Continue button disabled until company name entered

This prevents orphan "My Company" placeholder records that were previously auto-created.

**Central Admin Sidebar:**

Replaced horizontal tabs with a clean, organized sidebar layout:

```
┌────────────────────────────────────────────────────────┐
│  CENTRAL ADMIN                                          │
├──────────────┬─────────────────────────────────────────┤
│  EMPLOYERS   │  Main Content Area                       │
│  • Companies │                                          │
│              │  [Search] [Refresh]                      │
│  DRIVERS     │                                          │
│  • Profiles  │  ┌────────────────────────────────────┐ │
│  • DOT Apps  │  │ Data Cards / Tables                │ │
│  • Resumes   │  │                                    │ │
│  • MVR Orders│  │                                    │ │
│  • Verif.    │  └────────────────────────────────────┘ │
│              │                                          │
│  DEVELOPERS  │                                          │
│  • Profiles  │                                          │
│  • Projects  │                                          │
│              │                                          │
│  SYSTEM      │                                          │
│  • All Users │                                          │
│  • Tools     │                                          │
└──────────────┴─────────────────────────────────────────┘
```

**Admin Email Notifications:**

- New company registrations trigger email to admins
- Uses existing Resend setup (`verify.stormchain.ai`)
- Configure via `ADMIN_NOTIFICATION_EMAILS` env var

**Test Data Cleanup:**

- `018_cleanup_test_data.sql` removes orphan "My Company" records
- Safe, idempotent migration

---

#### ✅ **Phase 7: Talent Search & Career Cards (COMPLETE - February 2026)**

**Enabling employers to discover and recruit candidates through career cards.**

```
┌─────────────────────────────────────────────────────────────────┐
│                      CAREER CARD                                 │
│  (Aggregated view of everything in applicant's Hub)              │
├─────────────────────────────────────────────────────────────────┤
│  DRIVER                          │  DEVELOPER                    │
│  ├─ Profile                      │  ├─ Profile                   │
│  ├─ Resume                       │  ├─ Resume/Portfolio          │
│  ├─ DOT Application              │  ├─ Skills                    │
│  ├─ MVR Results                  │  ├─ Projects                  │
│  ├─ Verified Work History        │  ├─ GitHub/Contributions      │
│  └─ Certifications               │  └─ Verified Experience       │
└─────────────────────────────────────────────────────────────────┘
```

**Phase 1 (Complete):**
- ✅ Migration 020: `candidate_requests`, `career_cards` view, `search_talent()` function
- ✅ EmployerHub refactored with new styling and generic support
- ✅ Applicant cards show role badges (Driver/Dev)
- ✅ "Find Talent" prominently featured in Quick Actions

**Phase 2 (Complete):**
- ✅ `TalentSearchPage` - Full search UI with filters (role, CDL class, state, experience)
- ✅ `CareerCardModal` - Detailed candidate view with employer action buttons
- ✅ `/api/employer/talent/search` - Search API using `search_talent()` function
- ✅ `/api/employer/talent/[userId]` - Career card data API
- ✅ `/api/employer/talent/[userId]/request` - Candidate request creation API
- ✅ Wired up navigation in `page.tsx` for talent search

**Phase 3 (Complete):**
- ✅ Email notifications via Resend when employer creates requests
- ✅ `CandidateRequestsSection` - Hub UI for candidates to view/respond to requests
- ✅ `/api/candidate/requests` - Candidate request listing and status updates
- ✅ `/api/employer/talent/[userId]/recruit` - Employer-initiated application creation
- ✅ "Recruit Candidate" button in CareerCardModal with job selection

**Key Concepts:**

1. **Shared MVRs** - When employer orders MVR, it goes to candidate's profile and is visible to all employers (huge value for candidates)
2. **Two Application Paths:**
   - Applicant applies to job → `initiated_by: 'applicant'`
   - Employer recruits from career card → `initiated_by: 'employer'`
3. **Candidate Requests** - Employers can request docs, verifications from candidates

**Migration:** `020_talent_search_career_cards.sql`

---

#### ✅ **Employment Verification System (COMPLETE - January 2026)**

**Three-Party Verification Flow:**

The system enables future employers to verify a driver's employment history with their previous employers, implementing the DOT-required verification process.

```
Driver submits employment history (self-reported)
            ↓
Future employer initiates verification
            ↓
System contacts previous employer (up to 3 attempts)
            ↓
Previous employer answers 6 FMCSA questions
            ↓
Results stored and shared with future employer
```

**The 6 FMCSA Verification Questions:**

1. Were the employment dates correct?
2. Were they terminated?
3. Are they eligible to return?
4. Were they ever in an accident?
5. Did they fail FMCSA Clearinghouse post-accident test?
6. Were they part of random drug test pull or refused a drug test?

**Verification Statuses:**

| Status | Meaning |
|--------|---------|
| `SELF_REPORTED` | Driver's claim, not yet verified |
| `VERIFICATION_IN_PROGRESS` | Contact attempts being made (1-3) |
| `VERIFIED` | Previous employer confirmed details |
| `PARTIALLY_VERIFIED` | Some details confirmed, others disputed |
| `ATTEMPTS_EXHAUSTED` | 3 attempts, no response |

**Key Features:**

- **For Drivers:** Track verification status, see which employers are verifying
- **For Future Employers:** Initiate verification, track attempts, view results
- **For Previous Employers:** Token-based portal, answer questions without login
- **AVA Integration:** Templates and guidance for all parties

---

#### ✅ **Phase 4: Applicant Review & Hiring (COMPLETE - February 2026)**

**Kanban Pipeline Board:**

- ✅ Drag-drop applicant management between status columns
- ✅ 6 pipeline stages: New → Reviewing → Interviewing → Offer Sent → Hired → Rejected
- ✅ Visual status indicators with color-coded columns and badges
- ✅ View toggle between compact list view and full Kanban board

**Applicant Management:**

- ✅ Status update API with employer ownership validation
- ✅ Email notifications to candidates on status changes
- ✅ Status-specific email templates (reviewing, interview, offer, hired, rejected)

**Notes & Ratings System:**

- ✅ Private employer notes about candidates
- ✅ 1-5 star rating system
- ✅ Quick tags (Hot Candidate, Backup, Needs Follow-up) + custom tags
- ✅ Timeline view of notes in chronological order

**Technical Implementation:**

- ✅ `ApplicantKanban.tsx` - HTML5 drag-drop Kanban board
- ✅ `CandidateNotesPanel.tsx` - Notes, ratings, tags UI
- ✅ `PATCH /api/employer/applications/[id]/status` - Status update API
- ✅ `POST/GET /api/employer/candidate-data` - Notes/ratings storage
- ✅ `sendApplicationStatusNotification()` - Email notifications

---

#### 🔜 **Phase 5: Advanced Features (Q3-Q4 2026)**

**Analytics & Insights:**

- Application metrics (views, applications, time-to-hire)
- Candidate pipeline analytics
- Hiring trends and benchmarks

**Talent Search:**

- Proactive driver discovery (search all qualified drivers)
- Saved searches and alerts
- Direct outreach to drivers

**Integration Features:**

- ATS (Applicant Tracking System) integration
- Background check service integration
- Drug testing coordination
- Onboarding workflow automation

**AvA for Employers:**

- AI-assisted job posting creation
- Applicant screening recommendations
- Compliance guidance (DOT hiring requirements)
- Automated candidate matching

---

### Data Model

```sql
-- Core Tables (Implemented)
users              -- role: 'driver' | 'employer' | 'developer'
companies          -- Employer profiles
company_members    -- Multi-user access (owner/admin/hr/recruiter/etc)
job_postings       -- Role-agnostic job listings (target_role + role_requirements JSONB)
applications       -- Candidate applications (applicant_user_id, generic)
employer_candidate_data  -- Employer annotations (notes, ratings, documents, interviews)

-- Driver-Specific Tables
driver_profiles
driver_applications
resumes
mvr_orders
mvr_results

-- Developer-Specific Tables
developer_profiles
developer_projects

-- Shared Tables
user_profiles
employment_verification_requests
verification_attempts

-- Messaging & Notifications (implemented)
messages
message_threads
notifications
storm_distributions
```

### Security & Access Control

**Row-Level Security (RLS) Policies:**

- Candidates can only see their own applications and data
- Employer team members can see their company's jobs and applicants (role-based)
- Candidates can see employer data marked `visible_to_candidate = true`
- Public can view active job postings (when logged in)
- Admins can verify companies and moderate content

**Data Privacy:**

- Driver DQ files only accessible to employers they've applied to
- No bulk driver data export for employers
- HIPAA-compliant storage for medical certificates
- GDPR-compliant data deletion and export

---

### Business Model Implications

**Driver Side (Free):**

- Resume upload and storage
- DOT application creation
- DQ file building and verification
- Job search and applications
- AvA AI assistance

**Employer Side (Freemium/Paid):**

- **Free Tier**: 1-2 job postings, basic applicant review
- **Premium Tier** ($99-299/month):
  - Unlimited job postings
  - Advanced applicant filtering
  - Priority placement in job search
  - Analytics and insights
  - Bulk messaging
  - AvA hiring assistant

**Future Revenue Streams:**

- Featured job listings
- Promoted company profiles
- Background check services (commission)
- ATS integration (enterprise)
- White-label solutions for large fleets

---

### Success Metrics

**Driver Metrics:**

- Resumes uploaded
- DOT applications completed
- Jobs applied to
- Hires completed

**Employer Metrics:**

- Companies registered and verified
- Jobs posted
- Applications received per job
- Time to hire
- Candidate quality ratings

**Platform Metrics:**

- Total matches (driver applied → employer hired)
- Blockchain verifications performed
- AvA interactions
- User retention and engagement

---

### Technical Architecture Notes

**Scalability:**

- Independent development of driver and employer features
- Separate API routes and components
- Role-based code splitting for faster load times

**Future Roles:**

- **Recruiters**: Third-party recruiters posting on behalf of companies
- **Fleet Managers**: Team-based access for large companies
- **Admins**: Platform moderation and verification

**Blockchain Integration:**

- Driver DQ files remain on-chain (permanent, tamper-proof)
- Employers verify credentials via smart contracts
- Application submissions create immutable audit trail
- Future: On-chain reputation system for drivers

---

## 📋 **Complete DQ File Implementation** (Future Enhancement)

### Overview

Currently, Veree extracts data from **resumes only**, achieving ~25-30% form prefill coverage. A complete **Driver Qualification (DQ) File** requires multiple document types. Future implementation will dramatically increase prefill coverage to **60-70%+**.

### DQ File Components

#### ✅ **Currently Implemented: Resume**

**What We Extract:**

- Personal information (name, contact, DOB, address)
- License basics (number, state, endorsements)
- Employment history (employer, dates, position, location)

**Form Coverage:**

- Form 1 (Personal Info): ~40-50% prefilled
- Form 2 (Driving/Safety): 0% (not on resumes)
- Form 3 (Employment): ~20-30% prefilled
- **Total Coverage: ~25-30%**

---

#### ✅ **COMPLETE: Motor Vehicle Record (MVR)** (January 7, 2026)

**Full MVR integration with KeyBackground/Accio is now operational!**

**What We Extract:**

- ✅ Complete accident history (dates, nature, at-fault status, injuries, fatalities)
- ✅ Traffic violations and convictions (dates, violations, states, penalties, ACD codes)
- ✅ License suspensions or denials
- ✅ License classes (A, B, C, D) with descriptions and restrictions
- ✅ CDL endorsements and restrictions
- ✅ Medical certificate status and expiration
- ✅ Years of commercial driving experience

**Integration Details:**

- **Provider**: KeyBackground/Accio Data Systems
- **API**: Real-time MVR ordering via XML API
- **States**: All US states supported
- **Webhook**: Automatic result processing when DMV responds
- **Storage**: Full parsed data in `mvr_results` table with JSONB fields

**UI Features (`MvrViewModal.tsx`):**

- Professional MVR report display
- License information with all classes
- Medical certificate status
- Summary stats (points, violations, accidents, suspensions)
- Detailed violation/accident/suspension cards

**Form Auto-Fill (Ready):**

- Form 2 (Accident Record): Auto-fill from MVR accident data
- Form 2 (Traffic Convictions): Auto-fill violation history
- Form 1 (License Info): Enhanced with expiration dates, full endorsement history
- **Coverage Boost: +35-40% (Form 2 goes from 0% → ~90%)**

---

#### 🔜 **Future: DOT Medical Certificate**

**What We Could Extract:**

- Medical examiner name and contact
- Medical certificate number
- Examination date
- Expiration date
- Medical qualification status (certified, not certified, pending)
- Restrictions or limitations

**Enhanced Form Coverage:**

- Form 1 (Medical Qualification): Auto-fill certificate details
- **New Coverage: +5-10%**

---

#### 🔜 **Future: CDL Copy (License Document)**

**What We Could Extract:**

- Full license number
- Issue and expiration dates
- License class (A, B, C)
- All endorsements with codes
- Restrictions
- Issuing state details

**Enhanced Form Coverage:**

- Form 1 (License Information): Complete license details, no manual entry needed
- **New Coverage: +5-10%**

---

#### 🔜 **Future: Previous Employer Verification Letters**

**What We Could Extract:**

- Employer contact information (phone, address)
- Supervisor names and titles
- Detailed job descriptions
- Reason for leaving (from employer perspective)
- Rehire eligibility
- Safety performance history
- FMCSR compliance details
- Drug/alcohol testing records

**Enhanced Form Coverage:**

- Form 3 (Employment History): Complete employer details, no manual contact lookup
- Form 3 (FMCSR/Safety-Sensitive): Auto-detect from employer verification
- **New Coverage: +10-15%**

---

#### 🔜 **Future: Drug/Alcohol Test Results**

**What We Could Extract:**

- Test dates and types (pre-employment, random, post-accident)
- Test results (pass/fail, levels)
- Testing facility information
- Medical Review Officer (MRO) details

**Enhanced Form Coverage:**

- New section: Pre-employment testing status
- **New Coverage: +3-5%**

---

#### 🔜 **Future: Road Test Certificate**

**What We Could Extract:**

- Test date and location
- Examiner name and credentials
- Vehicle type tested
- Test result (pass/fail)
- Expiration date

**Enhanced Form Coverage:**

- Form 1: Road test certification status
- **New Coverage: +2-3%**

---

### Implementation Priority

**Phase 1 (Highest Impact):**

1. ✅ **MVR Integration** → +35-40% coverage (COMPLETE - January 7, 2026)
2. **DOT Medical Certificate** → +5-10% coverage

**Phase 2 (Medium Impact):** 3. **CDL Document OCR** → +5-10% coverage 4. **Employer Verification Letters** → +10-15% coverage

**Phase 3 (Lower Priority):** 5. Drug/Alcohol Test Results → +3-5% 6. Road Test Certificate → +2-3%

**Projected Final Coverage: 85-95% of all form fields**

---

### Technical Implementation Notes

#### MVR Processing ✅ COMPLETE

- **Provider**: KeyBackground/Accio Data Systems (XML API)
- **Implementation**: 
  - `src/lib/accio-xml-parser.ts` - XML parsing for all MVR data
  - `src/app/api/mvr/order/route.ts` - Order placement
  - `src/app/api/mvr/webhook/route.ts` - Result webhook handler
  - `src/components/MvrViewModal.tsx` - UI display
- **Data Extracted**: License info, violations, accidents, suspensions, medical cert
- **Storage**: `mvr_orders` and `mvr_results` tables with full JSONB parsed data
- **Validation**: Cross-reference accident dates with employment gaps (ready for DOT form auto-fill)

#### Medical Certificate Processing

- **Format**: Standardized DOT form (MER Form, MCSA-5876)
- **OCR**: High success rate (structured form)
- **Storage**: HIPAA considerations - medical data requires special handling
- **Expiration Tracking**: Can alert users before certificate expires

#### CDL OCR

- **Format**: Varies by state but follows AAMVA standards
- **OCR Difficulty**: Moderate - raised text, security features
- **Validation**: Can verify against CDLIS (Commercial Driver's License Information System)

#### Employer Verifications

- **Format**: Unstructured (letters, emails, faxes)
- **AI Extraction**: High complexity - natural language processing required
- **Validation**: Cross-reference with reported employment history

---

### AvA Enhancement Opportunities

When additional documents are implemented, AvA's guidance will improve:

**Current (Resume Only):**

> "Form 2: I couldn't extract this from your resume since it's not typically included. You'll need to manually fill in accidents and violations."

**Future (MVR Uploaded):**

> "Form 2: I've extracted your accident history and traffic violations from your MVR. Found 1 accident (2022) and 2 violations (speeding). Please review for accuracy."

**Future (Complete DQ File):**

> "Great news! I've filled in 87% of your application from your uploaded documents. You just need to add: salary history, reason for leaving (2 employers), and your signature."

---

### User Experience Flow

**Current:**

1. User uploads resume
2. AvA fills ~25-30% of forms
3. User manually enters driving/safety records

**Future (Multi-Document):**

1. User uploads resume, MVR, medical cert, CDL
2. AvA processes all documents in parallel
3. AvA fills ~85-95% of forms
4. AvA highlights any discrepancies between documents
5. User reviews and signs

---

### Data Validation Opportunities

With multiple documents, AvA can cross-validate:

- **Resume vs MVR**: Do employment dates align with accident dates?
- **MVR vs Employer Verification**: Does accident record match employer's safety report?
- **CDL vs Resume**: Do endorsements match claimed experience?
- **Medical Cert vs Application**: Is medical status current?

AvA could flag discrepancies:

> "⚠️ I noticed your resume shows you worked at ABC Trucking from 2020-2022, but your MVR shows an accident in 2019 while employed there. Please clarify the employment dates."

---

## 🎯 Project Vision & Why We're Building This

### The Big Picture

**DriverAppChain** is an AI-powered, blockchain-verified employment platform that will replace Indeed and Monster. We're starting with CDL drivers because:

- **Clear verification needs** - CDL licenses are easy to verify
- **Controlled market** - Perfect for testing AI algorithms
- **Proven demand** - Transportation industry needs better hiring tools

### Why This Will Work

1. **Verified Credentials** - Blockchain eliminates resume fraud
2. **AI Intelligence** - Instant job matching with improvement suggestions
3. **Transparency** - No more application black holes
4. **User Ownership** - Your data, your control

---

## 🏗️ Architecture Overview (Why We Chose This Stack)

### Frontend: Next.js 15 + TypeScript + Tailwind 4

**Why Next.js 15?**

- **App Router** - Better performance and SEO
- **Server Components** - Faster initial page loads
- **API Routes** - Built-in backend endpoints
- **TypeScript** - Catches bugs before runtime

**Why Tailwind 4?**

- **Utility-first** - Faster development, consistent design
- **JIT compilation** - Only generates CSS you use
- **Responsive by default** - Mobile-first approach

### Backend: Supabase + PostgreSQL

**Why Supabase?**

- **PostgreSQL as a service** - No database management headaches
- **Built-in authentication** - Ready for wallet integration
- **Real-time subscriptions** - Can listen to database changes
- **Auto-generated APIs** - REST endpoints out of the box

**Why PostgreSQL?**

- **ACID compliance** - Data integrity guaranteed
- **JSON support** - Flexible data storage
- **Scalability** - Handles millions of records

### Storage: IPFS + Pinata

**Why IPFS?**

- **Decentralized** - Files stored across the network
- **Immutable** - Content-addressed storage
- **Blockchain ready** - Perfect for smart contract verification

**Why Pinata?**

- **Professional pinning** - Keeps files accessible
- **Gateway service** - Easy URLs for file access
- **Reliable infrastructure** - Handles IPFS complexity

### Blockchain: Base Sepolia + Full Alchemy Infrastructure + Solidity

**Why Base Sepolia + Full Alchemy?**

- **Production-Ready Infrastructure** - Alchemy provides 99.9% uptime RPC nodes
- **Enhanced Performance** - Faster blockchain queries and transaction broadcasting
- **Alchemy Smart Wallets** - Complete migration from Base SDK to Alchemy Account Kit
- **Reliable Deployments** - Consistent contract deployment success rates
- **Real Network Testing** - Test on actual Base testnet with production infrastructure
- **Scalable Architecture** - Handle high transaction volumes
- **Session Persistence** - localStorage wallet state persists across page refreshes
- **2-Hour Session Expiry** - Automatic session timeout for security

**Full Alchemy Integration:**

- **API Key:** `1EacVcYetgk_QIWCKp4hI`
- **Base Sepolia RPC:** `https://base-sepolia.g.alchemy.com/v2/1EacVcYetgk_QIWCKp4hI`
- **Smart Wallets** - Alchemy Account Kit with gas sponsorship
- **Enhanced APIs** - Token, Transfers, Simulation, Webhooks
- **Developer Tools** - Comprehensive debugging and transaction tracking
- **🛡️ Built-in MEV Protection** - Automatic protection from frontrunning and sandwich attacks
- **💰 Gas Sponsorship** - Paymaster Policy for seamless user experience

---

## 📋 What We've Built So Far (Phase 1 COMPLETE! 🎉)

### ✅ Foundation Layer

1. **Project Setup**
   - Next.js 15 with TypeScript
   - Tailwind CSS 4 configuration
   - Hardhat smart contract setup
   - Environment configuration

2. **Smart Contract**
   - `ResumeRegistry.sol` - Stores IPFS hashes on-chain
   - Basic resume management functions
   - Event emission for frontend updates

3. **Database Schema**
   - User profiles with CDL-specific fields
   - Resume metadata storage
   - Proper relationships and constraints

### ✅ Frontend Layer

1. **Dashboard UI**
   - Professional header with branding
   - Sidebar with stats and quick actions
   - Responsive grid layout
   - Modern, clean design

2. **Resume Upload Component**
   - Drag & drop file interface
   - File validation (type, size)
   - Progress tracking and error handling
   - Success confirmation

### ✅ Backend Layer

1. **API Endpoints**
   - `/api/resumes` - Create and fetch resumes
   - `/api/users/profile` - User management
   - `/api/auth/verify` - EIP-712 signature verification
   - `/api/paymaster/*` - ERC20 gas payment support
   - Proper error handling and validation

2. **Database Integration**
   - Supabase client with connection management
   - Two-step upload: IPFS → Database
   - Type-safe database operations

### ✅ Storage & Infrastructure

1. **IPFS Integration**
   - Pinata SDK integration
   - File upload to decentralized storage
   - IPFS hash generation and storage
   - Gateway URL creation

2. **Database Infrastructure**
   - Supabase integration complete
   - Database tables created and working
   - Connection testing and validation
   - Schema management ready

### ✅ Complete Upload Flow (WORKING! 🚀)

1. **File Selection** → User picks resume file
2. **IPFS Upload** → File stored on Pinata IPFS
3. **Hash Generation** → IPFS hash created (e.g., `bafkreihxx4l2dmqpbsegatdnnhzobiay2wm7z7pkii7j4tuberzoxlfs6y`)
4. **Database Save** → Resume metadata stored in Supabase
5. **Success Confirmation** → User sees complete upload success

**🎯 PHASE 1 COMPLETE: We have a working blockchain-ready resume upload platform!**

---

## 🚧 What We've Completed: DOT Driver Application Builder! 🚛

### 🎯 **Revolutionary DOT Driver Application System**

**Why This is Game-Changing:**

- **Superior to Tenstreet** - More comprehensive than existing driver application platforms
- **10-step application process** - Covers all DOT compliance requirements
- **Real-time validation** - Instant DOT compliance checking
- **Auto-save functionality** - Never lose progress
- **Complete Supabase integration** - Persistent data storage

**What We Built:**

1. **Comprehensive Application Builder**
   - ✅ **10-step application process** - Personal Info, CDL, Employment, Driving Record, Medical, Drug Testing, Training, References, Driving Experience, Safety & Compliance, Authorizations
   - ✅ **Real-time DOT compliance validation** - Instant feedback on compliance status
   - ✅ **Auto-save functionality** - Automatic progress saving to Supabase
   - ✅ **Progress tracking** - Visual progress bar and step navigation
   - ✅ **Keyboard shortcuts** - Ctrl+1-9 for quick step jumping

2. **Enhanced User Experience**
   - ✅ **Professional UI** - Clean, modern interface with Tailwind 4
   - ✅ **Responsive design** - Works on all device sizes
   - ✅ **Loading states** - Smooth transitions and feedback
   - ✅ **Error handling** - Comprehensive error management
   - ✅ **Success confirmation** - Clear completion feedback

3. **Advanced Features**
   - ✅ **Development mode** - Test data and step jumping for development
   - ✅ **DOT compliance calculator** - Real-time compliance status
   - ✅ **Comprehensive validation** - All required fields validated
   - ✅ **Data persistence** - Complete application data stored in Supabase

### 🎯 **Superior to Tenstreet:**

| Feature                  | Our Application                | Tenstreet          | Advantage                  |
| ------------------------ | ------------------------------ | ------------------ | -------------------------- |
| **Steps**                | 10 comprehensive steps         | 8 basic steps      | ✅ More thorough           |
| **Real-time Validation** | ✅ Instant compliance checking | ❌ Manual review   | ✅ Better UX               |
| **Auto-save**            | ✅ Automatic progress saving   | ❌ Manual save     | ✅ Never lose progress     |
| **Test Data**            | ✅ Development mode            | ❌ No test data    | ✅ Better development      |
| **DOT Compliance**       | ✅ Real-time calculator        | ❌ Post-submission | ✅ Instant feedback        |
| **Modern UI**            | ✅ Tailwind 4, responsive      | ❌ Outdated design | ✅ Professional appearance |
| **Keyboard Shortcuts**   | ✅ Ctrl+1-9 navigation         | ❌ No shortcuts    | ✅ Power user features     |

---

## 🚨 CRITICAL ARCHITECTURE CORRECTION NEEDED!

### **The Fundamental Mistake We Made**

**What We Were Doing WRONG:**

- ❌ **Trying to make wallets deploy contracts** - User wallets are for transactions, not deployment
- ❌ **Building deployment UI for users** - Users should NEVER deploy contracts
- ❌ **Hours of "Request rejected" errors** - Because we were using the wrong tool for the job
- ❌ **Overcomplicating simple architecture** - Smart contracts are deployed ONCE by developers

### **The Correct Architecture (What We Should Have Done From The Start):**

#### **Developer Phase (One-Time):**

```
Developer (You) → Standard Wallet → Deploy Contract → Get Address → Hardcode in App
```

#### **User Phase (Forever After):**

```
Users → Alchemy Smart Wallets → Connect → Use Existing Contract (Server-Sponsored Gas)
```

### **Why This Makes Sense:**

1. **Smart contracts are deployed ONCE** and used by thousands of users
2. **User wallets are for transactions**, not deployment
3. **Users don't need to deploy anything** - they just use the existing contract
4. **One contract address serves all users globally**

### **What We Need To Do Now:**

1. **Remove the deployment component** from the UI
2. **You deploy the contract once** using standard wallet
3. **Update the app to use the deployed contract address**
4. **Keep Alchemy Smart Wallets for user authentication and transactions**

### **Why We Got Confused:**

- **Got caught up in deployment complexity** and assumed users needed to deploy
- **Ignored the obvious**: Smart contracts are deployed once, used by many
- **Overcomplicated the architecture** when the standard approach works fine
- **Spent hours fighting "Request rejected" errors** instead of stepping back

### **The Lesson:**

**Don't overcomplicate simple things!** The standard approach works because it's the right approach.

### **Next Steps:**

1. **You deploy ResumeRegistry.sol once** with standard wallet
2. **Get the contract address** and hardcode it
3. **Users just connect and use the existing contract**
4. **Alchemy Smart Wallets handle all user authentication, server handles gas sponsorship**

---

## 🚧 What We're Building Next (Phase 2) - CORRECTED APPROACH

### 🔐 Alchemy Smart Wallets Authentication & Integration ✅ COMPLETE

**What We Have:**

- ✅ **Alchemy Smart Wallets Integration** - Complete migration from Base SDK
- ✅ **Email + OTP Authentication** - Dead simple user onboarding
- ✅ **Wallet connection state management** - Session persistence
- ✅ **Gas Sponsorship** - Paymaster Policy configured
- ✅ **Production Infrastructure** - Alchemy RPC, APIs, and Smart Wallets
- ✅ **Enhanced APIs** - Token, Transfers, Simulation, Webhooks
- ✅ **MEV Protection** - Automatic protection from frontrunning

### 💾 Blockchain Integration - PRODUCTION-READY WITH ALCHEMY ✅

**The Complete Infrastructure Stack:**

```
Users → Alchemy Smart Wallets → Alchemy RPC Infrastructure → Base Sepolia → Smart Contracts
```

**1. Developer Deploys Contract Once** (You)

- Deploy ResumeRegistry.sol to Base Sepolia using Alchemy RPC
- Reliable deployment with 99.9% success rate
- Pay ~0.001 ETH once for deployment
- Get contract address and hardcode it in the app
- **This is a ONE-TIME operation with production infrastructure**

**2. Users Interact With Existing Contract** (All Users)

- Users connect with Alchemy Smart Wallets (email + OTP)
- Alchemy provides reliable blockchain connection
- Users interact with the already-deployed contract
- Gas sponsored via Alchemy Paymaster Policy (no ETH needed)
- **This happens for every user transaction with production reliability**

**Why This Production Stack Works:**

- **One contract serves thousands of users** globally
- **Alchemy provides production-grade infrastructure** - 99.9% uptime
- **Alchemy Smart Wallets with gas sponsorship** - seamless user experience
- **Users never need ETH** - perfect for mainstream adoption
- **Reliable architecture** - deploy once with Alchemy, use forever
- **Scalable infrastructure** - handles high transaction volumes

### ✅ Resume Management Dashboard (Completed November 10, 2025)

**What Shipped:**

- Resume list view with search + status filters (All, Verified, Pending, Failed)
- Detailed panel showing IPFS metadata, blockchain transaction hash, resume ID, sharing state, payment tier
- Direct links to IPFS gateway and BaseScan transaction explorer
- Refresh control that works with Alchemy Smart Wallet sessions via `x-wallet-address` fallback
- Stat summary (total uploads, verified, awaiting verification) with theme-aware styling

---

## 🎯 Phase 3: AI Intelligence Layer

### 🤖 AI-Powered Resume Analysis & Job Matching

**Why This Matters:**

- **User value** - Instant feedback on resume quality
- **Employer value** - Pre-screened candidates
- **Competitive advantage** - No other platform does this
- **Chat interface** - Users interact with AI agent via Base App messaging

**📋 Detailed Documentation:**

- **[AI Integration Guide](./AI_INTEGRATION.md)** - Complete AI strategy, services, and implementation

**What We'll Build:**

1. **Resume Parsing & Analysis** - Extract skills, experience, education from PDF/DOC files
2. **Job Compatibility Scoring** - AI-powered matching algorithm with 1-10 scoring
3. **AI Resume Building Assistant** - Job-specific optimization suggestions
4. **Employer Dashboard Intelligence** - Automated candidate ranking and insights
5. **Chat Agent Integration** - Natural language interface via Base App + XMTP

**AI Services Required:**

- **Document Processing** - OpenAI GPT-4 Vision API ($0.01-0.03/page)
- **Natural Language Processing** - GPT-4 or Claude 3.5 ($0.03-0.06/1K tokens)
- **Resume Analysis** - Custom ML models ($0.10-0.50/analysis)
- **Job Matching** - Vector database + ML ($0.01-0.05/match)
- **Chat Intelligence** - GPT-4 or Claude ($0.01-0.05/message)

**Cost Analysis:**

- Low usage (100 users): $100-200/month
- Medium usage (1,000 users): $500-1,000/month
- High usage (10,000 users): $2,000-5,000/month

### 📈 Application Tracking

**Why This Matters:**

- **Transparency** - Users know if employers viewed their resume
- **Engagement** - Track application status
- **Data collection** - Improve AI algorithms

### ⛽ Gasless Transactions (Base Account SDK)

**Why This Matters:**

- **User Experience** - Truck drivers don't need to understand gas fees
- **Adoption** - Removes blockchain complexity barrier
- **Competitive Advantage** - Seamless experience vs. other platforms
- **Base Gasless Campaign** - Up to $15k in gas credits available

**What We'll Build:**

1. **Base Account SDK Integration**
   - Native Base Account authentication
   - One-tap USDC payments
   - Built-in gas sponsorship
   - EIP-5792 batch transactions

2. **Gasless Resume Verification**
   - Users can verify resumes without paying gas
   - Base Paymaster service sponsorship
   - Transparent blockchain verification
   - Contract allowlist for sponsored operations

### 💰 Base Pay Integration

**Why This Matters:**

- **User Onboarding** - Easy way for users to fund their wallets
- **Fiat Gateway** - Bridge between traditional finance and crypto
- **User Experience** - Seamless funding from exchanges

**What We'll Build:**

1. **Base Pay Integration**
   - One-tap USDC payments
   - Credit card to USDC conversion
   - Zero fees for users and merchants
   - Payment status tracking

2. **ERC20 Gas Payments**
   - Pay gas fees with USDC instead of ETH
   - Paymaster integration
   - USDC allowance management
   - Gas payment options

---

## 🔧 Alchemy Smart Wallets Implementation

### **Current Status: Alchemy Smart Wallets Integration ✅ COMPLETE**

**What We Have:**

- ✅ Alchemy Smart Wallets configured and working
- ✅ Email + OTP authentication (seedless wallets)
- ✅ Wallet connection state management
- ✅ Base Sepolia network support
- ✅ Gas sponsorship via server-side transactions
- ✅ Session persistence (2-hour expiry)
- ✅ Production-ready infrastructure (Alchemy RPC + APIs)

**Architecture:**

- Users authenticate with Alchemy Smart Wallets (email + OTP)
- All blockchain transactions use server-side sponsored gas
- Gas paid by server wallet (users never pay)
- Complete Alchemy infrastructure stack (RPC, APIs, Smart Wallets)

### **Alchemy Smart Wallets Advantages**

| Feature               | Alchemy Smart Wallets    |
| --------------------- | ------------------------ |
| **Wallet Management** | ✅ Seedless wallets      |
| **Authentication**    | ✅ Email + OTP           |
| **Network Support**   | ✅ Multi-chain (Base)    |
| **Gas Sponsorship**   | ✅ Server-side sponsored |
| **Infrastructure**    | ✅ Production-ready RPC  |
| **User Experience**   | ✅ SaaS-first appearance |
| **Development**       | ✅ Complete API suite    |

---

## 🚀 Phase 4: Base Pay Integration & Premium Features

### 💰 Monetization Strategy

**Why This Matters:**

- **Sustainable revenue** - USDC payments through Base Pay
- **Premium value** - Advanced features for drivers and employers
- **Competitive advantage** - Seamless payment experience
- **Platform growth** - Revenue enables feature development

**📋 Detailed Documentation:**

- **[Base Pay Integration Guide](./BASE_PAY_INTEGRATION.md)** - Complete monetization strategy, premium features, and revenue model
- **[Base Account SDK Guide](./BASE_ACCOUNT_SDK.md)** - Native Base integration with authentication, payments, and gas sponsorship
- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** - Production deployment to Base network

**What We'll Build:**

1. **Base Pay Integration** - One-tap USDC payments for premium features
2. **Premium Driver Features** - Advanced analytics, job matching, templates
3. **Employer Subscriptions** - Tiered access to verified resumes
4. **Batch Transaction Optimization** - Complex operations in single transaction

**Revenue Potential:**

- Driver subscriptions: $5-15/month
- Employer plans: $29-199/month
- Transaction fees: $1.99-9.99
- Enterprise solutions: $500+/month

## 🚀 Phase 5: Market Expansion

### 🌐 Multi-Industry Platform

**Why This Matters:**

- **Scale** - CDL is just the beginning
- **Revenue** - More industries = more customers
- **Network effects** - More users = better AI

### 📱 Mobile Optimization

**Why This Matters:**

- **User preference** - Most job searching happens on mobile
- **Market reach** - Mobile-first users
- **Competitive parity** - Other platforms are mobile-optimized

---

## 💡 Development Best Practices We're Following

### 1. **Incremental Development**

- Build one feature at a time
- Test each piece before moving on
- Keep the app working at every step

### 2. **Type Safety**

- TypeScript everywhere
- Proper interfaces and types
- No `any` types (unless absolutely necessary)

### 3. **Error Handling**

- Graceful error messages
- Proper logging
- User-friendly feedback

### 4. **Code Organization**

- Clear file structure
- Separation of concerns
- Reusable components

### 5. **Documentation**

- Code comments for complex logic
- API documentation
- Change tracking

---

## 🔧 Current Environment Setup

You already have a `.env.local` with:

- ✅ **Database configuration** - Supabase connection working
- ✅ **Pinata IPFS setup** - IPFS uploads working perfectly
- ✅ **Base Account SDK setup** - Ready for integration
- ✅ **Blockchain configuration** - Ready for deployment

---

## 📚 Learning Resources

### Next.js & React

- [Next.js App Router](https://nextjs.org/docs/app)
- [React Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)

### Database & Supabase

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Best Practices](https://www.postgresql.org/docs/current/)

### IPFS & Pinata

- [IPFS Documentation](https://docs.ipfs.io/)
- [Pinata API Reference](https://docs.pinata.cloud/)

### Blockchain Development

- [Solidity Documentation](https://docs.soliditylang.org/)
- [Hardhat Tutorial](https://hardhat.org/tutorial/)

### AI & Machine Learning

- [OpenAI API](https://platform.openai.com/docs)
- [Vector Databases](https://www.pinecone.io/learn/)

---

## 🎯 Next Immediate Steps

1. **✅ Database setup** - Supabase integration COMPLETE
2. **✅ Test database connection** - Working perfectly
3. **✅ Test resume upload flow** - End-to-end working
4. **✅ Base Account SDK authentication** - COMPLETE
5. **⛓️ Deploy smart contract** - Base Sepolia testnet
6. **📊 Resume management dashboard** - List and detail views

---

## 💭 Why This Project Will Make You a Better Developer

### **Full-Stack Experience**

- Frontend (React, TypeScript, CSS)
- Backend (API routes, database)
- Blockchain (smart contracts, Web3)
- DevOps (deployment, environment management)

### **Real-World Problem Solving**

- User experience design
- Data modeling
- Security considerations
- Performance optimization

### **Modern Development Practices**

- Type safety
- Error handling
- Testing strategies
- Documentation

### **Business Understanding**

- Product vision
- User needs
- Competitive analysis
- Revenue models

---

## 🚀 Current Status: PHASE 1 COMPLETE! 🎉

**What's Working Perfectly:**

- ✅ Frontend UI and components
- ✅ API endpoints and routing
- ✅ Database schema and Supabase integration
- ✅ IPFS upload and storage
- ✅ Complete end-to-end upload flow
- ✅ Database persistence and retrieval
- ✅ **Alchemy Blockchain Infrastructure** - Production-ready Base Sepolia RPC
- ✅ Base Account SDK authentication
- ✅ EIP-712 typed data signing
- ✅ MagicSpend capability detection
- ✅ ERC20 gas payment system
- ✅ Base Pay integration
- ✅ Payment status tracking
- ✅ **DOT Driver Application Builder** - Complete 10-step application system

**What We're Building Next:**

- ⛓️ **Smart contract deployment** (deploy to Base Sepolia using Alchemy RPC)
- 🧪 **Test gas sponsorship** (verify server-side sponsored transactions work)
- 📊 **Resume management dashboard** (list and detail views)
- 📄 **Document upload system** (CDL, medical certs, etc.)
- 🔗 **Blockchain verification** (store IPFS hashes on-chain via Alchemy)

**Immediate Infrastructure Benefits:**

- **Reliable deployments** - Alchemy's 99.9% uptime ensures successful contract deployment
- **Enhanced debugging** - Better error messages and transaction monitoring
- **Production scalability** - Infrastructure ready for high user volumes
- **Maintained USDC goals** - Server-side sponsored gas ensures users never pay
- **🛡️ Automatic MEV Protection** - Resume verification transactions protected from manipulation
- **Transaction Privacy** - Sensitive resume data kept private during blockchain processing

**Major Milestone Achieved:**

**🎯 WE NOW HAVE A COMPLETE DOT DRIVER APPLICATION SYSTEM SUPERIOR TO TENSTREET!**

Users can:

1. **Complete DOT driver applications** - 10-step comprehensive process
2. **Real-time DOT compliance validation** - Instant feedback on compliance status
3. **Auto-save functionality** - Never lose progress with automatic saving
4. **Upload resumes to IPFS** - Decentralized storage with blockchain verification
5. **Authenticate with Base Account SDK** - Seedless wallets with EIP-712 signatures
6. **Pay for premium features with Base Pay** - One-tap USDC payments
7. **Access development tools** - Test data and keyboard shortcuts
8. **Persistent sessions** - Stay logged in across page refreshes (4-hour expiry)
9. **Base Sepolia integration** - Real network testing on Base testnet

**This is a complete driver application platform that exceeds industry standards!** 🚀

---

_This roadmap will be updated as we progress through each phase. Each step builds on the previous one, creating a solid foundation for the next feature._
