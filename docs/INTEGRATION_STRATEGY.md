# StormChain Integration Strategy

## 1. Philosophy: Standalone First, Integrate Where It Matters

StormChain is designed as a **standalone** platform: drivers and developers build and own their profile; employers can use the hub, talent search, and pipeline entirely inside StormChain. That experience stays the center of the product.

**Reality:** Recruiting and operations teams already use an ATS (e.g. Bullhorn, TenStreet), job boards, and other tools. Asking them to drop those and use only StormChain is unrealistic. The path to adoption is **fitting into their existing workflow** and making that workflow smoother and better than the competition.

**Strategy:** Keep the full standalone experience. Add a clear **integration surface** so StormChain can be used as a **module** alongside Bullhorn and others — same product, two ways to use it: alone or plugged in.

---

## 2. The Integration Surface

### Outbound (StormChain → their world)

| Artifact | What | How they use it |
|----------|------|-----------------|
| **Application Invite Link** | URL to send candidates to fill DOT application | Paste in ATS, email, or text to candidate |
| **DOT Application Export** | PDF of completed application | Download, attach to candidate record in ATS |
| **MVR Authorization Link** | URL/email for candidate to sign authorization | Send via email or ATS |
| **MVR Result** | PDF/summary of MVR report | Download, attach to candidate record in ATS |
| **Career Card** (optional) | One-pager summary of candidate | Link or PDF for quick reference (not required in integration flow) |

### Inbound (future)

- **Webhooks / APIs** — So an ATS can create candidates, request reports, or receive status updates. Not required for v1; design flows so "we will need to report status" is possible later.

**Principle:** Every flow should have a "standalone path" (use only StormChain) and a "handoff path" (link or export for ATS/email). The integration surface is company-agnostic — any company can use the same flows.

---

## 3. Core Integration Flows

### Flow 1: Application Invite

**Use case:** Company admin wants candidate to fill out DOT application in StormChain.

```
Admin creates invite (optional: candidate email, job reference)
    ↓
Option A: Copy link → paste into ATS/email/text
Option B: Click "Send Email" → StormChain sends professional email directly
    ↓
Candidate opens link → signs up or logs in → fills DOT application
    ↓
Admin sees completed application → downloads PDF → attaches to ATS
```

**Key points:**
- Link works for ANY company (token identifies the company)
- Candidate sees company name on the page ("Complete your application for [Company]")
- One link, one action, one outcome
- Status visible to admin: pending / viewed / in-progress / completed
- **Email sending:** Professional template with instructions, completion time estimate, security messaging
- **Bullhorn integration:** Placeholder button (future: push link directly to candidate record)

### Flow 2: DOT Application Export

**Use case:** Admin needs to attach completed application to candidate record in ATS.

```
Admin views list of DOT applications (or finds specific candidate)
    ↓
Clicks "Download" → gets PDF
    ↓
Attaches PDF to ATS
```

**Key points:**
- One-click export
- Clean, professional PDF (same data as in-app view)
- Works from admin panel or employer hub

### Flow 3: MVR Order (Manual Entry)

**Use case:** Admin has signed authorization form and needs to run MVR in StormChain.

```
Admin opens "Order MVR" (from admin panel or employer hub)
    ↓
Enters candidate info from authorization form:
  - Name, DOB, SSN (last 4), address
  - DL number, state
    ↓
Selects billing (company pays, or other arrangement)
    ↓
Clicks "Order MVR"
    ↓
MVR result comes back → admin downloads/views → attaches to ATS
```

**Key points:**
- Manual data entry (no candidate wallet/login required)
- Company is billed (or payment handled separately)
- Result linked to candidate if they exist in system, or standalone if not
- Same Accio integration, different entry point

### Flow 4: MVR Authorization (Send from StormChain)

**Use case:** Admin wants to send authorization form to candidate for signature.

```
Admin selects candidate (or enters email)
    ↓
Clicks "Send MVR Authorization"
    ↓
StormChain sends email with link to authorization form (Adobe or hosted)
    ↓
Candidate signs
    ↓
Admin proceeds with Flow 3 (manual MVR order)
```

