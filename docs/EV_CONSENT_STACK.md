# EV Consent Stack (Track B)

Source of truth for the three legal artifacts wrapped around the employment-verification
packet. Transcribed from the boss's Track B drafts (2026-09-20/21, Jason Peterson review →
Frantz Ward):

| Artifact | Document ID | Actor | Moment |
|---|---|---|---|
| Disclosure + Authorization to route | `PROVVEN-EV-DISC-AUTH-B-0.1` | Driver | Before any outbound EV send |
| Employer share-request clickwrap | `PROVVEN-EV-EMP-SHARE-REQ-0.1` | Employer | When requesting to view a driver's EV |
| Step 6 formal share acknowledgment | `PROVVEN-EV-SHARE-ACK-6-0.1` | Driver | Before any EV content reaches that employer |

These do NOT replace the DOT papers (`docs/AUTH_FORM.md` — driver authorization page +
Safety Performance History Records Request). The papers are the packet sent to the prior
employer; the consent stack governs who may route, request, and view.

Canonical renderable text lives in `src/lib/ev-consent-documents.ts`. Every artifact row
stores `document_version` + sha256 of the exact text shown (dynamic fields substituted),
UTC timestamp, and IP / user-agent metadata.

---

## Product framing (all three drafts agree)

- The **driver orders EV on themselves**. Provven routes the request outbound and returns
  the result to the driver. Provven does not "run" EV as a CRA in this model.
- Scope is **49 CFR 391.23(d)** — employment verification and accident / safety
  performance history. **Out of scope:** MVR, PSP, CDLIS, Drug & Alcohol / FMCSA
  Clearinghouse (391.23(e)). Never combine those consents with this authorization.
- **Responses are delivered to the driver first.** An employer never automatically
  receives EV material.
- **No employer browse** of "drivers with EV on file" — no search, filter, directory,
  alerts, or aggregated verified-candidate signals outside a candidate-initiated
  application context.
- **Step 6 is per-employer, per-request** in v0.1 (no consent-once / scoped model until
  counsel approves one).

## Flow and hard gates

```
Driver: Disclosure (Screen A, scroll-to-continue)
  → Authorization (Screen B, unchecked box, "Authorize & Send Requests")
  → ev_authorizations row               ← HARD GATE: initiate-self 403 without it
  → outbound packet to prior employer (docs/AUTH_FORM.md papers)
  → reply returns to the DRIVER (DKIM-verified)

Employer (from a candidate-initiated application context only):
  "Request EV share" clickwrap (certifications, unchecked box, "Request Share")
  → ev_share_requests row (status: pending)  ← creates PENDING ONLY, never unlocks view
  → notification to driver

Driver: Step 6 acknowledgment (named employer, context, payload, unchecked box,
  "Authorize Share" / "Decline")
  → Authorize → ev_share_grants row          ← THE ONLY THING THAT UNLOCKS VIEW
  → Decline  → status declined; employer sees "driver has not authorized"; no content

Employer view: GET /api/employer/ev/view/[shareRequestId]
  → requires company match + non-revoked in-scope grant
  → writes ev_access_log
  → missing/revoked grant = 403. Never soft-fail open.
```

## v0.1 rules locked in code

- **Payload:** proof summary only (employer name, confirmed dates, DKIM status, response
  date — never the six FMCSA answers). `payload_type = 'full'` exists in schema but is
  not offered in UI until product/counsel enable it.
- **Revocation:** forward-only in-platform revoke (`ev_share_grants.revoked_at`). UI shows
  the draft's prescribed temporary line: "Revocation and retention rules for shared
  material will follow counsel-approved policy; for this test build, share creates an
  auditable access grant for this employer only."
- **No auto-approve** on reminder fatigue; no batch "share with all interested employers."
- **Strict visibility:** career card / talent surfaces show at most a neutral
  "Employment verification available on request" line. No verified-EV counts in talent
  search (clickwrap clause A.3 no-browse), no itemized employer confirmations without a
  grant, and the legacy public token route no longer lists verified employments.

## Artifact fields (per draft "fields to capture")

All three artifact tables (`ev_authorizations`, `ev_share_requests`, `ev_share_grants` in
migration `110_ev_consent_stack.sql`) store: document version, sha256 snapshot of shown
text, actor user id, UTC timestamp, IP address + user agent, checkbox control event id.
Additionally:

- `ev_authorizations`: typed `signed_name` (from the auth paper — now actually persisted),
  `disclosure_viewed_at`, `employer_targets` snapshot, `status active|withdrawn|superseded`.
  Linked from `employment_verification_requests.ev_authorization_id`.
- `ev_share_requests`: `application_context` (required — named candidate + current hiring
  need), `payload_type`, lifecycle `status pending|authorized|declined|revoked|expired`.
- `ev_share_grants`: `share_request_id` (unique), `ev_request_ids` covered, `revoked_at`.
- `ev_access_log`: append-only employer view audit.

## Counsel flags still open (do not resolve in code)

- "Not a CRA" wording — structural description vs legal conclusion.
- FCRA characterization of the employer certification (user cert vs contractual warranty).
- Revocation Option A (stricter) vs Option B (expiry) — temporary line ships meanwhile.
- Per-employer forever vs future consent-once / scope-bound share model.
- State-specific disclosure inserts / e-sign overlays.
- Whether EV-derived facts in the attestation pipeline (`previous_employer_verified`)
  also require a grant — flagged, not built in this pass.
