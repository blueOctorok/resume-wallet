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
 * PDF display only. Stored names stay as typed. "BRIAN" prints as "Brian";
 * a hyphen or apostrophe starts a new word ("MARY-JANE", "O'BRIEN").
 */
export function titleCaseName(raw?: string | null): string {
  if (!raw?.trim()) return ''
  return raw
    .trim()
    .toLowerCase()
    .replace(/(^|[^a-z])([a-z])/g, (_match, sep: string, ch: string) => sep + ch.toUpperCase())
}
