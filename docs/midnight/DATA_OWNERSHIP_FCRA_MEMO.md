# Data Ownership & FCRA — Models, the Deciding Rule, and Questions for Counsel

**Audience:** Storm/Pace ownership + legal counsel.
**Purpose:** Lay out, in plain English, who owns the screening data (MVR/PSP) today, the models for making verified facts portable, the single structural rule that decides which model is legally clean, and the specific questions to bring to the lawyers.

**⚠️ Not legal advice.** This is an engineering + product summary written to *prepare* for a legal review. Every "clean / risk" call below is our working understanding and must be confirmed by counsel before we build or market it.

**Date:** 2026-06-22

---

## 1. The one rule that decides everything: *who clicks "order"*

The legal owner of a screening report is **not** decided by who pays, who stores it, or who the data is about. It is decided by **who the "consumer of record" is** — i.e. who initiated/authorized the pull and for what purpose.

- **Pace clicks order** → it is Pace's *employer pull*, obtained for Pace's permissible purpose. Pace owns it. It is **company-private**.
- **Driver clicks order** → it is the *consumer requesting their own record*. The driver owns it, and a consumer has the right to obtain and share their own file. It is **driver-owned and portable**.

Same vendor (Accio/Key), same data, same fee — the only thing that changes is who is the consumer of record. **Money does not change ownership.** Pace can sponsor (pay) a driver-initiated pull and the driver still owns it.

> The mental model: *"We don't change who owns the data by decree. We change who clicks order."*

---

## 2. What is true **today** (confirmed in code + live data)

