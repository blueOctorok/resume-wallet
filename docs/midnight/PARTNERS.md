# Storm for Partners — Pace and the Open Employer Side

**Audience:** boss, Pace stakeholders, future agency / carrier partners, engineering team building employer-side features.

**Core claim:** Selective-disclosure attestations make Pace Drivers operationally stronger *and* make Storm's employer side a public good across the trucking-recruitment ecosystem. Pace is the wedge — not the lock-in. Every employer-side feature is built generically, with Pace as the proof case but not the constraint.

> Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the strategic shift, [`MOAT_THESIS.md`](./MOAT_THESIS.md) for the moat reasoning, and the existing [`PROJECT_ROADMAP.md`](../PROJECT_ROADMAP.md) "Pace Drivers as the wedge" section for the original framing this doc extends.

---

## Pace's business as it actually runs

Source: [pacedrivers.com](https://www.pacedrivers.com/) — their public marketing, which is the most reliable description of what they sell.

The spine of Pace's value proposition:

- **Pre-screening for insurance fit.** *"All our candidates pass background checks and are pre-screened to meet the employer's insurance requirements, saving time for everyone involved."* This is the highest-effort, highest-cost work they do for every driver, every placement.
- **Communication discipline.** "Refined quality calls" on day 1, day 2, week 1, bi-weekly, and post-placement. They explicitly call out *"candidates lose interest and fall out of the truck driver recruiting process due to poor communication."*
- **Single point of contact** for driver and employer — sold as accountability and trust.
- **The 36% in-90-days quit number** is the headline business problem they're solving.
- **60+ locations serviced** with partnerships going back to 2017 — placement volume is real and recurring.

Pace's day-to-day is not unique among trucking-recruiting agencies; it's a clean version of how the entire vertical operates. Anything that helps Pace generalizes to every other agency and direct-carrier customer that comes onto Storm's employer side.

---

## The four operational pains, and Storm's answer to each

### Pain 1 — Re-screen every driver for every carrier

Every time Pace places a driver at a new carrier, the carrier reruns insurance verification: pull MVR, verify employment history, confirm CDL class / endorsements, confirm clean PSP. Pace already paid to gather that data once during their initial pre-screen. Both sides duplicate effort. The driver waits.

**Storm's answer:** the driver's verified facts live as **attestations** in their portable DQ file. Pace's initial pre-screen produces attestations once. Every subsequent carrier accepts the same attestations.

- Phase 2: signed JWT attestations Pace has cryptographically authored
- Phase 3 (deferred): ZK proofs that work even without trusting Pace as issuer

For Pace's economics this is the headline change: per-placement screening cost trends toward **zero on repeat drivers**. Their margin per placement goes up; their throughput goes up; the driver doesn't sit through a second screening.

### Pain 2 — Multi-week placement loop

Today: driver applies → Pace screens → Pace introduces to carrier → carrier re-screens → carrier interviews → offer → onboard. Even a smooth path takes weeks. The screening lag is the largest non-interview chunk of that timeline.

**Storm's answer:** when both Pace and the receiving carrier are on Storm's employer side, attestations move with the driver. Carrier accepts Pace's pre-screen attestations natively. The carrier's *own* checks (interview, fit, schedule) remain — but the duplicative screening goes to zero. Days, not weeks.

For carriers this also reduces their compliance burden. They keep an audit trail proving the driver met their insurance threshold, but they hold *attestations*, not raw PII. Their FCRA / data-handling posture improves.

### Pain 3 — 36% quit within 90 days

This is a *match-quality* problem framed as a *retention* problem. Drivers quit because something surfaced post-hire that should have been visible upfront — schedule expectations, equipment specifics, MVR detail the carrier missed, mileage assumptions, pay structure that didn't match what was discussed.

**Storm's answer (two halves):**

1. **Carriers publish requirements as attestation requests.** Instead of "must have CDL-A and clean MVR" buried in a job posting, carriers can publish a structured attestation set: *"requires: clean MVR 36mo, CDL-A with hazmat valid 12+ months, no DUI ever, 2+ years OTR experience."* The driver's career card matches against the requirement set automatically. Mismatches surface *before* anyone schedules an interview.
2. **Drivers see verified carrier facts, not just verified driver facts.** Carrier compensation structure, equipment, schedule, and benefits become attestable claims about the *role*. Drivers stop being lied to about pay or hours during recruitment because the carrier's own claims are part of the verified record.

Match quality up, post-hire surprise down, attrition trends toward the structural floor instead of the artificial-mismatch ceiling.

### Pain 4 — Communication-gap fallout

Pace's own marketing names the cost: candidates lose interest and fall out due to poor communication during the screening lag. The current solution is human effort (the day-1 / day-2 / week-1 calls).

**Storm's answer:** Stormi closes the loop. The driver gets real-time visibility into *exactly* where their placement stands:

- "Pace shared your card with Carrier X."
- "Carrier X requested your MVR attestation. Already verified — auto-approved."
- "Carrier X scheduled an interview slot for Tuesday."
- "Pace is reviewing two more carriers for you this week."

Pace's recruiters keep doing the high-value human work (interpreting fit, negotiating, navigating exceptions) while Stormi handles the status-update layer that drivers fall out of today. **Pace's recruiter capacity per driver effectively doubles** because they're not spending it on basic communication.

---

## The reciprocal driver win

The Storm thesis only works if drivers actively benefit. They do, on three axes:

1. **Stop re-screening.** A driver placed by Pace at Carrier A, who later moves to Carrier B (with or without Pace), doesn't redo their MVR. They don't re-verify employment. Their attestations are theirs.
2. **Stop handing over PII to every interview.** Today, a driver hands over license number, DOB, full address, and full violation history to every carrier evaluating them. With selective disclosure, the carrier sees `✓ clean MVR 36mo` and `✓ CDL-A hazmat valid through 2028` — nothing more, unless the driver explicitly chooses to share more for a specific role.
3. **Get visibility into where they stand.** Stormi turns the placement process from "I sent in my paperwork two weeks ago and haven't heard anything" into "Pace shared my card with three carriers; one is interviewing Tuesday." That's the difference between a driver who keeps engaging and a driver who fades.

A driver who's worked through Pace once and built a complete DQ file in Storm has, in effect, **earned a portable career credential that follows them anywhere in the vertical.** That driver is dramatically more likely to stay engaged with Pace for future placements (because they keep returning to the same Storm card) — but it's also a real benefit to the *driver*, not just retention math for Pace.

---

## Why this strengthens Pace specifically

Pace's competitors today are other recruiting agencies. The competitive pitch sounds like *"trust us, we vet our drivers more carefully."* It's a judgment-based moat — defensible but not provable.

With Storm, Pace's pitch becomes *"our drivers come pre-verified — verify it yourself."* That shifts from *judgment-as-moat* to *evidence-as-moat*. Three consequences:

1. **Carriers prefer Pace's drivers because the math works.** A Pace-placed driver carries verified attestations that match the carrier's published requirements. Less screening cost, less risk, faster onboarding. The carrier doesn't need to *trust* Pace as much — they trust the verified facts directly.
2. **Pace's verified-driver pool compounds.** Every driver Pace places who builds a DQ file becomes a permanent network asset. After a year of placements, Pace's pool is deeper than any new agency entering the space could replicate. New competitors start at zero verified drivers; Pace starts at thousands.
3. **Pace's compliance posture improves.** Pace today retains driver PII for compliance / dispute / audit reasons. With attestations, Pace's audit trail can be *"we verified Driver Y met Carrier X's insurance threshold via attestation #ABC123 on 2026-04-15."* The PII stays with the driver. Pace's data-handling burden drops; their FCRA exposure drops; their cyber-insurance premium drops.

This is *also* a moat for Pace inside their own market — not just for Storm against incumbents (Tenstreet et al., per [`MOAT_THESIS.md`](./MOAT_THESIS.md)). Two-sided moat: Storm beats CRAs; Pace, on Storm, beats other agencies.

---

## Why this is open, not Pace-exclusive

The user's vision and the engineering reality both require this: **Pace is the wedge, not the lock-in.** Storm's employer-side product is built generically and serves anyone who installs the employer blocks.

### Architectural enforcement

The existing employer architecture (per [`block-development.mdc`](../../.cursor/rules/block-development.mdc) and [`employer-architecture.mdc`](../../.cursor/rules/employer-architecture.mdc)) is already shaped this way:

- `employer-screening-consent`, `employer-mvr-orders`, `employer-psp-orders` are **company-scoped blocks** keyed by `company_id`
- Any company can install them — Pace, another staffing agency, a direct carrier
- `employer_block_audit` is per-company, append-only
- The screening order API (`/api/employer/screenings/order`) gates on `company_id`-scoped capabilities, not on a Pace-specific allowlist

There is **no code path** that special-cases Pace. Adding one would be a regression. If a future feature is tempting to wire as `if (company.name === 'Pace')`, that's the signal to refactor it as a generic capability or pricing tier.

### Driver portability

Attestations belong to the driver, not to the agency that issued them. Implications:

- A driver placed by Pace at Carrier A can later be re-placed by Pace at Carrier B without re-screening (Pace benefit)
- A driver placed by Pace can later go directly to Carrier C without Pace's involvement, and the same attestations work (driver benefit)
- An agency competing with Pace can also place a Storm-verified driver with the same attestations (ecosystem benefit)

That third bullet is critical. **Pace doesn't *own* the verified driver pool — Storm does, on behalf of the drivers themselves.** Pace's competitive advantage is volume + relationship, not data lock-in. This is intentional: Storm's value proposition to Pace is "you'll place faster and at higher margin," not "you'll trap drivers in our system."

### Network effects flip the right direction

If Storm tried to lock drivers to Pace, drivers would resist (correctly). They'd avoid building Storm DQ files because the attestations would be useless outside Pace's network. The thesis collapses.

By making attestations driver-owned and agency-agnostic, drivers actively *want* to build complete Storm files — the file is their portable career. **The network effect runs through drivers as the unit of value, not agencies.** Pace benefits because more drivers in Storm = more drivers Pace can match. Other agencies benefit similarly. Carriers benefit. Drivers benefit most.

---

## What this means for product decisions

Every employer-side feature must pass these three filters:

### Filter 1 — Generic or Pace-specific?

If the feature only makes sense for Pace's specific workflow, build it as **a Pace-customizable configuration** of a generic feature, not as a Pace-only feature. Examples:

- **Pace's quality-call cadence** (day 1, day 2, week 1, bi-weekly) → a configurable check-in cadence on the employer block, defaulting to Pace's pattern. Any agency or direct employer can change cadence in their settings.
- **Pace's "single point of contact" pattern** → an employer-side "primary recruiter" assignment field that any company can use.
- **Pace's insurance-fit pre-screen** → a published "requirements profile" structure that any employer can author for their carriers.

Every Pace use case becomes a feature that other employers can adopt. Pace shapes the defaults; other employers configure.

### Filter 2 — Does it strengthen Pace AND the ecosystem?

A feature that only strengthens Pace (e.g., "exclusive driver pool gated to Pace") fails. A feature that strengthens the ecosystem but burdens Pace operationally (e.g., requires Pace to share their playbook publicly) also fails. The good features strengthen both:

- Verified-attestation portability → Pace benefits (faster placements), ecosystem benefits (drivers can move freely)
- Carrier-published requirement profiles → Pace benefits (better matching), ecosystem benefits (drivers see clear criteria)
- Stormi communication automation → Pace benefits (recruiter capacity up), ecosystem benefits (drivers stay engaged regardless of agency)

### Filter 3 — Does it pull more verified drivers into the pool?

The pool is the asset. Anything that grows the verified-driver pool grows the value of the platform for *everyone* on the employer side, including Pace. Anything that grows the pool *inside Pace only* is anti-pattern.

Examples that grow the pool right:

- Driver self-serve attestation refresh (drivers maintain their files between placements)
- Stormi nudges to complete DQ file blocks
- Verified-fact celebrations on the career card (visual reward for completion)
- Cross-agency portability messaging in driver onboarding ("Your file works at any Storm employer")

Examples that grow the pool wrong:

- "Verified through Pace" branding that implies Pace ownership of the verification
- Driver-side UX that surfaces Pace-specific copy when the driver is in the platform via a different agency

---

## Pricing implication

Pace's economics with Storm differ from a direct carrier's economics with Storm. The product is the same; the value capture differs.

| Customer type | What they pay for | Why |
|---|---|---|
| **Recruiting agency (Pace, others)** | Per-placement attestation issuance + verification access for their carrier customers | Agency margin is per placement; Storm fees scale with placements |
| **Direct carrier (small to mid-size)** | Per-attestation pull + flat subscription for ongoing access to their applicant pool | Carriers pay screening costs today; Storm fees replace that line item |
| **Large carrier (national fleets)** | Custom contract — bulk attestation pulls, integration with their ATS, possibly DQ-File-as-API access | Volume justifies enterprise pricing |
| **Driver self-serve** | Optional — refresh attestations, request employment verifications, pay for premium prep | Most drivers' attestations are paid for by the agency or carrier; self-serve is for between placements |

Pace's economics are *better* on Storm than today (lower per-placement screening cost, higher placement throughput), and Storm captures a smaller per-event fee than a CRA charges for an MVR pull. **Both Pace and Storm win at the expense of the incumbent CRA's margin** — that's the right end of the unit economics to be on.

For other agencies and direct carriers, the same pricing structure applies. No favored status for Pace; Pace's advantage is timing, volume, and relationship, not pricing.

---

## What this means for engineering

Concrete implications for code already in the repo:

1. **`employer_hub_blocks` is the right architectural shape.** Don't second-guess it. Per-company block install is the mechanism that makes "open to anyone" possible. (Already enforced by [`employer-architecture.mdc`](../../.cursor/rules/employer-architecture.mdc).)
2. **Don't add a `companies.is_pace` flag or anything similar.** If Pace needs a feature configured a specific way, it's a per-company *configuration*, not a per-company *code path*.
3. **The CRA-compliance rule (in [`PROJECT_ROADMAP.md`](../PROJECT_ROADMAP.md) "CRA compliance") is structurally protected by attestations.** Driver-self-ordered attestations live on the career card; employer-ordered screenings are scoped to that employer permanently. Phase 2's `attestationService` makes this distinction enforceable in code, not just policy.
4. **Driver-onboarding copy must not assume Pace.** A driver may arrive via a Pace invite, a different agency's invite, a direct carrier's invite, or self-serve. Every onboarding flow must read the inviting company from the invite token and adjust copy generically — never hardcode Pace.
5. **Phase 2 attestations are the priority for Pace's win.** Phase 1 (Web2 cleanup) makes Pace's experience smoother. Phase 2 (selective disclosure UX) is what actually changes Pace's economics. Phase 3 (Midnight ZK) deepens the moat against future CRAs that learn to copy selective disclosure — important long-term, but Phase 2 captures most of Pace's operational benefit.

---

## Risks specific to the partner story

| Risk | Severity | Mitigation |
|---|---|---|
| Pace expects Storm-as-Pace's-software, not Storm-as-platform | Medium | Boss conversation up front: Pace gets first-mover advantage and feature-shape influence, *not* exclusivity. Position Pace as design partner. |
| Other agencies see Pace's logo / influence and assume Storm is Pace-controlled | Medium | Public-facing marketing emphasizes platform; case studies feature multiple employer types over time |
| Carriers refuse to accept attestations from "an agency's tool" — they want a neutral vendor | Medium | Storm is the issuer of attestations, not Pace. Pace authors the *initial* verification; the cryptographic signature is Storm's. Phase 3 ZK proofs eliminate any "trust the agency" requirement entirely. |
| Pace exits / changes ownership / changes strategy | Low–Medium | Storm's product is not coupled to Pace's continued participation. If Pace leaves, Pace's drivers retain their attestations; the platform continues serving other agencies. |
| Drivers feel their data is Pace's, not theirs | Low | Driver-controlled disclosure (Phase 2) and on-chain proofs (Phase 3) make ownership concrete. Onboarding copy reinforces "your file, your control." |

---

## One-paragraph version

Storm's selective-disclosure attestations directly fix Pace Drivers' four biggest operational pains: per-placement re-screening, multi-week placement loops, 36% in-90-days attrition, and communication-gap fallout. Pace's per-driver screening cost trends to zero on repeat drivers; placement timelines compress from weeks to days; match quality improves so post-hire attrition drops; Stormi closes the communication loop without consuming recruiter capacity. The platform is open to any other agency or direct carrier on the same employer-side blocks — Pace's advantage is volume, timing, and relationship, not data lock-in. Drivers benefit most: their verified DQ file follows them anywhere in the vertical, and they stop handing over full PII to every carrier evaluating them. Pace becomes structurally stronger; the trucking-recruitment ecosystem gets a public-good verification layer; drivers get a portable career credential they actually own.

---

**Last updated:** 2026-05-22
**Sources:** [pacedrivers.com](https://www.pacedrivers.com/), boss conversation 2026-05-22, existing [`PROJECT_ROADMAP.md`](../PROJECT_ROADMAP.md) "Pace Drivers as the wedge" section.
