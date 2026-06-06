# Supabase cleanup — Phase A runbook (Pace-safe)

**Date drafted:** 2026-06-05  
**Audience:** engineering running manual SQL in Supabase dashboard  
**Goal:** Remove low-risk cruft (duplicate Accio result rows, incomplete signups, missing profiles, dead functions) **without touching Pace operational data.**

---

## Pace context (read first)

| Fact | Value |
|---|---|
| Company | **Pace Drivers** (`a292d466-00d3-4aa5-a4b2-5263d79266c6`) |
| Employer MVR orders | **204 / 204** (100% Pace-scoped) |
| Employer PSP orders | **123 / 123** (100% Pace-scoped) |
| `block_driver_mvr` cache rows | **194** (candidate hub MVR summaries) |

**This runbook never deletes or updates:**

- `mvr_orders` / `psp_orders` (orders, XML payloads, payment refs, Accio numbers)
- `screening_consent_bundles`, `bgcheck_consents`, `psp_consents`
- `application_invites`, `candidate_requests` (outreach pipeline)
- `payments` (USDC audit trail)
- Any row where `ordered_by_company_id = 'a292d466-00d3-4aa5-a4b2-5263d79266c6'` on order tables

Phase A only removes **duplicate child rows** in `mvr_results` / `psp_results` where a newer canonical row already exists and **no hub cache points at the duplicate**.

---

## Safety rules

1. **Run pre-flight gates.** If any gate fails, **stop** — do not run the matching commit step.
2. **One transaction per step.** `BEGIN` → work → verify inside txn → `COMMIT` or `ROLLBACK`.
3. **Export before delete** (optional but recommended for Pace peace of mind): run the export queries and save CSV from dashboard.
4. **Do not run during active screening.** Pick a quiet window; avoid reconcile cron / heavy Accio webhook traffic.
5. **No schema drops in Phase A** — data cleanup + dead functions only.

---

## Step 0 — Pace invariant snapshot (read-only)

Run all of these. Save the output in the PR / ops notes.

```sql
-- Pace company still active
SELECT id, company_name, status FROM companies
WHERE id = 'a292d466-00d3-4aa5-a4b2-5263d79266c6';

-- Order counts (expect ~204 MVR, ~123 PSP)
SELECT 'mvr_orders' AS tbl, count(*) FROM mvr_orders
UNION ALL SELECT 'psp_orders', count(*) FROM psp_orders
UNION ALL SELECT 'mvr_results', count(*) FROM mvr_results
UNION ALL SELECT 'psp_results', count(*) FROM psp_results
UNION ALL SELECT 'block_driver_mvr', count(*) FROM block_driver_mvr
UNION ALL SELECT 'screening_consent_bundles', count(*) FROM screening_consent_bundles;

-- GATE 0a: every employer order is Pace (expect 0 rows)
SELECT count(*) AS non_pace_mvr_orders
FROM mvr_orders
WHERE ordered_by_company_id IS DISTINCT FROM 'a292d466-00d3-4aa5-a4b2-5263d79266c6'
  AND ordered_by_company_id IS NOT NULL;

-- GATE 0b: hub cache must not reference rows we plan to delete (expect 0)
WITH ranked AS (
  SELECT id, mvr_order_id,
    row_number() OVER (
      PARTITION BY mvr_order_id
      ORDER BY parsed_at DESC NULLS LAST, received_at DESC NULLS LAST,
               created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM mvr_results
),
to_delete AS (SELECT id FROM ranked WHERE rn > 1)
SELECT count(*) AS block_refs_to_deleted_rows
FROM block_driver_mvr
WHERE result_id IN (SELECT id FROM to_delete);
-- ☑ PASS when block_refs_to_deleted_rows = 0
```

**Verified 2026-06-05:** `block_refs_to_deleted_rows = 0`, all 193 cached MVR rows already point at the canonical (newest) result per order.

### Step 0 walkthrough snapshot (2026-06-05, live Supabase)

