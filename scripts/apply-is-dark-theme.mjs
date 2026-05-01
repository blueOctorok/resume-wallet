import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', 'src')
const SKIP = new Set([
  path.join(ROOT, 'lib', 'theme-storage.ts'),
  path.join(ROOT, 'contexts', 'ThemeContext.tsx'),
  // Local `theme` is only 'light' | 'dark' — not StoredTheme / ink
  path.join(ROOT, 'app', 'card', '[token]', 'embed', 'page.tsx'),
])
const IMPORT = "import { isDarkTheme } from '@/lib/theme-storage'"

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else if (/\.(tsx|ts)$/.test(ent.name)) out.push(p)
  }
  return out
}

let patched = 0
for (const file of walk(ROOT)) {
  if (SKIP.has(file)) continue
  let t = fs.readFileSync(file, 'utf8')
  if (!t.includes("theme === 'dark'") && !t.includes("theme !== 'dark'")) continue
  const orig = t
  // No trailing \b after 'dark' — quote + space are both "non-word", so \b would never match.
  t = t.replace(/\btheme !== 'dark'/g, '!isDarkTheme(theme)')
  t = t.replace(/\btheme === 'dark'/g, 'isDarkTheme(theme)')
  if (t === orig) continue
  if (!t.includes(IMPORT) && t.includes('isDarkTheme')) {
    const lines = t.split('\n')
    let ins = 0
    if (lines[0]?.trim() === "'use client'" || lines[0]?.trim() === '"use client"') {
      ins = 1
      while (ins < lines.length && lines[ins].trim() === '') ins++
    }
    lines.splice(ins, 0, IMPORT)
    t = lines.join('\n')
  }
  fs.writeFileSync(file, t)
  patched++
  console.log(path.relative(ROOT, file))
}
console.error(`Patched ${patched} files`)
