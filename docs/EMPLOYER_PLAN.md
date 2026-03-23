# Employer Side — Product Plan

## What We Are

A talent discovery platform. Employers find verified candidates and make first contact. That's it.

**Think:** Indeed, but with verified candidate data and flat pricing instead of pay-per-click gambling.

## What We Are NOT

- Not an ATS (applicant tracking system)
- Not an HRIS (onboarding, payroll, benefits)
- Not a background check company (MVR ordering is the one exception — it's niche and valuable)
- Not a compliance/reporting platform

Once an employer decides to hire someone, that moves to their own systems. We own top-of-funnel.

---

## The Employer Flow

```
Connect wallet → Select "Employer" → Company setup
→ Land on hub → Post jobs, search talent
→ Find someone → View their career card (verified blocks)
→ Interested? → Save them (moves to "My Candidates" pool)
→ Ready? → Message them, order MVR if needed
→ Hire them in their own system
```

---

## Core Features (KEEP)

| Feature | Status | Notes |
|---------|--------|-------|
| Company onboarding/profile | Built | Entry point. Clean, stays as-is. |
| Job posting (CRUD) | Built | Post, edit, activate/deactivate. Keep simple. |
| Talent search | Built | THE money feature. Filter by verified blocks, location, skills. |
| Career card viewing | Built | Verified, block-driven candidate profiles. Our differentiator. |
| Candidate pool (pipeline) | Built (over-scoped) | **Simplify.** See below. |
| Candidate notes | Built | Private employer notes. Useful, lightweight. |
| Messaging | Built | Direct candidate communication. |
| MVR ordering | Built | Pay-per-order via USDC. Real revenue. |
| Team management | Built | Owner + members. Keep basic. |
| AvA (employer) | Not built | AI assistant with context about their open roles and candidate pool. |

## Simplify: Candidate Pipeline

**Current state:** 6-column kanban (New → Reviewing → Interviewing → Offer Sent → Hired → Rejected). This implies we're replacing their ATS. We're not.

**Target state:** 3 statuses only.

| Status | Meaning |
|--------|---------|
| **New** | Just applied or was saved from talent search |
| **Contacted** | Employer has reached out |
| **Archived** | Not interested / already hired / passed |

Keep the kanban UI (it looks good), just with 3 columns instead of 6. Drop "Reviewing", "Interviewing", "Offer Sent", and "Hired" — those are ATS territory.

## Remove: Find Drivers Page

`FindDriversPage.tsx` is a driver-specific duplicate of Talent Search. This app isn't just for drivers. One search page with career-category filters handles everything.

**Action:** Remove `find-drivers` from EmployerShell. Talent Search becomes the single discovery page with block-type filters (CDL, GitHub, Portfolio, etc.) that adapt to whatever career categories exist.

## Remove: Reports / Analytics Page

Over-scoped for V1. Employers don't need compliance reports or hiring analytics from us. If we add analytics later, it should be simple: views per job, contacts made, that's it.

**Action:** Remove `reports` route from EmployerShell. Can revisit post-launch.

## Remove: Dead Code

| File/Route | Why |
|------------|-----|
| `ApplicationInvites.tsx` | Not imported anywhere. Dead. (`CandidateOutreach.tsx` replaced it — same APIs, actually wired up.) |
| `/api/employer/hub/driver-data` | No client calls it. Dead. |
| `/api/employer/applications/[id]/export` | No UI links to it. DOT export is candidate-side concern. |
| `/api/employer/reports` | Removing reports page. |
| `EmployerVerificationSection` | Scope creep — we're not a verification company. |

**KEEP:** `/api/employer/invites` and `/api/employer/invites/send-email` — actively used by `CandidateOutreach.tsx` for block-specific candidate outreach.

---

## Revenue Model

### Why We Win Against Indeed

| Pain Point (Indeed) | StormChain Answer |
|---------------------|-------------------|
| $25/day minimum per job, costs rising 300-400% | Flat monthly pricing |
| Spam applications, 1000+ unqualified candidates | Verified block-based profiles — candidates invest in building quality profiles |
| Pay-per-click bidding war | Transparent subscription |
| Self-reported resumes, no verification | Career cards with verifiable CDL, MVR, GitHub, education, employment |
| Locked into Indeed's ecosystem | Web3-native, wallet-based, portable identity |

### Pricing Tiers

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | $0 | 1 active job, browse talent (blurred details), 5 messages/month |
| **Pro** | ~$49/mo USDC | Unlimited jobs, full talent search, unlimited messaging, AvA, team seats |
| **Enterprise** | Custom | API access, bulk MVR, priority support |

### Per-Transaction Revenue

| Action | Cost |
|--------|------|
| MVR order | Per-order USDC (already built) |
| Sponsored/featured job | Future upsell — pay to boost visibility to candidates |

---

## Build Order (Implementation Priority)

### Phase 1: Simplify & Ship (do this first)

1. **Simplify pipeline to 3 columns** (New, Contacted, Archived)
2. **Remove Find Drivers page** — merge into Talent Search with career-category filters
3. **Remove Reports page** — cut dead weight
4. **Clean up dead code** (ApplicationInvites, unused API routes)
5. **Polish Talent Search** — make sure block-type filters work for all career categories, not just drivers
6. **Polish Job Posting** — smooth flow, clear UX

### Phase 2: Monetization Gate

7. **Subscription system** — Free tier limits (1 job, 5 messages) + Pro unlock via USDC
8. **AvA for employers** — context-aware assistant that knows their open roles and can help write job descriptions, suggest search filters, understand candidate blocks

### Phase 3: Post-Launch Upsells

9. Sponsored job posts (pay for visibility boost)
10. "Suggested for you" candidate matching (AvA recommends candidates based on job requirements vs blocks)
11. Basic analytics (views per job, contacts made)