| Gate / check | Result | Status |
|---|---|---|
| Pace Drivers company active | `a292d466-…` · `active` | ✅ PASS |
| `mvr_orders` | 204 | baseline |
| `psp_orders` | 123 | baseline |
| `mvr_results` | 247 (46 dupes) | cleanup candidate |
| `psp_results` | 144 (21 dupes) | cleanup candidate |
| `block_driver_mvr` | 194 | untouched |
| `screening_consent_bundles` | 181 | untouched |
| `application_invites` | 349 | untouched |
| `candidate_requests` | 253 | untouched |
| Non-Pace employer MVR orders | **0** | ✅ PASS |
| Non-Pace employer PSP orders | **0** | ✅ PASS |
| `block_refs_to_deleted_rows` | **0** | ✅ PASS |

**Step 0 complete — safe to proceed** with dedupe (Steps 1–2) or migration `099`.

### Post-099 verification (2026-06-05, applied on remote)

| Check | Result |
|---|---|
| `mvr_results` | **201** (= distinct orders) |
| `psp_results` | **123** (= distinct orders) |
| `mvr_orders` / `psp_orders` | **204** / **123** (unchanged) |
| Unique indexes | `mvr_results_mvr_order_id_unique`, `psp_results_psp_order_id_unique` |
| App deploy | `53584e9` pushed — **deploy Vercel** so webhooks use `upsert` |

**Steps 1–2:** skip (done by 099). **Steps 3–5:** run below in SQL editor.

---

## Migration 099 — dedupe + unique indexes (preferred over Steps 1–2)

**File:** `supabase/migrations/099_screening_results_unique_per_order.sql`

Applies the same dedupe as Steps 1–2, adds `UNIQUE (mvr_order_id)` / `UNIQUE (psp_order_id)`, and **aborts** if the hub-cache gate fails.

**Deploy order:**

1. Apply **099** on Supabase dashboard (quiet window).
2. Deploy app with webhook `upsert` changes (`process-mvr-accio-webhook.ts`, `process-psp-accio-webhook.ts`).
3. Run Phase A Steps 3–5 (orphan auth, profile backfill, dead functions) if not done yet.

If 099 is applied, **skip Steps 1–2** below.

---

## Step 1 — Deduplicate `mvr_results` (Pace-safe)

### What this does

Keeps **one result row per `mvr_order_id`** (newest `parsed_at` / `received_at`). Deletes **46** duplicate rows (247 → 201). Does **not** touch `mvr_orders` XML or hub cache.

### Pre-flight

```sql
WITH ranked AS (
  SELECT id, mvr_order_id,
    row_number() OVER (
      PARTITION BY mvr_order_id
      ORDER BY parsed_at DESC NULLS LAST, received_at DESC NULLS LAST,
               created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM mvr_results
)
SELECT
  count(*) AS total,
  count(*) FILTER (WHERE rn = 1) AS keep,
  count(*) FILTER (WHERE rn > 1) AS delete
FROM ranked;
-- ☑ Expect delete = 46, keep = 201 (counts may drift slightly if new webhooks arrive)
```

### Export (optional audit trail)

```sql
WITH ranked AS (
  SELECT r.*,
    row_number() OVER (
      PARTITION BY mvr_order_id
      ORDER BY parsed_at DESC NULLS LAST, received_at DESC NULLS LAST,
               created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM mvr_results r
)
SELECT id, mvr_order_id, driver_user_id, parsed_at, received_at, rn
FROM ranked
WHERE rn > 1
ORDER BY mvr_order_id, rn;
```

### Commit (abort if gate fails)

```sql
BEGIN;

WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY mvr_order_id
      ORDER BY parsed_at DESC NULLS LAST, received_at DESC NULLS LAST,
               created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM mvr_results
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
),
gate AS (
  SELECT count(*) AS block_refs
  FROM block_driver_mvr
  WHERE result_id IN (SELECT id FROM to_delete)
)
DELETE FROM mvr_results
WHERE id IN (SELECT id FROM to_delete)
  AND (SELECT block_refs FROM gate) = 0;

-- In-txn verify
SELECT
  (SELECT count(*) FROM mvr_results) AS mvr_results_after,
  (SELECT count(DISTINCT mvr_order_id) FROM mvr_results) AS distinct_orders,
  (SELECT count(*) FROM mvr_orders) AS mvr_orders_unchanged;

-- ☑ Expect mvr_results_after = distinct_orders (~201)
-- ☑ Expect mvr_orders_unchanged = 204

COMMIT;  -- or ROLLBACK if counts look wrong
```

