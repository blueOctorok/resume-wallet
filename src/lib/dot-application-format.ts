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