**Key points:**
- StormChain sends the email (or provides link to copy)
- Authorization form can be Adobe (external) or StormChain-hosted
- Decoupled from MVR order — auth is step 1, order is step 2

---

## 4. Career Card: Core Product, Not Integration Step

The career card is the **culmination** of everything a candidate does in StormChain (profile, resume, DOT app, MVR, work history). It's:

- **Beautiful and at-a-glance** — designed to be the single summary
- **Shareable** — public link candidates can share
- **Already built** — no changes needed for integration

**In integration flows:** The career card is **not a required step**. Admins get what they asked for (application, MVR) without being forced to also export a career card. However:

- Career card link/export can be **optional** (e.g. "View career card" or "Copy link")
- For companies that want a one-pager summary, it's there
- It's a value-add, not a blocker

---

## 5. Architecture: Company-Agnostic

All integration features are tied to **company**, not hardcoded to any specific client.

### Application Invites

```sql
application_invites (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  created_by_user_id UUID REFERENCES users(id),
  token VARCHAR(64) UNIQUE NOT NULL,
  
  -- Optional targeting
  candidate_email VARCHAR(255),
  candidate_name VARCHAR(255),
  job_posting_id UUID REFERENCES job_postings(id),
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, used, expired, cancelled
  used_by_user_id UUID REFERENCES users(id),
  used_at TIMESTAMP WITH TIME ZONE,
  
  -- Lifecycle
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

### Admin MVR Orders

Existing `mvr_orders` table already has:
- `ordered_by_company_id` — which company ordered
- `ordered_by_user_id` — which admin placed the order

For manual entry, we add a flag or use existing fields to indicate "admin-placed" vs "candidate self-ordered."

### Exports

Export endpoints check company membership (for employer routes) or admin role (for admin routes). No company-specific logic.

---

## 6. "Smoother and Better" Principles

| Pain point (competition) | StormChain approach |
|--------------------------|---------------------|
| Multiple steps to create a link | One form, one button, copy link |
| Confusing status ("did they do it?") | Clear status: pending / in-progress / completed |
| No easy export | One-click download (PDF) |
| Manual MVR entry is 5 screens | One form with all fields |
| Candidate has to "figure out" the app | Link lands on clear page: "Complete your application for [Company]" |

---

## 7. Implementation Order

1. **Application Invites** — create, list, use (so companies can send DOT application links)
2. **DOT Application PDF Export** — so admins can download and attach to ATS
3. **Admin MVR Order (manual entry)** — so admins can run MVR with data from authorization form
4. **MVR Authorization Send** — so admins can send the form from StormChain (lower priority if they use Adobe separately)

---

## 8. First Partner: Pace Drivers

Pace Drivers is the first company using this integration surface. Their flow:

1. Recruiter identifies candidate in Bullhorn
2. **Pace Admin creates application invite in StormChain** → gets link
3. Pace Admin sends link to candidate (via Bullhorn or email)
4. Candidate completes DOT application in StormChain
5. **Pace Admin downloads application PDF** → attaches to Bullhorn
6. Pace Admin sends MVR authorization form (Adobe)
7. Candidate signs authorization
8. **Pace Admin enters data in StormChain** → orders MVR
9. MVR result comes back
10. **Pace Admin downloads MVR** → attaches to Bullhorn

Same flows, same features — Pace just happens to be first. Any company with a StormChain employer account can use these exact same features.

---

## 9. Future: Deeper Integrations

Once the integration surface is proven:

- **Webhooks** — "Application completed" event pushed to ATS
- **API** — ATS can create invites, check status, fetch exports programmatically
- **Bullhorn plugin** — Native integration so admins don't leave Bullhorn
- **TenStreet bridge** — If carriers use TenStreet, we can complement or replace specific flows

These are future enhancements. The v1 integration surface (links + exports + manual MVR) works without any ATS-side integration.
