# Auth Build Spec — Supabase login (T1.9–T1.11)

**Purpose:** an implementer-grade spec so **Cursor Auto** can write most of the Supabase-login code while a **stronger model audits**. The `EXECUTION_CHECKLIST.md` is the *tracker* (status + why); this is the *build doc* (exact contracts + verification). Read both.

## How to use this (the workflow)

1. **Auto implements** one task at a time, in order. Auto must follow the contract exactly and run the **Verify** command before moving on.
2. **A stronger model audits** against the **Audit checklist** at the bottom — build + grep + manual smoke, not a full re-read.
3. **Tasks marked `PREMIUM`** are security-sensitive net-new code (auth callback, `page.tsx` gating). **Auto: skip these, leave a `// TODO(premium)` stub** — a stronger model writes them.

## Golden rules for Auto on this repo (non-negotiable)

- **UI:** use `@/components/ui` primitives only — `Button`, `Card`, `Input` (grep `src/components/ui` first to confirm exact names/props). **No raw `<button>`/`<input>`** with inline Tailwind. See `.cursor/rules/ui-components.mdc`.
- **Dark mode:** every element needs `dark:` variants. No bare `bg-white`/`text-black`.
- **TypeScript:** no `any`. Fix type errors, don't suppress.
- **DO NOT TOUCH:** `AlchemyProvider.tsx`, `@account-kit/*`, any `src/app/api/employer/**`, webhooks. Alchemy stays as the dual-mode fallback — we are *adding beside it*, not removing it.
- **After each task:** run `npm run build` (must exit 0). If a contract is ambiguous, **STOP and ask** — do not guess.
- **Supabase clients already exist:** browser = `createClient()` from `@/utils/supabase/client`; server = the client in `@/utils/supabase/server`. Do not create new ones.

---

## Task allocation

| Task | Owner | Why |
|---|---|---|
| T1.9 backfill script | Auto | Mechanical script, exact query given below |
| ~~T1.10 session→store wiring~~ | ✅ **PREMIUM DONE** | Store field + `use-supabase-auth-sync` hook + callback + `/api/auth/sync` (see below) |
| T1.11a sign-in / sign-up form UI | Auto | High-volume, low-risk markup with `@/components/ui` |
| ~~T1.11b auth callback route~~ | ✅ **PREMIUM DONE** | `src/app/auth/callback/route.ts` written |
| ~~T1.11c session auth wiring~~ | ✅ **PREMIUM DONE** | placeholder-wallet bridge in `page.tsx` + hook |
| T1.7 employer route migration | Auto | Mechanical pattern-copy; separate guarded brief below |
| Middleware `/api/*` re-include | **PREMIUM** | Caused the T1.2 prod outage; deferred — not needed for fresh-token testing |

### ✅ Premium-done (2026-05-29) — Auto must NOT rebuild these

The Supabase-session→store bridge is already written. **Auto: do not create a `SupabaseSessionProvider` or touch session/store wiring — it exists.** Files:
- `src/stores/auth-store.ts` — `sessionUserId` + `setSessionUserId` added.
- `src/hooks/use-supabase-auth-sync.ts` — session → store bridge; gives Supabase users the `auth:<userId>` placeholder wallet so the wallet-keyed client works unchanged. Already called in `page.tsx`.
- `src/app/auth/callback/route.ts` — OAuth/magic-link/reset code exchange.
- `src/app/api/auth/sync/route.ts` — runs `ensureUserRow` for every sign-in method (auth via cookie, write via admin client).
- `page.tsx` — calls the hook + logout now also `supabase.auth.signOut()`.

**What this means for Auto's T1.11a:** just build the sign-in/sign-up forms that call the Supabase client methods below. On success, the hook handles everything else (store, bootstrap, redirect-to-hub via `router.push('/')`). Do not wire the store yourself.

---

## T1.9 — Backfill `auth.users` for existing users  · Owner: Auto

