/**
 * The DOT job keeps the driver's own words. The resume only changes how those
 * words are split, so a paragraph, a comma list, and a dashed list all print
 * as the same kind of bullet. It does not rewrite what they did.
 */
export function workDescriptionToBullets(raw: string | null | undefined): string[] {
  const text = (raw ?? '').replace(/\r\n/g, '\n').trim()
  if (!text) return []

  const lines = text.split(/\n+/).map(stripMarker).filter(Boolean)
  const pieces = lines.length > 1 ? lines.flatMap(splitOneBlock) : splitOneBlock(text)

  const seen = new Set<string>()
  const bullets: string[] = []
  for (const piece of pieces) {
    const bullet = polish(piece)
    if (!bullet) continue
    const key = bullet.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    bullets.push(bullet)
  }
  return bullets
}

function stripMarker(line: string): string {
  return line.replace(/^\s*(?:[-•*·–]|\d+[.)])\s+/, '').trim()
}

function splitOneBlock(text: string): string[] {
  const cleaned = stripMarker(text)
  if (!cleaned) return []

  if (cleaned.includes(';')) {
    return cleaned.split(';').map((part) => part.trim()).filter(Boolean)
  }

  // A comma list of short phrases, not a sentence that happens to contain commas.
  if (!/[.!?]/.test(cleaned) && cleaned.includes(',')) {
    const parts = cleaned
      .split(',')
      .map((part) => part.trim().replace(/^and\s+/i, ''))
      .filter(Boolean)
    if (parts.length >= 2 && parts.every((part) => part.length <= 90)) return parts
  }

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
  return sentences.length ? sentences : [cleaned]
}

function polish(raw: string): string {
  let text = stripMarker(raw).replace(/\s+/g, ' ').trim()
  text = text.replace(/[;,]+$/, '').replace(/^and\s+/i, '').trim()
  if (!text) return ''
  text = text.charAt(0).toUpperCase() + text.slice(1)
  return text.replace(/\.+$/, '')
}
