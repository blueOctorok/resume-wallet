# Storm Foundation Reset — Execution Checklist

**This is the master tracker for the Phase 1 / 2 / 3 migration.** Tick steps off as they ship. Every AI session working on this migration starts here.

> Strategic context: `[ARCHITECTURE.md](./ARCHITECTURE.md)` · Phase 1 detail: `[PHASE_1_PLAN.md](./PHASE_1_PLAN.md)` · Pace context: `[PARTNERS.md](./PARTNERS.md)` · Decision rationale: `[DECISION_LOG.md](./DECISION_LOG.md)`

---

## How to use this doc

This doc is structured for **multi-session, multi-model AI work** without losing context or breaking Pace's live employer flows.

### Starting a new AI session

1. Open the **next unstarted step** in this doc (search for "Status: Not started" — first match is the next work).
2. Verify all of the step's **Pre-conditions** are met (previous steps complete, branch clean).
3. Copy the step's **Session prompt** block as your first message in the new chat. Add any context the AI couldn't infer (open files, recent errors).
4. Confirm the AI loaded `.cursor/rules/strategic-direction.mdc` (alwaysApply rule — should appear in its context). If it didn't, paste the rule's contents at the top of the conversation.
5. Work through the step. Run **Verification** before claiming done.
6. Update the step's **Status** in this doc to ✅ Done with a one-line completion note (commit hash + date).

### Ending a session (handoff protocol)

When you're stopping mid-step or finishing a step, leave the next session a clean handoff:

1. **Commit anything in progress** with a `wip:` prefix if not done, or the step's prescribed commit message if done.
2. **Update this doc:**
  - If done: Status → ✅ Done · note commit hash · date.
  - If WIP: Status → 🟡 In progress · what's done · what's next · gotchas encountered.
3. **Update `docs/CHANGES.md`** if the step shipped user-visible changes. Match the existing format.
4. **No undocumented mid-flight refactors.** If you discovered something that needs refactoring outside the current step, add it as a new step in this doc — don't fold it into the current commit.

### Model selection guide (rough — your call)


| Work type                                                             | Model                                       |
| --------------------------------------------------------------------- | ------------------------------------------- |
| Greenfield code, complex multi-file refactors, architecture decisions | Strongest available (Claude Opus / GPT-5.5) |
| Mechanical refactors (e.g. T1.5–T1.8 batch route migrations)          | Mid-tier (Sonnet / Composer 2.5)            |
| Doc updates, commit messages, copy edits                              | Cheap (Composer 2.5 fast / Haiku)           |
| Anything touching Pace's employer paths                               | Strongest available — no shortcuts          |


### When something breaks

