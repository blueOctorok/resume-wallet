# Employment Verification (EV) — Master Plan

**Last updated:** 2026-10-13
**Owner posture (locked):** Provven is the **driver's agent**, never a CRA (DEC-2026-05-011). Employer-paid EV stays an Accio order. Nothing below changes that.

This is the single map of the EV block: what already exists, what Phase 1 just added, and what the remaining phases are. Start here in any new session that touches EV. Detailed history lives in `CHANGES.md`; legal framing in `EV_CONSENT_STACK.md`; the paper itself in `AUTH_FORM.md`.

---

## Why this exists (the problem in one paragraph)

Trucking EV completes **49%** of the time with phone + email (Superunit 2026 — lowest of 15 industries), **65%** need manual outreach, median **5 touches**. Our pre-Phase-1 flow was email-only, one send, a manual "Send again" button, and no delivery feedback — estimated **10–15%** completion. The incumbents (HireRight DAC, Cisive Driver iQ, Accio VeriBot) all run the same three layers: **database hit → outreach cadence → good-faith record**. We cannot own a records database as a non-CRA, so we build layers 2 and 3 for the driver and leave layer 1 to the employer's Accio order.

---

## Phase 0 — Already shipped (the EV block today)

Everything in this table exists and works. Do not rebuild it.

| Area | What exists | Where |
|---|---|---|
| **Block** | `general-employment-verification` in the registry, hub tile, journey step, My Files entry | `block-registry.ts`, `journey-progress.ts`, `CandidateHub.tsx` |
| **The paper** | Official § 391.23 packet: 4-part Driver Authorization + 5-part Safety Performance History, transcribed from the boss's PDF. Two pages per employer. Current jobs are opt-out. | `DriverAuthorizationForm.tsx`, `SafetyPerformanceHistoryPaper.tsx`, `docs/AUTH_FORM.md` |
| **Work history source** | Employers come from DOT Section 3 (merged across driver / dev / general rows) | `candidate-employment-verification.ts` |
| **Driver decline** | Recorded per employer (`DRIVER_SEND_DECLINED`) | `/api/candidate/verification/decline` |
| **Legal gate (Track B)** | Disclosure + authorization artifact required before any send (403 without it); employer share-request clickwrap; driver Step 6 acknowledgment is the only thing that unlocks employer view; forward-only revoke; access log | `ev_authorizations`, `ev_share_requests`, `ev_share_grants`, `ev_access_log`, `EvDisclosureAuthorizationModal`, `EvShareRequestsPanel`, `docs/EV_CONSENT_STACK.md` |
| **Outbound email** | Pingram email with secure reply link `/verify/[token]`; every packet has a catch-all delivery alias `evr-<id>@verify.provven.com` so replies always land in Provven | `send-verification-email.ts`, `evr-delivery.ts` |
| **Records-holder portal** | `/verify/[token]` — 6 FMCSA questions, verify / deny / decline | `app/verify/[token]`, `/api/verification/respond` |
| **Inbound reply path** | Pingram `EMAIL_INBOUND` → match by alias → tracking id → domain; `mailauth` DKIM stamps `dkim_valid` | `evr-inbound.ts`, `/api/webhooks/pingram/inbound` |
| **Verified semantics** | Portal reply = "Verified by Provven". DKIM-aligned reply = eligible for Midnight `previous_employer_verified` proof. Self-reported is never badged. | `fact-registry.ts`, `attestation-service.ts` |
| **Downstream projection** | VERIFIED / PARTIALLY_VERIFIED rows lock into DOT Form 3 as `_source:'verified'` | `employment-form3-projection.ts` |
| **Visibility rules** | Cards / talent search / public links show only "Employment verification available on request". Itemized EV only via Step 6 grant. | `ProjectedCareerCard`, employer EV view API |
| **Corrections** | Driver can request a correction packet (new outbound, re-gated) | `correction_of` |
| **Employer side** | `employer-employment-verification` block → share requests from an application context only (no browse); proof-summary view | `employer-block-registry.ts`, `/api/employer/ev/*` |
| **Agency DQ monitor** | EV shows as a live status in the DQ checklist | `dq-file-registry.ts` |

**What Phase 0 did *not* have:** any follow-up automation, any delivery feedback, any way to find a contact the driver didn't know, and any artifact when nobody replied.

---

## Phase 1 — Outreach automation (shipped 2026-10-13, needs ops steps)

Goal: get from one email to a real cadence with proof of what happened, using tools already in the stack (Pingram, FMCSA, Claude). No new vendors, no telephony.

