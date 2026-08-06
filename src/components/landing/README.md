# Provven marketing landing page

Signed-out visitors land here (wired through `DriverShell` → `LandingPage`). Replaced the old `src/components/HomePage.tsx` (2026-08-06).

## Structure

One section = one job. `LandingPage.tsx` is composition only.

| File | Job |
|---|---|
| `LandingPage.tsx` | Composition, scroll-reveal hook, motion CSS (respects `prefers-reduced-motion`) |
| `HeroSection.tsx` | Brand + headline + CTAs + `DisclosureCard` on a full-bleed ink plane |
| `DisclosureCard.tsx` | **The core visual.** Career Card split by the violet selective-disclosure seam; `view='shared' \| 'vault'` |
| `ProblemSection.tsx` | Why hiring runs on oversharing (3 editorial columns) |
| `CareerCardSection.tsx` | Card built from blocks; sparse card still valid |
| `DisclosureSection.tsx` | Money shot — interactive Employer view ↔ Your vault toggle |
| `HowItWorksSection.tsx` | Build → Verify → Share |
| `EmployersSection.tsx` | `#employers` anchor; block-request product mock |
| `TrustSection.tsx` | Midnight / ZK narrative (present-continuous claims only) |
| `FinalCtaSection.tsx` | Closing CTA + candidate-agent small print |
| `landing-shared.tsx` | `InkBand`, `SectionHeader`, `LandingContainer`, palette helpers |

**Ink bands** (hero, disclosure, trust) are deliberately theme-independent — always the deep-ink plane, in light and dark themes. Everything else is theme-aware via `isDark`.

## Fonts

- **Fraunces** (display serif) — brand + headlines. Loaded in `src/app/layout.tsx` via `next/font` as `--font-fraunces`, exposed as Tailwind `font-display` (`tailwind.config.ts`).
- **Montserrat** — body copy (app default).
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
