/** Company columns → one mailing line. Empty when the company has no address on file. */
export function formatCompanyMailingAddress(company: {
  address_street?: string | null
  address_city?: string | null
  address_state?: string | null
  address_zip?: string | null
} | null | undefined): string | null {
  if (!company) return null
  const street = company.address_street?.trim() || ''
  const city = company.address_city?.trim() || ''
  const stateZip = [company.address_state?.trim(), company.address_zip?.trim()].filter(Boolean).join(' ')
  const cityLine = [city, stateZip].filter(Boolean).join(', ')
  const line = [street, cityLine].filter(Boolean).join(', ')
  return line || null
}

/**
 * How a person's name is stored in Provven. "BRIAN" becomes "Brian".
 * A hyphen or apostrophe starts a new word ("MARY-JANE", "O'BRIEN").
 */
export function titleCaseName(raw?: string | null): string {
  if (!raw?.trim()) return ''
  return raw
    .trim()
    .toLowerCase()
    .replace(/(^|[^a-z])([a-z])/g, (_match, sep: string, ch: string) => sep + ch.toUpperCase())
}

/** First, middle, and last on a DOT form. Other fields stay as entered. */
export function titleCaseForm1Names<T extends Record<string, unknown> | null | undefined>(form1: T): T {
  if (!form1) return form1
  const next = { ...form1 }
  for (const key of ['firstName', 'middleName', 'lastName'] as const) {
    if (typeof next[key] === 'string') next[key] = titleCaseName(next[key])
  }
  return next
}

/** Street on the first line, city / state / ZIP on the second. */
export function formatPostalAddress(parts: {
  street?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  zipCode?: string | null
}): string {
  const street = parts.street?.trim() || ''
  const zip = parts.zip?.trim() || parts.zipCode?.trim() || ''
  const locality = [parts.city?.trim(), [parts.state?.trim(), zip].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')
  return [street, locality].filter(Boolean).join('\n')
}

/**
 * Employer addresses are typed as one string: "293 Vernon White Rd, Winterville, NC 28590".
 * The first comma ends the street. Anything already broken into lines is left alone.
 */
export function formatFreeformPostalAddress(raw?: string | null): string {
  const text = raw?.trim() || ''
  if (!text || text.includes('\n')) return text
  const parts = text.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length < 2) return text
  return `${parts[0]}\n${parts.slice(1).join(', ')}`
}
