/**
 * Testing-only inboxes for the carrier access form.
 *
 * s.blaha@pacedrivers.com already owns Pace. A second company on that address
 * would be claimed the next time that login signs in.
 *
 * stormchaintest@gmail.com is already a candidate login, and Gmail is otherwise
 * rejected. Gmail delivers plus-addresses to the same inbox (Pace mail does not),
 * so the company is owned by stormchaintest+carrier…@gmail.com and the code
 * shows up in the stormchaintest inbox.
 */
const TEST_SUPERUSER_EMAILS = new Set(['s.blaha@pacedrivers.com'])

const TEST_CARRIER_INBOXES = new Set(['stormchaintest@gmail.com'])

export function isTestSuperuserEmail(email: string): boolean {
  return TEST_SUPERUSER_EMAILS.has(email.trim().toLowerCase())
}

export function isTestCarrierInbox(email: string): boolean {
  return TEST_CARRIER_INBOXES.has(email.trim().toLowerCase())
}

export function testCarrierAlias(email: string): string {
  const [local, domain] = email.trim().toLowerCase().split('@')
  const base = local.split('+')[0]
  return `${base}+carrier${Date.now()}@${domain}`
}
