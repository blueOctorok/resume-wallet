# Provven marketing landing page

Signed-out visitors land here (wired through `DriverShell` → `LandingPage`). Replaced the old `src/components/HomePage.tsx` (2026-08-06).

## Structure

One section = one job. `LandingPage.tsx` is composition only.

The DOT application leads. The resume is second. Selective disclosure sits after “verify when they ask.”

| File | Job |
|---|---|
| `LandingPage.tsx` | Composition, scroll-reveal hook, motion CSS (respects `prefers-reduced-motion`) |
| `HeroSection.tsx` | Brand + DOT headline + CTAs + `DqFileCard` on a full-bleed ink plane |
| `DqFileCard.tsx` | Hero visual — the DQ file (application, license, consent, MVR) |
| `CareerCardSection.tsx` | Fill it once — application, license scan, history, other papers |
| `ResumeBandSection.tsx` | Short band — resume prints from the application |
| `ProblemSection.tsx` | Why the file exists — stop retyping the same application |
| `HowItWorksSection.tsx` | Fill → Share → Verify |
| `DisclosureSection.tsx` | Verify when asked, then selective disclosure (`DisclosureCard` toggle) |
| `DisclosureCard.tsx` | Employer view ↔ vault — screener facts only carry the verified tag |
| `EmployersSection.tsx` | `#employers` anchor — receive the DQ file, ask for consent / MVR |
| `TrustSection.tsx` | Midnight / ZK narrative (present-continuous claims only) |
| `FinalCtaSection.tsx` | Closing CTA — repeats the hero, not “build a card” |
| `landing-shared.tsx` | `InkBand`, `SectionHeader`, `LandingContainer`, palette helpers |

**Ink bands** (hero, disclosure, trust) are deliberately theme-independent — always the deep-ink plane, in light and dark themes. Everything else is theme-aware via `isDark`.

## Palette (Blue Star preview, 2026-08-18)

Site-wide brand (Tailwind `teal-*` remaps to Hot Embers).

- **Ink bands** are Midnight Blue (`#173150`).
- **Light sections** sit on cool paper (`#f3f4f5`). Ironside `#939598` is captions, hints, and borders (`text-ironside`). Ledes stay `#5c6166` for contrast.
- **Accent: Hot Embers `#f15a2b` only.** Same hex on navy and paper. No homemade ember tints.
- **Secondary:** Denim `#00608b`, Dark Amber `#F28A0F`, Retro Teal `#3F8A8C`.
- Redaction bars stay **neutral slate**.

## Brand marks

- **`ProvvenWordmark`** — Blue Star shield + `PROVVEN` (Montserrat bold). Hero, nav, sign-in, footer.
- **`ProvvenMark`** — shield alone. Embers on navy, Midnight Blue on paper. Favicon + `public/brand/`. Spec: `docs/BRAND.md`.
- **`SealDivider`** — hairline + ember diamond.

## Fonts

- **Montserrat** — body, lockup, and headlines (`font-display` → `--font-montserrat`).
- Monospace (`font-mono`) — "technical proof" moments: sharing strip, verified tags, the `prove(cdl_class)` line.

## Language guardrails (do not loosen)

- Verification language only on third-party / issuer-backed facts — never self-reported data (DOT answers, resume, license scan, uploaded papers).
- Midnight / ZK narrated present-continuous ("built on Midnight", "designed for selective disclosure") — no per-fact "proven on-chain right now" claims until Phase 3 proofs are live.
- No wallet / token / seed-phrase language anywhere.
- Do not advertise medical-card photo upload (still coming soon in the product).
