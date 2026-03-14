# Composable Hub — End-to-End Build Guide

This document is the single source of truth for the composable hub refactor.
Update status markers as each item ships. Never leave a phase half-done.

---

## Architecture in One Sentence

> The candidate hub is a blank slate. Users build it by adding blocks.
> Each block owns its component, its store, and its data.
> The career card is a read-only projection of whatever the user built.

---

## Phase Status Overview

| Phase | Status | What It Delivers |
|-------|--------|-----------------|
| 1 — Foundation | ✅ **Done** | Migration, block registry, hub-blocks-store, BlockCard, Cursor rules |
| 2 — API Routes | ✅ **Done** | CRUD endpoints for hub_blocks and hub_onboarding |
| 3 — Onboarding Form | ✅ **Done** | Mandatory "who you are" context form + AvA suggestion |
| 4 — Block Picker Modal | 🔲 **Next** | Categorized catalog, drag-and-drop, click to add |
| 5 — Candidate Shell | 🔲 Pending | Replaces DriverShell + DeveloperShell |
| 6 — Port Blocks | 🔲 Pending | Wrap existing features as BlockCard components |
| 7 — Career Card Projection | 🔲 Pending | Career card rebuilt as a block renderer |
| 8 — Role Selection Update | 🔲 Pending | Simplify to candidate vs employer |

---

## Phase 1 — Foundation ✅ DONE

**Commit:** `6766caf` — "started composible site. added blockcard and migration"

### What was built

| File | Purpose |
|------|---------|
| `supabase/migrations/035_composable_hub.sql` | `hub_blocks` + `hub_onboarding` tables with RLS |
| `src/lib/block-registry.ts` | Static catalog of all block types and categories |
| `src/stores/hub-blocks-store.ts` | Zustand store — installed blocks, picker state, onboarding |
| `src/components/ui/BlockCard.tsx` | Universal block shell (icon, title, status badge, remove) |
| `src/stores/types.ts` | Added `'candidate'` to `UserRole` |
| `src/stores/index.ts` | Exports new store + types |
| `src/components/ui/index.ts` | Exports `BlockCard`, `BackToHubButton` |
| `src/stores/auth-store.ts` | `showProfileSetup` + `checkAndShowProfileSetup` action |
| `src/app/page.tsx` | Removed `useState` for profile setup — logic moved to store |
| `.cursor/rules/ui-components.mdc` | Enforces BackToHubButton, Button, Card/BlockCard |
| `.cursor/rules/state-standards.mdc` | Enforces useState/Zustand boundary |
| `.cursor/rules/composable-hub.mdc` | Enforces block standards + BlockCard usage |

### ⚠️ Pre-Phase-2 Requirement
**Run migration 035 in Supabase before Phase 2 API routes will work.**
The `hub_blocks` and `hub_onboarding` tables must exist in the database.

---

## Phase 2 — API Routes ✅ DONE

### Goal
Wire the hub-blocks-store to real data. After this phase, the store's
`fetchHubData`, `addBlock`, `removeBlock`, `reorderBlocks`, and
`completeOnboarding` actions all talk to real endpoints.

### Files to create

```
src/app/api/hub/
  blocks/
    route.ts           GET (fetch user's blocks + onboarding)
                       POST (add a block)
    [id]/
      route.ts         DELETE (remove a block)
    reorder/
      route.ts         PATCH (update positions after drag-drop)
  onboarding/
    route.ts           POST (save context form answers)
```

### Endpoint contracts

**GET `/api/hub/blocks`**
- Auth: `x-wallet-address` header
- Returns: `{ blocks: HubBlock[], onboarding: HubOnboarding | null }`
- Fetches `hub_blocks` JOIN registry data, sorted by `position ASC`

**POST `/api/hub/blocks`**
- Auth: `x-wallet-address` header
- Body: `{ blockType: string, position: number }`
- Validates `blockType` exists in registry
- Returns: `{ block: HubBlock }`