| Capability | Status | Notes |
|---|---|---|
| Single sender for every send path | ✅ | `sendOutreachAttempt` — first send, cron, manual, confirmed contact |
| Cadence day 0 → 3 → 7, Mon–Fri 13:00–20:59 UTC | ✅ | `runOutreachCadence`, hourly `/api/cron/evr-outreach` |
| Attempt-aware subject / opener ("Follow-up … 2 of 3") | ✅ | `send-verification-email.ts` |
| Time-based exhaustion (7 days after 3rd send) | ✅ | Old route exhausted at the instant of the 3rd send |
| Delivery tracking per attempt (sent / delivered / opened / clicked / failed) | ✅ | `/api/webhooks/pingram/events`, forward-only status rank |
| Bounce pauses cadence and asks for a new contact | ✅ | `contact_research_status = 'pending'`, driver notified |
| Contact research: FMCSA QCMobile (phone, address, USDOT) | ✅ | `evr-contact-research.ts`, needs `FMCSA_WEBKEY` |
| Contact research: company-domain email via Claude web search | ✅ | Haiku + `web_search` tool, max 4 searches |
| Driver confirms before any researched address is used | ✅ | `set-contact` route; never auto-send to a guess |
| Good-faith attempt record (canonical JSON → SHA-256 → PDF) | ✅ | `evr-attempt-record.ts`, `EvrAttemptRecordPdf.tsx`, explicitly not a consumer report |
| Driver UI: timeline, next send, bounce panel, download | ✅ | `EvOutreachStatus.tsx` |

### Ops checklist to turn Phase 1 on

- [ ] Apply `supabase/migrations/119_evr_outreach_phase1.sql`
- [ ] Set `FMCSA_WEBKEY` (free developer key, QCMobile dev site via Login.gov)
- [ ] Set `PINGRAM_WEBHOOK_SECRET` (or rely on `INTERNAL_API_SECRET` fallback)
- [ ] Register `https://<host>/api/webhooks/pingram/events` in Pingram for `EMAIL_DELIVERED`, `EMAIL_OPEN`, `EMAIL_CLICK`, `EMAIL_FAILED`
- [ ] Confirm `CRON_SECRET` is set so the hourly cron is authenticated
- [ ] Smoke: submit a packet with no contact → research runs → "Confirm contact" appears on the tile

### Phase 1 follow-ups (shipped 2026-10-13)

- [x] **Admin Verifications tab** — delivery, research status, exhausted date, expandable attempts, attempt-record download, and a summary (reply rate by email 1/2/3, bounce rate, exhausted rate). This is the surface a personal admin bot works from. No separate ops token.
- [x] **Stormi nudges** — `evOutreach` counts on hub context. Needs-contact and exhausted get a nudge. A packet that is simply waiting does not.
- [x] **Phone type** — office or mobile on `set-contact`. Office is the default, including FMCSA numbers the driver saves.
- [x] **Measurement** — the admin summary above. The cron log still emits send counts.

---

## Phase 2 — Scripted Pingram call + text (shipped dark, 2026-10-13)

Pingram can place a one-way text-to-speech call (`call: { message }`) and send SMS. It cannot hold a conversation. Phase 2 uses that, behind `EVR_VOICE_SMS_ENABLED` (default off).

| What | How |
|---|---|
| When | Two days after email 2 (day 5), once per packet (`last_touch_at`) |
| Office number, or a number with no type | One scripted call. First sentence says it is an automated message from Provven on behalf of the driver |
| Mobile number | One SMS with the secure link and STOP |
| Bookkeeping | A `verification_attempts` row (`method` `phone` or `sms`). Does **not** increment `attempt_count`, so the three-email cap stays an email cap |
| Driver control | "Don't call or text this employer" sets `voice_opt_out` and `sms_opt_out` |
| Webhooks | `SMS_DELIVERED`, `SMS_FAILED`, `CALL_FAILED`, unsubscribe, `SMS_INBOUND`, `VOICE_INBOUND`. An email bounce still pauses the cadence. A failed call does not |
| Record | The attempt-record statement counts emails, calls, and texts separately, and says a call or text is not a verification |

**Apply `supabase/migrations/120_evr_outreach_touches.sql`.** Register the new Pingram events on `/api/webhooks/pingram/events`. Leave `EVR_VOICE_SMS_ENABLED` unset until counsel signs off on artificial-voice calls to office lines and SMS to driver-marked mobiles.

**Not this phase:** a live two-way phone agent. Grok Voice (`wss://api.x.ai/v1/realtime`) is the later upgrade if the exhausted rate stays above ~40% after this touch. Same rules: disclose up front, routing only, no attestation from a call.

### Personal admin bot (configured outside the app)

Central admin is gated on a logged-in email in `ADMIN_EMAILS`. A bot attached to that inbox signs in with the magic link, and the Verifications tab is its queue. It is not a module in this repo, and there is no EV-only service token. Confirming a looked-up employer email stays the driver's "Use & send" click.

---

## Phase 3 — Employer-paid vendor dispatch (design only, build on demand)