**⚠️ Checklist correction:** email is in **`user_profiles.email`**, NOT `users.email` (only 5 employers have `users.email`). Data audit (2026-05-29): 164 users → **157 migratable**, **7 ghosts** (no email/profile — skip), **3 duplicate emails** (`dallasnash24@gmail.com`, `zaebrown444@gmail.com`, `metro@pacedrivers.com` — **Pace**). Supabase Auth requires unique email, so **the script must skip duplicates and log them for a manual merge** — it must NOT create an auth user for a colliding email.

**File:** `scripts/backfill-supabase-auth-users.ts` (new) + `package.json` script `"backfill:auth-users": "tsx scripts/backfill-supabase-auth-users.ts"`

**Contract:**
- Use `@supabase/supabase-js` with the **service-role key** (admin API).
- Source query (effective email + collision detection):
  ```sql
  select u.id,
         lower(coalesce(nullif(trim(u.email),''), nullif(trim(p.email),''))) as eff_email
  from public.users u
  left join public.user_profiles p on p.user_id = u.id
  where coalesce(nullif(trim(u.email),''), nullif(trim(p.email),'')) is not null;
  ```
- In JS: group by `eff_email`. For any email with >1 user → **skip all of them**, push to a `collisions` list.
- For each unique-email user: check `auth.users` for a row with that `id`; if absent, call
  `supabase.auth.admin.createUser({ id: user.id, email: eff_email, email_confirm: false, user_metadata: { migrated_from: 'wallet' } })`.
  **The `id` MUST equal the existing `users.id`** — this is what preserves all their data.
- `--dry-run` flag: print counts (`would create`, `already exists`, `skipped collisions`, `skipped no-email`) and the collision list. **No writes.**

**Verify:** `npm run backfill:auth-users -- --dry-run` → prints **151** "would create", **7** skipped no-email, **3** collision emails (**6** users). Do NOT run the wet pass without sign-off (`--execute`).

---

## T1.10 — `sessionUserId` in `useAuthStore` + session listener  · Owner: Auto

**File 1 — `src/stores/auth-store.ts`:**
- Add to `AuthState`: `sessionUserId: string | null` (init `null`).
- Add to `AuthActions`: `setSessionUserId: (id: string | null) => void` → `set({ sessionUserId: id })`.
- In `logout`, reset `sessionUserId: null` (it spreads `initialState`, so just ensure `initialState` has it).
- **Do NOT add `sessionUserId` to `partialize`** — it is derived live from the Supabase session, never persisted.

**File 2 — `src/components/SupabaseSessionProvider.tsx` (new client component):**
- `'use client'`. On mount: `const supabase = createClient()`; call `supabase.auth.getUser()` → `setSessionUserId(user?.id ?? null)`.
- Subscribe: `supabase.auth.onAuthStateChange((_event, session) => setSessionUserId(session?.user?.id ?? null))`. Unsubscribe on unmount.
- Renders `{children}` (pass-through wrapper). No UI.

**File 3 — `src/app/layout.tsx`:** mount `<SupabaseSessionProvider>` around the app (inside the existing provider tree; do NOT remove `AlchemyProvider`).

**Why a separate component, not in layout directly:** `layout.tsx` is a server component; `onAuthStateChange` needs `'use client'` + an effect. Keeping it in its own file is the clean way to add client behavior to a server-rendered layout.

**Verify:** `npm run build` exit 0. Manual: after a Supabase sign-in (once T1.11 exists), `useAuthStore.getState().sessionUserId` is populated; Alchemy-only sign-in leaves it `null` (fine — dual-mode).

---

## T1.11a — Sign-in / sign-up UI  · Owner: Auto

**Status:** ✅ Done · 2026-05-29

**Files:** `src/app/sign-in/page.tsx`, `src/app/sign-up/page.tsx` (both `'use client'`).

**Contract:**
- Build with `@/components/ui` (`Card`, `Button`, `Input` — grep to confirm). Match the app's existing visual style; full dark-mode support.
- `const supabase = createClient()`.
- **Sign-in** offers three paths:
  - Email + password → `supabase.auth.signInWithPassword({ email, password })`
  - Google → `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: \`${location.origin}/auth/callback\` } })`
  - Magic link → `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: \`${location.origin}/auth/callback\` } })`