See the [Rollback playbook](#rollback-playbook) at the bottom of this doc.

---

## Pace invariants — DO NOT BREAK

These flows must work continuously throughout the migration. If a step risks breaking any of these, it must ship with a **dual-mode** implementation (old + new both work) and the cutover happens in a separate, explicit step.


| #        | Invariant                                                                                                                                       | Files / paths                                                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I-1**  | Pace employer can sign in (any auth path)                                                                                                       | `src/components/AlchemyProvider.tsx`, sign-in flow in `app/page.tsx` (during transition: BOTH old wallet-based and new session-based must work)          |
| **I-2**  | Pace employer hub loads (block list, candidate pipeline, screening list)                                                                        | `/api/employer/hub`, `/api/employer/hub/blocks`, `/api/employer/applicants`, `/api/employer/screenings`                                                  |
| **I-3**  | Pace can install / use employer blocks                                                                                                          | `employer-screening-consent`, `employer-mvr-orders`, `employer-psp-orders` (per `employer-block-registry.ts`); routes `/api/employer/hub/blocks/`*       |
| **I-4**  | Pace can place MVR/PSP orders (any payment method)                                                                                              | `/api/employer/screenings/order`, `/api/employer/mvr/order`, `/api/employer/psp/order`, `lib/place-screening-order.ts`                                   |
| **I-5**  | Accio webhooks deliver and process MVR/PSP completions                                                                                          | `/api/mvr/webhook`, `/api/psp/webhook`, `lib/process-mvr-accio-webhook.ts`, `lib/accio-psp-webhook.ts`                                                   |
| **I-6**  | Reconcile cron runs and pulls stuck Accio orders                                                                                                | `/api/cron/reconcile-screenings`, `lib/reconcile-pending-screenings.ts` (uses `CRON_SECRET`, **not** `x-wallet-address` — auth swap does not touch this) |
| **I-7**  | Pace outreach invites work (email send + kanban)                                                                                                | `/api/employer/invites`, `/api/employer/invites/send-email`, `lib/sync-outreach-invite-status.ts`, `CandidateOutreach.tsx`                               |
| **I-8**  | Pace can view candidate career cards (talent search + modal)                                                                                    | `/api/employer/talent/search`, `/api/employer/talent/[userId]`, `CareerCardModal.tsx`                                                                    |
| **I-9**  | Pace's existing data is untouched: every `mvr_orders`, `psp_orders`, `employer_hub_blocks`, `application_invites`, `candidate_status` row stays | All migrations must be additive (new columns, never DROP) until full cutover                                                                             |
| **I-10** | Existing employer notifications and emails fire correctly                                                                                       | `lib/notify-employer-candidate-action.ts`, `lib/send-admin-notification.ts`                                                                              |


### Pace-critical files — extra caution

When touching any of these, double-verify the change preserves I-1 through I-10:

- `src/app/api/employer/**/`* (28 routes)
- `src/lib/place-screening-order.ts`
- `src/lib/reconcile-pending-screenings.ts`
- `src/lib/accio-xml-builder.ts`
- `src/lib/process-mvr-accio-webhook.ts`
- `src/lib/accio-psp-webhook.ts`
- `src/lib/sync-outreach-invite-status.ts`
- `src/components/employer/**/*`
- `src/lib/employer-block-registry.ts`
- `src/lib/employer-company-access.ts`

### Pace check-in cadence

- **Before Phase 1 starts:** boss → Pace stakeholder. "We're modernizing the login + payment system. Your data is safe. Your team will get a 'set a new password' email when we cut over."
- **After T1.13 (auth cutover):** confirm Pace employer team can sign in with new flow.
- **After T2.10 (Stripe cutover):** confirm Pace can pay for MVR/PSP via card.
- **After T6.7 (production deploy):** full smoke test with Pace stakeholder before declaring Phase 1 complete.

---

## Deploy sequencing & release gates

**Read this before pushing anything in Track 1.** Two prod outages on 2026-05-28 (middleware cookie-API break in T1.2, FK break in T1.3) came from treating "do the auth work" as one undifferentiated push. It isn't. The auth track has two phases with opposite risk profiles, and they get different deploy processes.

### The two speeds

| Phase | Steps | What it is | Does anything switch for Pace? | Process |
|---|---|---|---|---|
| **Dual-mode plumbing** | T1.5 → T1.8 | Migrate ~115 routes to `getStormUserIdFromRequest` (tries Supabase session, falls back to wallet header) | **No.** Pace keeps logging in via Alchemy. Routes only *gain* the ability to also read a session nobody issues yet. | Trunk-based on `main`. Go fast. |
| **Cutover** | T1.9 → T1.12 | Backfill `auth.users`, ship new login UI, flip everyone, remove Alchemy + wallet fallback | **Yes — T1.12 is the point of no return.** | Branch + Vercel preview + Pace coordination. Go careful. |

The mistake to avoid: rushing the cutover because the plumbing felt easy. Compress calendar time on T1.5–T1.8; never rush T1.9–T1.12.

### Rules for the dual-mode plumbing (T1.5–T1.8)

- **One step = one deploy = one verification.** Don't stack two batches into one push. Each batch is independently safe *because* the wallet fallback stays — keep it that way so a regression is bisectable to a single batch.
- **Stay on `main`.** These edits touch ~115 files mechanically; a long-lived branch would drift and pile up conflicts. Dual-mode safety makes trunk-based fine here.
- **Mandatory release gate — the new-user incognito test.** Both 2026-05-28 outages only affected *new* users; an existing logged-in session sailed past them. Before declaring any auth deploy good: open an incognito window, sign up / sign in as a brand-new user, and load the relevant surface. Testing your own existing session is **not** sufficient.

### Rules for the cutover (T1.9–T1.12)

- **Move to a `phase-1-auth` branch with Vercel preview deploys.** The new login UI and Alchemy removal are user-visible and dangerous half-shipped — they must not touch Pace's prod until verified on the preview URL.
- **Hard gate before T1.12 (point of no return).** This query MUST return 0 — every existing user has a matching `auth.users` row from the T1.9 backfill — before removing the wallet fallback:

  ```sql
  SELECT COUNT(*) FROM public.users u
  LEFT JOIN auth.users a ON a.id = u.id
  WHERE a.id IS NULL;
  -- non-zero = T1.9 missed rows. Fix the backfill BEFORE cutover or you lock users out.
  ```

- **Pace stakeholder coordinated** (see Pace check-in cadence above) before flipping.

### Migration-history hygiene

Migrations are append-only and reflect what actually ran in prod. If a migration shipped to production and was later reversed, **do not delete the file** — add a corrective migration and leave a header note on the original pointing at the correction (see 090/091 → 092, 2026-05-28).

---

## Pre-flight — decisions that block all work

These three decisions blocked Phase 1. **All resolved 2026-05-22.**


| #        | Decision                | Picked                                                                                                                                                                                                                                                                                                               | Status       |
| -------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **P0.1** | Auth provider           | **Supabase Auth** (revised from Clerk — see DEC-2026-05-008) — already paid for on Supabase Pro; native `auth.uid()` for RLS; cleaner ID alignment                                                                                                                                                                   | ✅ 2026-05-22 |
| **P0.2** | STORM token disposition | **Option B** — drop Base Sepolia ERC-20 in Phase 1, replace with off-chain `storm_points` ledger designed to map 1:1 to a future Midnight-native token in Phase 3 (DEC-2026-05-005). Implementation is **not urgent** — schema/helpers ship as part of Track 5; new earning use cases wait for a real reward concept | ✅ 2026-05-22 |
| **P0.3** | Stripe payment shape    | **One-time Checkout + Subscriptions** (DEC-2026-05-006). Pace billing is **deferred** — wire the full capability so it's production-ready, but don't enforce billing on Pace at cutover; new/non-Pace customers use Stripe from day one                                                                              | ✅ 2026-05-22 |


Decisions locked in `[DECISION_LOG.md](./DECISION_LOG.md)`. Track 1 below is rewritten to reflect Supabase Auth (not Clerk).

---

## Phase 1 — Foundation cleanup (~50 steps)

Phase 1 retires the Web3-shaped infrastructure (Alchemy, Base, USDC, IPFS, on-chain registries, STORM token) and ships a Web2 SaaS stack (**Supabase Auth**, Stripe, Supabase Storage). End state: zero crypto in user-visible flows.

**Track ordering:** auth must lead. Stripe and storage can run in parallel after auth. Registry decommission and STORM drop come after Stripe (so paid actions don't depend on dropped contracts).

```
Pre-flight (P0.1–P0.3)
   │
   ▼
Track 1 — Auth swap (T1.1 → T1.13)
   │
   ▼
Track 2 — Stripe payments (T2.1 → T2.10) ──┐
Track 3 — Document storage  (T3.1 → T3.7) ──┤── parallel after T1
                                            │
                                            ▼
Track 4 — Registry decommission (T4.1 → T4.6)
   │
   ▼
Track 5 — STORM token drop (T5.1 → T5.6)
   │
   ▼
Track 6 — Cleanup, polish, ship (T6.1 → T6.8)
```

### Step template (for reference)

Every step below uses this format:

```
### T_._ — Step name
| | |
|---|---|
| Status | ⬜ Not started |
| Pre-conditions | List of step IDs that must be done first |
| Estimated session size | S (~1 conversation) / M / L (split into substeps) |
| Pace risk | None / Low / Medium / High |

Goal: One sentence.

Files to change: bullet list with what changes.

DO NOT TOUCH: bullet list of Pace-critical files this step must not modify.

Verification: how to confirm the step worked.

Commit: prescribed commit message.

Session prompt: copy-pasteable prompt for a new AI chat.
```

---

## Track 1 — Auth swap (Alchemy → Supabase Auth)

**Goal:** Replace Alchemy Account Kit smart-wallet auth with Supabase Auth (email/password + Google OAuth + magic links). ~115 API routes currently read `x-wallet-address` from request headers. Migration runs in dual-mode (both old and new work) until cutover, so Pace's flows never break.

**Why Supabase Auth, not Clerk?** Storm is already on Supabase Pro (auth included). `auth.users.id` IS `users.id` — no email-keyed sync webhook needed (which is why T1.3 below is much smaller than the Clerk version was). RLS works natively against `auth.uid()`. One vendor surface instead of two. See `[DECISION_LOG.md](./DECISION_LOG.md)` DEC-2026-05-008 for the full reasoning.

**Why dual-mode?** If we ripped out wallet auth in one commit, every Pace employer would be logged out and unable to sign back in until they had Supabase Auth identities. Dual-mode lets us pre-create `auth.users` rows and migrate users in the background, then cut over with a single "set password" email.

### T1.1 — Configure Supabase Auth providers


|                        |                |
| ---------------------- | -------------- |
| Status                 | 🟡 In progress |
| Pre-conditions         | P0.1 decided ✅ |
| Estimated session size | S (no code)    |
| Pace risk              | None           |


**Goal:** In the existing Supabase project dashboard, enable the auth providers we'll use: email/password (with confirmation email), magic links, and Google OAuth. Configure the Site URL + redirect URLs for `localhost:3000`, the Vercel preview domain, and the production domain. Customize the auth email templates to match Storm's branding.

**Files to change:** none (dashboard-only configuration).

**Verification:** Supabase Dashboard → Authentication → Providers shows email + Google enabled. Site URL points to the production domain; redirect URLs include `localhost:3000/auth/callback`, `*.vercel.app/auth/callback`, `<prod>/auth/callback`. Email template preview renders the Storm logo.

**Commit:** none (no code change).

**Session prompt:** Manual setup, no AI session needed. Engineer does this directly in the Supabase Dashboard.

#### T1.1 runbook (copy-paste checklist)

**Project:** `qlxvcjxjrkphobcgvcmb` · API URL: `https://qlxvcjxjrkphobcgvcmb.supabase.co`  
**Production app URL:** `https://stormchain.ai` (from `src/app/layout.tsx` metadata)

Open the dashboard: [Authentication → URL configuration](https://supabase.com/dashboard/project/qlxvcjxjrkphobcgvcmb/auth/url-configuration)

**1. URL configuration**


| Field                             | Value                                 |
| --------------------------------- | ------------------------------------- |
| **Site URL**                      | `https://stormchain.ai`               |
| **Redirect URLs** (add each line) | `http://localhost:3000/auth/callback` |
|                                   | `https://stormchain.ai/auth/callback` |
|                                   | `https://*.vercel.app/auth/callback`  |


> `/auth/callback` is created in **T1.11** — configuring URLs now avoids a second dashboard pass later. Supabase allows redirect URLs before the route exists.

**2. Email provider** — [Authentication → Providers → Email](https://supabase.com/dashboard/project/qlxvcjxjrkphobcgvcmb/auth/providers?provider=Email)

- **Enable Email provider**
- **Confirm email** — ON (users verify inbox before first sign-in)
- **Secure email change** — ON (recommended)
- **Magic Link** — ON (passwordless sign-in; same Email provider)

**Dual-mode note (Pace still on Alchemy):** Do **not** turn on global “require email confirmation” in a way that blocks API routes. Email confirmation only affects **new** Supabase Auth sign-ups. Existing wallet users are untouched until T1.9 backfill + T1.12 cutover.

**3. Google OAuth** — [Providers → Google](https://supabase.com/dashboard/project/qlxvcjxjrkphobcgvcmb/auth/providers?provider=Google)

Prerequisites in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. OAuth 2.0 Client ID → type **Web application**
2. **Authorized JavaScript origins:** `http://localhost:3000`, `https://stormchain.ai`, `https://qlxvcjxjrkphobcgvcmb.supabase.co`
3. **Authorized redirect URIs:** copy from Supabase Google provider page — format:
  `https://qlxvcjxjrkphobcgvcmb.supabase.co/auth/v1/callback`
4. Paste **Client ID** + **Client secret** into Supabase → Enable Google

**4. Email templates (branding)** — [Authentication → Email templates](https://supabase.com/dashboard/project/qlxvcjxjrkphobcgvcmb/auth/templates)

Customize at minimum: **Confirm signup**, **Magic Link**, **Reset password**, **Change email address**.

Suggested copy direction (match Storm voice, not “Web3”):

- Subject confirm: `Confirm your Storm account`
- Subject magic link: `Sign in to Storm`
- Subject reset: `Reset your Storm password`
- Body: short line + button; support: `support@stormchain.com` if you use that address

Optional: add Storm logo URL in template HTML (host a small PNG on `stormchain.ai` or Supabase Storage in a later step).

**5. SMTP (optional but recommended for production)**

Default Supabase mail works for dev. For production deliverability before cutover, configure [Project Settings → Authentication → SMTP](https://supabase.com/dashboard/project/qlxvcjxjrkphobcgvcmb/settings/auth) (Resend is already in the app — you can reuse the same provider).

**6. Verification (tick before marking T1.1 done)**

- Site URL = `https://stormchain.ai`
- All three redirect URL patterns saved
- Email + Magic Link enabled
- Google enabled (or explicitly deferred with a note — don’t block T1.2 on Google if OAuth creds aren’t ready)
- Template preview looks acceptable in dashboard

**Already in repo (T1.2 preview — do not change in T1.1):** `@supabase/ssr` is in `package.json`; helpers exist at `src/utils/supabase/middleware.ts` and `src/utils/supabase/server.ts`. Root `src/middleware.ts` is still missing — that’s **T1.2**.

When complete, update Status above to `✅ Done · n/a (dashboard) · {date}` and start **T1.2**.

---

### T1.2 — Install `@supabase/ssr` + middleware shell


|                        |                                     |
| ---------------------- | ----------------------------------- |
| Status                 | ✅ Done · 2026-05-23 · no commit yet |
| Pre-conditions         | T1.1                                |
| Estimated session size | S                                   |
| Pace risk              | None (no behavior change yet)       |


**Goal:** Install `@supabase/ssr` (Supabase's official Next.js App Router helper for cookie-based sessions). Add `src/middleware.ts` that refreshes the session cookie on every request and exposes the user to RSCs. The `<AlchemyProvider>` in `src/app/layout.tsx` stays mounted — both auth systems live side-by-side during the transition.

**Files to change:**

- `package.json` (add `@supabase/ssr`; the existing `@supabase/supabase-js` stays)
- `src/middleware.ts` (new — uses `createServerClient` from `@supabase/ssr` per Supabase's official Next.js App Router pattern)
- `src/lib/supabase-server.ts` (new — server-side Supabase client factory using `cookies()` from `next/headers`)
- `src/lib/supabase-browser.ts` (new — browser-side Supabase client factory)
- `.env.local` and `.env.example` — confirm `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are present (already are; this just documents them as auth-relevant)

**DO NOT TOUCH:** `src/components/AlchemyProvider.tsx`, any sign-in UI, any API routes, the existing `getAdminSupabaseClient()` helper (which uses the service-role key and is unrelated to user sessions).

**Verification:**

- `npm run build` passes.
- App renders unchanged in dev (Supabase auth is wired but unused — no sign-in UI yet).
- A blank `/sign-in` page returns 404 (we haven't built it yet — T1.11).

**Commit:** `chore(auth): install @supabase/ssr alongside existing Alchemy auth (T1.2)`

**Session prompt:**

> Read `docs/midnight/EXECUTION_CHECKLIST.md` step T1.2. Install `@supabase/ssr`. Create `src/middleware.ts` following the official Supabase Next.js App Router pattern ([https://supabase.com/docs/guides/auth/server-side/nextjs](https://supabase.com/docs/guides/auth/server-side/nextjs)) — refresh the session cookie on every request. Use the matcher to exclude static assets and the existing public webhooks (`/api/mvr/webhook`, `/api/psp/webhook`, `/api/cron/*`, `/api/stripe/webhook`). Create `src/lib/supabase-server.ts` and `src/lib/supabase-browser.ts` as described. Do NOT touch `<AlchemyProvider>`, any sign-in UI, or any API route. Verify the build passes and the app renders identically.

---

### T1.3 — ID alignment: ensure `users.id` = `auth.users.id`


|                        |                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------- |
| Status                 | ⚠️ Partially rolled back · 2026-05-28 — bootstrap helper kept, FK dropped (089) |
| Pre-conditions         | T1.2                                                                            |
| Estimated session size | S                                                                               |
| Pace risk              | **HIGH if FK enforced during dual-mode** — discovered the hard way 2026-05-28   |


**⚠️ INCIDENT POSTMORTEM (2026-05-28):** The 088 migration broke production new-user sign-ups within hours of deploy. Symptom: `POST /api/user/set-role` → 500 for every fresh wallet sign-in. Cause: `getOrCreateUserByWallet` inserts a fresh UUID into `public.users` with no matching `auth.users` row. The `NOT VALID` flag on the FK only skips checks against *existing* rows; new INSERTs are always enforced. Result: every new candidate hit "Internal Server Error" right after Alchemy OTP succeeded. Existing users were unaffected (their rows pre-dated the constraint).

**Resolution:** Migration `089_drop_users_auth_fk_temp.sql` drops the FK. The convention `users.id = auth.users.id` is still enforced by `lib/user-bootstrap.ts` at the code level for Supabase-Auth users. The FK will be re-added in **T1.12.1** (new step) AFTER cutover, when wallet-based user creation no longer exists.

**Lesson filed:** A FK constraint added to an existing table is **never** additive when the legacy write path doesn't satisfy it. NOT VALID protects yesterday's rows, not tomorrow's INSERTs. For Phase 1, "Category A — safe to deploy alone" requires the legacy and target write paths to BOTH satisfy any new constraint. Documented in `## Pre-deploy verification` section.

**Goal (revised):** Ship the bootstrap helper that ensures `users.id = auth.users.id` for Supabase-Auth users (code-enforced). Defer the FK constraint to T1.12.1.

**Files shipped:**

- `supabase/migrations/088_users_auth_fk.sql` — added the FK with `NOT VALID`. **Rolled back by 089.**
- `supabase/migrations/089_drop_users_auth_fk_temp.sql` — drops the FK. Active in prod.
- `src/lib/user-bootstrap.ts` — `ensureUserRow(authUserId, email)` upserts a `users` row when Supabase Auth fires a sign-up; called from the `/auth/callback` route in T1.11. **Still in place and correct.**
- `src/lib/user-bootstrap.test.ts` — 2 tests, all passing.

**DO NOT TOUCH:** `users.wallet_address` column. Existing `users` rows. Any current API route.

**Why no webhook?** With Clerk, we needed `/api/clerk/webhook` because Clerk's user table lives outside our DB. Supabase Auth's `auth.users` is in the same Postgres instance, so we only need a small bootstrap helper that runs at the auth callback.

**Where the FK enforcement lives now:** Code, not schema. `user-bootstrap.ts` always inserts with `id = authUserId` (and only fires for Supabase-Auth users, who by definition have an `auth.users` row). The legacy wallet path keeps generating fresh `users.id` UUIDs unrelated to `auth.users` until T1.12 retires it. Re-add the schema FK at **T1.12.1** once the legacy path is gone.

**Commit reference:** `feat(auth): users.id ↔ auth.users.id helper (T1.3, FK rolled back)`

---

### T1.4 — Session helper alongside wallet helper


|                        |                     |
| ---------------------- | ------------------- |
| Status                 | ✅ Done · 2026-05-28 |
| Pre-conditions         | T1.3                |
| Estimated session size | S                   |
| Pace risk              | None (additive)     |


**Goal:** Add `src/lib/auth-session.ts` exporting `getStormUserIdFromRequest(request)` which:

1. Tries the Supabase Auth session first (`supabase.auth.getUser()` from `@supabase/ssr` → returns `auth.users.id`, which equals `users.id` by T1.3 convention).
2. Falls back to the existing `x-wallet-address` header path (looks up `users.id` from `wallet_address`).
3. Returns `null` if neither resolves.

This is the dual-mode helper that every API route migration calls in T1.5–T1.8.

**Files to change:**

- `src/lib/auth-session.ts` (new)
- `src/lib/auth-session.test.ts` (new — unit tests for both paths)

**DO NOT TOUCH:** any API route yet.

**Verification:**

- Unit tests pass for: Supabase-only request, wallet-only request, both-present request (Supabase wins), neither (returns null).

**Commit:** `feat(auth): dual-mode session helper for migration (T1.4)`

**Session prompt:**

> Read `docs/midnight/EXECUTION_CHECKLIST.md` step T1.4. Create `src/lib/auth-session.ts` with `getStormUserIdFromRequest(request: NextRequest): Promise<string | null>` that tries `supabase.auth.getUser()` first using `@supabase/ssr`'s server client. If a Supabase session exists, return its `user.id` directly (no DB lookup needed — by T1.3 it equals `users.id`). Fall back to the existing `x-wallet-address` header → `users` table lookup. Add unit tests covering all four paths. Do not modify any API route.

---

### T1.5 — Migrate API routes batch 1 (candidate read routes, ~25 routes)


|                        |                                          |
| ---------------------- | ---------------------------------------- |
| Status                 | ✅ Done · 2026-05-29 · pending user commit |
| Pre-conditions         | T1.4                                     |
| Estimated session size | L (split into 2–3 sub-batches if needed) |
| Pace risk              | Low                                      |


**Goal:** Replace `request.headers.get('x-wallet-address')` + lookup with `getStormUserIdFromRequest(request)` in **candidate-side READ routes only**. Reads are lower-risk than writes if something breaks.

**Files to change (target list, mechanical):**

- `src/app/api/career-card/route.ts`
- `src/app/api/career-card/lenses/route.ts` and `[id]/route.ts`
- `src/app/api/career-card/share/route.ts`
- `src/app/api/career-card/pdf/route.ts`
- `src/app/api/driver/hub/route.ts`
- `src/app/api/driver/profile/route.ts`
- `src/app/api/driver/career-card/route.ts`
- `src/app/api/developer/hub/route.ts`
- `src/app/api/developer/resume/route.ts`
- `src/app/api/developer/profile/route.ts`
- `src/app/api/general/resume/route.ts`
- `src/app/api/resumes/route.ts` (GET only)
- `src/app/api/notifications/route.ts` (GET)
- `src/app/api/messages/route.ts` (GET)
- `src/app/api/jobs/recommended/route.ts`
- `src/app/api/job-alerts/route.ts` (GET)
- `src/app/api/applications/status/route.ts` (GET)
- `src/app/api/candidate/profile-info/route.ts`
- `src/app/api/candidate/verification/status/route.ts`
- `src/app/api/storm/history/route.ts`
- `src/app/api/referrals/route.ts` (GET)
- `src/app/api/user/profile/route.ts` (GET)
- `src/app/api/user/existing-profiles/route.ts`
- `src/app/api/ai/credits/route.ts` (GET)
- `src/app/api/hub/blocks/route.ts` (GET)

**DO NOT TOUCH:** any `/api/employer/*` route (Track 1 batch 3), any write/POST/PATCH route (batch 2), webhooks, cron routes.

**Verification:**

- `npm run typecheck` passes.
- `npm run build` passes.
- Manual smoke test: candidate hub loads with both auth paths (sign in via Alchemy AND via Supabase Auth in two browsers — both should work).

**Commit:** `refactor(auth): migrate candidate read routes to session helper (T1.5)`

**Session prompt:**

> Read `docs/midnight/EXECUTION_CHECKLIST.md` step T1.5. For each route in the file list, replace the `walletAddress = request.headers.get('x-wallet-address')` pattern with `userId = await getStormUserIdFromRequest(request)`. Preserve existing 401 behavior when null. Do not change response shapes. Do not touch any employer route, write route, webhook, or cron route. Verify typecheck + build pass after each ~5-route batch.

**Completion notes (2026-05-29):**

- **22 GET handlers migrated** across 4 sub-batches. All lint-clean; `tsc --noEmit` adds **zero** new errors (only pre-existing `developer/hub:115`, `developer/profile:~199`, `driver/hub:318-468` remain — unrelated profile-shape mismatches); `npm run build` exit 0.
- **Two `user`-resolution shapes used:** routes that only need the id call the helper and use `userId` directly; routes that need the full row (hub aggregators, share/pdf, etc.) call the helper then `select(...).eq('id', userId).single()`. The `.ilike('wallet_address', …)` lookup is gone from every migrated GET.
- **Mixed-method files — GET only migrated; POST/PATCH/DELETE left on the wallet header for T1.6** (this is the read-first risk sequencing, on purpose): `career-card/lenses`, `career-card/share`, `developer/resume`, `developer/profile`, `general/resume`, `notifications`, `messages`, `job-alerts`, `ai/credits`, `hub/blocks`. `getUserByWallet` import retained where a write in the same file still needs it.
- **Routes in the target list NOT migrated (deferred, with reason):**
  - `career-card/lenses/[id]` — **write-only** (PATCH/DELETE), no GET → T1.6.
  - `applications/status` — **PATCH-only** (checklist mislabeled it "(GET)"), no GET → T1.6.
  - `user/profile` — **no GET** (POST get-or-create + PATCH are writes) → T1.6.
  - `storm/history` — legacy STORM-on-Base; queries `storm_distributions` keyed by `wallet_address`, not user id. Migrating gives no value and the table is an Option-B removal target. Left on the wallet header; **delete in the STORM-on-Base cleanup**, not here.
- **`jobs/recommended`** — GET migrated, but still reads `x-wallet-address` for the legacy `STORMI_UNLIMITED_WALLETS` allowlist (a feature flag, not auth; no session equivalent). **Flag for T1.8** grep-cleanup.
- **`resumes` GET** — dual-mode *prepend*: try the session helper first; if it resolves, return; otherwise the entire legacy Base-signature + `upsertUser` flow is untouched. Fully behavior-preserving.
- **Decision — null-auth response standardized** to `401 { error: 'Authentication required' }`. `driver/hub` and `developer/hub` previously returned `400 "Wallet address is required"`; now 401 with neutral copy (removes user-facing "wallet" language, correct semantics, and during dual-mode only unauthenticated requests hit it). Hub "new-user empty-state" branches are preserved for the id-resolved-but-row-missing case.
- **Middleware matcher NOT re-included for `/api/*` yet** (T1.2's note said "re-include at T1.5"). Deferred on purpose: no Supabase sessions are issued until T1.11, so the helper's session path is dormant; an API route can still *validate* an existing session cookie without middleware (middleware only *refreshes* near-expiry tokens). **Re-include `/api/*` just before T1.11** to avoid re-introducing the surface that caused the T1.2 outage early.

---

### T1.6 — Migrate API routes batch 2 (candidate write routes, ~25 routes)


|                        |               |
| ---------------------- | ------------- |
| Status                 | ✅ Done · pending-commit · 2026-05-29 |
| Pre-conditions         | T1.5          |
| Estimated session size | L             |
| Pace risk              | Low           |

**Completion notes (2026-05-29):** Migrated ~45 candidate route files (all write handlers + straggler GETs T1.5 missed) to `getStormUserIdFromRequest()` via 4 parallel sub-batches + a manual straggler sweep. Three patterns used: CASE 1 lookup-only (one-line swap), CASE 2 create-on-write (session-first, `getOrCreateUserByWallet` kept as wallet fallback — `resumes/create`, `resumes/upload`, `user/profile-setup`, `driver-applications/save-progress`), CASE 3 extra-columns (resolve `userId` then `.eq('id', userId)`). `saveDriverApplicationClient()` got an optional `resolvedUserId` arg (non-breaking). **Deferred:** employer employment-verification routes (`verification/initiate|attempt|status`) → T1.7 (employer-initiated); all `admin/*` + `ai/*` → T1.8. **Skipped (legacy):** `storm/history`, USDC candidate payment routes, `user/set-role` (→ T1.11). Build green; lint-clean; zero new type errors. See `docs/CHANGES.md` for the full pattern table.


**Goal:** Same migration pattern, but for candidate-side write routes (POST/PATCH/DELETE). Higher impact if it breaks (data writes), so split into smaller sub-batches and test each.

**Files to change:** all candidate-side POST/PATCH/DELETE routes — driver-applications, hub blocks (POST/PATCH/DELETE), candidate consents, resume create/upload/verify, profile setup, avatar uploads, job alerts (POST), saved jobs, applications submit, AI chat/cover-letter/parse, etc. **Use grep to enumerate; do not skip any.**

**DO NOT TOUCH:** employer routes, webhooks, cron routes.

**Verification:**

- All typecheck + build green.
- Manual smoke: candidate can complete a DOT app step, upload a resume, save a profile field — all using BOTH old and new auth paths.

**Commit:** `refactor(auth): migrate candidate write routes to session helper (T1.6)`

---

### T1.7 — Migrate API routes batch 3 (employer routes — Pace critical)


|                        |                                                     |
| ---------------------- | --------------------------------------------------- |
| Status                 | ✅ Done · pending-commit · 2026-05-29 · **Pace live verification Monday** |
| Pre-conditions         | T1.6                                                |
| Estimated session size | L                                                   |
| Pace risk              | **HIGH** — every Pace operation flows through these |


**Goal:** Migrate all 28 employer routes to the dual-mode session helper. **Strongest model only.** Test each route after migration with Pace's actual flows.

**Completion notes (2026-05-29):** All 28 employer route files migrated to `getStormUserIdFromRequest()`. `rg "x-wallet-address" src/app/api/employer/` → **zero**. Three patterns: (1) direct `userId` for membership/company checks, (2) fetch `users.wallet_address` by id then pass to `getEmployerCompanyAccess` / `resolveEmployerCompanyForWallet` (lib unchanged), (3) company/access-request routes keep `walletAddress` variable populated from user row for legacy DB columns. Local helpers `getEmployerCompanyId` (jobs) and `getEmployerContext` (invites) now accept `employerUserId`. Auth errors standardized to `401 { error: 'Authentication required' }`. Build green. **Pace invariants I-1–I-10 not verified until Monday.**

**Files to change (all 28):**

- `src/app/api/employer/hub/route.ts`
- `src/app/api/employer/hub/blocks/route.ts` and `[id]/route.ts`
- `src/app/api/employer/applicants/route.ts`
- `src/app/api/employer/applications/[id]/route.ts` and `[id]/status/route.ts`
- `src/app/api/employer/talent/search/route.ts`, `[userId]/route.ts`, `[userId]/recruit/route.ts`, `[userId]/request/route.ts`, `[userId]/dot-app/route.ts`
- `src/app/api/employer/screenings/route.ts`, `screenings/order/route.ts`, `screenings/reconcile/route.ts`
- `src/app/api/employer/mvr/order/route.ts`
- `src/app/api/employer/psp/order/route.ts`
- `src/app/api/employer/invites/route.ts`, `invites/send-email/route.ts`
- `src/app/api/employer/jobs/route.ts` and `[id]/route.ts`
- `src/app/api/employer/team/route.ts`, `[memberId]/route.ts`, `accept-invite/route.ts`
- `src/app/api/employer/candidate-data/route.ts` and `[candidateId]/route.ts`
- `src/app/api/employer/company/route.ts`, `company/ensure-wallet/route.ts`
- `src/app/api/employer/access-request/route.ts`

**DO NOT TOUCH:** webhooks, cron routes, candidate routes (already done).

**Verification (Pace invariants I-1 through I-10):**

- Pace employer signs in (via wallet during dual-mode) and lands on hub → employer hub loads, blocks list visible
- Pace can install/uninstall an employer block → state persists
- Pace can place a test MVR order (use Accio test creds) → order row created with all expected fields
- Pace's reconcile cron fires successfully → no auth errors in logs
- Pace can send an outreach invite → email goes out, kanban tile appears
- Pace can view a candidate's career card via talent search → modal opens, data loads

**Commit:** `refactor(auth): migrate employer routes to session helper — Pace critical (T1.7)`

**Session prompt:**

> Read `docs/midnight/EXECUTION_CHECKLIST.md` step T1.7. This is Pace-critical. For each of the 28 employer routes, replace `x-wallet-address` reads with `getStormUserIdFromRequest(request)`. Preserve every existing behavior — response shapes, error codes, audit trails. After every 3-4 routes, stop and ask the user to manually run Pace's flow before continuing. Do NOT touch the screening order placement logic in `lib/place-screening-order.ts` itself — only the auth header read at the route level.

---

### T1.8 — Migrate API routes batch 4 (admin + AI + misc, ~30 routes)


|                        |               |
| ---------------------- | ------------- |
| Status                 | ✅ Done (route scope) · admin carved to T1.8-admin · 2026-05-29 |
| Pre-conditions         | T1.7          |
| Estimated session size | M             |
| Pace risk              | Low           |

**Progress (2026-05-29):** Done out-of-order ahead of T1.7 (employer held for Pace). Migrated **9 AI routes** + **`applications/status`** to `getStormUserIdFromRequest()` (CASE 1; `STORMI_UNLIMITED_WALLETS` flag header read preserved separately in 5 AI routes; `ai/chat` adds a `role` lookup). GitHub routes were already covered in T1.6.

**Closeout audit (2026-05-29):** Full `rg "x-wallet-address" src/app/api/` sweep found **3 live employer-facing routes that BOTH T1.7 and T1.8 missed** because they live under `src/app/api/verification/**` (not `employer/**`): `verification/status` (GET), `verification/initiate` (POST), `verification/attempt` (POST+PATCH) — the employer employment-verification flow (`EmployerVerificationSection`/`DriverVerificationSection` still call them). Migrated all three to `getStormUserIdFromRequest()` (dropped the `ilike('wallet_address', …)` user lookups; `status` now reads `role` by id; removed the now-unused `walletAddress` param from `getEmployerVerificationSummary`). Lint clean.

**Remaining `x-wallet-address` matches are all intentional** (verified by category): 6 = `STORMI_UNLIMITED_WALLETS` flag reads (route auth already migrated), 4 = create-on-write wallet fallback (helper-first), ~8 = stale doc-comments (code uses helper), `storm/history` = legacy STORM (Option-B removal target), `driver/public/[token]` = public share route (wallet is optional employer ID, token-based auth). **The only true holdout = the 5 admin routes** → carved into **T1.8-admin** below.

#### T1.8-admin — Admin route auth (deferred, distinct model) · ⬜ Pending
The 5 `src/app/api/admin/**` routes (`admin/jobs`, `admin/employer-requests` [+`/[id]`], `admin/companies/[id]/members` [+`/[memberId]`]) gate on the **`ADMIN_WALLETS` env allowlist** via `isAdmin(walletAddress)`, NOT per-user session resolution — so the `getStormUserIdFromRequest` swap is the wrong tool. Needs an **admin-email/role allowlist decision** first (lockout risk if done blind). Track separately from the candidate/employer cutover; the final repo-wide zero-check can't pass until this + T1.12 land.


**Goal:** Migrate remaining routes — admin, AI, GitHub, share-token, etc. Lower risk; brief verification.

**Files to change:** every remaining route from the original ~115 list that isn't covered by T1.5–T1.7. Use grep to confirm zero `x-wallet-address` remains in `src/app/api/`** after this step (except webhooks which have separate auth).

**Verification:** `rg "x-wallet-address" src/app/api/` returns only webhook / cron / public-share routes that intentionally don't use it.

**Commit:** `refactor(auth): finish API route migration to session helper (T1.8)`

---

### T1.9 — Backfill: create `auth.users` rows for existing wallet-bound users


|                        |                               |
| ---------------------- | ----------------------------- |
| Status                 | ✅ Done · 2026-05-29 · 151 created, 0 errors, missing=0, 151/151 id-aligned |
| Pre-conditions         | T1.8                          |
| Estimated session size | M                             |
| Pace risk              | Medium (touches user records) |


**Goal:** One-time script that reads existing `users` rows with `wallet_address IS NOT NULL` and no matching `auth.users.id`, then calls `supabase.auth.admin.createUser({ id: users.id, email: <eff_email>, email_confirm: false })` for each. The crucial trick: pass the existing `users.id` UUID as the new `auth.users.id` so the foreign key from T1.3 lines up automatically. After this script runs, every Storm user has both a `users` row and a matching `auth.users` row, ready for the cutover email in T1.12.

> **⚠️ CORRECTION (2026-05-29 live data audit) — implementation details in [`AUTH_BUILD_SPEC.md`](./AUTH_BUILD_SPEC.md) T1.9.** Email is in **`user_profiles.email`**, NOT `users.email` (only the 5 employers have `users.email`). Source query must `coalesce(users.email, user_profiles.email)`. Audit of 164 users: **157 with email**, **151 unique-email (would create)**, **7 ghosts** (no email/profile → skip, they re-register), **3 duplicate emails / 6 users skipped** — `dallasnash24@gmail.com`, `zaebrown444@gmail.com`, `metro@pacedrivers.com` (**Pace**) — each is one human with two wallet accounts + split data. Supabase Auth enforces unique email, so the script **skips collisions and logs them for a manual merge** (the Pace pair needs care — pick the row owning the live company/jobs/screenings). No data is at risk: all app data is keyed to `users.id` and untouched.

**Files to change:**

- `scripts/backfill-supabase-auth-users.ts` (new — one-shot, NOT a long-running migration)
- `package.json` script entry: `"backfill:auth-users": "tsx scripts/backfill-supabase-auth-users.ts"`

**DO NOT TOUCH:** `wallet_address` (preserved for fallback during T1.13 cutover).

**Verification:**

- Script dry-run output shows expected count of users to create.
- Wet run completes with zero errors; spot-check 5 random users — Supabase Dashboard → Authentication → Users shows the account, the `auth.users.id` matches the existing `users.id`.

**Commit:** `chore(auth): backfill auth.users rows for existing users (T1.9)`

**Session prompt:**

> Read `docs/midnight/EXECUTION_CHECKLIST.md` step T1.9. Create `scripts/backfill-supabase-auth-users.ts` using `@supabase/supabase-js` with the service-role key. Query `users WHERE wallet_address IS NOT NULL AND email IS NOT NULL`. For each, check if `auth.users` already has a row with that id (admin API). If not, call `supabase.auth.admin.createUser({ id: user.id, email: user.email, email_confirm: false, user_metadata: { migrated_from: 'wallet' } })`. Log each row processed. Add a `--dry-run` flag that just counts. Run with `npm run backfill:auth-users -- --dry-run` first.

---

### T1.10 — Update useAuthStore to read Supabase Auth session


|                        |               |
| ---------------------- | ------------- |
| Status                 | ✅ Done · pending-commit · 2026-05-29 |
| Pre-conditions         | T1.9          |
| Estimated session size | M             |
| Pace risk              | Medium        |


**Goal:** `useAuthStore` currently exposes `walletAddress`. Add a parallel `sessionUserId` populated from Supabase's `supabase.auth.getUser()` (via `@supabase/ssr`'s browser client). Components keep reading `walletAddress` during transition; new code uses `sessionUserId`.

**✅ Shipped as (differs from original plan — implementation simpler + reuses bootstrap):**

- `src/stores/auth-store.ts` — added `sessionUserId: string | null` + `setSessionUserId` (NOT persisted — hydrated live). Done.
- `src/hooks/use-supabase-auth-sync.ts` (new) — subscribes to `onAuthStateChange`, sets `sessionUserId`, and bridges Supabase users into the wallet-shaped store via an `auth:<userId>` placeholder address so existing wallet-keyed UI keeps working in dual-mode. Calls `/api/auth/sync` to bootstrap the `public.users` row.
- `src/app/api/auth/sync/route.ts` (new) — gets the Supabase user from the session cookie, calls `ensureUserRow()` (service-role) to guarantee `public.users.id == auth.users.id`.
- `src/app/page.tsx` — calls `useSupabaseAuthSync()` (line ~105); `handleLogout` now also calls Supabase `signOut()`.
- Original plan used a `layout.tsx` subscription; we used a hook in `page.tsx` instead (cleaner — keeps the server-component layout untouched).

**Verification:** Build green, lint clean. Live verify deferred to T1.11c smoke test (needs the sign-in front door wired).

**Commit:** `feat(auth): expose sessionUserId + Supabase session bridge (T1.10)`

---

### T1.11 — Build sign-in / sign-up UI (split into a/b/c)


|                        |                            |
| ---------------------- | -------------------------- |
| Status                 | ✅ **Done (a + b + c)** · 2026-05-30 |
| Pre-conditions         | T1.10                      |
| Estimated session size | M                          |
| Pace risk              | Medium (visible UI change) |


**Goal:** Drop the Alchemy SDK sign-in widget. Build a sign-in page using Storm's existing UI primitives. Wallet-based sign-in still works during T1.12 via dual-mode, but the UI no longer offers it.

> **Design change (2026-05-29, user-approved):** went **passwordless** — Google + email OTP code, **no passwords**. This mirrors the previous Alchemy experience (Google or an emailed code), keeps Storm out of the password-reset helpdesk business, and makes sign-in and sign-up the same flow (a new email auto-creates the account via `shouldCreateUser: true`). The a/b/c descriptions below were updated to match what actually shipped (the original spec said email/password + magic link + forgot-password).

> **Why split into a/b/c:** the form markup (a) is high-volume low-risk → Auto. The callback route (b) handles `@supabase/ssr` cookie exchange → security-sensitive, premium. The `page.tsx` gating (c) is the **user-visible flip** that decides whether people see Supabase or Alchemy on boot → premium, done last + behind a smoke test. Splitting keeps the dangerous part isolated.

#### T1.11a — Sign-in form UI · Owner: Auto → revised PREMIUM · ✅ Done · 2026-05-29
- `src/app/sign-in/page.tsx` (new, later rewritten passwordless) — **Google OAuth + email OTP code**. Two-step OTP UX (enter email → `signInWithOtp({ shouldCreateUser: true })` → enter 6-digit code → `verifyOtp({ type: 'email' })`) with resend / use-different-email. Built on `@/components/ui` (`Card`, `Button`, `Input`).
- `src/app/sign-up/page.tsx` — collapsed to a redirect → `/sign-in` (passwordless = no separate registration).
- `src/components/ui/Input.tsx` (new) — shared input primitive (label + error + dark mode).

#### T1.11b — Auth callback route · Owner: PREMIUM · ✅ Done · 2026-05-29
- `src/app/auth/callback/route.ts` (new) — `exchangeCodeForSession(code)` via the server `@supabase/ssr` client, sets cookies, redirects to `next` or `/`; errors redirect to `/sign-in?error=...`. Handles Google OAuth **and** the OTP email link (users who click instead of typing the code). User-row bootstrap happens in `/api/auth/sync` (T1.10), not here.

#### T1.11c — `page.tsx` gating (dual-door) · Owner: PREMIUM · ✅ Done · 2026-05-30
**Shipped — `/sign-in` is the default front door.** DEC: **dual door** (user-approved) so Pace is never locked out before the coordinated T1.12 cutover.
- `src/app/page.tsx` — unauthenticated visitors are redirected to `/sign-in`, **gated on `sessionSettled && !user && !sessionUserId && !isConnected && !showGuidedMode && !walletMode`**. `!isConnected` keeps a returning Alchemy user (Pace) from being bounced mid-restore; **`!sessionUserId` + `supabaseSessionChecked`** (added in the redirect-loop fix) keep a returning Supabase user from being bounced before their session resolves. A `<LoadingScreen>` covers the settle+redirect+hydration window so neither the Alchemy landing nor a blank hub flashes.
- **Escape hatches preserved:** `?wallet=1` → legacy Alchemy login in DriverShell; `?guided=1` → Guided Mode job browsing.
- `src/app/sign-in/page.tsx` — self-correcting session guard (already-authed → home) + escape-hatch links.

**Bug fixes folded in during live testing (all shipped 2026-05-29 → 30, see `docs/CHANGES.md`):**
1. **Migrated-wallet role lookup** — `/api/user/profile` now resolves by Supabase session id first (was wallet-only → migrated employers like Pace got a false role picker). `/api/auth/sync` returns the DB `wallet_address`; the sync hook seeds the client store with it.
2. **`/sign-in` ↔ `/` redirect loop** (flashing nav/spinner) — two sources of truth for "authenticated." Added `supabaseSessionChecked` + `!sessionUserId` guard so the pages can't ping-pong.
3. **Prod-only OTP flicker** — OTP success used a soft `router.push('/')`; both auth providers stayed alive in one JS context and raced. Switched to `window.location.assign('/')` (hard nav, matches OAuth).

**Config completed (dashboard, not code):**
- **Resend Custom SMTP** wired into Supabase Auth (built-in sender is throttled ~few/hour → 429s during testing).
- **Magic Link email template** includes `{{ .Token }}` so OTP codes actually send.
- **Google OAuth live** — Google Cloud client created, consent screen published to Production, verified working in prod with a real (non-test) user. Supabase Google provider ON; redirect allow-list set.

**Middleware `/api/*` re-include:** still **owned by T1.12** (running `updateSession` on Pace-critical Accio/Stripe webhooks belongs with the coordinated cutover; session *reads* already work without it).

**Verification:** ✅ New email → OTP code → candidate hub. ✅ Migrated employer (Pace owner) → straight to employer hub, no role picker. ✅ Google → hub. ✅ Alchemy still works via `?wallet=1` (dual-mode). ✅ No flicker after hard-nav fix.

**Commit:** `feat(auth): passwordless sign-in (Google + OTP) on Supabase Auth (T1.11)`

---

### T1.12 — Cutover email + AlchemyProvider removal


|                        |                                     |
| ---------------------- | ----------------------------------- |
| Status                 | 🟡 In progress — **T1.12c auth cutover shipped (scoped)**; client header cleanup (T1.12b) + full SDK/provider removal (T1.12d) deferred |
| Pre-conditions         | T1.11, Pace stakeholder coordinated |
| Estimated session size | M                                   |
| Pace risk              | **HIGH** — point of no return       |


> **Cutover email simplified by passwordless (2026-05-29):** there are **no passwords**, so there is **no "forgot password" reset flow** to trigger. Existing users just go to `/sign-in` and enter their existing email (OTP) or use Google with the same email — the T1.9 backfill already aligned `auth.users.id = users.id`, so their data attaches automatically on first OTP/Google sign-in. The "cutover email" becomes a simple **"we've upgraded sign-in — use your email or Google, no password needed"** notice, not a reset link.

**Goal:** Send the upgrade notice, wait 24–48h for adoption, then retire the Alchemy path: re-include `/api/*` in middleware, remove `AlchemyProvider`, drop `@account-kit/*`, delete the `x-wallet-address` fallback from `getStormUserIdFromRequest`, and untangle the client from `walletAddress`.

**⚠️ Why this is NOT a single Auto task:** removing the wallet fallback is the point of no return, and the client still depends on the wallet in many places (`page.tsx` Alchemy hooks; `EmployerHub`, `DriverShell`, `hub-blocks-store`, `StormiChatPanel`, several hooks still send `x-wallet-address`). `page.tsx`'s entire auth section is built on `@account-kit/react` hooks — deleting the provider is **surgery, not a mechanical delete**. Sequence it as sub-steps; premium + Pace-coordinated.

**Sub-steps (proposed):**
- **T1.12-pre — Alchemy/wallet blast-radius inventory** (read-only, Auto-safe). A complete list of every `@account-kit`, `AlchemyProvider`, `x-wallet-address`, and `walletAddress`-dependent touchpoint so the cutover has an exact map. No code changes. *(Auto prompt written 2026-05-30.)*
- **T1.12a — Middleware `/api/*` re-include** ✅ **Done · pending user commit · 2026-05-30.** Matcher now includes `/api/*` so `updateSession` refreshes the Supabase cookie on authenticated API calls. Accio webhook entrypoints (`api/webhooks/*`, `api/mvr/webhook`, `api/psp/webhook`) + `api/github/callback` are **excluded** — they carry no user session and `updateSession` never reads the body, so the Pace XML callbacks are byte-for-byte unchanged. No Stripe webhook exists yet. Matcher validated against sample paths; lint clean. (`src/middleware.ts`.)
- **T1.12b — Drop client wallet dependence.** ⬜ **Not started (now Auto-safe).** Migrate remaining ~92 client fetches off `x-wallet-address`; the server no longer reads the header (T1.12c dropped the fallback), so same-origin fetches authorize via the session cookie. **EXCLUDE** `src/components/admin/**` + `src/lib/admin-auth.ts` (still wallet-gated until T1.8-admin) and `/api/storm/history` + `/api/driver/public/[token]`. Mechanical — hand to Auto (prompt in the cutover plan). Do **not** strip `walletAddress` from stores/props here.
- **T1.12c — Supabase-only auth cutover (scoped).** ✅ **Done · pending user commit · 2026-05-30.** Made Supabase the only login WITHOUT removing the SDK/provider (kept mounted; company-wallet/payment plumbing is its own epic — see T1.12d). Shipped: `/sign-in` + `/auth/callback` honor a same-origin `next` (open-redirect guarded); `page.tsx` rewritten Supabase-only (deleted the 6 `@account-kit` hooks, the Alchemy session-sync effect, the 1.5s timer, the `?wallet=1` dual-door; `sessionSettled` now derives from `supabaseSessionChecked`; logout = `supabase.auth.signOut()`); `DriverShell` lost its `AlchemyAuth` widget + `onAuthSuccess`; `onboard/[token]` + `invite/[token]` now **redirect unauthenticated users to `/sign-in?next=`** and resume setup from the session (wallet resolved like `useSupabaseAuthSync` — DB wallet or `auth:<uuid>`); `AdminDashboardShell` reads `useWalletAddress()` from the persisted store instead of Alchemy `useAccount`; **wallet fallback removed from `auth-session.ts`** → Supabase-session-only (unit tests rewritten, 3 pass). Verified `accept-invite`'s on-chain `addOwnerToCompanyWallet` is best-effort (try/catch, never blocks the invite). Personal wallet UI gone: `UserStatusModal` → plain account modal (email + sign out); nav STORM pill removed; `HubAccountSection` → referrals only; `EmployerHub` personal `STORMBalance` removed; deleted `STORMBalance`, `USDCBalance`, `wallet/SendUSDC`, `wallet/SendSTORM`, `WalletTransactions`, `use-storm-token-balance`. `npm run build` green. `AlchemyAuth.tsx` is now orphaned (left for T1.12d). (`page.tsx`, `sign-in/page.tsx`, `auth/callback/route.ts`, `DriverShell.tsx`, `onboard/[token]/page.tsx`, `invite/[token]/page.tsx`, `AdminDashboardShell.tsx`, `auth-session.ts`(+test), `UserStatusModal.tsx`, `Navigation.tsx`, `navigation-styles.ts`, `HubAccountSection.tsx`, `CandidateHub.tsx`, `EmployerHub.tsx`.)
- **T1.12d — Company-wallet/payment teardown + full `@account-kit` removal.** ⬜ **Deferred — tied to the Midnight/Stripe decision.** Remove `AlchemyProvider` from `layout.tsx`, drop `@account-kit/*` + `alchemy-sdk`, delete `company-wallet-server.ts` + company shared-wallet provisioning + the now-inert `MvrPaymentButton`/`PspPaymentButton`/`StormiCreditModal`, and delete the orphaned `AlchemyAuth.tsx`. Blocked on whether Stripe-only transactions remove company wallets entirely.
- Optionally: drop `users.wallet_address` column (or leave for historical reference; deprecate in docs).

**DO NOT TOUCH:** keep each sub-step scoped to its own commit.

**Verification:**

- `rg "AlchemyProvider|account-kit" src/` returns zero matches **only after T1.12d** (intentionally still present after the scoped T1.12c cutover — provider stays mounted for the company-wallet epic).
- `rg "x-wallet-address" src/` drops to the admin + `storm/history` + `driver/public/[token]` allowlist after **T1.12b**.
- `npm run build` passes. *(T1.12c: ✅ green.)*
- Pace stakeholder confirms employer team can sign in. *(T1.12c manual gate — pending.)*

**Commit:** `chore(auth): remove Alchemy SDK after Supabase Auth cutover (T1.12)`

---

### T1.12.1 — Re-add `users.id ↔ auth.users.id` FK (the deferred T1.3 enforcement)


|                        |                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Status                 | 🟡 **Ready to apply via dashboard (MCP is read-only).** Hard gate showed 14 orphans (2026-05-30). Shipped: (1) orphan-_prevention_ code fix (`getOrCreateUserByWallet` resolves `auth:<uuid>` by id, never mints fresh-UUID rows); (2) migration **093** (orphan cleanup, owner-approved) + **094** (VALIDATED FK). **Boss runs 093 → re-run gate (must be 0) → 094 in the Supabase SQL editor.** |
| Pre-conditions         | T1.12 (wallet path retired), T1.9 (all existing users backfilled into `auth.users`) |
| Estimated session size | S                                                                                   |
| Pace risk              | None — FK now matches reality on every row                                          |


**Goal:** Re-introduce the FK that was rolled back by 089. By T1.12, no more `users` rows can be created without a matching `auth.users` row, so the constraint becomes safe.

> **⛔ 2026-05-30 gate result — DO NOT apply the FK yet.** The hard-gate query returned **14** orphan `public.users` rows (no matching `auth.users`). Breakdown:
> - **1 spurious duplicate** (`cbe37aa1…`, role `candidate`, wallet `auth:5f49469b…`, created today 02:16, **0 child rows**) — minted by the bug below; safe to delete.
> - **~11 legacy wallet-only candidates** with `email = NULL` — cannot be backfilled into `auth.users` (no email/phone). Decision needed: delete (likely abandoned) vs. keep + FK `NOT VALID`.
> - **2 `metro@pacedrivers.com`** employer rows (no `auth.users`) — **not** the Pace owner. Confirm with boss whether `metro` is a used login before deleting.
> - **Pace owner `s.blaha@pacedrivers.com`** (`5f49469b`) is **correctly aligned** (canonical row + auth row + `companies.employer_user_id`) — signs in fine.
>
> **Root cause of new orphans (FIXED in code 2026-05-30):** `getOrCreateUserByWallet`, given an `auth:<uuid>` placeholder, INSERTed a fresh-UUID row instead of resolving by `id = <uuid>`. Now it resolves/creates by auth id (`src/lib/user-by-wallet.ts`). This stops the bleeding; existing orphans still need cleanup before the FK.
>
> **Owner decisions (2026-05-30):** delete the legacy null-email orphans; `metro@pacedrivers.com` is a test employee, data unimportant → delete too. Authored as migration **093** (transactional cleanup across all 36 user-referencing columns; asserts 0 orphans before COMMIT) + **094** (VALIDATED FK — fails loudly if any orphan remains).
>
> **Remaining order:** (1) ✅ prevention fix (`user-by-wallet.ts`) → (2) ✅ migrations 093+094 authored → (3) **boss runs 093 in dashboard** → (4) **re-run gate (must be 0)** → (5) **boss runs 094**. MCP is read-only so steps 3+5 are manual (same as 089).

**Files to change:**

- New migration: `supabase/migrations/XXX_users_auth_fk_final.sql`
  ```sql
  ALTER TABLE public.users
    ADD CONSTRAINT users_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users (id)
    ON DELETE CASCADE;  -- NOT 'NOT VALID' this time — every row must satisfy
  ```

**Pre-flight check before applying:**

```sql
SELECT COUNT(*) FROM public.users u
LEFT JOIN auth.users a ON a.id = u.id
WHERE a.id IS NULL;
-- MUST return 0. If non-zero, T1.9 backfill missed rows — fix before adding FK.
```

**Verification:**

- Migration runs. New sign-up still works (it goes through Supabase Auth → `ensureUserRow`, never violates FK).
- `pg_constraint` shows `users_id_fkey` exists and is `convalidated = true`.

**Commit:** `feat(auth): re-enable users ↔ auth.users FK now that wallet path is retired (T1.12.1)`

---

### T1.13 — Wallet UI removal


|                        |                                            |
| ---------------------- | ------------------------------------------ |
| Status                 | ⬜ Not started                              |
| Pre-conditions         | T1.12                                      |
| Estimated session size | M                                          |
| Pace risk              | Low (UI surface only — no behavior change) |


**Goal:** Delete every wallet-flavored UI component: `WalletCard`, `STORMBalance`, `USDCBalance`, `TransactionHistory`, `SendUSDC`, `SendSTORM`, Coinbase Onramp integration, wallet hub block. Replace dashboard surfaces with simple account info.

**Files to change:**

- Delete `src/components/WalletCard.tsx`, `STORMBalance.tsx`, `USDCBalance.tsx`, `TransactionHistory.tsx`, `wallet/SendUSDC.tsx`, `wallet/SendSTORM.tsx`
- Delete `src/app/api/wallet/`*
- Update `src/components/HubAccountSection.tsx` (or equivalent) — remove wallet card; show plain "Account" with email + sign-out
- Update `useAuthStore` — drop `walletAddress` field entirely

**Verification:** Hub renders without wallet UI. No TypeScript errors. No 404s in dev console.

**Commit:** `chore(ui): remove wallet UI after auth cutover (T1.13)`

---

### T1.14 — Passwordless polish (passkeys + OTP)

|                        |                                                    |
| ---------------------- | -------------------------------------------------- |
| Status                 | ⬜ Not started (OTP shipped; passkeys deferred)     |
| Pre-conditions         | T1.12 cutover stable                               |
| Estimated session size | M                                                  |
| Pace risk              | Low (additive auth method)                         |

**Context:** Sign-in is already **passwordless** — Google + email OTP code shipped 2026-05-29 (per user: "use google and email OTP… I don't want to manage passwords"). Password sign-in/sign-up removed; `/sign-up` redirects to `/sign-in`. This step is the remaining polish.

**Required config (do once, before relying on OTP in prod):**
- Supabase **Auth → Email Templates → "Magic Link"** must include `{{ .Token }}` so users receive the 6-digit code (default template only renders `{{ .ConfirmationURL }}`). Optionally keep the link too (belt-and-suspenders: code-typers and link-clickers both work via `/auth/callback`).

**Goal (passkeys):** Add WebAuthn passkeys as a phishing-resistant, no-email-roundtrip option alongside Google + OTP.
- Requires a `@supabase/supabase-js` bump (passkey APIs are newer/experimental) — do **after** T1.12 so the cutover stays boring.
- Add "Sign in with a passkey" + an enroll prompt in account settings.

**Verification:** New email gets a 6-digit code and signs in; Google works; (passkeys) enroll + sign-in on a passkey-capable device.

**Commit:** `feat(auth): passkey sign-in + OTP polish (T1.14)`

---

## Track 2 — Stripe payments (USDC → cards)

**Goal:** Replace USDC-on-Base payment flows with Stripe Checkout (one-time MVR/PSP) and Stripe Subscriptions (employer plans). Dual-mode during cutover so Pace's pending orders never lose state.

> **Pace billing deferral (DEC-2026-05-006):** Build the full Stripe capability — Checkout, Subscriptions, webhooks, customer portal — but **do not bill Pace at cutover time**. Pace continues operating without a Stripe subscription during the transition; their billing transition is a separate stakeholder conversation. New / non-Pace customers use Stripe from day one. The technical effect on this track: T2.10 still flips the UI to Stripe for everyone, but Pace places MVR/PSP orders via an admin-internal "free placement" path until they're explicitly onboarded to billing in a future, separate step.

### T2.1 — Stripe account + SDK install


|                        |                                                  |
| ---------------------- | ------------------------------------------------ |
| Status                 | ⬜ Not started                                    |
| Pre-conditions         | P0.3 confirmed; can run in parallel with Track 1 |
| Estimated session size | S                                                |
| Pace risk              | None                                             |


**Goal:** Stripe account configured (test + live). Install `stripe` server SDK + `@stripe/stripe-js` client SDK. Add env vars.

**Files to change:** `package.json`, `.env.example`, Vercel env (test mode only for now).

**Verification:** `import Stripe from 'stripe'` resolves; `stripe.products.list({})` works in a scratch script with the test key.

**Commit:** `chore(payments): install Stripe SDK (T2.1)`

---

### T2.2 — Stripe customer columns + webhook signing


|                        |                |
| ---------------------- | -------------- |
| Status                 | ⬜ Not started  |
| Pre-conditions         | T2.1           |
| Estimated session size | S              |
| Pace risk              | Low (additive) |


**Goal:** Migration adds `users.stripe_customer_id` and `companies.stripe_customer_id` (both text, nullable, unique). Add `STRIPE_WEBHOOK_SECRET` env var.

**Files to change:** `supabase/migrations/XXX_stripe_customer_ids.sql`, `.env.example`.

**Commit:** `feat(payments): add stripe_customer_id columns (T2.2)`

---

### T2.3 — Stripe webhook endpoint


|                        |                    |
| ---------------------- | ------------------ |
| Status                 | ⬜ Not started      |
| Pre-conditions         | T2.2               |
| Estimated session size | M                  |
| Pace risk              | Low (new endpoint) |


**Goal:** `/api/stripe/webhook` handles `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_succeeded`, `charge.refunded`. Routes to handler functions; logs everything with `[STRIPE WEBHOOK]` prefix.

**Files to change:**

- `src/app/api/stripe/webhook/route.ts` (new)
- `src/lib/stripe-webhook-handlers.ts` (new — one handler per event type)

**Add to middleware:** `/api/stripe/webhook` is a public route (Stripe signs it; the Supabase Auth middleware should not gate it — exclude it via the matcher in T1.2).

**Verification:** Stripe CLI `stripe listen --forward-to localhost:3000/api/stripe/webhook` + `stripe trigger checkout.session.completed` → handler logs the event.

**Commit:** `feat(payments): Stripe webhook endpoint with event routing (T2.3)`

---

### T2.4 — MVR Checkout flow


|                        |                                   |
| ---------------------- | --------------------------------- |
| Status                 | ⬜ Not started                     |
| Pre-conditions         | T2.3                              |
| Estimated session size | M                                 |
| Pace risk              | **High** — Pace orders MVRs daily |


**Goal:** Replace `MvrPaymentButton` with a button that POSTs to `/api/employer/screenings/checkout-session` to create a Stripe Checkout session, then redirects. Webhook on `checkout.session.completed` calls existing `placeScreeningOrder` (which today expects `payment_tx_hash` — add a `stripe_session_id` parameter alongside; both work during transition).

**Files to change:**

- `src/components/employer/MvrPaymentButton.tsx` → replace internals (keep export name temporarily)
- `src/app/api/employer/screenings/checkout-session/route.ts` (new)
- `src/lib/place-screening-order.ts` — accept optional `stripeSessionId` (preserves `paymentTxHash`)
- `src/app/api/stripe/webhook/route.ts` — wire `checkout.session.completed` handler to `placeScreeningOrder`

**DO NOT TOUCH:** `lib/place-screening-order.ts` Accio integration; webhook validation logic.

**Verification:** Stripe test card → MVR order created in DB with `stripe_session_id` populated → Accio receives the order → existing reconcile flow works unchanged.

**Commit:** `feat(payments): MVR purchase via Stripe Checkout (T2.4)`

---

### T2.5 — PSP Checkout flow


|                        |               |
| ---------------------- | ------------- |
| Status                 | ⬜ Not started |
| Pre-conditions         | T2.4          |
| Estimated session size | M             |
| Pace risk              | High          |


**Goal:** Same as T2.4, but for PSP orders. Same `place-screening-order` plumbing.

**Files to change:** `PspPaymentButton.tsx`, optionally a unified `screenings/checkout-session/route.ts` if it cleanly handles both.

**Commit:** `feat(payments): PSP purchase via Stripe Checkout (T2.5)`

---

### T2.6 — Subscription Checkout for employer plans


|                        |               |
| ---------------------- | ------------- |
| Status                 | ⬜ Not started |
| Pre-conditions         | T2.5          |
| Estimated session size | M             |
| Pace risk              | Medium        |


**Goal:** Stripe Products + Prices for the existing $9.99/mo candidate verify plan and the $199/mo employer plan. Subscription Checkout flow. Webhook updates `companies.subscription_status` / `users.subscription_status`.

**Files to change:**

- Stripe Dashboard: create Products + Prices, capture IDs in env
- `src/app/api/stripe/subscribe/route.ts` (new)
- `src/lib/stripe-webhook-handlers.ts` — subscription-event handlers
- Migration: add `users.subscription_status`, `companies.subscription_status` columns if not present

**Commit:** `feat(payments): subscription Checkout for employer plans (T2.6)`

---

### T2.7 — Saved payment methods (SetupIntent)


|                        |               |
| ---------------------- | ------------- |
| Status                 | ⬜ Not started |
| Pre-conditions         | T2.6          |
| Estimated session size | S             |
| Pace risk              | Low           |


**Goal:** Capture a payment method via SetupIntent on first payment so subsequent MVRs/PSPs are one-click charges via PaymentIntent.

**Commit:** `feat(payments): saved payment methods via SetupIntent (T2.7)`

---

### T2.8 — Stripe customer portal


|                        |               |
| ---------------------- | ------------- |
| Status                 | ⬜ Not started |
| Pre-conditions         | T2.7          |
| Estimated session size | S             |
| Pace risk              | None          |


**Goal:** Self-service plan changes / cancellations / payment-method updates via Stripe's hosted portal.

**Commit:** `feat(payments): Stripe customer portal link (T2.8)`

---

### T2.9 — Refund handler


|                        |               |
| ---------------------- | ------------- |
| Status                 | ⬜ Not started |
| Pre-conditions         | T2.8          |
| Estimated session size | S             |
| Pace risk              | Low           |


**Goal:** `charge.refunded` webhook flips affected order rows to `refunded` status; surfaces a refunded badge in employer hub.

**Commit:** `feat(payments): handle Stripe refunds (T2.9)`

---

### T2.10 — Disable USDC payment paths in UI


|                        |                                                        |
| ---------------------- | ------------------------------------------------------ |
| Status                 | ⬜ Not started                                          |
| Pre-conditions         | T2.9 + Pace stakeholder confirmed comfortable on cards |
| Estimated session size | M                                                      |
| Pace risk              | High                                                   |


**Goal:** Remove USDC payment buttons / Coinbase Onramp from the UI. Keep `payment_tx_hash` columns nullable for legacy data display. Leave the `placeScreeningOrder` `paymentTxHash` parameter accessible by admin tools but stop calling it from the UI.

**Files to change:** every USDC payment component reference; `MvrPaymentButton`/`PspPaymentButton` final form.

**Verification:** No USDC payment surface anywhere in the UI. Pace's existing `mvr_orders` rows with `payment_tx_hash` still display correctly in admin views.

**Commit:** `chore(payments): disable USDC payment UI after Stripe cutover (T2.10)`

---

## Track 3 — Document storage (IPFS → Supabase Storage)

### T3.1 — Supabase Storage buckets + RLS


|                        |                                 |
| ---------------------- | ------------------------------- |
| Status                 | ⬜ Not started                   |
| Pre-conditions         | none (parallel with Tracks 1+2) |
| Estimated session size | S                               |
| Pace risk              | None                            |


**Goal:** Three buckets: `resumes` (private, RLS by `users.id`), `dot-applications` (private, RLS), `screening-reports` (private, employer-scoped RLS by `mvr_orders.requested_by_user_id`).

**Commit:** `feat(storage): Supabase Storage buckets with RLS (T3.1)`

---

### T3.2 — `lib/document-storage.ts` server helpers


|                        |                 |
| ---------------------- | --------------- |
| Status                 | ⬜ Not started   |
| Pre-conditions         | T3.1            |
| Estimated session size | S               |
| Pace risk              | None (additive) |


**Goal:** `uploadDocument(userId, kind, file)`, `getSignedUrl(path, expirySeconds)`, `deleteDocument(path)`. Wraps Supabase Storage client.

**Commit:** `feat(storage): document-storage helpers (T3.2)`

---

### T3.3 — Dual-write upload paths


|                        |               |
| ---------------------- | ------------- |
| Status                 | ⬜ Not started |
| Pre-conditions         | T3.2          |
| Estimated session size | M             |
| Pace risk              | Medium        |


**Goal:** Update every upload code path to write to BOTH Supabase Storage and IPFS during transition. Reads still go to IPFS (until T3.5 cutover).

**Files to change:** `src/app/api/resumes/upload/route.ts`, `src/components/UploadResumeModal.tsx`, `ResumeUploadWithPrefill.tsx`, etc. — every file that calls `lib/ipfs.ts`.

**Verification:** New uploads land in BOTH stores; existing data unchanged.

**Commit:** `feat(storage): dual-write uploads to IPFS + Supabase Storage (T3.3)`

---

### T3.4 — Backfill: IPFS → Supabase Storage


|                        |                  |
| ---------------------- | ---------------- |
| Status                 | ⬜ Not started    |
| Pre-conditions         | T3.3             |
| Estimated session size | M                |
| Pace risk              | Low (background) |


**Goal:** One-shot script reads every `resumes.ipfs_hash`, fetches from Pinata gateway, uploads to Supabase Storage, populates a new `resumes.storage_path` column (additive migration).

**Commit:** `chore(storage): backfill existing docs from IPFS to Supabase Storage (T3.4)`

---

### T3.5 — Cutover: switch read paths to Supabase Storage


|                        |                                                                        |
| ---------------------- | ---------------------------------------------------------------------- |
| Status                 | ⬜ Not started                                                          |
| Pre-conditions         | T3.4 + spot-check 100+ random docs accessible via Supabase signed URLs |
| Estimated session size | M                                                                      |
| Pace risk              | Medium                                                                 |


**Goal:** Every UI surface that previously rendered IPFS gateway URLs now reads via `getSignedUrl()`. Share-card download links updated.

**Commit:** `feat(storage): cutover doc reads to Supabase Storage (T3.5)`

---

### T3.6 — Stop dual-writing, remove Pinata


|                        |                      |
| ---------------------- | -------------------- |
| Status                 | ⬜ Not started        |
| Pre-conditions         | T3.5 + 1 week stable |
| Estimated session size | M                    |
| Pace risk              | Low                  |


**Goal:** Remove the IPFS write half of dual-write. Delete `lib/ipfs.ts`. Drop `pinata-web3` from `package.json`. Remove Pinata env vars.

**Commit:** `chore(storage): remove Pinata after Supabase Storage cutover (T3.6)`

---

### T3.7 — Update share card / public URLs


|                        |               |
| ---------------------- | ------------- |
| Status                 | ⬜ Not started |
| Pre-conditions         | T3.6          |
| Estimated session size | S             |
| Pace risk              | None          |


**Goal:** Audit every place that constructs IPFS gateway URLs (`gateway.pinata.cloud/ipfs/...`); replace with signed URL helpers. Some legacy share tokens may need a rewrite path.

**Commit:** `chore(storage): replace IPFS gateway URLs with signed URLs (T3.7)`

---

## Track 4 — On-chain registry decommission

### T4.1 — Audit + archive Sepolia records


|                        |                                                                           |
| ---------------------- | ------------------------------------------------------------------------- |
| Status                 | ⬜ Not started                                                             |
| Pre-conditions         | T2.10 (don't decommission while orders still depend on `payment_tx_hash`) |
| Estimated session size | S                                                                         |
| Pace risk              | None                                                                      |


**Goal:** Count records in `ResumeRegistry` and `ProductionDriverRegistry`. If material, copy metadata into a new Supabase `legacy_chain_records` table for historical reference. If minimal (likely), document in `DECISION_LOG.md` and skip the table.

**Commit:** `docs(legacy): audit + archive Sepolia registry data (T4.1)`

---

### T4.2 — Refactor `/api/resumes/[id]/verify`


|                        |               |
| ---------------------- | ------------- |
| Status                 | ⬜ Not started |
| Pre-conditions         | T4.1          |
| Estimated session size | M             |
| Pace risk              | Low           |


**Goal:** Drop the blockchain branch. Verification becomes a placeholder (DB flag) until Phase 2 attestation flow ships. The route still exists; the on-chain part is removed.

**Files to change:** `src/app/api/resumes/[id]/verify/route.ts`, remove `lib/resume-registry-onchain.ts` import.

**Verification:** "Verify" button still produces a verified state (DB flag); no on-chain call attempted.

**Commit:** `refactor(verify): drop blockchain branch from resume verify (T4.2)`

---

### T4.3 — Delete `/api/blockchain/`* routes


|                        |               |
| ---------------------- | ------------- |
| Status                 | ⬜ Not started |
| Pre-conditions         | T4.2          |
| Estimated session size | S             |
| Pace risk              | None          |


**Goal:** Delete `/api/blockchain/submit-driver-application/route.ts`, `/api/blockchain/verify-resume/route.ts`. Search for callers; remove or redirect.

**Commit:** `chore(legacy): remove /api/blockchain/* routes (T4.3)`

---

### T4.4 — Delete chain helpers


|                        |               |
| ---------------------- | ------------- |
| Status                 | ⬜ Not started |
| Pre-conditions         | T4.3          |
| Estimated session size | S             |
| Pace risk              | None          |


**Goal:** Delete `lib/resume-registry-onchain.ts`, `lib/driver-contract.ts`, `lib/contract.ts`, `lib/contract-constants.ts`, `lib/typed-data.ts` (verify each is unused after T4.2/T4.3).

**Commit:** `chore(legacy): remove chain helper modules (T4.4)`

---

### T4.5 — Archive contract source


|                        |               |
| ---------------------- | ------------- |
| Status                 | ⬜ Not started |
| Pre-conditions         | T4.4          |
| Estimated session size | S             |
| Pace risk              | None          |


**Goal:** Move `contracts/` → `contracts/legacy/`. Move deploy scripts. Add a `contracts/legacy/README.md` explaining the archive.

**Commit:** `chore(legacy): archive Solidity contract source (T4.5)`

---

### T4.6 — Drop `ethers` dependency


|                        |               |
| ---------------------- | ------------- |
| Status                 | ⬜ Not started |
| Pre-conditions         | T4.5          |
| Estimated session size | S             |
| Pace risk              | None          |


**Goal:** `npm uninstall ethers viem` (verify no remaining imports). Remove `NEXT_PUBLIC_RESUME_REGISTRY_ADDRESS`, `NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS`, `ALCHEMY_BASE_SEPOLIA_URL`, `PRIVATE_KEY` env vars from Vercel.

**Verification:** `rg "from 'ethers'\\|from 'viem'" src/` returns zero matches.

**Commit:** `chore(deps): remove ethers + viem (T4.6)`

---

## Track 5 — STORM token drop on Base (Midnight reissue option preserved)

> **Scope:** This track drops the **Base Sepolia STORM ERC-20** and replaces user-facing rewards with off-chain `users.storm_points`. It does **NOT** foreclose a future Midnight-native STORM reissue in Phase 3 — see `[DECISION_LOG.md](./DECISION_LOG.md)` DEC-2026-05-005. Contract source moves to `contracts/legacy/` rather than being deleted, because the ERC-20 supply / vesting model may inform a Midnight design later.

> **Schema hygiene note for T5.1:** Design `storm_points_ledger` so every credit / debit row is a candidate for a future on-chain mint. Each row should have a stable `id` (UUID), `reason` (string), `source` (string — e.g. `placement_completion`, `referral_bonus`), `delta` (BIGINT, can be negative), and `created_at`. If Phase 3 ever ships a Midnight STORM, a snapshot of this ledger maps directly to mint operations. Don't optimize for this now — just don't make it impossible.

(Skip this entire track if pre-flight P0.2 chooses **defer** instead of **drop on Base**.)

### T5.1 — `users.storm_points` migration


|                        |               |
| ---------------------- | ------------- |
| Status                 | ⬜ Not started |
| Pre-conditions         | T4.6          |
| Estimated session size | S             |
| Pace risk              | None          |


**Goal:** `users.storm_points` BIGINT default 0; `storm_points_ledger` append-only audit table.

**Commit:** `feat(rewards): storm_points + ledger schema (T5.1)`

---

### T5.2 — `lib/storm-points.ts` helpers


|                        |               |
| ---------------------- | ------------- |
| Status                 | ⬜ Not started |
| Pre-conditions         | T5.1          |
| Estimated session size | S             |
| Pace risk              | None          |


**Goal:** `creditPoints(userId, delta, reason, source)`, `getBalance(userId)`, `getLedger(userId, limit)`.

**Commit:** `feat(rewards): storm-points helpers (T5.2)`

---

### T5.3 — Replace earning logic


|                        |               |
| ---------------------- | ------------- |
| Status                 | ⬜ Not started |
| Pre-conditions         | T5.2          |
| Estimated session size | M             |
| Pace risk              | Low           |


**Goal:** Wherever `RewardDistributor.distribute()` was called server-side, replace with `creditPoints()`.

**Commit:** `refactor(rewards): on-chain STORM → off-chain points (T5.3)`

---

### T5.4 — Replace STORMBalance UI


|                        |               |
| ---------------------- | ------------- |
| Status                 | ⬜ Not started |
| Pre-conditions         | T5.3          |
| Estimated session size | S             |
| Pace risk              | None          |


**Goal:** UI shows "Storm Points: X" instead of token balance.

**Commit:** `feat(rewards): show Storm Points in UI (T5.4)`

---

### T5.5 — Remove STORM hooks + APIs


|                        |               |
| ---------------------- | ------------- |
| Status                 | ⬜ Not started |
| Pre-conditions         | T5.4          |
| Estimated session size | S             |
| Pace risk              | None          |


**Goal:** Delete `useStormTokenBalance`, `lib/storm-contract.ts`, `/api/storm/distribute`, etc.

**Commit:** `chore(rewards): remove STORM token client code (T5.5)`

---

### T5.6 — Archive STORM contracts


|                        |               |
| ---------------------- | ------------- |
| Status                 | ⬜ Not started |
| Pre-conditions         | T5.5          |
| Estimated session size | S             |
| Pace risk              | None          |


**Goal:** Move `StormToken.sol`, `RewardDistributor.sol`, `TreasuryDistributor.sol`, `FounderVesting.sol` to `contracts/legacy/` (alongside T4.5).

**Commit:** `chore(legacy): archive STORM token contracts (T5.6)`

---

## Track 6 — Cleanup, polish, ship

### T6.1 — End-to-end QA: candidate flows


|                        |               |
| ---------------------- | ------------- |
| Status                 | ⬜ Not started |
| Pre-conditions         | T5.6          |
| Estimated session size | L (manual)    |


Sign up → fill DOT app → upload resume → request screening → invite check. Document any rough edges as new steps.

---

### T6.2 — End-to-end QA: employer flows (Pace critical)


|                        |                               |
| ---------------------- | ----------------------------- |
| Status                 | ⬜ Not started                 |
| Pre-conditions         | T6.1                          |
| Estimated session size | L (manual + Pace stakeholder) |


Walk Pace's full daily workflow with a stakeholder. **Do not declare done without their sign-off.**

---

### T6.3 — Dependency audit


|                |               |
| -------------- | ------------- |
| Status         | ⬜ Not started |
| Pre-conditions | T6.2          |


Remove unused: `@account-kit/`*, `pinata-web3`, `ethers`, `viem`, anything else flagged by `depcheck`.

**Commit:** `chore(deps): remove unused crypto-era packages (T6.3)`

---

### T6.4 — Env var cleanup


|        |               |
| ------ | ------------- |
| Status | ⬜ Not started |


Remove every crypto-related env var from Vercel + `.env.example`.

**Commit:** `chore(env): remove legacy crypto env vars (T6.4)`

---

### T6.5 — Setup / deployment docs


|        |               |
| ------ | ------------- |
| Status | ⬜ Not started |


Update `docs/SETUP.md`, `docs/DEPLOYMENT.md`. Phase 1 stack only.

---

### T6.6 — Homepage + marketing copy


|        |               |
| ------ | ------------- |
| Status | ⬜ Not started |


Remove "blockchain", "wallet", "USDC" language. Per `strategic-direction.mdc` language rules.

**Commit:** `feat(copy): Phase 1 marketing language reset (T6.6)`

---

### T6.7 — Production deploy


|           |               |
| --------- | ------------- |
| Status    | ⬜ Not started |
| Pace risk | **HIGH**      |


Tag `v2.0.0-phase1`. Deploy. Smoke test with Pace stakeholder live.

---

### T6.8 — Pace check-in + Phase 1 retrospective


|        |               |
| ------ | ------------- |
| Status | ⬜ Not started |


Confirm Pace is fully migrated and operating well. Write Phase 1 retro entry in `docs/CHANGES.md`. Then unlock Phase 2 work.

---

## Phase 2 — Selective-disclosure UX (high-level only)

Atomic step list will be written when Phase 1 wraps. High-level tracks:


| Track   | Goal                                                                                                                                          | Effort |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **T7**  | `attestationService` interface + `attestations` table + signed-JWT implementation                                                             | 1 week |
| **T8**  | Fact registry (`FactType` enum + `FactDefinition` map per `[attestation-architecture.mdc](../../.cursor/rules/attestation-architecture.mdc)`) | 1 week |
| **T9**  | Carrier-facing fact panels (replace PDF-first verification UI on career card modal)                                                           | 1 week |
| **T10** | Candidate disclosure toggles (per-audience disclosure preferences)                                                                            | 1 week |


**Pre-condition for T7:** Phase 1 fully shipped + 1 week production-stable.

**T7 schema hygiene (forward-compat for Phase 4 cached-attestation marketplace per DEC-2026-05-013):** The `attestations` table must include fields that enable future cached re-querying without rework — at minimum `issued_at`, `valid_until` (e.g., MVR + 30 days), `source_cra` (e.g., `'accio'`), `source_pull_id` (Accio order ID), and a query-count column for marketplace metering. Don't build the marketplace; just don't make it impossible. See `[ARCHITECTURE.md](./ARCHITECTURE.md)` "Future considerations" for the full Phase 4 sketch.

---

## Phase 3 — Midnight ZK (deferred)

Atomic steps will be written when Phase 3 trigger fires. See `[ARCHITECTURE.md](./ARCHITECTURE.md)` for trigger criteria. **Do not start Phase 3 work until trigger is concrete.**

### Phase 3b / Phase 4 future considerations (captured, NOT scheduled)

Three deferred economic features are documented but explicitly NOT in the work queue:

- **Phase 3b SBT credentials** — soulbound representation of Phase 3a attestations (DEC-2026-05-012)
- **Phase 3b STORM-on-Midnight reissue** — shielded utility token (DEC-2026-05-005 Option B + DEC-2026-05-012)
- **Phase 4 cached-attestation marketplace** — driver economic compounding via Storm-mediated cached re-queries (DEC-2026-05-013)

Each has explicit trigger conditions in its decision-log entry. **Do not add atomic steps for any of these here until the relevant triggers fire.** Engineering view: `[ARCHITECTURE.md](./ARCHITECTURE.md)` "Future considerations". Boss-facing summary: `[TOKEN_BRIEF.md](./TOKEN_BRIEF.md)`.

---

## Rollback playbook

When something breaks, follow this order:

### Level 1 — Revert the commit

If the most recent commit broke a flow:

```
git revert HEAD
git push
```

Vercel auto-redeploys. **This is safe at any time during the migration** because every step is dual-mode or strictly additive until cutover.

### Level 2 — Roll back a cutover

If a cutover step (T1.12, T2.10, T3.5/T3.6) broke production:

1. Revert the cutover commit.
2. Pace's old-path code still works (it was preserved during dual-mode).
3. Diagnose, fix, re-attempt the cutover in a follow-up commit.

### Level 3 — Database rollback

Migrations during Phase 1 are **always additive** (new columns, never DROP, never CHANGE TYPE on existing data). Revert is safe:

```
supabase migration repair {migration_name} --status reverted
```

If a migration accidentally DROPped or CHANGEd data, restore from Supabase backup (point-in-time recovery is enabled). **Don't write destructive migrations during Phase 1.** If a column needs to go, write the cutover step first; drop in a separate commit days later.

### Level 4 — Pace emergency

If Pace is fully blocked from operating:

1. **Roll back to the last known good commit** even if it loses a day's progress.
2. Email Pace stakeholder immediately: what broke, when it'll be fixed, what to do in the meantime.
3. Open a `BLOCKER` entry at the top of this doc with status, owner, ETA.
4. Do not attempt forward-fix without verifying the rollback restored their flows.

---

## Session handoff log

Every AI session that does work on this checklist appends one entry here. Newest at top.


| Date       | Step(s)                                                        | Model           | Commit                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | -------------------------------------------------------------- | --------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-30 | T1.12.1-pre — FK gate + orphan-prevention fix + migrations 093/094 | Claude Opus 4.8 | pending user commit       | **Ran the T1.12.1 hard gate via Supabase MCP → 14 orphan `public.users` rows (no `auth.users`). FK NOT auto-applied** (would fail / lock users out; MCP is read-only anyway). **Root cause fixed in code:** `getOrCreateUserByWallet` given an `auth:<uuid>` placeholder was INSERTing a fresh-UUID row (orphan) instead of resolving by `id=<uuid>`; now routes through new `getOrCreateAuthUserById` (pins `id` to the auth uuid, race-safe upsert). Gated to `auth:` placeholders only — `0x…` path unchanged; protects all 13 callers. Build green. **Owner decided** delete legacy null-email orphans + metro test rows → authored **093** (transactional cleanup of 14 orphans across 36 user-ref columns; asserts 0 before COMMIT) + **094** (VALIDATED FK, fails loudly on any orphan). **Pace owner `s.blaha` aligned (fine Monday); no orphan owns a company; no mvr_orders/payments among them.** **Did NOT** drop `walletAddress` (T1.13 — blocked on T1.12b) or bump supabase-js (T1.14 passkeys — post-cutover). **Next (manual, dashboard):** run 093 → re-run gate (=0) → run 094. Then Auto T1.12b. |
| 2026-05-30 | T1.12c — Supabase-only auth cutover (scoped)                   | Claude Opus 4.8 | pending user commit           | **Made Supabase the only login** (SDK/provider intentionally **kept mounted** — company-wallet/payment is its own epic, T1.12d). `/sign-in`+`/auth/callback` honor a same-origin `next` (open-redirect guarded; `?wallet=1` link removed). **`page.tsx` rewritten Supabase-only:** deleted the 6 `@account-kit` hooks, the Alchemy session-sync effect, the 1.5s timer, the `didExplicitLogoutRef` logic, and the `?wallet=1` dual-door; `sessionSettled = supabaseSessionChecked`; logout = `supabase.auth.signOut()`. **`DriverShell`** lost `AlchemyAuth` + `onAuthSuccess` (+ the personal `WalletTransactions` on the resume page). **`onboard/[token]` + `invite/[token]`** now redirect unauthed users to `/sign-in?next=` and resume setup from the session (wallet resolved like `useSupabaseAuthSync`: DB wallet or `auth:<uuid>`); verified `accept-invite`'s on-chain `addOwnerToCompanyWallet` is best-effort (try/catch). **`AdminDashboardShell`** now reads `useWalletAddress()` from the persisted store (boss DB wallet ∈ `ADMIN_WALLETS`, so `requireAdmin` still works; proper allowlist = future T1.8-admin). **Point of no return: dropped the `x-wallet-address` fallback from `auth-session.ts`** → session-only (tests rewritten, 3 pass). **Personal wallet UI removed:** `UserStatusModal`→plain account modal, nav STORM pill gone, `HubAccountSection`→referrals only, `EmployerHub` personal `STORMBalance` gone; **deleted** `STORMBalance`/`USDCBalance`/`wallet/SendUSDC`/`wallet/SendSTORM`/`WalletTransactions`/`use-storm-token-balance` (+ orphaned `navStormPillClass`). `npm run build` green. `AlchemyAuth.tsx` now orphaned (→T1.12d). **Manual gate still pending:** real OTP/Google → hub, invite round-trip, admin load, waived screening order (Pace Monday). **Next: T1.12b** (Auto-safe client header cleanup) then **T1.12d** (provider/SDK + company-wallet teardown). |
| 2026-05-30 | T1.12-pre inventory + T1.12a middleware                        | Claude Opus 4.8 | pending user commit           | **T1.12-pre:** produced `docs/midnight/T1_12_BLAST_RADIUS.md` (read-only) — full Alchemy/wallet touchpoint map. Counts: **@account-kit/SDK** 23 files, **Alchemy hooks** 11 files (heaviest `page.tsx` w/ 6 hooks), **client `x-wallet-address` senders** 92 files, **API readers** 26, **`walletAddress` identity reads** 87 files. Wallet-only API routes flagged (5 admin + `storm/history` + `driver/public/[token]`). **T1.12a (shipped):** `src/middleware.ts` matcher now **includes `/api/*`** for Supabase cookie refresh, but **excludes** the Accio webhook entrypoints (`api/webhooks/*`, `api/mvr/webhook`, `api/psp/webhook`) + `api/github/callback` — `updateSession` only reads cookies (never the body), so Pace XML callbacks are unchanged. No Stripe webhook exists yet. Matcher regex validated vs sample paths; lint clean; `next.config` already `ignoreBuildErrors`. **Next: T1.12b** (migrate 92 client senders off wallet header → cookie session) **then T1.12c** (remove Alchemy SDK + delete wallet fallback in `auth-session.ts`) — both premium + Pace-coordinated + Vercel preview. |
| 2026-05-30 | T1.11c closeout (+ passwordless pivot, live fixes)             | Claude Opus 4.8 | pending user commit           | **T1.11 marked ✅ Done (a+b+c).** Reconciled the spec to what shipped: **passwordless Google + email OTP** (no passwords; `/sign-up` → redirect). Folded in three live-testing fixes: (1) migrated-wallet **role lookup** by session id in `/api/user/profile`; (2) **`/sign-in`↔`/` redirect loop** fixed via `supabaseSessionChecked` + `!sessionUserId` guard; (3) **prod OTP flicker** fixed via hard-nav (`window.location.assign`). Dashboard config done: **Resend SMTP**, **OTP `{{ .Token }}` template**, **Google OAuth published to prod** (verified with a real non-test user). Middleware `/api/*` re-include stays owned by **T1.12**. Rewrote T1.12 into sub-steps (pre/a/b/c) — point of no return + `page.tsx` is built on account-kit hooks (surgery, not a mechanical Auto delete). **Next: T1.12-pre inventory (Auto), then T1.12a middleware (premium, Pace-coordinated).** |
| 2026-05-29 | T1.8 (partial: AI + misc)                                      | Claude Opus 4.8 | pending user commit           | Done ahead of T1.7 (employer held for Pace). Migrated **9 AI routes** (`cover-letter`, `parse-resume`, `chat`, `draft-lens`, `job-talking-points`, `interview-prep-quiz`, `extract-job-requirements`, `social-posts`, `credits` POST) + **`applications/status`** PATCH to `getStormUserIdFromRequest`. Preserved `STORMI_UNLIMITED_WALLETS` flag (separate header read, not auth) in 5 AI routes; `ai/chat` adds a `role` lookup; `extract-job-requirements` dropped its unused user lookup. **Admin routes DEFERRED** to a dedicated admin-auth step — they use `ADMIN_WALLETS` env allowlist (`isAdmin(wallet)`), not per-user resolution, so the helper swap is the wrong tool (lockout risk). Build green · lint clean · 0 new type errors. T1.8 status → 🟡 Partial. **Next: T1.7 (employer, needs user go-ahead + Mon Pace test) OR T1.9 backfill.** |
| 2026-05-29 | Alchemy CORS hotfix + T1.6                                     | Claude Opus 4.8 | pending user commit           | **(1) Prod login hotfix (not a T-step):** Alchemy tightened CORS on the bare `base-sepolia.g.alchemy.com/v2` node endpoint — its `Authorization: Bearer` preflight now 401s with no `Access-Control-Allow-Origin`, breaking `eth_getCode` → infinite retry storm → "exceeded concurrent requests." Fix: split transport in `alchemy-account-config.ts` (signer keeps `apiKey`; node RPC routes through key-in-path `nodeRpcUrl` which passes CORS) + 15s retry-storm watchdog in `AlchemyAuth.tsx`. **Verified in real browser from prod origin**: key-in-path → 200, bare+Bearer → `Failed to fetch`. NOT caused by our T-steps (broke with no deploy). **(2) T1.6:** migrated ~45 candidate write routes (+ straggler GETs) to `getStormUserIdFromRequest` via 4 parallel sub-batches + manual sweep. 3 patterns (lookup-only / create-on-write fallback / extra-columns). `saveDriverApplicationClient` got optional `resolvedUserId`. Employer verification routes → T1.7; admin+AI → T1.8; legacy (storm/history, USDC pay, set-role) skipped. Build green · lint clean · 0 new type errors. **Next: T1.7 (employer routes — Pace-critical).** |
| 2026-05-29 | T1.5 + deploy-sequencing doc                                   | Claude Opus 4.8 | pending user commit           | Migrated **22 candidate read (GET) routes** to `getStormUserIdFromRequest` in 4 sub-batches (career-card cluster, driver, developer/general/resumes, notifications/messages/jobs/candidate, storm/referrals/user/ai/hub). Mixed-method files: GET only (writes → T1.6). Deferred: `lenses/[id]`, `applications/status`, `user/profile` (no GET / write-only); **skipped** `storm/history` (legacy wallet-keyed STORM, Option-B removal target). `jobs/recommended` still reads wallet header for `STORMI_UNLIMITED_WALLETS` (flag T1.8). Null-auth standardized to `401 {error:'Authentication required'}` (was `400` on two hub routes). Middleware `/api/*` matcher **deliberately left excluded** until T1.11 (sessions dormant pre-cutover). Lint clean · tsc 0 new errors · build green. Also added the **"Deploy sequencing & release gates"** section (two-speed plumbing-vs-cutover, incognito new-user gate, T1.12 backfill SQL gate). **Next: T1.6 (candidate write routes).** |
| 2026-05-28 | T1.3 rollback (089)                                            | Claude Opus 4.7 | applied to prod via dashboard | **Second prod outage from T1 deploy.** New users hitting `/api/user/set-role` → 500 immediately after Alchemy OTP. Cause: 088's FK enforces every new INSERT (NOT VALID only skips existing rows), and the legacy wallet path generates `users.id` UUIDs with no `auth.users` row. Fix: migration 089 drops the FK. Bootstrap helper from T1.3 stays — it'll do code-level enforcement for Supabase-Auth users. Re-added T1.12.1 to put the FK back AFTER cutover. Added pre-deploy verification rule: NOT VALID does not make a FK additive. |
| 2026-05-28 | T1.4                                                           | Claude Opus 4.7 | pending user commit           | `src/lib/auth-session.ts` + 5 unit tests (all passing). Public `getStormUserIdFromRequest` + testable internal `resolveStormUserId(request, { supabaseSession, supabaseAdmin })` with explicit-deps shape so tests don't need `vi.mock`. Supabase session wins; wallet header fallback; null when neither resolves. Pure additive — nothing imports it yet. **Safe to deploy alone (Category A).** Next: T1.5 in batches.                                                                                                                     |
| 2026-05-28 | T1.2 hotfix                                                    | Claude Opus 4.7 | pending user commit           | **Prod outage post-T1 deploy.** Users hit "Internal Server Error" / Alchemy `code:16` on OTP submit. Cause: `@supabase/ssr` 0.10.3 dropped the deprecated `get/set/remove` cookies API; `utils/supabase/middleware.ts` was still using it and threw on every request → all page loads 500'd. Migrated middleware + server client to `getAll/setAll`, wrapped middleware in try/catch with env-var guard, excluded `/api/`* from the matcher (Phase 1 dual-mode uses `x-wallet-address`; re-include at T1.5). Build green. T1.2 stays ✅ Done.  |
| 2026-05-27 | T1.3                                                           | Composer        | pending user commit           | `088_users_auth_fk.sql` (FK NOT VALID); `user-bootstrap.ts` + tests. `auth:{uuid}` placeholder for auth-only rows until wallet column nullable. Apply migration on remote manually. **Next: T1.4.**                                                                                                                                                                                                                                                                                                                                           |
| 2026-05-23 | T1.2                                                           | Composer        | pending user commit           | Root `src/middleware.ts`; `@supabase/ssr` ^0.10.3; `lib/supabase-`* re-exports. Build OK. T1.1 still 🟡 (Google OAuth incomplete).                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-05-22 | Pre-flight P0.1–P0.3 + Track 1 rewrite (Clerk → Supabase Auth) | Claude Opus 4.7 | n/a (docs only)               | All three pre-flight decisions resolved. Track 1 rewritten throughout: T1.1 dashboard config (no Clerk account), T1.2 `@supabase/ssr` install, T1.3 collapsed from "user-sync webhook" to "ID alignment migration" because `auth.users.id` IS `users.id`, T1.4 Supabase-first session helper, T1.9 backfill via `supabase.auth.admin.createUser`, T1.11 custom forms with Storm UI primitives. Net: Track 1 shrinks slightly + becomes simpler (no svix, no email-as-join-key). Pace-critical files still untouched.                          |
| 2026-05-22 | doc-creation (this file)                                       | Claude Opus 4.7 | n/a                           | Initial checklist authored. Phase 1 not yet started. Pre-flight decisions still pending.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |


---

## Open questions / things to revisit

- ~~**Auth provider final pick**~~ — ✅ resolved 2026-05-22: **Supabase Auth** (DEC-2026-05-008)
- ~~**STORM token fate**~~ — ✅ resolved 2026-05-22: **Option B** (drop Base, off-chain points, Midnight reissue optional in Phase 3) (DEC-2026-05-005)
- ~~**Stripe shape**~~ — ✅ resolved 2026-05-22: Checkout one-time + Subscriptions; Pace billing deferred (DEC-2026-05-006)
- **Pace stakeholder timing** — when's the right moment to brief them on auth cutover? Suggest: after T1.9 backfill completes successfully and before T1.11 sign-in UI ships.
- **Pace billing onboarding step** — When does Pace transition off the admin-internal "free placement" path onto Stripe? Track separately from this checklist (out of Phase 1 scope per DEC-2026-05-006).
- `**users.wallet_address` after T1.12** — drop the column or keep for historical? Default keep, mark deprecated in `block-development.mdc`.
- **Existing share tokens** — public share URLs (`/card/[token]`) currently work without auth. Phase 1 should preserve this. T1.2 middleware matcher must include `/card/`*, `/d/*`, `/dev-card/*`, `/c/*`, `/onboard/*` in the public path list.

---

**Document conventions:**

- Status icons: ⬜ Not started · 🟡 In progress · ✅ Done · ❌ Blocked · ⏸ Deferred
- Step IDs are stable (T1.5 stays T1.5 even if reordered)
- Commit messages follow the prescribed format so `git log --oneline` doubles as the migration audit trail
- Date format: ISO `YYYY-MM-DD`

**Last updated:** 2026-05-23