Goal: when the driver's agent path exhausts, give the hiring carrier a one-click paid order. This is layer 1 (database) + a professional outreach team — it lives on the **employer** side, through Accio, so Provven stays a non-CRA.

| Step | What |
|---|---|
| 3.1 | Accio EV sub-order beside `<subOrder type='MVR'>` in `accio-xml-builder.ts` — product codes `CDL_Employment_verification`, `Level2_Employment_verification`, `Level3_Employment_verification` |
| 3.2 | `employer-ev-orders` employer block (mirrors `employer-mvr-orders`); guard `companyCanOrderEv` in `employer-company-access.ts` |
| 3.3 | Order requires the FCRA + FMCSA consent bundle like MVR/PSP (`/api/employer/screenings/order`) |
| 3.4 | Result XML → `ev_vendor_orders` table (not into `employment_verification_requests` — different provenance); projected into Form 3 as `_source:'vendor'` |
| 3.5 | Driver sees "Carrier X ordered a verification through Accio" in the EV block — read-only, CRA-produced, FCRA copy rights |
| 3.6 | Attempt record from Phase 1 is attached to the order so Accio's team starts from our contact research instead of zero |

**Trigger to build:** first carrier asks, or exhausted-packet rate from the Phase 1 admin view stays above ~40% after Phase 2.

**HireRight DAC and Cisive Driver iQ stay out.** Cisive is the CRA. Driver iQ's previous-employment database is sold to motor carriers for their hiring file. A driver can request a copy of their own report from Cisive. Provven cannot query it for them. Accio EV remains the employer-paid order when a carrier wants a CRA to run it.

---

## Phase 4 — Verified facts and the Midnight pipeline (depends on counsel)

Open items from `EV_CONSENT_STACK.md` that gate how verified EV data is *used*:

- [ ] Whether `previous_employer_verified` requires a Step 6 grant on employer surfaces (resolved for card projections; employer surface still open)
- [ ] "Not a CRA" wording — structural vs legal conclusion
- [ ] Revocation Option A vs B
- [ ] Per-fact "Proven on Midnight" for DKIM-aligned EV replies once the Compact circuit runs (honesty guardrail: not before)

No outreach code depends on these; they decide what the verified result unlocks.

---

## Decision summary

| Decision | Choice | Why |
|---|---|---|
| Posture | Driver's agent only | Keeps Provven out of CRA territory; employer-paid EV is Accio's |
| Phase 1 channel | Pingram email + webhooks | Already in the stack; zero new vendors |
| Contact research | FMCSA + web search, driver confirms | Free, official, no leak of the employment claim to a guessed address |
| Exhaustion | 7 days after 3rd send | The last email needs a chance to be answered |
| Bounce | Pause + research, not burn attempts | Three emails into a dead mailbox is zero attempts |
| Voice | Pingram scripted call + SMS, flag off until counsel | One-way TTS is already in Pingram. A conversation is a later Grok Voice upgrade. Neither produces an attestation |
| Vendor dispatch | Employer-side Accio order | Database layer belongs to a CRA |

---

## File index (Phase 0 + 1)

```
src/lib/
  evr-outreach.ts              cadence, sender, day-5 touch, delivery events (P1, P2)
  evr-touch-script.ts          call script + SMS text                         (P2)
  evr-metrics.ts               admin reply / bounce / exhausted rates         (P1 follow-up)
  evr-contact-research.ts      FMCSA + Claude web-search                      (P1)
  evr-attempt-record.ts        canonical JSON + sha256                        (P1, P2 counts)
  evr-delivery.ts              evr-<id>@verify.provven.com alias              (P0)
  evr-inbound.ts               reply matching + DKIM                          (P0)
  send-verification-email.ts   outbound email                                 (P0, P1 subject)
  ev-consent-documents.ts      Track B canonical text                         (P0)
  pdf/EvrAttemptRecordPdf.tsx  attempt record PDF                             (P1)
src/app/api/candidate/verification/
  initiate-self, resend, decline, status, ev-authorization,
  share-requests, share-grants                                                (P0; P1 refactor)
  [id]/research-contact, [id]/set-contact, [id]/attempt-record                (P1)
  [id]/outreach-prefs                                                         (P2)
src/app/api/webhooks/pingram/   inbound (P0), events (P1)
src/app/api/cron/evr-outreach/  hourly cadence                                (P1)
src/components/verification/
  CandidateEmploymentVerificationSection, DriverAuthorizationForm,
  SafetyPerformanceHistoryPaper, EvDisclosureAuthorizationModal,
  EvShareRequestsPanel                                                        (P0)
  EvOutreachStatus                                                            (P1)
supabase/migrations/ 106 (DKIM), 109 (decline), 110 (consent stack), 119 (outreach), 120 (touches)
```
