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
| 3 — Onboarding Form | 🔲 **Next** | Mandatory "who you are" context form + AvA suggestion |
| 4 — Block Picker Modal | 🔲 Pending | Categorized catalog, drag-and-drop, click to add |
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

## Phase 3 — Hub Onboarding Form 🔲 Pending

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

### Acceptance criteria
- [ ] Shown only when `useNeedsOnboarding()` is true
- [ ] Both fields required before submit
- [ ] After submit, `needsOnboarding` is false and picker opens with suggestions

---

## Phase 4 — Block Picker Modal 🔲 Pending

### Goal
A polished modal where candidates browse and add blocks to their hub.
Categorized catalog, drag-and-drop or click to add.

### Files to create
```
src/components/hub/BlockPickerModal.tsx
src/components/hub/BlockPickerCategory.tsx   (category accordion section)
src/components/hub/BlockPickerItem.tsx        (single block card in the picker)
```

### Design spec
- Triggered by `useIsPickerOpen()` from hub-blocks-store
- Closed by `useHubBlocksStore.closePicker()`
- Left panel: category list (`BLOCK_CATEGORIES` from registry)
  - Pre-filtered to `suggested_categories` on first open
  - All categories accessible after that
- Right panel: blocks in selected category
  - Each block shows icon, label, description, complexity hint
  - Already-installed blocks shown as greyed out with "Added ✓"
  - Click "Add to Hub" OR drag into hub (Phase 4b — drag is optional enhancement)
- Mobile: single column, categories as tabs at top

### dnd-kit usage
```tsx
// @dnd-kit/core + @dnd-kit/sortable are already installed
// Use SortableContext on the installed blocks list in the hub
// for reordering. The picker itself uses click-to-add first.
```

### Acceptance criteria
- [ ] Opens when `isPickerOpen` is true
- [ ] Shows categories from block registry
- [ ] Clicking "Add to Hub" calls `addBlock()` and shows optimistic feedback
- [ ] Already-installed blocks are visually distinct / non-addable
- [ ] Closes cleanly and returns focus to hub

---

## Phase 5 — Candidate Shell 🔲 Pending

### Goal
A single `CandidateShell` that replaces `DriverShell` and `DeveloperShell`.
It reads installed blocks and renders them. The hub is the blank slate.

### Files to create / modify
```
src/components/app/CandidateShell.tsx     NEW
src/components/hub/CandidateHub.tsx       NEW — the empty hub + block grid
src/app/page.tsx                          UPDATE — add candidate role routing
```

### Hub layout
```
[  + Add Blocks  ]        ← always visible button that opens picker

[ BlockA ]  [ BlockB ]    ← installed blocks in a responsive grid
[ BlockC ]  [ BlockD ]    ← draggable for reordering (@dnd-kit/sortable)
```

### CandidateShell routing
```tsx
// Mirrors DriverShell pattern — reads currentPage, returns right component
if (currentPage === 'dotapp')    return <DotApplicationFlow ... />
if (currentPage === 'mvr')       return <MvrOrderForm ... />
// etc. — each block's "full page" view routes here

// Default: empty hub
return <CandidateHub />
```

### page.tsx update
```tsx
// Add alongside existing employer/driver/developer checks:
{user && userRole === 'candidate' && !isRoleLoading && (
  <ErrorBoundary section='Candidate Hub'>
    <CandidateShell />
  </ErrorBoundary>
)}
```

### Acceptance criteria
- [ ] `candidate` role shows CandidateShell
- [ ] Hub renders installed blocks from `useInstalledBlocks()`
- [ ] Hub shows onboarding form when `needsOnboarding` is true
- [ ] Hub shows "Add blocks" button that opens picker
- [ ] Blocks are reorderable via drag-and-drop

---

## Phase 6 — Port Existing Features as Blocks 🔲 Pending

### Goal
Wrap existing feature components in the block interface.
Each block gets its own Zustand store and uses `BlockCard` as its shell.

### Blocks to port

| Block ID | Existing Component | New Block Component | New Store |
|----------|-------------------|---------------------|-----------|
| `driver-dot-application` | `DotApplicationFlow` | `DotApplicationBlock.tsx` | `useDotBlockStore` (rename existing) |
| `driver-mvr` | `MvrOrderForm` + `MvrManagementModal` | `MvrBlock.tsx` | `useMvrBlockStore` (split from driver-hub-store) |
| `driver-resume` | `ResumeBuilder` | `DriverResumeBlock.tsx` | `useResumeBlockStore` |
| `driver-cdl-credentials` | (inline in DriverHub) | `CdlCredentialsBlock.tsx` | part of useResumeBlockStore |
| `developer-resume` | `DeveloperResumeBuilder` | `DeveloperResumeBlock.tsx` | `useDeveloperResumeBlockStore` |
| `developer-portfolio` | `PortfolioPage` | `PortfolioBlock.tsx` | `usePortfolioBlockStore` |
| `developer-projects` | (inline in DeveloperHub) | `ProjectsBlock.tsx` | `useProjectsBlockStore` |
| `developer-github` | `GitHubContributionGraph` | `GithubBlock.tsx` | reuse existing |
| `general-skills` | (none — new) | `SkillsBlock.tsx` | `useSkillsBlockStore` |
| `general-work-history` | (partial in driver hub) | `WorkHistoryBlock.tsx` | `useWorkHistoryBlockStore` |

### Rules when porting
- The existing component code doesn't change — it gets wrapped, not rewritten
- The block component is a thin wrapper: `BlockCard` shell + mounts the existing component
- The block's store handles its own loading, error, and data state
- Status is derived by the block itself (not passed from the hub)

### Acceptance criteria
- [ ] Each block renders correctly inside `BlockCard`
- [ ] Each block's status badge reflects real state (complete/in-progress/empty)
- [ ] Removing a block from the hub unmounts it cleanly (no orphaned state)
- [ ] `useDriverHubStore` is fully decomposed after this phase (delete it)

---

## Phase 7 — Career Card as Block Projection 🔲 Pending

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

## Phase 8 — Role Selection Update 🔲 Pending

### Goal
Simplify `RoleSelectionModal` from 3 choices (driver/developer/employer)
to 2 choices (candidate/employer). Existing users keep their roles — new
users get `candidate`.

### Changes
- `RoleSelectionModal.tsx` — remove driver/developer options, replace with single "Candidate" option
- `src/app/api/user/set-role/route.ts` — add `'candidate'` to allowed roles
- `page.tsx` routing — existing `driver` and `developer` role users still route correctly during transition
- Eventually deprecate `driver`/`developer` roles once all existing users are migrated

### Migration strategy for existing users
- Do NOT auto-migrate existing driver/developer accounts
- During transition period, all three roles (`driver`, `developer`, `candidate`) route to `CandidateShell`
- Old DriverShell/DeveloperShell remain available but are flagged for removal
- Remove old shells after all users have naturally re-engaged with the new hub

### Acceptance criteria
- [ ] New users only see "Candidate" and "Employer" on signup
- [ ] Existing driver/developer users are not disrupted
- [ ] `candidate` role routes to CandidateShell

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
