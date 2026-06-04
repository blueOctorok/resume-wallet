# Plan — Employer viewing of completed consent forms

**Status:** Ready to build
**Created:** 2026-06-03
**Built:** 2026-06-03
**Area:** Employer outreach / screenings (Pace-critical — touches `src/components/employer/**` and `src/app/api/employer/**`)

---

## Goal

Let an employer (Pace) **open and read the actual signed consent documents** for a candidate — FCRA background-check disclosure, FMCSA PSP disclosure, and CDLIS written consent — not just the metadata summary they see today. Read-only, on-screen, with the existing per-document "Download PDF" buttons.

---

## Locked decisions

| Decision | Choice |
|---|---|
| Presentation | **On-screen read-only modal** reusing the existing disclosure components (+ their Download-PDF). No new PDF template. |
| DOB / DL number | **Shown in full** — it's the consent record the candidate signed for this company. |
| Audit | **Dedicated `consent_access_log` table** (append-only). Write a row on each successful view. |
| Access scope | **Company-scoped only** — an employer can only view bundles where `bundle.company_id` matches their company. |
| SSN | **Never returned** by the API (defensively stripped). |

---

## Current state (grounding — already exists, do not rebuild)

- **Data is fully stored:**
  - `screening_consent_bundles` — package row: `id, driver_user_id, company_id, bgcheck_consent_id, psp_consent_id, cdlis_signed_name, cdlis_signed_at, cdlis_form_data (jsonb), form_data (jsonb, SSN-stripped), ssn_encrypted, status ('pending'|'complete'), completed_at, created_at`. See `supabase/migrations/085_screening_consent_bundles.sql`.
  - `bgcheck_consents` — FCRA: `id, signed_name, signed_at, form_data (jsonb, no SSN), company_name, driver_user_id`.
  - `psp_consents` — FMCSA PSP: `id, signed_name, signed_at, form_data (jsonb, includes `cdlisWrittenConsent`), company_name, driver_user_id, form_version`.
- **Read-only viewers already exist and render the full documents:**
  - `src/components/BackgroundCheckDisclosure.tsx` — `viewMode` + `consentId` → fetches `/api/candidate/bgcheck-consent/[consentId]`, renders the FCRA doc read-only + "Download PDF". Supports `renderInline` (no Modal wrapper).
  - `src/components/PspDisclosureForm.tsx` — `viewMode` + `consentId` → fetches `/api/psp/consent/[consentId]`, same pattern. Supports `renderInline`.
- **Employer already gets a metadata summary** (no way to open):
  - `GET /api/employer/screenings` returns `consentBundles` summaries (`id, driverUserId, candidateName, status, completedAt, bg{signedName,signedAt}, psp{...}, cdlisSignedAt/Name`). Consumed by `src/hooks/useEmployerScreenings.ts` (`ConsentBundleSummary`, `consentBundleByUserId`).
  - `src/components/employer/outreach/FilesVault.tsx` → `ConsentBundleRow` renders the summary, **no View button**.
  - `src/components/employer/outreach/OutreachCandidateCard.tsx` → renders a "Signed consent package" `<li>` (around line 500), **not clickable**.

## The gap (only two real things)

1. The existing viewer routes are **candidate-only** (`consent.driver_user_id !== userId → 403`). Employers can't call them.
2. There is **no employer-facing UI affordance** to open the consent documents.

---

## Implementation

### Step 1 — Migration: `supabase/migrations/096_consent_access_log.sql`

Mirror the DDL/RLS style of `085_screening_consent_bundles.sql`. Append-only (no UPDATE/DELETE policies). Writes happen via service role (bypasses RLS); the SELECT policy is for a future admin/compliance view.

```sql
-- ============================================================
-- MIGRATION 096: consent_access_log — who viewed which signed
-- consent package, when. Append-only compliance trail.
-- ============================================================

CREATE TABLE IF NOT EXISTS consent_access_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id       UUID NOT NULL REFERENCES screening_consent_bundles(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  viewer_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  viewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS consent_access_log_bundle_idx
  ON consent_access_log (bundle_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS consent_access_log_company_idx
  ON consent_access_log (company_id, viewed_at DESC);

COMMENT ON TABLE consent_access_log IS
  'Append-only audit: each row = one employer view of a signed consent package.';

ALTER TABLE consent_access_log ENABLE ROW LEVEL SECURITY;

-- Employers may read their own company's access log (future admin/compliance view).
CREATE POLICY "Employers view company consent access log"
  ON consent_access_log FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
-- No INSERT/UPDATE/DELETE policies: inserts go through the service-role client.
```

