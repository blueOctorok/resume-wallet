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

## Palette (heritage-trust direction, 2026-08-07)

The landing page pioneered the heritage palette; it is now the **site-wide brand** (Tailwind's teal/violet scales are remapped to gold/steel in `tailwind.config.ts`). **No teal or violet anywhere.**

- **Ink bands** are deep ink-navy (`#0a1322`), not blue-black — navy is the institutional trust hue.
- **Light sections** sit on warm cream (`#f7f4ed` page base, `#eee8da` alternating bands) with **stone** neutrals — never cool `slate` on light. Dark mode is unchanged.
- **One accent: champagne gold — the "seal."** It marks brand moments, verified facts, the disclosure seam, and primary CTAs (`GOLD_CTA` in `landing-shared.tsx`). Three tones only: `#c9a86a` (lines/borders/fills), `#d4be93` (text on navy, `#e6cf9f` bright), `#8a6d3b` (deep bronze text on cream).
- Redaction bars and "never leaves" states are **neutral slate** — hidden things carry no accent.

## Brand marks

- **`ProvvenWordmark`** (`src/components/ui/ProvvenWordmark.tsx`) — serif wordmark; the `vv` pair is the brand symbol: a **solid gold v** (Provven's seal) with a **ghost v** (base color at ~65%, the fact) laid on top, pulled in −0.38em and dipping below the baseline. Hero, final CTA, footer.
- **The double-V is also the favicon** (`public/favicon.svg` + `src/app/favicon.ico`) — exact Fraunces glyph outlines on a navy tile. Regenerate with `node scripts/generate-favicon.mjs` after any change to the mark.
- **`SealDivider`** (`landing-shared.tsx`) — hairline rule with a centered gold diamond; opens the final CTA and the footer.

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
