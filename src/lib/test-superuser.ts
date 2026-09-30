/**
 * Testing-only inbox. This address already owns Pace, so the carrier signup
 * form would 409. A second company on the same address would be claimed the
 * next time this person signs in and knock them off Pace.
 *
 * The access form still accepts this email. The new company is owned by a
 * plus-alias, which delivers to the same inbox and signs in as its own user.
 */
const TEST_SUPERUSER_EMAILS = new Set(['s.blaha@pacedrivers.com'])

export function isTestSuperuserEmail(email: string): boolean {
  return TEST_SUPERUSER_EMAILS.has(email.trim().toLowerCase())
}

export function testCarrierAlias(email: string): string {
  const [local, domain] = email.trim().toLowerCase().split('@')
  const base = local.split('+')[0]
  return `${base}+carrier${Date.now()}@${domain}`
}