- **All screening data in our database is company-private (Pace's).** Every MVR/PSP currently on file was employer-ordered (`ordered_by_employer = true`, tagged to Pace Drivers).
- **The schema already separates the two lanes** (`031_fcra_mvr_isolation.sql`):
  - `ordered_by_company_id IS NULL` → driver self-ordered → shareable
  - `ordered_by_company_id = X` → private to company X only
- **The driver-owned lane exists but is empty** — in practice, only the employer lane is being used.
- **Consent today is company-scoped.** The signed disclosure forms (`bgcheck_consents`, `psp_consents`) authorize *a specific company's* pull — not a blanket, reusable, driver-owned authorization.
- **Known gap (being fixed):** our zero-knowledge proof builder does not yet check the lane — it will currently generate a "verified fact" off a company-private pull. The two test proofs we generated were derived from Pace pulls. This is an FCRA-isolation leak in the proof path and is flagged to be closed before we expand. (Tracked as P3.4-A step 7 in `EXECUTION_CHECKLIST.md`.)

**Plain-English takeaway for the boss:** *As it stands, Pace owns the data and cannot simply hand it to the driver — and we cannot launder that by wrapping it in a zero-knowledge proof. Crypto doesn't change who authorized the source pull.*

---

## 3. The three models

### Model A — Driver-initiated (driver-owned) ✅ *Recommended / the platform*
The driver clicks order (as the consumer requesting their own record); Pace sponsors the fee. Storm derives the verified fact / zk-proof from that driver-owned pull, with the driver authorizing the disclosure.

- **Legal basis:** consumer obtaining and sharing their own file + candidate authorization.
- **CRA risk:** low — the driver presents their own credential; Storm/Pace are not reselling a report.
- **Portability:** full — the fact travels anywhere the driver wants.
- **Builds:** a portable-credential **platform** (the moat — selective disclosure of verified facts).
- **Aligns with:** DEC-2026-06-002 (driver-owned / agency-funded vault), DEC-2026-05-011 (Storm is the candidate's agent, not a CRA).

### Model B — Pace-central / driver leasing ✅ *Legitimate, but a different (smaller) business*
Pace stays the employer/lessor: it screens, holds the DQ file, and **leases/places** drivers to carriers. A carrier contracts **with Pace for a qualified driver** rather than making its own hiring decision about that person. The zk-proof is Pace's sales signal ("our seat is filled by a qualified driver").

- **Legal basis:** Pace is the employer; carrier buys driver capacity from Pace (49 CFR driver-leasing provisions where the lessor maintains the qualification file).
- **CRA risk:** low **only** in true leasing (carrier isn't running its own employment decision on the driver).
- **Portability:** none — locked to Pace's network (lock-in by design).
- **Builds:** a more robust **staffing agency**.
- **Tension:** conflicts with "Pace is the wedge, not the lock-in" (`PARTNERS.md`).

### Model C — Pace resells screening signals into other companies' *direct* hires ❌ *CRA trap*
Pace takes its own employer-pull (or a zk-proof derived from it) and gives it to an outside company **to inform that company's own decision to directly hire the driver.**

- **Why it fails:** furnishing screening-derived information to inform a *third party's* employment decision makes **Pace a Consumer Reporting Agency** — triggering the full FCRA CRA compliance regime (reinvestigation, accuracy disputes, §613 notices, etc.). The zk-proof wrapper does **not** save it: a proof of "clean MVR" is still consumer-report information, regardless of packaging.
- **This is the line we must not cross** (DEC-2026-05-011: never become a CRA; never disintermediate Accio).

---

## 4. The hybrid sweet spot (Pace stays the hub, driver owns the credential)

Pace can be the **operational center of gravity** without being the legal owner that resells reports:

- Pace originates the pull, **sponsors the fee**, runs the ops and the relationships.
- The **driver initiates and authorizes**, so the legal basis is candidate consent (Model A), not Pace reselling a report (Model C).
- Pace gets to be the indispensable place where it all happens; the proof is legally the driver's to present.

This preserves portability **and** keeps Pace powerful. It is Model A with Pace as the funding + workflow hub.

---

## 5. Soundness vs. provenance — the lesson to carry into the meeting

Two **independent** axes — a proof can be perfect on one and fail the other:

| Axis | Question | Status |
|---|---|---|
| **Soundness** | Is the math true (no false "clean" proofs)? | ✅ Our circuit delivers this. |
| **Provenance / consent** | Was the source pull the driver's to prove from? | ❌ Not if it's a company-private Pace pull. |

**Cryptography does not launder provenance.** A real proof off improperly-sourced data is still improperly sourced.

---

## 6. Questions for counsel (the meeting agenda)

1. **Driver-initiated, agency-funded pull (Model A):** If the *driver* initiates and authorizes an MVR/PSP for their own portable use, and **Pace pays the fee**, does the driver own the report as a consumer and may they freely re-share it (or a zk-derived fact of it)? What consent language makes the driver — not Pace — the consumer of record?
2. **Consent design:** What disclosure/authorization must the driver sign so the pull is a *consumer-initiated request for their own file* rather than an employer pull? (Today's forms are company-scoped.)
3. **Zk-proof as the shared artifact:** Is a selective-disclosure proof of a fact ("clean MVR, 36 months") legally distinct from sharing the underlying report? Does the driver authorizing the *proof* (not the report) change the analysis? Does it matter that no raw PII / no document is disclosed?
4. **DPPA:** For motor vehicle records specifically, do DPPA redisclosure limits constrain even a driver-authorized re-share or a zk-derived fact? Does the recipient need its own permissible use?
5. **Vendor contract:** Does the Accio/Key end-user agreement permit (a) driver-owned pulls through our integration, and (b) deriving/sharing zk-facts from delivered reports? What contract changes are needed?
6. **Model B (leasing):** If Pace operates as a driver-leasing employer and shares a "Pace-qualified" signal with carriers it leases to, is that outside FCRA's consumer-report definition? Where exactly is the line between "leasing a qualified driver" and "furnishing a consumer report for a direct hire" (Model C)?
7. **Pre-screen positioning:** Can a zk "pre-screen" fact be shared with a *potentially* hiring carrier as a "worth your time" signal **before** that carrier runs its own full DQ pull, without making us a CRA — given the carrier's actual decision rests on its own pulls? (This is the funnel in DEC-2026-06-004 §5.)
8. **Backfill:** The two existing test proofs were derived from Pace pulls. Should they be voided as part of cleanup?

---

## 7. Recommendation

Pursue **Model A (driver-initiated, agency-funded), with Pace as the operational hub** (the §4 hybrid). It is the only model that is simultaneously portable (the moat), low CRA-risk, and aligned with our documented strategy. Model B (leasing) is a legitimate fallback business but smaller and locked-in. Model C is off the table.

**The single engineering change** that turns the recommended model on is: **make the driver the one who clicks "order"** (and gate proofs to driver-owned pulls). Everything else — Pace paying, Pace running ops, Accio doing the pull — stays the same.

---

## Related decisions
- **DEC-2026-06-002** — driver-owned / agency-funded vault; Midnight is load-bearing.
- **DEC-2026-06-003** — multi-CRA proof rail; funded-pull ingestion is **gated on a formal FCRA opinion**.
- **DEC-2026-06-004** — ZK facts as the cheap pre-screen tier above the full DQ file.
- **DEC-2026-05-011** — Storm is the candidate's agent; never become a CRA; never disintermediate Accio.
- **DEC-2026-05-013** — cached-attestation marketplace (gated on the same FCRA opinion).
