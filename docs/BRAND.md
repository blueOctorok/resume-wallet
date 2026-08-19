# Provven Brand — Blue Star preview

**Preview for agency review (2026-08-18).** Mark + palette are Blue Star’s
system: shield + check, Midnight Blue, Hot Embers, Ironside. The ND gold
pair is parked — swap back by reverting this palette pass.

This document is the canonical spec. If an asset and this doc ever disagree,
fix the asset.

## Colors

**One hex per token.** Do not invent Hot Embers tints (`#c43d14`, `#f78a5c`, `#f76d42`). Washes are `#f15a2b` at opacity. Light and dark use the same accent hex.

| Token | Hex | Use |
|---|---|---|
| Midnight Blue | `#173150` | Ink, dark shell, type on paper |
| Hot Embers | `#f15a2b` | Mark, CTAs, verified — the only orange |
| Ironside | `#939598` | Captions, hints, paper borders. Not body copy — use `#5c6166`. |
| Paper | `#f3f4f5` | Light surfaces |
| Type on navy | `#f4f1ea` | Wordmark + headings on ink |

### Secondary (Blue Star, 2026-08-19)

| Token | Hex | Use |
|---|---|---|
| Denim | `#00608b` | Cool support — `sky-*` / `denim` (jobs, info) |
| Dark Amber | `#F28A0F` | In-progress / attention — not a Hot Embers shade |
| Retro Teal | `#3F8A8C` | Cool support tiles — `retro-teal` |

## Mark

Shield crown + check + bottom V. The check **joins** the top-right of the crown
(it does not cut through a separate stroke). Traced from the agency art.

| Use | Source |
|---|---|
| React — mark | [`src/components/ui/ProvvenMark.tsx`](../src/components/ui/ProvvenMark.tsx) — embers on ink/dark, Midnight Blue on paper |
| React — lockup | [`src/components/ui/ProvvenWordmark.tsx`](../src/components/ui/ProvvenWordmark.tsx) — mark + `PROVVEN` (Montserrat bold) |
| SVG — dark | `public/brand/provven-mark.svg` (Hot Embers, transparent) |
| SVG — light | `public/brand/provven-mark-light.svg` (Midnight Blue, transparent) |
| Tile / favicon | `public/brand/provven-mark-tile.svg`, `public/favicon.svg`, `src/app/favicon.ico` |

## Lockup

Horizontal: mark to the left of **PROVVEN** (bold sans, `tracking-[0.08em]`).
Size the wordmark with font-size; the mark is `1.15em` tall so it tracks.

## Type

| Role | Face |
|---|---|
| Body, lockup, headlines | **Montserrat** (`font-display` maps here) |

One family. Weight and size do hierarchy. Blue Star specified Arboria + Richmond (licensed); we keep Montserrat.

## Regenerating tile + favicon

The mark SVGs are the traced art — do not regenerate them from Fraunces.

```bash
node scripts/generate-brand-assets.mjs
```

Writes the midnight tile, favicon SVG, and ICO from `provven-mark.svg`.