**DELETE `/api/hub/blocks/[id]`**
- Auth: `x-wallet-address` header
- Verifies ownership (RLS covers this, but double-check user_id)
- Returns: `{ success: true }`

**PATCH `/api/hub/blocks/reorder`**
- Auth: `x-wallet-address` header
- Body: `{ order: Array<{ id: string, position: number }> }`
- Batch updates positions in a single transaction
- Returns: `{ success: true }`

**POST `/api/hub/onboarding`**
- Auth: `x-wallet-address` header
- Body: `{ occupation: string, seekingReason: string }`
- Upserts `hub_onboarding` row
- Runs `suggestCategories()` from block registry to populate `suggested_categories`
- Returns: `{ onboarding: HubOnboarding }`

### Files created
| File | Method | Purpose |
|------|--------|---------|
| `src/app/api/hub/blocks/route.ts` | GET + POST | Fetch blocks + onboarding / add a block |
| `src/app/api/hub/blocks/[id]/route.ts` | DELETE | Remove a block (ownership-verified) |
| `src/app/api/hub/blocks/reorder/route.ts` | PATCH | Batch-update positions after drag-drop |
| `src/app/api/hub/onboarding/route.ts` | POST | Upsert context form + derive suggested_categories |

### Acceptance criteria
- [x] `useHubBlocksStore.fetchHubData()` returns real data
- [x] Adding a block from the store persists to DB and survives page refresh
- [x] Removing a block from the store removes from DB
- [x] Reorder persists to DB
- [x] Onboarding form saves and `needsOnboarding` becomes false

---

## Phase 3 — Hub Onboarding Form ✅ DONE

### Goal
First-time candidates see a required short form before their hub loads.
AvA reads the answers to suggest which blocks to add first.

### Files to create
```
src/components/hub/HubOnboardingForm.tsx
```

### Design spec
- Full-screen overlay (not a modal — it blocks the hub until complete)
- Two fields only:
  1. **What do you do?** — free text, placeholder: "e.g. CDL-A truck driver, React developer, airline pilot"
  2. **Why are you here?** — free text, placeholder: "e.g. Looking for regional routes, building a verifiable portfolio"