---

## Step 2 — Deduplicate `psp_results` (Pace-safe)

Same pattern. **Does not** touch `psp_orders` or consent tables.

### Pre-flight

```sql
WITH ranked AS (
  SELECT id, psp_order_id,
    row_number() OVER (
      PARTITION BY psp_order_id
      ORDER BY parsed_at DESC NULLS LAST, received_at DESC NULLS LAST,
               created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM psp_results
)
SELECT
  count(*) FILTER (WHERE rn = 1) AS keep,
  count(*) FILTER (WHERE rn > 1) AS delete
FROM ranked;
-- ☑ Expect delete = 21, keep = 123
```

### Commit

```sql
BEGIN;

WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY psp_order_id
      ORDER BY parsed_at DESC NULLS LAST, received_at DESC NULLS LAST,
               created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM psp_results
)
DELETE FROM psp_results
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

SELECT
  (SELECT count(*) FROM psp_results) AS psp_results_after,
  (SELECT count(DISTINCT psp_order_id) FROM psp_results) AS distinct_orders,
  (SELECT count(*) FROM psp_orders) AS psp_orders_unchanged;

-- ☑ Expect psp_results_after = distinct_orders (~123)
-- ☑ Expect psp_orders_unchanged = 123

COMMIT;
```

---

## Step 3 — Remove incomplete `auth.users` (no `public.users` row)

These are magic-link signups that **never completed bootstrap**. Verified: **zero** MVR, PSP, consent, or invite linkage.

### Pre-flight

```sql
SELECT a.id, a.email, a.created_at, a.last_sign_in_at
FROM auth.users a
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = a.id)
ORDER BY a.created_at DESC;
-- ☑ Expect 5 rows, all last_sign_in_at NULL, no Pace artifacts

-- GATE: must return 0
SELECT count(*) AS auth_orphans_with_pace_artifacts
FROM auth.users a
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = a.id)
  AND (
    EXISTS (SELECT 1 FROM mvr_orders mo WHERE mo.driver_user_id = a.id)
    OR EXISTS (SELECT 1 FROM psp_orders po WHERE po.driver_user_id = a.id)
    OR EXISTS (SELECT 1 FROM screening_consent_bundles sc WHERE sc.driver_user_id = a.id)
    OR EXISTS (SELECT 1 FROM application_invites ai
                WHERE ai.candidate_user_id = a.id OR ai.used_by_user_id = a.id)
  );
```

### Commit

> Delete from `auth.users` via Supabase dashboard **Authentication → Users** if you prefer UI, or SQL below.

```sql
BEGIN;

DELETE FROM auth.users a
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = a.id)
  AND NOT EXISTS (SELECT 1 FROM mvr_orders mo WHERE mo.driver_user_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM psp_orders po WHERE po.driver_user_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM screening_consent_bundles sc WHERE sc.driver_user_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM application_invites ai
                  WHERE ai.candidate_user_id = a.id OR ai.used_by_user_id = a.id);

SELECT count(*) AS remaining_auth_orphans
FROM auth.users a
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = a.id);
-- ☑ Expect 0

COMMIT;
```

---

## Step 4 — Backfill missing `user_profiles` (do **not** delete these users)

Three `public.users` rows lack `user_profiles`. Two have `hub_blocks` installed — deleting them would break hub UX.

### Pre-flight

```sql
SELECT u.id, u.role, u.wallet_address,
  EXISTS (SELECT 1 FROM hub_blocks hb WHERE hb.user_id = u.id) AS has_hub,
  EXISTS (SELECT 1 FROM mvr_orders mo WHERE mo.driver_user_id = u.id) AS has_mvr
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM user_profiles p WHERE p.user_id = u.id);
-- ☑ Expect 3 rows; has_mvr = false for all
```

### Commit (backfill from auth email when available)

