# Provven Brand — Blue Star mark + ND colors

The brand mark is Blue Star’s shield + check (security + proven). Colors are
Notre Dame’s pair — **ND Blue** and **Dome Gold** — not Blue Star’s Hot Embers
and not the previous champagne double-V.

This document is the canonical spec. If an asset and this doc ever disagree,
fix the asset.

## Colors

| Token | Hex | Use |
|---|---|---|
| ND Blue | `#0C2340` | Ink bands, dark shell, mark on cream |
| Dome Gold | `#C99700` | Mark on navy, CTAs, verified accent |
| Metallic Gold | `#AE9142` | Quieter gold (optional) |
| Cream | `#f7f4ed` | Light surfaces |
| Type on navy | `#f4f1ea` | Wordmark + headings on ink |

Hot Embers `#f15a2b` is unused.

## Mark

Shield crown + check + bottom V. The check **joins** the top-right of the crown
(it does not cut through a separate stroke). Traced from the agency art.

| Use | Source |
|---|---|
| React — mark | [`src/components/ui/ProvvenMark.tsx`](../src/components/ui/ProvvenMark.tsx) — gold on ink/dark, ND Blue on cream |
| React — lockup | [`src/components/ui/ProvvenWordmark.tsx`](../src/components/ui/ProvvenWordmark.tsx) — mark + `PROVVEN` (Montserrat bold) |
| SVG — dark | `public/brand/provven-mark.svg` (Dome Gold, transparent) |
| SVG — light | `public/brand/provven-mark-light.svg` (ND Blue, transparent) |
| Tile / favicon | `public/brand/provven-mark-tile.svg`, `public/favicon.svg`, `src/app/favicon.ico` |

## Lockup

Horizontal: mark to the left of **PROVVEN** (bold sans, `tracking-[0.08em]`).
Size the wordmark with font-size; the mark is `1.15em` tall so it tracks.

## Type

| Role | Face |
|---|---|
| Body, lockup, headlines | **Montserrat** (`font-display` maps here) |

One family. Weight and size do hierarchy — no second “elegant” display face. Blue Star specified Arboria + Richmond (licensed); we keep Montserrat.

## Regenerating tile + favicon

The mark SVGs are the traced art — do not regenerate them from Fraunces.

```bash
node scripts/generate-brand-assets.mjs
```

Writes the navy tile, favicon SVG, and ICO from `provven-mark.svg`.
