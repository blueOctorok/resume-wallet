# Provven marketing landing page

Signed-out visitors land here (wired through `DriverShell` → `LandingPage`). Replaced the old `src/components/HomePage.tsx` (2026-08-06).

## Structure

One section = one job. `LandingPage.tsx` is composition only.

| File | Job |
|---|---|
| `LandingPage.tsx` | Composition, scroll-reveal hook, motion CSS (respects `prefers-reduced-motion`) |
| `HeroSection.tsx` | Brand + headline + CTAs + `DisclosureCard` on a full-bleed ink plane |
| `DisclosureCard.tsx` | **The core visual.** Career Card split by the gold selective-disclosure seam; `view='shared' \| 'vault'` |
| `ProblemSection.tsx` | Why hiring runs on oversharing (3 editorial columns) |
| `CareerCardSection.tsx` | Card built from blocks; sparse card still valid |
| `DisclosureSection.tsx` | Money shot — interactive Employer view ↔ Your vault toggle |
| `HowItWorksSection.tsx` | Build → Verify → Share |
| `EmployersSection.tsx` | `#employers` anchor; block-request product mock |
| `TrustSection.tsx` | Midnight / ZK narrative (present-continuous claims only) |
| `FinalCtaSection.tsx` | Closing CTA + candidate-agent small print |
| `landing-shared.tsx` | `InkBand`, `SectionHeader`, `LandingContainer`, palette helpers |

**Ink bands** (hero, disclosure, trust) are deliberately theme-independent — always the deep-ink plane, in light and dark themes. Everything else is theme-aware via `isDark`.

## Palette (ND Blue + Dome Gold, 2026-08-18)

Site-wide brand (Tailwind `teal-*` remaps to Dome Gold). **No teal, violet, or Hot Embers.**

- **Ink bands** are ND Blue (`#0c2340`).
- **Light sections** sit on warm cream (`#f7f4ed`) with stone neutrals.
- **One accent: Dome Gold `#c99700`.** Verified facts, disclosure seam, CTAs. Text on navy: `#d4b44a`. Text on cream: `#8a6700`.
- Redaction bars stay **neutral slate**.

## Brand marks

- **`ProvvenWordmark`** — Blue Star shield + `PROVVEN` (Montserrat bold). Hero, nav, sign-in, footer.
- **`ProvvenMark`** — shield alone. Gold on navy, ND Blue on cream. Favicon + `public/brand/`. Spec: `docs/BRAND.md`.
- **`SealDivider`** — hairline + gold diamond.

## Fonts

- **Montserrat** — body, lockup, and headlines (`font-display` → `--font-montserrat`).
- Monospace (`font-mono`) — "technical proof" moments: sharing strip, verified tags, the `prove(mvr_clean_36mo)` line.

## Swapping the Career Card mock for a real screenshot

`DisclosureCard` is a hand-built mock (fictional "Marcus Reed"). To replace it with a product screenshot later:

1. Drop the screenshot in `public/` and swap `<DisclosureCard view='shared' />` in `HeroSection.tsx` for an `<Image>`.
2. Keep the pedestal glow div behind it — it does the "sitting on the plane" work.
3. `DisclosureSection.tsx` should keep the interactive component: the toggle **is** the demo. If the real product ships an equivalent share-preview screen, embed that instead.
4. Mock data lives at the top of `DisclosureCard.tsx` (`VERIFIED_FACTS`, `PRIVATE_ROWS`) if you just want different facts.

## Language guardrails (do not loosen)

- Verification language only on third-party / issuer-backed facts — never self-reported data.
- Midnight / ZK narrated present-continuous ("built on Midnight", "designed for selective disclosure") — no per-fact "proven on-chain right now" claims until Phase 3 proofs are live.
- No wallet / token / seed-phrase language anywhere.