```sql
BEGIN;

INSERT INTO user_profiles (user_id, email, created_at, updated_at)
SELECT u.id, a.email, now(), now()
FROM users u
LEFT JOIN auth.users a ON a.id = u.id
WHERE NOT EXISTS (SELECT 1 FROM user_profiles p WHERE p.user_id = u.id);

SELECT count(*) AS users_still_missing_profile
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM user_profiles p WHERE p.user_id = u.id);
-- ☑ Expect 0

COMMIT;
```

---

## Step 5 — Drop dead Postgres functions + trigger (schema hygiene)

Legacy from dropped `developer_profiles` / `t_prefill_cache`. **No Pace data.**

Pre-check:

```sql
SELECT tgname, tgrelid::regclass
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE p.proname IN (
  'create_developer_profile_on_role',
  'update_developer_profiles_updated_at',
  'update_t_prefill_cache_updated_at'
)
AND NOT t.tgisinternal;
-- ☑ Expect trigger_create_developer_profile on users
```

Commit:

```sql
BEGIN;

DROP TRIGGER IF EXISTS trigger_create_developer_profile ON public.users;

DROP FUNCTION IF EXISTS public.create_developer_profile_on_role();
DROP FUNCTION IF EXISTS public.update_developer_profiles_updated_at();
DROP FUNCTION IF EXISTS public.update_t_prefill_cache_updated_at();

COMMIT;
```

> **Follow-up (separate migration, not Phase A):** add `UNIQUE (mvr_order_id)` on `mvr_results` and fix webhook upsert so duplicates cannot recur. Same for `psp_results`.

---

## Post-flight — Pace smoke checklist

Run after all steps:

```sql
-- Counts unchanged on Pace-critical parents
SELECT 'mvr_orders' AS t, count(*) FROM mvr_orders
UNION ALL SELECT 'psp_orders', count(*) FROM psp_orders
UNION ALL SELECT 'screening_consent_bundles', count(*) FROM screening_consent_bundles
UNION ALL SELECT 'application_invites', count(*) FROM application_invites
UNION ALL SELECT 'candidate_requests', count(*) FROM candidate_requests;

-- One result per order
SELECT count(*) AS mvr_multi_result_orders
FROM (
  SELECT mvr_order_id FROM mvr_results GROUP BY 1 HAVING count(*) > 1
) x;
-- ☑ Expect 0

SELECT count(*) AS psp_multi_result_orders
FROM (
  SELECT psp_order_id FROM psp_results GROUP BY 1 HAVING count(*) > 1
) x;
-- ☑ Expect 0

-- Hub cache integrity
SELECT count(*) AS block_mvr_missing_result
FROM block_driver_mvr b
WHERE b.result_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM mvr_results r WHERE r.id = b.result_id);
-- ☑ Expect 0
```

**Manual app smoke (Pace account):**

1. Employer hub → screenings list still loads order history.
2. Open a known candidate career card → MVR section still populated.
3. Talent search → candidate with MVR still shows screening badges.

---

## What Phase A explicitly defers

| Item | Why wait |
|---|---|
| Drop `payments` / `storm_distributions` | USDC audit trail; Stripe cutover not complete |
| Null `users.wallet_address` | Phase 1 still references legacy column in places |
| Drop empty feature tables | Product may ship into them (messages, job alerts) |
| Archive `notifications` | Young dataset; no retention policy yet |
| Trim `application_invites` pending rows | Operational; need expiry policy with Pace |
| Drop blockchain/IPFS columns on `resumes` | D4 Storage migration incomplete (0 `storage_path` on resumes) |

---

## Rollback notes

- **Deletes are not reversible** without a backup. Export duplicate IDs (Step 1/2) before commit.
- Supabase **Point-in-Time Recovery** (if enabled on your plan) is the real rollback path for mistakes.
- If Step 1/2 counts look wrong after delete but before `COMMIT`, run `ROLLBACK`.

---

## Expected outcome

| Metric | Before | After (approx.) |
|---|---:|---:|
| `mvr_results` rows | 247 | 201 |
| `psp_results` rows | 144 | 123 |
| Orphan `auth.users` | 5 | 0 |
| Users missing `user_profiles` | 3 | 0 |
| Dead profile functions | 3 | 0 |
| Pace order/consent/invite rows | unchanged | unchanged |
