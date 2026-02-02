# StormChain Strategy

## Brand

- **Application name:** StormChain (formerly Veree)
- **Token name:** stormchain (STORM)
- **Tagline:** "We make hard-to-get jobs easy"

## User Roles

### 1. Drivers (Transportation Industry)

- DOT applications, MVR, DQ files, FMCSA verification
- Driver-specific workflows and compliance
- **Target:** CDL drivers and all roles at trucking/logistics companies (dispatcher, mechanic, office, warehouse, safety)
- **App role:** `driver`
- **DB:** `driver_profiles`, `driver_applications`, `mvr_orders`, `mvr_results`

### 2. Software Engineers (Tech Industry)

- Portfolio showcase, GitHub integration, commits visualization
- **The problem:** Devs have work to show; employers don't look. 500 résumés, most bootcamp slop.
- **The solution:** One card, one link. Proof over noise. Work as filter — removes slop.
- **Blockchain/token story:** Devs understand and appreciate it; it's a selling point, not friction.
- **App role:** `developer`
- **DB:** `developer_profiles`, `developer_projects` (migration 011)

### 3. Employers

- Agnostic employer side — same company profile, job board, applicant pipeline for both verticals
- One platform, two (or more) talent pools
- **Gated access:** Requires company email (personal domains like gmail/yahoo blocked)
- **App role:** `employer`
- **DB:** `companies`, `job_postings`, `applications`

## Why This Positioning Works

- **Not Indeed:** We're vertical (transportation + tech), not horizontal. We own specific workflows (DOT/MVR for drivers, portfolio/GitHub for devs).
- **Volume + Depth:** General applications get traction fast. Vertical-specific depth (DOT, portfolio) keeps us defensible.
- **Same slogan, two worlds:** "We make hard-to-get jobs easy" — each vertical interprets it their way.
- **Devs and crypto:** Token/blockchain is a feature for devs, not friction. They'll engage with it.

## The Career Card

Unified concept across verticals — aggregated profile, QR/shareable link:

| Role                   | Career Card Shows                                            |
| ---------------------- | ------------------------------------------------------------ |
| **Drivers**            | DQ file, MVR status, DOT compliance, employment verification |
| **Software Engineers** | Portfolio, GitHub, commits, verified work history            |

The Career Card solves the "employers don't look at my work" problem by making proof the first thing they see — not buried behind links.

## Future Expansion

More verticals may be added — same model:

1. General application flow (fast, easy)
2. Vertical-specific depth layer (proof, verification)
3. Same employer-side experience

## Key Decisions

- **App name:** StormChain
- **Token:** stormchain (STORM)
- **Parent company:** Pace Drivers (transportation origin, expanding)
- **Positioning:** Verified hiring platform for hard-to-get jobs — starting with drivers and devs
- **Card name:** Career Card (unified across verticals)
