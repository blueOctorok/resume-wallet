# FCRA MVR Isolation — How StormChain Avoids Becoming a CRA

## The Problem We Were Solving

A **Consumer Reporting Agency (CRA)** is any company that assembles or evaluates consumer information for third parties — like employment background checks. The FCRA (Fair Credit Reporting Act) regulates CRAs heavily. If StormChain allowed employer-ordered MVRs to flow freely back to drivers or to other employers, we would be acting as a CRA, which carries significant legal and compliance obligations.

The specific risks were:

1. **Employer A orders an MVR on a driver.** If that result shows up on the driver's public career card, the driver now knows they were checked — and the result is effectively "published" outside the ordering company.
2. **Employer B searches for candidates.** If they can see MVR results that Employer A paid for, they are consuming a background report without paying for it or obtaining proper consent — a clear FCRA violation.

---

## The Two-Path Model

StormChain now enforces a strict distinction between the two ways an MVR can be ordered:

| Who orders it | `ordered_by_company_id` column | Visibility |
|---|---|---|
| **Driver (self-ordered)** | `NULL` | Shareable — appears on career card, visible to any employer |
| **Employer-ordered** | Company's UUID | Private — visible only to that specific company |

This single nullable column is the entire enforcement mechanism. Its value at write time determines every access control decision downstream.

---

## Where the Rules Are Enforced

### 1. The Database View (`career_cards`)

The `career_cards` view is what every employer sees when they search for talent. The MVR join in this view is scoped to **self-ordered MVRs only**:

```sql
-- Only driver-paid MVRs appear in the shared career card view
LEFT JOIN LATERAL (
  SELECT * FROM mvr_orders mo
  WHERE mo.driver_user_id = u.id
    AND mo.ordered_by_company_id IS NULL  -- ← the gate
  ORDER BY mo.created_at DESC LIMIT 1
) mvr ON true
```

This means no matter what an employer has ordered on a candidate, it never pollutes the shared view. The `has_mvr` flag, `latest_mvr_id`, and `mvr_count` fields that employers see **only reflect MVRs the driver purchased themselves**.

### 2. The Employer Talent API (`/api/employer/talent/[userId]`)

When an employer opens a specific candidate's career card, the API performs **two separate lookups**:

- **Lookup 1 — Shared data:** Pulls from the `career_cards` view. Contains self-ordered MVR data only.
- **Lookup 2 — Private data:** Queries `mvr_orders` directly, filtered to `ordered_by_company_id = [this company's ID]`. Returns only this company's own order.

```typescript
// This company's private MVR — never shared with the driver or other companies
const { data: companyMvr } = await supabase
  .from('mvr_orders')
  .select('id, status, dl_state, created_at, ordered_by_company_id')
  .eq('driver_user_id', userId)
  .eq('ordered_by_company_id', companyId)  // ← strict company filter
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
```

The response object sends both back separately so the UI can render them with distinct labels.

### 3. The Employer Hub API (`/api/employer/hub`)

When loading the kanban board (applicants list), the batch MVR enrichment query uses an `.or()` filter that only fetches MVRs relevant to the viewing company:

```typescript
supabase
  .from('mvr_orders')
  .select('driver_user_id, status, ordered_by_company_id, ordered_at')
  .in('driver_user_id', applicantUserIds)
  .or(`ordered_by_company_id.is.null,ordered_by_company_id.eq.${company.id}`)
```

This returns both self-ordered MVRs (for display) and this company's own orders (for workflow state). It will **never** return another company's MVR.

---

## What the UI Shows

The career card component renders visually distinct badges so there is no ambiguity:

| Badge | What it means |
|---|---|
| **Self-Ordered** (green) | Driver paid for this MVR themselves. Fully shareable. |
| **Private to Your Company** (amber + lock icon) | Your company ordered this MVR. It is yours alone. |

Drivers viewing their own career card never see employer-ordered MVRs at all — those results don't exist in any data path accessible to the driver.

---

## The Consent Step

Before an employer can order an MVR, the driver must sign an FCRA-compliant disclosure form (background check authorization). This consent is stored in the `bgcheck_consents` table, linked to both the driver and the company. The employer's MVR purchase flow is gated behind this consent — the order button does not appear until a signed consent record exists for that company/driver pair.

This mirrors real-world CRA workflows where written authorization is required before any consumer report can be pulled.

---

## What This Means for Future Background-Related Features

This same two-path model applies to any future background-sensitive data:

- **Employment verifications ordered by an employer** — private to that company, same `ordered_by_company_id` pattern.
- **Drug screen results** — same pattern.
- **Any third-party consumer report** — must follow the same isolation: `NULL` = self-owned and shareable, company UUID = private.

The rule of thumb: **if a company pays for it, only that company can see it.**

---

## Summary

StormChain avoids CRA status by never acting as a clearinghouse for employer-purchased background data. The architecture ensures:

1. Employer-ordered MVRs are **write-once to a private channel** (identified by `ordered_by_company_id`).
2. The shared candidate view (`career_cards`) is **read-only for self-ordered data**.
3. API routes enforce company-scoped lookups — **no cross-company data leakage is possible at the query level**.
4. The driver's own career card **never reflects** what any employer has ordered on them.