- Submit calls `useHubBlocksStore.completeOnboarding()`
- On success: overlay dismisses, hub appears, block picker auto-opens with
  `suggested_categories` pre-filtered (so AvA's suggestions are already visible)

### File created
| File | Purpose |
|------|---------|
| `src/components/hub/HubOnboardingForm.tsx` | Full-screen overlay, two fields, submits to `completeOnboarding()`, opens picker on success |

### Acceptance criteria
- [x] Shown only when `useNeedsOnboarding()` is true (parent's job — Phase 5)
- [x] Both fields required before submit
- [x] After submit, `needsOnboarding` is false and picker opens with suggestions

---

## Phase 4 — Block Picker Modal ✅ Done

### Goal
A polished modal where candidates browse and add blocks to their hub.
Categorized catalog, click-to-add (drag-and-drop deferred to Phase 4b).

### Files created
```
src/components/hub/BlockPickerModal.tsx     (main modal shell)
src/components/hub/BlockPickerCategory.tsx  (category accordion + block items)
```

`BlockPickerItem.tsx` was intentionally omitted — the block item UI is simple
enough to live inside `BlockPickerCategory` without a separate file (KISS).

### How it works
- Opens when `isPickerOpen` is true (via `useIsPickerOpen()`)
- Closes on backdrop click, X button, or Escape key
- Categories render as accordions, sorted: suggested first, then by `order`
- Suggested categories (from AvA onboarding) start expanded with a teal ring
- Each block shows: icon, label, description, complexity hint
- Already-installed blocks are greyed out with "Added ✓"
- Click "Add" calls `addBlock()` — optimistic update with spinner feedback
- Fully responsive — single-column layout works on mobile

### Acceptance criteria
- [x] Opens when `isPickerOpen` is true
- [x] Shows categories from block registry
- [x] Clicking "Add" calls `addBlock()` and shows optimistic feedback
- [x] Already-installed blocks are visually distinct / non-addable
- [x] Closes cleanly (Escape, backdrop click, X button)

---

## Phase 5 — Candidate Shell ✅ Done

### Goal
A single `CandidateShell` that replaces `DriverShell` and `DeveloperShell`.
It reads installed blocks and renders them. The hub is the blank slate.

### Files created / modified
```
src/components/app/CandidateShell.tsx     NEW — role shell (routing)
src/components/hub/CandidateHub.tsx       NEW — empty hub + block grid + drag-and-drop
src/app/page.tsx                          UPDATE — candidate role routing + profile check
src/components/app/ProfileSetup.tsx       UPDATE — accept 'candidate' role
src/components/ProfileSetupModal.tsx      UPDATE — accept 'candidate' role
```

### How it works
- `page.tsx` routes `userRole === 'candidate'` to `<CandidateShell />`
- `CandidateShell` reads `currentPage` from UIStore and routes to sub-views
  - Default (`null`) renders `<CandidateHub />`
  - Also handles: profile-setup, jobs, applications, stormchain, messages
  - Block-specific full-page views (DOT app, MVR, resume) added in Phase 6
- `CandidateHub` lifecycle:
  1. Fetches hub data on mount (blocks + onboarding)
  2. Shows `HubOnboardingForm` overlay if `needsOnboarding` is true
  3. Shows block grid with drag-and-drop reordering (@dnd-kit)
  4. "Add Blocks" button opens the `BlockPickerModal`
  5. Each block card has a drag handle and a hover-to-reveal remove button

### Acceptance criteria
- [x] `candidate` role shows CandidateShell
- [x] Hub renders installed blocks from `useInstalledBlocks()`
- [x] Hub shows onboarding form when `needsOnboarding` is true
- [x] Hub shows "Add blocks" button that opens picker
- [x] Blocks are reorderable via drag-and-drop

---

## Phase 6 — Port Existing Features as Blocks ✅ Done

### Goal
Make installed hub blocks clickable — clicking navigates to the existing
full-page component. No wrapper components needed; reuse existing code directly.

### Approach (simplified from original plan)
Instead of creating thin wrapper `BlockCard` components with per-block stores,
we took the simpler route:
1. Added `pageRoute` to `BlockDefinition` — maps each block to its shell page
2. Made block cards in `CandidateHub` clickable (chevron arrow + cursor)
3. Added full-page routes in `CandidateShell` for DOT app, MVR, resume, portfolio

This avoids creating 10+ new files. Existing components are reused as-is.
Dedicated block stores can be added later when blocks need inline hub views.

### Block → Page mapping

| Block | pageRoute | Component |
|-------|-----------|-----------|
| `driver-dot-application` | `dotapp` | `DotApplicationFlow` |
| `driver-mvr` | `mvr` | `MvrOrderForm` |
| `driver-resume` | `resume` | `ResumeBuilder` |
| `developer-resume` | `resume` | `ResumeBuilder` |
| `developer-portfolio` | `portfolio` | `PortfolioPage` |
| `driver-cdl-credentials` | `null` | Coming soon |
| `developer-projects` | `null` | Coming soon |
| `developer-github` | `null` | Coming soon |
| `general-skills` | `null` | Coming soon |
| `general-work-history` | `null` | Coming soon |

### UI behavior
- Blocks with a `pageRoute` show a chevron arrow and are clickable
- Blocks without a `pageRoute` show a "Soon" badge
- Drag handle and remove button still work (stopPropagation on both)

### Acceptance criteria
- [x] Clicking a block with a pageRoute navigates to the full-page component
- [x] Back button from each component returns to CandidateHub
- [x] Blocks without pageRoute are visually distinct (non-clickable, "Soon" label)
- [x] Existing components render without modification

---

## Phase 7 — Career Card as Block Projection ✅ Done

### Goal
The career card stops being a separate feature and becomes a pure read-only
renderer. It iterates over the user's installed blocks and renders each one's
career card view.

### Changes
- Each block gains a `CareerCardView` sub-component (the employer-facing display)
- `CareerCard.tsx` rebuilt as a layout that renders `<BlockCareerCardView>` for each installed block
- The `career_cards` SQL view stays — it's still useful for search/filtering
- Remove all data-fetching from the career card component itself

### Block career card views

| Block | What employers see |
|-------|--------------------|
| `driver-dot-application` | Verification status badge + date |
| `driver-mvr` | MVR status + license state (FCRA rules still apply) |
| `driver-resume` | Resume preview / download link |
| `driver-cdl-credentials` | CDL class, endorsements, expiration |
| `developer-portfolio` | Portfolio links + highlights |
| `developer-github` | Contribution graph |
| `general-skills` | Skills tag cloud |

### Acceptance criteria
- [ ] Career card shows only blocks the candidate has installed
- [ ] Adding a new block to the hub automatically appears on career card
- [ ] Career card has no data-fetching logic of its own

---

## Phase 8 — Role Selection Update ✅ Done

### Goal
Simplify `RoleSelectionModal` from 3 choices (driver/developer/employer)
to 2 choices (candidate/employer). Existing users keep their roles — new
users get `candidate`.

### Files modified
```
src/components/RoleSelectionModal.tsx     REWRITE — 2-column grid (Candidate + Employer)
src/app/api/user/set-role/route.ts       UPDATE  — accept 'candidate' in valid roles
src/app/page.tsx                         UPDATE  — handleRoleSelection type + remove cast
```

### What changed
- Modal now shows two cards: **Candidate** ("Build your professional profile") and **Employer** ("Hire verified talent")
- The entire employer access-check flow (whitelist, pending requests, company setup form) is preserved unchanged
- `set-role` API validates `'candidate'` as a valid role
- `page.tsx` handler types updated from `'driver' | 'developer' | 'employer'` to `'candidate' | 'employer'`
- `existingRole` prop no longer needs a type cast

### Migration strategy for existing users
- Existing `driver` and `developer` users still route to their original shells (DriverShell / DeveloperShell)
- New users selecting "Candidate" get `candidate` role → CandidateShell → composable hub
- Old shells stay available until Phase 6 ports all features as blocks, at which point
  existing driver/developer users can be migrated to `candidate`

### Acceptance criteria
- [x] New users only see "Candidate" and "Employer" on signup
- [x] Existing driver/developer users are not disrupted
- [x] `candidate` role routes to CandidateShell

---

## Dependency Map

```
Phase 2 (API)
  └── Phase 3 (Onboarding form — needs POST /api/hub/onboarding)
       └── Phase 4 (Block picker — needs POST /api/hub/blocks)
            └── Phase 5 (Candidate Shell — needs picker + fetch)
                 └── Phase 6 (Port blocks — needs shell to render them)
                      └── Phase 7 (Career card — needs all blocks ported)
Phase 8 (Role selection) — can ship anytime after Phase 5
```

---

## Files That Will Be Deleted When Complete

| File | Replaced By |
|------|------------|
| `src/components/DriverHub.tsx` | `CandidateHub.tsx` + individual block components |
| `src/components/DeveloperHub.tsx` | `CandidateHub.tsx` + individual block components |
| `src/components/app/DriverShell.tsx` | `CandidateShell.tsx` |
| `src/components/app/DeveloperShell.tsx` | `CandidateShell.tsx` |
| `src/stores/driver-hub-store.ts` | Per-block stores |
| `src/components/RoleSelectionModal.tsx` | Simplified 2-option version |

---

## What Never Changes

| What | Why |
|------|-----|
| `EmployerShell` + `EmployerHub` | Employer side is already clean and separate |
| `driver_applications` table | Backing store for `driver-dot-application` block |
| `mvr_orders` / `mvr_results` tables | Backing store for `driver-mvr` block |
| `resumes` table | Backing store for all resume blocks |
| `developer_profiles` table | Backing store for developer blocks |
| `driver_profiles` table | Backing store for driver blocks |
| FCRA MVR isolation rules | Legal requirement — always maintained |
