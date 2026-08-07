/**
 * Brand asset generator — the Provven double-V mark.
 *
 * Renders the exact wordmark "vv" (Fraunces 600, gold seal v + ghost v,
 * -0.38em interlock, 0.045em rise, 0.07em dip — keep in sync with
 * src/components/ui/ProvvenMark.tsx; full spec in docs/BRAND.md) via satori
 * so the SVGs contain the real glyph outlines, then composes:
 *   - public/brand/provven-mark.svg        (transparent, for navy/dark surfaces)
 *   - public/brand/provven-mark-light.svg  (transparent, for cream/light surfaces)
 *   - public/brand/provven-mark-tile.svg   (navy tile + gold ring, app-icon style)
 *   - public/favicon.svg                   (same as the tile)
 *   - src/app/favicon.ico                  (16/32/48 PNG-in-ICO)
 *   - /tmp/favicon-preview.png             (256px preview for visual check)
 *
 * Run: node scripts/generate-brand-assets.mjs   (needs network for Google Fonts)
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import satori from 'satori'
import sharp from 'sharp'

// Dark-surface variant (ink/navy backgrounds) — mirrors ProvvenMark tone='ink'.
// Ghost runs slightly stronger than the wordmark's 65% so it survives 16px.
const DARK = { gold: '#cda868', ghost: 'rgba(244,241,234,0.75)' }
// Light-surface variant (cream/white backgrounds) — bronze + dimmed stone
const LIGHT = { gold: '#6b5024', ghost: 'rgba(28,25,23,0.55)' }

const RISE_EM = -0.045
const OVERLAP_EM = -0.38
const DIP_EM = 0.07
const FONT_SIZE = 280
const CANVAS = 512

async function fetchFraunces() {
  // Old UA makes Google Fonts serve WOFF/TTF (satori can't parse woff2)
  const css = await fetch('https://fonts.googleapis.com/css2?family=Fraunces:wght@600&display=swap', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; rv:22.0) Gecko/20130405 Firefox/22.0' },
  }).then((r) => r.text())
  const match = css.match(/url\((https:[^)]+\.(?:ttf|woff))\)/)
  if (!match) throw new Error(`No TTF/WOFF url in css response:\n${css}`)
  return Buffer.from(await fetch(match[1]).then((r) => r.arrayBuffer()))
}

/** Render the vv lockup with satori and return just the glyph <path> elements */
async function renderGlyphPaths(fontData, colors) {
  const lockup = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: `${CANVAS}px`,
        height: `${CANVAS}px`,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Fraunces',
        fontWeight: 600,
        fontSize: `${FONT_SIZE}px`,
      },
      children: [
        // solid gold v rides slightly high, mirroring the wordmark
        {
          type: 'span',
          props: {
            style: { color: colors.gold, transform: `translateY(${RISE_EM * FONT_SIZE}px)` },
            children: 'v',
          },
        },
        // ghost v laid on top, dipping below the baseline
        {
          type: 'span',
          props: {
            style: {
              color: colors.ghost,
              marginLeft: `${OVERLAP_EM * FONT_SIZE}px`,
              transform: `translateY(${DIP_EM * FONT_SIZE}px)`,
            },
            children: 'v',
          },
        },
      ],
    },
  }

  const satoriSvg = await satori(lockup, {
    width: CANVAS,
    height: CANVAS,
    fonts: [{ name: 'Fraunces', data: fontData, weight: 600, style: 'normal' }],
  })

  const paths = [...satoriSvg.matchAll(/<path[^>]*\/>/g)].map((m) => m[0]).join('\n  ')
  if (!paths) throw new Error('No glyph paths found in satori output')
  return { satoriSvg, paths }
}

async function main() {
  const fontData = await fetchFraunces()

  const dark = await renderGlyphPaths(fontData, DARK)
  const light = await renderGlyphPaths(fontData, LIGHT)

  // Find the content bounding box by rasterizing + trimming transparent edges
  // (geometry is identical across variants, so one trim serves both)
  const raster = await sharp(Buffer.from(dark.satoriSvg)).png().toBuffer()
  const { info } = await sharp(raster).trim().toBuffer({ resolveWithObject: true })
  const bbox = { x: -info.trimOffsetLeft, y: -info.trimOffsetTop, w: info.width, h: info.height }

  mkdirSync('public/brand', { recursive: true })

  // Standalone transparent marks — viewBox hugs the glyphs so they scale cleanly
  const standalone = (paths) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}" fill="none">
  ${paths}
</svg>
`
  writeFileSync('public/brand/provven-mark.svg', standalone(dark.paths))
  writeFileSync('public/brand/provven-mark-light.svg', standalone(light.paths))

  // Tile: navy gradient, hairline gold ring, VV centered in a 44px box.
  // The nested <svg viewBox=bbox> crops the satori canvas to just the mark.
  const tileSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop stop-color="#13223c"/>
      <stop offset="1" stop-color="#070d18"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="13" fill="url(#bg)"/>
  <rect x="1" y="1" width="62" height="62" rx="12" stroke="#c9a86a" stroke-opacity="0.3"/>
  <svg x="10" y="10" width="44" height="44" viewBox="${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}" preserveAspectRatio="xMidYMid meet">
    ${dark.paths}
  </svg>
</svg>
`
  writeFileSync('public/brand/provven-mark-tile.svg', tileSvg)
  writeFileSync('public/favicon.svg', tileSvg)

  // ICO: 16/32/48 PNG entries (modern PNG-in-ICO)
  const sizes = [16, 32, 48]
  const pngs = await Promise.all(
    sizes.map((s) => sharp(Buffer.from(tileSvg), { density: (72 * s) / 64 }).resize(s, s).png().toBuffer()),
  )

  const headerSize = 6 + 16 * sizes.length
  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(sizes.length, 4)
  let offset = headerSize
  sizes.forEach((s, i) => {
    const entry = 6 + i * 16
    header.writeUInt8(s === 256 ? 0 : s, entry) // width
    header.writeUInt8(s === 256 ? 0 : s, entry + 1) // height
    header.writeUInt8(0, entry + 2) // palette colors
    header.writeUInt8(0, entry + 3) // reserved
    header.writeUInt16LE(1, entry + 4) // color planes
    header.writeUInt16LE(32, entry + 6) // bits per pixel
    header.writeUInt32LE(pngs[i].length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += pngs[i].length
  })
  writeFileSync('src/app/favicon.ico', Buffer.concat([header, ...pngs]))

  // Large preview for visual verification
  await sharp(Buffer.from(tileSvg)).resize(256, 256).png().toFile('/tmp/favicon-preview.png')

  console.log('bbox:', bbox)
  console.log('Wrote public/brand/{provven-mark,provven-mark-light,provven-mark-tile}.svg, public/favicon.svg, src/app/favicon.ico')
}

main()