> Apply via the Supabase dashboard (the MCP runs read-only in this workspace), consistent with how `093`/`094`/`095` were applied.

### Step 2 — API: `src/app/api/employer/screenings/consent/[bundleId]/route.ts` (NEW)

Auth + company resolution must mirror `src/app/api/employer/screenings/route.ts` exactly:

1. `userId = await getStormUserIdFromRequest(request)` → 401 if missing.
2. `getAdminSupabaseClient()`; read `users.wallet_address` for `userId`; 403 if none.
3. `ctx = await resolveEmployerCompanyForWallet(supabase, wallet)`; 403 if none.
4. Load the bundle by `bundleId`:
   `select id, status, completed_at, created_at, driver_user_id, company_id, bgcheck_consent_id, psp_consent_id, cdlis_signed_name, cdlis_signed_at, cdlis_form_data`.
   - 404 if not found.
   - **`if (bundle.company_id !== ctx.companyId) return 404`** (treat as not-found — don't leak existence). This is the single most important check.
5. Load candidate name from `user_profiles` (`first_name`, `last_name`) for display.
6. Load `bgcheck_consents` by `bundle.bgcheck_consent_id` and `psp_consents` by `bundle.psp_consent_id` (only the fields below).
7. **Strip SSN defensively:** before returning any `formData`, delete a `ssn` key if present (bg/psp/bundle form_data should already be SSN-free; do it anyway).
8. **Audit:** `insert into consent_access_log { bundle_id, company_id: ctx.companyId, viewer_user_id: userId }`. Log-and-continue on failure (don't fail the read).
9. Return:

```ts
{
  success: true,
  bundle: { id, status, completedAt, createdAt, candidateName },
  fcra: { signedName, signedAt, companyName, formData } | null,   // from bgcheck_consents
  psp:  { signedName, signedAt, companyName, formData, formVersion } | null, // from psp_consents
  cdlis: { signedName, signedAt, formData } | null,               // from bundle.cdlis_*
}
```

Standard error shape `{ error: string }`, `try/catch`, `console.error('[EMPLOYER CONSENT VIEW] ...')`. Add `export const dynamic = 'force-dynamic'`.

### Step 3 — Shared components: add a `presetConsent` prop (additive, no behavior change)

So the employer modal can feed preloaded data and the components **skip their candidate-only fetch**.

**`src/components/BackgroundCheckDisclosure.tsx`:**
- Add prop: `presetConsent?: { signedName: string; signedAt: string | null; companyName: string; formData: Record<string, string> }`.
- In the `useEffect` (currently `if (viewMode && consentId) fetchSignedConsent()`), branch first on `presetConsent`:
  ```ts
  if (viewMode && presetConsent) {
    setSignedName(presetConsent.signedName || '')
    setSignedDate(presetConsent.signedAt ? new Date(presetConsent.signedAt).toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric'}) : '')
    setViewCompanyName(presetConsent.companyName || companyName)
    setProfile(prev => ({ ...prev, ...presetConsent.formData }))
    setProfileLoading(false)
  } else if (viewMode && consentId) {
    fetchSignedConsent()
  } else if (!initialFormData) {
    fetchDriverProfile()
  }
  ```
- Add `presetConsent` to the `useEffect` dep array.

**`src/components/PspDisclosureForm.tsx`:**
- Add prop: `presetConsent?: { signedName: string; signedAt: string | null; companyName: string; formData: Record<string, string>; formVersion?: string | null }`.
- Same branch pattern in its `useEffect` / `fetchSignedConsent`: when `viewMode && presetConsent`, set `signedName`, `printedName` (`formData.printedName || signedName`), `signedDate`, `viewCompanyName`, and the `profile` fields (firstName…email), then `setProfileLoading(false)` and skip the fetch.

### Step 4 — `src/components/employer/EmployerConsentPackageModal.tsx` (NEW)

```ts
interface EmployerConsentPackageModalProps {
  bundleId: string
  candidateName: string
  onClose: () => void
}
```

- Uses the shared `Modal` (`@/components/ui/Modal`, `maxWidth="max-w-5xl"`) + `ModalHeader` (title "Signed consent package", subtitle = candidate name). **Do not hand-roll an overlay** (UI rule).
- On mount: `fetch('/api/employer/screenings/consent/' + bundleId)`. Show `Loader2` while loading; render `{ error }` state on failure.
- Tab bar: **FCRA · FMCSA PSP · CDLIS** (default FCRA). Only show a tab if its data is non-null.
- Render the active tab:
  - **FCRA** → `<BackgroundCheckDisclosure renderInline viewMode presetConsent={data.fcra} companyName={data.fcra.companyName} requestId="" userAddress="" onClose={onClose} onConsentSigned={()=>{}} />` (callbacks are no-ops in view mode).
  - **FMCSA PSP** → `<PspDisclosureForm renderInline viewMode presetConsent={data.psp} ... onClose={onClose} />` (match its required props; pass no-op callbacks).
  - **CDLIS** → small inline read-only block (no existing component): show `data.cdlis.signedName`, formatted `signedAt`, and the captured fields from `formData` (`typedSignature`, `printFirstName`, `printLastName`, `consentDateIso`) plus a short CDLIS authorization blurb. Style with the same teal/gray tokens; dark-mode variants required.
- Each disclosure component already shows its own "Download PDF" — no extra wiring needed.

### Step 5 — `src/components/employer/outreach/FilesVault.tsx`

- Add prop `onViewConsent?: (bundle: ConsentBundleSummary) => void` to `FilesVaultProps`; thread into `ConsentBundleRow`.
- In `ConsentBundleRow`, when `bundle.status === 'complete'` and `onViewConsent` is set, render a `Button variant="secondary" size="sm"` with an `Eye` icon → `onViewConsent(bundle)` (mirror the screening `VaultRow` "View" button).

### Step 6 — `src/components/employer/outreach/OutreachCandidateCard.tsx`

- Add prop `onViewConsent?: (bundle: ConsentBundleSummary) => void`.
- Make the "Signed consent package" `<li>` (≈ line 500) a clickable `button` when `consentBundle.status === 'complete'` and `onViewConsent` is set → `onViewConsent(consentBundle)`. Add hover affordance + `aria-label`. Keep non-complete bundles non-clickable.

### Step 7 — Wire it in `src/components/employer/CandidateOutreach.tsx`

- Add local state (mirror existing `mvrViewOrderId`/`pspViewOrderId` `useState` pattern in this same file — acceptable per state rules as a local modal toggle):
  ```ts
  const [consentView, setConsentView] = useState<{ bundleId: string; candidateName: string } | null>(null)
  const openConsent = (b: ConsentBundleSummary) =>
    setConsentView({ bundleId: b.id, candidateName: b.candidateName ?? 'Candidate' })
  ```
- Pass `onViewConsent={openConsent}` to `<FilesVault>` and to `OutreachCandidateCard` (via the kanban board props that already forward `onViewFile`, etc.).
- Render the modal near the existing MVR/PSP view modals:
  ```tsx
  {consentView && (
    <EmployerConsentPackageModal
      bundleId={consentView.bundleId}
      candidateName={consentView.candidateName}
      onClose={() => setConsentView(null)}
    />
  )}
  ```
- If `OutreachCandidateCard` is rendered through `KanbanBoard`/`KanbanCard`, thread the `onViewConsent` prop down the same path `onViewFile` already takes.

### Step 8 — Docs

Add a `docs/CHANGES.md` entry on completion: new `consent_access_log` table + migration `096`, new employer consent-view API, `presetConsent` prop additions, `EmployerConsentPackageModal`, View affordances in `FilesVault` + `OutreachCandidateCard`. Note Pace-critical surfaces touched.

---

## Security / compliance guardrails (must hold)

1. **Company-scoped:** every fetch verifies `bundle.company_id === ctx.companyId`; mismatch → 404 (no existence leak).
2. **SSN never leaves the server:** API strips any `ssn` key from all `formData` before responding; `ssn_encrypted` is never selected/returned.
3. **Storm stays the candidate's agent:** the employer only ever sees the consent the candidate signed **for that company**. No cross-company or "show everything" access.
4. **Append-only audit:** `consent_access_log` has no UPDATE/DELETE policy; inserts via service role only.

---

## Acceptance criteria

- [ ] From the Files vault, an employer can click **View** on a complete consent package and read FCRA + FMCSA PSP + CDLIS documents read-only.
- [ ] Same modal opens from the outreach candidate card's consent pill.
- [ ] Each document shows signature, date, captured fields, and its existing **Download PDF** works.
- [ ] API returns 404 for a `bundleId` belonging to another company.
- [ ] No response anywhere contains SSN.
- [ ] A `consent_access_log` row is written on each successful view.
- [ ] `npm run build` passes; no new lint errors; all elements have dark-mode variants.

## Out of scope (future)

- Candidate-side changes (their viewers already exist).
- A dedicated CDLIS disclosure component (inline read-only summary is enough for v1).
- An admin/compliance UI that reads `consent_access_log` (table is ready for it).
- A single combined consent-package PDF (per-document download covers v1).
