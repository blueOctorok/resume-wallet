# Provven Brand — The Double-V Mark

The double-V is Provven's brand symbol. It reads as two verifications stacked:
the **ghost v** is the fact as the issuer attested it; the **solid gold v** is
Provven's seal laid over it. Together they cascade diagonally as one unit — a
modern take on the wax seal, without the skeuomorphism.

This document is the canonical spec. If an asset and this doc ever disagree,
fix the asset.

## Exact specification

| Property | Value |
|---|---|
| Typeface | **Fraunces**, weight **600** (`font-display` in the app) |
| Letters | Two lowercase `v` glyphs, `tracking-tight` (−0.025em) |
| Gold seal v (first) | Solid fill. `#cda868` on ink/dark surfaces, bronze `#6b5024` on cream/light. Raised **0.045em** above the baseline |
| Ghost v (second) | Base letter color, dimmed: **65%** opacity on ink/dark (`#f4f1ea`/white), **55%** on cream (`stone-900`). Pulled **−0.38em** left onto the gold v, dipping **0.07em** below the baseline |
| Wordmark | `Pro` + mark + `en`, with `en` padded `ml-[0.01em]`. Whole word is `whitespace-nowrap` |
| Nav wordmark (Orbitron caps) | Same idea, tuned for the wider face: overlap −0.2em, ghost at 60–65%, `EN` at `ml-[0.04em]` |
| Favicon / tile | Navy gradient tile `#13223c → #070d18`, `rx≈13/64`, hairline ring `#c9a86a` at 30%, mark centered in a 44/64 box. Ghost boosted to **75%** so it survives 16px |

Every offset is in `em`, so the mark scales as one unit with font-size.

## Where it lives

| Use | Source |
|---|---|
| React — mark alone | [`src/components/ui/ProvvenMark.tsx`](../src/components/ui/ProvvenMark.tsx) — `<ProvvenMark label='Provven' className='text-5xl' />`. `tone='ink'` (default, cream-on-navy) or `tone='auto'` + `isDark` for theme-aware surfaces |
| React — full wordmark | [`src/components/ui/ProvvenWordmark.tsx`](../src/components/ui/ProvvenWordmark.tsx) — composes `ProvvenMark`; hero, final CTA, footer |
| React — nav wordmark | [`src/components/ui/StormChainWordmark.tsx`](../src/components/ui/StormChainWordmark.tsx) — Orbitron caps variant |
| SVG — dark surfaces | `public/brand/provven-mark.svg` (transparent; gold + cream ghost) |
| SVG — light surfaces | `public/brand/provven-mark-light.svg` (transparent; bronze + stone ghost) |
| SVG — app-icon tile | `public/brand/provven-mark-tile.svg` (navy tile + gold ring) |
| Favicon | `public/favicon.svg` + `src/app/favicon.ico` (16/32/48 PNG-in-ICO) |

The SVGs contain the real Fraunces glyph outlines (no font dependency), so
they're safe for emails, OG images, decks, and any context without webfonts.

## Regenerating the assets

All SVG/ICO assets come from one script — never hand-edit them:

```bash
node scripts/generate-brand-assets.mjs   # needs network for Google Fonts
```

It renders the lockup with satori (text → vector paths), trims to the content
bounding box with sharp, and writes every asset listed above plus a 256px
preview at `/tmp/favicon-preview.png`.

**If you change the mark's geometry or colors, update all three places:**

1. `src/components/ui/ProvvenMark.tsx` (the app)
2. `scripts/generate-brand-assets.mjs` constants (the assets) — then re-run it
3. The spec table above

## Usage rules

- The gold seal v always sits **under** (drawn first, left); the ghost v lays
  **on top**, lower and to the right. Never mirror or reverse the pair.
- Don't restyle the v's independently — no outlines, shadows, or gradients on
  the glyphs. The solid-gold + ghost treatment is final (outline and
  solid-double variants were tried and rejected as noisy/thin).
- On mid-tone backgrounds where neither variant reads, use the tile.
- Screen readers: the mark alone gets `label='Provven'`; inside the wordmark
  the parent carries `aria-label='Provven'` and the letters are hidden.