- **Sign-up:** `supabase.auth.signUp({ email, password, options: { emailRedirectTo: \`${location.origin}/auth/callback\` } })`.
- On password sign-in success → `router.push('/')`. OAuth/magic-link redirect themselves through the callback.
- Show inline error text on failure (use the error message from Supabase). Loading state on the submit button (`Button` has `isLoading`).
- Link between the two pages ("Need an account? Sign up" / "Have an account? Sign in").
- "Forgot password?" → `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${location.origin}/auth/callback\` })`. (This is how backfilled users set their first password.)

**Verify:** `npm run build` exit 0; both routes render; no console errors. (End-to-end login is verified after T1.11b.)

---

## T1.11b — Auth callback route  · Owner: **PREMIUM** (Auto: skip, stub only)

**File:** `src/app/auth/callback/route.ts`. GET handler: read `code` from query, exchange via the **server** Supabase client (`@/utils/supabase/server`) `exchangeCodeForSession(code)`, then `ensureUserRow(supabase, user.id, user.email)` (from `@/lib/user-bootstrap`), then redirect to the `next` param or `/`. Must handle the error case (redirect to `/sign-in?error=...`). Cookie handling via `@supabase/ssr` is the sensitive part — premium writes it.

## T1.11c — `page.tsx` gating  · Owner: **PREMIUM**

Redirect unauthenticated users to `/sign-in` without breaking the existing Alchemy connect effects, guided mode, or the `'signin'` `PageType`. Premium writes this.

## T1.7 — Employer route migration (28 routes)  · Owner: Auto · **Pace-critical**

Pure pattern-copy, identical to the T1.5/T1.6 migrations already in the repo (use any migrated candidate route as the reference). Dual-mode safe → won't break Pace's current wallet login, but **cannot be verified against live Pace flows until Monday**, so migrate now, mark "pending Pace verification."

**Pattern (per route):** replace `const walletAddress = request.headers.get('x-wallet-address')` + the null-check + any `getUserByWallet(...)`/`ilike('wallet_address', ...)` lookup with:
```ts
import { getStormUserIdFromRequest } from '@/lib/auth-session'
const userId = await getStormUserIdFromRequest(request)
if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
```
If the handler needs more than the id (email/role/company), resolve `userId` then `.eq('id', userId)`. Preserve every response shape, status code, and audit-trail write exactly.

**Files:** the 28 routes listed under T1.7 in `EXECUTION_CHECKLIST.md`.

**DO NOT TOUCH (Pace-critical internals — auth header only, never the logic):** `src/lib/place-screening-order.ts`, `reconcile-pending-screenings.ts`, `accio-*`, `sync-outreach-invite-status.ts`, `employer-*`. Do not touch webhooks/cron.

**Verify:** `npm run build` exit 0 after each ~4-route batch; `rg "x-wallet-address" src/app/api/employer/` trends to zero. **Stop and report** after every 4 routes — do not power through all 28 silently.

---

## Middleware `/api/*` re-include  · Owner: **PREMIUM** · do LAST

Re-including `/api` in the matcher is what caused the **T1.2 outage**. It is now `try/catch`-wrapped, but still: exclude `api/webhooks` (Stripe/Accio/Alchemy callbacks have no Supabase cookie). Optional for tonight's testing (fresh tokens don't need refresh for hours). Premium decides + writes.

---

## Audit checklist (the reviewer runs this — not a full re-read)

- [ ] `npm run build` exits 0.
- [ ] `rg "from '@/components/ui'" src/app/sign-in src/app/sign-up` — UI uses primitives, no raw `<button>`/`<input>`.
- [ ] No `any`; no `dark:`-less elements in the new UI.
- [ ] `AlchemyProvider` + `@account-kit/*` still present (dual-mode intact); no `src/app/api/employer/**` touched.
- [ ] **Smoke (new account):** sign up with a fresh email → land on hub → `auth.users` has the row → `public.users` row created by `ensureUserRow` with **matching id** → refresh page, still signed in → logout works.
- [ ] **Smoke (dual-mode):** existing Alchemy/wallet login still works unchanged.
- [ ] Store: `sessionUserId` populated on Supabase login, `null` on Alchemy-only (both acceptable).

---

**Status:** Pre-build (spec written 2026-05-29). Data audit numbers from live DB same day.
