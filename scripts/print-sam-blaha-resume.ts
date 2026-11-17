/**
 * Print Sam Blaha's Provven resume.
 *
 *   npm run resume:sam
 *   npm run resume:sam -- /path/to/Resume.pdf
 *
 * Default writes the file the blahablast site serves.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { generateResumeSheetPDF } from '@/lib/driver-resume-packet-pdf'
import { samBlahaResumeSheet } from '@/lib/sam-blaha-resume'

function pngDataUrl(path: string): string {
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`
}

async function main() {
  const out =
    process.argv[2] ?? '/mnt/c/Users/blaha/Desktop/blahablast-v4/public/Resume.pdf'
  const brand = resolve('public/brand')
  const pdf = await generateResumeSheetPDF(samBlahaResumeSheet(), {
    markDataUrl: pngDataUrl(resolve(brand, 'provven-mark.png')),
    paperDataUrl: pngDataUrl(resolve(brand, 'resume-paper.png')),
  })
  writeFileSync(out, pdf)
  console.log(`wrote ${out} (${pdf.length} bytes)`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
