/**
 * Brand assets — Blue Star shield + Blue Star colors.
 *
 * Reads public/brand/provven-mark.svg (Hot Embers) and writes:
 *   - public/brand/provven-mark-tile.svg
 *   - public/favicon.svg
 *   - src/app/favicon.ico (16/32/48 PNG-in-ICO)
 *
 * The mark SVGs themselves are the traced agency art — do not regenerate
 * those from Fraunces. Run: node scripts/generate-brand-assets.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const GOLD = '#f15a2b'
const NAVY = '#173150'
const NAVY_DEEP = '#0d1a28'

const markInner = readFileSync('public/brand/provven-mark.svg', 'utf8')
  .replace(/<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .trim()

const tileSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop stop-color="${NAVY}"/>
      <stop offset="1" stop-color="${NAVY_DEEP}"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="13" fill="url(#bg)"/>
  <rect x="1" y="1" width="62" height="62" rx="12" stroke="${GOLD}" stroke-opacity="0.35"/>
  <svg x="12" y="10" width="40" height="44" viewBox="0 0 738 783" preserveAspectRatio="xMidYMid meet">
    ${markInner}
  </svg>
</svg>
`

writeFileSync('public/brand/provven-mark-tile.svg', tileSvg)
writeFileSync('public/favicon.svg', tileSvg)

const sizes = [16, 32, 48]
const pngs = await Promise.all(
  sizes.map((s) => sharp(Buffer.from(tileSvg), { density: (72 * s) / 64 }).resize(s, s).png().toBuffer()),
)

const headerSize = 6 + 16 * sizes.length
const header = Buffer.alloc(headerSize)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = headerSize
sizes.forEach((s, i) => {
  const entry = 6 + i * 16
  header.writeUInt8(s, entry)
  header.writeUInt8(s, entry + 1)
  header.writeUInt8(0, entry + 2)
  header.writeUInt8(0, entry + 3)
  header.writeUInt16LE(1, entry + 4)
  header.writeUInt16LE(32, entry + 6)
  header.writeUInt32LE(pngs[i].length, entry + 8)
  header.writeUInt32LE(offset, entry + 12)
  offset += pngs[i].length
})
writeFileSync('src/app/favicon.ico', Buffer.concat([header, ...pngs]))
await sharp(Buffer.from(tileSvg)).resize(256, 256).png().toFile('/tmp/favicon-preview.png')
console.log('Wrote tile, favicon.svg, favicon.ico')
