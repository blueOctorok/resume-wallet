/**
 * Favicon generator — the Provven double-V brand mark.
 *
 * Renders the exact wordmark "vv" (Fraunces 600, cream base v + gold seal v,
 * -0.38em interlock, 0.07em dip — keep in sync with ProvvenWordmark.tsx) via
 * satori so the SVG contains the real glyph outlines, then composes:
 *   - public/favicon.svg   (navy tile + vector VV)
 *   - src/app/favicon.ico  (16/32/48 PNG-in-ICO)
 *   - /tmp/favicon-preview.png (256px preview for visual check)
 *
 * Run: node scripts/generate-favicon.mjs   (needs network for Google Fonts)
 */

import { writeFileSync } from 'node:fs'
import satori from 'satori'
import sharp from 'sharp'

// Base v is dimmed (ghost) like the wordmark; slightly stronger than the
// wordmark's 65% so it survives 16px rendering
const BASE_CREAM = 'rgba(244,241,234,0.75)'
const GOLD_SEAL = '#cda868'
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

async function main() {
  const fontData = await fetchFraunces()

  // Mirror of ProvvenWordmark geometry
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
        // gold outline v rides slightly high, mirroring the wordmark
        {
          type: 'span',
          props: {
            style: { color: GOLD_SEAL, transform: `translateY(${-0.045 * FONT_SIZE}px)` },
            children: 'v',
          },
        },
        // ghost v laid on top, dipping below the baseline
        {
          type: 'span',
          props: {
            style: {
              color: BASE_CREAM,
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

  // Find the content bounding box by rasterizing + trimming transparent edges
  const raster = await sharp(Buffer.from(satoriSvg)).png().toBuffer()
  const { info } = await sharp(raster).trim().toBuffer({ resolveWithObject: true })
  const bbox = { x: -info.trimOffsetLeft, y: -info.trimOffsetTop, w: info.width, h: info.height }

  // Pull just the glyph paths out of satori's output
  const paths = [...satoriSvg.matchAll(/<path[^>]*\/>/g)].map((m) => m[0]).join('\n    ')
  if (!paths) throw new Error('No glyph paths found in satori output')

  // Compose: navy tile, hairline gold ring, VV centered in a 44px box.
  // The nested <svg viewBox=bbox> crops the satori canvas to just the mark.
  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop stop-color="#13223c"/>
      <stop offset="1" stop-color="#070d18"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="13" fill="url(#bg)"/>
  <rect x="1" y="1" width="62" height="62" rx="12" stroke="#c9a86a" stroke-opacity="0.3"/>
  <svg x="10" y="10" width="44" height="44" viewBox="${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}" preserveAspectRatio="xMidYMid meet">
    ${paths}
  </svg>
</svg>
`
  writeFileSync('public/favicon.svg', faviconSvg)

  // ICO: 16/32/48 PNG entries (modern PNG-in-ICO)
  const sizes = [16, 32, 48]
  const pngs = await Promise.all(
    sizes.map((s) => sharp(Buffer.from(faviconSvg), { density: (72 * s) / 64 }).resize(s, s).png().toBuffer()),
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
  await sharp(Buffer.from(faviconSvg)).resize(256, 256).png().toFile('/tmp/favicon-preview.png')

  console.log('bbox:', bbox)
  console.log('Wrote public/favicon.svg, src/app/favicon.ico, /tmp/favicon-preview.png')
}

main()
